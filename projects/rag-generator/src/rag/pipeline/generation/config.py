"""
Generator Configuration Module

Manages generator settings for Answerer and NPC modes per contract specifications.
"""

import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from pathlib import Path


@dataclass
class GeneratorConfig:
    """Configuration for LLM generation parameters."""

    # Answerer settings (Lore Q&A / Codex)
    answerer_temp: float = 0.2
    answerer_top_p: float = 0.9
    answerer_max_tokens: int = 300
    answerer_mode_default: str = "text"  # "text" or "json"
    answerer_faithfulness_check: bool = True

    # NPC settings (Dialogue)
    npc_temp: float = 0.5
    npc_top_p: float = 0.9
    npc_max_tokens: int = 160
    npc_persona_tokens: bool = True
    npc_block_ooc: bool = True

    # Shared settings
    no_canon_sentinel: str = "NO_CANON_FOUND"

    # Advanced settings
    enable_logging: bool = True
    log_level: str = "INFO"
    cache_prompts: bool = True

    @classmethod
    def from_xml(cls, config_path: Optional[str] = None) -> "GeneratorConfig":
        """Load configuration from XML file."""
        if config_path is None:
            # Default config paths - prioritize rag.xml for unified config
            config_paths = [
                "config/rag.xml",        # Main unified config (preferred)
                "config/generator.xml",  # Dedicated generator config
                "generation/config.xml"  # Legacy location
            ]

            for path in config_paths:
                if os.path.exists(path):
                    config_path = path
                    break

        if config_path and os.path.exists(config_path):
            # Parse XML file
            tree = ET.parse(config_path)
            root = tree.getroot()

            # Handle both unified config (generator section) and dedicated generator config
            generator_data = None

            # Check if this is a unified config (has generator element)
            generator_elem = root.find('generator')
            if generator_elem is not None:
                # Unified config with generator section
                generator_data = cls._xml_to_dict(generator_elem)
            else:
                # Dedicated generator config file (whole file is generator config)
                generator_data = cls._xml_to_dict(root)

            if generator_data:
                return cls.from_dict(generator_data)

        # Return default configuration if no config file found or no generator section
        return cls()

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> "GeneratorConfig":
        """Create configuration from dictionary."""
        # Filter out only the fields that belong to GeneratorConfig
        valid_fields = {field.name for field in cls.__dataclass_fields__.values()}
        filtered_config = {k: v for k, v in config_dict.items() if k in valid_fields}

        return cls(**filtered_config)

    @classmethod
    def _xml_to_dict(cls, element: ET.Element) -> Dict[str, Any]:
        """Convert XML element to dictionary."""
        def xml_element_to_dict(elem: ET.Element) -> Any:
            # If element has no children and no attributes, treat as simple value
            if len(list(elem)) == 0 and not elem.attrib:
                text = elem.text.strip() if elem.text else ""
                # Try to convert to appropriate type
                if text.lower() in ('true', 'false'):
                    return text.lower() == 'true'
                elif text.isdigit():
                    return int(text)
                elif text.replace('.', '', 1).isdigit():
                    return float(text)
                else:
                    return text

            # If element has attributes but no children, include attributes
            if len(list(elem)) == 0 and elem.attrib:
                result = {}
                if elem.text and elem.text.strip():
                    result['value'] = xml_element_to_dict(ET.Element('value'))
                    result['value'] = elem.text.strip()
                result.update(elem.attrib)
                return result

            # Element has children - create dictionary
            result = {}

            # Add attributes if any
            if elem.attrib:
                result.update(elem.attrib)

            # Add text content if any (for mixed content)
            if elem.text and elem.text.strip():
                if not result:  # If no attributes or children yet
                    return elem.text.strip()

            # Process children
            for child in elem:
                child_dict = xml_element_to_dict(child)

                # Handle multiple children with same name
                if child.tag in result:
                    if not isinstance(result[child.tag], list):
                        result[child.tag] = [result[child.tag]]
                    result[child.tag].append(child_dict)
                else:
                    result[child.tag] = child_dict

                # Handle tail text (text after child element)
                if child.tail and child.tail.strip():
                    if 'tail' not in result:
                        result['tail'] = child.tail.strip()
                    elif isinstance(result['tail'], list):
                        result['tail'].append(child.tail.strip())
                    else:
                        result['tail'] = [result['tail'], child.tail.strip()]

            return result

        return xml_element_to_dict(element)

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            field.name: getattr(self, field.name)
            for field in self.__dataclass_fields__.values()
        }

    def save_xml(self, config_path: str) -> None:
        """Save configuration to XML file."""
        config_dir = os.path.dirname(config_path)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)

        # Load existing config if it exists to preserve other sections
        if os.path.exists(config_path):
            tree = ET.parse(config_path)
            root = tree.getroot()
        else:
            root = ET.Element('configuration')

        # Update only the generator section
        generator_elem = root.find('generator')
        if generator_elem is None:
            generator_elem = ET.SubElement(root, 'generator')

        # Clear existing children
        generator_elem.clear()

        # Add current config values
        config_dict = self.to_dict()
        for key, value in config_dict.items():
            child = ET.SubElement(generator_elem, key)
            child.text = str(value)

        # Write back to file
        tree = ET.ElementTree(root)
        tree.write(config_path, encoding='utf-8', xml_declaration=True)

    def get_answerer_params(self) -> Dict[str, Any]:
        """Get parameters for Answerer generation."""
        return {
            "temperature": self.answerer_temp,
            "top_p": self.answerer_top_p,
            "max_tokens": self.answerer_max_tokens,
            "stop_sequences": [f"{self.no_canon_sentinel}\n\n", "\n###"]
        }

    def get_npc_params(self) -> Dict[str, Any]:
        """Get parameters for NPC generation."""
        return {
            "temperature": self.npc_temp,
            "top_p": self.npc_top_p,
            "max_tokens": self.npc_max_tokens,
            "stop_sequences": [f"{self.no_canon_sentinel}\n\n", "\n###"]
        }


# Global configuration instance
_config_instance: Optional[GeneratorConfig] = None


def get_config() -> GeneratorConfig:
    """Get the global configuration instance."""
    global _config_instance
    if _config_instance is None:
        _config_instance = GeneratorConfig.from_xml()
    return _config_instance


def set_config(config: GeneratorConfig) -> None:
    """Set the global configuration instance."""
    global _config_instance
    _config_instance = config


def reload_config() -> GeneratorConfig:
    """Reload configuration from file."""
    global _config_instance
    _config_instance = GeneratorConfig.from_xml()
    return _config_instance


@dataclass
class GenerationConfig:
    """Configuration for LLM generation parameters."""

    # Core generation parameters
    model: str = "gpt-3.5-turbo"
    temperature: float = 0.7
    max_tokens: int = 150

    # Additional parameters
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    stop_sequences: Optional[List[str]] = None

    def __post_init__(self):
        """Validate configuration after initialization."""
        if not self.model:
            raise ValueError("Model name cannot be empty")

        if not (0.0 <= self.temperature <= 2.0):
            raise ValueError("Temperature must be between 0.0 and 2.0")

        if self.max_tokens <= 0:
            raise ValueError("max_tokens must be positive")

        if self.top_p is not None and not (0.0 <= self.top_p <= 1.0):
            raise ValueError("top_p must be between 0.0 and 1.0")

        if self.stop_sequences is None:
            self.stop_sequences = []

    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> "GenerationConfig":
        """Create GenerationConfig from dictionary."""
        # Filter out only the fields that belong to GenerationConfig
        valid_fields = {field.name for field in cls.__dataclass_fields__.values()}
        filtered_config = {k: v for k, v in config_dict.items() if k in valid_fields}

        return cls(**filtered_config)

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            field.name: getattr(self, field.name)
            for field in self.__dataclass_fields__.values()
        }

    def get_generation_params(self) -> Dict[str, Any]:
        """Get parameters for LLM generation."""
        params = {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        if self.top_p is not None:
            params["top_p"] = self.top_p

        if self.frequency_penalty != 0.0:
            params["frequency_penalty"] = self.frequency_penalty

        if self.presence_penalty != 0.0:
            params["presence_penalty"] = self.presence_penalty

        if self.stop_sequences:
            params["stop"] = self.stop_sequences

        return params