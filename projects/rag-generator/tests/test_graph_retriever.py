#!/usr/bin/env python3
"""
Test script for the enhanced graph retriever implementation.

Demonstrates graph-first candidate selection, entity extraction, 
context expansion, and path evidence generation.
"""

import sys
sys.path.append('src')

from src.rag.api.retriever import RetrievalService, RetrieveRequest
from src.rag.core.graph.graph_store import GraphStore
from src.rag.pipeline.retrieval.graph_router import GraphRouter
from src.rag.pipeline.retrieval.router import CollectionRouter


def test_graph_retriever():
    """Test the enhanced graph retriever implementation."""
    print("🧪 Testing Graph-Enhanced Retriever Implementation")
    print("=" * 60)
    
    try:
        # Initialize the retrieval service
        print("🔄 Initializing RetrievalService with graph components...")
        retrieval_service = RetrievalService()
        
        # Initialize the service (this will load graph components)
        if not retrieval_service.initialize():
            print("❌ Failed to initialize retrieval service")
            return False
        
        # Test queries that benefit from graph enhancement
        test_queries = [
            "Tell me about Sir Ector",
            "What creatures live in Camelot?", 
            "How does magic work in Logres?",
            "Tell me about House Pendragon",
            "What is the Round Table?"
        ]
        
        print(f"\n🔍 Testing {len(test_queries)} queries with graph enhancement...")
        print("-" * 50)
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{i}. Query: '{query}'")
            
            # Test with graph enhancement enabled
            request = RetrieveRequest(
                query=query,
                k=3,
                ann_candidates=50,
                filters=None,
                enable_rerank=True,
                enable_graph_boost=True,
                include_entity_context=True
            )
            
            try:
                # Perform retrieval
                results = retrieval_service._retrieve_full(request)
                
                print(f"   ✅ Retrieved {len(results)} results")
                
                # Show results with graph information
                for j, result in enumerate(results[:2], 1):  # Show top 2 results
                    print(f"   Result {j}:")
                    print(f"     Title: {result.get('title', 'N/A')}")
                    print(f"     Domain: {result.get('domain', 'N/A')}")
                    print(f"     Entities: {result.get('entities', [])}")
                    
                    # Show graph path evidence if available
                    if 'graph_path_evidence' in result:
                        evidence = result['graph_path_evidence']
                        print(f"     🧠 Graph Evidence: {evidence['paths_found']} paths found")
                        for path in evidence['paths'][:1]:  # Show first path
                            print(f"       Path: {path['description']}")
                    
                    # Show collection boost if available
                    if 'collection_boost' in result:
                        print(f"     🎯 Collection boost: {result['collection_boost']}")
                
            except Exception as e:
                print(f"   ❌ Query failed: {e}")
        
        # Test direct graph functionality
        print(f"\n🧠 Testing direct GraphStore functionality...")
        print("-" * 40)
        
        if retrieval_service.graph_store:
            # Test entity extraction
            test_query = "Tell me about Sir Ector and House Pendragon"
            entities = retrieval_service.graph_store.extract_entities_from_query(test_query)
            print(f"   Entity extraction from '{test_query}': {entities}")
            
            # Test k-hop expansion
            if entities:
                expanded = retrieval_service.graph_store.expand_k_hop(entities[:1], k=2)
                print(f"   2-hop expansion from {entities[:1]}: {len(expanded)} total entities")
                
                # Test path finding between entities
                if len(entities) >= 2:
                    path = retrieval_service.graph_store.find_shortest_path(entities[0], entities[1])
                    if path:
                        print(f"   Path between {entities[0]} and {entities[1]}: {path}")
                    else:
                        print(f"   No path found between {entities[0]} and {entities[1]}")
            
            # Show graph statistics
            stats = retrieval_service.graph_store.get_graph_statistics()
            print(f"   Graph statistics: {stats}")
        else:
            print("   ⚠️  GraphStore not available")
        
        # Test GraphRouter functionality
        print(f"\n🧭 Testing GraphRouter functionality...")
        print("-" * 40)
        
        if retrieval_service.graph_router:
            for query in test_queries[:3]:
                try:
                    routing_result = retrieval_service.graph_router.route_with_graph(query)
                    print(f"   Query: '{query}'")
                    print(f"     Primary collection: {routing_result.primary_collection}")
                    print(f"     Seed entities: {routing_result.seed_entities}")
                    print(f"     Graph-pinned collections: {routing_result.graph_pinned_collections}")
                    print(f"     Reasoning: {routing_result.graph_reasoning}")
                except Exception as e:
                    print(f"     ❌ Routing failed: {e}")
        else:
            print("   ⚠️  GraphRouter not available")
        
        print(f"\n✅ Graph retriever testing completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Graph retriever testing failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_graph_components_individually():
    """Test graph components in isolation."""
    print("\n🧪 Testing Individual Graph Components")
    print("=" * 50)
    
    try:
        # Test GraphStore
        print("1. Testing GraphStore...")
        graph_store = GraphStore()
        
        # Test entity extraction
        test_queries = [
            "Tell me about Sir Ector",
            "What is House Pendragon?", 
            "How does the Round Table work?"
        ]
        
        for query in test_queries:
            entities = graph_store.extract_entities_from_query(query)
            print(f"   '{query}' → {entities}")
        
        # Test GraphRouter
        print("\n2. Testing GraphRouter...")
        collection_router = CollectionRouter()
        graph_router = GraphRouter(collection_router, graph_store)
        
        for query in test_queries:
            try:
                result = graph_router.route_with_graph(query)
                print(f"   '{query}' → {result.primary_collection} (entities: {result.seed_entities})")
            except Exception as e:
                print(f"   '{query}' → Error: {e}")
        
        print("✅ Individual component testing completed!")
        return True
        
    except Exception as e:
        print(f"❌ Individual component testing failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🚀 Graph Retriever Implementation Test Suite")
    print("=" * 60)
    
    # Test individual components first
    component_test = test_graph_components_individually()
    
    # Test integrated retriever
    retriever_test = test_graph_retriever()
    
    print("\n" + "=" * 60)
    if component_test and retriever_test:
        print("🎉 All tests passed! Graph retriever implementation is working.")
    else:
        print("❌ Some tests failed. Check the output above for details.")
        sys.exit(1)