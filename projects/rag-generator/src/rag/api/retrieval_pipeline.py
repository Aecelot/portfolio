"""
RetrievalPipeline - Orchestrates the complete retrieval process.

Coordinates EmbeddingService, VectorIndexService, MetadataService, and ScoringEngine
to implement the full retrieval pipeline according to the contract.
Separated from monolithic RetrievalService for better maintainability.
"""

from typing import List, Dict, Any, Optional
import time
from .retriever import SmartQueryCache, EntityReference
from .embedding_service import EmbeddingService
from .vector_index_service import VectorIndexService
from .metadata_service import MetadataService
from .scoring_engine import ScoringEngine


class RetrievalPipeline:
    """
    Orchestrates the complete retrieval pipeline.

    Responsibilities:
    - Coordinate service components
    - Implement full retrieval workflow
    - Manage caching and performance optimization
    - Handle errors and fallbacks gracefully
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize retrieval pipeline with configuration."""
        self.config = config

        # Initialize service components
        self.embedding_service = EmbeddingService(config)
        self.vector_index_service = VectorIndexService(config)
        self.metadata_service = MetadataService("storage/store/meta.jsonl")
        self.scoring_engine = ScoringEngine(config)

        # Smart query cache for improved performance
        self._query_cache = SmartQueryCache(max_size=512, ttl_seconds=300)

        self._initialized = False

    def initialize(self) -> bool:
        """Initialize all pipeline components."""
        try:
            print("🚀 Initializing Retrieval Pipeline...")

            # Initialize metadata service first (needed for other services)
            if not self.metadata_service.initialize():
                print("⚠️  Metadata service initialization failed")

            # Initialize vector index service
            if not self.vector_index_service.initialize():
                print("⚠️  Vector index service initialization failed")

            # Initialize embedding service
            if not self.embedding_service.initialize():
                print("⚠️  Embedding service initialization failed")

            # Initialize scoring engine with supporting data
            self.scoring_engine.initialize(
                graph_store=getattr(self, 'graph_store', None),
                alias_map=getattr(self, 'alias_map', {}),
                entity_graph=getattr(self, 'entity_graph', {})
            )

            self._initialized = True
            print("✅ Retrieval pipeline initialized successfully")
            return True

        except Exception as e:
            print(f"❌ Failed to initialize retrieval pipeline: {e}")
            return False

    def retrieve(self, query: str, top_k: int = 5, filters: Optional[Dict] = None) -> List[Dict]:
        """Execute full retrieval pipeline."""
        if not self._initialized:
            print("⚠️  Pipeline not initialized")
            return []

        start_time = time.time()

        try:
            # Check cache first
            cached_results = self._get_cached_results(query, top_k, filters)
            if cached_results is not None:
                print(f"💾 Cache hit for query: {query[:50]}...")
                return cached_results

            print(f"🔍 Processing query: {query[:50]}...")

            # Step 1: Generate query embedding
            query_vector = self.embedding_service.encode_query(query)
            if query_vector is None:
                print("⚠️  Failed to generate query embedding")
                return []

            # Step 2: Perform vector search
            distances, indices = self.vector_index_service.search(query_vector, top_k * 3)
            if not indices.size or indices[0] == -1:
                print("⚠️  No results found in vector search")
                return []

            # Step 3: Resolve section IDs and get metadata
            section_ids = self.vector_index_service.resolve_section_ids(indices)
            candidates = []

            for score, section_id in zip(distances, section_ids):
                if section_id and section_id != 'None':
                    metadata = self.metadata_service.get_chunk(section_id)
                    if metadata:
                        candidates.append({
                            'section_id': section_id,
                            'similarity': float(score),
                            'text': metadata.get('text', ''),
                            'doc_id': metadata.get('doc_id', ''),
                            'title': metadata.get('title', ''),
                            'domain': metadata.get('domain', ''),
                            'type': metadata.get('type', ''),
                            'entities': metadata.get('entities', []),
                            'canon_level': metadata.get('canon_level', 'primary'),
                            'version': metadata.get('version', 1),
                            'timeline': metadata.get('timeline'),
                            'updated_at': metadata.get('updated_at', ''),
                            'row': indices[list(section_ids).index(section_id)] if section_id in section_ids else 0
                        })

            # Step 4: Apply filtering
            if filters:
                candidates = self._apply_filters(candidates, filters)

            # Step 5: Apply scoring and ranking
            scored_candidates = self.scoring_engine.score_candidates(query, candidates)

            # Step 6: Limit to top_k results
            results = scored_candidates[:top_k]

            # Cache the results
            self._cache_results(query, top_k, results, filters)

            processing_time = time.time() - start_time
            print(f"✅ Query processed in {processing_time:.".3f": {len(results)} results")

            return results

        except Exception as e:
            print(f"❌ Retrieval pipeline failed: {e}")
            return []

    def _get_cached_results(self, query: str, top_k: int, filters: Optional[Dict] = None) -> Optional[List[Dict]]:
        """Retrieve cached query results if available."""
        return self._query_cache.get(query, top_k, filters)

    def _cache_results(self, query: str, top_k: int, results: List[Dict], filters: Optional[Dict] = None) -> None:
        """Cache query results with smart eviction."""
        self._query_cache.put(query, top_k, filters, results)

    def _apply_filters(self, candidates: List[Dict], filters: Dict) -> List[Dict]:
        """Apply runtime filters to candidates."""
        filtered = candidates

        # Apply canon_level filter
        canon_filter = filters.get('canon_level', 'primary')
        filtered = [c for c in filtered if c.get('canon_level') == canon_filter]

        # Apply domain filter
        domain_filter = filters.get('domain_in')
        if domain_filter:
            filtered = [c for c in filtered if c.get('domain') in domain_filter]

        return filtered

    def is_available(self) -> bool:
        """Check if pipeline is available and ready."""
        return (self._initialized and
                self.embedding_service.is_available() and
                self.vector_index_service.is_available() and
                self.metadata_service.is_available())

    def get_pipeline_info(self) -> Dict[str, Any]:
        """Get information about pipeline components."""
        return {
            'initialized': self._initialized,
            'embedding_service': self.embedding_service.get_model_info(),
            'vector_index_service': self.vector_index_service.get_index_info(),
            'metadata_service': self.metadata_service.get_service_info(),
            'cache_stats': self._query_cache.stats
        }

    def invalidate_caches(self) -> None:
        """Invalidate all caches in the pipeline."""
        self._query_cache = SmartQueryCache(max_size=512, ttl_seconds=300)
        self.metadata_service.invalidate_index()
        print("🔄 All pipeline caches invalidated")