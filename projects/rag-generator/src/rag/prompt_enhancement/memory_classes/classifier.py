import re
import logging
import math
import time
from typing import Dict, List, Any, Optional, Tuple
from collections import Counter
from .memory_types import MemoryClass, ClassifiedMemory, MemoryClassificationStats

logger = logging.getLogger(__name__)


class MemoryClassifier:
    """
    Classifies raw memories into conceptual categories for intelligent prompt injection.

    This classifier analyzes memories from the NPC Memory Service and organizes them
    into categories like character, player, world, session, and triggered memories
    for optimal prompt construction.
    """

    def __init__(self, memory_service=None, classification_rules: Optional['ClassificationRules'] = None):
        """
        Initialize the memory classifier.

        Args:
            memory_service: NPC Memory Service instance for additional context
            classification_rules: Custom classification rules (optional)
        """
        self.memory_service = memory_service
        self.classification_rules = classification_rules or ClassificationRules()
        self.stats = MemoryClassificationStats()
        self.logger = logging.getLogger(__name__)

    def classify_memories(self, memories: List[Dict[str, Any]],
                         context: Dict[str, Any]) -> List[ClassifiedMemory]:
        """
        Classify raw memories into conceptual categories.

        Args:
            memories: List of raw memory dictionaries from NPC Memory Service
            context: Context information for classification decisions

        Returns:
            List of classified memories sorted by injection priority
        """
        classified = []

        for memory in memories:
            try:
                # Determine memory class based on content and context
                memory_class = self._determine_memory_class(memory, context)

                # Calculate relevance to current context
                relevance_score = self._calculate_relevance(memory, context)

                # Format for prompt injection
                formatted_content = self._format_for_class(memory, memory_class)

                # Determine injection priority
                injection_priority = self._calculate_injection_priority(
                    memory_class, relevance_score, context)

                # Extract context keywords
                context_keywords = self._extract_keywords(memory)

                # Create classified memory
                classified_memory = ClassifiedMemory(
                    raw_memory=memory,
                    memory_class=memory_class,
                    relevance_score=relevance_score,
                    context_keywords=context_keywords,
                    formatted_content=formatted_content,
                    injection_priority=injection_priority
                )

                classified.append(classified_memory)

                # Record statistics
                self.stats.record_classification(memory_class, 1.0)

            except Exception as e:
                self.logger.error(f"Error classifying memory: {e}")
                self.stats.record_error()
                continue

        # Sort by injection priority (highest first)
        classified.sort(key=lambda x: x.injection_priority, reverse=True)

        return classified

    def classify_single_memory(self, memory: Dict[str, Any],
                              context: Dict[str, Any]) -> ClassifiedMemory:
        """
        Classify a single memory.

        Args:
            memory: Single raw memory dictionary
            context: Context information for classification

        Returns:
            Single classified memory
        """
        classified = self.classify_memories([memory], context)
        if classified:
            return classified[0]
        else:
            # Return a default classification if classification fails
            return ClassifiedMemory(
                raw_memory=memory,
                memory_class=MemoryClass.SESSION,
                relevance_score=0.5,
                formatted_content=str(memory)
            )

    def _determine_memory_class(self, memory: Dict[str, Any],
                               context: Dict[str, Any]) -> MemoryClass:
        """Determine memory class based on content and context."""

        # Get memory content for analysis
        description = memory.get('description', '').lower()
        memory_type = memory.get('memory_type', '').lower()

        # Character memories - Personal history, personality, long-term goals
        if self._is_character_memory(memory, context):
            return MemoryClass.CHARACTER

        # Player memories - Direct interactions with player
        if self._is_player_memory(memory, context):
            return MemoryClass.PLAYER

        # World memories - Lore, setting information, historical events
        if self._is_world_memory(memory, context):
            return MemoryClass.WORLD

        # Session memories - Current conversation topics, immediate context
        if self._is_session_memory(memory, context):
            return MemoryClass.SESSION

        # Emotional memories - Emotional states and reactions
        if self._is_emotional_memory(memory, context):
            return MemoryClass.EMOTIONAL

        # Social memories - Relationships and social interactions
        if self._is_social_memory(memory, context):
            return MemoryClass.SOCIAL

        # Prospective memories - Intentions, plans, goals
        if self._is_prospective_memory(memory, context):
            return MemoryClass.PROSPECTIVE

        # Triggered memories - Conditional memories activated by keywords
        if self._is_triggered_memory(memory, context):
            return MemoryClass.TRIGGERED

        # Default to session memory
        return MemoryClass.SESSION

    def _is_character_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is character-related."""
        description = memory.get('description', '').lower()

        character_keywords = [
            'personality', 'trait', 'characteristic', 'personal history',
            'background', 'origin', 'upbringing', 'childhood', 'past',
            'belief', 'value', 'principle', 'motivation', 'goal',
            'fear', 'desire', 'ambition', 'secret', 'trauma'
        ]

        # Check for character-related keywords
        for keyword in character_keywords:
            if keyword in description:
                return True

        # Check if memory type indicates character memory
        memory_type = memory.get('memory_type', '').lower()
        if memory_type in ['personality', 'background', 'character']:
            return True

        return False

    def _is_player_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is player-related."""
        description = memory.get('description', '').lower()

        player_keywords = [
            'player', 'adventurer', 'hero', 'you told me', 'you said',
            'we fought', 'we talked', 'you helped', 'you betrayed',
            'shared experience', 'together', 'with you'
        ]

        # Check for player-related keywords
        for keyword in player_keywords:
            if keyword in description:
                return True

        # Check if memory type indicates player memory
        memory_type = memory.get('memory_type', '').lower()
        if memory_type in ['interaction', 'player', 'shared']:
            return True

        return False

    def _is_world_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is world-related."""
        description = memory.get('description', '').lower()

        world_keywords = [
            'kingdom', 'city', 'town', 'village', 'world', 'realm',
            'history', 'lore', 'legend', 'myth', 'culture', 'tradition',
            'law', 'custom', 'location', 'place', 'geography',
            'politics', 'government', 'faction', 'organization'
        ]

        # Check for world-related keywords
        for keyword in world_keywords:
            if keyword in description:
                return True

        # Check if memory type indicates world memory
        memory_type = memory.get('memory_type', '').lower()
        if memory_type in ['world', 'lore', 'location', 'historical']:
            return True

        return False

    def _is_session_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is session-related."""
        description = memory.get('description', '').lower()

        session_keywords = [
            'recently', 'just now', 'earlier today', 'this morning',
            'conversation', 'discussion', 'talked about', 'mentioned',
            'current', 'ongoing', 'immediate', 'right now'
        ]

        # Check for session-related keywords
        for keyword in session_keywords:
            if keyword in description:
                return True

        # Check if memory type indicates session memory
        memory_type = memory.get('memory_type', '').lower()
        if memory_type in ['session', 'conversation', 'immediate']:
            return True

        return False

    def _is_emotional_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is emotional."""
        # Check for emotional state
        if 'emotional_state' in memory and memory['emotional_state']:
            return True

        description = memory.get('description', '').lower()

        emotional_keywords = [
            'angry', 'happy', 'sad', 'fearful', 'excited', 'nervous',
            'love', 'hate', 'joy', 'sorrow', 'rage', 'terror',
            'emotion', 'feeling', 'mood', 'sentiment'
        ]

        # Check for emotional keywords
        for keyword in emotional_keywords:
            if keyword in description:
                return True

        return False

    def _is_social_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is social/relationship-related."""
        description = memory.get('description', '').lower()

        social_keywords = [
            'friend', 'enemy', 'ally', 'rival', 'relationship',
            'love', 'hate', 'trust', 'betray', 'loyal',
            'family', 'kin', 'bond', 'connection', 'social'
        ]

        # Check for social keywords
        for keyword in social_keywords:
            if keyword in description:
                return True

        # Check if memory type indicates social memory
        memory_type = memory.get('memory_type', '').lower()
        if memory_type in ['social', 'relationship', 'interaction']:
            return True

        return False

    def _is_prospective_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is prospective (future-oriented)."""
        description = memory.get('description', '').lower()

        prospective_keywords = [
            'plan', 'intend', 'will do', 'going to', 'future',
            'goal', 'objective', 'aim', 'purpose', 'ambition',
            'dream', 'aspiration', 'hope', 'expect'
        ]

        # Check for prospective keywords
        for keyword in prospective_keywords:
            if keyword in description:
                return True

        # Check if memory type indicates prospective memory
        memory_type = memory.get('memory_type', '').lower()
        if memory_type in ['prospective', 'goal', 'intention', 'plan']:
            return True

        return False

    def _is_triggered_memory(self, memory: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Check if memory is triggered (activated by specific conditions)."""
        # Check for trigger conditions in memory
        if 'trigger_keywords' in memory or 'activation_conditions' in memory:
            return True

        description = memory.get('description', '').lower()

        trigger_keywords = [
            'whenever', 'when', 'if', 'triggered', 'reminded',
            'memory', 'remember', 'recall', 'think back'
        ]

        # Check for trigger keywords
        for keyword in trigger_keywords:
            if keyword in description:
                return True

        return False

    def _calculate_relevance(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate relevance score for a memory using ML-based algorithms."""
        relevance = 0.5  # Base relevance

        # Use advanced ML-based relevance scoring
        ml_relevance = self._calculate_ml_relevance(memory, context)
        relevance = (relevance + ml_relevance) / 2

        # Importance boost (weighted)
        if 'importance' in memory:
            relevance += memory['importance'] * 0.15

        # Recency boost (enhanced with decay function)
        if 'timestamp' in memory:
            recency_boost = self._calculate_recency_boost(memory['timestamp'], context)
            relevance += recency_boost

        # Context alignment boost
        context_alignment = self._calculate_context_alignment(memory, context)
        relevance += context_alignment * 0.1

        return min(relevance, 1.0)

    def _calculate_ml_relevance(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate relevance using machine learning-inspired algorithms."""
        relevance = 0.0

        # 1. Semantic similarity scoring
        semantic_score = self._calculate_semantic_similarity(memory, context)
        relevance += semantic_score * 0.4

        # 2. Keyword overlap with TF-IDF inspired scoring
        keyword_score = self._calculate_keyword_relevance(memory, context)
        relevance += keyword_score * 0.3

        # 3. Context pattern matching
        pattern_score = self._calculate_pattern_relevance(memory, context)
        relevance += pattern_score * 0.2

        # 4. Memory freshness scoring
        freshness_score = self._calculate_memory_freshness(memory, context)
        relevance += freshness_score * 0.1

        return min(relevance, 1.0)

    def _calculate_semantic_similarity(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate semantic similarity between memory and context."""
        memory_text = memory.get('description', '').lower()
        context_text = ' '.join(context.get('keywords', [])).lower()

        if not memory_text or not context_text:
            return 0.0

        # Simple semantic similarity using word overlap and n-grams
        memory_words = set(re.findall(r'\b\w{3,}\b', memory_text))
        context_words = set(re.findall(r'\b\w{3,}\b', context_text))

        # Jaccard similarity for word overlap
        if memory_words or context_words:
            intersection = len(memory_words.intersection(context_words))
            union = len(memory_words.union(context_words))
            jaccard_sim = intersection / union if union > 0 else 0.0

            # N-gram similarity (bigrams)
            memory_bigrams = set(self._get_ngrams(memory_text, 2))
            context_bigrams = set(self._get_ngrams(context_text, 2))

            if memory_bigrams or context_bigrams:
                bigram_intersection = len(memory_bigrams.intersection(context_bigrams))
                bigram_union = len(memory_bigrams.union(context_bigrams))
                bigram_sim = bigram_intersection / bigram_union if bigram_union > 0 else 0.0

                # Combine similarities
                return (jaccard_sim * 0.7) + (bigram_sim * 0.3)

        return 0.0

    def _calculate_keyword_relevance(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate keyword relevance using TF-IDF inspired scoring."""
        memory_keywords = self._extract_keywords(memory)
        context_keywords = context.get('keywords', [])

        if not context_keywords:
            return 0.0

        # Calculate term frequency in memory
        memory_text = memory.get('description', '').lower()
        memory_word_count = Counter(re.findall(r'\b\w+\b', memory_text))

        matches = 0
        total_weight = 0

        for ctx_kw in context_keywords:
            ctx_kw_lower = ctx_kw.lower()
            # Check for exact matches and partial matches
            for mem_kw in memory_keywords:
                mem_kw_lower = mem_kw.lower()

                if ctx_kw_lower == mem_kw_lower:
                    # Exact match - high weight
                    tf = memory_word_count.get(mem_kw_lower, 0) / len(memory_keywords) if memory_keywords else 0
                    matches += tf * 1.0
                    total_weight += 1.0
                elif ctx_kw_lower in mem_kw_lower or mem_kw_lower in ctx_kw_lower:
                    # Partial match - medium weight
                    tf = memory_word_count.get(mem_kw_lower, 0) / len(memory_keywords) if memory_keywords else 0
                    matches += tf * 0.6
                    total_weight += 0.6

        return matches / total_weight if total_weight > 0 else 0.0

    def _calculate_pattern_relevance(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate relevance based on context patterns."""
        score = 0.0

        # Question pattern detection
        player_input = context.get('player_input', '')
        if '?' in player_input:
            # Questions get relevance boost based on memory type
            memory_type = memory.get('memory_type', '').lower()
            if memory_type in ['world', 'lore', 'character']:
                score += 0.3

        # Emotional context patterns
        if 'emotional_context' in context:
            if 'emotional_state' in memory:
                score += 0.2

        # Relationship patterns
        if 'relationship' in player_input.lower():
            memory_type = memory.get('memory_type', '').lower()
            if memory_type in ['social', 'player', 'relationship']:
                score += 0.3

        return score

    def _calculate_memory_freshness(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate memory freshness score based on recency and access patterns."""
        freshness = 0.0

        # Recency based on timestamp
        if 'timestamp' in memory:
            # Simple exponential decay - more recent = higher freshness
            # Assuming timestamp is in Unix timestamp format
            current_time = time.time()
            memory_time = memory.get('timestamp', current_time)

            # Calculate days since memory was created
            age_days = (current_time - memory_time) / (24 * 3600)

            # Exponential decay with half-life of 7 days
            freshness = math.exp(-age_days / 7.0)

        # Access frequency boost
        if 'access_count' in memory:
            access_count = memory.get('access_count', 0)
            # More accessed memories are considered more relevant
            freshness += min(access_count * 0.05, 0.2)

        return min(freshness, 1.0)

    def _calculate_recency_boost(self, timestamp: float, context: Dict[str, Any]) -> float:
        """Calculate recency boost with improved algorithm."""
        current_time = time.time()
        age_seconds = current_time - timestamp

        # Exponential decay with different rates for different memory types
        memory_type = context.get('memory_type', 'session')

        if memory_type == 'session':
            # Session memories decay quickly (half-life: 1 hour)
            decay_rate = math.log(2) / 3600
        elif memory_type in ['emotional', 'triggered']:
            # Emotional/triggered memories persist longer (half-life: 24 hours)
            decay_rate = math.log(2) / (24 * 3600)
        else:
            # Other memories have medium persistence (half-life: 12 hours)
            decay_rate = math.log(2) / (12 * 3600)

        recency_score = math.exp(-decay_rate * age_seconds)

        # Boost very recent memories
        if age_seconds < 300:  # Less than 5 minutes
            recency_score += 0.2

        return min(recency_score, 0.3)  # Cap the boost

    def _calculate_context_alignment(self, memory: Dict[str, Any], context: Dict[str, Any]) -> float:
        """Calculate how well memory aligns with current context."""
        alignment = 0.0

        # Location alignment
        if 'location' in context and 'location' in memory:
            if context['location'] == memory['location']:
                alignment += 0.3

        # NPC alignment (memory relevance to current NPC)
        if 'npc_id' in context and 'npc_id' in memory:
            if context['npc_id'] == memory['npc_id']:
                alignment += 0.2

        # Conversation stage alignment
        conversation_stage = context.get('conversation_stage', 'new')
        if conversation_stage == 'established' and 'conversation_history' in memory:
            alignment += 0.1

        return alignment

    def _get_ngrams(self, text: str, n: int) -> List[str]:
        """Generate n-grams from text."""
        words = re.findall(r'\b\w+\b', text.lower())
        return [' '.join(words[i:i+n]) for i in range(len(words)-n+1)]

    def classify_memories_with_relationships(self, memories: List[Dict[str, Any]],
                                           context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify memories and analyze relationships between them.

        Returns:
            Dictionary containing classified memories and relationship analysis
        """
        classified = self.classify_memories(memories, context)

        # Analyze memory relationships
        relationships = self._analyze_memory_relationships(classified, context)

        # Calculate memory clusters and groups
        clusters = self._cluster_related_memories(classified, relationships)

        return {
            'classified_memories': classified,
            'memory_relationships': relationships,
            'memory_clusters': clusters,
            'relationship_stats': self._calculate_relationship_stats(relationships)
        }

    def _analyze_memory_relationships(self, memories: List[ClassifiedMemory],
                                    context: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze relationships between memories."""
        relationships = {
            'similarity_matrix': {},
            'conflict_pairs': [],
            'support_pairs': [],
            'temporal_connections': []
        }

        # Build similarity matrix
        for i, mem1 in enumerate(memories):
            mem1_id = f"mem_{i}"
            relationships['similarity_matrix'][mem1_id] = {}

            for j, mem2 in enumerate(memories[i+1:], i+1):
                mem2_id = f"mem_{j}"

                # Calculate similarity
                similarity = self._calculate_memory_similarity(mem1, mem2)
                relationships['similarity_matrix'][mem1_id][mem2_id] = similarity

                # Identify relationship type
                if similarity > 0.8:
                    relationships['support_pairs'].append((mem1_id, mem2_id, similarity))
                elif self._memories_conflict(mem1, mem2):
                    relationships['conflict_pairs'].append((mem1_id, mem2_id, similarity))

                # Check temporal connections
                if self._memories_temporally_connected(mem1, mem2):
                    relationships['temporal_connections'].append((mem1_id, mem2_id))

        return relationships

    def _calculate_memory_similarity(self, mem1: ClassifiedMemory, mem2: ClassifiedMemory) -> float:
        """Calculate similarity between two memories."""
        similarity = 0.0

        # Class similarity
        if mem1.memory_class == mem2.memory_class:
            similarity += 0.3

        # Keyword overlap
        keywords1 = set(mem1.context_keywords)
        keywords2 = set(mem2.context_keywords)

        if keywords1 or keywords2:
            intersection = len(keywords1.intersection(keywords2))
            union = len(keywords1.union(keywords2))
            keyword_sim = intersection / union if union > 0 else 0.0
            similarity += keyword_sim * 0.4

        # Content similarity (simplified)
        content1 = mem1.formatted_content.lower()
        content2 = mem2.formatted_content.lower()

        # Simple word overlap
        words1 = set(re.findall(r'\b\w{3,}\b', content1))
        words2 = set(re.findall(r'\b\w{3,}\b', content2))

        if words1 or words2:
            word_intersection = len(words1.intersection(words2))
            word_union = len(words1.union(words2))
            content_sim = word_intersection / word_union if word_union > 0 else 0.0
            similarity += content_sim * 0.3

        return min(similarity, 1.0)

    def _memories_conflict(self, mem1: ClassifiedMemory, mem2: ClassifiedMemory) -> bool:
        """Check if two memories conflict with each other."""
        # Emotional conflicts
        emotion1 = mem1.get_raw_value('emotional_state', '')
        emotion2 = mem2.get_raw_value('emotional_state', '')

        if emotion1 and emotion2:
            conflicting_emotions = [
                ('happy', 'sad'), ('angry', 'calm'), ('fearful', 'confident')
            ]
            for pos, neg in conflicting_emotions:
                if (pos in emotion1.lower() and neg in emotion2.lower()) or \
                   (neg in emotion1.lower() and pos in emotion2.lower()):
                    return True

        # Contradictory information
        keywords1 = set(word.lower() for word in mem1.context_keywords)
        keywords2 = set(word.lower() for word in mem2.context_keywords)

        opposing_concepts = [
            ('friend', 'enemy'), ('ally', 'enemy'), ('love', 'hate')
        ]

        for pos, neg in opposing_concepts:
            if (pos in keywords1 and neg in keywords2) or (neg in keywords1 and pos in keywords2):
                return True

        return False

    def _memories_temporally_connected(self, mem1: ClassifiedMemory, mem2: ClassifiedMemory) -> bool:
        """Check if memories are temporally connected."""
        # Simple check for time-related keywords
        time_keywords = ['before', 'after', 'during', 'then', 'next', 'previously', 'later']

        content1 = mem1.formatted_content.lower()
        content2 = mem2.formatted_content.lower()

        return any(keyword in content1 or keyword in content2 for keyword in time_keywords)

    def _cluster_related_memories(self, memories: List[ClassifiedMemory],
                                relationships: Dict[str, Any]) -> Dict[str, List[str]]:
        """Cluster memories based on relationships."""
        clusters = {}
        visited = set()

        for i, memory in enumerate(memories):
            mem_id = f"mem_{i}"

            if mem_id in visited:
                continue

            # Start new cluster
            cluster = [mem_id]
            visited.add(mem_id)

            # Find related memories
            for j, other_memory in enumerate(memories[i+1:], i+1):
                other_id = f"mem_{j}"

                if other_id in visited:
                    continue

                # Check similarity threshold
                similarity = relationships['similarity_matrix'].get(mem_id, {}).get(other_id, 0.0)
                if similarity > 0.6:  # Threshold for clustering
                    cluster.append(other_id)
                    visited.add(other_id)

            clusters[f"cluster_{len(clusters)}"] = cluster

        return clusters

    def _calculate_relationship_stats(self, relationships: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate statistics about memory relationships."""
        similarity_matrix = relationships.get('similarity_matrix', {})

        similarities = []
        for mem1_similarities in similarity_matrix.values():
            similarities.extend(mem1_similarities.values())

        return {
            'total_relationships': len(similarities),
            'avg_similarity': sum(similarities) / len(similarities) if similarities else 0.0,
            'max_similarity': max(similarities) if similarities else 0.0,
            'min_similarity': min(similarities) if similarities else 0.0,
            'conflict_count': len(relationships.get('conflict_pairs', [])),
            'support_count': len(relationships.get('support_pairs', [])),
            'temporal_connections': len(relationships.get('temporal_connections', []))
        }

    def _calculate_injection_priority(self, memory_class: MemoryClass,
                                      relevance_score: float,
                                      context: Dict[str, Any]) -> int:
        """Calculate injection priority for a classified memory."""

        # Base priority from memory class
        class_priorities = {
            MemoryClass.TRIGGERED: 100,
            MemoryClass.EMOTIONAL: 90,
            MemoryClass.PLAYER: 80,
            MemoryClass.CHARACTER: 70,
            MemoryClass.PROSPECTIVE: 60,
            MemoryClass.SOCIAL: 50,
            MemoryClass.WORLD: 40,
            MemoryClass.SESSION: 30,
            MemoryClass.EPISODIC: 20,
            MemoryClass.SEMANTIC: 10
        }

        priority = class_priorities.get(memory_class, 0)

        # Boost priority based on relevance
        priority += int(relevance_score * 20)

        # Context-specific boosts
        if 'urgent_context' in context and context['urgent_context']:
            priority += 10

        if 'emotional_context' in context:
            priority += 5

        return priority

    def _extract_keywords(self, memory: Dict[str, Any]) -> List[str]:
        """Extract context keywords from a memory."""
        keywords = []

        # From existing keywords field
        if 'keywords' in memory:
            keywords.extend(memory['keywords'])

        if 'context_keywords' in memory:
            keywords.extend(memory['context_keywords'])

        # From description (simple extraction)
        description = memory.get('description', '')
        if description:
            # Extract nouns and important words (simplified)
            words = re.findall(r'\b\w{4,}\b', description.lower())
            keywords.extend(words[:5])  # Limit to 5 keywords

        return list(set(keywords))  # Remove duplicates

    def _format_for_class(self, memory: Dict[str, Any], memory_class: MemoryClass) -> str:
        """Format memory content based on its classification."""

        description = memory.get('description', '')

        # Add class-specific formatting
        if memory_class == MemoryClass.EMOTIONAL:
            emotional_state = memory.get('emotional_state', '')
            if emotional_state:
                return f"[{emotional_state.upper()}] {description}"
            return description

        elif memory_class == MemoryClass.CHARACTER:
            return f"PERSONAL: {description}"

        elif memory_class == MemoryClass.PLAYER:
            return f"WITH PLAYER: {description}"

        elif memory_class == MemoryClass.WORLD:
            return f"WORLD CONTEXT: {description}"

        elif memory_class == MemoryClass.PROSPECTIVE:
            return f"GOAL: {description}"

        elif memory_class == MemoryClass.SOCIAL:
            return f"RELATIONSHIP: {description}"

        else:
            return description

    def get_classification_stats(self) -> MemoryClassificationStats:
        """Get classification statistics."""
        return self.stats

    def reset_stats(self) -> None:
        """Reset classification statistics."""
        self.stats = MemoryClassificationStats()


# Import here to avoid circular imports
from .classification_rules import ClassificationRules