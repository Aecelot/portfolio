from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any
import time


class MemoryClass(Enum):
    """Enumeration of memory classification types."""

    CHARACTER = "character"
    PLAYER = "player"
    WORLD = "world"
    SESSION = "session"
    TRIGGERED = "triggered"
    EMOTIONAL = "emotional"
    SOCIAL = "social"
    PROSPECTIVE = "prospective"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"


@dataclass
class ClassifiedMemory:
    """
    Memory with classification metadata for intelligent prompt injection.

    This class wraps raw memories from the NPC Memory Service with
    additional metadata for classification, relevance scoring, and
    prompt formatting decisions.
    """

    # Core memory data
    raw_memory: Dict[str, Any]  # Original memory from NPC Memory Service
    memory_class: MemoryClass
    relevance_score: float = 0.0

    # Context and keywords
    context_keywords: List[str] = field(default_factory=list)
    injection_priority: int = 0

    # Formatting and display
    formatted_content: str = ""
    display_title: str = ""

    # Metadata
    classification_timestamp: float = field(default_factory=time.time)
    classification_confidence: float = 1.0
    injection_count: int = 0

    # Advanced features
    related_memories: List[str] = field(default_factory=list)  # Memory IDs
    semantic_similarity: float = 0.0
    temporal_relevance: float = 0.0

    def __post_init__(self):
        """Post-initialization processing."""
        if not self.formatted_content:
            self.formatted_content = self._generate_formatted_content()

        if not self.display_title:
            self.display_title = self._generate_display_title()

    def _generate_formatted_content(self) -> str:
        """Generate formatted content for prompt injection."""
        memory = self.raw_memory

        # Start with description if available
        if 'description' in memory:
            content = memory['description']
        else:
            content = str(memory)

        # Add emotional context if present
        if 'emotional_state' in memory and memory['emotional_state']:
            content += f" (Emotional state: {memory['emotional_state']})"

        # Add importance indicator for high-importance memories
        if 'importance' in memory and memory['importance'] > 0.8:
            content = f"**{content}**"

        return content

    def _generate_display_title(self) -> str:
        """Generate a display title for this memory."""
        memory = self.raw_memory

        # Use memory type as base
        base_title = self.memory_class.value.title()

        # Add specific details based on memory content
        if 'memory_type' in memory:
            base_title = memory['memory_type'].title()

        # Add emotional indicator if present
        if 'emotional_state' in memory and memory['emotional_state']:
            base_title = f"{memory['emotional_state'].title()} {base_title}"

        return base_title

    def mark_injected(self) -> None:
        """Mark this memory as having been injected into a prompt."""
        self.injection_count += 1

    def calculate_relevance_boost(self, context_keywords: List[str]) -> float:
        """
        Calculate relevance boost based on context keywords.

        Args:
            context_keywords: Keywords from current context

        Returns:
            Relevance boost multiplier (1.0 = no boost)
        """
        if not context_keywords or not self.context_keywords:
            return 1.0

        # Count matching keywords
        matches = sum(1 for ctx_kw in context_keywords
                     for mem_kw in self.context_keywords
                     if ctx_kw.lower() in mem_kw.lower() or mem_kw.lower() in ctx_kw.lower())

        # Calculate boost based on match ratio
        match_ratio = matches / len(context_keywords) if context_keywords else 0
        return 1.0 + (match_ratio * 0.5)  # Up to 50% boost

    def is_fresh(self, max_age_seconds: int = 300) -> bool:
        """Check if classification is still fresh."""
        return (time.time() - self.classification_timestamp) < max_age_seconds

    def should_inject(self, min_relevance: float = 0.7, max_injections: int = 3) -> bool:
        """
        Determine if this memory should be injected based on criteria.

        Args:
            min_relevance: Minimum relevance score required
            max_injections: Maximum number of times this memory can be injected

        Returns:
            True if memory should be injected
        """
        return (self.relevance_score >= min_relevance and
                self.injection_count < max_injections)

    def get_age_seconds(self) -> float:
        """Get age of this memory classification in seconds."""
        return time.time() - self.classification_timestamp

    def get_raw_value(self, key: str, default: Any = None) -> Any:
        """Get a value from the raw memory data."""
        return self.raw_memory.get(key, default)

    def has_keyword(self, keyword: str) -> bool:
        """Check if memory contains a specific keyword."""
        keyword_lower = keyword.lower()
        return any(keyword_lower in ctx_kw.lower() for ctx_kw in self.context_keywords)

    def matches_context(self, context: Dict[str, Any]) -> float:
        """
        Calculate how well this memory matches the given context.

        Args:
            context: Context information including keywords, location, etc.

        Returns:
            Match score between 0.0 and 1.0
        """
        match_score = 0.0

        # Keyword matching
        if 'keywords' in context and context['keywords']:
            keyword_matches = sum(1 for ctx_kw in context['keywords']
                                for mem_kw in self.context_keywords
                                if ctx_kw.lower() in mem_kw.lower())
            if context['keywords']:
                match_score += keyword_matches / len(context['keywords'])

        # Location matching
        if 'location' in context and 'location' in self.raw_memory:
            if context['location'].lower() in self.raw_memory['location'].lower():
                match_score += 0.3

        # Emotional context matching
        if 'emotional_context' in context and 'emotional_state' in self.raw_memory:
            if context['emotional_context'].lower() in self.raw_memory['emotional_state'].lower():
                match_score += 0.2

        return min(match_score, 1.0)


@dataclass
class MemoryClassificationStats:
    """Statistics about memory classification process."""

    total_memories_processed: int = 0
    classification_times: List[float] = field(default_factory=list)
    average_confidence: float = 0.0
    class_distribution: Dict[MemoryClass, int] = field(default_factory=dict)
    errors_encountered: int = 0

    def add_classification_time(self, duration: float) -> None:
        """Add a classification timing measurement."""
        self.classification_times.append(duration)
        if len(self.classification_times) > 100:  # Keep only recent measurements
            self.classification_times = self.classification_times[-100:]

    def record_classification(self, memory_class: MemoryClass, confidence: float) -> None:
        """Record a successful classification."""
        self.total_memories_processed += 1
        self.class_distribution[memory_class] = self.class_distribution.get(memory_class, 0) + 1

        # Update average confidence
        if self.total_memories_processed == 1:
            self.average_confidence = confidence
        else:
            self.average_confidence = ((self.average_confidence * (self.total_memories_processed - 1)) + confidence) / self.total_memories_processed

    def record_error(self) -> None:
        """Record a classification error."""
        self.errors_encountered += 1

    def get_average_classification_time(self) -> float:
        """Get average classification time in seconds."""
        return sum(self.classification_times) / len(self.classification_times) if self.classification_times else 0.0

    def get_error_rate(self) -> float:
        """Get classification error rate as percentage."""
        if self.total_memories_processed == 0:
            return 0.0
        return (self.errors_encountered / self.total_memories_processed) * 100.0