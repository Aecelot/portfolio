"""
Prompt Layers System

This module implements the layered prompt construction system for chat frontend integration.
It provides structured prompt building with distinct layers for different types of context
and instructions, enabling sophisticated NPC behavior and narrative quality.
"""

import re
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime


@dataclass
class PromptLayer:
    """Represents a single layer in the prompt structure."""
    name: str
    content: str
    priority: int
    enabled: bool = True
    max_length: Optional[int] = None
    variables: Dict[str, str] = field(default_factory=dict)

    def format_content(self) -> str:
        """Format the layer content with variable substitution."""
        content = self.content
        for var_name, var_value in self.variables.items():
            content = content.replace(var_name, var_value)
        return content

    def get_effective_content(self) -> str:
        """Get the final content for this layer, respecting length limits."""
        if not self.enabled:
            return ""

        content = self.format_content()

        if self.max_length and len(content) > self.max_length:
            # Truncate while preserving sentence boundaries
            content = self._smart_truncate(content, self.max_length)

        return content

    def _smart_truncate(self, text: str, max_length: int) -> str:
        """Truncate text intelligently at sentence boundaries."""
        if len(text) <= max_length:
            return text

        # Try to truncate at sentence boundary
        truncated = text[:max_length]
        last_period = truncated.rfind('.')
        last_exclamation = truncated.rfind('!')
        last_question = truncated.rfind('?')

        # Find the latest sentence ending
        sentence_end = max(last_period, last_exclamation, last_question)

        if sentence_end > max_length * 0.7:  # If we can keep most of the content
            return text[:sentence_end + 1]

        return truncated + "..."


@dataclass
class CharacterCard:
    """Character card data for prompt construction."""
    name: str
    species: str = ""
    age: str = ""
    personality_traits: List[str] = field(default_factory=list)
    background: str = ""
    appearance: str = ""
    relationships: Dict[str, str] = field(default_factory=dict)
    secrets: List[str] = field(default_factory=list)
    goals: List[str] = field(default_factory=list)


class PromptLayers:
    """Manages the construction of layered prompts."""

    def __init__(self):
        self.layers: List[PromptLayer] = []
        self._initialize_default_layers()

    def _initialize_default_layers(self):
        """Initialize the default prompt layers in order."""
        # System Layer - Core identity and role
        self.add_layer(PromptLayer(
            name="system",
            content="""You are {{char}}, an AI roleplaying as a character in this scenario.

CORE IDENTITY:
Name: {{char}}
{% if char_species %}Species: {{char_species}}{% endif %}
{% if char_age %}Age: {{char_age}}{% endif %}

PERSONALITY TRAITS:
{{personality_traits}}

CURRENT EMOTIONAL STATE:
{{emotional_state}}

ACTIVE GOALS:
{{character_goals}}""",
            priority=100,
            max_length=800
        ))

        # Character Layer - Background and relationships
        self.add_layer(PromptLayer(
            name="character",
            content="""CHARACTER BACKGROUND:
{{background}}

APPEARANCE:
{{appearance}}

RELATIONSHIPS:
{{relationship_status}}

SECRETS (use sparingly):
{{relevant_secrets}}""",
            priority=90,
            max_length=600
        ))

        # Memory Layer - Relevant memories
        self.add_layer(PromptLayer(
            name="memory",
            content="""RELEVANT MEMORIES:
Character Memories:
{{character_memories}}

Player Memories:
{{player_memories}}

World Context:
{{world_context}}

Session Context:
{{session_context}}""",
            priority=80,
            max_length=1000
        ))

        # Context Layer - Current situation
        self.add_layer(PromptLayer(
            name="context",
            content="""CURRENT SITUATION:
Location: {{location}}
Time: {{time}}
{% if scene %}Scene: {{scene}}{% endif %}
{% if recent_events %}Recent Events: {{recent_events}}{% endif %}""",
            priority=70,
            max_length=400
        ))

        # Conversation Layer - Recent conversation and current input
        self.add_layer(PromptLayer(
            name="conversation",
            content="""CONVERSATION HISTORY:
{{recent_conversation}}

CURRENT INPUT:
{{player_input}}""",
            priority=60,
            max_length=800
        ))

        # Instruction Layer - Response guidelines
        self.add_layer(PromptLayer(
            name="instruction",
            content="""RESPONSE GUIDELINES:
- Respond in character as {{char}}
- Consider all provided context and memories
- Maintain character consistency with history
- Use appropriate emotional tone
- Reference relevant memories naturally
- Keep responses immersive and engaging
- Stay in character and avoid breaking immersion

{{char}}: """,
            priority=50,
            max_length=300
        ))

    def add_layer(self, layer: PromptLayer):
        """Add a layer to the prompt structure."""
        self.layers.append(layer)
        # Keep layers sorted by priority (highest first)
        self.layers.sort(key=lambda x: x.priority, reverse=True)

    def remove_layer(self, name: str) -> bool:
        """Remove a layer by name. Returns True if removed."""
        for i, layer in enumerate(self.layers):
            if layer.name == name:
                del self.layers[i]
                return True
        return False

    def get_layer(self, name: str) -> Optional[PromptLayer]:
        """Get a layer by name."""
        for layer in self.layers:
            if layer.name == name:
                return layer
        return None

    def update_layer_content(self, name: str, content: str):
        """Update the content of a specific layer."""
        layer = self.get_layer(name)
        if layer:
            layer.content = content

    def update_layer_variables(self, name: str, variables: Dict[str, str]):
        """Update variables for a specific layer."""
        layer = self.get_layer(name)
        if layer:
            layer.variables.update(variables)

    def build_prompt(self, character_card: CharacterCard,
                    template_variables: Dict[str, str]) -> str:
        """Build the complete prompt from all layers."""
        prompt_parts = []

        for layer in self.layers:
            if layer.enabled:
                # Update layer variables with template variables
                layer.variables.update(template_variables)

                # Add character-specific variables
                if character_card:
                    self._add_character_variables(layer, character_card)

                content = layer.get_effective_content()
                if content.strip():
                    prompt_parts.append(content)

        return "\n\n".join(prompt_parts)

    def _add_character_variables(self, layer: PromptLayer, character_card: CharacterCard):
        """Add character-specific variables to a layer."""
        # Character name
        layer.variables["{{char}}"] = character_card.name

        # Character species and age
        if character_card.species:
            layer.variables["{{char_species}}"] = character_card.species
        if character_card.age:
            layer.variables["{{char_age}}"] = character_card.age

        # Personality traits
        if character_card.personality_traits:
            traits_text = "\n".join(f"- {trait}" for trait in character_card.personality_traits)
            layer.variables["{{personality_traits}}"] = traits_text

        # Background and appearance
        layer.variables["{{background}}"] = character_card.background or "Not specified"
        layer.variables["{{appearance}}"] = character_card.appearance or "Not described"

        # Relationships
        if character_card.relationships:
            relationships_text = "\n".join(
                f"- {name}: {desc}" for name, desc in character_card.relationships.items()
            )
            layer.variables["{{relationship_status}}"] = relationships_text
        else:
            layer.variables["{{relationship_status}}"] = "No established relationships"

        # Secrets (limit to most relevant)
        if character_card.secrets:
            secrets_text = "\n".join(f"- {secret}" for secret in character_card.secrets[:3])
            layer.variables["{{relevant_secrets}}"] = secrets_text
        else:
            layer.variables["{{relevant_secrets}}"] = "No relevant secrets to share"

        # Goals
        if character_card.goals:
            goals_text = "\n".join(f"- {goal}" for goal in character_card.goals[:5])
            layer.variables["{{character_goals}}"] = goals_text
        else:
            layer.variables["{{character_goals}}"] = "No specific goals at this time"

    def get_prompt_statistics(self) -> Dict[str, Any]:
        """Get statistics about the current prompt layers."""
        total_layers = len(self.layers)
        enabled_layers = sum(1 for layer in self.layers if layer.enabled)
        total_priority = sum(layer.priority for layer in self.layers)

        layer_info = []
        for layer in self.layers:
            layer_info.append({
                'name': layer.name,
                'priority': layer.priority,
                'enabled': layer.enabled,
                'content_length': len(layer.content),
                'variable_count': len(layer.variables)
            })

        return {
            'total_layers': total_layers,
            'enabled_layers': enabled_layers,
            'total_priority': total_priority,
            'layers': layer_info
        }

    def optimize_for_length(self, max_total_length: int) -> Dict[str, Any]:
        """Optimize layer lengths to fit within total limit."""
        current_total = sum(len(layer.get_effective_content())
                          for layer in self.layers if layer.enabled)

        if current_total <= max_total_length:
            return {'status': 'within_limit', 'current_length': current_total}

        # Calculate how much we need to reduce
        reduction_needed = current_total - max_total_length

        # Reduce layers proportionally based on their max_length settings
        layers_to_reduce = []
        for layer in self.layers:
            if layer.enabled and layer.max_length:
                reduction_ratio = layer.max_length / current_total
                reduction_amount = int(reduction_needed * reduction_ratio)
                layers_to_reduce.append((layer, reduction_amount))

        # Apply reductions
        adjustments = {}
        for layer, reduction in layers_to_reduce:
            old_max = layer.max_length or 0
            new_max = max(100, old_max - reduction)  # Minimum 100 chars
            layer.max_length = new_max
            adjustments[layer.name] = {
                'old_max_length': old_max,
                'new_max_length': new_max,
                'reduction': reduction
            }

        new_total = sum(len(layer.get_effective_content())
                       for layer in self.layers if layer.enabled)

        return {
            'status': 'optimized',
            'original_length': current_total,
            'new_length': new_total,
            'adjustments': adjustments
        }