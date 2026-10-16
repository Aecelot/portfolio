#!/usr/bin/env python3
"""
GraphFast Artifact Builder

Converts entity graphs and metadata into high-performance binary artifacts
for the GraphFast runtime system. This replaces the need for Neo4j runtime
by pre-computing all graph operations offline.
"""

import json
import struct
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Set, Optional, Any
from dataclasses import dataclass, asdict
import xml.etree.ElementTree as ET
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class GraphNode:
    """Represents a node in the graph."""
    id: int
    entity_id: str
    entity_type: str
    name: str
    payload_offset: int = 0


@dataclass
class GraphEdge:
    """Represents an edge in the graph."""
    source: int
    target: int
    edge_type: int
    weight: float = 1.0


@dataclass
class CSRFiles:
    """Compressed Sparse Row format files."""
    nodes_file: Path
    offsets_file: Path
    neighbors_file: Path
    edge_types_file: Path
    payloads_file: Path


@dataclass
class PathCatalogEntry:
    """Entry in the pre-computed path catalog."""
    path_id: str
    source: int
    target: int
    metapath: List[int]
    nodes: List[int]
    abstract: str
    motifs: List[str]


class CSRExporter:
    """Exports graph data to CSR (Compressed Sparse Row) format."""

    def __init__(self):
        self.node_id_map: Dict[str, int] = {}
        self.reverse_node_map: Dict[int, str] = {}
        self.edges: List[GraphEdge] = []
        self.nodes: List[GraphNode] = []

    def load_entities_xml(self, entities_file: str) -> None:
        """Load entities from XML file."""
        logger.info(f"Loading entities from {entities_file}")

        if not Path(entities_file).exists():
            logger.warning(f"Entities file {entities_file} not found")
            return

        try:
            tree = ET.parse(entities_file)
            root = tree.getroot()

            node_id = 0
            for entity_elem in root.findall('entity'):
                entity_id = entity_elem.get('id')
                if not entity_id:
                    continue

                entity_name = entity_elem.get('name', entity_id)
                entity_type = entity_elem.get('type', 'unknown')

                # Create node
                node = GraphNode(
                    id=node_id,
                    entity_id=entity_id,
                    entity_type=entity_type,
                    name=entity_name
                )

                self.nodes.append(node)
                self.node_id_map[entity_id] = node_id
                self.reverse_node_map[node_id] = entity_id
                node_id += 1

            logger.info(f"Loaded {len(self.nodes)} entities")

        except ET.ParseError as e:
            logger.error(f"Invalid XML in {entities_file}: {e}")
        except Exception as e:
            logger.error(f"Error loading entities: {e}")

    def add_relationships_from_metadata(self, metadata_file: str) -> None:
        """Infer relationships from metadata.jsonl file."""
        logger.info(f"Loading metadata from {metadata_file}")

        if not Path(metadata_file).exists():
            logger.warning(f"Metadata file {metadata_file} not found")
            return

        try:
            with open(metadata_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        chunk = json.loads(line)

                        # Extract entities from chunk
                        entities = chunk.get('entities', [])
                        if not entities:
                            continue

                        # Normalize entity IDs to node IDs
                        node_ids = []
                        for entity in entities:
                            if isinstance(entity, dict):
                                entity_id = entity.get('entity_id')
                            else:
                                entity_id = str(entity)

                            if entity_id in self.node_id_map:
                                node_ids.append(self.node_id_map[entity_id])

                        # Create edges between co-occurring entities
                        for i, source_id in enumerate(node_ids):
                            for target_id in node_ids[i+1:]:
                                edge = GraphEdge(
                                    source=min(source_id, target_id),
                                    target=max(source_id, target_id),
                                    edge_type=1,  # Default relationship type
                                    weight=1.0
                                )
                                self.edges.append(edge)

                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON on line {line_num}: {e}")
                        continue

            logger.info(f"Created {len(self.edges)} edges from metadata")

        except Exception as e:
            logger.error(f"Error loading metadata: {e}")

    def export_csr(self, output_dir: str) -> CSRFiles:
        """Export graph to CSR format."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        logger.info("Exporting CSR format...")

        # Sort nodes by ID for consistent ordering
        self.nodes.sort(key=lambda x: x.id)
        self.edges.sort(key=lambda x: (x.source, x.target))

        # Build CSR data structures
        n = len(self.nodes)
        offsets = [0] * (n + 1)
        neighbors = []
        edge_types = []

        # Group edges by source node
        edge_index = 0
        for node_id in range(n):
            # Find all edges for this node
            while edge_index < len(self.edges) and self.edges[edge_index].source == node_id:
                edge = self.edges[edge_index]
                neighbors.append(edge.target)
                edge_types.append(edge.edge_type)
                edge_index += 1

            offsets[node_id + 1] = len(neighbors)

        # Create binary files
        nodes_file = output_path / "nodes.bin"
        offsets_file = output_path / "offsets.bin"
        neighbors_file = output_path / "neighbors.bin"
        edge_types_file = output_path / "edge_types.bin"
        payloads_file = output_path / "payloads.bin"

        # Write nodes (SoA format: node_type[u32], flags[u32], payload_offsets[u32])
        with open(nodes_file, 'wb') as f:
            for node in self.nodes:
                # node_type (simplified as entity_type hash)
                node_type_hash = hash(node.entity_type) & 0xFFFFFFFF
                f.write(struct.pack('<I', node_type_hash))

                # flags (placeholder)
                f.write(struct.pack('<I', 0))

                # payload_offsets (placeholder - will be filled later)
                f.write(struct.pack('<I', 0))

        # Write CSR offsets
        with open(offsets_file, 'wb') as f:
            for offset in offsets:
                f.write(struct.pack('<I', offset))

        # Write neighbors
        with open(neighbors_file, 'wb') as f:
            for neighbor in neighbors:
                f.write(struct.pack('<I', neighbor))

        # Write edge types
        with open(edge_types_file, 'wb') as f:
            for edge_type in edge_types:
                f.write(struct.pack('<H', edge_type))  # u16

        # Write payloads (short abstracts for entities)
        with open(payloads_file, 'wb') as f:
            for node in self.nodes:
                # Create simple payload: "entity_type: entity_name"
                payload = f"{node.entity_type}: {node.name}".encode('utf-8')
                # Write length-prefixed payload
                f.write(struct.pack('<I', len(payload)))
                f.write(payload)

        logger.info(f"Exported CSR files to {output_path}")

        return CSRFiles(
            nodes_file=nodes_file,
            offsets_file=offsets_file,
            neighbors_file=neighbors_file,
            edge_types_file=edge_types_file,
            payloads_file=payloads_file
        )


class PathCatalogBuilder:
    """Builds pre-computed path catalog for hot entity pairs."""

    def __init__(self, csr_exporter: CSRExporter):
        self.csr = csr_exporter
        self.catalog: List[PathCatalogEntry] = []

    def build_catalog(self, max_paths_per_pair: int = 2) -> None:
        """Build path catalog for hot entity pairs."""
        logger.info("Building path catalog...")

        # Identify "hot" entity pairs (entities that frequently co-occur)
        hot_pairs = self._identify_hot_pairs()

        for (source_id, target_id) in hot_pairs:
            # Find paths between entities (simplified BFS)
            paths = self._find_paths_bfs(source_id, target_id, max_depth=3)

            for i, path in enumerate(paths[:max_paths_per_pair]):
                entry = PathCatalogEntry(
                    path_id=f"path_{source_id}_{target_id}_{i}",
                    source=source_id,
                    target=target_id,
                    metapath=[1] * (len(path) - 1),  # Simplified metapath
                    nodes=path,
                    abstract=self._generate_abstract(path),
                    motifs=["direct_connection"]  # Simplified motifs
                )
                self.catalog.append(entry)

        logger.info(f"Built catalog with {len(self.catalog)} path entries")

    def _identify_hot_pairs(self) -> List[Tuple[int, int]]:
        """Identify frequently co-occurring entity pairs."""
        # Count co-occurrences from edges
        pair_counts: Dict[Tuple[int, int], int] = {}

        for edge in self.csr.edges:
            # Create canonical pair (sorted to avoid duplicates)
            pair = tuple(sorted([edge.source, edge.target]))
            pair_counts[pair] = pair_counts.get(pair, 0) + 1

        # Return top pairs by co-occurrence count
        sorted_pairs = sorted(pair_counts.items(), key=lambda x: x[1], reverse=True)
        return [pair for pair, count in sorted_pairs[:100]]  # Top 100 pairs

    def _find_paths_bfs(self, source: int, target: int, max_depth: int = 3) -> List[List[int]]:
        """Find paths between entities using BFS."""
        from collections import deque

        paths = []
        queue = deque([(source, [source])])
        visited = {source}

        while queue and len(paths) < 3:  # Limit to 3 paths
            current, path = queue.popleft()

            if len(path) > max_depth:
                continue

            if current == target and len(path) > 1:
                paths.append(path)
                continue

            # Find neighbors
            start_offset = self._get_node_offset(current)
            end_offset = self._get_node_offset(current + 1)

            for neighbor in range(start_offset, end_offset):
                # This is a simplified version - in real implementation,
                # would read from CSR files to get actual neighbors
                if neighbor not in visited:
                    visited.add(neighbor)
                    new_path = path + [neighbor]
                    queue.append((neighbor, new_path))

        return paths

    def _get_node_offset(self, node_id: int) -> int:
        """Get CSR offset for node (simplified)."""
        # In real implementation, would read from offsets.bin file
        # For now, return a placeholder
        return node_id * 2  # Simplified

    def _generate_abstract(self, path: List[int]) -> str:
        """Generate short abstract for path."""
        if not path:
            return ""

        entity_names = []
        for node_id in path:
            if node_id in self.csr.reverse_node_map:
                entity_id = self.csr.reverse_node_map[node_id]
                # Find entity name
                for node in self.csr.nodes:
                    if node.id == node_id:
                        entity_names.append(node.name)
                        break
                else:
                    entity_names.append(entity_id)
            else:
                entity_names.append(f"entity_{node_id}")

        return f"Connection path: {' → '.join(entity_names)}"

    def save_catalog(self, catalog_file: str) -> None:
        """Save path catalog to JSONL file."""
        logger.info(f"Saving catalog to {catalog_file}")

        with open(catalog_file, 'w', encoding='utf-8') as f:
            for entry in self.catalog:
                json.dump(asdict(entry), f, ensure_ascii=False)
                f.write('\n')


class GraphArtifactBuilder:
    """Main builder class for GraphFast artifacts."""

    def __init__(self, entities_file: str = "src/data/entities.xml",
                 metadata_file: str = "storage/store/meta.jsonl"):
        self.entities_file = entities_file
        self.metadata_file = metadata_file
        self.csr_exporter = CSRExporter()

    def build_all_artifacts(self, output_dir: str) -> Dict[str, Any]:
        """Build all GraphFast artifacts."""
        start_time = time.time()
        logger.info(f"Building GraphFast artifacts to {output_dir}")

        # Ensure output directory exists
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Step 1: Load and process entity data
        self.csr_exporter.load_entities_xml(self.entities_file)
        self.csr_exporter.add_relationships_from_metadata(self.metadata_file)

        # Step 2: Export CSR format
        csr_files = self.csr_exporter.export_csr(str(output_path))

        # Step 3: Build path catalog
        catalog_builder = PathCatalogBuilder(self.csr_exporter)
        catalog_builder.build_catalog()
        catalog_file = output_path / "paths" / "catalog.jsonl"
        catalog_file.parent.mkdir(exist_ok=True)
        catalog_builder.save_catalog(str(catalog_file))

        # Step 4: Generate build report
        build_time = time.time() - start_time
        report = {
            "build_time": build_time,
            "output_directory": str(output_path),
            "nodes_count": len(self.csr_exporter.nodes),
            "edges_count": len(self.csr_exporter.edges),
            "path_entries": len(catalog_builder.catalog),
            "csr_files": {
                "nodes": str(csr_files.nodes_file),
                "offsets": str(csr_files.offsets_file),
                "neighbors": str(csr_files.neighbors_file),
                "edge_types": str(csr_files.edge_types_file),
                "payloads": str(csr_files.payloads_file)
            },
            "catalog_file": str(catalog_file)
        }

        # Save build report
        report_file = output_path / "build_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"✅ Artifact build completed in {build_time:.2f}s")
        logger.info(f"📊 Built {report['nodes_count']} nodes, {report['edges_count']} edges")
        logger.info(f"📋 Created {report['path_entries']} path catalog entries")

        return report

    def validate_artifacts(self, output_dir: str) -> Dict[str, Any]:
        """Validate built artifacts."""
        logger.info(f"Validating artifacts in {output_dir}")

        output_path = Path(output_dir)
        validation = {
            "valid": True,
            "errors": [],
            "warnings": []
        }

        # Check CSR files exist and are readable
        required_files = [
            "nodes.bin", "offsets.bin", "neighbors.bin",
            "edge_types.bin", "payloads.bin"
        ]

        for file_name in required_files:
            file_path = output_path / file_name
            if not file_path.exists():
                validation["errors"].append(f"Missing file: {file_name}")
                validation["valid"] = False
            else:
                try:
                    # Try to read first few bytes
                    with open(file_path, 'rb') as f:
                        f.read(4)
                except Exception as e:
                    validation["errors"].append(f"Cannot read {file_name}: {e}")
                    validation["valid"] = False

        # Check catalog file
        catalog_file = output_path / "paths" / "catalog.jsonl"
        if not catalog_file.exists():
            validation["warnings"].append("No path catalog found")
        else:
            try:
                with open(catalog_file, 'r') as f:
                    first_line = f.readline().strip()
                    if first_line:
                        json.loads(first_line)
            except Exception as e:
                validation["errors"].append(f"Invalid catalog file: {e}")
                validation["valid"] = False

        # Check build report
        report_file = output_path / "build_report.json"
        if report_file.exists():
            try:
                with open(report_file, 'r') as f:
                    report = json.load(f)
                    validation["build_info"] = report
            except Exception as e:
                validation["warnings"].append(f"Cannot read build report: {e}")

        if validation["valid"]:
            logger.info("✅ Artifact validation passed")
        else:
            logger.error("❌ Artifact validation failed")

        return validation


def main():
    """Main entry point for building GraphFast artifacts."""
    import argparse

    parser = argparse.ArgumentParser(description="Build GraphFast artifacts")
    parser.add_argument("--entities", default="src/data/entities.xml",
                       help="Path to entities XML file")
    parser.add_argument("--metadata", default="storage/store/meta.jsonl",
                       help="Path to metadata JSONL file")
    parser.add_argument("--output", default="storage/graphfast",
                       help="Output directory for artifacts")
    parser.add_argument("--validate-only", action="store_true",
                       help="Only validate existing artifacts")

    args = parser.parse_args()

    if args.validate_only:
        # Just validate existing artifacts
        builder = GraphArtifactBuilder(args.entities, args.metadata)
        validation = builder.validate_artifacts(args.output)

        if validation["valid"]:
            print("✅ Artifacts are valid")
            return 0
        else:
            print("❌ Artifact validation failed")
            for error in validation["errors"]:
                print(f"  Error: {error}")
            for warning in validation["warnings"]:
                print(f"  Warning: {warning}")
            return 1

    # Build artifacts
    builder = GraphArtifactBuilder(args.entities, args.metadata)
    report = builder.build_all_artifacts(args.output)

    print("🎉 GraphFast artifacts built successfully!")
    print(f"📁 Output: {report['output_directory']}")
    print(f"📊 Nodes: {report['nodes_count']}")
    print(f"🔗 Edges: {report['edges_count']}")
    print(f"🛣️  Path entries: {report['path_entries']}")
    print(f"⏱️  Build time: {report['build_time']:.2f}s")

    return 0


if __name__ == "__main__":
    exit(main())