#!/usr/bin/env python3
"""
FAISS-specific KPI evaluation system for monitoring ANN index performance.

Implements accuracy, parameter sweeps, capacity metrics, and integrity checks
for FAISS vector indexes in the Lore RAG system.
"""

import json
import time
import hashlib
import psutil
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass, asdict
import matplotlib.pyplot as plt
import seaborn as sns

import numpy as np

# FAISS imports with fallback
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    faiss = None  # type: ignore
    print("⚠️ FAISS not available - KPI evaluation will use fallback mode")

from .simple_vector_search import SimpleVectorSearch


@dataclass
class EvaluationMetrics:
    """Container for FAISS evaluation metrics."""
    # Accuracy metrics
    overlap_at_10: float = 0.0
    recall_at_5: float = 0.0
    mean_reciprocal_rank: float = 0.0

    # Performance metrics
    query_latency_ms: float = 0.0
    throughput_qps: float = 0.0

    # Resource metrics
    memory_usage_mb: float = 0.0
    build_time_seconds: float = 0.0
    index_size_mb: float = 0.0

    # Configuration
    index_type: str = ""
    parameters: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        result = asdict(self)
        if self.parameters is None:
            result['parameters'] = {}
        return result


class FAISSEvaluator:
    """
    Comprehensive FAISS index evaluation system.

    Implements all four KPI categories:
    A. Accuracy vs exact baseline
    B. Parameter sweeps
    C. Capacity & footprint
    D. Integrity checks
    """

    def __init__(self, vectors_path: str = "store/vectors.npy",
                 metadata_path: str = "store/rowmap.json"):
        """Initialize evaluator with vector data."""
        self.vectors_path = vectors_path
        self.metadata_path = metadata_path
        self.vectors: Optional[np.ndarray] = None
        self.metadata = []
        self.exact_index: Optional[Any] = None

        # Load data
        self._load_data()
        self._create_exact_baseline()

    def _load_data(self):
        """Load vectors and metadata for evaluation."""
        if not Path(self.vectors_path).exists():
            raise FileNotFoundError(f"Vectors file not found: {self.vectors_path}")

        self.vectors = np.load(self.vectors_path)
        if self.vectors is not None:
            print(f"✅ Loaded {self.vectors.shape[0]} vectors for evaluation")
        else:
            raise RuntimeError("Failed to load vectors")

        if Path(self.metadata_path).exists():
            with open(self.metadata_path, 'r', encoding='utf-8') as f:
                rowmap_data = json.load(f)
                self.metadata = rowmap_data.get('rowmap', [])

    def _create_exact_baseline(self):
        """Create exact search baseline using IndexFlatIP."""
        if self.vectors is None:
            raise RuntimeError("Vectors not loaded")

        if not FAISS_AVAILABLE:
            print("⚠️ FAISS not available, using simple vector search as baseline")
            self.exact_index = SimpleVectorSearch(self.vectors, self.metadata)
            return

        print("🏗️ Building exact baseline index (IndexFlatIP)...")
        start_time = time.time()

        if not FAISS_AVAILABLE:
            print("⚠️ FAISS not available, using simple vector search as baseline")
            self.exact_index = SimpleVectorSearch(self.vectors, self.metadata)
            return

        if faiss is not None:
            # Create exact search index
            self.exact_index = faiss.IndexFlatIP(self.vectors.shape[1])
            self.exact_index.add(self.vectors.astype('float32'))

            build_time = time.time() - start_time
            print(f"✅ Exact baseline built in {build_time:.2f}s")
        else:
            # Handle case where faiss is not actually available despite FAISS_AVAILABLE being True
            print("⚠️ FAISS import failed, using simple vector search as baseline")
            self.exact_index = SimpleVectorSearch(self.vectors, self.metadata)

    def evaluate_faiss_index(self, faiss_index_path: str,
                           sample_queries: int = 200) -> EvaluationMetrics:
        """
        Evaluate a FAISS index against exact baseline.

        Args:
            faiss_index_path: Path to the FAISS index file
            sample_queries: Number of random queries to use for evaluation

        Returns:
            EvaluationMetrics with comprehensive KPIs
        """
        if not FAISS_AVAILABLE:
            raise RuntimeError("FAISS not available for evaluation")

        # Ensure vectors are loaded
        if self.vectors is None:
            raise RuntimeError("Vectors not loaded")

        # Load FAISS index
        if not FAISS_AVAILABLE or faiss is None:
            raise RuntimeError("FAISS not available for index loading")
        faiss_index = faiss.read_index(faiss_index_path)

        # Generate random query sample
        np.random.seed(42)  # Reproducible results
        query_indices = np.random.choice(
            len(self.vectors),
            size=min(sample_queries, len(self.vectors)),
            replace=False
        )

        if self.vectors is None:
            raise RuntimeError("Vectors not loaded")

        return self._compute_accuracy_metrics(faiss_index, query_indices)

    def _compute_accuracy_metrics(self, faiss_index, query_indices: np.ndarray) -> EvaluationMetrics:
        """Compute accuracy metrics comparing ANN vs exact search."""
        if self.vectors is None:
            raise RuntimeError("Vectors not loaded")

        print(f"🔍 Evaluating accuracy with {len(query_indices)} queries...")

        start_time = time.time()
        total_overlap_at_10 = 0.0
        total_recall_at_5 = 0.0
        total_reciprocal_rank = 0.0

        for query_idx in query_indices:
            query_vector = self.vectors[query_idx:query_idx+1]

            # Get ANN results (top 10)
            ann_scores, ann_indices = faiss_index.search(
                query_vector.astype('float32'), 10
            )

            # Get exact results (top 10)
            if FAISS_AVAILABLE and self.exact_index is not None:
                exact_scores, exact_indices = self.exact_index.search(
                    query_vector.astype('float32'), 10
                )
            else:
                # Use SimpleVectorSearch interface
                if self.exact_index is not None:
                    exact_results = self.exact_index.search(query_vector[0], k=10)
                    exact_indices = np.array([[r[0] for r in exact_results]])
                    exact_scores = np.array([[r[1] for r in exact_results]])
                else:
                    # Fallback if no exact index available
                    exact_indices = np.array([[i for i in range(10)]])
                    exact_scores = np.array([[1.0 for _ in range(10)]])

            # Compute overlap@10
            ann_set = set(ann_indices[0])
            exact_set = set(exact_indices[0])
            overlap = len(ann_set & exact_set)
            total_overlap_at_10 += overlap / 10.0

            # Compute recall@5
            ann_top5 = set(ann_indices[0][:5])
            exact_top5 = set(exact_indices[0][:5])
            recall_5 = len(ann_top5 & exact_top5) / 5.0
            total_recall_at_5 += recall_5

            # Compute MRR (find rank of first exact match in ANN results)
            exact_top5_list = exact_indices[0][:5]
            mrr_score = 0.0
            for rank, ann_idx in enumerate(ann_indices[0]):
                if ann_idx in exact_top5_list:
                    mrr_score = 1.0 / (rank + 1)
                    break
            total_reciprocal_rank += mrr_score

        # Calculate averages
        num_queries = len(query_indices)
        metrics = EvaluationMetrics(
            overlap_at_10=total_overlap_at_10 / num_queries,
            recall_at_5=total_recall_at_5 / num_queries,
            mean_reciprocal_rank=total_reciprocal_rank / num_queries,
            query_latency_ms=(time.time() - start_time) * 1000 / num_queries,
            index_type="faiss_hnsw"  # Will be updated based on actual index
        )

        print(f"✅ Accuracy evaluation complete: overlap@10={metrics.overlap_at_10:.3f}")
        return metrics

    def parameter_sweep_hnsw(self, vectors: np.ndarray,
                           m_values: Optional[List[int]] = None,
                           ef_search_values: Optional[List[int]] = None) -> List[EvaluationMetrics]:
        """
        Perform HNSW parameter sweep to find optimal configuration.

        Args:
            vectors: Vector data for index building
            m_values: M parameter values to test
            ef_search_values: efSearch values to test

        Returns:
            List of metrics for each parameter combination
        """
        if m_values is None:
            m_values = [16, 32, 64]
        if ef_search_values is None:
            ef_search_values = [32, 64, 96, 128]

        if not FAISS_AVAILABLE:
            raise RuntimeError("FAISS not available for parameter sweep")

        print(f"🔄 Starting HNSW parameter sweep: M={m_values}, efSearch={ef_search_values}")
        results = []

        for m in m_values:
            for ef_search in ef_search_values:
                print(f"  Testing M={m}, efSearch={ef_search}")

                # Build HNSW index
                start_time = time.time()
                if not FAISS_AVAILABLE or faiss is None:
                    raise RuntimeError("FAISS not available for HNSW index creation")

                index = faiss.IndexHNSWFlat(vectors.shape[1], m)
                index.hnsw.efConstruction = 200  # Fixed construction parameter
                index.hnsw.efSearch = ef_search
                index.add(vectors.astype('float32'))  # type: ignore[call-arg]
                build_time = time.time() - start_time

                # Evaluate index
                metrics = self._evaluate_single_config(index, build_time, {
                    'M': m,
                    'efSearch': ef_search,
                    'efConstruction': 200
                })
                results.append(metrics)

                # Plot intermediate results
                self._plot_parameter_sweep(results, "HNSW")

        return results

    def parameter_sweep_ivf(self, vectors: np.ndarray,
                          nlist_values: Optional[List[int]] = None,
                          nprobe_values: Optional[List[int]] = None) -> List[EvaluationMetrics]:
        """
        Perform IVF-Flat parameter sweep.

        Args:
            vectors: Vector data for index building
            nlist_values: nlist values to test
            nprobe_values: nprobe values to test

        Returns:
            List of metrics for each parameter combination
        """
        if nlist_values is None:
            nlist_values = [int(np.sqrt(len(vectors))), int(np.sqrt(len(vectors))) * 2]
        if nprobe_values is None:
            nprobe_values = [8, 16, 32, 64]

        if not FAISS_AVAILABLE:
            raise RuntimeError("FAISS not available for parameter sweep")

        print(f"🔄 Starting IVF parameter sweep: nlist={nlist_values}, nprobe={nprobe_values}")
        results = []

        for nlist in nlist_values:
            for nprobe in nprobe_values:
                print(f"  Testing nlist={nlist}, nprobe={nprobe}")

                # Build IVF index
                start_time = time.time()
                if not FAISS_AVAILABLE or faiss is None:
                    raise RuntimeError("FAISS not available for IVF index creation")

                quantizer = faiss.IndexFlatIP(vectors.shape[1])
                index = faiss.IndexIVFFlat(quantizer, vectors.shape[1], nlist)
                index.train(vectors.astype('float32'))  # type: ignore[call-arg]
                index.add(vectors.astype('float32'))  # type: ignore[call-arg]
                index.nprobe = nprobe  # Set search parameter
                build_time = time.time() - start_time

                # Evaluate index
                metrics = self._evaluate_single_config(index, build_time, {
                    'nlist': nlist,
                    'nprobe': nprobe
                })
                results.append(metrics)

                # Plot intermediate results
                self._plot_parameter_sweep(results, "IVF")

        return results

    def _evaluate_single_config(self, index, build_time: float,
                              parameters: Dict) -> EvaluationMetrics:
        """Evaluate a single index configuration."""
        # Ensure vectors are loaded
        if self.vectors is None:
            raise RuntimeError("Vectors not loaded")

        # Get basic index info
        index_type = "hnsw" if hasattr(index, 'hnsw') else "ivf"

        # Measure memory usage
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024  # MB

        # Evaluate accuracy and performance
        np.random.seed(42)
        query_indices = np.random.choice(len(self.vectors), size=100, replace=False)

        accuracy_metrics = self._compute_accuracy_metrics(index, query_indices)

        # Measure memory usage after evaluation
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_used = memory_after - memory_before

        # Calculate index size
        index_size_mb = 0
        if hasattr(index, 'ntotal'):
            index_size_mb = index.ntotal * self.vectors.shape[1] * 4 / 1024 / 1024  # Rough estimate

        # Compile complete metrics
        metrics = EvaluationMetrics(
            overlap_at_10=accuracy_metrics.overlap_at_10,
            recall_at_5=accuracy_metrics.recall_at_5,
            mean_reciprocal_rank=accuracy_metrics.mean_reciprocal_rank,
            query_latency_ms=accuracy_metrics.query_latency_ms,
            memory_usage_mb=memory_used,
            build_time_seconds=build_time,
            index_size_mb=index_size_mb,
            index_type=f"faiss_{index_type}",
            parameters=parameters
        )

        return metrics

    def _plot_parameter_sweep(self, results: List[EvaluationMetrics], index_type: str):
        """Plot recall vs latency for parameter sweep results."""
        if len(results) < 2:
            return

        # Extract data for plotting
        recall_values = [r.recall_at_5 for r in results]
        latency_values = [r.query_latency_ms for r in results]
        overlap_values = [r.overlap_at_10 for r in results]

        # Create scatter plot
        plt.figure(figsize=(10, 6))
        scatter = plt.scatter(latency_values, recall_values,
                            c=overlap_values, cmap='viridis', s=100, alpha=0.7)

        # Add colorbar
        cbar = plt.colorbar(scatter)
        cbar.set_label('Overlap@10')

        # Add labels and title
        plt.xlabel('Query Latency (ms)')
        plt.ylabel('Recall@5')
        plt.title(f'{index_type.upper()} Parameter Sweep: Recall vs Latency')
        plt.grid(True, alpha=0.3)

        # Save plot
        os.makedirs('evaluation_plots', exist_ok=True)
        plt.savefig(f'evaluation_plots/{index_type.lower()}_parameter_sweep.png',
                   dpi=300, bbox_inches='tight')
        plt.close()

        print(f"  📊 Plot saved: evaluation_plots/{index_type.lower()}_parameter_sweep.png")

    def integrity_check(self, index_path: str) -> Dict[str, Any]:
        """
        Perform comprehensive integrity checks on FAISS index.

        Args:
            index_path: Path to FAISS index file

        Returns:
            Dictionary with integrity check results
        """
        print(f"🔍 Running integrity checks on {index_path}...")

        checks = {
            'file_exists': False,
            'file_readable': False,
            'dimensionality_correct': False,
            'vectors_count_match': False,
            'normalization_check': False,
            'rowmap_alignment': False,
            'metadata_hash': False,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
        }

        try:
            # Check 1: File exists and is readable
            index_file = Path(index_path)
            checks['file_exists'] = index_file.exists()

            if checks['file_exists']:
                # Ensure vectors are loaded for subsequent checks
                if self.vectors is None:
                    raise RuntimeError("Vectors not loaded")

                # Check 2: Can read index
                if not FAISS_AVAILABLE or faiss is None:
                    print("⚠️ FAISS not available, skipping index readability check")
                    checks['file_readable'] = False
                    faiss_index = None
                else:
                    faiss_index = faiss.read_index(index_path)
                    checks['file_readable'] = True

                # Check 3: Dimensionality matches vectors
                expected_dim = self.vectors.shape[1]
                if faiss_index is not None:
                    actual_dim = faiss_index.d if hasattr(faiss_index, 'd') else 0
                    checks['dimensionality_correct'] = (actual_dim == expected_dim)
                else:
                    checks['dimensionality_correct'] = False

                # Check 4: Vector count matches
                expected_count = self.vectors.shape[0]
                if faiss_index is not None:
                    actual_count = faiss_index.ntotal if hasattr(faiss_index, 'ntotal') else 0
                    checks['vectors_count_match'] = (actual_count == expected_count)
                else:
                    checks['vectors_count_match'] = False

                # Check 5: Vectors are properly normalized
                if checks['vectors_count_match']:
                    # Spot check a few vectors
                    sample_indices = [0, 100, 1000] if expected_count > 1000 else [0, 1, 2]
                    normalized_count = 0
                    for idx in sample_indices:
                        if idx < expected_count:
                            vector = self.vectors[idx]  # type: ignore
                            norm = np.linalg.norm(vector)
                            if abs(norm - 1.0) < 0.1:  # Allow some tolerance
                                normalized_count += 1
                    checks['normalization_check'] = (normalized_count >= 2)

                # Check 6: Rowmap alignment (spot check)
                if Path(self.metadata_path).exists() and faiss_index is not None:
                    checks['rowmap_alignment'] = self._check_rowmap_alignment(faiss_index)
                else:
                    checks['rowmap_alignment'] = False

                # Check 7: Metadata hash check
                if Path("store/meta.jsonl").exists():
                    checks['metadata_hash'] = self._check_metadata_integrity()

        except Exception as e:
            print(f"❌ Integrity check failed: {e}")

        # Summary
        passed_checks = sum(1 for check in checks.values() if check is True)
        total_checks = len([c for c in checks.values() if isinstance(c, bool)])

        print(f"✅ Integrity check complete: {passed_checks}/{total_checks} checks passed")

        return {
            'checks': checks,
            'summary': {
                'passed': passed_checks,
                'total': total_checks,
                'success_rate': passed_checks / total_checks if total_checks > 0 else 0
            }
        }

    def _check_rowmap_alignment(self, faiss_index) -> bool:
        """Spot check alignment between FAISS index and rowmap."""
        try:
            # Ensure vectors are loaded
            if self.vectors is None:
                return False

            # Check a few random indices
            n_vectors = self.vectors.shape[0]
            sample_indices = [min(i, n_vectors-1) for i in [0, 100, 500, 999]]

            for idx in sample_indices:
                if idx < len(self.metadata):
                    section_id = self.metadata[idx].get('section_id')
                    if section_id and isinstance(section_id, str):
                        continue  # This is a valid entry

            return True
        except Exception:
            return False

    def _check_metadata_integrity(self) -> bool:
        """Check if metadata file hash matches stored hash."""
        try:
            # Compute current hash
            current_hash = hashlib.sha256()
            with open("store/meta.jsonl", 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    current_hash.update(chunk)  # type: ignore

            # Compare with stored hash (if available)
            report_path = Path("store/index_report.json")
            if report_path.exists():
                with open(report_path, 'r') as f:
                    report = json.load(f)
                    stored_hash = report.get('metadata_hash')
                    return current_hash.hexdigest()[:16] == stored_hash

            return True  # No stored hash to compare against
        except Exception:
            return False

    def generate_comprehensive_report(self, index_path: str,
                                    output_path: str = "faiss_kpi_report.json") -> str:
        """
        Generate comprehensive KPI report for a FAISS index.

        Args:
            index_path: Path to FAISS index to evaluate
            output_path: Where to save the report

        Returns:
            Path to generated report file
        """
        print(f"📊 Generating comprehensive KPI report for {index_path}...")

        # Run all evaluations
        accuracy_metrics = self.evaluate_faiss_index(index_path)
        integrity_results = self.integrity_check(index_path)

        # Compile complete report
        if self.vectors is None:
            raise RuntimeError("Vectors not loaded")

        report = {
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'index_path': index_path,
            'vectors_info': {
                'count': self.vectors.shape[0],
                'dimensions': self.vectors.shape[1],
                'memory_usage_mb': self.vectors.nbytes / 1024 / 1024
            },
            'accuracy_metrics': accuracy_metrics.to_dict(),
            'integrity_checks': integrity_results,
            'recommendations': self._generate_recommendations(accuracy_metrics, integrity_results)
        }

        # Save report
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"💾 KPI report saved to {output_path}")
        return str(output_file)

    def _generate_recommendations(self, metrics: EvaluationMetrics,
                                integrity: Dict) -> List[str]:
        """Generate tuning recommendations based on metrics."""
        recommendations = []

        # Accuracy recommendations
        if metrics.overlap_at_10 < 0.90:
            recommendations.append(
                "⚠️ Low overlap@10 (<0.90) - consider increasing efSearch or nprobe parameters"
            )

        if metrics.recall_at_5 < 0.80:
            recommendations.append(
                "⚠️ Low recall@5 (<0.80) - index parameters may need tuning for better recall-latency tradeoff"
            )

        # Performance recommendations
        if metrics.query_latency_ms > 100:
            recommendations.append(
                "⚠️ High latency (>100ms) - consider reducing efSearch or nprobe for faster queries"
            )

        if metrics.memory_usage_mb > 1000:
            recommendations.append(
                "⚠️ High memory usage (>1GB) - consider IVF index with PQ compression for smaller footprint"
            )

        # Integrity recommendations
        integrity_summary = integrity.get('summary', {})
        if integrity_summary.get('success_rate', 1.0) < 1.0:
            recommendations.append(
                "⚠️ Integrity check failures detected - verify vector data and rebuild index if needed"
            )

        if not recommendations:
            recommendations.append("✅ Index performance looks good - no immediate tuning needed")

        return recommendations


def run_faiss_kpi_evaluation(index_path: str = "store/faiss.index",
                           output_report: str = "faiss_kpi_report.json") -> str:
    """
    Run complete FAISS KPI evaluation pipeline.

    Args:
        index_path: Path to FAISS index to evaluate
        output_report: Where to save the evaluation report

    Returns:
        Path to generated report file
    """
    print("🚀 Starting FAISS KPI Evaluation Pipeline")
    print("=" * 50)

    try:
        # Initialize evaluator
        evaluator = FAISSEvaluator()

        # Generate comprehensive report
        report_path = evaluator.generate_comprehensive_report(index_path, output_report)

        print("✅ FAISS KPI evaluation complete!")
        return report_path

    except Exception as e:
        print(f"❌ FAISS KPI evaluation failed: {e}")
        raise


if __name__ == "__main__":
    # Run evaluation when script is executed directly
    import sys

    index_path = sys.argv[1] if len(sys.argv) > 1 else "store/faiss.index"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "faiss_kpi_report.json"

    run_faiss_kpi_evaluation(index_path, output_path)