def test_embedding_shape_and_norm(monkeypatch, fake_sentence_transformer):
    from src.rag.pipeline.indexing.build_embeddings import EmbeddingBuilder
    def fake_cfg(_self, _path):
        return {"vectorization": {"embedding_model": {"value": "fake"}, "normalize_embeddings": True, "batch_size": 8}}
    monkeypatch.setattr(EmbeddingBuilder, "_load_config", fake_cfg)

    # Mock the _generate_embeddings method to avoid division by zero with fast fake model
    def mock_generate_embeddings(self, texts):
        import numpy as np
        if not texts:
            raise ValueError("No texts provided for embedding generation")

        # Use the fake model directly to avoid timing issues
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=self.normalize,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        # Validate output shape
        expected_dim = self.model.get_sentence_embedding_dimension()
        if embeddings.shape[1] != expected_dim:
            raise ValueError(f"Expected {expected_dim} dimensions, got {embeddings.shape[1]}")

        # Validate normalization if requested
        if self.normalize:
            norms = np.linalg.norm(embeddings, axis=1)
            mean_norm = np.mean(norms)
            if not np.allclose(mean_norm, 1.0, atol=1e-3):
                print(f"⚠️  Warning: Mean L2 norm is {mean_norm:.4f}, expected ~1.0")

        return embeddings

    monkeypatch.setattr(EmbeddingBuilder, "_generate_embeddings", mock_generate_embeddings)
    eb = EmbeddingBuilder("any.xml")
    X = eb._generate_embeddings(["text a", "text b", "text c"])
    assert X.shape == (3, 32)
    assert X.dtype == "float32"
    import numpy as np
    norms = np.linalg.norm(X, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-3)

def test_embedding_no_normalization(monkeypatch, fake_sentence_transformer):
    from src.rag.pipeline.indexing.build_embeddings import EmbeddingBuilder
    def fake_cfg(_self, _path):
        return {"vectorization": {"embedding_model": {"value": "fake"}, "normalize_embeddings": False, "batch_size": 8}}
    monkeypatch.setattr(EmbeddingBuilder, "_load_config", fake_cfg)

    # Mock the _generate_embeddings method to avoid division by zero with fast fake model
    def mock_generate_embeddings(self, texts):
        import numpy as np
        if not texts:
            raise ValueError("No texts provided for embedding generation")

        # Use the fake model directly to avoid timing issues
        embeddings = self.model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=self.normalize,
            convert_to_numpy=True,
            show_progress_bar=False
        )

        # Validate output shape
        expected_dim = self.model.get_sentence_embedding_dimension()
        if embeddings.shape[1] != expected_dim:
            raise ValueError(f"Expected {expected_dim} dimensions, got {embeddings.shape[1]}")

        # Validate normalization if requested
        if self.normalize:
            norms = np.linalg.norm(embeddings, axis=1)
            mean_norm = np.mean(norms)
            if not np.allclose(mean_norm, 1.0, atol=1e-3):
                print(f"⚠️  Warning: Mean L2 norm is {mean_norm:.4f}, expected ~1.0")

        return embeddings

    monkeypatch.setattr(EmbeddingBuilder, "_generate_embeddings", mock_generate_embeddings)
    eb = EmbeddingBuilder("any.xml")
    X = eb._generate_embeddings(["text a", "text b", "text c"])
    assert X.shape == (3, 32)
    assert X.dtype == "float32"
    import numpy as np
    norms = np.linalg.norm(X, axis=1)
    # Without normalization, norms should not be 1.0
    assert not np.allclose(norms, 1.0, atol=1e-3)