#!/usr/bin/env python3
"""
Automated FAISS KPI monitoring script.

Runs regularly to track FAISS index performance and alert on regressions.
Can be run as a cron job or scheduled task.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

try:
    from index.faiss_evaluator import FAISSEvaluator, run_faiss_kpi_evaluation
    FAISS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Could not import FAISS evaluator: {e}")
    FAISS_AVAILABLE = False


def load_previous_report(report_path: str) -> Optional[Dict]:
    """Load previous KPI report for comparison."""
    try:
        if Path(report_path).exists():
            with open(report_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"⚠️ Could not load previous report: {e}")
    return None


def detect_performance_regression(current_metrics: Dict,
                                previous_metrics: Optional[Dict],
                                thresholds: Dict) -> List[str]:
    """
    Detect performance regressions based on thresholds.

    Args:
        current_metrics: Current KPI measurements
        previous_metrics: Previous KPI measurements for comparison
        thresholds: Regression threshold definitions

    Returns:
        List of regression alerts
    """
    alerts = []

    if not previous_metrics:
        return alerts

    prev_accuracy = previous_metrics.get('accuracy_metrics', {})
    curr_accuracy = current_metrics.get('accuracy_metrics', {})

    # Check accuracy regressions
    accuracy_threshold = thresholds.get('accuracy_regression', -0.05)
    if curr_accuracy.get('overlap_at_10', 0) < prev_accuracy.get('overlap_at_10', 1) + accuracy_threshold:
        alerts.append(f"🚨 Accuracy regression: overlap@10 dropped from {prev_accuracy.get('overlap_at_10', 0):.3f} to {curr_accuracy.get('overlap_at_10', 0):.3f}")

    if curr_accuracy.get('recall_at_5', 0) < prev_accuracy.get('recall_at_5', 1) + accuracy_threshold:
        alerts.append(f"🚨 Recall regression: recall@5 dropped from {prev_accuracy.get('recall_at_5', 0):.3f} to {curr_accuracy.get('recall_at_5', 0):.3f}")

    # Check latency spikes
    latency_threshold = thresholds.get('latency_spike', 2.0)
    curr_latency = curr_accuracy.get('query_latency_ms', 0)
    prev_latency = prev_accuracy.get('query_latency_ms', 0)

    if curr_latency > prev_latency * latency_threshold:
        alerts.append(f"🚨 Latency spike: query time increased from {prev_latency:.1f}ms to {curr_latency:.1f}ms")

    return alerts


def run_monitoring_cycle(index_path: str = "store/faiss.index",
                        report_path: str = "faiss_kpi_report.json",
                        alert_thresholds: Optional[Dict] = None) -> List[str]:
    """
    Run a complete monitoring cycle.

    Returns:
        List of alerts/warnings from the monitoring cycle
    """
    alerts = []

    # Default thresholds
    if alert_thresholds is None:
        alert_thresholds = {
            'accuracy_regression': -0.05,  # 5% drop
            'latency_spike': 2.0,  # 2x increase
            'memory_spike': 1.5  # 50% increase
        }

    print("🔍 Starting FAISS KPI monitoring cycle...")

    try:
        if not FAISS_AVAILABLE:
            alerts.append("⚠️ FAISS not available - monitoring limited")
            return alerts

        # Type ignore because we've already checked FAISS_AVAILABLE above
        run_faiss_kpi_evaluation(index_path, report_path)  # type: ignore[possibly-unbound-variable]

        # Load current report
        try:
            with open(report_path, 'r', encoding='utf-8') as f:
                current_metrics = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            alerts.append(f"❌ Failed to load KPI report: {e}")
            return alerts

        # Load previous report for comparison
        previous_metrics = load_previous_report(report_path)

        # Detect regressions
        regression_alerts = detect_performance_regression(
            current_metrics, previous_metrics, alert_thresholds
        )
        alerts.extend(regression_alerts)

        # Check for critical KPI failures
        accuracy_metrics = current_metrics.get('accuracy_metrics', {})
        if accuracy_metrics.get('overlap_at_10', 0) < 0.80:
            alerts.append("🚨 Critical: overlap@10 below 0.80 threshold")

        if accuracy_metrics.get('query_latency_ms', 0) > 200:
            alerts.append("🚨 Critical: query latency above 200ms threshold")

        if not alerts or all("✅" in alert for alert in alerts):
            alerts.append("✅ All KPIs within acceptable ranges")

        print(f"✅ Monitoring cycle complete: {len(alerts)} alerts generated")
        return alerts

    except Exception as e:
        error_msg = f"❌ Monitoring cycle failed: {e}"
        print(error_msg)
        return [error_msg]


def main():
    """Main entry point for FAISS KPI monitoring."""
    parser = argparse.ArgumentParser(description='Monitor FAISS index KPIs')
    parser.add_argument('--index', default='store/faiss.index',
                       help='Path to FAISS index file')
    parser.add_argument('--report', default='faiss_kpi_report.json',
                       help='Path to save KPI report')
    parser.add_argument('--alert-only', action='store_true',
                       help='Only output alerts, no progress messages')

    args = parser.parse_args()

    if not FAISS_AVAILABLE:
        print("❌ FAISS not available - cannot run monitoring")
        print("💡 To fix this issue:")
        print("   1. Install FAISS: pip install faiss-cpu")
        print("   2. Ensure all required files exist (vectors, metadata)")
        print("   3. Check that the FAISS evaluator module can be imported")
        return 1

    # Run monitoring
    alerts = run_monitoring_cycle(args.index, args.report)

    # Output results
    if args.alert_only:
        for alert in alerts:
            print(alert)
    else:
        print("\n📊 FAISS KPI Monitoring Results:")
        print("=" * 40)
        for alert in alerts:
            print(f"  {alert}")

    # Return appropriate exit code
    critical_alerts = [a for a in alerts if a.startswith("🚨 Critical")]
    return 1 if critical_alerts else 0


if __name__ == "__main__":
    exit(main())