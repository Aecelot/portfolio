"""
Minimal GraphRouter implementation for testing.
"""

from .router import CollectionRouter

class GraphRouter:
    """Graph-enhanced router for collection-based retrieval."""

    def __init__(self, collection_router, graph_store):
        """Initialize graph router."""
        self.collection_router = collection_router
        self.graph_store = graph_store

    def route_with_graph(self, query):
        """Route query using graph information."""
        # Simple routing result for testing
        class RoutingResult:
            def __init__(self):
                self.primary_collection = 'global'
                self.seed_entities = []
                self.neighbor_entities = []
                self.graph_pinned_collections = []
                self.reasoning = 'Graph-based routing'
                self.graph_reasoning = 'Used graph entities for routing'

        # Extract entities from query
        entities = self.graph_store.extract_entities_from_query(query)

        result = RoutingResult()
        result.seed_entities = entities

        # Add some neighbor entities for testing
        if entities:
            result.neighbor_entities = self.graph_store.expand_k_hop(entities, k=1)

        return result

    def suggest_collections_for_entity(self, entity_id):
        """Suggest collections for an entity."""
        # Simple collection suggestions for testing
        if 'character' in entity_id:
            return ['characters', 'global']
        elif 'organization' in entity_id:
            return ['factions', 'global']
        elif 'location' in entity_id:
            return ['geography', 'global']
        else:
            return ['global']

    def get_entity_context_for_collection(self, entity_ids, collection):
        """Get entity context for a collection."""
        # Simple context for testing
        return {
            'relevant_entities': entity_ids,
            'collection': collection,
            'context_score': 0.8
        }