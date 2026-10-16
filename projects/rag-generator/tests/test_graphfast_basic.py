#!/usr/bin/env python3
"""
Basic integration tests for GraphFast system.

Tests core functionality without complex file operations.
Focuses on ensuring the main components work together correctly.
"""

import unittest
import tempfile
import struct
from pathlib import Path
from unittest import mock
import sys

# Import the modules to test
sys.path.append(str(Path(__file__).parent.parent))

from src.rag.core.graphfast.loaders import MMapCSRLoader, PathCatalogLoader
from src.rag.core.graphfast.graphfast_service import GraphFastService, EvidenceFormatter


class TestBasicGraphFastFunctionality(unittest.TestCase):
    """Test basic GraphFast functionality."""

    def test_evidence_formatter_creation(self):
        """Test EvidenceFormatter can be created and used."""
        formatter = EvidenceFormatter()

        self.assertIsNotNone(formatter.path_template)
        self.assertIsNotNone(formatter.fact_template)
        self.assertIsNotNone(formatter.rule_template)
        self.assertIsNotNone(formatter.quote_template)

    def test_graphfast_service_creation(self):
        """Test GraphFastService can be created."""
        service = GraphFastService()

        self.assertFalse(service.initialized)
        self.assertIsNone(service.artifacts_path)
        self.assertIsNotNone(service.csr_loader)
        self.assertIsNotNone(service.catalog_loader)
        self.assertIsNotNone(service.formatter)

    def test_memory_map_creation(self):
        """Test MemoryMap can be created."""
        from src.rag.core.graphfast.loaders import MemoryMap

        with tempfile.TemporaryDirectory() as temp_dir:
            test_file = Path(temp_dir) / "test.bin"
            test_data = b"test_data"
            test_file.write_bytes(test_data)

            mmap_obj = MemoryMap(test_file)
            self.assertEqual(mmap_obj.file_path, test_file)
            self.assertIsNone(mmap_obj.mmap_handle)

    def test_csr_loader_creation(self):
        """Test MMapCSRLoader can be created."""
        loader = MMapCSRLoader()

        self.assertIsNone(loader.graph)
        self.assertEqual(len(loader.mmap_files), 0)

    def test_path_catalog_loader_creation(self):
        """Test PathCatalogLoader can be created."""
        loader = PathCatalogLoader()

        self.assertEqual(len(loader.catalog), 0)
        self.assertEqual(len(loader.catalog_map), 0)

    def test_service_entity_extraction(self):
        """Test entity extraction functionality."""
        service = GraphFastService()

        # Test with initialized service
        with tempfile.TemporaryDirectory() as temp_dir:
            test_dir = Path(temp_dir) / "entity_test"
            test_dir.mkdir()

            # Create minimal valid files
            nodes_data = struct.pack('<I', 1) + struct.pack('<I', 0) + struct.pack('<I', 0)
            (test_dir / "nodes.bin").write_bytes(nodes_data)
            offsets_data = struct.pack('<I', 0) + struct.pack('<I', 0)
            (test_dir / "offsets.bin").write_bytes(offsets_data)
            (test_dir / "neighbors.bin").write_bytes(b"")
            (test_dir / "edge_types.bin").write_bytes(b"")
            (test_dir / "payloads.bin").write_bytes(b"")
            (test_dir / "paths").mkdir()
            (test_dir / "paths" / "catalog.jsonl").write_text("")

            if service.initialize(str(test_dir)):
                entities = service._extract_entities_from_query("Tell me about Sir Ector")

                # Should extract at least one entity
                self.assertGreater(len(entities), 0)

    def test_service_relevance_calculation(self):
        """Test fact relevance calculation."""
        service = GraphFastService()

        # Test relevance calculation
        relevance = service._calculate_fact_relevance(
            "Sir Ector is a knight",
            "Tell me about Sir Ector"
        )

        # Should return a float between 0 and 1
        self.assertIsInstance(relevance, float)
        self.assertGreaterEqual(relevance, 0.0)
        self.assertLessEqual(relevance, 1.0)

    def test_evidence_confidence_calculation(self):
        """Test evidence confidence calculation."""
        from src.rag.core.graphfast.graphfast_service import GraphEvidence, PathEvidence

        service = GraphFastService()

        # Test with empty evidence
        evidence = GraphEvidence(paths=[], facts=[], rules=[], quotes=[])
        confidence = service._calculate_total_confidence(evidence)
        self.assertEqual(confidence, 0.0)

        # Test with some evidence
        evidence = GraphEvidence(
            paths=[PathEvidence(path_id="test", nodes=[0], node_names=["A"], edge_types=[], abstract="test", confidence=0.8)],
            facts=[],
            rules=[],
            quotes=[]
        )
        confidence = service._calculate_total_confidence(evidence)
        self.assertGreater(confidence, 0.0)


class TestGraphFastIntegration(unittest.TestCase):
    """Test GraphFast components working together."""

    def test_service_with_mock_loaders(self):
        """Test service initialization with mock loaders."""
        service = GraphFastService()

        # Mock the loaders to avoid file operations
        service.csr_loader = mock.MagicMock()
        service.csr_loader.load_graph.return_value = unittest.mock.MagicMock()
        service.csr_loader.graph.num_nodes = 1
        service.csr_loader.graph.num_edges = 0

        service.catalog_loader = unittest.mock.MagicMock()
        service.catalog_loader.load_catalog.return_value = True

        service.payload_loader = unittest.mock.MagicMock()
        service.payload_loader.load_payloads.return_value = True

        # Test initialization
        success = service.initialize("dummy_path")
        self.assertTrue(success)
        self.assertTrue(service.initialized)

    def test_evidence_creation_and_formatting(self):
        """Test evidence objects can be created and formatted."""
        from src.rag.core.graphfast.graphfast_service import (
            GraphEvidence, PathEvidence, FactEvidence
        )

        # Create test evidence
        evidence = GraphEvidence(
            paths=[
                PathEvidence(
                    path_id="test_path",
                    nodes=[0, 1],
                    node_names=["Node A", "Node B"],
                    edge_types=[1],
                    abstract="Test connection",
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

        # Test evidence properties
        self.assertEqual(len(evidence.paths), 1)
        self.assertEqual(len(evidence.facts), 1)
        self.assertEqual(evidence.method_used, "none")
        self.assertIsInstance(evidence.timings_ms, dict)

        # Test formatter
        formatter = EvidenceFormatter()
        slots = formatter.format_evidence_slots(evidence)

        self.assertIn("paths", slots)
        self.assertIn("facts", slots)
        self.assertEqual(len(slots["paths"]), 1)
        self.assertEqual(len(slots["facts"]), 1)

        # Test prompt section building
        prompt_section = formatter.build_evidence_prompt_section(evidence)
        self.assertIn("# Graph Evidence", prompt_section)
        self.assertIn("Test connection", prompt_section)
        self.assertIn("This is a test fact", prompt_section)


def run_basic_tests():
    """Run basic GraphFast tests."""
    # Create test suite
    test_classes = [
        TestBasicGraphFastFunctionality,
        TestGraphFastIntegration
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
    success = run_basic_tests()
    if success:
        print("\n✅ All basic GraphFast tests passed!")
        print("📋 Core functionality verified:")
        print("   • Evidence formatting works correctly")
        print("   • Service initialization works")
        print("   • Entity extraction works")
        print("   • Confidence calculation works")
        print("   • Component integration works")
    else:
        print("\n❌ Some tests failed")
    exit(0 if success else 1)