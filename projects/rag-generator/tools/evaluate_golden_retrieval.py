#!/usr/bin/env python3
"""
Golden-queries retrieval evaluator for Lore RAG.

Features:
- Offline mode: in-process evaluation against RetrievalService, using FAISS index and embeddings.
- API mode: HTTP POST to /retrieve on the FastAPI app.
- Computes Recall@K (1/3/5), MRR@5, Domain Match Rate (top-1), Entity Hit-Rate (top-5).
- Handles negative-control queries (no gold sections) separately.
- Emits JSON and Markdown reports under storage/evaluation/.
- Thresholds can be parsed from backend/config/evaluation_config.xml and overridden via CLI.

Usage:
  python tools/evaluate_golden_retrieval.py --mode offline --k 5
  python tools/evaluate_golden_retrieval.py --mode api --base-url http://localhost:8000

Exit codes:
  0 = success (evaluation completed, thresholds not enforced here)
  2 = fatal configuration or runtime error (missing files or dependencies)
"""

import argparse
import json
import multiprocessing
import os
import sys
import time
import traceback
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

# Ensure project root is on sys.path for 'backend.*' imports
try:
    _THIS_DIR = Path(__file__).resolve().parent
    _PROJECT_ROOT = _THIS_DIR.parent
    if str(_PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(_PROJECT_ROOT))
except Exception:
    pass

# Optional import for HTTP calls
try:
    import requests  # type: ignore
except Exception:
    requests = None  # Fallback available via urllib if needed

# Constants
DEFAULT_GOLD = "data/gold_queries_director.json"
DEFAULT_OUTPUT_DIR = "storage/evaluation"
DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_INDEX = "storage/store/faiss.index"
DEFAULT_VECTORS = "storage/store/vectors.npy"
DEFAULT_ROWMAP = "storage/store/rowmap.json"
DEFAULT_META = "storage/store/meta.jsonl"
DEFAULT_EVAL_CONFIG = "backend/config/evaluation_config.xml"


def _load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _read_gold_queries(path: str) -> List[Dict[str, Any]]:
    data = _load_json(path)
    if not isinstance(data, list):
        raise ValueError("gold_queries.json must be a list of query objects")
    return data


def _normalize_section_id(section_id: str) -> Tuple[str, str]:
    """
    Returns a tuple (raw, base) where:
    - raw is the original section_id as-is
    - base is the portion before the first '#' anchor
    """
    raw = section_id or ""
    base = raw.split("#", 1)[0] if "#" in raw else raw
    return raw, base


def _match_any_gold_section(candidate_section_id: str, gold_sections: List[str]) -> bool:
    if not candidate_section_id or not gold_sections:
        return False
    c_raw, c_base = _normalize_section_id(candidate_section_id)
    for g in gold_sections:
        g_raw, g_base = _normalize_section_id(g)
        # Prefer exact raw match, fallback to base match
        if c_raw == g_raw:
            return True
        if c_base and g_base and c_base == g_base:
            return True
    return False


def _extract_domain(result: Dict[str, Any]) -> str:
    # Try direct field, then nested metadata if present
    dom = result.get("domain")
    if dom:
        return str(dom)
    meta = result.get("metadata") or {}
    dom2 = meta.get("domain")
    return str(dom2) if dom2 else ""


def _extract_entities(result: Dict[str, Any]) -> List[str]:
    entities = result.get("entities") or []
    norm: List[str] = []
    for e in entities:
        if isinstance(e, dict):
            # API format in backend/api/retriever.py: entity dicts expose 'entity_name'
            # For offline full-path, entities may directly be strings; support both.
            val = e.get("entity_id") or e.get("entity_name") or ""
            if val:
                norm.append(str(val).casefold())
        elif isinstance(e, str):
            norm.append(e.casefold())
        else:
            # Unknown type, stringify
            norm.append(str(e).casefold())
    return norm


def _entity_hit(top_results: List[Dict[str, Any]], gold_entities: List[str]) -> bool:
    if not gold_entities:
        return False
    gold_norm = [g.casefold() for g in gold_entities]
    for r in top_results:
        cand_entities = _extract_entities(r)
        # Hit if any overlap by contains or exact equality (lenient)
        for g in gold_norm:
            for c in cand_entities:
                if c == g or g in c or c in g:
                    return True
    return False


def _compute_metrics(
    gold_queries: List[Dict[str, Any]],
    results_by_qid: Dict[str, List[Dict[str, Any]]],
    k_values: Tuple[int, int, int] = (1, 3, 5),
) -> Dict[str, Any]:
    k1, k3, k5 = k_values
    recall_counts = {k1: 0, k3: 0, k5: 0}
    denom_recall = 0  # queries with any gold_sections
    mrr_sum = 0.0
    denom_mrr = 0
    domain_matches = 0
    denom_domain = 0
    entity_hits = 0
    denom_entity = 0

    no_canon_total = 0
    no_canon_any_returned = 0

    per_query_details: List[Dict[str, Any]] = []

    for item in gold_queries:
        qid = item.get("id") or ""
        query = item.get("query") or ""
        gold_sections = item.get("gold_sections") or []
        gold_domain = item.get("domain") or ""
        gold_entities = item.get("entities") or []
        negative_control = (not gold_sections) and (item.get("gold_answer") in (None, "", "null"))

        res_list = results_by_qid.get(qid, []) or []
        top1 = res_list[0] if res_list else {}
        topk = res_list[:k5]

        # Domain match (top-1 vs gold domain), count only if gold domain exists
        if gold_domain:
            denom_domain += 1
            if _extract_domain(top1).casefold() == str(gold_domain).casefold():
                domain_matches += 1

        # Entity hit-rate top-5, count only if gold entities exist
        if gold_entities:
            denom_entity += 1
            if _entity_hit(topk, gold_entities):
                entity_hits += 1

        # Negative controls
        if negative_control:
            no_canon_total += 1
            if res_list:
                no_canon_any_returned += 1
            per_query_details.append({
                "id": qid,
                "query": query,
                "mode": "no_canon",
                "top1_section_id": top1.get("section_id", "") if res_list else "",
                "top1_domain": _extract_domain(top1) if res_list else "",
                "returned_any_results": bool(res_list),
                "notes": item.get("notes", ""),
            })
            continue

        # Recall and MRR for queries with gold sections
        if gold_sections:
            denom_recall += 1
            denom_mrr += 1

            # Recall@K
            hit_k1 = any(_match_any_gold_section(r.get("section_id", ""), gold_sections) for r in res_list[:k1])
            hit_k3 = any(_match_any_gold_section(r.get("section_id", ""), gold_sections) for r in res_list[:k3])
            hit_k5 = any(_match_any_gold_section(r.get("section_id", ""), gold_sections) for r in res_list[:k5])

            recall_counts[k1] += 1 if hit_k1 else 0
            recall_counts[k3] += 1 if hit_k3 else 0
            recall_counts[k5] += 1 if hit_k5 else 0

            # MRR@5
            rank = 0
            for i, r in enumerate(res_list[:k5], start=1):
                if _match_any_gold_section(r.get("section_id", ""), gold_sections):
                    rank = i
                    break
            mrr_contrib = (1.0 / rank) if rank > 0 else 0.0
            mrr_sum += mrr_contrib

            per_query_details.append({
                "id": qid,
                "query": query,
                "mode": "with_gold",
                "hit_at_1": hit_k1,
                "hit_at_3": hit_k3,
                "hit_at_5": hit_k5,
                "first_hit_rank": rank if rank > 0 else None,
                "top1_section_id": top1.get("section_id", "") if res_list else "",
                "top1_domain": _extract_domain(top1) if res_list else "",
                "entities_overlap": _entity_hit(res_list[:k5], gold_entities) if gold_entities else None,
                "notes": item.get("notes", ""),
            })
        else:
            # Queries lacking explicit gold sections but not negative-control
            per_query_details.append({
                "id": qid,
                "query": query,
                "mode": "no_gold_sections",
                "top1_section_id": top1.get("section_id", "") if res_list else "",
                "top1_domain": _extract_domain(top1) if res_list else "",
                "notes": item.get("notes", ""),
            })

    # Final metrics
    recall_at_1 = recall_counts[k1] / denom_recall if denom_recall else 0.0
    recall_at_3 = recall_counts[k3] / denom_recall if denom_recall else 0.0
    recall_at_5 = recall_counts[k5] / denom_recall if denom_recall else 0.0
    mrr_at_5 = mrr_sum / denom_mrr if denom_mrr else 0.0
    domain_match_rate = domain_matches / denom_domain if denom_domain else 0.0
    entity_hit_rate = entity_hits / denom_entity if denom_entity else 0.0

    summary = {
        "queries_total": len(gold_queries),
        "queries_with_gold": denom_recall,
        "queries_no_canon": no_canon_total,
        "no_canon_any_results": no_canon_any_returned,
        "recall_at_1": round(recall_at_1, 4),
        "recall_at_3": round(recall_at_3, 4),
        "recall_at_5": round(recall_at_5, 4),
        "mrr_at_5": round(mrr_at_5, 4),
        "domain_match_rate": round(domain_match_rate, 4),
        "entity_hit_rate": round(entity_hit_rate, 4),
    }

    return {
        "summary": summary,
        "per_query": per_query_details,
    }


def _parse_thresholds_from_xml(xml_path: str) -> Dict[str, float]:
    """
    Parse minimal thresholds from backend/config/evaluation_config.xml.
    Returns defaults if parsing fails.
    """
    thresholds = {
        "recall_at_1": 0.70,
        "recall_at_3": 0.75,
        "recall_at_5": 0.80,
        "mrr_at_5": 0.65,
        "entity_hit_rate": 0.85,
        "domain_match_rate": 0.85,
    }
    try:
        import xml.etree.ElementTree as ET
        tree = ET.parse(xml_path)
        root = tree.getroot()

        def get_float_by_path(path_list: List[str], default: Optional[float] = None) -> Optional[float]:
            node = root
            for tag in path_list:
                node = node.find(tag) if node is not None else None
            if node is not None and node.text:
                # Extract first float in string (supports operators like '>= 0.70')
                import re
                m = re.search(r"-?\d+(\.\d+)?", node.text)
                if m:
                    return float(m.group(0))
            return default

        r1 = get_float_by_path(["metrics", "recall_at_k", "k"], None)  # ambiguous; handle explicit nodes below
        # Explicit nodes (multiple <k value="..."> children) need iteration:
        recall_at_k = root.find("metrics/recall_at_k")
        if recall_at_k is not None:
            for k_node in list(recall_at_k):
                val_attr = k_node.attrib.get("value")
                target_node = k_node.find("target")
                if val_attr and target_node is not None and target_node.text:
                    import re
                    m = re.search(r"-?\d+(\.\d+)?", target_node.text)
                    if m:
                        v = float(m.group(0))
                        if val_attr == "1":
                            thresholds["recall_at_1"] = v
                        elif val_attr == "3":
                            thresholds["recall_at_3"] = v
                        elif val_attr == "5":
                            thresholds["recall_at_5"] = v

        # MRR@5
        mrr_node = root.find("metrics/mean_reciprocal_rank_at_5/target")
        if mrr_node is not None and mrr_node.text:
            import re
            m = re.search(r"-?\d+(\.\d+)?", mrr_node.text)
            if m:
                thresholds["mrr_at_5"] = float(m.group(0))

        # Entity hit-rate
        ehr_node = root.find("metrics/entity_hit_rate/target")
        if ehr_node is not None and ehr_node.text:
            import re
            m = re.search(r"-?\d+(\.\d+)?", ehr_node.text)
            if m:
                thresholds["entity_hit_rate"] = float(m.group(0))

        # Domain match-rate
        dmr_node = root.find("metrics/domain_match_rate/target")
        if dmr_node is not None and dmr_node.text:
            import re
            m = re.search(r"-?\d+(\.\d+)?", dmr_node.text)
            if m:
                thresholds["domain_match_rate"] = float(m.group(0))

    except Exception:
        # Keep defaults on any parsing issue
        pass

    return thresholds


def _overlay_threshold_overrides(base: Dict[str, float], overrides: List[str]) -> Dict[str, float]:
    """
    Apply overrides of form key=value, e.g., recall_at_5=0.78
    """
    if not overrides:
        return base
    out = dict(base)
    for item in overrides:
        if "=" not in item:
            continue
        k, v = item.split("=", 1)
        k = k.strip()
        try:
            out[k] = float(v.strip())
        except Exception:
            continue
    return out


def _write_json_report(output_dir: str, payload: Dict[str, Any]) -> str:
    _ensure_dir(output_dir)
    out_path = os.path.join(output_dir, "evaluation_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return out_path


def _write_markdown_report(output_dir: str, results: Dict[str, Any], thresholds: Dict[str, float]) -> str:
    _ensure_dir(output_dir)
    out_md = os.path.join(output_dir, "evaluation_report.md")
    s = results.get("summary", {})
    pq = results.get("per_query", [])

    lines: List[str] = []
    lines.append("# Golden-Queries Retrieval Evaluation")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Metric | Value | Threshold |")
    lines.append("|--------|-------|-----------|")
    for key, label in [
        ("recall_at_1", "Recall@1"),
        ("recall_at_3", "Recall@3"),
        ("recall_at_5", "Recall@5"),
        ("mrr_at_5", "MRR@5"),
        ("domain_match_rate", "Domain Match Rate"),
        ("entity_hit_rate", "Entity Hit-Rate"),
    ]:
        lines.append(f"| {label} | {s.get(key, 0.0)} | {thresholds.get(key, '-') } |")
    lines.append("")
    lines.append(f"- Total queries: {s.get('queries_total', 0)}")
    lines.append(f"- With gold sections: {s.get('queries_with_gold', 0)}")
    lines.append(f"- Negative-controls: {s.get('queries_no_canon', 0)} (any results: {s.get('no_canon_any_results', 0)})")
    lines.append("")
    lines.append("## Notable Failures (no hit in top-5 where gold exists)")
    lines.append("")
    lines.append("| ID | Top-1 Domain | Top-1 Section | Notes |")
    lines.append("|----|--------------|---------------|-------|")
    for row in pq:
        if row.get("mode") == "with_gold" and not row.get("hit_at_5", False):
            lines.append(
                f"| {row.get('id','')} | {row.get('top1_domain','')} | {row.get('top1_section_id','')} | {row.get('notes','')} |"
            )
    lines.append("")
    lines.append("## Negative Control Observations")
    lines.append("")
    for row in pq:
        if row.get("mode") == "no_canon":
            rid = row.get("id", "")
            any_ret = row.get("returned_any_results", False)
            top1sid = row.get("top1_section_id", "")
            lines.append(f"- {rid}: returned_any_results={any_ret}, top1_section_id={top1sid}")

    with open(out_md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return out_md


# --------------- Offline execution ----------------

def _offline_init_service(index_path: str, vectors_path: str, rowmap_path: str, meta_path: str):
    """
    Initialize RetrievalService, load embedding model, then override FAISS index and metadata with provided storage paths.
    Falls back gracefully if dependencies are missing.
    """
    try:
        from src.rag.api.retriever import RetrievalService  # type: ignore
    except Exception as e:
        print(f"[offline] ERROR: cannot import RetrievalService: {e}")
        return None

    svc = RetrievalService()  # Use config to initialize embeddings
    ok = svc.initialize()
    if not ok:
        print("[offline] WARNING: RetrievalService.initialize() failed; continuing, but embeddings/FAISS may be unavailable")

    # Load FAISS & vectors explicitly from provided paths
    try:
        import faiss  # type: ignore
        import numpy as np  # type: ignore

        if os.path.exists(index_path):
            svc.faiss_index = faiss.read_index(index_path)
        else:
            print(f"[offline] WARNING: FAISS index not found at {index_path}")

        if os.path.exists(vectors_path):
            svc.vectors = np.load(vectors_path)
        else:
            print(f"[offline] WARNING: vectors not found at {vectors_path}")

        # Load rowmap
        svc.rowmap = {}
        if os.path.exists(rowmap_path):
            rowmap_data = _load_json(rowmap_path)
            # rowmap.json structure expected: { "rowmap": [ { "row": int, "section_id": str }, ... ] }
            rm_list = rowmap_data.get("rowmap", [])
            svc.rowmap = {int(item["row"]): str(item["section_id"]) for item in rm_list if "row" in item and "section_id" in item}
        else:
            print(f"[offline] WARNING: rowmap not found at {rowmap_path}")

        # Load metadata
        svc.metadata = {}
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        sid = chunk.get("section_id")
                        if sid:
                            svc.metadata[str(sid)] = chunk
                    except Exception:
                        continue
        else:
            print(f"[offline] WARNING: meta.jsonl not found at {meta_path}")

    except Exception as e:
        print(f"[offline] ERROR: loading artifacts failed: {e}")
        return None

    # Quick sanity
    print(f"[offline] metadata_chunks={len(getattr(svc, 'metadata', {}))}, rowmap_entries={len(getattr(svc, 'rowmap', {}))}")
    return svc


def _offline_query(svc, query: str, k: int, rerank_cap: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Build a full RetrieveRequest to exercise the complete pipeline when possible.
    Optional rerank_cap limits candidates sent to reranker to bound worst-case latency.
    """
    try:
        from src.rag.api.retriever import RetrieveRequest  # type: ignore
    except Exception:
        # Fallback to simple string retrieval
        return svc.retrieve(query, top_k=k)

    # If rerank_cap specified, limit ANN candidates to that value
    ann_cands = rerank_cap if rerank_cap else 50
    
    req = RetrieveRequest(
        query=query,
        k=k,
        ann_candidates=ann_cands,
        filters={"canon_level": "primary"},
        enable_rerank=True,
        enable_graph_boost=True,
        include_entity_context=False,
    )
    results = svc._retrieve_full(req)
    # Ensure we only keep top-k (service should return at least k)
    return results[:k]


# --- Parallel offline evaluation helpers ---
WORKER_CTX: Dict[str, Any] = {}


def _init_worker(index_path: str, vectors_path: str, rowmap_path: str, meta_path: str, threads_per_proc: Optional[int] = None):
    """
    Initializer for worker processes: create a per-process RetrievalService.
    Also sets CPU threading environment variables per-process.
    """
    global WORKER_CTX
    
    # Set threading limits per worker process
    if threads_per_proc is not None and threads_per_proc > 0:
        os.environ["OMP_NUM_THREADS"] = str(threads_per_proc)
        os.environ["MKL_NUM_THREADS"] = str(threads_per_proc)
        os.environ["NUMEXPR_MAX_THREADS"] = str(threads_per_proc)
        try:
            import torch  # type: ignore
            torch.set_num_threads(threads_per_proc)
            torch.set_num_interop_threads(max(1, threads_per_proc // 2))
        except Exception:
            pass
    
    try:
        svc = _offline_init_service(index_path, vectors_path, rowmap_path, meta_path)
    except Exception as e:
        print(f"[worker] ERROR initializing service: {e}")
        svc = None
    WORKER_CTX["svc"] = svc
    WORKER_CTX["pid"] = os.getpid()


def _offline_eval_query(args: Tuple[str, str, int, Optional[int]]) -> Tuple[str, List[Dict[str, Any]], Optional[str]]:
    """
    Worker function to evaluate a single (qid, query, k, rerank_cap) tuple.
    Returns (qid, results_list, error_msg).
    """
    qid, query, k, rerank_cap = args
    svc = WORKER_CTX.get("svc")
    if svc is None:
        return (qid, [], "Service not initialized in worker")
    try:
        results = _offline_query(svc, query, k, rerank_cap)
        return (qid, results, None)
    except Exception as e:
        return (qid, [], str(e))


# --------------- API execution ----------------

def _api_query(base_url: str, query: str, k: int) -> List[Dict[str, Any]]:
    payload = {
        "query": query,
        "k": k,
        "ann_candidates": 50,
        "filters": {"canon_level": "primary"},
        "enable_rerank": True,
        "enable_graph_boost": True,
        "include_entity_context": False,
    }
    url = f"{base_url.rstrip('/')}/retrieve"

    # Use requests if available, else urllib
    try:
        if requests is None:
            import urllib.request
            import urllib.error

            req = urllib.request.Request(url, method="POST")
            req.add_header("Content-Type", "application/json")
            body = json.dumps(payload).encode("utf-8")
            with urllib.request.urlopen(req, body, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        else:
            resp = requests.post(url, json=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        print(f"[api] ERROR calling {url}: {e}")
        return []

    # API response model is RetrieveResponse with 'results' list of RetrievalResult
    results = data.get("results", [])
    # Normalize to the offline-compatible structure: keys include 'section_id','domain','entities','content' etc.
    norm: List[Dict[str, Any]] = []
    for i, r in enumerate(results):
        meta = r.get("metadata", {})
        norm.append({
            "content": r.get("text") or r.get("content", ""),
            "similarity": r.get("rank", 0),  # rank proxy
            "entities": meta.get("entities", []),
            "doc_id": meta.get("doc_id", ""),
            "section_id": meta.get("section_id", ""),
            "title": meta.get("title", ""),
            "domain": meta.get("domain", ""),
            "type": meta.get("type", ""),
            "canon_level": meta.get("canon_level", "primary"),
            "version": meta.get("version", 1),
            "timeline": meta.get("timeline"),
            "updated_at": meta.get("updated_at", ""),
        })
    return norm[:k]


def _api_is_healthy(base_url: str) -> bool:
    url = f"{base_url.rstrip('/')}/health"
    try:
        if requests is None:
            import urllib.request
            with urllib.request.urlopen(url, timeout=5) as resp:
                return resp.status == 200
        else:
            resp = requests.get(url, timeout=5)
            return resp.status_code == 200
    except Exception:
        return False


# --------------- Evaluation runner ----------------

def _compute_safe_defaults() -> Tuple[int, int]:
    """
    Compute safe defaults for workers and threads_per_proc.
    Strategy: workers * threads_per_proc <= logical_cores
    Default: workers=2, threads_per_proc=4 if cores >= 8, else workers=1, threads_per_proc=cores
    """
    try:
        logical_cores = multiprocessing.cpu_count()
    except Exception:
        logical_cores = 4  # fallback
    
    if logical_cores >= 8:
        workers = 2
        threads_per_proc = min(4, logical_cores // workers)
    else:
        workers = 1
        threads_per_proc = logical_cores
    
    return workers, threads_per_proc


def run_evaluation(
    mode: str,
    gold_path: str,
    k: int,
    output_dir: str,
    base_url: str,
    index_path: str,
    vectors_path: str,
    rowmap_path: str,
    meta_path: str,
    thresholds_from: str,
    threshold_overrides: List[str],
    workers: Optional[int] = None,
    threads_per_proc: Optional[int] = None,
    rerank_cap: Optional[int] = None,
) -> int:
    # Compute safe defaults if not specified
    default_workers, default_threads = _compute_safe_defaults()
    if workers is None or workers <= 0:
        workers = default_workers
    if threads_per_proc is None or threads_per_proc <= 0:
        threads_per_proc = default_threads
    
    # Validate configuration
    try:
        logical_cores = multiprocessing.cpu_count()
        total_threads = workers * threads_per_proc
        if total_threads > logical_cores:
            print(f"[config] WARNING: workers({workers}) * threads_per_proc({threads_per_proc}) = {total_threads} exceeds logical cores ({logical_cores})")
            print(f"[config] Consider reducing to avoid oversubscription. Proceeding anyway.")
    except Exception:
        logical_cores = None
    
    print(f"[config] Workers: {workers}, Threads per process: {threads_per_proc}, Rerank cap: {rerank_cap or 'unlimited'}")
    if logical_cores:
        print(f"[config] Logical cores: {logical_cores}, Total threads allocated: {workers * threads_per_proc}")

    gold = _read_gold_queries(gold_path)
    total_queries = len(gold)
    print(f"[eval] Loaded {total_queries} golden queries from {gold_path}")

    # Resolve thresholds
    thresholds = _parse_thresholds_from_xml(thresholds_from) if thresholds_from and os.path.exists(thresholds_from) else _parse_thresholds_from_xml(DEFAULT_EVAL_CONFIG)
    thresholds = _overlay_threshold_overrides(thresholds, threshold_overrides or [])

    results_by_qid: Dict[str, List[Dict[str, Any]]] = {}
    
    # Timing metrics
    eval_start = time.time()
    query_times: List[float] = []

    if mode == "offline":
        if workers == 1:
            # Single-process mode (original behavior)
            print("[offline] Running in single-process mode")
            svc = _offline_init_service(index_path, vectors_path, rowmap_path, meta_path)
            if svc is None:
                print("[offline] FATAL: Service failed to initialize. Cannot proceed.")
                return 2

            for idx, item in enumerate(gold, 1):
                qid = item.get("id") or ""
                query = item.get("query") or ""
                if not qid or not query:
                    continue
                
                q_start = time.time()
                try:
                    results = _offline_query(svc, query, k, rerank_cap)
                except Exception as e:
                    print(f"[offline] ERROR for {qid}: {e}")
                    results = []
                q_time = time.time() - q_start
                query_times.append(q_time)
                results_by_qid[qid] = results
                
                if idx % 10 == 0 or idx == total_queries:
                    print(f"[offline] Progress: {idx}/{total_queries} queries ({idx*100//total_queries}%)")
        else:
            # Multi-process mode
            print(f"[offline] Running in parallel mode with {workers} workers")
            
            # Prepare work items: (qid, query, k, rerank_cap)
            work_items: List[Tuple[str, str, int, Optional[int]]] = []
            for item in gold:
                qid = item.get("id") or ""
                query = item.get("query") or ""
                if qid and query:
                    work_items.append((qid, query, k, rerank_cap))
            
            # Execute in parallel with ProcessPoolExecutor
            completed = 0
            errors = 0
            
            try:
                with ProcessPoolExecutor(
                    max_workers=workers,
                    initializer=_init_worker,
                    initargs=(index_path, vectors_path, rowmap_path, meta_path, threads_per_proc)
                ) as executor:
                    # Submit all tasks
                    future_to_qid = {executor.submit(_offline_eval_query, item): item[0] for item in work_items}
                    
                    # Collect results as they complete
                    for future in as_completed(future_to_qid):
                        qid = future_to_qid[future]
                        try:
                            result_qid, results, error = future.result(timeout=120)
                            if error:
                                print(f"[offline] ERROR for {result_qid}: {error}")
                                errors += 1
                            results_by_qid[result_qid] = results
                            completed += 1
                            
                            if completed % 10 == 0 or completed == len(work_items):
                                print(f"[offline] Progress: {completed}/{len(work_items)} queries ({completed*100//len(work_items)}%)")
                        except Exception as e:
                            print(f"[offline] FATAL error processing {qid}: {e}")
                            errors += 1
                            results_by_qid[qid] = []
                            completed += 1
            
            except Exception as e:
                print(f"[offline] FATAL: ProcessPoolExecutor failed: {e}")
                traceback.print_exc()
                return 2
            
            if errors > 0:
                print(f"[offline] WARNING: {errors} queries failed")

    elif mode == "api":
        print("[api] Running in API mode")
        if not _api_is_healthy(base_url):
            print(f"[api] WARNING: {base_url} /health unavailable. Skipping evaluation.")
            # still emit empty report for consistency
        
        for idx, item in enumerate(gold, 1):
            qid = item.get("id") or ""
            query = item.get("query") or ""
            if not qid or not query:
                continue
            
            q_start = time.time()
            try:
                results = _api_query(base_url, query, k)
            except Exception as e:
                print(f"[api] ERROR for {qid}: {e}")
                results = []
            q_time = time.time() - q_start
            query_times.append(q_time)
            results_by_qid[qid] = results
            
            if idx % 10 == 0 or idx == total_queries:
                print(f"[api] Progress: {idx}/{total_queries} queries ({idx*100//total_queries}%)")
    else:
        print(f"Unknown mode: {mode}")
        return 2
    
    # Compute throughput metrics
    eval_time = time.time() - eval_start
    queries_processed = len(results_by_qid)
    
    # Baseline throughput metrics
    throughput_metrics = {
        "total_wall_time_sec": round(eval_time, 2),
        "queries_processed": queries_processed,
        "queries_per_minute": round(queries_processed / eval_time * 60, 2) if eval_time > 0 else 0,
        "avg_query_time_sec": round(sum(query_times) / len(query_times), 3) if query_times else 0,
        "workers": workers if mode == "offline" else 1,
        "threads_per_proc": threads_per_proc if mode == "offline" else None,
        "rerank_cap": rerank_cap,
    }
    
    print(f"\n📊 Throughput Metrics:")
    print(f"  Total wall time: {throughput_metrics['total_wall_time_sec']}s")
    print(f"  Queries processed: {throughput_metrics['queries_processed']}")
    print(f"  Throughput: {throughput_metrics['queries_per_minute']:.2f} queries/min")
    print(f"  Avg query time: {throughput_metrics['avg_query_time_sec']:.3f}s")
    if mode == "offline" and workers > 1:
        print(f"  Workers: {workers}, Threads/proc: {threads_per_proc}")

    # Ensure deterministic ordering of results by query ID
    sorted_qids = sorted(results_by_qid.keys())
    results_by_qid_ordered = {qid: results_by_qid[qid] for qid in sorted_qids}
    
    metrics = _compute_metrics(gold, results_by_qid_ordered, (1, 3, 5))

    payload = {
        "mode": mode,
        "k": k,
        "gold_path": gold_path,
        "timestamp": int(time.time()),
        "thresholds": thresholds,
        "throughput": throughput_metrics,
        "results": metrics,
    }

    out_json = _write_json_report(output_dir, payload)
    out_md = _write_markdown_report(output_dir, metrics, thresholds)
    print(f"\n✅ Wrote JSON report: {out_json}")
    print(f"✅ Wrote Markdown report: {out_md}")
    print("\n📊 Summary:", json.dumps(metrics.get("summary", {}), indent=2))

    return 0


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Evaluate RAG retrieval accuracy against golden queries with parallel processing support.")
    p.add_argument("--mode", choices=["offline", "api"], required=True, help="Evaluation mode")
    p.add_argument("--k", type=int, default=5, help="Top-K to evaluate (default: 5)")
    p.add_argument("--gold", type=str, default=DEFAULT_GOLD, help="Path to gold_queries.json")
    p.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR, help="Output directory for reports")
    p.add_argument("--base-url", type=str, default=DEFAULT_BASE_URL, help="API base URL for /retrieve")
    p.add_argument("--index", type=str, default=DEFAULT_INDEX, help="Path to FAISS index file for offline mode")
    p.add_argument("--vectors", type=str, default=DEFAULT_VECTORS, help="Path to vectors .npy for offline mode")
    p.add_argument("--rowmap", type=str, default=DEFAULT_ROWMAP, help="Path to rowmap.json for offline mode")
    p.add_argument("--meta", type=str, default=DEFAULT_META, help="Path to meta.jsonl for offline mode")
    p.add_argument("--thresholds-from", type=str, default=DEFAULT_EVAL_CONFIG, help="XML file to parse target thresholds")
    p.add_argument("--threshold-override", action="append", default=[], help="Override thresholds, e.g., recall_at_5=0.78")
    p.add_argument("--workers", type=int, default=None, help="Number of parallel worker processes (default: auto-detect, 1=single-process)")
    p.add_argument("--threads-per-proc", type=int, default=None, help="CPU threads per worker process (default: auto-detect)")
    p.add_argument("--rerank-cap", type=int, default=None, help="Cap rerank candidates per query to bound latency (e.g., 20)")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = _build_arg_parser().parse_args(argv)

    try:
        return run_evaluation(
            mode=args.mode,
            gold_path=args.gold,
            k=args.k,
            output_dir=args.output_dir,
            base_url=args.base_url,
            index_path=args.index,
            vectors_path=args.vectors,
            rowmap_path=args.rowmap,
            meta_path=args.meta,
            thresholds_from=args.thresholds_from,
            threshold_overrides=args.threshold_override,
            workers=args.workers,
            threads_per_proc=args.threads_per_proc,
            rerank_cap=args.rerank_cap,
        )
    except KeyboardInterrupt:
        print("\n❌ Interrupted by user")
        return 130
    except Exception as e:
        print("❌ FATAL ERROR:", e)
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    # Windows spawn guard: required for ProcessPoolExecutor on Windows
    # This prevents subprocess deadlocks by ensuring child processes don't re-execute main
    multiprocessing.freeze_support()
    sys.exit(main())