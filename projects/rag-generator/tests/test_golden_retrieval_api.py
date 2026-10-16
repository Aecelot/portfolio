import os
import json
import pytest

from tools.evaluate_golden_retrieval import run_evaluation, _api_is_healthy

GOLD_PATH = "backend/data/gold_queries_director.json"
OUTPUT_DIR = "storage/evaluation/api_pytest"
BASE_URL = os.environ.get("RAG_BASE_URL", "http://localhost:8000")


@pytest.mark.timeout(120)
def test_golden_retrieval_api_smoke():
    """
    Smoke test for the golden-queries API evaluator.

    - Skips if FastAPI /retrieve server is not reachable (BASE_URL/health must return 200).
    - Runs evaluation in API mode and verifies reports are written with expected structure.
    """
    if not os.path.exists(GOLD_PATH):
        pytest.skip("Gold queries file not found. Skipping API evaluator test.")

    if not _api_is_healthy(BASE_URL):
        pytest.skip(f"API health check failed for {BASE_URL}. Skipping golden retrieval API test.")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    rc = run_evaluation(
        mode="api",
        gold_path=GOLD_PATH,
        k=5,
        output_dir=OUTPUT_DIR,
        base_url=BASE_URL,
        index_path="",   # unused in API mode
        vectors_path="", # unused in API mode
        rowmap_path="",  # unused in API mode
        meta_path="",    # unused in API mode
        thresholds_from="backend/config/evaluation_config.xml" if os.path.exists("backend/config/evaluation_config.xml") else "",
        threshold_overrides=[],
    )
    assert rc == 0, "API evaluation did not complete successfully"

    results_json = os.path.join(OUTPUT_DIR, "evaluation_results.json")
    report_md = os.path.join(OUTPUT_DIR, "evaluation_report.md")

    assert os.path.exists(results_json), "evaluation_results.json not written"
    assert os.path.exists(report_md), "evaluation_report.md not written"

    with open(results_json, "r", encoding="utf-8") as f:
        payload = json.load(f)

    assert isinstance(payload, dict)
    assert payload.get("mode") == "api"
    assert payload.get("k") == 5
    assert payload.get("gold_path") == GOLD_PATH
    assert "results" in payload and isinstance(payload["results"], dict)

    summary = payload["results"].get("summary", {})
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

    print("Golden-queries API summary:", json.dumps(summary, indent=2))