#!/usr/bin/env python3
"""
FastAPI retrieval service for Lore RAG system.

Provides HTTP endpoints for semantic search with entity linking,
relationship graph boosting, and contract-compliant responses.

REFACTORED: Now uses focused service components for better maintainability.
"""

import json
import time
import hashlib
import uuid
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional, Union
from threading import Lock
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, status
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field, validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import configuration utilities
try:
    from ..config.xml_parser import ConfigParser
    from ..config.dependency_checker import DependencyChecker
except ImportError:
    print("Warning: Could not import config utilities")
    ConfigParser = None
    DependencyChecker = None

# Import focused service components
try:
    from .embedding_service import EmbeddingService
    from .vector_index_service import VectorIndexService
    from .metadata_service import MetadataService
    from .scoring_engine import ScoringEngine
    from .retrieval_pipeline import RetrievalPipeline
except ImportError:
    print("Warning: Could not import service components, using fallback")
    EmbeddingService = None
    VectorIndexService = None
    MetadataService = None
    ScoringEngine = None
    RetrievalPipeline = None


@dataclass
class EntityReference:
    """Standardized entity reference format used throughout the pipeline."""
    entity_id: str
    entity_name: str
    entity_type: str
    confidence: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format for JSON serialization."""
        return {
            'entity_id': self.entity_id,
            'entity_name': self.entity_name,
            'entity_type': self.entity_type,
            'confidence': self.confidence
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EntityReference':
        """Create EntityReference from dictionary."""
        return cls(
            entity_id=data.get('entity_id', ''),
            entity_name=data.get('entity_name', ''),
            entity_type=data.get('entity_type', 'unknown'),
            confidence=data.get('confidence', 1.0)
        )

    @classmethod
    def from_string(cls, entity_str: str) -> 'EntityReference':
        """Create EntityReference from string ID (legacy support)."""
        return cls(
            entity_id=entity_str,
            entity_name=entity_str.replace('_', ' ').title(),
            entity_type='unknown',
            confidence=1.0
        )


def normalize_entities(entities: List[Union[str, Dict, EntityReference]]) -> List[EntityReference]:
    """Normalize mixed entity formats to standardized EntityReference objects."""
    normalized = []
    for entity in entities:
        if isinstance(entity, EntityReference):
            normalized.append(entity)
        elif isinstance(entity, dict):
            normalized.append(EntityReference.from_dict(entity))
        elif isinstance(entity, str):
            normalized.append(EntityReference.from_string(entity))
    return normalized


def entities_to_strings(entities: List[EntityReference]) -> List[str]:
    """Convert EntityReference objects to string IDs for backward compatibility."""
    return [entity.entity_id for entity in entities]

# Import vectorization and indexing components (when available)
try:
    from ..pipeline.indexing.build_embeddings import EmbeddingBuilder
    from ..pipeline.indexing.build_faiss import FAISSBuilder
except ImportError as e:
    print(f"Warning: Could not import vectorization components: {e}")
    EmbeddingBuilder = None
    FAISSBuilder = None

# Import reranker component (when available)
try:
    from ..pipeline.retrieval.rerank_bge_m3 import BGERerankerV2M3
except ImportError as e:
    print(f"Warning: Could not import BGE reranker: {e}")
    BGERerankerV2M3 = None

# Import graph components for graph-first candidate selection
try:
    from ..core.graph.graph_store import GraphStore
    from ..pipeline.retrieval.graph_router import GraphRouter
except ImportError as e:
    print(f"Warning: Could not import graph components: {e}")
    GraphStore = None
    GraphRouter = None

# Global state (would be replaced with proper dependency injection)
app_state = {
    'initialized': False,
    'embedding_model': None,
    'faiss_index': None,
    'rowmap': {},
    'metadata': {},
    'alias_map': {},
    'entity_graph': {}
}

# Global metrics tracking
metrics_lock = Lock()
metrics = {
    'total_queries': 0,
    'total_errors': 0,
    'query_latencies': [],
    'cache_hits': 0,
    'cache_misses': 0,
    'start_time': time.time()
}

# Rate limiter setup - 10 requests per minute (as per security requirements)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["10 per minute"],
    storage_uri="memory://"
)


# Enhanced Pydantic Models for API with comprehensive validation
class RetrieveRequest(BaseModel):
    """Request model for retrieval endpoint with enhanced security validation."""
    query: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="Search query",
        pattern=r"^[\w\s\-\.,!?\(\)']+$",  # Only allow safe characters
        examples=["Tell me about Sir Ector"]
    )
    k: int = Field(
        5,
        ge=1,
        le=10,
        description="Number of results to return",
        examples=[5]
    )
    ann_candidates: int = Field(
        50,
        ge=10,
        le=200,
        description="ANN search candidates",
        examples=[50]
    )
    filters: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional filters",
        examples=[{"domain": "characters"}]
    )
    enable_rerank: bool = Field(
        True,
        description="Enable cross-encoder reranking",
        examples=[True]
    )
    enable_graph_boost: bool = Field(
        True,
        description="Enable graph proximity boosting",
        examples=[True]
    )
    include_entity_context: bool = Field(
        True,
        description="Include entity context block",
        examples=[True]
    )

    @validator('query')
    def validate_and_sanitize_query(cls, v):
        """Validate and sanitize the query string."""
        if not v or not v.strip():
            raise ValueError('Query cannot be empty')

        # Strip whitespace
        v = v.strip()

        # Basic XSS prevention - remove potential script tags
        v = v.replace('<script', '').replace('</script', '')
        v = v.replace('<', '').replace('>', '')

        # Remove potential SQL injection patterns
        dangerous_patterns = ['\'', '"', ';', '--', '/*', '*/', 'xp_', 'sp_', 'exec', 'union']
        for pattern in dangerous_patterns:
            if pattern in v.lower():
                raise ValueError(f'Query contains potentially dangerous pattern: {pattern}')

        return v

    @validator('filters')
    def validate_filters(cls, v):
        """Validate filter parameters."""
        if v is None:
            return v

        # Ensure filters dict is not too large
        if len(v) > 10:
            raise ValueError('Too many filter parameters')

        # Validate filter values are reasonable
        for key, value in v.items():
            if isinstance(value, str) and len(value) > 100:
                raise ValueError(f'Filter value for {key} is too long')
            elif isinstance(value, list) and len(value) > 20:
                raise ValueError(f'Filter list for {key} is too long')

        return v


class EntityContext(BaseModel):
    """Entity context information."""
    id: str
    name: str
    gloss: str


class ChunkMetadata(BaseModel):
    """Metadata for a retrieved chunk."""
    doc_id: str
    section_id: str
    title: str
    domain: str
    type: str
    entities: List[str]
    timeline: Optional[Dict[str, Any]]
    version: int
    canon_level: str
    updated_at: str


class RetrievalResult(BaseModel):
    """Single retrieval result."""
    rank: int
    text: str
    metadata: ChunkMetadata


class RetrieveResponse(BaseModel):
    """Response model for retrieval endpoint."""
    query: str
    entity_context: List[EntityContext]
    results: List[RetrievalResult]
    diagnostics: Optional[Dict[str, Any]]


class RetrievalService:
    """
    Core retrieval service - now orchestrates focused service components.

    REFACTORED: Uses focused service components for better maintainability
    while maintaining the same API interface for backward compatibility.
    """

    def __init__(self, config_path: str = "config/rag/rag.xml", index_path: Optional[str] = None, vectors_path: Optional[str] = None) -> None:
        """Initialize the retrieval service with focused components."""
        # Load configuration using new centralized parser
        if ConfigParser:
            try:
                config_data = ConfigParser.parse(config_path)
                self.config = config_data.get('parsed_config', {})
            except Exception as e:
                print(f"Warning: Failed to load config with new parser: {e}")
                self.config = {}
        else:
            print("Warning: ConfigParser not available, using empty config")
            self.config = {}

        # Initialize focused service components
        self.embedding_service = EmbeddingService(self.config) if EmbeddingService else None
        self.vector_index_service = VectorIndexService(self.config) if VectorIndexService else None
        self.metadata_service = MetadataService("storage/store/meta.jsonl") if MetadataService else None
        self.scoring_engine = ScoringEngine(self.config) if ScoringEngine else None
        self.retrieval_pipeline = RetrievalPipeline(self.config) if RetrievalPipeline else None

        # Legacy attributes for backward compatibility
        self.alias_map: Dict[str, List[str]] = {}
        self.entity_graph: Dict[str, Dict[str, str]] = {}

        # Direct initialization with paths (for testing)
        if index_path and vectors_path:
            self.index_path = index_path
            self.vectors_path = vectors_path

    def initialize(self) -> bool:
        """Initialize the retrieval service with focused components."""
        print("🚀 Initializing Retrieval Service (Refactored)...")

        try:
            # Load supporting data
            self.alias_map = self._load_alias_map()
            self.entity_graph = self._load_entity_graph()

            # Initialize focused service components
            success = True

            if self.embedding_service and not self.embedding_service.initialize():
                print("⚠️  Embedding service initialization failed")
                success = False

            if self.vector_index_service:
                index_path = getattr(self, 'index_path', None)
                vectors_path = getattr(self, 'vectors_path', None)
                if not self.vector_index_service.initialize(index_path, vectors_path):
                    print("⚠️  Vector index service initialization failed")
                    success = False

            if self.metadata_service and not self.metadata_service.initialize():
                print("⚠️  Metadata service initialization failed")
                success = False

            if self.scoring_engine:
                self.scoring_engine.initialize(
                    graph_store=getattr(self, 'graph_store', None),
                    alias_map=self.alias_map,
                    entity_graph=self.entity_graph
                )

            if self.retrieval_pipeline and not self.retrieval_pipeline.initialize():
                print("⚠️  Retrieval pipeline initialization failed")
                success = False

            if success:
                print("✅ Retrieval service initialized successfully")
            else:
                print("⚠️  Retrieval service initialized with some failures")

            return success

        except Exception as e:
            print(f"❌ Failed to initialize retrieval service: {e}")
            return False

    def _load_alias_map(self) -> Dict:
        """Load entity alias mappings."""
        try:
            with open("src/data/alias_map.json", 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load alias map: {e}")
            return {}

    def _load_entity_graph(self) -> Dict:
        """Load entity relationship graph."""
        # Simplified - in real implementation would parse XML
        try:
            # For now, return empty graph
            # TODO: Implement XML parsing from data/entities.xml
            return {}
        except Exception as e:
            print(f"Warning: Could not load entity graph: {e}")
            return {}

    def _extract_query_entities(self, query: str) -> List[str]:
        """Extract entity mentions from query text."""
        if not query:
            return []

        # Simple entity extraction based on capitalized words and known entities
        entities = []
        words = query.split()

        # Look for capitalized words that might be proper nouns
        for i, word in enumerate(words):
            if (word and len(word) > 2 and word[0].isupper() and
                word not in ['The', 'A', 'An', 'And', 'Or', 'But', 'In', 'On', 'At', 'To', 'For', 'Of', 'With']):

                # Check if it's part of a multi-word entity
                if i + 1 < len(words) and words[i + 1] and words[i + 1][0].isupper():
                    entity = f"{word} {words[i + 1]}"
                    entities.append(entity)
                else:
                    entities.append(word)

        # Also check for known entities from our lore
        known_entities = [
            'Sir Ector', 'House Pendragon', 'Camelot', 'Round Table',
            'Excalibur', 'Merlin', 'Dragons', 'Arthur'
        ]

        for entity in known_entities:
            if entity.lower() in query.lower():
                entities.append(entity)

        return list(set(entities))  # Remove duplicates

    def _build_entity_context(self, query_entities: List[str], results: List[Dict]) -> List[EntityReference]:
        """Build entity context from query entities and retrieval results."""
        if not query_entities or not results:
            return []

        entity_context = []

        # Create entity references from query entities
        for entity_name in query_entities:
            entity_ref = EntityReference(
                entity_id=entity_name.lower().replace(' ', '_'),
                entity_name=entity_name,
                entity_type='unknown',
                confidence=0.8
            )
            entity_context.append(entity_ref)

        # Also extract entities from results
        for result in results[:3]:  # Use top 3 results
            for entity in result.get('entities', []):
                if isinstance(entity, dict):
                    entity_name = entity.get('entity_name') or entity.get('name') or entity.get('entity_id')
                    if entity_name and entity_name not in [e.entity_name for e in entity_context]:
                        entity_ref = EntityReference(
                            entity_id=entity.get('entity_id', ''),
                            entity_name=entity_name,
                            entity_type=entity.get('entity_type', 'unknown'),
                            confidence=0.6
                        )
                        entity_context.append(entity_ref)

        return entity_context









    def retrieve(self, query_or_request, top_k: int = 5) -> List[Dict]:
        """
        Main retrieval method - delegates to focused pipeline.

        Args:
            query_or_request: Either a string query or RetrieveRequest object
            top_k: Number of results to return (if query_or_request is string)

        Returns:
            List of result dictionaries or RetrieveResponse object
        """
        # Use pipeline if available, otherwise fallback to simple retrieval
        if self.retrieval_pipeline and isinstance(query_or_request, str):
            return self.retrieval_pipeline.retrieve(query_or_request, top_k)
        elif isinstance(query_or_request, str):
            return self._retrieve_simple(query_or_request, top_k)
        else:
            return self._retrieve_full(query_or_request)

    def _retrieve_simple(self, query: str, top_k: int = 5) -> List[Dict]:
        """Simple retrieval interface for testing."""
        # Use pipeline if available
        if self.retrieval_pipeline:
            return self.retrieval_pipeline.retrieve(query, top_k)

        # Fallback for basic functionality
        return []

    def _retrieve_full(self, request: RetrieveRequest) -> List[Dict]:
        """Full API retrieval implementation."""
        # Use pipeline if available
        if self.retrieval_pipeline:
            return self.retrieval_pipeline.retrieve(request.query, request.k, request.filters)

        # Fallback for basic functionality
        return []

    def get_service_info(self) -> Dict[str, Any]:
        """Get information about all service components."""
        return {
            'retrieval_service': {
                'available': True,
                'config_loaded': bool(self.config)
            },
            'embedding_service': self.embedding_service.get_model_info() if self.embedding_service else {'available': False},
            'vector_index_service': self.vector_index_service.get_index_info() if self.vector_index_service else {'available': False},
            'metadata_service': self.metadata_service.get_service_info() if self.metadata_service else {'available': False},
            'retrieval_pipeline': self.retrieval_pipeline.get_pipeline_info() if self.retrieval_pipeline else {'available': False}
        }
    
    def _retrieve_simple(self, query: str, top_k: int = 5) -> List[Dict]:
        """Simple retrieval interface for testing."""
        try:
            # Generate query embedding if we have the infrastructure
            if hasattr(self, 'faiss_index') and self.faiss_index is not None:
                return self._search_with_faiss(query, top_k)
            else:
                # Fallback to mock search
                return self._mock_search_simple(query, top_k)
        except Exception as e:
            print(f"⚠️  Retrieval error: {e}")
            return []


    def _mock_search(self, query: str, k: int, format_type: str = 'full') -> List[Dict]:
        """
        Unified mock search implementation for both simple and full retrieval modes.
        
        Args:
            query: Search query string
            k: Number of results to return
            format_type: Output format - 'full' for complete metadata, 'simple' for basic format
        """
        mock_results = []
        
        # Generate mock results based on query content
        query_lower = query.lower()
        
        # Mock content paraphrased from the public-domain sample corpus (corpus/)
        if 'ector' in query_lower:
            entities = [EntityReference('character_sir_ector', 'Sir Ector', 'character', 0.95)]
            mock_results.append(self._create_mock_result(
                'Sir Ector raised the young Arthur in his own house as his son, without telling him who his father was.',
                0.95, entities, 'characters', 'character_sir_ector', format_type
            ))

        if 'pendragon' in query_lower or 'uther' in query_lower:
            entities = [EntityReference('character_uther', 'Uther Pendragon', 'character', 0.92)]
            mock_results.append(self._create_mock_result(
                'Uther Pendragon was the father of Arthur. Merlin kept the secret of the boy’s birth until the time was right.',
                0.92, entities, 'characters', 'character_uther', format_type
            ))

        if 'camelot' in query_lower or 'court' in query_lower:
            entities = [EntityReference('location_camelot', 'Camelot', 'location', 0.88)]
            mock_results.append(self._create_mock_result(
                'Camelot is the seat of King Arthur’s court, where the knights of the Round Table gather.',
                0.88, entities, 'locations', 'location_camelot', format_type
            ))

        if 'round table' in query_lower:
            entities = [EntityReference('object_round_table', 'Round Table', 'object', 0.90)]
            mock_results.append(self._create_mock_result(
                'The Round Table was given to Arthur on his marriage to Guinevere, and seated a fellowship of knights as equals.',
                0.90, entities, 'objects', 'object_round_table', format_type
            ))

        if 'merlin' in query_lower or 'magic' in query_lower or 'wizard' in query_lower:
            entities = [EntityReference('character_merlin', 'Merlin', 'character', 0.93)]
            mock_results.append(self._create_mock_result(
                'Merlin is the wizard who foretells the birth of Arthur and guides the young king.',
                0.93, entities, 'characters', 'character_merlin', format_type
            ))

        if 'excalibur' in query_lower or 'sword' in query_lower:
            entities = [EntityReference('item_excalibur', 'Excalibur', 'item', 0.94)]
            mock_results.append(self._create_mock_result(
                'Excalibur is the sword Arthur receives, and it marks him as the rightful king.',
                0.94, entities, 'items', 'item_excalibur', format_type
            ))

        # Add generic results if none matched
        if not mock_results:
            for i in range(min(k, 3)):
                mock_results.append(self._create_mock_result(
                    f'Generic content related to: {query}. This is placeholder content for testing purposes.',
                    0.7 - (i * 0.1), [], 'general', f'mock_result_{i}', format_type
                ))
        
        # Return only top_k results
        return mock_results[:k]
    
    def _create_mock_result(self, content: str, similarity: float, entities: List[EntityReference],
                           domain: str, section_id: str, format_type: str) -> Dict:
        """Create a mock result in the specified format."""
        if format_type == 'simple':
            return {
                'content': content,
                'similarity': similarity,
                'entities': [entity.to_dict() for entity in entities]
            }
        else:
            # Full format for retrieval pipeline
            return {
                'section_id': section_id,
                'similarity': similarity,
                'text': content,
                'doc_id': f'mock_doc_{section_id}',
                'title': f'Mock Content: {section_id}',
                'domain': domain,
                'type': 'mock',
                'entities': entities_to_strings(entities),  # Convert to strings for compatibility
                'canon_level': 'primary',
                'version': 1,
                'timeline': None,
                'updated_at': '2025-01-01T00:00:00',
                'row': 0
            }

    def _retrieve_full(self, request: RetrieveRequest) -> List[Dict]:
        """Full API retrieval implementation using focused service components."""
        # Use pipeline if available
        if self.retrieval_pipeline:
            return self.retrieval_pipeline.retrieve(request.query, request.k, request.filters)

        # Fallback for basic functionality
        return []

    def _mock_search_simple(self, query: str, top_k: int) -> List[Dict]:
        """Simple mock search for testing."""
        # Basic mock results for testing
        return [
            {
                'content': f'Mock content for: {query}',
                'similarity': 0.9,
                'entities': []
            }
        ][:top_k]

    def _apply_filters(self, candidates: List[Dict], filters: Dict) -> List[Dict]:
        """Apply runtime filters to candidates."""
        return self._apply_filters_with_routing(candidates, filters, None)

    def _apply_filters_with_routing(self, candidates: List[Dict], filters: Dict, routing_info=None) -> List[Dict]:
        """Apply runtime filters to candidates with optional graph routing information."""
        filtered = candidates

        # Apply canon_level filter
        canon_filter = filters.get('canon_level', 'primary')
        filtered = [c for c in filtered if c.get('canon_level') == canon_filter]

        # Apply domain filter
        domain_filter = filters.get('domain_in')
        if domain_filter:
            filtered = [c for c in filtered if c.get('domain') in domain_filter]

        # Apply graph routing filters if available
        if routing_info and hasattr(routing_info, 'graph_pinned_collections'):
            graph_collections = routing_info.graph_pinned_collections
            if graph_collections:
                # Boost candidates from graph-pinned collections
                boosted_candidates = []
                other_candidates = []
                
                for candidate in filtered:
                    candidate_domain = candidate.get('domain', '')
                    if candidate_domain in graph_collections:
                        # Add collection boost score
                        candidate['collection_boost'] = 0.1
                        boosted_candidates.append(candidate)
                    else:
                        candidate['collection_boost'] = 0.0
                        other_candidates.append(candidate)
                
                # Return boosted candidates first, then others
                filtered = boosted_candidates + other_candidates
                print(f"🧠 Collection filtering: {len(boosted_candidates)} boosted from {graph_collections}")

        return filtered


class SmartQueryCache:
    """Smart query cache with TTL and size management."""

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.cache: Dict = {}
        self.access_times: Dict = {}

    def get(self, query: str, top_k: int, filters: Optional[Dict] = None) -> Optional[List[Dict]]:
        """Get cached results if available and not expired."""
        cache_key = self._make_key(query, top_k, filters)

        if cache_key in self.cache:
            # Check TTL
            if time.time() - self.access_times[cache_key] < self.ttl_seconds:
                return self.cache[cache_key]
            else:
                # Expired, remove
                del self.cache[cache_key]
                del self.access_times[cache_key]

        return None

    def put(self, query: str, top_k: int, filters: Optional[Dict], results: List[Dict]) -> None:
        """Cache results with size management."""
        cache_key = self._make_key(query, top_k, filters)

        # Remove oldest entry if at max size
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.access_times.items(), key=lambda x: x[1])
            del self.cache[oldest_key[0]]
            del self.access_times[oldest_key[0]]

        self.cache[cache_key] = results
        self.access_times[cache_key] = time.time()

    def _make_key(self, query: str, top_k: int, filters: Optional[Dict]) -> str:
        """Create cache key from query parameters."""
        key_parts = [query, str(top_k)]
        if filters:
            key_parts.append(str(sorted(filters.items())))
        return "|".join(key_parts)

    @property
    def stats(self) -> Dict:
        """Get cache statistics."""
        return {
            'size': len(self.cache),
            'max_size': self.max_size,
            'hit_rate': 0.0  # Would need hit/miss tracking for accurate rate
        }


# Initialize service
retrieval_service = RetrievalService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application lifespan events."""
    global app_state

    # Startup
    if retrieval_service.initialize():
        app_state['initialized'] = True
        print("🎉 API server ready!")
    else:
        print("⚠️  API server started with limited functionality")

    yield

    # Shutdown (no specific shutdown logic needed)


# Create FastAPI app
app = FastAPI(
    title="Lore RAG API",
    description="Retrieval service for Logres fantasy lore",
    version="0.1.0",
    lifespan=lifespan
)

# Add rate limit exceeded handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    """Handle rate limit exceeded exceptions."""
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Rate limit exceeded: 10 requests per minute maximum"
    )


@app.post("/retrieve", response_model=RetrieveResponse)
@limiter.limit("10/minute")
async def retrieve_endpoint(request: RetrieveRequest) -> RetrieveResponse:
    """Main retrieval endpoint with request tracing and metrics."""
    # Generate request ID for tracing
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    print(f"📝 Request {request_id[:8]}: {request.query[:50]}...")
    
    if not app_state.get('initialized', False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not fully initialized"
        )

    try:
        # Get results from service
        results = retrieval_service._retrieve_full(request)

        processing_time = time.time() - start_time

        # Update global metrics
        global metrics, metrics_lock
        with metrics_lock:
            metrics['total_queries'] += 1
            metrics['query_latencies'].append(processing_time)
            # Keep only last 1000 latencies
            if len(metrics['query_latencies']) > 1000:
                metrics['query_latencies'] = metrics['query_latencies'][-1000:]

        print(f"✅ Request {request_id[:8]}: Completed in {processing_time:.3f}s")

        # Convert to RetrieveResponse format for API
        return RetrieveResponse(
            query=request.query,
            entity_context=[],  # TODO: Extract entity context from results
            results=[
                RetrievalResult(
                    rank=i+1,
                    text=result.get('content', ''),
                    metadata=ChunkMetadata(
                        doc_id=result.get('doc_id', ''),
                        section_id=result.get('section_id', ''),
                        title=result.get('title', ''),
                        domain=result.get('domain', ''),
                        type=result.get('type', ''),
                        entities=[
                            (
                                e.get('entity_name') or
                                e.get('entity_id') or
                                str(e)
                            ) if isinstance(e, dict) else str(e)
                            for e in (result.get('entities') or [])
                        ],
                        timeline=result.get('timeline'),
                        version=result.get('version', 1),
                        canon_level=result.get('canon_level', 'primary'),
                        updated_at=result.get('updated_at', '')
                    )
                )
                for i, result in enumerate(results[:request.k])
            ],
            diagnostics={
                'request_id': request_id,
                'results_returned': len(results),
                'processing_time': processing_time,
                'filters_applied': request.filters or {},
                'rate_limit_remaining': getattr(request, 'rate_limit_remaining', None)
            }
        )

    except Exception as e:
        # Update error metrics
        with metrics_lock:
            metrics['total_errors'] += 1

        print(f"❌ Request {request_id[:8]}: Failed - {e}")

        # Provide detailed error messages based on exception type
        if "validation" in str(e).lower() or "value" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Input validation failed: {str(e)}"
            )
        elif "rate limit" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {str(e)}"
            )
        else:
            # Generic server error without exposing internals
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An internal error occurred while processing your request"
            )
    
    except Exception as e:
        # Update error metrics
        with metrics_lock:
            metrics['total_errors'] += 1
        
        print(f"❌ Request {request_id[:8]}: Failed - {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retrieval failed: {str(e)}"
        )


@app.get("/health")
@limiter.limit("30/minute")  # Health checks can be more frequent
async def health_check(request):
    """Health check endpoint."""
    return {
        "status": "healthy",
        "initialized": app_state.get('initialized', False),
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
    }


@app.get("/stats")
async def get_stats():
    """Get service statistics with runtime performance monitoring."""
    # Use the new service info method that aggregates all component stats
    return retrieval_service.get_service_info()


@app.get("/metrics")
async def get_metrics():
    """
    Get performance metrics endpoint.
    
    Returns comprehensive system metrics including query performance,
    cache statistics, and error rates.
    """
    global metrics, metrics_lock
    
    with metrics_lock:
        uptime = time.time() - metrics['start_time']
        total_queries = metrics['total_queries']
        total_errors = metrics['total_errors']
        cache_hits = metrics['cache_hits']
        cache_misses = metrics['cache_misses']
        latencies = metrics['query_latencies']
        
        # Calculate statistics
        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        p50_latency = sorted(latencies)[len(latencies)//2] if latencies else 0
        p95_latency = sorted(latencies)[int(len(latencies)*0.95)] if latencies else 0
        p99_latency = sorted(latencies)[int(len(latencies)*0.99)] if latencies else 0
        
        total_cache_requests = cache_hits + cache_misses
        cache_hit_rate = cache_hits / total_cache_requests if total_cache_requests > 0 else 0
        error_rate = total_errors / total_queries if total_queries > 0 else 0
        qps = total_queries / uptime if uptime > 0 else 0
        
        return {
            "uptime_seconds": uptime,
            "total_queries": total_queries,
            "total_errors": total_errors,
            "queries_per_second": round(qps, 2),
            "error_rate": round(error_rate, 4),
            "latency": {
                "avg_ms": round(avg_latency * 1000, 2),
                "p50_ms": round(p50_latency * 1000, 2),
                "p95_ms": round(p95_latency * 1000, 2),
                "p99_ms": round(p99_latency * 1000, 2)
            },
            "cache": {
                "hits": cache_hits,
                "misses": cache_misses,
                "hit_rate": round(cache_hit_rate, 4)
            },
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S')
        }


def main():
    """Main entry point for running the API server."""
    import uvicorn

    print("🚀 Starting Lore RAG API Server")
    print("=" * 50)

    # Initialize service
    if not retrieval_service.initialize():
        print("❌ Failed to initialize service")
        return 1

    # Start server (using module path for uvicorn)
    uvicorn.run(
        "src.rag.api.retriever:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

    return 0




if __name__ == "__main__":
    exit(main())