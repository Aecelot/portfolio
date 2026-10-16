"""
Retrieval API for Lore RAG system.

FastAPI endpoints for semantic search and lore retrieval.
"""

__version__ = "0.1.0"
__author__ = "Lore RAG Team"

from .retriever import app, RetrievalService, RetrieveRequest, RetrieveResponse

__all__ = ["app", "RetrievalService", "RetrieveRequest", "RetrieveResponse"]