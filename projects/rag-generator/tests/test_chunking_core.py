def test_chunking_headers_and_splits(tmp_path, monkeypatch, minimal_chunking_config):
    from src.rag.pipeline.ingestion.chunk_md import MarkdownChunker
    monkeypatch.setattr(MarkdownChunker, "_load_config", lambda self, _: minimal_chunking_config)
    content = "# World\n\n## Magic\n\n### Basics\n\nShort content.\n\n### Advanced\n\n" + ("This is a long sentence that repeats many times. " * 100)
    p = tmp_path / "doc.md"
    p.write_text(content, encoding="utf-8")
    chunker = MarkdownChunker()
    result = chunker.process_markdown_file(p)
    assert result.total_chunks >= 1
    assert all(c.token_count > 0 for c in result.chunks)
    assert any("Advanced" in " ".join(c.header_path) for c in result.chunks)

def test_chunking_token_bounds(tmp_path, monkeypatch, minimal_chunking_config):
    from src.rag.pipeline.ingestion.chunk_md import MarkdownChunker
    monkeypatch.setattr(MarkdownChunker, "_load_config", lambda self, _: minimal_chunking_config)
    # Create content that should trigger splitting
    long_content = "Word " * 500  # This should exceed token_max
    content = f"# Test\n\n## Section\n\n{long_content}"
    p = tmp_path / "long.md"
    p.write_text(content, encoding="utf-8")
    chunker = MarkdownChunker()
    result = chunker.process_markdown_file(p)

    # Verify chunks respect token bounds
    for chunk in result.chunks:
        # Allow some tolerance for token estimation
        assert minimal_chunking_config["chunking"]["token_min"] - 50 <= chunk.token_count <= minimal_chunking_config["chunking"]["token_max"] + 50