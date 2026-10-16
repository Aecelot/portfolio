"""
Prompt Templates for Generation Module

Implements contract-compliant prompt templates for Answerer and NPC modes.
"""

from typing import Dict, List, Any, Optional
from .config import get_config


class AnswererPromptBuilder:
    """Builds prompts for the Answerer (Lore Q&A / Codex) mode."""

    @staticmethod
    def build_system_prompt() -> str:
        """Build the system prompt for Answerer mode per contract §5.3.1."""
        return """### ROLE
You are a lore answerer for the Logres universe. You must use ONLY the provided entity context and passages.
If the passages do not contain the answer, respond with: NO_CANON_FOUND.

### RULES
1) Do not add information not present in the passages.
2) Prefer primary facts that appear verbatim or paraphrased consistently.
3) If passages conflict, prefer the one with the latest `version`/`updated_at`.
4) Keep spoilers/GM-only information out of answers (these will not appear, but if they do, ignore).
5) Be concise. Use neutral, encyclopedic tone. Use markdown lists for multi-part answers.

### INPUT FORMAT
- Query: natural language question.
- EntityContext: array of {id, name, gloss} describing relevant entities in one line each.
- Passages: ordered snippets of text. Each includes minimal metadata.

### OUTPUT MODES
- Default: concise markdown.
- If the user explicitly asks for JSON, return the JSON schema below.

### JSON SCHEMA (on request)
{
  "answer": "string",
  "facts": ["short bullet of grounded fact", "..."],
  "entities": ["ent:...", "..."],
  "confidence": 0.0-1.0
}"""

    @staticmethod
    def build_assistant_prompt(query: str, entity_context: List[Dict], passages: List[Dict]) -> str:
        """Build the assistant prompt for Answerer mode per contract §5.3.2."""
        config = get_config()

        # Format entity context
        entity_lines = []
        for entity in entity_context:
            gloss = entity.get('gloss', 'No description available')
            entity_lines.append(f"- {entity.get('name', 'Unknown')}: {gloss}")

        entity_section = "\n".join(entity_lines) if entity_lines else "- No entity context available"

        # Format passages
        passage_lines = []
        for i, passage in enumerate(passages, 1):
            rank = passage.get('rank', i)
            section_id = passage.get('meta', {}).get('section_id', 'unknown')
            text = passage.get('text', '')

            # Truncate very long passages for prompt efficiency
            if len(text) > 500:
                text = text[:450] + "... [truncated]"

            passage_lines.append(f"([{rank}] {section_id}) {text}")

        passages_section = "\n\n".join(passage_lines) if passage_lines else "No passages available"

        return f"""### QUERY
{query}

### ENTITY CONTEXT
{entity_section}

### PASSAGES
{passages_section}

### TASK
Answer the QUERY using ONLY the PASSAGES above. If uncertain or unsupported, output exactly:
NO_CANON_FOUND

Now produce the answer."""

    @staticmethod
    def build_json_prompt(query: str, entity_context: List[Dict], passages: List[Dict]) -> str:
        """Build prompt for JSON output mode."""
        base_prompt = AnswererPromptBuilder.build_assistant_prompt(query, entity_context, passages)
        return base_prompt + "\n\nOutput the answer in JSON format using the specified schema."


class NPCPromptBuilder:
    """Builds prompts for NPC Grounding (Dialogue) mode."""

    @staticmethod
    def build_system_prompt() -> str:
        """Build the system prompt for NPC mode per contract §5.4.1."""
        return """### ROLE
You are an NPC speaking in-world. Stay strictly in character. Use only the provided entity context and passages.
If you do not know, or the lore is missing, reply IN CHARACTER that you don't know or are unsure.
Never reveal sources, passages, or out-of-character knowledge.

### STYLE RULES
- Voice: grounded, era-appropriate (late 1600's fantasy), brief sentences.
- Avoid modern slang and metagame terms.
- If asked about forbidden or unknown topics, deflect plausibly.

### KNOWLEDGE RULES
1) Only use facts present in the passages or entity context.
2) If facts are thin, use tone and implication rather than invention.
3) Do not expose secrets unless a passage explicitly states the NPC knows them.

### SAFETY
- Do not output GM-only material.
- No real-world sensitive content or claims unrelated to the world."""

    @staticmethod
    def build_assistant_prompt(
        query: str,
        entity_context: List[Dict],
        passages: List[Dict],
        persona: Optional[Dict] = None,
        tone: Optional[str] = None
    ) -> str:
        """Build the assistant prompt for NPC mode per contract §5.4.2."""
        config = get_config()

        # Format entity context
        entity_lines = []
        for entity in entity_context:
            gloss = entity.get('gloss', 'No description available')
            entity_lines.append(f"- {entity.get('name', 'Unknown')}: {gloss}")

        entity_section = "\n".join(entity_lines) if entity_lines else "- No entity context available"

        # Format passages
        passage_lines = []
        for i, passage in enumerate(passages, 1):
            rank = passage.get('rank', i)
            section_id = passage.get('meta', {}).get('section_id', 'unknown')
            text = passage.get('text', '')

            # Truncate very long passages for prompt efficiency
            if len(text) > 400:
                text = text[:350] + "... [truncated]"

            passage_lines.append(f"([{rank}] {section_id}) {text}")

        passages_section = "\n\n".join(passage_lines) if passage_lines else "No passages available"

        # Add persona context if provided
        persona_section = ""
        if persona:
            name = persona.get('name', 'Unknown NPC')
            attitude = persona.get('attitude', 'neutral')
            goals = persona.get('goals', [])
            taboos = persona.get('taboo_topics', [])

            persona_section = f"""
### NPC PERSONA
- Name: {name}
- Attitude: {attitude}
- Goals: {', '.join(goals) if goals else 'None specified'}
- Taboo Topics: {', '.join(taboos) if taboos else 'None specified'}"""

        # Add tone control if provided
        tone_section = ""
        if tone:
            tone_section = f"""
### TONE
{tone.capitalize()}"""

        return f"""### PLAYER MESSAGE
{query}

### ENTITY CONTEXT (for your private grounding; do not read aloud)
{entity_section}

### PASSAGES (private; do not quote directly)
{passages_section}{persona_section}{tone_section}

### TASK
Reply with a SINGLE in-character message (2–5 sentences) consistent with the passages.
If you do not know the answer from the passages, say so IN CHARACTER without breaking immersion.
Do not mention "passages," "documents," or your process."""


class PromptBuilder:
    """Unified prompt builder for generation tasks."""

    def __init__(self, config_path: str):
        """Initialize PromptBuilder with configuration."""
        import json

        self.config_path = config_path
        self.templates = {}

        # Load default templates if config file doesn't exist or is invalid
        default_templates = {
            "retrieval": "Answer based on: {context}",
            "question": "Question: {query}\nAnswer:"
        }

        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = json.load(f)

            # Load templates from config if available
            if 'prompt_templates' in config_data:
                self.templates = config_data['prompt_templates']
            else:
                self.templates = default_templates
        except (FileNotFoundError, json.JSONDecodeError):
            # Use default templates if config is not available
            self.templates = default_templates

    def build_retrieval_prompt(self, context: str, query: str) -> str:
        """Build a retrieval prompt using context and query."""
        template = self.templates.get("retrieval", "Answer based on: {context}")
        return template.format(context=context, query=query)

    def build_question_prompt(self, query: str) -> str:
        """Build a question prompt."""
        template = self.templates.get("question", "Question: {query}\nAnswer:")
        return template.format(query=query)

    def build_custom_prompt(self, template: str, **kwargs) -> str:
        """Build a custom prompt using provided template and variables."""
        try:
            return template.format(**kwargs)
        except KeyError as e:
            raise ValueError(f"Missing required template variable: {e}")


def build_prompt(
    mode: str,
    query: str,
    entity_context: List[Dict],
    passages: List[Dict],
    **kwargs
) -> tuple[str, str]:
    """
    Build system and assistant prompts for the specified mode.

    Args:
        mode: "answerer" or "npc"
        query: The user's query
        entity_context: List of entity dictionaries with id, name, gloss
        passages: List of passage dictionaries with rank, text, meta
        **kwargs: Additional parameters (persona, tone for NPC mode)

    Returns:
        Tuple of (system_prompt, assistant_prompt)
    """
    if mode.lower() == "answerer":
        system_prompt = AnswererPromptBuilder.build_system_prompt()

        # Check if JSON mode is requested in query
        json_requested = "json" in query.lower() or kwargs.get("json_mode", False)
        if json_requested:
            assistant_prompt = AnswererPromptBuilder.build_json_prompt(query, entity_context, passages)
        else:
            assistant_prompt = AnswererPromptBuilder.build_assistant_prompt(query, entity_context, passages)

    elif mode.lower() == "npc":
        system_prompt = NPCPromptBuilder.build_system_prompt()
        assistant_prompt = NPCPromptBuilder.build_assistant_prompt(
            query, entity_context, passages,
            persona=kwargs.get("persona"),
            tone=kwargs.get("tone")
        )
    else:
        raise ValueError(f"Unknown mode: {mode}. Must be 'answerer' or 'npc'")

    return system_prompt, assistant_prompt