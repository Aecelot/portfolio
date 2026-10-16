"""
Core Generation Module

Implements the main generation functions with LLM integration, sentinel handling,
and contract-compliant output formatting.
"""

import json
import logging
import time
from typing import Dict, List, Any, Optional, Union, Tuple
from dataclasses import dataclass

from .config import get_config
from .prompts import build_prompt
from .llm_client import LLMClient, create_llm_client
from .personas import resolve_persona


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class GenerationPayload:
    """Payload structure for generation requests."""
    query: str
    entity_context: List[Dict[str, Any]]
    results: List[Dict[str, Any]]




class Generator:
    """Main generator class with LLM integration."""

    def __init__(self, llm_client: Optional[Any] = None):
        """Initialize generator with optional LLM client."""
        self.config = get_config()

        # Use provided LLM client or create default one
        if llm_client is None:
            # Only try to create a default LLM client if None was passed
            # (as opposed to explicitly passing None to disable LLM)
            try:
                self.llm_client = create_llm_client()
                logger.info("Initialized with real LLM client")
            except Exception as e:
                logger.error(f"Failed to initialize LLM client: {e}")
                logger.warning("Falling back to None LLM client")
                self.llm_client = None
        else:
            # Use the explicitly provided LLM client (including None)
            self.llm_client = llm_client

        # Set the llm reference for backward compatibility
        self.llm = self.llm_client

    def _check_sentinel_response(self, response: str) -> bool:
        """Check if response contains the no-canon sentinel."""
        sentinel = self.config.no_canon_sentinel
        return sentinel in response.upper() or sentinel in response

    def _apply_faithfulness_check(
        self,
        response: str,
        passages: List[Dict[str, Any]]
    ) -> Tuple[bool, str]:
        """
        Apply basic faithfulness check per contract §5.3.3.
        Returns (is_faithful, corrected_response).
        """
        if not self.config.answerer_faithfulness_check:
            return True, response

        # Skip faithfulness check for very short responses to avoid penalizing valid short answers
        response_tokens = len(response.split())
        if response_tokens < 10:  # Less than 10 tokens, likely a short valid answer
            return True, response

        # Simple faithfulness check: look for key nouns in response
        # This is a basic implementation - could be enhanced with NLP
        response_words = set(response.lower().split())
        faithful = True

        # Check against passage content
        for passage in passages:
            passage_text = passage.get('text', '').lower()
            passage_words = set(passage_text.split())

            # Lower threshold for medium-length responses (15-30 tokens)
            if response_tokens < 30:
                unique_threshold = 0.5  # 50% unique words allowed for medium responses
            else:
                unique_threshold = 0.3   # 30% unique words for longer responses

            # If response has significant unique words not in passages, flag as unfaithful
            unique_words = response_words - passage_words
            if len(unique_words) > len(response_words) * unique_threshold:
                faithful = False
                break

        if not faithful:
            logger.warning("Faithfulness check failed, switching to sentinel response")
            response = self.config.no_canon_sentinel

        return faithful, response

    def _format_json_response(
        self,
        response: str,
        entities: List[str],
        confidence: float = 0.8
    ) -> Dict[str, Any]:
        """Format response as JSON per contract §5.5.2."""
        # Extract facts from response (simple implementation)
        sentences = [s.strip() for s in response.split('.') if s.strip()]
        facts = [s for s in sentences[:3] if len(s) > 20]  # Take up to 3 substantial sentences

        return {
            "answer": response,
            "facts": facts,
            "entities": entities,
            "confidence": confidence
        }

    def generate_answer(
        self,
        payload: Union[GenerationPayload, Dict[str, Any]],
        mode: str = "text"
    ) -> Union[str, Dict[str, Any]]:
        """
        Generate answer using Answerer mode per contract §5.3.

        Args:
            payload: GenerationPayload or dict with query, entity_context, results
            mode: "text" or "json"

        Returns:
            Answer string or JSON dict per contract §5.5
        """
        start_time = time.time()

        # Normalize payload
        if isinstance(payload, GenerationPayload):
            query = payload.query
            entity_context = payload.entity_context
            results = payload.results
        else:
            query = payload.get('query', '')
            entity_context = payload.get('entity_context', [])
            results = payload.get('results', [])

        # Handle empty results case
        if not results:
            logger.info("No results provided, returning sentinel response")
            if mode == "json":
                return {
                    "answer": None,
                    "facts": [],
                    "entities": [],
                    "confidence": 0.0
                }
            else:
                return "No canon found."

        # Build prompts
        system_prompt, assistant_prompt = build_prompt(
            "answerer",
            query,
            entity_context,
            results
        )

        # Generate response
        try:
            if self.llm is None:
                logger.error("No LLM client available")
                if mode == "json":
                    return {
                        "answer": None,
                        "facts": [],
                        "entities": [],
                        "confidence": 0.0,
                        "error": "No LLM client available"
                    }
                else:
                    return "An error occurred while generating the answer."

            # Get answerer-specific parameters from config
            answerer_params = self.config.get_answerer_params()

            response = self.llm.generate(
                system_prompt=system_prompt,
                assistant_prompt=assistant_prompt,
                temperature=answerer_params.get("temperature"),
                top_p=answerer_params.get("top_p"),
                max_tokens=answerer_params.get("max_tokens"),
                stop=answerer_params.get("stop_sequences"),
                query=query,
                entity_context=entity_context,
                passages=results
            )

            # Check for sentinel response
            if self._check_sentinel_response(response):
                logger.info("LLM returned sentinel response")
                if mode == "json":
                    return {
                        "answer": None,
                        "facts": [],
                        "entities": [],
                        "confidence": 0.0
                    }
                else:
                    return "No canon found."

            # Apply faithfulness check for text mode
            if mode == "text":
                is_faithful, response = self._apply_faithfulness_check(response, results)

                if not is_faithful:
                    if mode == "json":
                        return {
                            "answer": None,
                            "facts": [],
                            "entities": [],
                            "confidence": 0.0
                        }
                    else:
                        return "No canon found."

            # Extract entities for JSON mode
            entity_ids = []
            for entity in entity_context:
                entity_id = entity.get('id', '')
                if entity_id.startswith('ent:'):
                    entity_ids.append(entity_id)

            # Return appropriate format
            if mode == "json":
                return self._format_json_response(response, entity_ids)
            else:
                return response.strip()

        except Exception as e:
            logger.error(f"Error in answer generation: {e}")
            if mode == "json":
                return {
                    "answer": None,
                    "facts": [],
                    "entities": [],
                    "confidence": 0.0,
                    "error": str(e)
                }
            else:
                return "An error occurred while generating the answer."

        finally:
            generation_time = time.time() - start_time
            logger.info(f"Answer generation completed in {generation_time:.3f}s")

    def generate_npc_reply(
        self,
        payload: Union[GenerationPayload, Dict[str, Any]],
        persona: Union[str, Dict[str, Any], None] = None,
        tone: Optional[str] = None
    ) -> str:
        """
        Generate NPC reply using NPC Grounding mode per contract §5.4.

        Args:
            payload: GenerationPayload or dict with query, entity_context, results
            persona: Optional NPC persona dict
            tone: Optional tone control

        Returns:
            In-character dialogue string per contract §5.5.3
        """
        start_time = time.time()

        # Normalize payload
        if isinstance(payload, GenerationPayload):
            query = payload.query
            entity_context = payload.entity_context
            results = payload.results
        else:
            query = payload.get('query', '')
            entity_context = payload.get('entity_context', [])
            results = payload.get('results', [])

        # Handle empty results case - NPC should admit lack of knowledge
        if not results:
            logger.info("No results provided, NPC will admit lack of knowledge")
            resolved_persona = resolve_persona(persona)
            npc_name = resolved_persona.get('name', 'Unknown')
            return f"I fear I know little of such matters, traveler. My knowledge is limited to {npc_name}'s experiences."

        # Resolve persona (can be name string or dict)
        resolved_persona = resolve_persona(persona)

        # Build prompts
        system_prompt, assistant_prompt = build_prompt(
            "npc",
            query,
            entity_context,
            results,
            persona=resolved_persona,
            tone=tone
        )

        # Generate response
        try:
            if self.llm is None:
                logger.error("No LLM client available for NPC generation")
                # Return early error response for LLM None case
                resolved_persona = resolve_persona(persona)
                npc_name = resolved_persona.get('name', 'Unknown')
                return f"Forgive me, but I'm having trouble recalling that information. {npc_name} seems to have forgotten."

            # Get NPC-specific parameters from config
            npc_params = self.config.get_npc_params()

            response = self.llm.generate(
                system_prompt=system_prompt,
                assistant_prompt=assistant_prompt,
                temperature=npc_params.get("temperature"),
                top_p=npc_params.get("top_p"),
                max_tokens=npc_params.get("max_tokens"),
                stop=npc_params.get("stop_sequences"),
                query=query,
                entity_context=entity_context,
                passages=results,
                persona=resolved_persona,
                tone=tone
            )

            # Check for sentinel response
            if self._check_sentinel_response(response):
                logger.info("LLM returned sentinel response for NPC")
                resolved_persona = resolve_persona(persona)
                npc_name = resolved_persona.get('name', 'Unknown')
                return f"I must confess, I know little of such matters. {npc_name} has not encountered this in their travels."

            # Ensure response is in-character and not too long
            response = response.strip()

            # Truncate if too long (should be 2-5 sentences per contract)
            sentences = response.split('.')
            if len(sentences) > 5:
                response = '.'.join(sentences[:5]).strip()
                if not response.endswith('.'):
                    response += '.'

            return response

        except Exception as e:
            logger.error(f"Error in NPC reply generation: {e}")
            resolved_persona = resolve_persona(persona)
            npc_name = resolved_persona.get('name', 'Unknown')
            return f"Forgive me, but I'm having trouble recalling that information. {npc_name} seems to have forgotten."

        finally:
            generation_time = time.time() - start_time
            logger.info(f"NPC reply generation completed in {generation_time:.3f}s")


# Global generator instance
_generator_instance: Optional[Generator] = None


def get_generator(llm_client: Optional[Any] = None) -> Generator:
    """Get the global generator instance."""
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = Generator(llm_client)
    return _generator_instance


def generate_answer(
    payload: Union[GenerationPayload, Dict[str, Any]],
    mode: str = "text",
    llm_client: Optional[Any] = None
) -> Union[str, Dict[str, Any]]:
    """
    Generate answer using Answerer mode per contract §5.8.

    Args:
        payload: GenerationPayload or dict with query, entity_context, results
        mode: "text" or "json"
        llm_client: Optional LLM client (uses mock if not provided)

    Returns:
        Answer string or JSON dict per contract §5.5
    """
    generator = get_generator(llm_client)
    return generator.generate_answer(payload, mode)


def generate_npc_reply(
    payload: Union[GenerationPayload, Dict[str, Any]],
    persona: Union[str, Dict[str, Any], None] = None,
    tone: Optional[str] = None,
    llm_client: Optional[Any] = None
) -> str:
    """
    Generate NPC reply using NPC Grounding mode per contract §5.8.

    Args:
        payload: GenerationPayload or dict with query, entity_context, results
        persona: Optional NPC persona dict
        tone: Optional tone control
        llm_client: Optional LLM client (uses mock if not provided)

    Returns:
        In-character dialogue string per contract §5.5.3
    """
    generator = get_generator(llm_client)
    return generator.generate_npc_reply(payload, persona, tone)