#!/usr/bin/env python3
"""
Unit tests for GraphFast export tools.

Tests the offline artifact generation system that converts entities
and metadata into binary graph artifacts.
"""

import json
import tempfile
import shutil
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock

# Import the modules to test
import sys
sys.path.append(str(Path(__file__).parent.parent))

from tools.build_graph.graph_artifacts import (
    GraphArtifactBuilder, CSRExporter, PathCatalogBuilder,
    GraphNode, GraphEdge, CSRFiles
)


class TestCSRExporter(unittest.TestCase):
    """Test the CSR exporter functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.exporter = CSRExporter()

    def test_initialization(self):
        """Test CSR exporter initializes correctly."""
        self.assertEqual(len(self.exporter.nodes), 0)
        self.assertEqual(len(self.exporter.edges), 0)
        self.assertEqual(len(self.exporter.node_id_map), 0)

    def test_load_entities_xml_valid(self):
        """Test loading valid entities XML."""
        # Create temporary XML file
        xml_content = """<?xml version="1.0" encoding="UTF-8"?>
<entities>
  <entity id="character_sir_ector" name="Sir Ector" type="character">
    <aliases>ector, ector</aliases>
  </entity>
  <entity id="organization_house_pendragon" name="House Pendragon" type="organization">
    <aliases>pendragon</aliases>
  </entity>
</entities>"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as f:
            f.write(xml_content)
            xml_file = f.name

        try:
            self.exporter.load_entities_xml(xml_file)

            # Verify entities loaded
            self.assertEqual(len(self.exporter.nodes), 2)
            self.assertIn('character_sir_ector', self.exporter.node_id_map)
            self.assertIn('organization_house_pendragon', self.exporter.node_id_map)

            # Verify node data
            thorne_node = next(node for node in self.exporter.nodes
                             if node.entity_id == 'character_sir_ector')
            self.assertEqual(thorne_node.name, 'Sir Ector')
            self.assertEqual(thorne_node.entity_type, 'character')

        finally:
            Path(xml_file).unlink()

    def test_load_entities_xml_missing_file(self):
        """Test loading entities from non-existent file."""
        self.exporter.load_entities_xml("non_existent_file.xml")

        # Should not crash and should have no nodes
        self.assertEqual(len(self.exporter.nodes), 0)

    def test_load_entities_xml_invalid_xml(self):
        """Test loading invalid XML."""
        xml_content = "<?xml version='1.0'?><entities><entity></entity>"  # Missing required attributes

        with tempfile.NamedTemporaryFile(mode='w', suffix='.xml', delete=False) as f:
            f.write(xml_content)
            xml_file = f.name

        try:
            # Should not crash and should handle gracefully
            self.exporter.load_entities_xml(xml_file)
            # May load 0 nodes or handle error gracefully
        finally:
            Path(xml_file).unlink()

    def test_add_relationships_from_metadata_valid(self):
        """Test adding relationships from valid metadata."""
        # First add some nodes
        node1 = GraphNode(0, 'character_sir_ector', 'character', 'Sir Ector')
        node2 = GraphNode(1, 'organization_house_pendragon', 'organization', 'House Pendragon')

        self.exporter.nodes = [node1, node2]
        self.exporter.node_id_map = {
            'character_sir_ector': 0,
            'organization_house_pendragon': 1
        }
        self.exporter.reverse_node_map = {0: 'character_sir_ector', 1: 'organization_house_pendragon'}

        # Create metadata with entities
        metadata_content = """{"entities": [{"entity_id": "character_sir_ector"}, {"entity_id": "organization_house_pendragon"}], "content": "test"}
{"entities": [{"entity_id": "character_sir_ector"}], "content": "test2"}"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False) as f:
            f.write(metadata_content)
            metadata_file = f.name

        try:
            self.exporter.add_relationships_from_metadata(metadata_file)

            # Should create edges between co-occurring entities
            self.assertGreater(len(self.exporter.edges), 0)

        finally:
            Path(metadata_file).unlink()

    def test_add_relationships_missing_file(self):
        """Test adding relationships from missing file."""
        self.exporter.add_relationships_from_metadata("missing_file.jsonl")

        # Should not crash
        self.assertEqual(len(self.exporter.edges), 0)

    def test_export_csr_basic(self):
        """Test basic CSR export functionality."""
        # Set up minimal test data
        node1 = GraphNode(0, 'character_sir_ector', 'character', 'Sir Ector')
        node2 = GraphNode(1, 'organization_house_pendragon', 'organization', 'House Pendragon')
        edge = GraphEdge(0, 1, 1, 1.0)

        self.exporter.nodes = [node1, node2]
        self.exporter.edges = [edge]

        with tempfile.TemporaryDirectory() as temp_dir:
            csr_files = self.exporter.export_csr(temp_dir)

            # Verify files were created
            self.assertTrue(Path(csr_files.nodes_file).exists())
            self.assertTrue(Path(csr_files.offsets_file).exists())
            self.assertTrue(Path(csr_files.neighbors_file).exists())
            self.assertTrue(Path(csr_files.edge_types_file).exists())
            self.assertTrue(Path(csr_files.payloads_file).exists())

            # Verify file sizes are reasonable
            self.assertGreater(Path(csr_files.nodes_file).stat().st_size, 0)
            self.assertGreater(Path(csr_files.offsets_file).stat().st_size, 0)


class TestPathCatalogBuilder(unittest.TestCase):
    """Test the path catalog builder functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.exporter = CSRExporter()
        self.catalog_builder = PathCatalogBuilder(self.exporter)

    def test_initialization(self):
        """Test catalog builder initializes correctly."""
        self.assertEqual(len(self.catalog_builder.catalog), 0)

    def test_identify_hot_pairs(self):
        """Test identification of hot entity pairs."""
        # Add test edges
        self.exporter.edges = [
            GraphEdge(0, 1, 1, 1.0),
            GraphEdge(0, 1, 1, 1.0),  # Duplicate for higher count
            GraphEdge(1, 2, 1, 1.0),
        ]

        hot_pairs = self.catalog_builder._identify_hot_pairs()

        # Should identify (0,1) as hottest pair
        self.assertIn((0, 1), hot_pairs)
        self.assertIn((1, 2), hot_pairs)

    def test_generate_abstract(self):
        """Test abstract generation for paths."""
        # Set up nodes
        self.exporter.nodes = [
            GraphNode(0, 'character_sir_ector', 'character', 'Sir Ector'),
            GraphNode(1, 'organization_house_pendragon', 'organization', 'House Pendragon'),
        ]
        self.exporter.reverse_node_map = {
            0: 'character_sir_ector',
            1: 'organization_house_pendragon'
        }

        path = [0, 1]
        abstract = self.catalog_builder._generate_abstract(path)

        self.assertIn('Sir Ector', abstract)
        self.assertIn('House Pendragon', abstract)
        self.assertIn('Connection path:', abstract)

    def test_build_catalog_basic(self):
        """Test basic catalog building."""
        # Set up minimal data
        self.exporter.nodes = [
            GraphNode(0, 'character_sir_ector', 'character', 'Sir Ector'),
            GraphNode(1, 'organization_house_pendragon', 'organization', 'House Pendragon'),
        ]
        self.exporter.edges = [GraphEdge(0, 1, 1, 1.0)]

        self.catalog_builder.build_catalog()

        # Should create at least one catalog entry
        self.assertGreater(len(self.catalog_builder.catalog), 0)

        # Verify entry structure
        entry = self.catalog_builder.catalog[0]
        self.assertTrue(hasattr(entry, 'path_id'))
        self.assertTrue(hasattr(entry, 'source'))
        self.assertTrue(hasattr(entry, 'target'))
        self.assertTrue(hasattr(entry, 'nodes'))
        self.assertTrue(hasattr(entry, 'abstract'))

        # Check actual values
        self.assertIsNotNone(entry.path_id)
        self.assertIsNotNone(entry.source)
        self.assertIsNotNone(entry.target)


class TestGraphArtifactBuilder(unittest.TestCase):
    """Test the main artifact builder."""

    def setUp(self):
        """Set up test fixtures."""
        # Create temporary files for testing
        self.temp_dir = tempfile.mkdtemp()

        # Create test entities XML
        self.entities_xml = Path(self.temp_dir) / "entities.xml"
        self.entities_xml.write_text("""<?xml version="1.0" encoding="UTF-8"?>
<entities>
  <entity id="character_sir_ector" name="Sir Ector" type="character">
    <aliases>ector</aliases>
  </entity>
  <entity id="organization_house_pendragon" name="House Pendragon" type="organization">
    <aliases>pendragon</aliases>
  </entity>
</entities>""")

        # Create test metadata
        self.metadata_file = Path(self.temp_dir) / "meta.jsonl"
        self.metadata_file.write_text("""{"entities": [{"entity_id": "character_sir_ector"}], "content": "test"}
{"entities": [{"entity_id": "character_sir_ector"}, {"entity_id": "organization_house_pendragon"}], "content": "test2"}""")

    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir)

    def test_build_all_artifacts(self):
        """Test complete artifact building process."""
        builder = GraphArtifactBuilder(
            entities_file=str(self.entities_xml),
            metadata_file=str(self.metadata_file)
        )

        output_dir = Path(self.temp_dir) / "output"

        report = builder.build_all_artifacts(str(output_dir))

        # Verify report structure
        self.assertIn('build_time', report)
        self.assertIn('output_directory', report)
        self.assertIn('nodes_count', report)
        self.assertIn('edges_count', report)
        self.assertIn('path_entries', report)
        self.assertIn('csr_files', report)

        # Verify files were created
        self.assertTrue((output_dir / "nodes.bin").exists())
        self.assertTrue((output_dir / "offsets.bin").exists())
        self.assertTrue((output_dir / "neighbors.bin").exists())
        self.assertTrue((output_dir / "edge_types.bin").exists())
        self.assertTrue((output_dir / "payloads.bin").exists())
        self.assertTrue((output_dir / "paths" / "catalog.jsonl").exists())
        self.assertTrue((output_dir / "build_report.json").exists())

        # Verify build report content
        self.assertGreater(report['nodes_count'], 0)
        self.assertGreater(report['edges_count'], 0)
        self.assertGreater(report['build_time'], 0)

    def test_validate_artifacts_valid(self):
        """Test validation of valid artifacts."""
        # First build artifacts
        builder = GraphArtifactBuilder(
            entities_file=str(self.entities_xml),
            metadata_file=str(self.metadata_file)
        )

        output_dir = Path(self.temp_dir) / "output"
        builder.build_all_artifacts(str(output_dir))

        # Then validate
        validation = builder.validate_artifacts(str(output_dir))

        self.assertTrue(validation['valid'])
        self.assertEqual(len(validation['errors']), 0)

    def test_validate_artifacts_missing_directory(self):
        """Test validation with missing directory."""
        builder = GraphArtifactBuilder(
            entities_file=str(self.entities_xml),
            metadata_file=str(self.metadata_file)
        )

        validation = builder.validate_artifacts("non_existent_directory")

        self.assertFalse(validation['valid'])
        self.assertGreater(len(validation['errors']), 0)


class TestDataStructures(unittest.TestCase):
    """Test data structures used in export tools."""

    def test_graph_node_creation(self):
        """Test GraphNode dataclass."""
        node = GraphNode(
            id=0,
            entity_id='character_sir_ector',
            entity_type='character',
            name='Sir Ector'
        )

        self.assertEqual(node.id, 0)
        self.assertEqual(node.entity_id, 'character_sir_ector')
        self.assertEqual(node.entity_type, 'character')
        self.assertEqual(node.name, 'Sir Ector')

    def test_graph_edge_creation(self):
        """Test GraphEdge dataclass."""
        edge = GraphEdge(
            source=0,
            target=1,
            edge_type=1,
            weight=1.5
        )

        self.assertEqual(edge.source, 0)
        self.assertEqual(edge.target, 1)
        self.assertEqual(edge.edge_type, 1)
        self.assertEqual(edge.weight, 1.5)

    def test_csr_files_creation(self):
        """Test CSRFiles dataclass."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            csr_files = CSRFiles(
                nodes_file=temp_path / "nodes.bin",
                offsets_file=temp_path / "offsets.bin",
                neighbors_file=temp_path / "neighbors.bin",
                edge_types_file=temp_path / "edge_types.bin",
                payloads_file=temp_path / "payloads.bin"
            )

            self.assertEqual(csr_files.nodes_file, temp_path / "nodes.bin")
            self.assertEqual(csr_files.offsets_file, temp_path / "offsets.bin")


def run_export_tool_tests():
    """Run all export tool tests."""
    # Create test suite
    test_classes = [
        TestCSRExporter,
        TestPathCatalogBuilder,
        TestGraphArtifactBuilder,
        TestDataStructures
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
    success = run_export_tool_tests()
    exit(0 if success else 1)