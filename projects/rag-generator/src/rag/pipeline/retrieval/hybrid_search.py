#!/usr/bin/env python3
"""
Hybrid search implementation with dense + sparse retrieval.

Combines FAISS HNSW dense search + BM25 sparse search with RRF fusion,
MMR diversity selection, and BGE-Reranker-v2-M3 integration.
"""

import time
import heapq
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict
from dataclasses import dataclass

import numpy as np
import torch
from .router import CollectionRouter, RoutingResult
from ..index.faiss_hnsw import HybridFAISSIndex, SearchResult


@dataclass
class CandidateResult:
    """Candidate result from retrieval stage."""
    chunk_id: str
    doc_id: str
    score: float
    stage: str  # 'dense', 'sparse', 'rrf', 'mmr'
    vector_score: Optional[float] = None
    bm25_score: Optional[float] = None
    metadata: Optional[Dict] = None
    rank: int = 0


@dataclass
class RetrievalResult:
    """Final result of hybrid retrieval pipeline."""
    query: str
    primary_collection: str
    total_candidates: int
    final_results: int
    processing_time: float
    stages_timing: Dict[str, float]
    results: List[CandidateResult]
    routing_info: Optional[RoutingResult] = None


class HybridSearchPipeline:
    """
    Advanced hybrid retrieval pipeline for Arctic-Embed-L.

    Pipeline stages:
    1. Query routing and collection selection
    2. Dense retrieval (FAISS HNSW, k=150)
    3. Sparse retrieval (BM25, k=150)
    4. RRF fusion for score combination
    5. MMR diversity selection (top-60)
    6. Cross-encoder reranking (top-12)
    """

    def __init__(self, index_path: str = "store/faiss_hybrid.index",
                 reranker_model: str = "BAAI/bge-reranker-v2-m3"):
        """Initialize hybrid search pipeline."""
        self.index_path = index_path
        self.reranker_model = reranker_model

        # Load components
        self.faiss_index = HybridFAISSIndex(index_path)
        self.router = CollectionRouter()

        # Pipeline parameters
        self.k_dense = 150
        self.k_sparse = 150
        self.rrf_k = 60  # RRF parameter
        self.mmr_topk = 60
        self.mmr_lambda = 0.5  # Diversity vs relevance trade-off
        self.rerank_topk = 12

        # Initialize reranker (lazy loading)
        self.reranker = None
        self.reranker_tokenizer = None

    def _load_reranker(self):
        """Lazy load reranker model."""
        if self.reranker is None:
            try:
                from transformers import AutoTokenizer, AutoModelForSequenceClassification

                print(f"Loading reranker: {self.reranker_model}")
                self.reranker_tokenizer = AutoTokenizer.from_pretrained(self.reranker_model)
                self.reranker = AutoModelForSequenceClassification.from_pretrained(self.reranker_model)
                self.reranker.eval()

                # Use GPU if available
                if torch.cuda.is_available():
                    self.reranker.cuda()

                print("✅ Reranker loaded successfully")

            except Exception as e:
                print(f"Warning: Could not load reranker: {e}")
                # Ensure both components are set to None on failure
                self.reranker = None
                self.reranker_tokenizer = None

    def search(self, query: str, collection_hint: Optional[str] = None,
               alpha: float = 0.5, include_reranking: bool = True) -> RetrievalResult:
        """Execute full hybrid retrieval pipeline."""
        start_time = time.time()
        stages_timing = {}

        # Stage 1: Query routing
        stage_start = time.time()
        routing_result = self.router.analyze_query(query)
        primary_collection = routing_result.primary_collection

        # Override with hint if provided
        if collection_hint and collection_hint != 'auto':
            primary_collection = collection_hint

        stages_timing['routing'] = time.time() - stage_start

        # Stage 2: Dense retrieval
        stage_start = time.time()
        query_embedding = self._get_query_embedding(query)
        dense_results = self.faiss_index.search(
            query, query_embedding, top_k=self.k_dense, alpha=alpha, include_sparse=False
        )
        stages_timing['dense'] = time.time() - stage_start

        # Stage 3: Sparse retrieval
        stage_start = time.time()
        sparse_results = []
        try:
            # Use FAISS index's BM25 for consistency
            bm25_results = self.faiss_index.bm25_index.search(query, self.k_sparse)
            for rank, (doc_id, score) in enumerate(bm25_results[:self.k_sparse]):
                sparse_results.append(SearchResult(
                    doc_id=doc_id.split('_')[0] if '_' in doc_id else '',
                    chunk_id=doc_id,
                    score=score,
                    rank=rank,
                    bm25_score=score
                ))
        except Exception as e:
            print(f"Warning: BM25 search failed: {e}")

        stages_timing['sparse'] = time.time() - stage_start

        # Stage 4: RRF fusion
        stage_start = time.time()
        rrf_results = self._reciprocal_rank_fusion(dense_results, sparse_results)
        stages_timing['rrf'] = time.time() - stage_start

        # Stage 5: MMR diversity
        stage_start = time.time()
        mmr_results = self._maximal_marginal_relevance(query, rrf_results)
        stages_timing['mmr'] = time.time() - stage_start

        # Stage 6: Cross-encoder reranking
        stage_start = time.time()
        final_results = []
        if include_reranking and self.reranker and len(mmr_results) > 0:
            final_results = self._rerank_with_cross_encoder(query, mmr_results[:self.rerank_topk])
        else:
            # Use MMR results without reranking
            final_results = mmr_results[:self.rerank_topk]

        stages_timing['reranking'] = time.time() - stage_start

        total_time = time.time() - start_time

        # Convert to CandidateResult objects
        candidate_results = []
        for i, result in enumerate(final_results):
            candidate = CandidateResult(
                chunk_id=result.chunk_id,
                doc_id=result.doc_id,
                score=result.score,
                stage='reranked' if i < len(final_results) else 'mmr',
                vector_score=result.vector_score,
                bm25_score=result.bm25_score,
                metadata=result.metadata,
                rank=i
            )
            candidate_results.append(candidate)

        return RetrievalResult(
            query=query,
            primary_collection=primary_collection,
            total_candidates=len(dense_results) + len(sparse_results),
            final_results=len(candidate_results),
            processing_time=total_time,
            stages_timing=stages_timing,
            results=candidate_results,
            routing_info=routing_result
        )

    def _get_query_embedding(self, query: str) -> np.ndarray:
        """Get query embedding using Arctic-Embed-L."""
        from ..embeddings.arctic_embed import ArcticEmbedder

        embedder = ArcticEmbedder()
        result = embedder.embed_text(query, prefix="query: ", use_cache=False)

        return result.vector

    def _reciprocal_rank_fusion(self, dense_results: List[SearchResult],
                               sparse_results: List[SearchResult]) -> List[SearchResult]:
        """Combine dense and sparse results using Reciprocal Rank Fusion."""
        # Create score maps for each chunk
        dense_scores = {r.chunk_id: (r.score, idx) for idx, r in enumerate(dense_results)}
        sparse_scores = {r.chunk_id: (r.bm25_score or 0, idx) for idx, r in enumerate(sparse_results)}

        # Get all unique chunks
        all_chunks = set(dense_scores.keys()) | set(sparse_scores.keys())

        rrf_scores = []

        for chunk_id in all_chunks:
            dense_score, dense_rank = dense_scores.get(chunk_id, (0, float('inf')))
            sparse_score, sparse_rank = sparse_scores.get(chunk_id, (0, float('inf')))

            # RRF formula: sum(1 / (k + r)) for each list where chunk appears
            rrf_score = 0.0

            if dense_rank < float('inf'):
                rrf_score += 1.0 / (self.rrf_k + dense_rank)

            if sparse_rank < float('inf'):
                rrf_score += 1.0 / (self.rrf_k + sparse_rank)

            rrf_scores.append({
                'chunk_id': chunk_id,
                'score': rrf_score,
                'dense_score': dense_score,
                'sparse_score': sparse_score,
                'dense_rank': dense_rank,
                'sparse_rank': sparse_rank
            })

        # Sort by RRF score
        rrf_scores.sort(key=lambda x: x['score'], reverse=True)

        # Convert back to SearchResult objects
        results = []
        for item in rrf_scores:
            # Find original result for metadata
            original_result = None
            for result in dense_results + sparse_results:
                if result.chunk_id == item['chunk_id']:
                    original_result = result
                    break

            if original_result:
                results.append(SearchResult(
                    doc_id=original_result.doc_id,
                    chunk_id=item['chunk_id'],
                    score=item['score'],
                    rank=len(results),
                    vector_score=item['dense_score'],
                    bm25_score=item['sparse_score'],
                    metadata=original_result.metadata
                ))

        return results

    def _maximal_marginal_relevance(self, query: str,
                                   candidates: List[SearchResult]) -> List[SearchResult]:
        """Apply MMR for diversity in top results."""
        if not candidates:
            return []

        # Embed query for relevance computation
        query_embedding = self._get_query_embedding(query)

        # Select top-k candidates for MMR
        top_candidates = candidates[:self.mmr_topk]

        selected = []
        remaining = top_candidates[:]

        # First iteration: select highest scoring result
        if remaining:
            best_idx = np.argmax([r.score for r in remaining])
            selected.append(remaining.pop(best_idx))

        # Subsequent iterations: balance relevance vs diversity
        while remaining and len(selected) < min(self.rerank_topk * 2, len(candidates)):
            best_score = -float('inf')
            best_idx = -1

            for i, candidate in enumerate(remaining):
                # Relevance score (using original RRF score)
                relevance = candidate.score

                # Diversity score (max similarity to already selected)
                diversity_scores = []
                for selected_item in selected:
                    # Use vector similarity if available
                    if (hasattr(candidate, 'vector_score') and candidate.vector_score and
                        hasattr(selected_item, 'vector_score') and selected_item.vector_score):
                        # Convert scores to similarity-like measure
                        sim_score = 1.0 / (1.0 + abs(candidate.vector_score - selected_item.vector_score))
                        diversity_scores.append(sim_score)

                # Max diversity (lower similarity = higher diversity)
                diversity = max(diversity_scores) if diversity_scores else 1.0

                # MMR score
                mmr_score = self.mmr_lambda * relevance - (1 - self.mmr_lambda) * diversity

                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = i

            if best_idx >= 0:
                selected.append(remaining.pop(best_idx))
            else:
                break

        return selected

    def _rerank_with_cross_encoder(self, query: str,
                                   candidates: List[SearchResult]) -> List[SearchResult]:
        """Rerank top candidates using cross-encoder."""
        if not candidates or not self.reranker or not self.reranker_tokenizer:
            return candidates

        self._load_reranker()

        # Double-check that both reranker and tokenizer are loaded
        if not self.reranker or not self.reranker_tokenizer:
            return candidates

        try:
            # Prepare query-chunk pairs for reranking
            pairs = [f"{query} [SEP] {getattr(c, 'metadata', {}).get('content', '')}" for c in candidates]

            # Tokenize
            encoded = self.reranker_tokenizer(
                pairs,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt"
            )

            # Move to device
            if self.reranker is not None and hasattr(self.reranker, 'device'):
                device = next(self.reranker.parameters()).device
                encoded = {k: v.to(device) for k, v in encoded.items()}
            elif self.reranker is not None and torch.cuda.is_available():
                encoded = {k: v.cuda() for k, v in encoded.items()}

            # Get reranking scores
            if self.reranker is not None:
                with torch.no_grad():
                    outputs = self.reranker(**encoded)
                    scores = outputs.logits.squeeze(-1).cpu().numpy()

                # Update candidate scores with reranking scores
                for i, candidate in enumerate(candidates):
                    candidate.score = float(scores[i])

                # Re-sort by reranking score
                candidates.sort(key=lambda x: x.score, reverse=True)

                # Update ranks
                for i, candidate in enumerate(candidates):
                    candidate.rank = i

        except Exception as e:
            print(f"Warning: Cross-encoder reranking failed: {e}")
            # Fall back to original scores

        return candidates

    def search_with_fallback(self, query: str, collection_hint: Optional[str] = None) -> RetrievalResult:
        """Search with fallback strategies if primary search fails."""
        try:
            # Try primary search
            return self.search(query, collection_hint)
        except Exception as e:
            print(f"Warning: Primary search failed: {e}")

            # Fallback: try global collection
            try:
                return self.search(query, 'global')
            except Exception as e2:
                print(f"Warning: Global search also failed: {e2}")

                # Final fallback: return empty result
                return RetrievalResult(
                    query=query,
                    primary_collection='global',
                    total_candidates=0,
                    final_results=0,
                    processing_time=0,
                    stages_timing={},
                    results=[]
                )

    def get_pipeline_stats(self) -> Dict:
        """Get pipeline performance statistics."""
        return {
            'faiss_index': self.faiss_index.get_stats() if hasattr(self.faiss_index, 'get_stats') else {},
            'reranker_loaded': self.reranker is not None,
            'parameters': {
                'k_dense': self.k_dense,
                'k_sparse': self.k_sparse,
                'rrf_k': self.rrf_k,
                'mmr_topk': self.mmr_topk,
                'mmr_lambda': self.mmr_lambda,
                'rerank_topk': self.rerank_topk
            }
        }


def main():
    """Test hybrid search pipeline."""
    print("🧪 Testing Hybrid Search Pipeline...")

    try:
        # Create test data for demonstration
        np.random.seed(42)
        n_docs = 100
        vector_dim = 1024

        # Generate test vectors
        vectors = np.random.randn(n_docs, vector_dim).astype(np.float32)
        vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)

        # Generate test documents
        documents = [
            f"Document {i}: This is about {'magic and spells' if i % 3 == 0 else 'noble houses' if i % 3 == 1 else 'fantasy creatures'} in Logres lore."
            for i in range(n_docs)
        ]
        chunk_ids = [f"chunk_{i:03d}" for i in range(n_docs)]

        # Build test index
        index = HybridFAISSIndex()
        index.build(vectors, chunk_ids, documents, index_type="flat")  # Use flat for testing

        # Test search pipeline
        pipeline = HybridSearchPipeline()
        pipeline.faiss_index = index

        test_query = "Tell me about magic and noble houses in Logres"
        result = pipeline.search(test_query, include_reranking=False)  # Skip reranking for demo

        print("✅ Search completed successfully!")
        print(f"Query: '{result.query}'")
        print(f"Collection: {result.primary_collection}")
        print(f"Total candidates: {result.total_candidates}")
        print(f"Final results: {result.final_results}")
        print(f"Processing time: {result.processing_time:.3f}s")

        print("\n📊 Stage timing:")
        for stage, timing in result.stages_timing.items():
            print(f"  {stage}: {timing:.3f}s")

        print("\n🎯 Top results:")
        for i, candidate in enumerate(result.results[:5]):
            print(f"  {i+1}. {candidate.chunk_id}: {candidate.score:.4f}")
            print(f"     Stage: {candidate.stage}, Vector: {candidate.vector_score:.4f}")

        print("\n🔍 Routing info:")
        if result.routing_info:
            print(f"  Confidence: {result.routing_info.confidence_score:.2f}")
            print(f"  Keywords: {result.routing_info.detected_keywords}")
            print(f"  Reasoning: {result.routing_info.reasoning}")

    except Exception as e:
        print(f"❌ Error testing pipeline: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()