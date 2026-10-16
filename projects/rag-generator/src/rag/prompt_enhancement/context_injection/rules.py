import xml.etree.ElementTree as ET
import logging
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from ..memory_classes import MemoryClass

logger = logging.getLogger(__name__)


@dataclass
class InjectionRule:
    """Individual injection rule configuration."""

    name: str
    description: str
    enabled: bool = True
    priority: int = 5
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        """Initialize default values."""
        if self.conditions is None:
            self.conditions = {}
        if self.actions is None:
            self.actions = {}

        # Ensure they're always dictionaries
        if not isinstance(self.conditions, dict):
            self.conditions = {}
        if not isinstance(self.actions, dict):
            self.actions = {}


@dataclass
class InjectionRuleSet:
    """Complete set of injection rules."""

    name: str
    description: str
    version: str = "1.0"
    rules: Optional[List[InjectionRule]] = None

    def __post_init__(self):
        """Initialize default values."""
        if self.rules is None:
            self.rules = []
        elif not isinstance(self.rules, list):
            self.rules = []


class InjectionRuleManager:
    """
    Manages injection rules for dynamic context injection.

    This class handles loading, validating, and applying injection rules
    that control how and when memories are injected into prompts.
    """

    def __init__(self, config_file: Optional[str] = None):
        """
        Initialize the rule manager.

        Args:
            config_file: Path to XML configuration file (optional)
        """
        self.logger = logging.getLogger(__name__)
        self.config_file = config_file
        self.current_rule_set = self._create_default_rule_set()
        self.custom_rules = []

        if config_file:
            self.load_rules_from_file(config_file)

    def _create_default_rule_set(self) -> InjectionRuleSet:
        """Create default injection rules."""

        rules = [
            InjectionRule(
                name="urgent_context",
                description="Boost injection for urgent situations",
                priority=10,
                conditions={
                    'context_type': 'urgent',
                    'min_urgency': 0.7
                },
                actions={
                    'memory_limit': 3,
                    'priority_boost': 2.0,
                    'allowed_classes': ['triggered', 'emotional', 'player']
                }
            ),
            InjectionRule(
                name="emotional_discussion",
                description="Focus on emotional memories in emotional contexts",
                priority=9,
                conditions={
                    'context_type': 'emotional',
                    'emotional_tone': 0.6
                },
                actions={
                    'emotional_memory_priority': 10,
                    'character_memory_boost': 1.5,
                    'max_world_memories': 1
                }
            ),
            InjectionRule(
                name="memory_questions",
                description="Inject relevant memories for memory-related questions",
                priority=8,
                conditions={
                    'question_type': 'memory'
                },
                actions={
                    'memory_class_priority': {
                        'character': 8,
                        'player': 7,
                        'episodic': 9,
                        'world': 3
                    }
                }
            ),
            InjectionRule(
                name="relationship_questions",
                description="Focus on social memories for relationship questions",
                priority=8,
                conditions={
                    'question_type': 'relationship'
                },
                actions={
                    'social_memory_priority': 10,
                    'player_memory_priority': 8,
                    'max_other_memories': 2
                }
            ),
            InjectionRule(
                name="world_lore_questions",
                description="Provide world context for lore questions",
                priority=7,
                conditions={
                    'question_type': 'world'
                },
                actions={
                    'world_memory_priority': 9,
                    'semantic_memory_priority': 7,
                    'max_character_memories': 1
                }
            ),
            InjectionRule(
                name="new_conversation",
                description="Limit injection for new conversations",
                priority=3,
                conditions={
                    'conversation_stage': 'new'
                },
                actions={
                    'max_memories': 2,
                    'min_relevance': 0.8,
                    'preferred_classes': ['character', 'world']
                }
            ),
            InjectionRule(
                name="established_conversation",
                description="Allow more comprehensive injection for established conversations",
                priority=6,
                conditions={
                    'conversation_stage': 'established'
                },
                actions={
                    'max_memories': 5,
                    'min_relevance': 0.6,
                    'allow_all_classes': True
                }
            ),
            InjectionRule(
                name="redundancy_filter",
                description="Prevent redundant memory injection",
                priority=10,
                conditions={
                    'check_redundancy': True
                },
                actions={
                    'redundancy_threshold': 0.7,
                    'max_similar_memories': 2
                }
            )
        ]

        return InjectionRuleSet(
            name="default_injection_rules",
            description="Default rules for memory injection",
            version="1.0",
            rules=rules
        )

    def load_rules_from_file(self, config_file: str) -> bool:
        """
        Load injection rules from XML configuration file.

        Args:
            config_file: Path to XML configuration file

        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            tree = ET.parse(config_file)
            root = tree.getroot()

            # Parse rule set metadata
            rule_set = InjectionRuleSet(
                name=root.get('name', 'custom_rules'),
                description=root.get('description', 'Custom injection rules'),
                version=root.get('version', '1.0')
            )

            # Parse individual rules
            if rule_set.rules is not None:
                for rule_elem in root.findall('rule'):
                    rule = self._parse_rule_element(rule_elem)
                    if rule:
                        rule_set.rules.append(rule)

            self.current_rule_set = rule_set
            rule_count = len(rule_set.rules) if rule_set.rules is not None else 0
            self.logger.info(f"Loaded {rule_count} injection rules from {config_file}")
            return True

        except Exception as e:
            self.logger.error(f"Error loading rules from {config_file}: {e}")
            return False

    def _parse_rule_element(self, rule_elem: ET.Element) -> Optional[InjectionRule]:
        """Parse a single rule element from XML."""

        try:
            name = rule_elem.get('name', '')
            description = rule_elem.get('description', '')
            enabled = rule_elem.get('enabled', 'true').lower() == 'true'
            priority = int(rule_elem.get('priority', '5'))

            rule = InjectionRule(
                name=name,
                description=description,
                enabled=enabled,
                priority=priority
            )

            # Parse conditions
            conditions_elem = rule_elem.find('conditions')
            if conditions_elem is not None and rule.conditions is not None:
                for condition in conditions_elem:
                    rule.conditions[condition.tag] = self._parse_condition_value(condition)

            # Parse actions
            actions_elem = rule_elem.find('actions')
            if actions_elem is not None and rule.actions is not None:
                for action in actions_elem:
                    rule.actions[action.tag] = self._parse_action_value(action)

            return rule

        except Exception as e:
            self.logger.error(f"Error parsing rule element: {e}")
            return None

    def _parse_condition_value(self, condition_elem: ET.Element) -> Any:
        """Parse condition value from XML element."""
        value = condition_elem.text or ""

        # Try to convert to appropriate type
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'
        elif value.replace('.', '').replace('-', '').isdigit():
            return float(value) if '.' in value else int(value)
        elif value.startswith('[') and value.endswith(']'):
            # Parse list
            return [item.strip().strip('"\'') for item in value[1:-1].split(',')]
        else:
            return value

    def _parse_action_value(self, action_elem: ET.Element) -> Any:
        """Parse action value from XML element."""
        return self._parse_condition_value(action_elem)  # Same parsing logic

    def save_rules_to_file(self, config_file: str) -> bool:
        """
        Save current rules to XML configuration file.

        Args:
            config_file: Path to save configuration file

        Returns:
            True if saved successfully, False otherwise
        """
        try:
            root = ET.Element('injection_rules')
            root.set('name', self.current_rule_set.name)
            root.set('description', self.current_rule_set.description)
            root.set('version', self.current_rule_set.version)

            if self.current_rule_set.rules is not None:
                for rule in self.current_rule_set.rules:
                    rule_elem = ET.SubElement(root, 'rule')
                    rule_elem.set('name', rule.name)
                    rule_elem.set('description', rule.description)
                    rule_elem.set('enabled', str(rule.enabled))
                    rule_elem.set('priority', str(rule.priority))

                    # Add conditions
                    conditions_elem = ET.SubElement(rule_elem, 'conditions')
                    if rule.conditions is not None:
                        for key, value in rule.conditions.items():
                            condition_elem = ET.SubElement(conditions_elem, key)
                            condition_elem.text = str(value)

                    # Add actions
                    actions_elem = ET.SubElement(rule_elem, 'actions')
                    if rule.actions is not None:
                        for key, value in rule.actions.items():
                            action_elem = ET.SubElement(actions_elem, key)
                            action_elem.text = str(value)

            # Write to file with formatting
            ET.indent(root, space="  ")
            tree = ET.ElementTree(root)
            tree.write(config_file, encoding='utf-8', xml_declaration=True)

            rule_count = len(self.current_rule_set.rules) if self.current_rule_set.rules is not None else 0
            self.logger.info(f"Saved {rule_count} injection rules to {config_file}")
            return True

        except Exception as e:
            self.logger.error(f"Error saving rules to {config_file}: {e}")
            return False

    def add_custom_rule(self, rule: InjectionRule) -> None:
        """Add a custom injection rule."""
        self.custom_rules.append(rule)
        self.logger.info(f"Added custom injection rule: {rule.name}")

    def remove_rule(self, rule_name: str) -> bool:
        """
        Remove a rule by name.

        Args:
            rule_name: Name of rule to remove

        Returns:
            True if removed, False if not found
        """
        if self.current_rule_set.rules is not None:
            for i, rule in enumerate(self.current_rule_set.rules):
                if rule.name == rule_name:
                    del self.current_rule_set.rules[i]
                    self.logger.info(f"Removed injection rule: {rule_name}")
                    return True

        self.logger.warning(f"Rule not found: {rule_name}")
        return False

    def get_applicable_rules(self, context: Dict[str, Any]) -> List[InjectionRule]:
        """
        Get rules applicable to current context.

        Args:
            context: Current context information

        Returns:
            List of applicable rules sorted by priority
        """
        applicable_rules = []

        # Check built-in rules
        if self.current_rule_set.rules is not None:
            for rule in self.current_rule_set.rules:
                if self._rule_applies(rule, context):
                    applicable_rules.append(rule)

        # Check custom rules
        for rule in self.custom_rules:
            if self._rule_applies(rule, context):
                applicable_rules.append(rule)

        # Sort by priority (highest first)
        applicable_rules.sort(key=lambda r: r.priority, reverse=True)

        return applicable_rules

    def _rule_applies(self, rule: InjectionRule, context: Dict[str, Any]) -> bool:
        """Check if a rule applies to current context."""

        if not rule.enabled:
            return False

        # Check each condition
        for condition_key, condition_value in rule.conditions.items():
            if condition_key not in context:
                return False

            context_value = context[condition_key]

            # Handle different condition types
            if isinstance(condition_value, (int, float)):
                if not self._numeric_condition_matches(context_value, condition_value):
                    return False
            elif isinstance(condition_value, list):
                if context_value not in condition_value:
                    return False
            elif isinstance(condition_value, str):
                if condition_value not in str(context_value):
                    return False
            else:
                if context_value != condition_value:
                    return False

        return True

    def _numeric_condition_matches(self, context_value: Any, condition_value: (int | float)) -> bool:
        """Check if numeric condition matches."""

        try:
            context_num = float(context_value)
            condition_num = float(condition_value)

            # For now, simple equality check
            # Could be enhanced with comparison operators like >=, <=, etc.
            return abs(context_num - condition_num) < 0.01  # Allow small floating point differences

        except (ValueError, TypeError):
            return False

    def apply_rules_to_injection(self, injection_plan: Any, context: Dict[str, Any]) -> Any:
        """
        Apply applicable rules to modify injection plan.

        Args:
            injection_plan: Current injection plan
            context: Current context

        Returns:
            Modified injection plan
        """
        applicable_rules = self.get_applicable_rules(context)

        if not applicable_rules:
            return injection_plan

        # Apply rules in priority order
        for rule in applicable_rules:
            injection_plan = self._apply_single_rule(injection_plan, rule, context)

        return injection_plan

    def _apply_single_rule(self, injection_plan: Any, rule: InjectionRule, context: Dict[str, Any]) -> Any:
        """Apply a single rule to injection plan."""

        # Create a copy to avoid modifying original
        modified_plan = injection_plan

        try:
            # Apply actions based on rule configuration
            for action_key, action_value in rule.actions.items():
                if action_key == 'max_memories':
                    if len(modified_plan.memories_to_inject) > action_value:
                        modified_plan.memories_to_inject = modified_plan.memories_to_inject[:action_value]

                elif action_key == 'min_relevance':
                    modified_plan.memories_to_inject = [
                        m for m in modified_plan.memories_to_inject
                        if m.relevance_score >= action_value
                    ]

                elif action_key == 'memory_limit':
                    # Apply class-specific limits
                    class_limits = action_value if isinstance(action_value, dict) else {}

                    if class_limits:
                        limited_memories = []
                        class_counts = {}

                        for memory in modified_plan.memories_to_inject:
                            class_name = memory.memory_class.value
                            limit = class_limits.get(class_name, float('inf'))

                            if class_counts.get(class_name, 0) < limit:
                                limited_memories.append(memory)
                                class_counts[class_name] = class_counts.get(class_name, 0) + 1

                        modified_plan.memories_to_inject = limited_memories

                # Add more rule actions as needed

        except Exception as e:
            self.logger.error(f"Error applying rule {rule.name}: {e}")

        return modified_plan

    def get_rule_statistics(self) -> Dict[str, Any]:
        """Get statistics about rule application."""

        current_rules = self.current_rule_set.rules if self.current_rule_set.rules is not None else []
        return {
            'total_rules': len(current_rules) + len(self.custom_rules),
            'enabled_rules': len([r for r in current_rules if r.enabled]) + len(self.custom_rules),
            'custom_rules': len(self.custom_rules),
            'rule_set_version': self.current_rule_set.version
        }

    def validate_rules(self) -> List[str]:
        """
        Validate all rules for consistency.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        # Check for duplicate rule names
        current_rules = self.current_rule_set.rules if self.current_rule_set.rules is not None else []
        rule_names = [rule.name for rule in current_rules] + [rule.name for rule in self.custom_rules]

        if len(rule_names) != len(set(rule_names)):
            errors.append("Duplicate rule names found")

        # Check for invalid priorities
        for rule in current_rules + self.custom_rules:
            if not (0 <= rule.priority <= 10):
                errors.append(f"Invalid priority for rule '{rule.name}': {rule.priority}")

        # Check for conflicting conditions
        for rule in current_rules + self.custom_rules:
            if rule.actions is not None and 'min_relevance' in rule.actions and 'max_relevance' in rule.actions:
                if rule.actions['min_relevance'] > rule.actions['max_relevance']:
                    errors.append(f"Conflicting relevance thresholds in rule '{rule.name}'")

        return errors