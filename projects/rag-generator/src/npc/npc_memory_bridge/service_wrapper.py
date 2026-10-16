"""
NPC Memory Bridge Service Wrapper for testing.
"""

class NPCMemoryBridge:
    """NPC Memory Bridge service wrapper."""

    def __init__(self):
        """Initialize memory bridge."""
        pass

    def get_relevant_memories(self, npc_id, query=None, limit=10):
        """Get relevant memories for NPC."""
        # Mock implementation for testing
        return []

    def store_memory(self, npc_id, memory_data):
        """Store memory for NPC."""
        # Mock implementation for testing
        pass

    def get_memory_context(self, npc_id, context_type="conversation"):
        """Get memory context for NPC."""
        # Mock implementation for testing
        return {}