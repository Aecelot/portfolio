"""
Lore RAG System - Generation Module

Phase 5: Generator Prompts & Output Contracts
- Answerer (Lore Q&A / Codex) - Human-readable answers or JSON summaries
- NPC Grounding (Dialogue) - In-character replies for NPCs
- Contract-compliant output generation with sentinel handling
"""

from .generator import generate_answer, generate_npc_reply, GenerationPayload, Generator
from .config import GeneratorConfig, get_config

__version__ = "5.0.0"
__all__ = ["generate_answer", "generate_npc_reply", "GenerationPayload", "Generator", "GeneratorConfig", "get_config"]