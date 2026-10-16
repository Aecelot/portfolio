"""
Ingestion pipeline for Lore RAG system.

Converts markdown files to chunked JSONL with entity linking.
"""

__version__ = "0.1.0"
__author__ = "Lore RAG Team"

# Import individual components as they become available
try:
    from .chunk_md import MarkdownChunker, ChunkMetadata, ProcessingResult
    __all__ = ["MarkdownChunker", "ChunkMetadata", "ProcessingResult"]
except ImportError:
    # Components not yet implemented
    __all__ = []