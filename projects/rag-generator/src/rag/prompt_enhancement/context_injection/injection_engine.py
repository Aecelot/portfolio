import logging
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from ..memory_classes import MemoryClassifier, ClassifiedMemory
from src.npc.npc_memory_bridge import NPCMemoryBridge

logger = logging.getLogger(__name__)


@dataclass
class InjectionPlan:
    """Plan for memory injection into prompts."""

    memories_to_inject: List[ClassifiedMemory]
    injection_strategy: str  # 'priority', 'balanced', 'comprehensive'
    max_injection_length: int
    estimated_prompt_length: int
    injection_confidence: float

    def get_memory_summary(self) -> Dict[str, Any]:
        """Get summary of memories in injection plan."""
        class_counts = {}
        total_relevance = 0

        for memory in self.memories_to_inject:
            class_name = memory.memory_class.value
            class_counts[class_name] = class_counts.get(class_name, 0) + 1
            total_relevance += memory.relevance_score

        return {
            'total_memories': len(self.memories_to_inject),
            'class_distribution': class_counts,
            'average_relevance': total_relevance / len(self.memories_to_inject) if self.memories_to_inject else 0,
            'strategy': self.injection_strategy,
            'estimated_length': self.estimated_prompt_length
        }


class ContextInjectionEngine:
    """
    Intelligent context injection engine for dynamic memory surfacing.

    This engine analyzes player input, conversation context, and game state
    to intelligently surface relevant memories for prompt injection.
    """

    def __init__(self, memory_classifier: MemoryClassifier,
                 template_resolver: Optional[Any] = None,
                 memory_bridge: Optional[NPCMemoryBridge] = None):
        """
        Initialize the context injection engine.

        Args:
            memory_classifier: Memory classification engine
            template_resolver: Template variable resolver (optional)
            memory_bridge: Memory service bridge (optional)
        """
        self.memory_classifier = memory_classifier
        self.template_resolver = template_resolver
        self.memory_bridge = memory_bridge or NPCMemoryBridge()
        self.injection_rules = self._load_injection_rules()
        self.logger = logging.getLogger(__name__)

        # Performance tracking
        self.injection_stats = {
            'total_injections': 0,
            'successful_injections': 0,
            'failed_injections': 0,
            'average_injection_time': 0.0,
            'injection_times': []
        }

    def _load_injection_rules(self) -> Dict[str, Any]:
        """Load default injection rules."""
        return {
            'min_relevance': 0.6,
            'max_memories_per_injection': 5,
            'max_injection_length': 1000,
            'injection_timeout': 2.0,
            'redundancy_threshold': 0.8,
            'context_boost_factor': 1.2,
            'memory_class_limits': {
                'character': 2,
                'player': 2,
                'world': 1,
                'session': 1,
                'emotional': 1,
                'social': 1,
                'prospective': 1,
                'triggered': 3
            }
        }

    def build_injected_context(self, npc_id: str, player_input: str,
                              context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build context for injection based on player input and game state.

        Args:
            npc_id: NPC identifier
            player_input: Player's current input
            context: Template context with game state

        Returns:
            Dictionary containing injection plan and formatted context
        """
        start_time = time.time()

        try:
            # Step 1: Build memory query from player input and context
            memory_query = self._build_memory_query(player_input, context)

            # Step 2: Get relevant memories from NPC Memory Service
            raw_memories = self.memory_bridge.get_relevant_memories(npc_id, memory_query)

            if not raw_memories:
                self.logger.info(f"No memories found for NPC {npc_id}")
                return self._create_empty_injection_result()

            # Step 3: Classify memories for conceptual organization
            classified_memories = self.memory_classifier.classify_memories(
                raw_memories, {'player_input': player_input, **context})

            # Step 4: Determine what to inject based on context and rules
            injection_plan = self._create_injection_plan(
                classified_memories, player_input, context)

            # Step 5: Format memories for injection
            injected_context = self._format_injected_context(injection_plan)

            # Step 6: Update performance stats
            injection_time = time.time() - start_time
            self._update_injection_stats(True, injection_time)

            return {
                'classified_memories': classified_memories,
                'injection_plan': injection_plan,
                'injected_context': injected_context,
                'memory_query': memory_query,
                'injection_successful': True,
                'injection_time': injection_time
            }

        except Exception as e:
            injection_time = time.time() - start_time
            self.logger.error(f"Error building injected context: {e}")
            self._update_injection_stats(False, injection_time)

            return self._create_error_injection_result(str(e), injection_time)

    def _build_memory_query(self, player_input: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Build memory query from player input and context."""

        # Start with basic query structure
        query = {
            'npc_id': context.get('npc_id', ''),
            'limit': self.injection_rules['max_memories_per_injection'] * 2,  # Get more for filtering
            'relevance_threshold': self.injection_rules['min_relevance']
        }

        # Extract keywords from player input
        keywords = self._extract_keywords_from_input(player_input)
        if keywords:
            query['keywords'] = keywords[:5]  # Limit keywords

        # Add context keywords from conversation history
        conversation_keywords = self._extract_conversation_keywords(context)
        if conversation_keywords:
            query['context_keywords'] = conversation_keywords[:3]

        # Set memory types based on context
        memory_types = self._determine_memory_types(player_input, context)
        if memory_types:
            query['memory_types'] = memory_types

        # Add emotional context if present
        if 'emotional_context' in context:
            query['emotional_boost'] = True

        # Add urgency detection
        if self._detect_urgency(player_input):
            query['urgent'] = True
            query['limit'] = min(query['limit'], 3)  # Fewer but more relevant

        return query

    def _extract_keywords_from_input(self, player_input: str) -> List[str]:
        """Extract relevant keywords from player input."""
        if not player_input:
            return []

        # Simple keyword extraction (could be enhanced with NLP)
        # Remove common stop words and get meaningful terms
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}

        words = player_input.lower().split()
        keywords = []

        for word in words:
            # Remove punctuation and check length
            clean_word = word.strip('.,!?;:')
            if len(clean_word) > 3 and clean_word not in stop_words:
                keywords.append(clean_word)

        return keywords[:8]  # Limit to 8 keywords

    def _extract_conversation_keywords(self, context: Dict[str, Any]) -> List[str]:
        """Extract keywords from recent conversation history."""
        keywords = []

        if 'conversation_history' in context:
            # Look at last 3 messages
            recent_messages = context['conversation_history'][-3:] if len(context['conversation_history']) > 3 else context['conversation_history']

            for message in recent_messages:
                if 'content' in message:
                    message_keywords = self._extract_keywords_from_input(message['content'])
                    keywords.extend(message_keywords)

        return list(set(keywords))[:5]  # Remove duplicates and limit

    def _determine_memory_types(self, player_input: str, context: Dict[str, Any]) -> List[str]:
        """Determine which memory types are most relevant."""
        memory_types = []

        # Always include episodic memories (main experiences)
        memory_types.append('episodic')

        # Check for emotional content
        if self._detect_emotional_content(player_input):
            memory_types.append('emotional')

        # Check for questions about relationships
        if self._detect_relationship_questions(player_input):
            memory_types.extend(['social', 'player'])

        # Check for world/lore questions
        if self._detect_world_questions(player_input):
            memory_types.extend(['world', 'semantic'])

        # Check for character-specific questions
        if self._detect_character_questions(player_input):
            memory_types.append('character')

        # Check for planning/future discussions
        if self._detect_prospective_content(player_input):
            memory_types.append('prospective')

        return memory_types

    def _detect_emotional_content(self, text: str) -> bool:
        """Detect emotional content in text."""
        emotional_words = ['feel', 'feeling', 'emotion', 'angry', 'happy', 'sad', 'love', 'hate', 'fear']
        return any(word in text.lower() for word in emotional_words)

    def _detect_relationship_questions(self, text: str) -> bool:
        """Detect questions about relationships."""
        relationship_words = ['friend', 'enemy', 'relationship', 'love', 'trust', 'betray']
        return any(word in text.lower() for word in relationship_words)

    def _detect_world_questions(self, text: str) -> bool:
        """Detect questions about world lore."""
        world_words = ['world', 'kingdom', 'city', 'history', 'lore', 'legend', 'what happened']
        return any(word in text.lower() for word in world_words)

    def _detect_character_questions(self, text: str) -> bool:
        """Detect questions about character background."""
        character_words = ['past', 'history', 'background', 'remember', 'memory', 'childhood']
        return any(word in text.lower() for word in character_words)

    def _detect_prospective_content(self, text: str) -> bool:
        """Detect prospective/future-oriented content."""
        prospective_words = ['plan', 'future', 'going to', 'will', 'intend', 'hope', 'dream']
        return any(word in text.lower() for word in prospective_words)

    def _detect_urgency(self, text: str) -> bool:
        """Detect urgency in player input."""
        urgent_words = ['urgent', 'quickly', 'now', 'immediately', 'help', 'danger', 'threat']
        return any(word in text.lower() for word in urgent_words)

    def _create_injection_plan(self, classified_memories: List[ClassifiedMemory],
                              player_input: str, context: Dict[str, Any]) -> InjectionPlan:
        """Create injection plan from classified memories."""

        # Filter memories based on injection rules
        suitable_memories = []

        for memory in classified_memories:
            if self._should_inject_memory(memory, player_input, context):
                suitable_memories.append(memory)

        # Apply memory class limits
        limited_memories = self._apply_memory_limits(suitable_memories)

        # Select injection strategy
        strategy = self._select_injection_strategy(player_input, context, limited_memories)

        # Estimate prompt length
        estimated_length = self._estimate_injection_length(limited_memories)

        # Check against max length
        if estimated_length > self.injection_rules['max_injection_length']:
            limited_memories = self._trim_for_length(limited_memories, self.injection_rules['max_injection_length'])

        # Calculate confidence
        confidence = self._calculate_injection_confidence(limited_memories)

        return InjectionPlan(
            memories_to_inject=limited_memories,
            injection_strategy=strategy,
            max_injection_length=self.injection_rules['max_injection_length'],
            estimated_prompt_length=estimated_length,
            injection_confidence=confidence
        )

    def _should_inject_memory(self, memory: ClassifiedMemory,
                             player_input: str, context: Dict[str, Any]) -> bool:
        """Determine if a memory should be injected into the prompt."""

        # Check injection rules
        if not self._matches_injection_rules(memory, player_input):
            return False

        # Check relevance threshold
        if memory.relevance_score < self.injection_rules['min_relevance']:
            return False

        # Check context appropriateness
        if not self._is_contextually_appropriate(memory, context):
            return False

        # Check for redundancy
        if self._is_redundant_with_recent_context(memory, context):
            return False

        return True

    def _matches_injection_rules(self, memory: ClassifiedMemory, player_input: str) -> bool:
        """Check if memory matches injection rules."""

        # Check memory class limits
        class_limits = self.injection_rules['memory_class_limits']
        class_name = memory.memory_class.value

        if class_name in class_limits:
            # Count how many of this class are already planned for injection
            # For now, we'll implement this in the _apply_memory_limits method

            # Basic check - if memory class is allowed
            return True

        return True

    def _is_contextually_appropriate(self, memory: ClassifiedMemory, context: Dict[str, Any]) -> bool:
        """Check if memory is contextually appropriate."""

        # Check for conflicting emotional states
        if 'emotional_context' in context:
            context_emotion = context['emotional_context'].lower()
            memory_emotion = memory.get_raw_value('emotional_state', '').lower()

            # Avoid injecting conflicting emotional memories
            if context_emotion and memory_emotion:
                emotion_conflicts = [
                    ('happy' in context_emotion and 'sad' in memory_emotion),
                    ('sad' in context_emotion and 'happy' in memory_emotion),
                    ('angry' in context_emotion and 'calm' in memory_emotion)
                ]
                if any(emotion_conflicts):
                    return False

        return True

    def _is_redundant_with_recent_context(self, memory: ClassifiedMemory, context: Dict[str, Any]) -> bool:
        """Check if memory is redundant with recent context."""

        # Check conversation history for similar content
        if 'conversation_history' in context:
            recent_messages = context['conversation_history'][-2:]  # Last 2 messages

            for message in recent_messages:
                if 'content' in message:
                    # Simple redundancy check - if similar keywords appear
                    message_keywords = set(message['content'].lower().split())
                    memory_keywords = set(word.lower() for word in memory.context_keywords)

                    overlap = len(message_keywords.intersection(memory_keywords))
                    if overlap / len(memory_keywords) > self.injection_rules['redundancy_threshold']:
                        return True

        return False

    def _apply_memory_limits(self, memories: List[ClassifiedMemory]) -> List[ClassifiedMemory]:
        """Apply memory class limits to injection candidates."""

        class_limits = self.injection_rules['memory_class_limits']
        class_counts = {}

        limited_memories = []

        # Sort memories by relevance (highest first)
        sorted_memories = sorted(memories, key=lambda x: x.relevance_score, reverse=True)

        for memory in sorted_memories:
            class_name = memory.memory_class.value

            # Check if we've reached the limit for this class
            if class_name in class_limits:
                if class_counts.get(class_name, 0) >= class_limits[class_name]:
                    continue  # Skip this memory class

            # Add memory and update count
            limited_memories.append(memory)
            class_counts[class_name] = class_counts.get(class_name, 0) + 1

        return limited_memories

    def _select_injection_strategy(self, player_input: str, context: Dict[str, Any],
                                  memories: List[ClassifiedMemory]) -> str:
        """Select injection strategy based on context."""

        # Simple strategy selection
        if self._detect_urgency(player_input):
            return 'priority'  # Focus on most relevant memories

        elif len(memories) > 3:
            return 'balanced'  # Mix of memory types

        else:
            return 'comprehensive'  # Include all suitable memories

    def _estimate_injection_length(self, memories: List[ClassifiedMemory]) -> int:
        """Estimate total length of injection text."""

        total_length = 0

        for memory in memories:
            # Rough estimation: average memory description length + formatting
            memory_length = len(memory.formatted_content) + 50  # Add buffer for formatting
            total_length += memory_length

        return total_length

    def _trim_for_length(self, memories: List[ClassifiedMemory], max_length: int) -> List[ClassifiedMemory]:
        """Trim memories to fit within length limit."""

        current_length = 0
        trimmed_memories = []

        for memory in memories:
            memory_length = len(memory.formatted_content) + 50

            if current_length + memory_length <= max_length:
                trimmed_memories.append(memory)
                current_length += memory_length
            else:
                break  # Can't add more without exceeding limit

        return trimmed_memories

    def _calculate_injection_confidence(self, memories: List[ClassifiedMemory]) -> float:
        """Calculate confidence score for injection plan."""

        if not memories:
            return 0.0

        # Average relevance score
        avg_relevance = sum(m.relevance_score for m in memories) / len(memories)

        # Diversity bonus (more memory classes = higher confidence)
        class_count = len(set(m.memory_class.value for m in memories))
        diversity_bonus = min(class_count * 0.1, 0.3)

        return min(avg_relevance + diversity_bonus, 1.0)

    def _format_injected_context(self, injection_plan: InjectionPlan) -> Dict[str, str]:
        """Format memories for prompt injection."""

        if not injection_plan.memories_to_inject:
            return {
                'memory_section': 'No relevant memories available.',
                'formatted_memories': '',
                'injection_summary': 'No memories injected'
            }

        # Group memories by class for better organization
        class_groups = {}
        for memory in injection_plan.memories_to_inject:
            class_name = memory.memory_class.value.title()
            if class_name not in class_groups:
                class_groups[class_name] = []
            class_groups[class_name].append(memory)

        # Format each group
        formatted_sections = []
        all_memories_text = []

        for class_name, memories in class_groups.items():
            section_memories = []

            for memory in memories:
                # Mark as injected for tracking
                memory.mark_injected()

                # Format individual memory
                memory_text = memory.formatted_content
                if memory.get_raw_value('importance', 0) > 0.8:
                    memory_text = f"**{memory_text}**"

                section_memories.append(f"• {memory_text}")
                all_memories_text.append(memory_text)

            # Add section header
            section_content = f"**{class_name} Memories:**\n" + "\n".join(section_memories)
            formatted_sections.append(section_content)

        # Combine all sections
        memory_section = "\n\n".join(formatted_sections)

        return {
            'memory_section': memory_section,
            'formatted_memories': '\n'.join(all_memories_text),
            'injection_summary': f"Injected {len(injection_plan.memories_to_inject)} memories using {injection_plan.injection_strategy} strategy"
        }

    def _create_empty_injection_result(self) -> Dict[str, Any]:
        """Create result when no memories are found."""
        return {
            'classified_memories': [],
            'injection_plan': InjectionPlan([], 'none', 0, 0, 0.0),
            'injected_context': {
                'memory_section': 'No relevant memories found.',
                'formatted_memories': '',
                'injection_summary': 'No memories available'
            },
            'memory_query': {},
            'injection_successful': True,
            'injection_time': 0.0
        }

    def _create_error_injection_result(self, error: str, injection_time: float) -> Dict[str, Any]:
        """Create result when injection fails."""
        return {
            'classified_memories': [],
            'injection_plan': InjectionPlan([], 'error', 0, 0, 0.0),
            'injected_context': {
                'memory_section': 'Error retrieving memories.',
                'formatted_memories': '',
                'injection_summary': f'Injection failed: {error}'
            },
            'memory_query': {},
            'injection_successful': False,
            'injection_time': injection_time,
            'error': error
        }

    def _update_injection_stats(self, success: bool, injection_time: float) -> None:
        """Update injection performance statistics."""

        self.injection_stats['total_injections'] += 1

        if success:
            self.injection_stats['successful_injections'] += 1
        else:
            self.injection_stats['failed_injections'] += 1

        # Update average injection time
        self.injection_stats['injection_times'].append(injection_time)
        if len(self.injection_stats['injection_times']) > 100:
            self.injection_stats['injection_times'] = self.injection_stats['injection_times'][-100:]

        self.injection_stats['average_injection_time'] = (
            sum(self.injection_stats['injection_times']) / len(self.injection_stats['injection_times'])
        )

    def get_injection_stats(self) -> Dict[str, Any]:
        """Get injection engine statistics."""
        return self.injection_stats.copy()

    def reset_stats(self) -> None:
        """Reset injection statistics."""
        self.injection_stats = {
            'total_injections': 0,
            'successful_injections': 0,
            'failed_injections': 0,
            'average_injection_time': 0.0,
            'injection_times': []
        }