"""
NPC Persona Loader Module

Parses NPC personas from config/generator.xml and provides persona loading functionality.
"""

import os
import xml.etree.ElementTree as ET
from typing import Dict, List, Any, Optional, Union
from pathlib import Path


class PersonaLoader:
    """Loader for NPC personas from configuration files."""

    def __init__(self, config_path: Optional[str] = None):
        """Initialize persona loader.

        Args:
            config_path: Path to config file (uses default if not provided)
        """
        self.config_path = config_path or self._find_config_file()
        self._personas_cache: Optional[Dict[str, Dict[str, Any]]] = None

    def _find_config_file(self) -> str:
        """Find the configuration file."""
        # Default config paths - prioritize rag.xml for unified config
        config_paths = [
            "config/rag.xml",        # Main unified config (preferred)
            "config/generator.xml",  # Dedicated generator config
            "generation/config.xml"  # Legacy location
        ]

        for path in config_paths:
            if os.path.exists(path):
                return path

        # If no config file found, use the default generator.xml path
        return "config/generator.xml"

    def _load_personas_from_xml(self) -> Dict[str, Dict[str, Any]]:
        """Load personas from XML configuration file."""
        if not os.path.exists(self.config_path):
            return self._load_personas_from_generator_config()

        try:
            tree = ET.parse(self.config_path)
            root = tree.getroot()

            # Look for npc_personas section
            npc_personas_elem = root.find('npc_personas')
            if npc_personas_elem is None:
                # If not found in primary config, try generator.xml
                return self._load_personas_from_generator_config()

            personas = {}

            # Parse each persona
            for persona_elem in npc_personas_elem:
                persona_name = persona_elem.tag
                persona_data = self._parse_persona_element(persona_elem)

                if persona_data:
                    personas[persona_name] = persona_data

            return personas if personas else self._get_default_personas()

        except Exception:
            # Return defaults if XML parsing fails
            return self._load_personas_from_generator_config()

    def _load_personas_from_generator_config(self) -> Dict[str, Dict[str, Any]]:
        """Load personas from the dedicated generator config file."""
        generator_config_path = "config/generator.xml"

        if not os.path.exists(generator_config_path):
            return self._get_default_personas()

        try:
            tree = ET.parse(generator_config_path)
            root = tree.getroot()

            # Look for npc_personas section
            npc_personas_elem = root.find('npc_personas')
            if npc_personas_elem is None:
                return self._get_default_personas()

            personas = {}

            # Parse each persona
            for persona_elem in npc_personas_elem:
                persona_name = persona_elem.tag
                persona_data = self._parse_persona_element(persona_elem)

                if persona_data:
                    personas[persona_name] = persona_data

            return personas if personas else self._get_default_personas()

        except Exception:
            # Return defaults if XML parsing fails
            return self._get_default_personas()

    def _parse_persona_element(self, persona_elem: ET.Element) -> Dict[str, Any]:
        """Parse a single persona XML element."""
        persona = {}

        # Basic fields
        name_elem = persona_elem.find('name')
        if name_elem is not None and name_elem.text:
            persona['name'] = name_elem.text.strip()

        attitude_elem = persona_elem.find('attitude')
        if attitude_elem is not None and attitude_elem.text:
            persona['attitude'] = attitude_elem.text.strip()

        # Goals (can be multiple)
        goals_elem = persona_elem.find('goals')
        if goals_elem is not None:
            goals = []
            for goal_elem in goals_elem:
                if goal_elem.text and goal_elem.text.strip():
                    goals.append(goal_elem.text.strip())
            if goals:
                persona['goals'] = goals

        # Taboo topics (can be multiple)
        taboo_elem = persona_elem.find('taboo_topics')
        if taboo_elem is not None:
            taboo_topics = []
            for topic_elem in taboo_elem:
                if topic_elem.text and topic_elem.text.strip():
                    taboo_topics.append(topic_elem.text.strip())
            if taboo_topics:
                persona['taboo_topics'] = taboo_topics

        return persona

    def _get_default_personas(self) -> Dict[str, Dict[str, Any]]:
        """Get default personas when no config file is available."""
        return {
            "default": {
                "name": "Unknown NPC",
                "attitude": "neutral",
                "goals": ["provide information", "maintain character"],
                "taboo_topics": ["modern technology", "real world events"]
            }
        }

    def _get_personas(self) -> Dict[str, Dict[str, Any]]:
        """Get cached personas or load from file."""
        if self._personas_cache is None:
            self._personas_cache = self._load_personas_from_xml()
        return self._personas_cache

    def load_persona(self, name: str) -> Dict[str, Any]:
        """Load a specific persona by name.

        Args:
            name: Name of the persona to load

        Returns:
            Persona dictionary with keys: name, attitude, goals, taboo_topics

        Raises:
            ValueError: If persona is not found
        """
        personas = self._get_personas()

        if name not in personas:
            raise ValueError(f"Persona '{name}' not found. Available personas: {list(personas.keys())}")

        return personas[name].copy()

    def list_personas(self) -> List[str]:
        """List all available persona names.

        Returns:
            List of available persona names
        """
        return list(self._get_personas().keys())

    def has_persona(self, name: str) -> bool:
        """Check if a persona exists.

        Args:
            name: Name of the persona to check

        Returns:
            True if persona exists, False otherwise
        """
        return name in self._get_personas()

    def reload_personas(self) -> None:
        """Reload personas from configuration file."""
        self._personas_cache = None


# Global persona loader instance
_persona_loader_instance: Optional[PersonaLoader] = None


def get_persona_loader(config_path: Optional[str] = None) -> PersonaLoader:
    """Get the global persona loader instance."""
    global _persona_loader_instance
    if _persona_loader_instance is None:
        _persona_loader_instance = PersonaLoader(config_path)
    return _persona_loader_instance


def load_persona(name: str) -> Dict[str, Any]:
    """Load a persona by name.

    Args:
        name: Name of the persona to load

    Returns:
        Persona dictionary

    Raises:
        ValueError: If persona is not found
    """
    loader = get_persona_loader()
    return loader.load_persona(name)


def list_personas() -> List[str]:
    """List all available persona names.

    Returns:
        List of available persona names
    """
    loader = get_persona_loader()
    return loader.list_personas()


def resolve_persona(persona: Union[str, Dict[str, Any], None]) -> Dict[str, Any]:
    """Resolve persona input to a persona dictionary.

    Args:
        persona: Either a persona name (str), persona dict, or None

    Returns:
        Resolved persona dictionary

    Raises:
        ValueError: If persona name is not found or invalid input provided
    """
    if persona is None:
        # Return default persona if none provided
        return load_persona("default")
    elif isinstance(persona, str):
        # Load persona by name
        return load_persona(persona)
    elif isinstance(persona, dict):
        # Already a persona dict, return as-is
        return persona
    else:
        raise ValueError(f"Invalid persona type: {type(persona)}. Expected str, dict, or None.")