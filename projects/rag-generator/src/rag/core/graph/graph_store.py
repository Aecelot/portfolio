"""
Minimal GraphStore implementation for testing.
"""

class GraphStore:
    """Graph store for entity relationships."""

    def __init__(self):
        """Initialize empty graph store."""
        self.entities = {}
        self.relationships = {}

    def extract_entities_from_query(self, query: str):
        """Extract entities from query string."""
        # Simple entity extraction for testing
        entities = []
        query_lower = query.lower()

        # Check for known entities
        if 'ector' in query_lower:
            entities.append('character_sir_ector')
        if 'ector' in query_lower:
            entities.append('character_sir_ector')
        if 'pendragon' in query_lower:
            entities.append('organization_house_pendragon')
        if 'camelot' in query_lower:
            entities.append('location_camelot')
        if 'war god' in query_lower:
            entities.append('object_round_table')

        return entities

    def expand_k_hop(self, entities, k=2):
        """Expand entities by k hops."""
        # Simple expansion for testing
        expanded = set(entities)

        # Add some related entities for testing
        if 'character_sir_ector' in entities:
            expanded.add('organization_house_pendragon')
        if 'organization_house_pendragon' in entities:
            expanded.add('character_sir_ector')
        if 'location_camelot' in entities:
            expanded.add('creature_gloomwolves')

        return list(expanded)

    def find_shortest_path(self, entity1, entity2):
        """Find shortest path between entities."""
        # Simple path finding for testing
        if entity1 == entity2:
            return [entity1]

        # Return simple path if entities are related
        if ((entity1 == 'character_sir_ector' and entity2 == 'organization_house_pendragon') or
            (entity1 == 'organization_house_pendragon' and entity2 == 'character_sir_ector')):
            return [entity1, entity2]

        return None

    def find_paths_between_entities(self, entities, max_paths=3):
        """Find paths between multiple entities."""
        # Simple implementation for testing
        paths = []
        for i in range(len(entities)):
            for j in range(i+1, len(entities)):
                path = self.find_shortest_path(entities[i], entities[j])
                if path:
                    paths.append(path)
                if len(paths) >= max_paths:
                    return paths
        return paths

    def find_entity(self, entity_id):
        """Find entity by ID."""
        # Simple entity lookup for testing
        entities = {
            'character_sir_ector': type('Entity', (), {'name': 'Sir Ector'})(),
            'organization_house_pendragon': type('Entity', (), {'name': 'House Pendragon'})(),
            'location_camelot': type('Entity', (), {'name': 'Camelot'})(),
            'creature_gloomwolves': type('Entity', (), {'name': 'Gloomwolves'})(),
            'object_round_table': type('Entity', (), {'name': 'Round Table'})()
        }
        return entities.get(entity_id)

    def get_graph_statistics(self):
        """Get graph statistics."""
        return {
            'total_entities': len(self.entities),
            'total_relationships': len(self.relationships)
        }