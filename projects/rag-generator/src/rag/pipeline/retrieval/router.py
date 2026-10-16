"""
Minimal CollectionRouter implementation for testing.
"""

class CollectionRouter:
    """Router for collection-based retrieval."""

    def __init__(self):
        """Initialize collection router."""
        pass

    def analyze_query(self, query):
        """Analyze query for collection routing."""
        # Simple query analysis for testing
        query_lower = query.lower()

        # Mock routing result
        class RoutingResult:
            def __init__(self):
                self.primary_collection = 'global'
                self.confidence_score = 0.8

        return RoutingResult()