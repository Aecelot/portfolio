# Graph-First Candidate Selection Implementation Plan

## Overview
This action plan outlines the implementation of graph-first candidate selection in the main retriever, enhancing retrieval capabilities through graph-based entity relationships and context expansion.

## Action Items

### Phase 1: Core Graph Integration
- [ ] Implement graph-first candidate selection in main retriever
- [ ] Extract entities from queries using GraphStore
- [ ] Expand context through graph neighbor relationships

### Phase 2: Advanced Retrieval Features
- [ ] Use graph paths as retrieval priors for better candidate selection
- [ ] Return path evidence in retrieval responses for explainability

### Phase 3: Integration and Testing
- [ ] Integrate GraphRouter with main retriever for collection-aware search
- [ ] Test the enhanced retriever with graph-based candidate selection

## Technical Requirements

### Dependencies
- GraphStore integration with entity extraction
- GraphRouter compatibility with main retriever
- Path evidence serialization in response format

### Files to Modify
- `backend/api/retriever.py` - Main retriever implementation
- `backend/core/graph/graph_store.py` - Graph storage and querying
- `backend/pipeline/retrieval/graph_router.py` - Graph-based routing logic

### Testing Strategy
- Unit tests for graph-based candidate selection
- Integration tests with existing retrieval pipeline
- Performance benchmarks for graph-enhanced retrieval

## Success Criteria
- Improved retrieval relevance through graph relationships
- Successful entity extraction from natural language queries
- Explainable retrieval results with path evidence
- Seamless integration with existing RAG pipeline

## Timeline Estimate
- Phase 1: 2-3 development days
- Phase 2: 1-2 development days
- Phase 3: 1-2 development days