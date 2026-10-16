def test_retrieval_mock_mode():
    from src.rag.api.retriever import RetrievalService
    svc = RetrievalService()
    svc.faiss_index = None
    svc.embedding_model = None
    results = svc.retrieve("Tell me about Sir Ector", top_k=3)
    assert isinstance(results, list)
    assert len(results) <= 3
    if results:
        assert "content" in results[0]

def test_retrieval_mock_mode_multiple_queries():
    from src.rag.api.retriever import RetrievalService
    svc = RetrievalService()
    svc.faiss_index = None
    svc.embedding_model = None

    queries = [
        "Tell me about Sir Ector",
        "What is House Pendragon?",
        "Describe magic in Logres"
    ]

    for query in queries:
        results = svc.retrieve(query, top_k=3)
        assert isinstance(results, list)
        assert len(results) <= 3
        # All results should have content field if present
        for result in results:
            if isinstance(result, dict):
                assert "content" in result

def test_retrieval_empty_query():
    from src.rag.api.retriever import RetrievalService
    svc = RetrievalService()
    svc.faiss_index = None
    svc.embedding_model = None
    # Empty/whitespace query should not crash
    results = svc.retrieve("", top_k=3)
    assert isinstance(results, list)
    # Can be empty list or contain results, but shouldn't crash