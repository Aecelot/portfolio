import time
import logging
import re
from typing import Dict, Any, Optional, List, Callable
from .variable_types import TemplateVariable, TemplateContext

logger = logging.getLogger(__name__)


class TemplateVariableResolver:
    """Resolves template variables with caching and dependency management."""

    def __init__(self, memory_service, context: TemplateContext):
        self.memory_service = memory_service
        self.context = context
        self.cache: Dict[str, tuple[str, float]] = {}
        self.variables: Dict[str, TemplateVariable] = {}
        self._initialize_variables()

    def _initialize_variables(self):
        """Initialize all available template variables including complex compositions."""
        # Base chat frontend variables
        self.variables['{{char}}'] = TemplateVariable(
            name='{{char}}',
            description='Character name',
            resolver_func=self._resolve_character_name,
            cache_duration=300  # 5 minutes
        )

        self.variables['{{user}}'] = TemplateVariable(
            name='{{user}}',
            description='Player character name',
            resolver_func=self._resolve_player_name,
            cache_duration=60  # 1 minute
        )

        self.variables['{{time}}'] = TemplateVariable(
            name='{{time}}',
            description='Current game time',
            resolver_func=self._resolve_current_time,
            cache_duration=30  # 30 seconds
        )

        self.variables['{{date}}'] = TemplateVariable(
            name='{{date}}',
            description='Current game date',
            resolver_func=self._resolve_current_date,
            cache_duration=60  # 1 minute
        )

        self.variables['{{location}}'] = TemplateVariable(
            name='{{location}}',
            description='Current location name',
            resolver_func=self._resolve_current_location,
            cache_duration=120  # 2 minutes
        )

        self.variables['{{scene}}'] = TemplateVariable(
            name='{{scene}}',
            description='Current scene description',
            resolver_func=self._resolve_current_scene,
            cache_duration=180  # 3 minutes
        )

        # Memory-enhanced variables
        self.variables['{{emotional_state}}'] = TemplateVariable(
            name='{{emotional_state}}',
            description="Character's current emotional state",
            resolver_func=self._resolve_emotional_state,
            cache_duration=30,  # 30 seconds
            variable_type="memory_enhanced"
        )

        self.variables['{{recent_memories}}'] = TemplateVariable(
            name='{{recent_memories}}',
            description='Recent episodic memories',
            resolver_func=self._resolve_recent_memories,
            cache_duration=60,  # 1 minute
            variable_type="memory_enhanced"
        )

        self.variables['{{relationship_status}}'] = TemplateVariable(
            name='{{relationship_status}}',
            description='Social relationship with player',
            resolver_func=self._resolve_relationship_status,
            cache_duration=120,  # 2 minutes
            variable_type="memory_enhanced"
        )

        self.variables['{{character_goals}}'] = TemplateVariable(
            name='{{character_goals}}',
            description='Active prospective memories',
            resolver_func=self._resolve_character_goals,
            cache_duration=180,  # 3 minutes
            variable_type="memory_enhanced"
        )

        self.variables['{{world_context}}'] = TemplateVariable(
            name='{{world_context}}',
            description='Relevant world lore and setting',
            resolver_func=self._resolve_world_context,
            cache_duration=300,  # 5 minutes
            variable_type="memory_enhanced"
        )

        self.variables['{{session_context}}'] = TemplateVariable(
            name='{{session_context}}',
            description='Current conversation context',
            resolver_func=self._resolve_session_context,
            cache_duration=60,  # 1 minute
            variable_type="memory_enhanced"
        )

        # Complex composite variables
        self.variables['{{char_personality}}'] = TemplateVariable(
            name='{{char_personality}}',
            description='Character personality summary',
            resolver_func=self._resolve_character_personality,
            cache_duration=600,  # 10 minutes
            variable_type="composite"
        )

        self.variables['{{relationship_history}}'] = TemplateVariable(
            name='{{relationship_history}}',
            description='Complete relationship history with player',
            resolver_func=self._resolve_relationship_history,
            cache_duration=300,  # 5 minutes
            variable_type="composite"
        )

        self.variables['{{current_situation}}'] = TemplateVariable(
            name='{{current_situation}}',
            description='Current situation and context summary',
            resolver_func=self._resolve_current_situation,
            cache_duration=60,  # 1 minute
            variable_type="composite"
        )

        self.variables['{{char_background}}'] = TemplateVariable(
            name='{{char_background}}',
            description='Character background and history',
            resolver_func=self._resolve_character_background,
            cache_duration=900,  # 15 minutes
            variable_type="composite"
        )

        self.variables['{{conversation_summary}}'] = TemplateVariable(
            name='{{conversation_summary}}',
            description='Summary of recent conversation',
            resolver_func=self._resolve_conversation_summary,
            cache_duration=120,  # 2 minutes
            variable_type="composite"
        )

        # Custom derived variables
        self.variables['{{char_mood}}'] = TemplateVariable(
            name='{{char_mood}}',
            description='Character mood based on recent events',
            resolver_func=self._resolve_character_mood,
            cache_duration=45,  # 45 seconds
            variable_type="derived"
        )

        self.variables['{{urgency_level}}'] = TemplateVariable(
            name='{{urgency_level}}',
            description='Current situation urgency level',
            resolver_func=self._resolve_urgency_level,
            cache_duration=30,  # 30 seconds
            variable_type="derived"
        )

        self.variables['{{memory_count}}'] = TemplateVariable(
            name='{{memory_count}}',
            description='Number of relevant memories',
            resolver_func=self._resolve_memory_count,
            cache_duration=60,  # 1 minute
            variable_type="derived"
        )

        # Initialize variable dependencies
        self._initialize_variable_dependencies()

    def resolve_variable(self, var_name: str, force_refresh: bool = False) -> str:
        """Resolve a template variable with caching."""
        if var_name not in self.variables:
            logger.warning(f"Unknown template variable: {var_name}")
            return f"{{{var_name}}}"

        variable = self.variables[var_name]
        cache_key = f"{var_name}:{self.context.npc_id}:{self.context.session_id}"

        # Check cache unless force refresh is requested
        if not force_refresh and cache_key in self.cache:
            cached_result, cache_time = self.cache[cache_key]
            if time.time() - cache_time < variable.cache_duration:
                return cached_result

        try:
            # Resolve variable based on type
            result = variable.resolver_func()

            # Cache the result
            self.cache[cache_key] = (result, time.time())
            return result

        except Exception as e:
            logger.error(f"Error resolving variable {var_name}: {e}")
            return f"{{{var_name}_ERROR}}"

    def resolve_all_variables(self, force_refresh: bool = False) -> Dict[str, str]:
        """Resolve all template variables and return as dictionary."""
        resolved = {}
        for var_name in self.variables:
            resolved[var_name] = self.resolve_variable(var_name, force_refresh)
        return resolved

    def clear_cache(self, pattern: Optional[str] = None):
        """Clear cache entries, optionally filtered by pattern."""
        if pattern is None:
            self.cache.clear()
        else:
            keys_to_remove = [key for key in self.cache.keys() if pattern in key]
            for key in keys_to_remove:
                del self.cache[key]

    # Base variable resolvers
    def _resolve_character_name(self) -> str:
        """Resolve {{char}} variable."""
        if self.context.character_data and 'name' in self.context.character_data:
            return self.context.character_data['name']
        return self.context.npc_id  # Fallback to NPC ID

    def _resolve_player_name(self) -> str:
        """Resolve {{user}} variable."""
        if self.context.player_data and 'name' in self.context.player_data:
            return self.context.player_data['name']
        return self.context.player_id  # Fallback to player ID

    def _resolve_current_time(self) -> str:
        """Resolve {{time}} variable."""
        return self.context.current_time.strftime("%H:%M")

    def _resolve_current_date(self) -> str:
        """Resolve {{date}} variable."""
        return self.context.current_time.strftime("%Y-%m-%d")

    def _resolve_current_location(self) -> str:
        """Resolve {{location}} variable."""
        if self.context.location_context and 'name' in self.context.location_context:
            return self.context.location_context['name']
        return "Unknown Location"

    def _resolve_current_scene(self) -> str:
        """Resolve {{scene}} variable."""
        if self.context.location_context and 'description' in self.context.location_context:
            return self.context.location_context['description']
        return "No scene description available"

    # Memory-enhanced variable resolvers
    def _resolve_emotional_state(self) -> str:
        """Resolve {{emotional_state}} variable."""
        if not self.memory_service:
            return "neutral"

        try:
            # Get recent emotional memories
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['emotional'],
                'limit': 3
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if memories:
                # Extract emotional states from memories
                emotional_states = []
                for memory in memories:
                    if 'emotional_state' in memory:
                        emotional_states.append(memory['emotional_state'])

                if emotional_states:
                    # Return most recent emotional state
                    return emotional_states[0]

            return "neutral"
        except Exception as e:
            logger.error(f"Error resolving emotional state: {e}")
            return "neutral"

    def _resolve_recent_memories(self) -> str:
        """Resolve {{recent_memories}} variable."""
        if not self.memory_service:
            return "No recent memories available"

        try:
            # Get recent episodic memories
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['episodic'],
                'limit': 3,
                'timeframe': 'recent'
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if not memories:
                return "No recent memories"

            # Format memories as bullet points
            formatted_memories = []
            for memory in memories:
                if 'description' in memory:
                    formatted_memories.append(f"• {memory['description']}")

            return "\n".join(formatted_memories)
        except Exception as e:
            logger.error(f"Error resolving recent memories: {e}")
            return "Error retrieving memories"

    def _resolve_relationship_status(self) -> str:
        """Resolve {{relationship_status}} variable."""
        if not self.memory_service:
            return "acquaintance"

        try:
            # Get relationship memories with player
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['social', 'relationship'],
                'limit': 5
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if memories:
                # Analyze relationship from memories
                positive_count = 0
                negative_count = 0

                for memory in memories:
                    if 'sentiment' in memory:
                        if memory['sentiment'] > 0.5:
                            positive_count += 1
                        elif memory['sentiment'] < -0.5:
                            negative_count += 1

                total = len(memories)
                if total == 0:
                    return "acquaintance"

                # Determine relationship based on sentiment analysis
                if positive_count / total > 0.7:
                    return "close friend"
                elif positive_count / total > 0.4:
                    return "friend"
                elif negative_count / total > 0.6:
                    return "enemy"
                elif negative_count / total > 0.3:
                    return "rival"
                else:
                    return "acquaintance"

            return "acquaintance"
        except Exception as e:
            logger.error(f"Error resolving relationship status: {e}")
            return "acquaintance"

    def _resolve_character_goals(self) -> str:
        """Resolve {{character_goals}} variable."""
        if not self.memory_service:
            return "No active goals"

        try:
            # Get prospective memories (goals and intentions)
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['prospective'],
                'limit': 3
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if not memories:
                return "No active goals"

            # Format goals as bullet points
            formatted_goals = []
            for memory in memories:
                if 'goal' in memory:
                    formatted_goals.append(f"• {memory['goal']}")
                elif 'intention' in memory:
                    formatted_goals.append(f"• {memory['intention']}")

            return "\n".join(formatted_goals) if formatted_goals else "No active goals"
        except Exception as e:
            logger.error(f"Error resolving character goals: {e}")
            return "No active goals"

    def _resolve_world_context(self) -> str:
        """Resolve {{world_context}} variable."""
        if not self.memory_service:
            return "No world context available"

        try:
            # Get world lore and setting memories
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['world', 'lore'],
                'limit': 3
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if not memories:
                return "No world context"

            # Format world context
            formatted_context = []
            for memory in memories:
                if 'description' in memory:
                    formatted_context.append(memory['description'])

            return " ".join(formatted_context) if formatted_context else "No world context"
        except Exception as e:
            logger.error(f"Error resolving world context: {e}")
            return "No world context"

    def _resolve_session_context(self) -> str:
        """Resolve {{session_context}} variable."""
        if not self.context.conversation_history:
            return "New conversation"

        # Get recent conversation context
        recent_messages = self.context.conversation_history[-3:] if len(self.context.conversation_history) > 3 else self.context.conversation_history

        formatted_context = []
        for msg in recent_messages:
            if 'sender' in msg and 'content' in msg:
                formatted_context.append(f"{msg['sender']}: {msg['content']}")

        return "\n".join(formatted_context) if formatted_context else "No conversation context"

    # Complex composite variable resolvers
    def _resolve_character_personality(self) -> str:
        """Resolve {{char_personality}} - composite personality summary."""
        if not self.memory_service:
            return "Complex and multifaceted"

        try:
            # Get personality-related memories
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['character', 'personality'],
                'limit': 5
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if not memories:
                return "Complex and multifaceted"

            # Extract personality traits
            traits = []
            for memory in memories:
                description = memory.get('description', '')
                # Extract adjectives and personality descriptors
                trait_matches = re.findall(r'\b\w+ly\b|\b\w+ive\b|\b\w+ant\b|\b\w+ful\b|\b\w+less\b',
                                         description, re.IGNORECASE)
                traits.extend(trait_matches[:2])  # Limit traits per memory

            if traits:
                return ", ".join(traits[:5])  # Return top 5 traits
            else:
                return "Complex and multifaceted"

        except Exception as e:
            logger.error(f"Error resolving character personality: {e}")
            return "Complex and multifaceted"

    def _resolve_relationship_history(self) -> str:
        """Resolve {{relationship_history}} - complete relationship summary."""
        if not self.memory_service:
            return "Limited interaction history"

        try:
            # Get all interaction memories with player
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['player', 'social', 'interaction'],
                'limit': 10
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if not memories:
                return "New acquaintance"

            # Analyze relationship progression
            positive_interactions = 0
            negative_interactions = 0
            total_interactions = len(memories)

            for memory in memories:
                sentiment = memory.get('sentiment', 0)
                if sentiment > 0.3:
                    positive_interactions += 1
                elif sentiment < -0.3:
                    negative_interactions += 1

            # Generate relationship summary
            if positive_interactions > negative_interactions * 2:
                return f"Trusted ally with {total_interactions} positive interactions"
            elif negative_interactions > positive_interactions * 2:
                return f"Adversarial relationship with {total_interactions} interactions"
            else:
                return f"Complex relationship with {total_interactions} interactions"

        except Exception as e:
            logger.error(f"Error resolving relationship history: {e}")
            return "Limited interaction history"

    def _resolve_current_situation(self) -> str:
        """Resolve {{current_situation}} - composite situation summary."""
        components = []

        # Location component
        location = self.resolve_variable('{{location}}')
        if location != "Unknown Location":
            components.append(f"At {location}")

        # Time component
        time = self.resolve_variable('{{time}}')
        components.append(f"At {time}")

        # Emotional state component
        emotion = self.resolve_variable('{{emotional_state}}')
        if emotion != "neutral":
            components.append(f"Feeling {emotion}")

        # Recent context
        if self.context.conversation_history:
            recent_count = min(len(self.context.conversation_history), 3)
            components.append(f"After {recent_count} exchanges")

        return " | ".join(components) if components else "In conversation"

    def _resolve_character_background(self) -> str:
        """Resolve {{char_background}} - character background summary."""
        if not self.memory_service:
            return "Character with a rich history"

        try:
            # Get background memories
            query = {
                'npc_id': self.context.npc_id,
                'memory_types': ['character', 'background', 'history'],
                'limit': 5
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            if not memories:
                return "Character with a rich history"

            # Compile background summary
            background_elements = []
            for memory in memories:
                description = memory.get('description', '')
                if len(description) > 20:  # Only substantial descriptions
                    background_elements.append(description)

            if background_elements:
                return ". ".join(background_elements[:3])  # Top 3 elements
            else:
                return "Character with a rich history"

        except Exception as e:
            logger.error(f"Error resolving character background: {e}")
            return "Character with a rich history"

    def _resolve_conversation_summary(self) -> str:
        """Resolve {{conversation_summary}} - summary of recent conversation."""
        if not self.context.conversation_history:
            return "New conversation"

        # Analyze conversation history
        messages = self.context.conversation_history[-5:]  # Last 5 messages

        player_messages = [msg for msg in messages if msg.get('sender') == 'player']
        npc_messages = [msg for msg in messages if msg.get('sender') == self.context.npc_id]

        summary_parts = []

        if player_messages:
            last_player_msg = player_messages[-1].get('content', '')
            if len(last_player_msg) > 100:
                summary_parts.append("Responding to lengthy query")
            else:
                summary_parts.append("Responding to recent question")

        if len(messages) > 3:
            summary_parts.append("In ongoing conversation")
        else:
            summary_parts.append("In new conversation")

        return " | ".join(summary_parts) if summary_parts else "In conversation"

    # Custom derived variable resolvers
    def _resolve_character_mood(self) -> str:
        """Resolve {{char_mood}} - current character mood."""
        base_emotion = self.resolve_variable('{{emotional_state}}')

        # Enhance mood based on recent context
        mood_modifiers = []

        if self.context.conversation_history:
            recent_messages = self.context.conversation_history[-2:]
            for msg in recent_messages:
                content = msg.get('content', '').lower()
                if any(word in content for word in ['happy', 'great', 'wonderful']):
                    mood_modifiers.append('positive')
                elif any(word in content for word in ['sad', 'terrible', 'awful']):
                    mood_modifiers.append('negative')

        # Combine base emotion with modifiers
        if mood_modifiers and mood_modifiers[0] == 'positive' and base_emotion == 'neutral':
            return 'good'
        elif mood_modifiers and mood_modifiers[0] == 'negative' and base_emotion == 'neutral':
            return 'somber'
        else:
            return base_emotion

    def _resolve_urgency_level(self) -> str:
        """Resolve {{urgency_level}} - current situation urgency."""
        # Analyze recent conversation for urgency indicators
        if not self.context.conversation_history:
            return "normal"

        recent_content = ' '.join([
            msg.get('content', '') for msg in self.context.conversation_history[-3:]
        ]).lower()

        urgent_words = ['urgent', 'quickly', 'now', 'immediately', 'help', 'danger', 'threat']
        question_marks = recent_content.count('?')
        exclamation_marks = recent_content.count('!')

        urgency_score = 0
        urgency_score += sum(1 for word in urgent_words if word in recent_content)
        urgency_score += question_marks * 0.5
        urgency_score += exclamation_marks * 0.3

        if urgency_score >= 2:
            return "high"
        elif urgency_score >= 1:
            return "elevated"
        else:
            return "normal"

    def _resolve_memory_count(self) -> str:
        """Resolve {{memory_count}} - number of relevant memories."""
        if not self.memory_service:
            return "0"

        try:
            # Get count of relevant memories
            query = {
                'npc_id': self.context.npc_id,
                'limit': 100  # Get max to count
            }
            memories = self.memory_service.GetRelevantMemories(self.context.npc_id, query)

            return str(len(memories) if memories else 0)

        except Exception as e:
            logger.error(f"Error resolving memory count: {e}")
            return "0"

    def _initialize_variable_dependencies(self):
        """Initialize variable dependencies for complex compositions."""
        # Define which variables depend on others
        self.variable_dependencies = {
            '{{current_situation}}': ['{{location}}', '{{time}}', '{{emotional_state}}'],
            '{{char_personality}}': ['{{emotional_state}}', '{{character_goals}}'],
            '{{relationship_history}}': ['{{relationship_status}}', '{{recent_memories}}'],
            '{{char_mood}}': ['{{emotional_state}}'],
            '{{conversation_summary}}': ['{{session_context}}']
        }

    def resolve_variable_with_dependencies(self, var_name: str, force_refresh: bool = False) -> str:
        """Resolve variable including its dependencies."""
        # First resolve dependencies
        if var_name in self.variable_dependencies:
            for dep_var in self.variable_dependencies[var_name]:
                self.resolve_variable(dep_var, force_refresh)

        # Then resolve the main variable
        return self.resolve_variable(var_name, force_refresh)