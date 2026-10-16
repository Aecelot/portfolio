#!/usr/bin/env python3
"""
GraphFast Memory-Mapped Loaders

High-performance memory-mapped file loaders for CSR format graph data.
Provides cross-platform mmap support for reading binary graph artifacts.
"""

import mmap
import struct
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, BinaryIO
from dataclasses import dataclass
import platform
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MemoryMap:
    """Cross-platform memory-mapped file wrapper."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.file_handle: Optional[BinaryIO] = None
        self.mmap_handle: Optional[mmap.mmap] = None
        self.size = 0

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def open(self) -> bool:
        """Open file and create memory map."""
        try:
            # Open file
            self.file_handle = open(self.file_path, 'rb')

            # Get file size
            self.file_handle.seek(0, 2)  # Seek to end
            self.size = self.file_handle.tell()
            self.file_handle.seek(0)     # Seek back to beginning

            if self.size == 0:
                logger.warning(f"Empty file: {self.file_path}")
                return False

            # Create memory map
            if platform.system() == 'Windows':
                self.mmap_handle = mmap.mmap(
                    self.file_handle.fileno(),
                    self.size,
                    access=mmap.ACCESS_READ
                )
            else:
                # Unix-like systems
                self.mmap_handle = mmap.mmap(
                    self.file_handle.fileno(),
                    self.size,
                    mmap.MAP_SHARED,
                    mmap.PROT_READ
                )

            logger.debug(f"Memory-mapped {self.file_path} ({self.size} bytes)")
            return True

        except Exception as e:
            logger.error(f"Failed to memory-map {self.file_path}: {e}")
            self.close()
            return False

    def close(self) -> None:
        """Close memory map and file handle."""
        try:
            if self.mmap_handle:
                self.mmap_handle.close()
                self.mmap_handle = None

            if self.file_handle:
                self.file_handle.close()
                self.file_handle = None

        except Exception as e:
            logger.error(f"Error closing memory map: {e}")

    def read_uint32(self, offset: int) -> int:
        """Read uint32 from memory map."""
        if not self.mmap_handle:
            raise RuntimeError("Memory map not open")

        if offset + 4 > self.size:
            raise IndexError(f"Offset {offset} out of bounds (size: {self.size})")

        # Read 4 bytes and unpack as little-endian uint32
        data = self.mmap_handle[offset:offset+4]
        return struct.unpack('<I', data)[0]

    def read_uint16(self, offset: int) -> int:
        """Read uint16 from memory map."""
        if not self.mmap_handle:
            raise RuntimeError("Memory map not open")

        if offset + 2 > self.size:
            raise IndexError(f"Offset {offset} out of bounds (size: {self.size})")

        data = self.mmap_handle[offset:offset+2]
        return struct.unpack('<H', data)[0]

    def read_bytes(self, offset: int, length: int) -> bytes:
        """Read bytes from memory map."""
        if not self.mmap_handle:
            raise RuntimeError("Memory map not open")

        if offset + length > self.size:
            raise IndexError(f"Offset {offset}+{length} out of bounds (size: {self.size})")

        return self.mmap_handle[offset:offset+length]


@dataclass
class CSRGraph:
    """In-memory representation of CSR format graph."""

    # Node data (Structure of Arrays)
    node_types: np.ndarray      # uint32 array
    node_flags: np.ndarray      # uint32 array
    payload_offsets: np.ndarray # uint32 array

    # CSR structure
    offsets: np.ndarray         # uint32 array (N+1)
    neighbors: np.ndarray       # uint32 array (M)
    edge_types: np.ndarray      # uint16 array (M)

    # Metadata
    num_nodes: int
    num_edges: int

    # Memory maps (keep references to prevent GC)
    _mmap_files: List[MemoryMap] = None

    def __post_init__(self):
        if self._mmap_files is None:
            self._mmap_files = []


class MMapCSRLoader:
    """Loads CSR format graph data using memory mapping."""

    def __init__(self):
        self.graph: Optional[CSRGraph] = None
        self.mmap_files: List[MemoryMap] = []

    def load_graph(self, artifacts_dir: str) -> Optional[CSRGraph]:
        """Load entire graph from artifacts directory."""
        artifacts_path = Path(artifacts_dir)

        if not artifacts_path.exists():
            logger.error(f"Artifacts directory not found: {artifacts_dir}")
            return None

        logger.info(f"Loading CSR graph from {artifacts_dir}")

        try:
            # Load binary files
            nodes_mmap = self._load_binary_file(artifacts_path / "nodes.bin")
            offsets_mmap = self._load_binary_file(artifacts_path / "offsets.bin")
            neighbors_mmap = self._load_binary_file(artifacts_path / "neighbors.bin")
            edge_types_mmap = self._load_binary_file(artifacts_path / "edge_types.bin")

            if not all([nodes_mmap, offsets_mmap, neighbors_mmap, edge_types_mmap]):
                logger.error("Failed to load required binary files")
                self._cleanup_mmaps()
                return None

            # Read nodes data (SoA format: node_type, flags, payload_offsets)
            num_nodes = nodes_mmap.size // 12  # 3 * uint32 = 12 bytes per node

            node_types = np.zeros(num_nodes, dtype=np.uint32)
            node_flags = np.zeros(num_nodes, dtype=np.uint32)
            payload_offsets = np.zeros(num_nodes, dtype=np.uint32)

            for i in range(num_nodes):
                offset = i * 12
                node_types[i] = nodes_mmap.read_uint32(offset)
                node_flags[i] = nodes_mmap.read_uint32(offset + 4)
                payload_offsets[i] = nodes_mmap.read_uint32(offset + 8)

            # Read CSR offsets
            offsets_size = offsets_mmap.size // 4  # uint32
            offsets = np.zeros(offsets_size, dtype=np.uint32)
            for i in range(offsets_size):
                offsets[i] = offsets_mmap.read_uint32(i * 4)

            # Read neighbors and edge types
            neighbors_size = neighbors_mmap.size // 4  # uint32
            neighbors = np.zeros(neighbors_size, dtype=np.uint32)
            for i in range(neighbors_size):
                neighbors[i] = neighbors_mmap.read_uint32(i * 4)

            edge_types_size = edge_types_mmap.size // 2  # uint16
            edge_types = np.zeros(edge_types_size, dtype=np.uint16)
            for i in range(edge_types_size):
                edge_types[i] = edge_types_mmap.read_uint16(i * 2)

            # Calculate edges count
            num_edges = len(neighbors)

            # Create graph object
            self.graph = CSRGraph(
                node_types=node_types,
                node_flags=node_flags,
                payload_offsets=payload_offsets,
                offsets=offsets,
                neighbors=neighbors,
                edge_types=edge_types,
                num_nodes=num_nodes,
                num_edges=num_edges,
                _mmap_files=self.mmap_files
            )

            logger.info(f"✅ Loaded CSR graph: {num_nodes} nodes, {num_edges} edges")
            return self.graph

        except Exception as e:
            logger.error(f"Error loading CSR graph: {e}")
            self._cleanup_mmaps()
            return None

    def _load_binary_file(self, file_path: Path) -> Optional[MemoryMap]:
        """Load a binary file into memory map."""
        if not file_path.exists():
            logger.error(f"Binary file not found: {file_path}")
            return None

        mmap_obj = MemoryMap(file_path)
        if mmap_obj.open():
            self.mmap_files.append(mmap_obj)
            return mmap_obj
        else:
            return None

    def _cleanup_mmaps(self) -> None:
        """Clean up all memory maps."""
        for mmap_file in self.mmap_files:
            mmap_file.close()
        self.mmap_files.clear()

    def get_neighbors(self, node_id: int) -> Tuple[np.ndarray, np.ndarray]:
        """Get neighbors and edge types for a node."""
        if not self.graph:
            raise RuntimeError("Graph not loaded")

        if node_id < 0 or node_id >= self.graph.num_nodes:
            raise IndexError(f"Node ID {node_id} out of range")

        # Get CSR range for this node
        start_offset = self.graph.offsets[node_id]
        end_offset = self.graph.offsets[node_id + 1]

        # Extract neighbors and edge types
        neighbors = self.graph.neighbors[start_offset:end_offset]
        edge_types = self.graph.edge_types[start_offset:end_offset]

        return neighbors, edge_types

    def get_node_info(self, node_id: int) -> Tuple[int, int, int]:
        """Get node type, flags, and payload offset for a node."""
        if not self.graph:
            raise RuntimeError("Graph not loaded")

        if node_id < 0 or node_id >= self.graph.num_nodes:
            raise IndexError(f"Node ID {node_id} out of range")

        return (
            self.graph.node_types[node_id],
            self.graph.node_flags[node_id],
            self.graph.payload_offsets[node_id]
        )

    def get_payload(self, node_id: int) -> str:
        """Get payload string for a node."""
        if not self.graph:
            raise RuntimeError("Graph not loaded")

        if node_id < 0 or node_id >= self.graph.num_nodes:
            raise IndexError(f"Node ID {node_id} out of range")

        payload_offset = self.graph.payload_offsets[node_id]

        # For now, return a simple payload format
        # In full implementation, would read from payloads.bin file
        node_type = self.graph.node_types[node_id]
        return f"Node {node_id} (type: {node_type})"

    def get_statistics(self) -> Dict[str, Any]:
        """Get graph statistics."""
        if not self.graph:
            return {}

        return {
            "num_nodes": self.graph.num_nodes,
            "num_edges": self.graph.num_edges,
            "avg_degree": self.graph.num_edges / max(1, self.graph.num_nodes),
            "memory_usage_mb": sum(mmap.size for mmap in self.mmap_files) / (1024 * 1024)
        }

    def close(self) -> None:
        """Close all memory maps."""
        self._cleanup_mmaps()
        self.graph = None
        logger.info("✅ Closed CSR graph")


class PayloadLoader:
    """Loads node payloads from binary file."""

    def __init__(self):
        self.payload_mmap: Optional[MemoryMap] = None

    def load_payloads(self, payloads_file: str) -> bool:
        """Load payloads binary file."""
        payloads_path = Path(payloads_file)

        if not payloads_path.exists():
            logger.warning(f"Payloads file not found: {payloads_file}")
            return False

        self.payload_mmap = MemoryMap(payloads_path)
        return self.payload_mmap.open()

    def get_payload(self, offset: int) -> str:
        """Get payload string at offset."""
        if not self.payload_mmap:
            return ""

        try:
            # Read length (uint32)
            length = self.payload_mmap.read_uint32(offset)

            # Read payload data
            payload_data = self.payload_mmap.read_bytes(offset + 4, length)

            return payload_data.decode('utf-8', errors='replace')

        except (IndexError, UnicodeDecodeError) as e:
            logger.warning(f"Error reading payload at offset {offset}: {e}")
            return ""

    def close(self) -> None:
        """Close payload file."""
        if self.payload_mmap:
            self.payload_mmap.close()
            self.payload_mmap = None


class PathCatalogLoader:
    """Loads pre-computed path catalog."""

    def __init__(self):
        self.catalog: List[Dict[str, Any]] = []
        self.catalog_map: Dict[Tuple[int, int, str], Dict[str, Any]] = {}

    def load_catalog(self, catalog_file: str) -> bool:
        """Load path catalog from JSONL file."""
        catalog_path = Path(catalog_file)

        if not catalog_path.exists():
            logger.warning(f"Catalog file not found: {catalog_file}")
            return False

        logger.info(f"Loading path catalog from {catalog_file}")

        try:
            with open(catalog_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        entry = json.loads(line)

                        # Add to catalog list
                        self.catalog.append(entry)

                        # Create lookup key (source, target, metapath_hash)
                        source = entry.get('source', 0)
                        target = entry.get('target', 0)
                        metapath = str(entry.get('metapath', []))
                        key = (source, target, hash(metapath))

                        self.catalog_map[key] = entry

                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON on line {line_num}: {e}")
                        continue

            logger.info(f"✅ Loaded {len(self.catalog)} path catalog entries")
            return True

        except Exception as e:
            logger.error(f"Error loading catalog: {e}")
            return False

    def find_path(self, source: int, target: int, metapath: List[int] = None) -> Optional[Dict[str, Any]]:
        """Find path in catalog."""
        if metapath:
            key = (source, target, hash(str(metapath)))
        else:
            # Find any path between source and target
            for (s, t, _), entry in self.catalog_map.items():
                if s == source and t == target:
                    return entry
        return None

    def get_statistics(self) -> Dict[str, Any]:
        """Get catalog statistics."""
        return {
            "total_entries": len(self.catalog),
            "unique_pairs": len(self.catalog_map),
            "avg_paths_per_pair": len(self.catalog) / max(1, len(self.catalog_map))
        }


def main():
    """Test the memory-mapped loaders."""
    print("🧪 Testing GraphFast Memory-Mapped Loaders")
    print("=" * 50)

    # Test CSR loader
    print("\n1. Testing CSR Loader...")
    csr_loader = MMapCSRLoader()

    try:
        graph = csr_loader.load_graph("storage/graphfast_test")
        if graph:
            print("✅ CSR graph loaded successfully")
            stats = csr_loader.get_statistics()
            print(f"📊 Graph stats: {stats}")

            # Test node queries
            if graph.num_nodes > 0:
                node_id = 0
                neighbors, edge_types = csr_loader.get_neighbors(node_id)
                node_type, flags, payload_offset = csr_loader.get_node_info(node_id)
                payload = csr_loader.get_payload(node_id)

                print(f"🔍 Node {node_id}: type={node_type}, neighbors={len(neighbors)}")
                print(f"📄 Payload: {payload}")
        else:
            print("❌ Failed to load CSR graph")

    except Exception as e:
        print(f"❌ Error testing CSR loader: {e}")

    finally:
        csr_loader.close()

    # Test path catalog loader
    print("\n2. Testing Path Catalog Loader...")
    catalog_loader = PathCatalogLoader()

    try:
        if catalog_loader.load_catalog("storage/graphfast_test/paths/catalog.jsonl"):
            stats = catalog_loader.get_statistics()
            print("✅ Path catalog loaded successfully")
            print(f"📊 Catalog stats: {stats}")

            # Test path lookup
            if catalog_loader.catalog:
                print(f"🔍 Sample catalog entry: {catalog_loader.catalog[0]}")
        else:
            print("❌ Failed to load path catalog")

    except Exception as e:
        print(f"❌ Error testing catalog loader: {e}")

    print("\n✅ Loader testing completed")


if __name__ == "__main__":
    main()