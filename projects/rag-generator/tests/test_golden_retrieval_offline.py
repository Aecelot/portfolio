import os
import json
import pytest

# Evaluate using the CLI harness programmatically
from tools.evaluate_golden_retrieval import run_evaluation

GOLD_PATH = "backend/data/gold_queries_director.json"
OUTPUT_DIR = "storage/evaluation/offline_pytest"
INDEX_PATH = "storage/store/faiss.index"
VECTORS_PATH = "storage/store/vectors.npy"
ROWMAP_PATH = "storage/store/rowmap.json"
META_PATH = "storage/store/meta.jsonl"
EVAL_CONFIG = "backend/config/evaluation_config.xml"


def _faiss_available() -> bool:
    try:
        import faiss  # type: ignore
        return True
    except Exception:
        return False


def _artifacts_available() -> bool:
    return all(os.path.exists(p) for p in [INDEX_PATH, VECTORS_PATH, ROWMAP_PATH, META_PATH, GOLD_PATH])


@pytest.mark.timeout(120)
def test_golden_retrieval_offline_smoke():
    """
    Smoke test for the golden-queries offline evaluator.

    - Skips if FAISS artifacts or gold file are missing.
    - Runs evaluation in offline mode (no HTTP).
    - Verifies reports are written and contain expected summary keys.
    """
    if not _faiss_available():
        pytest.skip("FAISS not available. Skipping golden retrieval offline test.")
    if not _artifacts_available():
        pytest.skip(
            "Offline evaluation artifacts not found (expected under storage/store/ and backend/data/). "
            "Skipping golden retrieval offline test."
        )

    # Ensure output directory is isolated for this test
    if not os.path.isdir(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    rc = run_evaluation(
        mode="offline",
        gold_path=GOLD_PATH,
        k=5,
        output_dir=OUTPUT_DIR,
        base_url="http://localhost:8000",  # unused in offline
        index_path=INDEX_PATH,
        vectors_path=VECTORS_PATH,
        rowmap_path=ROWMAP_PATH,
        meta_path=META_PATH,
        thresholds_from=EVAL_CONFIG if os.path.exists(EVAL_CONFIG) else "",
        threshold_overrides=[],
    )

    assert rc == 0, "Offline evaluation did not complete successfully"

    results_json = os.path.join(OUTPUT_DIR, "evaluation_results.json")
    report_md = os.path.join(OUTPUT_DIR, "evaluation_report.md")

    assert os.path.exists(results_json), "evaluation_results.json not written"
    assert os.path.exists(report_md), "evaluation_report.md not written"

    with open(results_json, "r", encoding="utf-8") as f:
        payload = json.load(f)

    # Basic structure checks
    assert isinstance(payload, dict)
    assert payload.get("mode") == "offline"
    assert payload.get("k") == 5
    assert payload.get("gold_path") == GOLD_PATH
    assert "results" in payload and isinstance(payload["results"], dict)

    summary = payload["results"].get("summary", {})
    # Summary keys expected from evaluator
    for key in [
        "queries_total",
        "queries_with_gold",
        "queries_no_canon",
        "no_canon_any_results",
        "recall_at_1",
        "recall_at_3",
        "recall_at_5",
        "mrr_at_5",
        "domain_match_rate",
        "entity_hit_rate",
    ]:
        assert key in summary, f"Missing summary key: {key}"

    # Per-query details presence
    per_query = payload["results"].get("per_query", [])
    assert isinstance(per_query, list), "per_query should be a list"

    # Print a condensed summary to help debugging in CI logs
    print("Golden-queries offline summary:", json.dumps(summary, indent=2))