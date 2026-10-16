#!/usr/bin/env python3
"""
BGE-Reranker-v2-M3 integration for Arctic-Embed-L RAG system.

High-performance cross-encoder reranking with batch processing and caching.
"""

import time
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from contextlib import contextmanager

import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


@dataclass
class RerankingResult:
    """Result of reranking operation."""
    query: str
    chunk_id: str
    original_score: float
    reranked_score: float
    rank: int
    processing_time: float
    cached: bool = False


@dataclass
class BatchRerankingResult:
    """Result of batch reranking operation."""
    query: str
    total_candidates: int
    processing_time: float
    results: List[RerankingResult]


class RerankingCache:
    """SQLite-based reranking cache for performance."""

    def __init__(self, cache_path: str = "store/reranking_cache.db"):
        """Initialize reranking cache."""
        self.cache_path = Path(cache_path)
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initialize cache database."""
        with sqlite3.connect(self.cache_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS rerankings (
                    query_hash TEXT,
                    chunk_id TEXT,
                    model_id TEXT,
                    original_score REAL,
                    reranked_score REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (query_hash, chunk_id, model_id)
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_rerankings_query
                ON rerankings(query_hash)
            """)

            conn.commit()

    def get(self, query_hash: str, chunk_id: str, model_id: str) -> Optional[float]:
        """Retrieve reranked score from cache."""
        try:
            with sqlite3.connect(self.cache_path) as conn:
                cursor = conn.execute("""
                    SELECT reranked_score FROM rerankings
                    WHERE query_hash = ? AND chunk_id = ? AND model_id = ?
                """, (query_hash, chunk_id, model_id))

                row = cursor.fetchone()
                return float(row[0]) if row else None
        except Exception:
            return None

    def put(self, query_hash: str, chunk_id: str, model_id: str,
            original_score: float, reranked_score: float):
        """Store reranking result in cache."""
        try:
            with sqlite3.connect(self.cache_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO rerankings
                    (query_hash, chunk_id, model_id, original_score, reranked_score, created_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (query_hash, chunk_id, model_id, original_score, reranked_score))
                conn.commit()
        except Exception:
            pass  # Cache failures shouldn't break reranking

    def get_stats(self) -> Dict:
        """Get cache statistics."""
        try:
            with sqlite3.connect(self.cache_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM rerankings")
                total_entries = cursor.fetchone()[0]

                return {
                    'total_entries': total_entries,
                    'cache_enabled': True
                }
        except Exception:
            return {'total_entries': 0, 'cache_enabled': False}


class BGERerankerV2M3:
    """
    BGE-Reranker-v2-M3 cross-encoder for query-chunk reranking.

    Features:
    - High-precision reranking with cross-encoder architecture
    - Batch processing for throughput
    - GPU acceleration with memory optimization
    - Query-chunk pair formatting
    - Built-in caching for performance
    """

    def __init__(self, model_id: str = "BAAI/bge-reranker-v2-m3",
                 cache_enabled: bool = True, cache_path: str = "store/reranking_cache.db",
                 precision: str = "fp16"):
        """Initialize BGE reranker."""
        self.model_id = model_id
        self.precision = precision
        self.cache_enabled = cache_enabled

        # Initialize cache if enabled
        self.cache = RerankingCache(cache_path) if cache_enabled else None

        # Model components (lazy loading)
        self.model = None
        self.tokenizer = None
        self.device = None

        # Performance parameters
        self.max_length = 512
        self.batch_size = 32

    def _initialize_model(self):
        """Initialize model and tokenizer."""
        if self.model is not None:
            return

        try:
            print(f"Loading BGE-Reranker-v2-M3: {self.model_id}")

            # Determine device and precision
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            if self.device.type == "cuda" and self.precision == "fp16":
                # Use FP16 for memory efficiency on GPU
                dtype = torch.float16
            else:
                dtype = torch.float32

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token

            # Load model
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_id,
                torch_dtype=dtype
            )

            # Move to device
            if self.device is not None and self.device.type == "cuda":
                self.model.cuda()

            self.model.eval()
            print("✅ BGE-Reranker-v2-M3 loaded successfully")

        except Exception as e:
            raise RuntimeError(f"Failed to load BGE-Reranker-v2-M3: {e}")

    @contextmanager
    def _get_inference_context(self):
        """Context manager for inference."""
        if self.device is not None and self.device.type == "cuda":
            with torch.no_grad(), torch.cuda.amp.autocast(enabled=self.precision == "fp16"):
                yield
        else:
            with torch.no_grad():
                yield

    def _compute_query_hash(self, query: str) -> str:
        """Compute hash for query caching."""
        import hashlib
        return hashlib.sha256(query.encode('utf-8')).hexdigest()[:16]

    def _prepare_query_chunk_pairs(self, query: str, chunks: List[Dict]) -> List[str]:
        """Prepare query-chunk pairs for reranking."""
        pairs = []

        for chunk in chunks:
            # Get chunk content
            chunk_content = chunk.get('content', chunk.get('text', ''))

            # Format as query-chunk pair
            pair = f"{query} [SEP] {chunk_content}"
            pairs.append(pair)

        return pairs

    def rerank_single(self, query: str, chunk_content: str,
                     original_score: float = 0.0) -> RerankingResult:
        """Rerank single query-chunk pair."""
        start_time = time.time()

        # Initialize model if needed
        self._initialize_model()

        # Ensure model and tokenizer are properly loaded
        if self.tokenizer is None or self.model is None:
            raise RuntimeError("Failed to initialize BGE reranker model or tokenizer")

        # Check cache if enabled
        chunk_id = chunk_content[:100] if len(chunk_content) > 100 else chunk_content
        if self.cache_enabled and self.cache:
            query_hash = self._compute_query_hash(query)
            cached_score = self.cache.get(query_hash, chunk_id, self.model_id)
            if cached_score is not None:
                return RerankingResult(
                    query=query,
                    chunk_id=chunk_id,
                    original_score=original_score,
                    reranked_score=cached_score,
                    rank=0,
                    processing_time=time.time() - start_time,
                    cached=True
                )

        # Prepare input pair
        pair = f"{query} [SEP] {chunk_content}"

        # Tokenize
        encoded = self.tokenizer(
            pair,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt"
        )

        # Move to device
        if self.device is not None:
            encoded = {k: v.to(self.device) for k, v in encoded.items()}

        # Get reranking score
        with self._get_inference_context():
            outputs = self.model(**encoded)
            reranked_score = float(outputs.logits.squeeze(-1).cpu().numpy()[0])

        # Cache result if enabled
        if self.cache_enabled and self.cache:
            query_hash = self._compute_query_hash(query)
            self.cache.put(query_hash, chunk_id, self.model_id,
                          original_score, reranked_score)

        return RerankingResult(
            query=query,
            chunk_id=chunk_content[:50],
            original_score=original_score,
            reranked_score=reranked_score,
            rank=0,
            processing_time=time.time() - start_time,
            cached=False
        )

    def rerank_batch(self, query: str, candidates: List[Dict],
                    original_scores: Optional[List[float]] = None) -> BatchRerankingResult:
        """Rerank batch of candidates for a query."""
        start_time = time.time()

        if not candidates:
            return BatchRerankingResult(
                query=query,
                total_candidates=0,
                processing_time=0,
                results=[]
            )

        # Initialize model if needed
        self._initialize_model()

        # Ensure model and tokenizer are properly loaded
        if self.tokenizer is None or self.model is None:
            raise RuntimeError("Failed to initialize BGE reranker model or tokenizer")

        # Use provided scores or defaults
        if original_scores is None:
            original_scores = [0.0] * len(candidates)

        # Prepare query-chunk pairs
        pairs = self._prepare_query_chunk_pairs(query, candidates)

        # Check cache for each candidate
        cached_results = []
        uncached_pairs = []
        uncached_indices = []
        uncached_original_scores = []

        if self.cache_enabled and self.cache:
            query_hash = self._compute_query_hash(query)

            for i, (pair, candidate, original_score) in enumerate(zip(pairs, candidates, original_scores)):
                chunk_id = candidate.get('chunk_id',
                          candidate.get('id',
                          candidate.get('content', str(i))[:200]))
                cached_score = self.cache.get(query_hash, chunk_id, self.model_id)

                if cached_score is not None:
                    cached_results.append(RerankingResult(
                        query=query,
                        chunk_id=chunk_id,
                        original_score=original_score,
                        reranked_score=cached_score,
                        rank=i,
                        processing_time=0,
                        cached=True
                    ))
                else:
                    uncached_pairs.append(pair)
                    uncached_indices.append(i)
                    uncached_original_scores.append(original_score)
        else:
            uncached_pairs = pairs
            uncached_indices = list(range(len(pairs)))
            uncached_original_scores = original_scores

        # Rerank uncached pairs in batches
        reranked_results: List[Optional[RerankingResult]] = [None] * len(candidates)

        if uncached_pairs:
            for i in range(0, len(uncached_pairs), self.batch_size):
                batch_pairs = uncached_pairs[i:i + self.batch_size]
                batch_indices = uncached_indices[i:i + self.batch_size]
                batch_original_scores = uncached_original_scores[i:i + self.batch_size]

                # Tokenize batch
                encoded = self.tokenizer(
                    batch_pairs,
                    padding=True,
                    truncation=True,
                    max_length=self.max_length,
                    return_tensors="pt"
                )

                # Move to device
                if self.device is not None:
                    encoded = {k: v.to(self.device) for k, v in encoded.items()}

                # Get reranking scores
                with self._get_inference_context():
                    outputs = self.model(**encoded)
                    batch_scores = outputs.logits.squeeze(-1).cpu().numpy()

                # Store results
                for j, (batch_idx, original_score) in enumerate(zip(batch_indices, batch_original_scores)):
                    global_idx = batch_idx
                    chunk_id = candidates[global_idx].get('chunk_id', candidates[global_idx].get('id', str(global_idx)))

                    reranked_results[global_idx] = RerankingResult(
                        query=query,
                        chunk_id=chunk_id,
                        original_score=original_score,
                        reranked_score=float(batch_scores[j]),
                        rank=global_idx,
                        processing_time=0,
                        cached=False
                    )

                    # Cache result
                    if self.cache_enabled and self.cache:
                        query_hash = self._compute_query_hash(query)
                        # Use the full chunk content as chunk_id for better consistency
                        full_chunk_id = candidates[global_idx].get('chunk_id',
                                        candidates[global_idx].get('id',
                                        candidates[global_idx].get('content', str(global_idx))[:200]))
                        self.cache.put(query_hash, full_chunk_id, self.model_id,
                                      original_score, float(batch_scores[j]))

        # Fill in cached results
        for cached_result in cached_results:
            idx = next(i for i, c in enumerate(candidates)
                      if c.get('chunk_id',
                             c.get('id',
                                   c.get('content', str(i))[:200])) == cached_result.chunk_id)
            reranked_results[idx] = cached_result

        # Sort by reranked score
        valid_results = [r for r in reranked_results if r is not None]
        valid_results.sort(key=lambda x: x.reranked_score, reverse=True)

        # Update ranks
        for i, result in enumerate(valid_results):
            result.rank = i

        total_time = time.time() - start_time

        return BatchRerankingResult(
            query=query,
            total_candidates=len(candidates),
            processing_time=total_time,
            results=valid_results
        )

    def rerank_topk(self, query: str, candidates: List[Dict],
                   top_k: int = 12) -> List[Dict]:
        """Rerank and return top-k candidates."""
        if not candidates:
            return []

        # Rerank all candidates
        reranking_result = self.rerank_batch(query, candidates)

        # Return top-k reranked results as dictionaries
        top_results = []
        for result in reranking_result.results[:top_k]:
            # Find original candidate
            for candidate in candidates:
                chunk_id = candidate.get('chunk_id',
                          candidate.get('id',
                          candidate.get('content', '')))
                if chunk_id == result.chunk_id:
                    # Create result with updated score
                    reranked_candidate = candidate.copy()
                    reranked_candidate['reranked_score'] = result.reranked_score
                    reranked_candidate['original_score'] = result.original_score
                    top_results.append(reranked_candidate)
                    break

        return top_results

    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        if self.cache:
            return self.cache.get_stats()
        return {'total_entries': 0, 'cache_enabled': False}


def main():
    """Test BGE reranker."""
    print("🧪 Testing BGE-Reranker-v2-M3...")

    try:
        reranker = BGERerankerV2M3()

        # Test single reranking
        query = "What are the magical properties of dragon scales?"
        chunk_content = "Dragon scales possess remarkable magical properties. They naturally absorb ambient mana and can store spells for later activation. Ancient dragons' scales are particularly potent, often used in powerful artifacts and protective wards."

        result = reranker.rerank_single(query, chunk_content, original_score=0.8)

        print("✅ Single reranking successful!")
        print(f"  Query: '{result.query[:50]}...'")
        print(f"  Chunk: '{result.chunk_id}'")
        print(f"  Original score: {result.original_score:.4f}")
        print(f"  Reranked score: {result.reranked_score:.4f}")
        print(f"  Processing time: {result.processing_time:.3f}s")
        print(f"  Cached: {result.cached}")

        # Test batch reranking
        candidates = [
            {
                'chunk_id': 'chunk_001',
                'content': 'Dragons are majestic creatures with powerful magical abilities.',
                'score': 0.8
            },
            {
                'chunk_id': 'chunk_002',
                'content': 'Dragon scales have been used in armor crafting for centuries.',
                'score': 0.7
            },
            {
                'chunk_id': 'chunk_003',
                'content': 'The economic value of dragon materials is extremely high.',
                'score': 0.6
            }
        ]

        batch_result = reranker.rerank_batch(query, candidates)

        print("✅ Batch reranking successful!")
        print(f"  Query: '{batch_result.query}'")
        print(f"  Total candidates: {batch_result.total_candidates}")
        print(f"  Processing time: {batch_result.processing_time:.3f}s")

        print("\n📊 Reranked results:")
        for i, result in enumerate(batch_result.results):
            print(f"  {i+1}. {result.chunk_id}: {result.reranked_score:.4f} "
                  f"(original: {result.original_score:.4f})")

        # Test cache functionality
        print("\n🧪 Testing cache functionality...")
        result2 = reranker.rerank_single(query, chunk_content, original_score=0.8)
        print(f"  Second reranking cached: {result2.cached}")
        print(f"  Processing time: {result2.processing_time:.3f}s")

        # Show cache stats
        stats = reranker.get_cache_stats()
        print("\n📊 Cache Statistics:")
        print(f"  Total entries: {stats['total_entries']}")
        print(f"  Cache enabled: {stats['cache_enabled']}")

    except Exception as e:
        print(f"❌ Error testing reranker: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()