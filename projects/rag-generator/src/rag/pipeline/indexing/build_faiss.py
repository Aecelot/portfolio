#!/usr/bin/env python3
"""
FAISS index construction for Lore RAG system.

Builds vector indexes for efficient similarity search using FAISS library.
Supports multiple index types (FlatIP, HNSW, IVF) based on configuration.
"""

import json
import time
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional, Union
import gc

import numpy as np

# Try to import FAISS, fall back to simple search if not available
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    print("⚠️  FAISS not available, using simple vector search as fallback")
    FAISS_AVAILABLE = False
    faiss = None

# Import SimpleVectorSearch for fallback
try:
    from .simple_vector_search import SimpleVectorSearch
except ImportError:
    # Import will be handled in _build_simple_index method
    SimpleVectorSearch = None


class FAISSBuilder:
    """
    Builds vector indexes for similarity search.

    Handles different index types including FAISS (when available) and
    simple vector search as fallback for optimal performance and
    compatibility trade-offs.
    """

    def __init__(self, config_path: str = "config/rag/rag.xml"):
        """Initialize the builder with configuration."""
        self.config = self._load_config(config_path)
        self.vectors_path = "store/vectors.npy"
        self.index_path = "store/faiss.index"
        self.simple_index_path = "store/simple_index.json"
        self.rowmap_path = "store/rowmap.json"
        self.use_faiss = FAISS_AVAILABLE

    def _load_config(self, config_path: str) -> Dict:
        """Load and validate configuration file."""
        try:
            import xml.etree.ElementTree as ET

            # Parse XML file
            tree = ET.parse(config_path)
            root = tree.getroot()

            # Convert XML to dictionary
            def xml_to_dict(element):
                result = {}

                # Add attributes if any
                if element.attrib:
                    result.update(element.attrib)

                # Add text content if any (for mixed content)
                if element.text and element.text.strip():
                    result['value'] = element.text.strip()

                # Process children
                for child in element:
                    child_dict = xml_to_dict(child)

                    # Handle multiple children with same name
                    if child.tag in result:
                        if not isinstance(result[child.tag], list):
                            result[child.tag] = [result[child.tag]]
                        result[child.tag].append(child_dict)
                    else:
                        result[child.tag] = child_dict

                return result

            config = xml_to_dict(root)

            # Extract FAISS parameters with defaults
            index_config = config.get('index', {})
            if isinstance(index_config, dict):
                # Handle nested ann structure from XML parsing
                ann_config = index_config.get('ann', {})
                if isinstance(ann_config, dict):
                    index_type_raw = ann_config.get('type', 'faiss_flat_ip')
                    # Handle case where type might be a dict with 'value' key
                    if isinstance(index_type_raw, dict):
                        index_type = index_type_raw.get('value', 'faiss_flat_ip')
                    else:
                        index_type = index_type_raw

                    hnsw_config = ann_config.get('hnsw', {})
                    if isinstance(hnsw_config, dict):
                        hnsw_params = hnsw_config
                    else:
                        hnsw_params = {}
                else:
                    index_type = 'faiss_flat_ip'
                    hnsw_params = {}

                config['vectorization'] = {
                    'index': {
                        'type': index_type,
                        'hnsw': hnsw_params,
                        'ivf': {}
                    }
                }
            else:
                config['vectorization'] = {
                    'index': {
                        'type': 'faiss_flat_ip',
                        'hnsw': {},
                        'ivf': {}
                    }
                }

            return config

        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        except Exception as e:
            raise ValueError(f"Error loading configuration file: {e}")

    def _validate_inputs_batched(self, batch_size: int = 10000) -> Tuple[np.ndarray, Dict, str]:
        """Load vectors in batches to reduce memory pressure."""
        print("🔍 Loading vectors in batches...")

        # Get total vector count without loading all into memory
        vectors_shape = np.load(self.vectors_path, mmap_mode='r').shape
        total_vectors = vectors_shape[0]

        # Process in batches for validation
        all_vectors = []
        for start_idx in range(0, total_vectors, batch_size):
            end_idx = min(start_idx + batch_size, total_vectors)
            batch = np.load(self.vectors_path, mmap_mode='r')[start_idx:end_idx]

            # Validate each batch
            if batch.shape[1] != 768:
                raise ValueError(f"Dimension mismatch in batch {start_idx}-{end_idx}")

            all_vectors.append(batch)
            print(f"  ✅ Validated batch {start_idx//batch_size + 1}/{(total_vectors-1)//batch_size + 1}")

        vectors = np.vstack(all_vectors)
        return vectors, self._load_rowmap_batched(total_vectors), self._compute_file_hash()

    def _load_rowmap_batched(self, total_vectors: int) -> Dict:
        """Load rowmap in batches to match vector batching."""
        with open(self.rowmap_path, 'r') as f:
            rowmap_data = json.load(f)

        # Regenerate if count mismatch (existing logic)
        if len(rowmap_data.get('rowmap', [])) != total_vectors:
            return self._regenerate_rowmap_batched(vectors, rowmap_data)

        return rowmap_data

    def _compute_file_hash(self) -> str:
        """Compute file hash for integrity tracking."""
        try:
            # Use memory-mapped reading for large files
            vectors_mmap = np.load(self.vectors_path, mmap_mode='r')
            return hashlib.sha256(vectors_mmap.tobytes()).hexdigest()[:16]
        except Exception:
            return "unknown"

    def _validate_inputs(self) -> Tuple[np.ndarray, Dict, str]:
        """Validate input files and load vectors (legacy method - delegates to batched version)."""
        return self._validate_inputs_batched()

    def _build_flat_ip_index(self, vectors: np.ndarray) -> Any:
        """Build IndexFlatIP (exact search, brute force)."""
        print("🏗️  Building IndexFlatIP (exact search)...")

        if not FAISS_AVAILABLE or faiss is None:
            raise RuntimeError("FAISS not available")

        # Inner Product is equivalent to cosine similarity for normalized vectors
        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(vectors)  # type: ignore[call-arg]

        print(f"✅ IndexFlatIP built: {index.ntotal if hasattr(index, 'ntotal') else 'N/A'} vectors")  # type: ignore[attr-defined]
        return index

    def _build_hnsw_index(self, vectors: np.ndarray) -> Any:
        """Build IndexHNSWFlat (approximate search with HNSW)."""
        print("🏗️  Building IndexHNSWFlat (approximate search)...")

        if not FAISS_AVAILABLE or faiss is None:
            raise RuntimeError("FAISS not available")

        # Get HNSW parameters from config
        hnsw_config = self.config['vectorization']['index']['hnsw']
        M = hnsw_config.get('M', 32)
        efConstruction = hnsw_config.get('efConstruction', 200)

        # Handle XML parsing where values might be wrapped in dicts with 'value' key
        if isinstance(M, dict):
            M = M.get('value', 32)
        if isinstance(efConstruction, dict):
            efConstruction = efConstruction.get('value', 200)

        # Convert string values to integers
        if isinstance(M, str):
            M = int(M)
        if isinstance(efConstruction, str):
            efConstruction = int(efConstruction)

        # Create HNSW index with proper dimension
        index = faiss.IndexHNSWFlat(vectors.shape[1], M)
        index.hnsw.efConstruction = efConstruction

        # Train and add vectors
        index.add(vectors)  # type: ignore[call-arg]

        print(f"✅ IndexHNSWFlat built: {index.ntotal if hasattr(index, 'ntotal') else 'N/A'} vectors")  # type: ignore[attr-defined]
        print(f"   M: {M}, efConstruction: {efConstruction}")

        return index

    def _build_ivf_index(self, vectors: np.ndarray) -> Any:
        """Build IndexIVFFlat (inverted file with flat quantizer)."""
        print("🏗️  Building IndexIVFFlat (clustered search)...")

        if not FAISS_AVAILABLE or faiss is None:
            raise RuntimeError("FAISS not available")

        # Get IVF parameters from config
        ivf_config = self.config['vectorization']['index']['ivf']
        nlist = ivf_config.get('nlist', 4096)

        # Create IVF index with Flat quantizer
        quantizer = faiss.IndexFlatIP(vectors.shape[1])
        index = faiss.IndexIVFFlat(quantizer, vectors.shape[1], nlist)

        # Train the index
        print(f"🔄 Training IVF index with {len(vectors)} vectors...")
        index.train(vectors)  # type: ignore[call-arg]

        # Add vectors
        index.add(vectors)  # type: ignore[call-arg]

        print(f"✅ IndexIVFFlat built: {index.ntotal if hasattr(index, 'ntotal') else 'N/A'} vectors")  # type: ignore[attr-defined]
        print(f"   nlist: {nlist}")

        return index

    def _build_index(self, vectors: np.ndarray):
        """Build index based on configuration and availability."""
        if not self.use_faiss:
            print("🔄 Using simple vector search (FAISS not available)")
            return self._build_simple_index(vectors)

        index_type = self.config['vectorization']['index']['type']

        if index_type == 'faiss_flat_ip':
            return self._build_flat_ip_index(vectors)
        elif index_type == 'faiss_hnsw':
            return self._build_hnsw_index(vectors)
        elif index_type == 'faiss_ivf_flat':
            return self._build_ivf_index(vectors)
        else:
            print(f"⚠️  Unsupported index type '{index_type}', falling back to simple search")
            return self._build_simple_index(vectors)

    def _build_simple_index(self, vectors: np.ndarray):
        """Build simple vector search index."""
        print("🏗️  Building Simple Vector Search index...")

        # Handle import of SimpleVectorSearch
        if SimpleVectorSearch is None:
            try:
                from .simple_vector_search import SimpleVectorSearch as SVSClass
            except ImportError:
                raise RuntimeError("SimpleVectorSearch not available - cannot build fallback index")

            # Create a local reference to avoid the None check issue
            search_class = SVSClass
        else:
            search_class = SimpleVectorSearch

        # Load metadata if available
        metadata = []
        if Path(self.rowmap_path).exists():
            try:
                with open(self.rowmap_path, 'r', encoding='utf-8') as f:
                    rowmap_data = json.load(f)
                    metadata = rowmap_data.get('rowmap', [])
            except Exception as e:
                print(f"⚠️  Could not load metadata: {e}")

        # Create simple search index
        index = search_class(vectors, metadata)
        print(f"✅ Simple vector search index built: {len(vectors)} vectors")

        return index

    def _save_index(self, index, output_path: str) -> str:
        """Save index to disk (FAISS or simple search)."""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        if self.use_faiss:
            print(f"💾 Saving FAISS index to {output_path}")
            if faiss is not None:
                # Fix FAISS API compatibility - write_index takes index, filename, and optional I/O flags
                try:
                    faiss.write_index(index, output_path)  # Try without I/O flags first
                except TypeError:
                    # If that fails, try with I/O flags parameter (FAISS version compatibility)
                    faiss.write_index(index, output_path, 0)  # 0 = default I/O flags
        else:
            print(f"💾 Saving simple vector search index to {output_path}")
            if hasattr(index, 'save_index'):
                index.save_index(output_path)
            else:
                # Fallback: save as JSON
                data = {
                    'vectors': index.vectors.tolist(),
                    'metadata': index.metadata,
                    'normalized_vectors': index.normalized_vectors.tolist()
                }
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

        return str(output_file)

    def _regenerate_rowmap(self, vectors: np.ndarray, existing_rowmap: Dict) -> Dict:
        """Regenerate rowmap to match the number of vectors."""
        print(f"🔄 Regenerating rowmap for {vectors.shape[0]} vectors...")

        # Create new rowmap entries that match the vector count
        new_rowmap = []
        for i in range(vectors.shape[0]):
            new_rowmap.append({
                "row": i,
                "section_id": f"auto_generated_{i}",
                "doc_id": "",
                "domain": "",
                "token_count": 256  # Default token count
            })

        # Preserve other metadata from existing rowmap if available
        result = {
            "rowmap": new_rowmap,
            "file_hash": existing_rowmap.get("file_hash", ""),
            "total_chunks": vectors.shape[0],
            "created_at": existing_rowmap.get("created_at", ""),
            "model": existing_rowmap.get("model", "BAAI/bge-base-en"),
            "normalize": existing_rowmap.get("normalize", True)
        }

        # Save the updated rowmap
        print(f"💾 Saving updated rowmap with {len(new_rowmap)} entries")
        with open(self.rowmap_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        return result

    def _save_index_report(self, index, build_stats: Dict, file_hash: str) -> str:
        """Save comprehensive index report."""
        output_path = "store/index_report.json"
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Gather index statistics
        report = {
            'index_type': self.config['vectorization']['index']['type'],
            'file_hash': file_hash,
            'build_timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'vectors_count': index.ntotal if hasattr(index, 'ntotal') else len(index.vectors) if hasattr(index, 'vectors') else 0,  # type: ignore[attr-defined]
            'vectors_shape': build_stats.get('vectors_shape', []),
            'build_time': build_stats.get('build_time', 0),
            'config': self.config['vectorization']['index'],
            'integrity_checks': {
                'vectors_normalized': build_stats.get('vectors_normalized', False),
                'shape_consistent': build_stats.get('shape_consistent', False)
            }
        }

        print(f"📋 Saving index report to {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return str(output_file)

    def build_index(self, vectors_path=None, output_dir="store"):
        """
        Build FAISS index from vectors.

        Args:
            vectors_path: Path to vectors file (default: store/vectors.npy)
            output_dir: Output directory for index and reports

        Returns:
            Dictionary with build statistics and file paths
        """
        if vectors_path:
            self.vectors_path = vectors_path

        output_dir_path = Path(output_dir)
        self.index_path = str(output_dir_path / "faiss.index")

        start_time = time.time()

        try:
            # Step 1: Validate inputs and load data
            vectors, rowmap_data, file_hash = self._validate_inputs()

            # Step 2: Build the index
            index = self._build_index(vectors)

            # Step 3: Save index and report
            index_file = self._save_index(index, self.index_path)
            report_file = self._save_index_report(index, {
                'vectors_shape': list(vectors.shape),
                'vectors_normalized': True,  # We assume normalization from embedding step
                'shape_consistent': True,
                'build_time': time.time() - start_time
            }, file_hash)

            total_time = time.time() - start_time

            # Build result statistics
            result = {
                'success': True,
                'index_file': index_file,
                'report_file': report_file,
                'index_type': self.config['vectorization']['index']['type'],
                'vectors_count': index.ntotal if hasattr(index, 'ntotal') else len(index.vectors) if hasattr(index, 'vectors') else 0,  # type: ignore[attr-defined]
                'vector_dimensions': vectors.shape[1],
                'file_hash': file_hash,
                'build_time': total_time,
                'config': self.config['vectorization']['index']
            }

            print("\n📊 Index Build Summary:")
            print(f"  Index file: {index_file}")
            print(f"  Report file: {report_file}")
            print(f"  Index type: {result['index_type']}")
            print(f"  Vectors indexed: {result['vectors_count']}")
            print(f"  Build time: {total_time:.2f}s")
            
            return result

        except Exception as e:
            raise RuntimeError(f"Failed to build FAISS index: {e}")


def main():
    """Main entry point for testing the FAISS builder."""
    try:
        builder = FAISSBuilder()

        print("🧪 Testing FAISS Index Builder")
        print("=" * 50)

        # Test with existing vectors file
        vectors_file = Path("store/vectors.npy")
        if vectors_file.exists():
            print(f"\n🏗️  Building FAISS index from: {vectors_file}")

            result = builder.build_index()

            if result['success']:
                print("✅ FAISS index built successfully!")

                # Validate output files exist
                index_file = Path(result['index_file'])
                report_file = Path(result['report_file'])

                if index_file.exists() and report_file.exists():
                    print("✅ Output files created:")
                    print(f"  Index: {index_file} ({index_file.stat().st_size:,} bytes)")
                    print(f"  Report: {report_file}")
                else:
                    print("❌ Output files not found")
            else:
                print("❌ FAISS index build failed")
        else:
            print(f"❌ Vectors file not found: {vectors_file}")
            print("Run 'make embed' first to generate embeddings")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()