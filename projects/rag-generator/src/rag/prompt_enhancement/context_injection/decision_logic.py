import re
import logging
from typing import Dict, List, Any, Tuple
from ..memory_classes import ClassifiedMemory

logger = logging.getLogger(__name__)


class InjectionDecisionLogic:
    """
    Decision logic for determining memory injection strategies.

    This class contains the core logic for deciding which memories
    to inject, when to inject them, and how to handle conflicts.
    """

    def __init__(self):
        """Initialize the decision logic engine."""
        self.logger = logging.getLogger(__name__)

        # Decision thresholds
        self.thresholds = {
            'min_relevance': 0.6,
            'high_relevance': 0.8,
            'max_redundancy': 0.7,
            'context_boost_threshold': 0.3,
            'urgency_boost': 0.2
        }

        # Memory class priorities for different contexts
        self.context_priorities = {
            'urgent': {
                'triggered': 10,
                'emotional': 8,
                'player': 7,
                'character': 5,
                'prospective': 6,
                'social': 4,
                'world': 2,
                'session': 3
            },
            'emotional': {
                'emotional': 10,
                'character': 7,
                'player': 6,
                'social': 8,
                'prospective': 4,
                'world': 2,
                'session': 3,
                'triggered': 9
            },
            'casual': {
                'session': 8,
                'character': 6,
                'player': 7,
                'world': 4,
                'social': 5,
                'prospective': 3,
                'emotional': 5,
                'triggered': 6
            }
        }

    def analyze_injection_context(self, player_input: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze context to determine injection strategy.

        Args:
            player_input: Player's current input
            context: Template context with game state

        Returns:
            Context analysis results
        """
        analysis = {
            'context_type': self._determine_context_type(player_input, context),
            'urgency_level': self._calculate_urgency_level(player_input),
            'emotional_tone': self._detect_emotional_tone(player_input),
            'question_type': self._classify_question_type(player_input),
            'keyword_themes': self._extract_themes(player_input),
            'conversation_stage': self._determine_conversation_stage(context)
        }

        return analysis

    def _determine_context_type(self, player_input: str, context: Dict[str, Any]) -> str:
        """Determine the type of context for injection decisions."""

        # Check for urgent situations
        if self._calculate_urgency_level(player_input) > 0.8:
            return 'urgent'

        # Check for emotional discussions
        if self._detect_emotional_tone(player_input) > 0.7:
            return 'emotional'

        # Check conversation history for context
        if 'conversation_history' in context:
            recent_emotional = self._check_recent_emotional_context(context['conversation_history'])
            if recent_emotional:
                return 'emotional'

        # Default to casual conversation
        return 'casual'

    def _calculate_urgency_level(self, text: str) -> float:
        """Calculate urgency level from 0.0 to 1.0."""

        urgent_words = [
            'urgent', 'quickly', 'now', 'immediately', 'help',
            'danger', 'threat', 'emergency', 'crisis', 'hurry',
            'fast', 'quick', 'asap', 'rush'
        ]

        text_lower = text.lower()
        urgent_count = sum(1 for word in urgent_words if word in text_lower)

        # Boost urgency for question marks and exclamation points
        punctuation_boost = text.count('!') * 0.1 + text.count('?') * 0.05

        return min(urgent_count * 0.2 + punctuation_boost, 1.0)

    def _detect_emotional_tone(self, text: str) -> float:
        """Detect emotional tone from 0.0 to 1.0."""

        emotional_words = {
            'positive': ['happy', 'love', 'great', 'wonderful', 'amazing', 'excited', 'joy'],
            'negative': ['sad', 'hate', 'terrible', 'awful', 'angry', 'fear', 'horrified'],
            'neutral': ['feel', 'feeling', 'emotion', 'mood']
        }

        text_lower = text.lower()
        emotional_score = 0

        for category, words in emotional_words.items():
            for word in words:
                if word in text_lower:
                    if category == 'positive':
                        emotional_score += 0.3
                    elif category == 'negative':
                        emotional_score += 0.3
                    else:
                        emotional_score += 0.1

        return min(emotional_score, 1.0)

    def _classify_question_type(self, text: str) -> str:
        """Classify the type of question being asked."""

        text_lower = text.lower()

        # Personal questions
        if any(word in text_lower for word in ['you', 'your', 'yourself']):
            return 'personal'

        # World/lore questions
        if any(word in text_lower for word in ['world', 'kingdom', 'history', 'lore']):
            return 'world'

        # Relationship questions
        if any(word in text_lower for word in ['friend', 'relationship', 'love', 'trust']):
            return 'relationship'

        # Memory questions
        if any(word in text_lower for word in ['remember', 'memory', 'recall', 'forget']):
            return 'memory'

        # Future/planning questions
        if any(word in text_lower for word in ['plan', 'future', 'going to', 'will']):
            return 'prospective'

        return 'general'

    def _extract_themes(self, text: str) -> List[str]:
        """Extract thematic keywords from text."""

        themes = []

        # Define theme categories
        theme_keywords = {
            'combat': ['fight', 'battle', 'war', 'combat', 'weapon', 'attack'],
            'magic': ['magic', 'spell', 'enchantment', 'wizard', 'sorcery'],
            'politics': ['king', 'queen', 'lord', 'politics', 'government', 'law'],
            'trade': ['trade', 'merchant', 'gold', 'coin', 'buy', 'sell'],
            'exploration': ['explore', 'journey', 'travel', 'adventure', 'quest'],
            'social': ['friend', 'family', 'relationship', 'love', 'trust'],
            'emotional': ['feel', 'emotion', 'happy', 'sad', 'angry', 'fear']
        }

        text_lower = text.lower()

        for theme, keywords in theme_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                themes.append(theme)

        return themes

    def _determine_conversation_stage(self, context: Dict[str, Any]) -> str:
        """Determine the current stage of conversation."""

        if 'conversation_history' not in context:
            return 'new'

        history = context['conversation_history']

        if len(history) < 3:
            return 'new'

        elif len(history) < 10:
            return 'developing'

        else:
            return 'established'

    def _check_recent_emotional_context(self, conversation_history: List[Dict[str, Any]]) -> bool:
        """Check if recent conversation has emotional content."""

        recent_messages = conversation_history[-3:] if len(conversation_history) > 3 else conversation_history

        for message in recent_messages:
            if 'content' in message:
                emotional_score = self._detect_emotional_tone(message['content'])
                if emotional_score > 0.6:
                    return True

        return False

    def calculate_memory_priority(self, memory: ClassifiedMemory,
                                 context_analysis: Dict[str, Any]) -> float:
        """
        Calculate final priority score for memory injection.

        Args:
            memory: Classified memory to evaluate
            context_analysis: Results from context analysis

        Returns:
            Final priority score
        """
        base_priority = memory.injection_priority
        context_type = context_analysis['context_type']

        # Get context-specific priority boost
        if context_type in self.context_priorities:
            context_boost = self.context_priorities[context_type].get(memory.memory_class.value, 0)
        else:
            context_boost = 0

        # Apply urgency boost if applicable
        if context_analysis['urgency_level'] > 0.7:
            if memory.memory_class.value in ['triggered', 'emotional']:
                context_boost += self.thresholds['urgency_boost'] * 10

        # Apply emotional boost if applicable
        if context_analysis['emotional_tone'] > 0.6:
            if memory.memory_class.value in ['emotional', 'character']:
                context_boost += self.thresholds['context_boost_threshold'] * 5

        # Calculate final priority
        final_priority = base_priority + context_boost

        return min(final_priority, 100.0)  # Cap at 100

    def should_inject_memory_class(self, memory_class: str,
                                  context_analysis: Dict[str, Any],
                                  current_injections: Dict[str, int]) -> bool:
        """
        Determine if a memory class should be injected.

        Args:
            memory_class: Memory class to check
            context_analysis: Context analysis results
            current_injections: Count of current injections by class

        Returns:
            True if class should be injected
        """
        context_type = context_analysis['context_type']

        # Get context-specific limits
        if context_type in self.context_priorities:
            max_for_class = self.context_priorities[context_type].get(memory_class, 5)
        else:
            max_for_class = 3  # Default limit

        # Check if we've reached the limit for this class
        current_count = current_injections.get(memory_class, 0)

        return current_count < max_for_class

    def detect_memory_conflicts(self, memories: List[ClassifiedMemory],
                               context: Dict[str, Any]) -> List[Tuple[ClassifiedMemory, ClassifiedMemory, str]]:
        """
        Detect conflicts between memories that shouldn't be injected together.

        Args:
            memories: List of memories to check
            context: Current context

        Returns:
            List of conflicting memory pairs with conflict reasons
        """
        conflicts = []

        for i, memory1 in enumerate(memories):
            for memory2 in memories[i+1:]:

                # Check for emotional conflicts
                emotion1 = memory1.get_raw_value('emotional_state', '')
                emotion2 = memory2.get_raw_value('emotional_state', '')

                if emotion1 and emotion2:
                    if self._emotions_conflict(emotion1, emotion2):
                        conflicts.append((memory1, memory2, 'emotional_conflict'))

                # Check for contradictory information
                if self._memories_contradict(memory1, memory2):
                    conflicts.append((memory1, memory2, 'contradiction'))

        return conflicts

    def _emotions_conflict(self, emotion1: str, emotion2: str) -> bool:
        """Check if two emotions conflict."""

        conflicting_pairs = [
            ('happy', 'sad'),
            ('angry', 'calm'),
            ('fearful', 'confident'),
            ('love', 'hate'),
            ('joy', 'sorrow')
        ]

        emotion1_lower = emotion1.lower()
        emotion2_lower = emotion2.lower()

        for pos, neg in conflicting_pairs:
            if (pos in emotion1_lower and neg in emotion2_lower) or \
               (neg in emotion1_lower and pos in emotion2_lower):
                return True

        return False

    def _memories_contradict(self, memory1: ClassifiedMemory, memory2: ClassifiedMemory) -> bool:
        """Check if two memories contradict each other."""

        # Simple contradiction detection based on keywords
        keywords1 = set(word.lower() for word in memory1.context_keywords)
        keywords2 = set(word.lower() for word in memory2.context_keywords)

        # Check for opposing concepts
        opposing_concepts = [
            ('friend', 'enemy'),
            ('ally', 'enemy'),
            ('love', 'hate'),
            ('trust', 'betray'),
            ('loyal', 'traitor')
        ]

        for pos, neg in opposing_concepts:
            if (pos in keywords1 and neg in keywords2) or (neg in keywords1 and pos in keywords2):
                return True

        return False

    def resolve_conflicts(self, conflicts: List[Tuple[ClassifiedMemory, ClassifiedMemory, str]],
                         memories: List[ClassifiedMemory]) -> List[ClassifiedMemory]:
        """
        Resolve conflicts by selecting which memories to keep.

        Args:
            conflicts: List of conflicting memory pairs
            memories: Original memory list

        Returns:
            Filtered memory list with conflicts resolved
        """
        if not conflicts:
            return memories

        # Create memory priority scores
        memory_priorities = {id(m): m.injection_priority for m in memories}

        # For each conflict, keep the memory with higher priority
        memories_to_remove = set()

        for memory1, memory2, conflict_type in conflicts:
            priority1 = memory_priorities[id(memory1)]
            priority2 = memory_priorities[id(memory2)]

            if priority1 < priority2:
                memories_to_remove.add(id(memory1))
            elif priority2 < priority1:
                memories_to_remove.add(id(memory2))
            else:
                # Same priority - prefer more recent memories
                time1 = memory1.classification_timestamp
                time2 = memory2.classification_timestamp

                if time1 < time2:  # memory1 is older
                    memories_to_remove.add(id(memory1))
                else:
                    memories_to_remove.add(id(memory2))

        # Filter out conflicting memories
        resolved_memories = [
            m for m in memories
            if id(m) not in memories_to_remove
        ]

        self.logger.info(f"Resolved {len(conflicts)} conflicts, removed {len(memories) - len(resolved_memories)} memories")

        return resolved_memories

    def optimize_injection_order(self, memories: List[ClassifiedMemory],
                                context_analysis: Dict[str, Any]) -> List[ClassifiedMemory]:
        """
        Optimize the order of memory injection for maximum impact.

        Args:
            memories: Memories to inject
            context_analysis: Context analysis results

        Returns:
            Reordered memory list
        """
        if not memories:
            return memories

        # Calculate final scores for each memory
        scored_memories = []

        for memory in memories:
            final_score = self.calculate_memory_priority(memory, context_analysis)

            # Add diversity bonus for different memory classes
            class_bonus = len(set(m.memory_class for m in scored_memories)) * 0.1

            scored_memories.append((memory, final_score + class_bonus))

        # Sort by final score (highest first)
        scored_memories.sort(key=lambda x: x[1], reverse=True)

        # Return just the memories in optimized order
        return [memory for memory, score in scored_memories]

    def get_injection_recommendations(self, memories: List[ClassifiedMemory],
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get comprehensive injection recommendations.

        Args:
            memories: Available memories for injection
            context: Current context

        Returns:
            Detailed recommendations for injection strategy
        """

        # Analyze context
        context_analysis = self.analyze_injection_context(
            context.get('player_input', ''), context
        )

        # Calculate priorities
        prioritized_memories = self.optimize_injection_order(memories, context_analysis)

        # Check for conflicts
        conflicts = self.detect_memory_conflicts(prioritized_memories, context)

        # Resolve conflicts
        final_memories = self.resolve_conflicts(conflicts, prioritized_memories)

        # Generate recommendations
        recommendations = {
            'recommended_memories': final_memories,
            'context_analysis': context_analysis,
            'injection_strategy': context_analysis['context_type'],
            'estimated_effectiveness': self._estimate_injection_effectiveness(final_memories, context_analysis),
            'conflicts_detected': len(conflicts),
            'conflicts_resolved': len(conflicts) - (len(prioritized_memories) - len(final_memories))
        }

        return recommendations

    def _estimate_injection_effectiveness(self, memories: List[ClassifiedMemory],
                                        context_analysis: Dict[str, Any]) -> float:
        """Estimate the effectiveness of the injection plan."""

        if not memories:
            return 0.0

        # Base effectiveness from average relevance
        avg_relevance = sum(m.relevance_score for m in memories) / len(memories)

        # Context alignment bonus
        context_bonus = 0.0
        if context_analysis['context_type'] == 'emotional':
            emotional_memories = [m for m in memories if m.memory_class.value == 'emotional']
            context_bonus += len(emotional_memories) * 0.1

        # Diversity bonus
        unique_classes = len(set(m.memory_class.value for m in memories))
        diversity_bonus = min(unique_classes * 0.05, 0.2)

        return min(avg_relevance + context_bonus + diversity_bonus, 1.0)