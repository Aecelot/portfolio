"""
Prompt Templates System

This module provides a collection of predefined prompt templates for different
scenarios and character types, optimized for chat frontend integration and
AAA-narrative quality interactions.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


@dataclass
class PromptTemplate:
    """Represents a prompt template with metadata."""
    name: str
    description: str
    template_content: str
    category: str
    variables: List[str] = field(default_factory=list)
    max_length: Optional[int] = None
    tags: List[str] = field(default_factory=list)


class PromptTemplates:
    """Collection of prompt templates for different scenarios."""

    def __init__(self):
        self.templates: Dict[str, PromptTemplate] = {}
        self._initialize_default_templates()

    def _initialize_default_templates(self):
        """Initialize default prompt templates."""
        # Standard RPG Template
        self.add_template(PromptTemplate(
            name="standard_rpg",
            description="Standard RPG character template with comprehensive context",
            category="rpg",
            template_content="""You are {{char}}, an AI roleplaying as a character in this scenario.

CORE IDENTITY:
Name: {{char}}
{% if char_species %}Species: {{char_species}}{% endif %}
{% if char_age %}Age: {{char_age}}{% endif %}

PERSONALITY TRAITS:
{{personality_traits}}

CURRENT EMOTIONAL STATE:
{{emotional_state}}

ACTIVE GOALS:
{{character_goals}}

CHARACTER BACKGROUND:
{{background}}

APPEARANCE:
{{appearance}}

RELATIONSHIPS:
{{relationship_status}}

SECRETS (use sparingly):
{{relevant_secrets}}

RELEVANT MEMORIES:
Character Memories:
{{character_memories}}

Player Memories:
{{player_memories}}

World Context:
{{world_context}}

CURRENT SITUATION:
Location: {{location}}
Time: {{time}}
{% if scene %}Scene: {{scene}}{% endif %}
{% if recent_events %}Recent Events: {{recent_events}}{% endif %}

CONVERSATION HISTORY:
{{recent_conversation}}

CURRENT INPUT:
{{player_input}}

RESPONSE GUIDELINES:
- Respond in character as {{char}}
- Consider all provided context and memories
- Maintain character consistency with history
- Use appropriate emotional tone
- Reference relevant memories naturally
- Keep responses immersive and engaging
- Stay in character and avoid breaking immersion

{{char}}: """,
            variables=[
                "{{char}}", "{{char_species}}", "{{char_age}}", "{{personality_traits}}",
                "{{emotional_state}}", "{{character_goals}}", "{{background}}", "{{appearance}}",
                "{{relationship_status}}", "{{relevant_secrets}}", "{{character_memories}}",
                "{{player_memories}}", "{{world_context}}", "{{location}}", "{{time}}",
                "{{scene}}", "{{recent_events}}", "{{recent_conversation}}", "{{player_input}}"
            ],
            max_length=4000,
            tags=["rpg", "comprehensive", "standard"]
        ))

        # Concise Template for Fast Interactions
        self.add_template(PromptTemplate(
            name="concise_interaction",
            description="Concise template for quick interactions and simple dialogue",
            category="interaction",
            template_content="""You are {{char}}.

Quick Context:
- Emotional State: {{emotional_state}}
- Recent Memories: {{recent_memories}}
- Location: {{location}}

{{recent_conversation}}

{{player_input}}

Respond as {{char}}: """,
            variables=[
                "{{char}}", "{{emotional_state}}", "{{recent_memories}}",
                "{{location}}", "{{recent_conversation}}", "{{player_input}}"
            ],
            max_length=1500,
            tags=["concise", "fast", "simple"]
        ))

        # Combat-Focused Template
        self.add_template(PromptTemplate(
            name="combat_focused",
            description="Template optimized for combat scenarios and tactical situations",
            category="combat",
            template_content="""You are {{char}} in a combat situation.

COMBAT CONTEXT:
- Emotional State: {{emotional_state}}
- Combat Memories: {{combat_memories}}
- Current Location: {{location}}
- Combat Status: {{combat_status}}

COMBAT HISTORY:
{{combat_history}}

CURRENT SITUATION:
{{player_input}}

COMBAT GUIDELINES:
- Focus on tactical decisions and immediate actions
- Consider combat training and past experiences
- Maintain character personality under pressure
- Describe actions and decisions vividly
- Stay in character during high-stakes situations

{{char}}: """,
            variables=[
                "{{char}}", "{{emotional_state}}", "{{combat_memories}}",
                "{{location}}", "{{combat_status}}", "{{combat_history}}", "{{player_input}}"
            ],
            max_length=2500,
            tags=["combat", "tactical", "action"]
        ))

        # Mystery/Investigation Template
        self.add_template(PromptTemplate(
            name="mystery_investigation",
            description="Template for mystery, investigation, and puzzle-solving scenarios",
            category="mystery",
            template_content="""You are {{char}} investigating a mystery.

INVESTIGATION CONTEXT:
- Current Case: {{current_case}}
- Investigative Memories: {{investigative_memories}}
- Location: {{location}}
- Time: {{time}}

RELEVANT KNOWLEDGE:
{{world_context}}

INVESTIGATION HISTORY:
{{investigation_history}}

CURRENT INPUT:
{{player_input}}

INVESTIGATION GUIDELINES:
- Think like a detective or investigator
- Consider clues, evidence, and patterns
- Ask probing questions when needed
- Maintain investigative mindset
- Connect current input to existing knowledge
- Propose theories and hypotheses

{{char}}: """,
            variables=[
                "{{char}}", "{{current_case}}", "{{investigative_memories}}",
                "{{location}}", "{{time}}", "{{world_context}}",
                "{{investigation_history}}", "{{player_input}}"
            ],
            max_length=3000,
            tags=["mystery", "investigation", "puzzle"]
        ))

        # Social/Relationship Template
        self.add_template(PromptTemplate(
            name="social_relationship",
            description="Template optimized for social interactions and relationship building",
            category="social",
            template_content="""You are {{char}} in a social situation.

SOCIAL CONTEXT:
- Emotional State: {{emotional_state}}
- Relationship Status: {{relationship_status}}
- Social Memories: {{social_memories}}
- Current Location: {{location}}

RELATIONSHIP HISTORY:
{{relationship_history}}

CURRENT SITUATION:
{{player_input}}

SOCIAL GUIDELINES:
- Focus on relationship dynamics and social cues
- Consider past interactions and shared experiences
- Show emotional intelligence and social awareness
- Build rapport and maintain relationships
- Use appropriate social language and etiquette
- Respond to emotional undertones

{{char}}: """,
            variables=[
                "{{char}}", "{{emotional_state}}", "{{relationship_status}}",
                "{{social_memories}}", "{{location}}", "{{relationship_history}}",
                "{{player_input}}"
            ],
            max_length=2800,
            tags=["social", "relationship", "emotional"]
        ))

        # Merchant/Trader Template
        self.add_template(PromptTemplate(
            name="merchant_trader",
            description="Template for merchants, traders, and economic interactions",
            category="merchant",
            template_content="""You are {{char}}, a merchant or trader.

BUSINESS CONTEXT:
- Business Personality: {{business_personality}}
- Trade Memories: {{trade_memories}}
- Current Inventory: {{current_inventory}}
- Location: {{location}}

MARKET KNOWLEDGE:
{{market_context}}

BUSINESS HISTORY:
{{business_history}}

CURRENT TRANSACTION:
{{player_input}}

BUSINESS GUIDELINES:
- Think like a shrewd businessperson
- Consider profit, risk, and market conditions
- Use merchant-appropriate language and haggling
- Maintain business savvy and market awareness
- Consider customer relationships and reputation
- Balance greed with long-term business sense

{{char}}: """,
            variables=[
                "{{char}}", "{{business_personality}}", "{{trade_memories}}",
                "{{current_inventory}}", "{{location}}", "{{market_context}}",
                "{{business_history}}", "{{player_input}}"
            ],
            max_length=2200,
            tags=["merchant", "trade", "business"]
        ))

    def add_template(self, template: PromptTemplate):
        """Add a template to the collection."""
        self.templates[template.name] = template

    def get_template(self, name: str) -> Optional[PromptTemplate]:
        """Get a template by name."""
        return self.templates.get(name)

    def get_templates_by_category(self, category: str) -> List[PromptTemplate]:
        """Get all templates in a specific category."""
        return [t for t in self.templates.values() if t.category == category]

    def get_templates_by_tag(self, tag: str) -> List[PromptTemplate]:
        """Get all templates with a specific tag."""
        return [t for t in self.templates.values() if tag in t.tags]

    def search_templates(self, query: str) -> List[PromptTemplate]:
        """Search templates by name, description, or tags."""
        query_lower = query.lower()
        results = []

        for template in self.templates.values():
            if (query_lower in template.name.lower() or
                query_lower in template.description.lower() or
                any(query_lower in tag.lower() for tag in template.tags)):
                results.append(template)

        return results

    def get_template_suggestions(self, context_keywords: List[str]) -> List[PromptTemplate]:
        """Get template suggestions based on context keywords."""
        suggestions = []

        for template in self.templates.values():
            score = 0
            for keyword in context_keywords:
                keyword_lower = keyword.lower()
                if (keyword_lower in template.name.lower() or
                    keyword_lower in template.description.lower() or
                    any(keyword_lower in tag.lower() for tag in template.tags)):
                    score += 1

            if score > 0:
                suggestions.append((template, score))

        # Sort by score (highest first)
        suggestions.sort(key=lambda x: x[1], reverse=True)
        return [template for template, _ in suggestions]

    def get_template_statistics(self) -> Dict[str, Any]:
        """Get statistics about the template collection."""
        categories = {}
        tags = {}

        for template in self.templates.values():
            # Count categories
            if template.category not in categories:
                categories[template.category] = 0
            categories[template.category] += 1

            # Count tags
            for tag in template.tags:
                if tag not in tags:
                    tags[tag] = 0
                tags[tag] += 1

        return {
            'total_templates': len(self.templates),
            'categories': categories,
            'tags': tags,
            'template_names': list(self.templates.keys())
        }