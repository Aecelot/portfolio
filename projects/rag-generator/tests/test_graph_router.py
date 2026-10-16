#!/usr/bin/env python3
"""Test script for GraphRouter functionality."""

import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def test_graph_router():
    """Test GraphRouter functionality."""
    print("🧪 Testing GraphRouter...")
    print("=" * 60)

    try:
        # Initialize components
        from src.rag.core.graph.graph_store import GraphStore
        from src.rag.pipeline.retrieval.router import CollectionRouter
        from src.rag.pipeline.retrieval.graph_router import GraphRouter

        collection_router = CollectionRouter()
        graph_store = GraphStore()
        graph_router = GraphRouter(collection_router, graph_store)

        # Test queries that benefit from graph enhancement
        test_queries = [
            "Tell me about Sir Ector",
            "What is House Pendragon?",
            "Tell me about the Round Table",
            "How does magic work in Logres?",
            "What creatures live in Camelot?"
        ]

        print("\n🔍 Testing Graph-Enhanced Routing...")
        print("-" * 50)

        for query in test_queries:
            print(f"\nQuery: '{query}'")

            # Baseline routing
            baseline = collection_router.analyze_query(query)
            print(f"  Baseline: {baseline.primary_collection} (conf: {baseline.confidence_score:.2f})")

            # Graph-enhanced routing
            graph_result = graph_router.route_with_graph(query)
            print(f"  Graph-enhanced: {graph_result.primary_collection}")
            print(f"  Seed entities: {graph_result.seed_entities}")
            print(f"  Neighbor entities: {graph_result.neighbor_entities}")
            print(f"  Graph-pinned: {graph_result.graph_pinned_collections}")
            print(f"  Reasoning: {graph_result.reasoning}")
            print(f"  Graph context: {graph_result.graph_reasoning}")

        # Test entity-specific collection suggestions
        print("\n🏷️ Testing Entity-Specific Collection Suggestions...")
        print("-" * 50)

        test_entities = [
            "character_sir_ector",
            "organization_house_pendragon",
            "creature_gloomwolves"
        ]

        for entity_id in test_entities:
            suggestions = graph_router.suggest_collections_for_entity(entity_id)
            entity = graph_store.find_entity(entity_id)
            entity_name = entity.name if entity else entity_id

            print(f"\n{entity_name}:")
            print(f"  Suggested collections: {suggestions}")

            # Show context for primary collection
            if suggestions:
                context = graph_router.get_entity_context_for_collection([entity_id], suggestions[0])
                print(f"  Context for '{suggestions[0]}': {len(context['relevant_entities'])} relevant entities")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_graph_router()