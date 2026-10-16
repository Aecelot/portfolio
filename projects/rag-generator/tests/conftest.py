import os
import random
import numpy as np
import pytest

@pytest.fixture(autouse=True, scope="session")
def _seed_all():
    random.seed(1337)
    np.random.seed(1337)
    os.environ["PYTHONHASHSEED"] = "1337"

@pytest.fixture
def fake_sentence_transformer(monkeypatch):
    class DeterministicFakeModel:
        """Deterministic fake model for reliable testing."""

        def __init__(self, model_name_or_path: str = "test_model", **kwargs):
            self.model_name = model_name_or_path
            self.dimension = kwargs.get('dimension', 256)  # Match real model dimensions
            self.seed = kwargs.get('seed', 42)  # Deterministic seed

        def get_sentence_embedding_dimension(self) -> int:
            """Return consistent embedding dimension."""
            return self.dimension

        def encode(self, texts, batch_size: int = 64, normalize_embeddings: bool = True,
                  convert_to_numpy: bool = True, show_progress_bar: bool = False) -> Any:
            """
            Generate deterministic fake embeddings based on text content.

            This ensures that the same text always produces the same embedding,
            making tests deterministic and reliable.
            """
            import numpy as _np
            import hashlib

            if isinstance(texts, str):
                texts = [texts]

            vectors = []
            for text in texts:
                # Use text content hash for deterministic generation
                text_hash = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**31)

                # Create deterministic random number generator for this text
                rng = _np.random.default_rng(text_hash + self.seed)

                # Generate vector with proper dimensions
                vec = rng.standard_normal(self.dimension, dtype=_np.float32)

                # Normalize if requested (matches real model behavior)
                if normalize_embeddings:
                    norm = _np.linalg.norm(vec)
                    if norm > 0:
                        vec = vec / norm

                vectors.append(vec)

            # Convert to numpy array with proper shape
            result = _np.array(vectors, dtype=_np.float32)

            # Ensure we return the right shape for single text
            if len(texts) == 1 and len(result.shape) > 1:
                result = result[0]

            return result

    # Import sentence_transformers and patch it
    import sentence_transformers
    original_init = sentence_transformers.SentenceTransformer.__init__

    def patched_init(self, model_name_or_path, **kwargs):
        # Call original init but replace with our fake model
        original_init(self, model_name_or_path, **kwargs)
        # Store reference to our deterministic model
        self._fake_model = DeterministicFakeModel(model_name_or_path, **kwargs)

    def patched_encode(self, texts, **kwargs):
        return self._fake_model.encode(texts, **kwargs)

    def patched_get_dimension(self):
        return self._fake_model.get_sentence_embedding_dimension()

    # Apply patches
    sentence_transformers.SentenceTransformer.__init__ = patched_init
    sentence_transformers.SentenceTransformer.encode = patched_encode
    sentence_transformers.SentenceTransformer.get_sentence_embedding_dimension = patched_get_dimension

    # Store original methods for cleanup if needed
    import sentence_transformers
    monkeypatch.setattr(
        sentence_transformers.SentenceTransformer,
        '_original_init',
        original_init
    )

    return True

@pytest.fixture
def minimal_chunking_config():
    return {
        "chunking": {
            "token_target": 320,
            "token_min": 120,
            "token_max": 450,
            "overlap_pct": 0.15
        },
        "domains": {}
    }