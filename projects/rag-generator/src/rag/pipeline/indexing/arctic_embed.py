#!/usr/bin/env python3
"""
Arctic-Embed-L integration for Lore RAG system.

High-performance embedding with FP16 precision, batch processing,
and caching for incremental updates (CDC).
"""

import hashlib
import sqlite3
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass
from contextlib import contextmanager

import torch
import numpy as np
from transformers import AutoTokenizer, AutoModel


@dataclass
class EmbeddingResult:
    """Result of embedding operation."""
    text_hash: str
    vector: np.ndarray
    token_count: int
    processing_time: float
    cached: bool = False


@dataclass
class BatchEmbeddingResult:
    """Result of batch embedding operation."""
    total_texts: int
    total_tokens: int
    cache_hits: int
    cache_misses: int
    processing_time: float
    results: List[Optional[EmbeddingResult]]


class EmbeddingCache:
    """SQLite-based embedding cache for CDC support."""

    def __init__(self, cache_path: str = "store/embedding_cache.db"):
        """Initialize embedding cache."""
        self.cache_path = Path(cache_path)
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initialize cache database."""
        with sqlite3.connect(self.cache_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS embeddings (
                    text_hash TEXT PRIMARY KEY,
                    model_id TEXT NOT NULL,
                    vector BLOB NOT NULL,
                    token_count INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_stats (
                    model_id TEXT PRIMARY KEY,
                    total_embeddings INTEGER DEFAULT 0,
                    cache_size_mb REAL DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.commit()

    def get(self, text_hash: str, model_id: str) -> Optional[np.ndarray]:
        """Retrieve embedding from cache."""
        try:
            with sqlite3.connect(self.cache_path) as conn:
                conn.execute("UPDATE embeddings SET accessed_at = CURRENT_TIMESTAMP WHERE text_hash = ?", (text_hash,))

                cursor = conn.execute("""
                    SELECT vector FROM embeddings
                    WHERE text_hash = ? AND model_id = ?
                """, (text_hash, model_id))

                row = cursor.fetchone()
                if row:
                    vector_data = np.frombuffer(row[0], dtype=np.float16)
                    return vector_data.astype(np.float32)  # Convert back to float32 for compatibility
                return None
        except Exception as e:
            print(f"Cache read error: {e}")
            return None

    def put(self, text_hash: str, model_id: str, vector: np.ndarray, token_count: int):
        """Store embedding in cache."""
        try:
            vector_fp16 = vector.astype(np.float16).tobytes()

            with sqlite3.connect(self.cache_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO embeddings
                    (text_hash, model_id, vector, token_count, created_at, accessed_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (text_hash, model_id, vector_fp16, token_count))

                conn.commit()
        except Exception as e:
            print(f"Cache write error: {e}")

    def get_stats(self, model_id: str) -> Dict:
        """Get cache statistics."""
        try:
            with sqlite3.connect(self.cache_path) as conn:
                cursor = conn.execute("""
                    SELECT COUNT(*), SUM(LENGTH(vector)) / (1024.0 * 1024.0)
                    FROM embeddings WHERE model_id = ?
                """, (model_id,))

                count, size_mb = cursor.fetchone()
                return {
                    'total_embeddings': count or 0,
                    'cache_size_mb': size_mb or 0,
                    'model_id': model_id
                }
        except Exception as e:
            print(f"Cache stats error: {e}")
            return {'total_embeddings': 0, 'cache_size_mb': 0, 'model_id': model_id}


class ArcticEmbedder:
    """
    Arctic-Embed-L embedder with FP16 precision and batch processing.

    Features:
    - High-performance batch embedding (128-256 batch size)
    - FP16 precision for memory efficiency
    - Built-in caching for CDC support
    - Automatic tokenization with query/passage prefixes
    - GPU acceleration with fallback to CPU
    """

    def __init__(self, model_id: str = "Snowflake/snowflake-arctic-embed-l",
                 cache_enabled: bool = True, cache_path: str = "store/embedding_cache.db"):
        """Initialize Arctic embedder."""
        self.model_id = model_id
        self.cache_enabled = cache_enabled

        # Initialize cache if enabled
        self.cache = EmbeddingCache(cache_path) if cache_enabled else None

        # Model parameters
        self.max_length = 512
        self.batch_size = 128
        self.precision = torch.float16

        # Load model and tokenizer
        self.model = None
        self.tokenizer = None
        self.device = None
        self._initialize_model()

    def _initialize_model(self):
        """Initialize model, tokenizer, and device."""
        try:
            print(f"Loading Arctic-Embed-L model: {self.model_id}")

            # Determine device
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            print(f"Using device: {self.device}")

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token

            # Load model with appropriate precision
            if self.device.type == "cuda":
                # Use FP16 on GPU for memory efficiency
                self.model = AutoModel.from_pretrained(
                    self.model_id,
                    torch_dtype=self.precision,
                    device_map="auto" if torch.cuda.device_count() > 1 else None
                )
            else:
                # Use FP32 on CPU
                self.model = AutoModel.from_pretrained(self.model_id)

            self.model.eval()
            print("✅ Arctic-Embed-L model loaded successfully")

        except Exception as e:
            raise RuntimeError(f"Failed to load Arctic-Embed-L model: {e}")

    @contextmanager
    def _get_model_context(self):
        """Context manager for model operations."""
        if self.device is not None and self.device.type == "cuda":
            with torch.no_grad(), torch.cuda.amp.autocast(enabled=True):
                yield
        else:
            with torch.no_grad():
                yield

    def _compute_text_hash(self, text: str) -> str:
        """Compute deterministic hash for text content."""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def _tokenize_batch(self, texts: List[str], prefixes: Optional[List[str]] = None) -> Dict:
        """Tokenize batch of texts with optional prefixes."""
        if prefixes is None:
            # Default prefixes for query/passage
            prefixes = ["query: "] * len(texts)

        # Add prefixes to texts
        prefixed_texts = [prefix + text for prefix, text in zip(prefixes, texts)]

        # Tokenize
        if self.tokenizer is None:
            raise RuntimeError("Tokenizer not initialized")
        encoded = self.tokenizer(
            prefixed_texts,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt"
        )

        return {
            'input_ids': encoded['input_ids'].to(self.device),
            'attention_mask': encoded['attention_mask'].to(self.device)
        }

    def _extract_embeddings(self, outputs, pooling_strategy: str = "cls") -> np.ndarray:
        """Extract embeddings from model outputs."""
        if pooling_strategy == "cls":
            # Use CLS token embedding
            embeddings = outputs.last_hidden_state[:, 0, :]
        elif pooling_strategy == "mean":
            # Use mean pooling
            token_embeddings = outputs.last_hidden_state
            attention_mask = torch.ones_like(token_embeddings[:, :, 0])  # Simplified
            embeddings = (token_embeddings * attention_mask.unsqueeze(-1)).sum(dim=1) / attention_mask.sum(dim=1, keepdim=True)
        else:
            raise ValueError(f"Unknown pooling strategy: {pooling_strategy}")

        # Convert to numpy and normalize
        embeddings_np = embeddings.detach().cpu().numpy()
        embeddings_norm = embeddings_np / np.linalg.norm(embeddings_np, axis=1, keepdims=True)

        return embeddings_norm.astype(np.float32)

    def embed_text(self, text: str, prefix: str = "passage: ",
                   use_cache: bool = True) -> EmbeddingResult:
        """Embed single text with caching support."""
        start_time = time.time()

        # Compute text hash for caching
        text_hash = self._compute_text_hash(text)

        # Check cache if enabled
        if use_cache and self.cache:
            cached_vector = self.cache.get(text_hash, self.model_id)
            if cached_vector is not None:
                return EmbeddingResult(
                    text_hash=text_hash,
                    vector=cached_vector,
                    token_count=len(text.split()),  # Approximate
                    processing_time=time.time() - start_time,
                    cached=True
                )

        # Tokenize and embed
        tokens = self._tokenize_batch([text], [prefix])
        token_count = tokens['input_ids'].shape[1]

        with self._get_model_context():
            if self.model is None:
                raise RuntimeError("Model not initialized")
            outputs = self.model(**tokens)
            vector = self._extract_embeddings(outputs)[0]

        # Cache result if enabled
        if use_cache and self.cache:
            self.cache.put(text_hash, self.model_id, vector, token_count)

        return EmbeddingResult(
            text_hash=text_hash,
            vector=vector,
            token_count=token_count,
            processing_time=time.time() - start_time,
            cached=False
        )

    def embed_batch(self, texts: List[str], prefixes: Optional[List[str]] = None,
                    use_cache: bool = True) -> BatchEmbeddingResult:
        """Embed batch of texts with caching support."""
        start_time = time.time()

        if prefixes is None:
            # Default to passage prefix for all
            prefixes = ["passage: "] * len(texts)

        # Compute hashes for all texts
        text_hashes = [self._compute_text_hash(text) for text in texts]

        # Separate cached and uncached texts
        uncached_texts = []
        uncached_indices = []
        uncached_hashes = []
        cache_hits = 0

        results: List[Optional[EmbeddingResult]] = [None] * len(texts)

        if use_cache and self.cache:
            # Check cache for each text
            for i, (text, text_hash) in enumerate(zip(texts, text_hashes)):
                cached_vector = self.cache.get(text_hash, self.model_id)
                if cached_vector is not None:
                    results[i] = EmbeddingResult(
                        text_hash=text_hash,
                        vector=cached_vector,
                        token_count=len(text.split()),
                        processing_time=0,
                        cached=True
                    )
                    cache_hits += 1
                else:
                    uncached_texts.append(text)
                    uncached_indices.append(i)
                    uncached_hashes.append(text_hash)
        else:
            # No caching, embed all
            uncached_texts = texts
            uncached_indices = list(range(len(texts)))
            uncached_hashes = text_hashes

        # Embed uncached texts in batches
        cache_misses = 0
        total_tokens = 0

        if uncached_texts:
            for i in range(0, len(uncached_texts), self.batch_size):
                batch_texts = uncached_texts[i:i + self.batch_size]
                batch_prefixes = prefixes[i:i + self.batch_size] if prefixes else None

                # Tokenize batch
                tokens = self._tokenize_batch(batch_texts, batch_prefixes)
                total_tokens += tokens['input_ids'].shape[0] * tokens['input_ids'].shape[1]

                # Embed batch
                with self._get_model_context():
                    if self.model is None:
                        raise RuntimeError("Model not initialized")
                    outputs = self.model(**tokens)
                    batch_vectors = self._extract_embeddings(outputs)

                # Store results
                for j, (batch_idx, text_hash) in enumerate(zip(range(i, min(i + self.batch_size, len(uncached_texts))), uncached_hashes[i:i + self.batch_size])):
                    original_idx = uncached_indices[batch_idx]
                    vector = batch_vectors[j]

                    results[original_idx] = EmbeddingResult(
                        text_hash=text_hash,
                        vector=vector,
                        token_count=tokens['input_ids'][j].shape[0],
                        processing_time=0,  # Will be aggregated
                        cached=False
                    )

                    # Cache result
                    if use_cache and self.cache:
                        self.cache.put(text_hash, self.model_id, vector, tokens['input_ids'][j].shape[0])
                        cache_misses += 1

        processing_time = time.time() - start_time

        return BatchEmbeddingResult(
            total_texts=len(texts),
            total_tokens=total_tokens,
            cache_hits=cache_hits,
            cache_misses=cache_misses,
            processing_time=processing_time,
            results=results
        )

    def embed_queries(self, queries: List[str], use_cache: bool = False) -> np.ndarray:
        """Embed queries with query prefix (no caching for queries)."""
        batch_result = self.embed_batch(queries, ["query: "] * len(queries), use_cache)
        return np.array([result.vector for result in batch_result.results if result is not None])

    def embed_passages(self, passages: List[str], use_cache: bool = True) -> np.ndarray:
        """Embed passages with passage prefix (with caching)."""
        batch_result = self.embed_batch(passages, ["passage: "] * len(passages), use_cache)
        return np.array([result.vector for result in batch_result.results if result is not None])

    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        if self.cache:
            return self.cache.get_stats(self.model_id)
        return {'total_embeddings': 0, 'cache_size_mb': 0, 'model_id': self.model_id}

    def clear_cache(self):
        """Clear embedding cache."""
        if self.cache:
            try:
                with sqlite3.connect(self.cache.cache_path) as conn:
                    conn.execute("DELETE FROM embeddings WHERE model_id = ?", (self.model_id,))
                    conn.commit()
                print(f"Cleared cache for model: {self.model_id}")
            except Exception as e:
                print(f"Error clearing cache: {e}")


def main():
    """Test Arctic embedder."""
    print("🧪 Testing Arctic-Embed-L embedder...")

    try:
        embedder = ArcticEmbedder()

        # Test single embedding
        test_text = "The quick brown fox jumps over the lazy dog."
        result = embedder.embed_text(test_text)
        print("✅ Single embedding successful!")
        print(f"  Vector shape: {result.vector.shape}")
        print(f"  Token count: {result.token_count}")
        print(f"  Processing time: {result.processing_time:.3f}s")
        print(f"  Cached: {result.cached}")

        # Test batch embedding
        test_texts = [
            "First test passage for embedding.",
            "Second test passage for embedding.",
            "Third test passage for embedding."
        ]

        batch_result = embedder.embed_batch(test_texts)
        print("✅ Batch embedding successful!")
        print(f"  Total texts: {batch_result.total_texts}")
        print(f"  Total tokens: {batch_result.total_tokens}")
        print(f"  Cache hits: {batch_result.cache_hits}")
        print(f"  Cache misses: {batch_result.cache_misses}")
        print(f"  Processing time: {batch_result.processing_time:.3f}s")

        # Test cache functionality
        print("\n🧪 Testing cache functionality...")
        result2 = embedder.embed_text(test_text)
        print(f"  Second embedding cached: {result2.cached}")
        print(f"  Processing time: {result2.processing_time:.3f}s")

        # Show cache stats
        stats = embedder.get_cache_stats()
        print("\n📊 Cache Statistics:")
        print(f"  Total embeddings: {stats['total_embeddings']}")
        print(f"  Cache size: {stats['cache_size_mb']:.2f} MB")

    except Exception as e:
        print(f"❌ Error testing embedder: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()