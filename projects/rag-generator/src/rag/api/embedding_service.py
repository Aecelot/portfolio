"""
EmbeddingService - Focused component for embedding model management.

Handles embedding model loading, caching, and query encoding operations.
Separated from monolithic RetrievalService for better maintainability.
"""

from typing import List, Optional, Dict, Any
import time
import re


class EmbeddingService:
    """
    Manages embedding model lifecycle and query encoding operations.

    Responsibilities:
    - Model loading and caching
    - Query encoding and batch processing
    - Model warm-up and validation
    - Error handling for embedding operations
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize embedding service with configuration."""
        self.config = config
        self.model = None
        self.model_name = None
        self._initialized = False

    def initialize(self) -> bool:
        """Initialize the embedding model."""
        try:
            # Extract model configuration
            model_name = self._get_model_name()
            if not model_name:
                print("⚠️  No embedding model configured")
                return False

            print(f"🔄 Loading embedding model: {model_name}")

            # Import here to avoid issues if dependencies aren't available
            from sentence_transformers import SentenceTransformer

            # Initialize and cache the model
            self.model = SentenceTransformer(model_name)
            self.model_name = model_name

            # Warm up the model with a test encoding
            print("🔄 Warming up embedding model...")
            _ = self.model.encode(["test"], normalize_embeddings=True, convert_to_numpy=True)
            print("✅ Embedding model loaded, cached, and warmed up")

            self._initialized = True
            return True

        except ImportError as e:
            print(f"⚠️  Warning: Could not import SentenceTransformer: {e}")
            print("ℹ️  Embedding generation will be disabled")
            self.model = None
            return False
        except Exception as e:
            print(f"⚠️  Warning: Failed to initialize embedding model: {e}")
            print("ℹ️  Continuing without embedding model")
            self.model = None
            return False

    def _get_model_name(self) -> str:
        """Extract model name from configuration."""
        # Helper to extract text from XML-parsed dicts
        def _extract_text(val, default=None):
            if isinstance(val, dict):
                return val.get('value', default)
            return val if val is not None else default

        # Prefer vectorization.embedding_model, fallback to embedding.model
        model_name = None
        vectorization = self.config.get('vectorization', {})
        if isinstance(vectorization, dict) and 'embedding_model' in vectorization:
            model_name = _extract_text(vectorization.get('embedding_model'))

        if not model_name:
            emb_cfg = self.config.get('embedding', {})
            model_name = _extract_text(emb_cfg.get('model'), 'BAAI/bge-base-en')

        if not isinstance(model_name, str) or not model_name.strip():
            model_name = 'BAAI/bge-base-en'

        return model_name

    def encode_query(self, query: str) -> Optional[Any]:
        """Encode a single query into embedding vector."""
        if not self._initialized or self.model is None:
            return None

        try:
            return self.model.encode([query], normalize_embeddings=True, convert_to_numpy=True)
        except Exception as e:
            print(f"⚠️  Query encoding failed: {e}")
            return None

    def encode_queries_batch(self, queries: List[str], batch_size: int = 32) -> Optional[Any]:
        """Encode multiple queries in batch for improved throughput."""
        if not self._initialized or self.model is None or not queries:
            return None

        try:
            print(f"🔄 Batch encoding {len(queries)} queries with batch_size={batch_size}")

            # Use sentence-transformers batch encoding with normalization
            embeddings = self.model.encode(
                queries,
                batch_size=batch_size,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False
            )

            print(f"✅ Batch encoding complete: {embeddings.shape}")
            return embeddings

        except Exception as e:
            print(f"⚠️  Batch encoding failed: {e}")
            print("ℹ️  Falling back to individual encoding")

            # Fallback to individual encoding
            try:
                embeddings = []
                for query in queries:
                    embedding = self.model.encode(
                        [query],
                        normalize_embeddings=True,
                        convert_to_numpy=True
                    )
                    embeddings.append(embedding[0])

                return embeddings
            except Exception as e2:
                print(f"❌ Individual encoding also failed: {e2}")
                return None

    def is_available(self) -> bool:
        """Check if embedding model is available and ready."""
        return self._initialized and self.model is not None

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        if not self.model:
            return {'available': False}

        return {
            'available': True,
            'model_name': self.model_name,
            'model_type': type(self.model).__name__,
            'initialized': self._initialized
        }