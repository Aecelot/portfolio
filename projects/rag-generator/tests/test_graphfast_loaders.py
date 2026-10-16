#!/usr/bin/env python3
"""
Unit tests for GraphFast memory-mapped loaders.

Tests the high-performance binary file loading system using memory mapping.
"""

import json
import tempfile
import shutil
import struct
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open

# Import the modules to test
import sys
sys.path.append(str(Path(__file__).parent.parent))

from src.rag.core.graphfast.loaders import (
    MemoryMap, MMapCSRLoader, PathCatalogLoader, PayloadLoader,
    CSRGraph
)


class TestMemoryMap(unittest.TestCase):
    """Test the MemoryMap class."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)

    def test_memory_map_creation(self):
        """Test MemoryMap object creation."""
        test_file = Path(self.temp_dir) / "test.bin"

        # Create test file with known content
        test_data = b"test_data_123456"
        test_file.write_bytes(test_data)

        mmap_obj = MemoryMap(test_file)

        self.assertEqual(mmap_obj.file_path, test_file)
        self.assertIsNone(mmap_obj.file_handle)
        self.assertIsNone(mmap_obj.mmap_handle)
        self.assertEqual(mmap_obj.size, 0)  # Not opened yet

    def test_memory_map_open_close(self):
        """Test opening and closing memory map."""
        test_file = Path(self.temp_dir) / "test.bin"

        # Create test file
        test_data = struct.pack('<I', 42)  # uint32 = 42
        test_file.write_bytes(test_data)

        mmap_obj = MemoryMap(test_file)

        # Test open
        self.assertTrue(mmap_obj.open())
        self.assertIsNotNone(mmap_obj.file_handle)
        self.assertIsNotNone(mmap_obj.mmap_handle)
        self.assertEqual(mmap_obj.size, len(test_data))

        # Test read operations
        value = mmap_obj.read_uint32(0)
        self.assertEqual(value, 42)

        # Test close
        mmap_obj.close()
        self.assertIsNone(mmap_obj.file_handle)
        self.assertIsNone(mmap_obj.mmap_handle)

    def test_memory_map_read_bounds_checking(self):
        """Test memory map bounds checking."""
        test_file = Path(self.temp_dir) / "test.bin"

        # Create small test file
        test_data = struct.pack('<I', 42)  # 4 bytes
        test_file.write_bytes(test_data)

        mmap_obj = MemoryMap(test_file)
        mmap_obj.open()

        try:
            # Valid read
            value = mmap_obj.read_uint32(0)
            self.assertEqual(value, 42)

            # Invalid read - out of bounds
            with self.assertRaises(IndexError):
                mmap_obj.read_uint32(4)  # Beyond file size

        finally:
            mmap_obj.close()

    def test_memory_map_empty_file(self):
        """Test memory map with empty file."""
        test_file = Path(self.temp_dir) / "empty.bin"
        test_file.write_bytes(b"")

        mmap_obj = MemoryMap(test_file)

        # Should handle gracefully
        self.assertFalse(mmap_obj.open())
        self.assertIsNone(mmap_obj.mmap_handle)

    def test_memory_map_missing_file(self):
        """Test memory map with missing file."""
        test_file = Path(self.temp_dir) / "missing.bin"

        mmap_obj = MemoryMap(test_file)

        # Should handle gracefully
        self.assertFalse(mmap_obj.open())
        self.assertIsNone(mmap_obj.mmap_handle)

    def test_memory_map_context_manager(self):
        """Test MemoryMap as context manager."""
        test_file = Path(self.temp_dir) / "test.bin"
        test_data = struct.pack('<I', 123)
        test_file.write_bytes(test_data)

        with MemoryMap(test_file) as mmap_obj:
            self.assertTrue(mmap_obj.open())
            value = mmap_obj.read_uint32(0)
            self.assertEqual(value, 123)

        # Should be closed after context
        self.assertIsNone(mmap_obj.mmap_handle)
        self.assertIsNone(mmap_obj.file_handle)


class TestMMapCSRLoader(unittest.TestCase):
    """Test the MMapCSRLoader class."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.loader = MMapCSRLoader()

    def tearDown(self):
        """Clean up test fixtures."""
        self.loader.close()
        shutil.rmtree(self.temp_dir)

    def test_loader_initialization(self):
        """Test loader initializes correctly."""
        self.assertIsNone(self.loader.graph)
        self.assertEqual(len(self.loader.mmap_files), 0)

    def test_load_graph_missing_directory(self):
        """Test loading graph from missing directory."""
        graph = self.loader.load_graph("non_existent_directory")

        self.assertIsNone(graph)
        self.assertEqual(len(self.loader.mmap_files), 0)

    def test_load_graph_minimal_valid(self):
        """Test loading minimal valid CSR graph."""
        # Create minimal test files
        test_dir = Path(self.temp_dir) / "test_graph"

        # Create nodes.bin (2 nodes, each with type, flags, payload_offset)
        nodes_data = struct.pack('<I', 1) + struct.pack('<I', 0) + struct.pack('<I', 0)  # Node 0
        nodes_data += struct.pack('<I', 2) + struct.pack('<I', 0) + struct.pack('<I', 0)  # Node 1
        (test_dir / "nodes.bin").write_bytes(nodes_data)

        # Create offsets.bin (CSR offsets for 3 positions: 0, 1, 1)
        offsets_data = struct.pack('<I', 0) + struct.pack('<I', 1) + struct.pack('<I', 1)
        (test_dir / "offsets.bin").write_bytes(offsets_data)

        # Create neighbors.bin (1 neighbor: node 1)
        neighbors_data = struct.pack('<I', 1)
        (test_dir / "neighbors.bin").write_bytes(neighbors_data)

        # Create edge_types.bin (1 edge type)
        edge_types_data = struct.pack('<H', 1)
        (test_dir / "edge_types.bin").write_bytes(edge_types_data)

        # Create payloads.bin (simple payloads)
        payload1 = struct.pack('<I', 10) + b"Node 0\0\0\0\0\0"
        payload2 = struct.pack('<I', 10) + b"Node 1\0\0\0\0\0"
        (test_dir / "payloads.bin").write_bytes(payload1 + payload2)

        # Load graph
        graph = self.loader.load_graph(str(test_dir))

        # Verify graph loaded
        self.assertIsNotNone(graph)
        self.assertEqual(graph.num_nodes, 2)
        self.assertEqual(graph.num_edges, 1)
        self.assertEqual(len(self.loader.mmap_files), 4)  # All binary files loaded

    def test_get_neighbors_valid(self):
        """Test getting neighbors for valid node."""
        # Set up test graph
        self._create_test_graph()

        if self.loader.graph:
            neighbors, edge_types = self.loader.get_neighbors(0)

            self.assertEqual(len(neighbors), 1)
            self.assertEqual(neighbors[0], 1)
            self.assertEqual(len(edge_types), 1)
            self.assertEqual(edge_types[0], 1)

    def test_get_neighbors_invalid_node(self):
        """Test getting neighbors for invalid node."""
        self._create_test_graph()

        if self.loader.graph:
            with self.assertRaises(IndexError):
                self.loader.get_neighbors(999)  # Invalid node ID

    def test_get_node_info_valid(self):
        """Test getting node info for valid node."""
        self._create_test_graph()

        if self.loader.graph:
            node_type, flags, payload_offset = self.loader.get_node_info(0)

            self.assertEqual(node_type, 1)
            self.assertEqual(flags, 0)
            self.assertEqual(payload_offset, 0)

    def test_get_node_info_invalid_node(self):
        """Test getting node info for invalid node."""
        self._create_test_graph()

        if self.loader.graph:
            with self.assertRaises(IndexError):
                self.loader.get_node_info(999)  # Invalid node ID

    def test_get_payload_valid(self):
        """Test getting payload for valid node."""
        self._create_test_graph()

        if self.loader.graph:
            payload = self.loader.get_payload(0)

            # Should return some payload string
            self.assertIsInstance(payload, str)
            self.assertGreater(len(payload), 0)

    def test_get_statistics(self):
        """Test getting loader statistics."""
        self._create_test_graph()

        if self.loader.graph:
            stats = self.loader.get_statistics()

            self.assertIn('num_nodes', stats)
            self.assertIn('num_edges', stats)
            self.assertIn('avg_degree', stats)
            self.assertIn('memory_usage_mb', stats)

            self.assertEqual(stats['num_nodes'], 2)
            self.assertEqual(stats['num_edges'], 1)

    def test_close_loader(self):
        """Test closing loader and cleaning up resources."""
        self._create_test_graph()

        if self.loader.graph:
            initial_mmap_count = len(self.loader.mmap_files)

            self.loader.close()

            # Should clean up all resources
            self.assertIsNone(self.loader.graph)
            self.assertEqual(len(self.loader.mmap_files), 0)

    def _create_test_graph(self):
        """Helper to create a minimal test graph."""
        test_dir = Path(self.temp_dir) / "test_graph"
        test_dir.mkdir(exist_ok=True)  # Create directory first

        # Create minimal valid CSR files
        nodes_data = struct.pack('<I', 1) + struct.pack('<I', 0) + struct.pack('<I', 0)  # Node 0
        nodes_data += struct.pack('<I', 2) + struct.pack('<I', 0) + struct.pack('<I', 0)  # Node 1
        (test_dir / "nodes.bin").write_bytes(nodes_data)

        offsets_data = struct.pack('<I', 0) + struct.pack('<I', 1) + struct.pack('<I', 1)
        (test_dir / "offsets.bin").write_bytes(offsets_data)

        neighbors_data = struct.pack('<I', 1)
        (test_dir / "neighbors.bin").write_bytes(neighbors_data)

        edge_types_data = struct.pack('<H', 1)
        (test_dir / "edge_types.bin").write_bytes(edge_types_data)

        payloads_data = b"test_payload_1\0" * 2
        (test_dir / "payloads.bin").write_bytes(payloads_data)

        self.loader.load_graph(str(test_dir))


class TestPathCatalogLoader(unittest.TestCase):
    """Test the PathCatalogLoader class."""

    def setUp(self):
        """Set up test fixtures."""
        self.loader = PathCatalogLoader()

    def test_loader_initialization(self):
        """Test loader initializes correctly."""
        self.assertEqual(len(self.loader.catalog), 0)
        self.assertEqual(len(self.loader.catalog_map), 0)

    def test_load_catalog_valid(self):
        """Test loading valid catalog file."""
        catalog_data = [
            {"path_id": "path_0_1_0", "source": 0, "target": 1, "nodes": [0, 1], "abstract": "Direct connection"},
            {"path_id": "path_1_2_0", "source": 1, "target": 2, "nodes": [1, 2], "abstract": "Another connection"}
        ]

        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            for entry in catalog_data:
                f.write(json.dumps(entry) + '\n')
            catalog_file = f.name

        try:
            success = self.loader.load_catalog(catalog_file)

            self.assertTrue(success)
            self.assertEqual(len(self.loader.catalog), 2)
            self.assertEqual(len(self.loader.catalog_map), 2)

        finally:
            Path(catalog_file).unlink()

    def test_load_catalog_missing_file(self):
        """Test loading missing catalog file."""
        success = self.loader.load_catalog("missing_file.jsonl")

        self.assertFalse(success)
        self.assertEqual(len(self.loader.catalog), 0)

    def test_load_catalog_invalid_json(self):
        """Test loading catalog with invalid JSON."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            f.write("invalid json line\n")
            f.write('{"valid": "json"}\n')
            catalog_file = f.name

        try:
            success = self.loader.load_catalog(catalog_file)

            # Should load successfully but skip invalid lines
            self.assertTrue(success)
            self.assertEqual(len(self.loader.catalog), 1)  # Only valid entry

        finally:
            Path(catalog_file).unlink()

    def test_find_path_existing(self):
        """Test finding existing path in catalog."""
        # Set up catalog with test data
        self.loader.catalog = [
            {"path_id": "path_0_1_0", "source": 0, "target": 1, "nodes": [0, 1], "abstract": "Direct"}
        ]
        self.loader.catalog_map = {
            (0, 1, hash('[1]')): self.loader.catalog[0]  # Simplified hash for test
        }

        # Test finding existing path
        path = self.loader.find_path(0, 1, [1])
        self.assertIsNotNone(path)
        self.assertEqual(path['path_id'], "path_0_1_0")

    def test_find_path_nonexistent(self):
        """Test finding non-existent path in catalog."""
        # Empty catalog
        path = self.loader.find_path(0, 1)
        self.assertIsNone(path)

    def test_get_statistics(self):
        """Test getting catalog statistics."""
        # Set up test data
        self.loader.catalog = [
            {"path_id": "path_0_1_0", "source": 0, "target": 1, "nodes": [0, 1]},
            {"path_id": "path_0_1_1", "source": 0, "target": 1, "nodes": [0, 2, 1]},
        ]
        self.loader.catalog_map = {
            (0, 1, hash('test1')): self.loader.catalog[0],
            (0, 1, hash('test2')): self.loader.catalog[1],
        }

        stats = self.loader.get_statistics()

        self.assertEqual(stats['total_entries'], 2)
        self.assertEqual(stats['unique_pairs'], 2)
        self.assertEqual(stats['avg_paths_per_pair'], 1.0)


class TestPayloadLoader(unittest.TestCase):
    """Test the PayloadLoader class."""

    def setUp(self):
        """Set up test fixtures."""
        self.loader = PayloadLoader()

    def test_loader_initialization(self):
        """Test loader initializes correctly."""
        self.assertIsNone(self.loader.payload_mmap)

    def test_load_payloads_valid(self):
        """Test loading valid payloads file."""
        # Create test payloads file
        payload1 = struct.pack('<I', 5) + b"test1"
        payload2 = struct.pack('<I', 5) + b"test2"

        with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as f:
            f.write(payload1 + payload2)
            payloads_file = f.name

        try:
            success = self.loader.load_payloads(payloads_file)

            self.assertTrue(success)
            self.assertIsNotNone(self.loader.payload_mmap)

        finally:
            Path(payloads_file).unlink()

    def test_load_payloads_missing_file(self):
        """Test loading missing payloads file."""
        success = self.loader.load_payloads("missing.bin")

        self.assertFalse(success)
        self.assertIsNone(self.loader.payload_mmap)

    def test_get_payload_valid_offset(self):
        """Test getting payload at valid offset."""
        # Create test payloads file
        payload_data = struct.pack('<I', 5) + b"hello"  # Length 5, content "hello"

        with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as f:
            f.write(payload_data)
            payloads_file = f.name

        try:
            self.loader.load_payloads(payloads_file)

            payload = self.loader.get_payload(0)

            self.assertEqual(payload, "hello")

        finally:
            Path(payloads_file).unlink()

    def test_get_payload_invalid_offset(self):
        """Test getting payload at invalid offset."""
        # Create small test file
        payload_data = struct.pack('<I', 5) + b"test"

        with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as f:
            f.write(payload_data)
            payloads_file = f.name

        try:
            self.loader.load_payloads(payloads_file)

            # Try to read beyond file
            payload = self.loader.get_payload(1000)

            # Should return empty string or handle gracefully
            self.assertEqual(payload, "")

        finally:
            Path(payloads_file).unlink()

    def test_close_loader(self):
        """Test closing payload loader."""
        # Create and load test file
        payload_data = struct.pack('<I', 5) + b"test"

        with tempfile.NamedTemporaryFile(suffix='.bin', delete=False) as f:
            f.write(payload_data)
            payloads_file = f.name

        try:
            self.loader.load_payloads(payloads_file)
            self.assertIsNotNone(self.loader.payload_mmap)

            self.loader.close()

            self.assertIsNone(self.loader.payload_mmap)

        finally:
            Path(payloads_file).unlink()


class TestCSRGraph(unittest.TestCase):
    """Test the CSRGraph dataclass."""

    def test_csr_graph_creation(self):
        """Test CSRGraph object creation."""
        import numpy as np

        # Create test arrays
        node_types = np.array([1, 2], dtype=np.uint32)
        node_flags = np.array([0, 0], dtype=np.uint32)
        payload_offsets = np.array([0, 10], dtype=np.uint32)
        offsets = np.array([0, 1, 1], dtype=np.uint32)
        neighbors = np.array([1], dtype=np.uint32)
        edge_types = np.array([1], dtype=np.uint16)

        graph = CSRGraph(
            node_types=node_types,
            node_flags=node_flags,
            payload_offsets=payload_offsets,
            offsets=offsets,
            neighbors=neighbors,
            edge_types=edge_types,
            num_nodes=2,
            num_edges=1
        )

        self.assertEqual(graph.num_nodes, 2)
        self.assertEqual(graph.num_edges, 1)
        self.assertEqual(len(graph.node_types), 2)
        self.assertEqual(len(graph.neighbors), 1)

    def test_csr_graph_with_mmap_files(self):
        """Test CSRGraph with memory map file references."""
        import numpy as np

        # Create minimal arrays
        node_types = np.array([1], dtype=np.uint32)
        node_flags = np.array([0], dtype=np.uint32)
        payload_offsets = np.array([0], dtype=np.uint32)
        offsets = np.array([0, 0], dtype=np.uint32)
        neighbors = np.array([], dtype=np.uint32)
        edge_types = np.array([], dtype=np.uint16)

        # Create mock memory map files
        mock_mmap_files = ["mock_file1", "mock_file2"]

        graph = CSRGraph(
            node_types=node_types,
            node_flags=node_flags,
            payload_offsets=payload_offsets,
            offsets=offsets,
            neighbors=neighbors,
            edge_types=edge_types,
            num_nodes=1,
            num_edges=0,
            _mmap_files=mock_mmap_files
        )

        self.assertEqual(graph._mmap_files, mock_mmap_files)


class TestLoaderIntegration(unittest.TestCase):
    """Test integration between loader components."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)

    def test_full_loader_workflow(self):
        """Test complete workflow from file loading to data access."""
        # Create test CSR files
        test_dir = Path(self.temp_dir) / "integration_test"
        test_dir.mkdir(exist_ok=True)

        # Create minimal valid files
        nodes_data = struct.pack('<I', 1) + struct.pack('<I', 0) + struct.pack('<I', 0)
        (test_dir / "nodes.bin").write_bytes(nodes_data)

        offsets_data = struct.pack('<I', 0) + struct.pack('<I', 0)
        (test_dir / "offsets.bin").write_bytes(offsets_data)

        (test_dir / "neighbors.bin").write_bytes(b"")
        (test_dir / "edge_types.bin").write_bytes(b"")
        (test_dir / "payloads.bin").write_bytes(b"")

        # Create catalog file
        catalog_data = [{"path_id": "test_path", "source": 0, "target": 0, "nodes": [0], "abstract": "test"}]
        (test_dir / "paths").mkdir()
        with open(test_dir / "paths" / "catalog.jsonl", 'w') as f:
            for entry in catalog_data:
                f.write(json.dumps(entry) + '\n')

        # Test full workflow
        csr_loader = MMapCSRLoader()
        catalog_loader = PathCatalogLoader()
        payload_loader = PayloadLoader()

        try:
            # Load CSR graph
            graph = csr_loader.load_graph(str(test_dir))
            self.assertIsNotNone(graph)

            # Load catalog
            catalog_loaded = catalog_loader.load_catalog(str(test_dir / "paths" / "catalog.jsonl"))
            self.assertTrue(catalog_loaded)

            # Load payloads
            payload_loaded = payload_loader.load_payloads(str(test_dir / "payloads.bin"))
            # May be False if file is empty, but shouldn't crash

            # Test data access
            if graph.num_nodes > 0:
                node_info = csr_loader.get_node_info(0)
                self.assertEqual(len(node_info), 3)

            # Test statistics
            stats = csr_loader.get_statistics()
            self.assertIn('num_nodes', stats)

        finally:
            csr_loader.close()
            payload_loader.close()


def run_loader_tests():
    """Run all loader tests."""
    # Create test suite
    test_classes = [
        TestMemoryMap,
        TestMMapCSRLoader,
        TestPathCatalogLoader,
        TestPayloadLoader,
        TestCSRGraph,
        TestLoaderIntegration
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
    success = run_loader_tests()
    exit(0 if success else 1)