#!/usr/bin/env python3
"""
Unit tests for GraphFast service.

Tests the main GraphFast service that coordinates all components
for high-performance graph evidence retrieval.
"""

import json
import tempfile
import shutil
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open

# Import the modules to test
import sys
sys.path.append(str(Path(__file__).parent.parent))

from src.rag.core.graphfast.graphfast_service import (
    GraphFastService, EvidenceFormatter, GraphEvidence,
    PathEvidence, FactEvidence, RuleEvidence, QuoteEvidence
)


class TestEvidenceFormatter(unittest.TestCase):
    """Test the EvidenceFormatter class."""

    def setUp(self):
        """Set up test fixtures."""
        self.formatter = EvidenceFormatter()

    def test_formatter_initialization(self):
        """Test formatter initializes correctly."""
        self.assertIsNotNone(self.formatter.path_template)
        self.assertIsNotNone(self.formatter.fact_template)
        self.assertIsNotNone(self.formatter.rule_template)
        self.assertIsNotNone(self.formatter.quote_template)

    def test_format_evidence_slots_empty(self):
        """Test formatting empty evidence."""
        evidence = GraphEvidence(
            paths=[],
            facts=[],
            rules=[],
            quotes=[]
        )

        slots = self.formatter.format_evidence_slots(evidence)

        self.assertEqual(len(slots['paths']), 0)
        self.assertEqual(len(slots['facts']), 0)
        self.assertEqual(len(slots['rules']), 0)
        self.assertEqual(len(slots['quotes']), 0)

    def test_format_evidence_slots_with_data(self):
        """Test formatting evidence with data."""
        evidence = GraphEvidence(
            paths=[
                PathEvidence(
                    path_id="test_path",
                    nodes=[0, 1],
                    node_names=["Node A", "Node B"],
                    edge_types=[1],
                    abstract="Test path",
                    confidence=0.9
                )
            ],
            facts=[
                FactEvidence(
                    node_id=0,
                    node_name="Node A",
                    fact_text="This is a test fact",
                    relevance_score=0.8
                )
            ],
            rules=[
                RuleEvidence(
                    node_id=1,
                    node_name="Node B",
                    rule_text="Test rule text",
                    rule_type="test_type",
                    applicability=0.7
                )
            ],
            quotes=[
                QuoteEvidence(
                    node_id=2,
                    node_name="Node C",
                    quote_text="Test quote",
                    context="test context",
                    speaker_type="character"
                )
            ]
        )

        slots = self.formatter.format_evidence_slots(evidence)

        self.assertEqual(len(slots['paths']), 1)
        self.assertEqual(len(slots['facts']), 1)
        self.assertEqual(len(slots['rules']), 1)
        self.assertEqual(len(slots['quotes']), 1)

        # Verify formatting
        self.assertIn("Node A", slots['paths'][0])
        self.assertIn("0.90", slots['paths'][0])  # Confidence rounded to 2 decimal places

    def test_build_evidence_prompt_section_empty(self):
        """Test building prompt section with empty evidence."""
        evidence = GraphEvidence(
            paths=[],
            facts=[],
            rules=[],
            quotes=[]
        )

        section = self.formatter.build_evidence_prompt_section(evidence)

        # Should return empty string for no evidence
        self.assertEqual(section, "")

    def test_build_evidence_prompt_section_with_data(self):
        """Test building prompt section with evidence."""
        evidence = GraphEvidence(
            paths=[
                PathEvidence(
                    path_id="test_path",
                    nodes=[0, 1],
                    node_names=["Node A", "Node B"],
                    edge_types=[1],
                    abstract="Test path abstract",
                    confidence=0.9
                )
            ],
            facts=[
                FactEvidence(
                    node_id=0,
                    node_name="Node A",
                    fact_text="This is a test fact",
                    relevance_score=0.8
                )
            ],
            rules=[],
            quotes=[]
        )

        section = self.formatter.build_evidence_prompt_section(evidence)

        # Should contain sections
        self.assertIn("# Graph Evidence", section)
        self.assertIn("## Connection Paths", section)
        self.assertIn("## Relevant Facts", section)
        self.assertIn("Test path abstract", section)
        self.assertIn("This is a test fact", section)


class TestGraphFastService(unittest.TestCase):
    """Test the main GraphFastService class."""

    def setUp(self):
        """Set up test fixtures."""
        self.service = GraphFastService()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        self.service.shutdown()
        shutil.rmtree(self.temp_dir)

    def test_service_initialization(self):
        """Test service initializes correctly."""
        self.assertFalse(self.service.initialized)
        self.assertIsNone(self.service.artifacts_path)
        self.assertIsNotNone(self.service.csr_loader)
        self.assertIsNotNone(self.service.catalog_loader)
        self.assertIsNotNone(self.service.formatter)

    def test_initialize_missing_directory(self):
        """Test initialization with missing directory."""
        success = self.service.initialize("non_existent_directory")

        self.assertFalse(success)
        self.assertFalse(self.service.initialized)

    def test_initialize_valid_directory(self):
        """Test initialization with valid directory."""
        # Create minimal test artifacts
        test_dir = Path(self.temp_dir) / "test_artifacts"

        # Create minimal CSR files
        nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'  # 1 node
        (test_dir / "nodes.bin").write_bytes(nodes_data)

        offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'  # 2 offsets
        (test_dir / "offsets.bin").write_bytes(offsets_data)

        (test_dir / "neighbors.bin").write_bytes(b"")
        (test_dir / "edge_types.bin").write_bytes(b"")
        (test_dir / "payloads.bin").write_bytes(b"")

        # Create catalog
        (test_dir / "paths").mkdir()
        (test_dir / "paths" / "catalog.jsonl").write_text("")

        success = self.service.initialize(str(test_dir))

        self.assertTrue(success)
        self.assertTrue(self.service.initialized)
        self.assertEqual(self.service.artifacts_path, str(test_dir))

    def test_retrieve_not_initialized(self):
        """Test retrieve fails when not initialized."""
        with self.assertRaises(RuntimeError):
            self.service.retrieve("test query")

    def test_extract_entities_from_query(self):
        """Test entity extraction from queries."""
        # Initialize with minimal artifacts first
        test_dir = Path(self.temp_dir) / "test_artifacts"
        test_dir.mkdir()

        # Create minimal valid files
        nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
        (test_dir / "nodes.bin").write_bytes(nodes_data)
        offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'
        (test_dir / "offsets.bin").write_bytes(offsets_data)
        (test_dir / "neighbors.bin").write_bytes(b"")
        (test_dir / "edge_types.bin").write_bytes(b"")
        (test_dir / "payloads.bin").write_bytes(b"")
        (test_dir / "paths").mkdir()
        (test_dir / "paths" / "catalog.jsonl").write_text("")

        self.service.initialize(str(test_dir))

        # Test entity extraction
        entities = self.service._extract_entities_from_query("Tell me about Sir Ector")

        self.assertIn('character_sir_ector', entities)

    def test_find_relevant_nodes(self):
        """Test finding relevant nodes for query."""
        # Set up entity mappings
        self.service.entity_to_node = {
            'character_sir_ector': 0,
            'organization_house_pendragon': 1
        }

        # Test with single entity
        nodes = self.service._find_relevant_nodes(['character_sir_ector'], "")
        self.assertEqual(nodes, [0])

        # Test with multiple entities
        nodes = self.service._find_relevant_nodes(
            ['character_sir_ector', 'organization_house_pendragon'],
            ""
        )
        self.assertEqual(set(nodes), {0, 1})

        # Test with character context
        nodes = self.service._find_relevant_nodes(
            ['character_sir_ector'],
            'organization_house_pendragon'
        )
        self.assertEqual(set(nodes), {0, 1})

    def test_calculate_fact_relevance(self):
        """Test fact relevance calculation."""
        # Test high relevance
        relevance = self.service._calculate_fact_relevance(
            "Sir Ector is a knight",
            "Tell me about Sir Ector"
        )
        self.assertGreater(relevance, 0.5)

        # Test low relevance
        relevance = self.service._calculate_fact_relevance(
            "Random fact",
            "Tell me about Sir Ector"
        )
        self.assertLess(relevance, 0.5)

        # Test no overlap
        relevance = self.service._calculate_fact_relevance(
            "Completely different text",
            "Query with no common words"
        )
        self.assertEqual(relevance, 0.0)

    def test_calculate_total_confidence(self):
        """Test total confidence calculation."""
        # Test with no evidence
        evidence = GraphEvidence(paths=[], facts=[], rules=[], quotes=[])
        confidence = self.service._calculate_total_confidence(evidence)
        self.assertEqual(confidence, 0.0)

        # Test with evidence
        evidence = GraphEvidence(
            paths=[PathEvidence(path_id="test", nodes=[0], node_names=["A"], edge_types=[], abstract="test", confidence=0.8)],
            facts=[FactEvidence(node_id=0, node_name="A", fact_text="test", relevance_score=0.7)],
            rules=[],
            quotes=[]
        )
        confidence = self.service._calculate_total_confidence(evidence)
        self.assertGreater(confidence, 0.0)

    def test_get_node_name(self):
        """Test node name resolution."""
        # Set up node mappings
        self.service.node_to_entity = {0: "Node A", 1: "Node B"}

        # Test known node
        name = self.service._get_node_name(0)
        self.assertEqual(name, "Node A")

        # Test unknown node
        name = self.service._get_node_name(999)
        self.assertEqual(name, "Node_999")

    def test_get_service_info_not_initialized(self):
        """Test service info when not initialized."""
        info = self.service.get_service_info()

        self.assertEqual(info["status"], "not_initialized")

    def test_get_service_info_initialized(self):
        """Test service info when initialized."""
        # Initialize with minimal artifacts
        test_dir = Path(self.temp_dir) / "test_artifacts"
        test_dir.mkdir()

        nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
        (test_dir / "nodes.bin").write_bytes(nodes_data)
        offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'
        (test_dir / "offsets.bin").write_bytes(offsets_data)
        (test_dir / "neighbors.bin").write_bytes(b"")
        (test_dir / "edge_types.bin").write_bytes(b"")
        (test_dir / "payloads.bin").write_bytes(b"")
        (test_dir / "paths").mkdir()
        (test_dir / "paths" / "catalog.jsonl").write_text("")

        self.service.initialize(str(test_dir))

        info = self.service.get_service_info()

        self.assertEqual(info["status"], "initialized")
        self.assertEqual(info["artifacts_path"], str(test_dir))
        self.assertEqual(info["graph_nodes"], 1)
        self.assertEqual(info["graph_edges"], 0)
        self.assertIn("cache_stats", info)
        self.assertIn("memory_usage_mb", info)


class TestDataClasses(unittest.TestCase):
    """Test the dataclasses used in GraphFast."""

    def test_path_evidence_creation(self):
        """Test PathEvidence dataclass."""
        evidence = PathEvidence(
            path_id="test_path",
            nodes=[0, 1, 2],
            node_names=["A", "B", "C"],
            edge_types=[1, 2],
            abstract="Test path",
            confidence=0.85
        )

        self.assertEqual(evidence.path_id, "test_path")
        self.assertEqual(evidence.nodes, [0, 1, 2])
        self.assertEqual(evidence.node_names, ["A", "B", "C"])
        self.assertEqual(evidence.confidence, 0.85)

    def test_fact_evidence_creation(self):
        """Test FactEvidence dataclass."""
        evidence = FactEvidence(
            node_id=0,
            node_name="Test Node",
            fact_text="This is a test fact",
            relevance_score=0.75
        )

        self.assertEqual(evidence.node_id, 0)
        self.assertEqual(evidence.node_name, "Test Node")
        self.assertEqual(evidence.fact_text, "This is a test fact")
        self.assertEqual(evidence.relevance_score, 0.75)

    def test_rule_evidence_creation(self):
        """Test RuleEvidence dataclass."""
        evidence = RuleEvidence(
            node_id=1,
            node_name="Test Node",
            rule_text="Test rule",
            rule_type="test_type",
            applicability=0.9
        )

        self.assertEqual(evidence.node_id, 1)
        self.assertEqual(evidence.rule_text, "Test rule")
        self.assertEqual(evidence.rule_type, "test_type")
        self.assertEqual(evidence.applicability, 0.9)

    def test_quote_evidence_creation(self):
        """Test QuoteEvidence dataclass."""
        evidence = QuoteEvidence(
            node_id=2,
            node_name="Test Speaker",
            quote_text="Test quote",
            context="test context",
            speaker_type="character"
        )

        self.assertEqual(evidence.node_id, 2)
        self.assertEqual(evidence.node_name, "Test Speaker")
        self.assertEqual(evidence.quote_text, "Test quote")
        self.assertEqual(evidence.context, "test context")
        self.assertEqual(evidence.speaker_type, "character")

    def test_graph_evidence_creation(self):
        """Test GraphEvidence dataclass."""
        evidence = GraphEvidence(
            paths=[
                PathEvidence(path_id="test", nodes=[0], node_names=["A"], edge_types=[], abstract="test", confidence=0.8)
            ],
            facts=[
                FactEvidence(node_id=0, node_name="A", fact_text="test fact", relevance_score=0.7)
            ],
            rules=[],
            quotes=[],
            source_shard="test_shard",
            method_used="test_method"
        )

        self.assertEqual(len(evidence.paths), 1)
        self.assertEqual(len(evidence.facts), 1)
        self.assertEqual(evidence.source_shard, "test_shard")
        self.assertEqual(evidence.method_used, "test_method")

        # Test default timings
        self.assertIn("timings_ms", evidence.__dict__)
        self.assertIsInstance(evidence.timings_ms, dict)


class TestServiceIntegration(unittest.TestCase):
    """Test integration between service components."""

    def setUp(self):
        """Set up test fixtures."""
        self.service = GraphFastService()
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        self.service.shutdown()
        shutil.rmtree(self.temp_dir)

    def test_full_service_workflow(self):
        """Test complete service workflow."""
        # Create test artifacts
        test_dir = Path(self.temp_dir) / "workflow_test"

        # Create minimal valid CSR files
        nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'  # 1 node
        (test_dir / "nodes.bin").write_bytes(nodes_data)

        offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'  # 2 offsets
        (test_dir / "offsets.bin").write_bytes(offsets_data)

        (test_dir / "neighbors.bin").write_bytes(b"")
        (test_dir / "edge_types.bin").write_bytes(b"")
        (test_dir / "payloads.bin").write_bytes(b"")

        # Create catalog
        (test_dir / "paths").mkdir()
        catalog_data = [{"path_id": "test_path", "source": 0, "target": 0, "nodes": [0], "abstract": "test"}]
        with open(test_dir / "paths" / "catalog.jsonl", 'w') as f:
            json.dump(catalog_data[0], f)

        # Initialize service
        success = self.service.initialize(str(test_dir))
        self.assertTrue(success)

        # Test retrieval
        evidence = self.service.retrieve("test query", "test_context")

        # Should return valid evidence object even if no paths found
        self.assertIsInstance(evidence, GraphEvidence)
        self.assertIsInstance(evidence.timings_ms, dict)
        self.assertIn("total", evidence.timings_ms)
        self.assertGreater(evidence.timings_ms["total"], 0)

        # Test service info
        info = self.service.get_service_info()
        self.assertEqual(info["status"], "initialized")
        self.assertEqual(info["graph_nodes"], 1)

    def test_error_handling_in_retrieval(self):
        """Test error handling during retrieval."""
        # Initialize with valid artifacts
        test_dir = Path(self.temp_dir) / "error_test"
        nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
        (test_dir / "nodes.bin").write_bytes(nodes_data)
        offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'
        (test_dir / "offsets.bin").write_bytes(offsets_data)
        (test_dir / "neighbors.bin").write_bytes(b"")
        (test_dir / "edge_types.bin").write_bytes(b"")
        (test_dir / "payloads.bin").write_bytes(b"")
        (test_dir / "paths").mkdir()
        (test_dir / "paths" / "catalog.jsonl").write_text("")

        self.service.initialize(str(test_dir))

        # Test with malformed query (should not crash)
        evidence = self.service.retrieve(None)  # None query

        # Should return error evidence
        self.assertIsInstance(evidence, GraphEvidence)
        self.assertEqual(evidence.method_used, "error")


class TestPerformanceTracking(unittest.TestCase):
    """Test performance tracking and metrics."""

    def setUp(self):
        """Set up test fixtures."""
        self.service = GraphFastService()

    def test_performance_tracking_initialization(self):
        """Test performance tracking initializes correctly."""
        self.assertEqual(self.service.cache_hits, 0)
        self.assertEqual(self.service.total_queries, 0)

    def test_query_counting(self):
        """Test query counting works correctly."""
        # Initialize service first
        with tempfile.TemporaryDirectory() as temp_dir:
            test_dir = Path(temp_dir) / "perf_test"

            # Create minimal valid files
            nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
            (test_dir / "nodes.bin").write_bytes(nodes_data)
            offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'
            (test_dir / "offsets.bin").write_bytes(offsets_data)
            (test_dir / "neighbors.bin").write_bytes(b"")
            (test_dir / "edge_types.bin").write_bytes(b"")
            (test_dir / "payloads.bin").write_bytes(b"")
            (test_dir / "paths").mkdir()
            (test_dir / "paths" / "catalog.jsonl").write_text("")

            self.service.initialize(str(test_dir))

            # Make some queries
            initial_count = self.service.total_queries

            self.service.retrieve("test query 1")
            self.service.retrieve("test query 2")

            # Verify count increased
            self.assertEqual(self.service.total_queries, initial_count + 2)

    def test_evidence_timing(self):
        """Test evidence timing is recorded correctly."""
        # Initialize service
        with tempfile.TemporaryDirectory() as temp_dir:
            test_dir = Path(temp_dir) / "timing_test"

            nodes_data = b'\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
            (test_dir / "nodes.bin").write_bytes(nodes_data)
            offsets_data = b'\x00\x00\x00\x00\x00\x00\x00\x00'
            (test_dir / "offsets.bin").write_bytes(offsets_data)
            (test_dir / "neighbors.bin").write_bytes(b"")
            (test_dir / "edge_types.bin").write_bytes(b"")
            (test_dir / "payloads.bin").write_bytes(b"")
            (test_dir / "paths").mkdir()
            (test_dir / "paths" / "catalog.jsonl").write_text("")

            self.service.initialize(str(test_dir))

            # Make query and check timing
            evidence = self.service.retrieve("test query")

            # Verify timing was recorded
            self.assertIn("total", evidence.timings_ms)
            self.assertGreater(evidence.timings_ms["total"], 0)


def run_service_tests():
    """Run all service tests."""
    # Create test suite
    test_classes = [
        TestEvidenceFormatter,
        TestGraphFastService,
        TestDataClasses,
        TestServiceIntegration,
        TestPerformanceTracking
    ]

    suite = unittest.TestSuite()
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        suite.addTests(tests)

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_service_tests()
    exit(0 if success else 1)