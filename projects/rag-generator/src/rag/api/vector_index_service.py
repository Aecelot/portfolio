"""
VectorIndexService - Focused component for vector index management.

Handles FAISS index loading, search operations, and index creation.
Separated from monolithic RetrievalService for better maintainability.
"""

from typing import List, Optional, Dict, Any, Tuple
import os
from pathlib import Path


class VectorIndexService:
    """
    Manages vector index lifecycle and search operations.

    Responsibilities:
    - FAISS index loading and validation
    - Vector search and similarity computation
    - Index creation and management
    - Row mapping for result resolution
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize vector index service with configuration."""
        self.config = config
        self.faiss_index = None
        self.vectors = None
        self.rowmap: Dict[int, str] = {}
        self._index_path = None
        self._vectors_path = None
        self._initialized = False

    def initialize(self, index_path: Optional[str] = None, vectors_path: Optional[str] = None) -> bool:
        """Initialize the vector index service."""
        try:
            # Use provided paths or extract from config
            if index_path and vectors_path:
                self._index_path = index_path
                self._vectors_path = vectors_path
            else:
                self._index_path = self._get_index_path()
                self._vectors_path = self._get_vectors_path()

            print("🔄 Initializing VectorIndexService...")

            # Load vectorization artifacts
            success = self._load_vector_artifacts()
            if success:
                self._initialized = True
                print("✅ VectorIndexService initialized successfully")
                return True
            else:
                print("⚠️  VectorIndexService initialized with limited functionality")
                return False

        except Exception as e:
            print(f"❌ Failed to initialize VectorIndexService: {e}")
            return False

    def _get_index_path(self) -> str:
        """Get FAISS index path from configuration."""
        # Correct path to storage directory
        return "storage/store/faiss.index"

    def _get_vectors_path(self) -> str:
        """Get vectors path from configuration."""
        # Correct path to storage directory
        return "storage/store/vectors.npy"

    def _load_vector_artifacts(self) -> bool:
        """Load FAISS index and vectors."""
        try:
            # Check if files exist
            index_file = Path(self._index_path)
            vectors_file = Path(self._vectors_path)
            rowmap_file = Path("storage/store/rowmap.json")

            missing_files = []
            if not index_file.exists():
                missing_files.append("faiss.index")
            if not vectors_file.exists():
                missing_files.append("vectors.npy")
            if not rowmap_file.exists():
                missing_files.append("rowmap.json")

            if missing_files:
                print(f"⚠️  Warning: Missing files: {', '.join(missing_files)}")
                print("ℹ️  Vector search will be disabled")

            # Load FAISS index if available
            if index_file.exists():
                self.faiss_index = self._load_faiss_index(str(index_file))
                if self.faiss_index:
                    print(f"✅ Loaded FAISS index: {self.faiss_index.ntotal} vectors")

            # Load vectors if available
            if vectors_file.exists():
                self.vectors = self._load_vectors(str(vectors_file))
                if self.vectors is not None:
                    print(f"✅ Loaded vectors: {self.vectors.shape}")

            # Load rowmap for section_id resolution
            if rowmap_file.exists():
                self.rowmap = self._load_rowmap(str(rowmap_file))
                print(f"✅ Loaded {len(self.rowmap)} row mappings")
            else:
                print("⚠️  Rowmap file not found, using empty rowmap")
                self.rowmap = {}

            return True

        except Exception as e:
            print(f"❌ Failed to load vector artifacts: {e}")
            return False

    def _load_faiss_index(self, index_path: str) -> Optional[Any]:
        """Load FAISS index from file."""
        try:
            import faiss
            print(f"🔄 Loading FAISS index from {index_path}...")
            index = faiss.read_index(index_path)

            if index is not None and hasattr(index, 'ntotal'):
                print(f"✅ Loaded FAISS index: {index.ntotal} vectors")
                return index
            else:
                print("⚠️  FAISS index loaded but appears invalid")
                return None

        except ImportError:
            print("⚠️  FAISS not available")
            return None
        except Exception as e:
            print(f"⚠️  Failed to load FAISS index: {e}")
            return None

    def _load_vectors(self, vectors_path: str) -> Optional[Any]:
        """Load vector array from file."""
        try:
            import numpy as np
            vectors = np.load(vectors_path)

            if vectors is not None:
                print(f"✅ Loaded vectors: {vectors.shape}")
                return vectors
            else:
                print("⚠️  Vectors loaded but are None")
                return None

        except Exception as e:
            print(f"⚠️  Failed to load vectors: {e}")
            return None

    def _load_rowmap(self, rowmap_path: str) -> Dict[int, str]:
        """Load rowmap for section_id resolution."""
        try:
            import json
            with open(rowmap_path, 'r', encoding='utf-8') as f:
                rowmap_data = json.load(f)

            rowmap = {item['row']: item['section_id'] for item in rowmap_data.get('rowmap', [])}
            return rowmap

        except Exception as e:
            print(f"⚠️  Failed to load rowmap: {e}")
            return {}

    def search(self, query_vector: Any, k: int) -> Tuple[List[float], List[int]]:
        """Search for similar vectors in the index."""
        if not self._initialized or self.faiss_index is None:
            # Return empty results if not available
            return [], []

        try:
            # Ensure query vector is in correct format
            if hasattr(query_vector, 'astype'):
                query_vector = query_vector.astype('float32')

            # Perform search
            distances, indices = self.faiss_index.search(query_vector, k)
            return distances[0], indices[0]

        except Exception as e:
            print(f"⚠️  Vector search failed: {e}")
            return [], []

    def resolve_section_ids(self, indices: List[int]) -> List[str]:
        """Convert row indices to section IDs using rowmap."""
        section_ids = []
        for idx in indices:
            if idx != -1:  # Valid result
                section_id = self.rowmap.get(idx)
                if section_id:
                    section_ids.append(section_id)
                else:
                    print(f"⚠️  No section_id found for row {idx}")
            else:
                section_ids.append(None)
        return section_ids

    def create_hnsw_index(self, vectors: Any, ef_construction: int = 200, m: int = 64) -> Optional[Any]:
        """Create HNSW index for better search performance."""
        try:
            import faiss

            print(f"🔄 Creating HNSW index with ef_construction={ef_construction}, M={m}")
            print(f"   Index will be trained on {vectors.shape[0]} vectors of dimension {vectors.shape[1]}")

            # Get vector dimension
            dim = vectors.shape[1]

            # Create HNSW index with Inner Product metric
            index = faiss.IndexHNSWFlat(dim, m)

            # Set construction parameters for better quality
            index.hnsw.efConstruction = ef_construction
            index.hnsw.efSearch = 128  # Higher search time for better recall

            # Add vectors to the index
            print("🔄 Adding vectors to HNSW index...")

            # Ensure vectors are in the correct format for FAISS (float32, 2D array)
            if hasattr(vectors, 'astype'):
                vectors = vectors.astype('float32')
            if len(vectors.shape) == 1:
                vectors = vectors.reshape(1, -1)

            # Use proper FAISS add method
            index.add(vectors)
            print(f"✅ Successfully added {vectors.shape[0]} vectors to HNSW index")

            return index

        except ImportError:
            print("⚠️  FAISS not available for HNSW index creation")
            return self._create_flat_ip_index(vectors)
        except Exception as e:
            print(f"⚠️  Failed to create HNSW index: {e}")
            return self._create_flat_ip_index(vectors)

    def _create_flat_ip_index(self, vectors: Any) -> Optional[Any]:
        """Create standard Flat IP index as fallback."""
        try:
            import faiss

            print("🔄 Creating Flat IP index...")
            dim = vectors.shape[1]
            index = faiss.IndexFlatIP(dim)

            # Ensure vectors are in correct format (float32, 2D)
            if hasattr(vectors, 'astype'):
                vectors = vectors.astype('float32')
            if len(vectors.shape) == 1:
                vectors = vectors.reshape(1, -1)

            # Use proper FAISS add method
            index.add(vectors)
            print(f"✅ Flat IP index created: {index.ntotal if hasattr(index, 'ntotal') else 'N/A'} vectors indexed")
            return index

        except Exception as e:
            print(f"❌ Failed to create FAISS index: {e}")
            return None

    def is_available(self) -> bool:
        """Check if vector index is available and ready."""
        return self._initialized and self.faiss_index is not None

    def get_index_info(self) -> Dict[str, Any]:
        """Get information about the loaded index."""
        if not self.faiss_index:
            return {'available': False}

        return {
            'available': True,
            'index_path': self._index_path,
            'vectors_path': self._vectors_path,
            'vector_count': self.faiss_index.ntotal if hasattr(self.faiss_index, 'ntotal') else 0,
            'vector_dimension': self.vectors.shape[1] if self.vectors is not None else 0,
            'rowmap_size': len(self.rowmap),
            'index_type': type(self.faiss_index).__name__
        }