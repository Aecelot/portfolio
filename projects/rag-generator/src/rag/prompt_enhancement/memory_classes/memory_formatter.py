from typing import Dict, List, Any
from .memory_types import MemoryClass, ClassifiedMemory


class MemoryFormatter:
    """
    Formats classified memories for prompt injection.

    This class handles the formatting of classified memories into
    various output formats suitable for different use cases.
    """

    def __init__(self):
        """Initialize the memory formatter."""
        pass

    def format_for_prompt_injection(self, classified_memories: List[ClassifiedMemory],
                                   max_memories: int = 5) -> str:
        """
        Format memories for injection into prompts.

        Args:
            classified_memories: List of classified memories
            max_memories: Maximum number of memories to include

        Returns:
            Formatted string ready for prompt injection
        """
        if not classified_memories:
            return "No relevant memories available."

        # Filter and limit memories
        suitable_memories = [
            mem for mem in classified_memories
            if mem.should_inject(min_relevance=0.6, max_injections=3)
        ][:max_memories]

        if not suitable_memories:
            return "No suitable memories for injection."

        # Group by memory class
        class_groups = {}
        for memory in suitable_memories:
            class_name = memory.memory_class.value.title()
            if class_name not in class_groups:
                class_groups[class_name] = []
            class_groups[class_name].append(memory)

        # Format each group
        formatted_sections = []
        for class_name, memories in class_groups.items():
            section_content = self._format_memory_group(class_name, memories)
            formatted_sections.append(section_content)

        return "\n\n".join(formatted_sections)

    def _format_memory_group(self, class_name: str, memories: List[ClassifiedMemory]) -> str:
        """Format a group of memories from the same class."""
        formatted_items = []

        for memory in memories:
            # Mark as injected
            memory.mark_injected()

            # Format individual memory
            item_content = memory.formatted_content
            if memory.get_raw_value('importance', 0) > 0.8:
                item_content = f"**{item_content}**"

            formatted_items.append(f"• {item_content}")

        return f"**{class_name} Memories:**\n" + "\n".join(formatted_items)

    def format_for_display(self, classified_memories: List[ClassifiedMemory],
                          include_metadata: bool = False) -> str:
        """
        Format memories for human-readable display.

        Args:
            classified_memories: List of classified memories
            include_metadata: Whether to include classification metadata

        Returns:
            Human-readable formatted string
        """
        if not classified_memories:
            return "No memories to display."

        lines = []
        for memory in classified_memories:
            lines.append(f"[{memory.memory_class.value.upper()}] {memory.display_title}")
            lines.append(f"  Content: {memory.formatted_content}")
            lines.append(f"  Relevance: {memory.relevance_score:.2f}")

            if include_metadata:
                lines.append(f"  Keywords: {', '.join(memory.context_keywords)}")
                lines.append(f"  Priority: {memory.injection_priority}")
                lines.append(f"  Injected: {memory.injection_count} times")

            lines.append("")  # Empty line between memories

        return "\n".join(lines)

    def format_stats_summary(self, classified_memories: List[ClassifiedMemory]) -> str:
        """
        Format classification statistics summary.

        Args:
            classified_memories: List of classified memories

        Returns:
            Statistics summary string
        """
        if not classified_memories:
            return "No memories classified."

        # Count by class
        class_counts = {}
        total_relevance = 0

        for memory in classified_memories:
            class_name = memory.memory_class.value
            class_counts[class_name] = class_counts.get(class_name, 0) + 1
            total_relevance += memory.relevance_score

        avg_relevance = total_relevance / len(classified_memories)

        lines = []
        lines.append(f"Classification Summary:")
        lines.append(f"  Total memories: {len(classified_memories)}")
        lines.append(f"  Average relevance: {avg_relevance:.2f}")

        lines.append("  By category:")
        for class_name, count in sorted(class_counts.items()):
            lines.append(f"    {class_name.title()}: {count}")

        return "\n".join(lines)

    def format_for_api_response(self, classified_memories: List[ClassifiedMemory]) -> List[Dict[str, Any]]:
        """
        Format memories for API response.

        Args:
            classified_memories: List of classified memories

        Returns:
            List of dictionaries suitable for JSON serialization
        """
        api_data = []

        for memory in classified_memories:
            api_data.append({
                'memory_id': memory.get_raw_value('memory_id', ''),
                'class': memory.memory_class.value,
                'relevance_score': memory.relevance_score,
                'content': memory.formatted_content,
                'keywords': memory.context_keywords,
                'priority': memory.injection_priority,
                'injection_count': memory.injection_count,
                'timestamp': memory.classification_timestamp
            })

        return api_data