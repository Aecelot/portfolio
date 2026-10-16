import re
from typing import Dict, List, Any, Pattern
from .memory_types import MemoryClass

class ClassificationRules:
    """
    Configurable rules for memory classification.

    This class defines the rules and patterns used to classify memories
    into different categories. Rules can be customized for different
    NPCs or scenarios.
    """

    def __init__(self):
        """Initialize classification rules with default patterns."""

        # Character memory patterns
        self.character_patterns = [
            r'\b(personality|trait|characteristic)\b',
            r'\b(personal\s+history|background|origin)\b',
            r'\b(upbringing|childhood|past)\b',
            r'\b(belief|value|principle)\b',
            r'\b(motivation|goal|fear|desire)\b',
            r'\b(ambition|secret|trauma)\b'
        ]

        # Player memory patterns
        self.player_patterns = [
            r'\b(player|adventurer|hero)\b',
            r'\b(you told me|you said|you helped)\b',
            r'\b(you betrayed|we fought|we talked)\b',
            r'\b(shared experience|together|with you)\b'
        ]

        # World memory patterns
        self.world_patterns = [
            r'\b(kingdom|city|town|village)\b',
            r'\b(world|realm|history|lore)\b',
            r'\b(legend|myth|culture|tradition)\b',
            r'\b(law|custom|location|place)\b',
            r'\b(politics|government|faction)\b'
        ]

        # Session memory patterns
        self.session_patterns = [
            r'\b(recently|just now|earlier today)\b',
            r'\b(this morning|conversation|discussion)\b',
            r'\b(talked about|mentioned|current)\b',
            r'\b(ongoing|immediate|right now)\b'
        ]

        # Emotional memory patterns
        self.emotional_patterns = [
            r'\b(angry|happy|sad|fearful|excited)\b',
            r'\b(nervous|love|hate|joy|sorrow)\b',
            r'\b(rage|terror|emotion|feeling)\b',
            r'\b(mood|sentiment)\b'
        ]

        # Social memory patterns
        self.social_patterns = [
            r'\b(friend|enemy|ally|rival)\b',
            r'\b(relationship|love|hate|trust)\b',
            r'\b(betray|loyal|family|kin)\b',
            r'\b(bond|connection|social)\b'
        ]

        # Prospective memory patterns
        self.prospective_patterns = [
            r'\b(plan|intend|will do|going to)\b',
            r'\b(future|goal|objective|aim)\b',
            r'\b(purpose|ambition|dream)\b',
            r'\b(aspiration|hope|expect)\b'
        ]

        # Triggered memory patterns
        self.triggered_patterns = [
            r'\b(whenever|when|if|triggered)\b',
            r'\b(reminded|memory|remember)\b',
            r'\b(recall|think back)\b'
        ]

        # Compile patterns for efficiency
        self._compiled_patterns = {}
        self._compile_patterns()

        # Classification priority order (highest to lowest)
        self.class_priority_order = [
            MemoryClass.TRIGGERED,
            MemoryClass.EMOTIONAL,
            MemoryClass.PLAYER,
            MemoryClass.CHARACTER,
            MemoryClass.PROSPECTIVE,
            MemoryClass.SOCIAL,
            MemoryClass.WORLD,
            MemoryClass.SESSION
        ]

    def _compile_patterns(self) -> None:
        """Compile regex patterns for better performance."""
        pattern_groups = {
            'character': self.character_patterns,
            'player': self.player_patterns,
            'world': self.world_patterns,
            'session': self.session_patterns,
            'emotional': self.emotional_patterns,
            'social': self.social_patterns,
            'prospective': self.prospective_patterns,
            'triggered': self.triggered_patterns
        }

        for group_name, patterns in pattern_groups.items():
            self._compiled_patterns[group_name] = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]

    def add_custom_pattern(self, memory_class: MemoryClass, pattern: str) -> None:
        """
        Add a custom classification pattern.

        Args:
            memory_class: Memory class to associate with the pattern
            pattern: Regex pattern string
        """
        compiled_pattern = re.compile(pattern, re.IGNORECASE)

        # Add to appropriate pattern list
        if memory_class == MemoryClass.CHARACTER:
            self.character_patterns.append(pattern)
            self._compiled_patterns['character'].append(compiled_pattern)
        elif memory_class == MemoryClass.PLAYER:
            self.player_patterns.append(pattern)
            self._compiled_patterns['player'].append(compiled_pattern)
        elif memory_class == MemoryClass.WORLD:
            self.world_patterns.append(pattern)
            self._compiled_patterns['world'].append(compiled_pattern)
        elif memory_class == MemoryClass.SESSION:
            self.session_patterns.append(pattern)
            self._compiled_patterns['session'].append(compiled_pattern)
        elif memory_class == MemoryClass.EMOTIONAL:
            self.emotional_patterns.append(pattern)
            self._compiled_patterns['emotional'].append(compiled_pattern)
        elif memory_class == MemoryClass.SOCIAL:
            self.social_patterns.append(pattern)
            self._compiled_patterns['social'].append(compiled_pattern)
        elif memory_class == MemoryClass.PROSPECTIVE:
            self.prospective_patterns.append(pattern)
            self._compiled_patterns['prospective'].append(compiled_pattern)
        elif memory_class == MemoryClass.TRIGGERED:
            self.triggered_patterns.append(pattern)
            self._compiled_patterns['triggered'].append(compiled_pattern)

    def check_pattern_match(self, memory_class: MemoryClass, text: str) -> bool:
        """
        Check if text matches patterns for a specific memory class.

        Args:
            memory_class: Memory class to check
            text: Text to analyze

        Returns:
            True if any pattern matches
        """
        if memory_class == MemoryClass.CHARACTER:
            patterns = self._compiled_patterns['character']
        elif memory_class == MemoryClass.PLAYER:
            patterns = self._compiled_patterns['player']
        elif memory_class == MemoryClass.WORLD:
            patterns = self._compiled_patterns['world']
        elif memory_class == MemoryClass.SESSION:
            patterns = self._compiled_patterns['session']
        elif memory_class == MemoryClass.EMOTIONAL:
            patterns = self._compiled_patterns['emotional']
        elif memory_class == MemoryClass.SOCIAL:
            patterns = self._compiled_patterns['social']
        elif memory_class == MemoryClass.PROSPECTIVE:
            patterns = self._compiled_patterns['prospective']
        elif memory_class == MemoryClass.TRIGGERED:
            patterns = self._compiled_patterns['triggered']
        else:
            return False

        # Check if any pattern matches
        for pattern in patterns:
            if pattern.search(text):
                return True

        return False

    def get_pattern_score(self, memory_class: MemoryClass, text: str) -> float:
        """
        Get pattern match score for a memory class.

        Args:
            memory_class: Memory class to check
            text: Text to analyze

        Returns:
            Score between 0.0 and 1.0 based on pattern matches
        """
        if memory_class == MemoryClass.CHARACTER:
            patterns = self._compiled_patterns['character']
        elif memory_class == MemoryClass.PLAYER:
            patterns = self._compiled_patterns['player']
        elif memory_class == MemoryClass.WORLD:
            patterns = self._compiled_patterns['world']
        elif memory_class == MemoryClass.SESSION:
            patterns = self._compiled_patterns['session']
        elif memory_class == MemoryClass.EMOTIONAL:
            patterns = self._compiled_patterns['emotional']
        elif memory_class == MemoryClass.SOCIAL:
            patterns = self._compiled_patterns['social']
        elif memory_class == MemoryClass.PROSPECTIVE:
            patterns = self._compiled_patterns['prospective']
        elif memory_class == MemoryClass.TRIGGERED:
            patterns = self._compiled_patterns['triggered']
        else:
            return 0.0

        # Count matches
        matches = 0
        for pattern in patterns:
            if pattern.search(text):
                matches += 1

        # Return normalized score
        return min(matches / len(patterns), 1.0) if patterns else 0.0

    def get_memory_type_patterns(self) -> Dict[str, List[str]]:
        """
        Get all memory type patterns for external use.

        Returns:
            Dictionary mapping memory types to their pattern lists
        """
        return {
            'character': self.character_patterns.copy(),
            'player': self.player_patterns.copy(),
            'world': self.world_patterns.copy(),
            'session': self.session_patterns.copy(),
            'emotional': self.emotional_patterns.copy(),
            'social': self.social_patterns.copy(),
            'prospective': self.prospective_patterns.copy(),
            'triggered': self.triggered_patterns.copy()
        }

    def get_classification_priority(self, memory_class: MemoryClass) -> int:
        """
        Get classification priority for a memory class.

        Args:
            memory_class: Memory class to check

        Returns:
            Priority value (higher = more important)
        """
        try:
            return self.class_priority_order.index(memory_class)
        except ValueError:
            return -1  # Unknown class

    def get_class_priorities(self) -> Dict[MemoryClass, int]:
        """
        Get all class priorities as a dictionary.

        Returns:
            Dictionary mapping memory classes to their priorities
        """
        return {cls: self.get_classification_priority(cls) for cls in MemoryClass}

    def load_rules_from_config(self, config: Dict[str, Any]) -> None:
        """
        Load classification rules from configuration.

        Args:
            config: Configuration dictionary with rule definitions
        """
        # Load custom patterns
        if 'custom_patterns' in config:
            for class_name, patterns in config['custom_patterns'].items():
                try:
                    memory_class = MemoryClass(class_name.lower())
                    for pattern in patterns:
                        self.add_custom_pattern(memory_class, pattern)
                except ValueError:
                    pass  # Skip invalid class names

        # Load priority order
        if 'priority_order' in config:
            self.class_priority_order = []
            for class_name in config['priority_order']:
                try:
                    memory_class = MemoryClass(class_name.lower())
                    self.class_priority_order.append(memory_class)
                except ValueError:
                    pass  # Skip invalid class names

    def export_rules_to_config(self) -> Dict[str, Any]:
        """
        Export current rules to configuration format.

        Returns:
            Configuration dictionary
        """
        return {
            'custom_patterns': self.get_memory_type_patterns(),
            'priority_order': [cls.value for cls in self.class_priority_order]
        }