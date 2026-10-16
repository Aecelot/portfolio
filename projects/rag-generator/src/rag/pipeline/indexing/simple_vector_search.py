#!/usr/bin/env python3
"""
Simple vector similarity search implementation as a fallback for FAISS.

This provides basic vector similarity search functionality using numpy
and scipy, which can be used when FAISS installation issues occur.
"""

import numpy as np
from typing import List, Tuple, Dict, Any, Optional
import json
import time
from pathlib import Path


class SimpleVectorSearch:
    """
    Simple vector similarity search using cosine similarity.

    This is a fallback implementation when FAISS is not available.
    """

    def __init__(self, vectors: np.ndarray, metadata: Optional[List[Dict]] = None):
        """
        Initialize the vector search.

        Args:
            vectors: Array of vectors to search in (n_vectors, n_dimensions)
            metadata: Optional metadata for each vector
        """
        self.vectors = vectors
        self.metadata = metadata or []

        # Normalize vectors for cosine similarity
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1  # Avoid division by zero
        self.normalized_vectors = vectors / norms

    def search(self, query_vector: np.ndarray, k: int = 5) -> List[Tuple[int, float, Dict]]:
        """
        Search for similar vectors.

        Args:
            query_vector: Query vector
            k: Number of results to return

        Returns:
            List of (index, similarity_score, metadata) tuples
        """
        # Normalize query vector
        query_norm = np.linalg.norm(query_vector)
        if query_norm == 0:
            query_norm = 1
        normalized_query = query_vector / query_norm

        # Compute cosine similarities
        similarities = np.dot(self.normalized_vectors, normalized_query)

        # Get top k results
        top_k_indices = np.argsort(similarities)[::-1][:k]
        top_k_similarities = similarities[top_k_indices]

        # Format results
        results = []
        for idx, sim in zip(top_k_indices, top_k_similarities):
            metadata = self.metadata[idx] if idx < len(self.metadata) else {}
            results.append((int(idx), float(sim), metadata))

        return results

    def save_index(self, filepath: str):
        """Save the search index to disk."""
        data = {
            'vectors': self.vectors.tolist(),
            'metadata': self.metadata,
            'normalized_vectors': self.normalized_vectors.tolist()
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    @classmethod
    def load_index(cls, filepath: str) -> 'SimpleVectorSearch':
        """Load a search index from disk."""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        vectors = np.array(data['vectors'])
        metadata = data.get('metadata', [])

        return cls(vectors, metadata)


def create_fallback_index(vectors_path: str = "store/vectors.npy",
                         metadata_path: str = "store/rowmap.json",
                         output_path: str = "store/simple_index.json") -> SimpleVectorSearch:
    """
    Create a simple vector search index as a fallback for FAISS.

    Args:
        vectors_path: Path to the vectors file
        metadata_path: Path to the metadata file
        output_path: Path to save the index

    Returns:
        SimpleVectorSearch instance
    """
    print("🔍 Loading vectors for simple search index...")

    # Load vectors
    vectors = np.load(vectors_path)
    print(f"✅ Loaded {vectors.shape[0]} vectors with {vectors.shape[1]} dimensions")

    # Load metadata
    metadata = []
    if Path(metadata_path).exists():
        with open(metadata_path, 'r', encoding='utf-8') as f:
            rowmap_data = json.load(f)
            metadata = rowmap_data.get('rowmap', [])

    # Create search index
    search_index = SimpleVectorSearch(vectors, metadata)

    # Save index
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    search_index.save_index(output_path)

    print(f"💾 Saved simple search index to {output_path}")

    return search_index


def test_simple_search():
    """Test the simple vector search implementation."""
    print("🧪 Testing Simple Vector Search")

    # Create some test data
    np.random.seed(42)
    test_vectors = np.random.random((100, 128)).astype(np.float32)

    # Create search index
    search_index = SimpleVectorSearch(test_vectors)

    # Test search
    query = np.random.random(128).astype(np.float32)
    results = search_index.search(query, k=5)

    print(f"✅ Search completed. Found {len(results)} results")
    print(f"Top result similarity: {results[0][1]:.4f}")

    return True


if __name__ == "__main__":
    test_simple_search()