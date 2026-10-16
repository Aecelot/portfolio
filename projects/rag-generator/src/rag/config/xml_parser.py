"""
Centralized XML Parser - Eliminates duplicate XML parsing logic.

Provides a unified, secure XML parsing utility that can be used throughout
the codebase instead of reimplementing XML parsing in multiple files.
"""

from typing import Dict, Any, Optional
from defusedxml import ElementTree as ET
from pathlib import Path


class ConfigParser:
    """
    Centralized, secure XML configuration parser.

    Features:
    - Secure parsing with defusedxml (prevents XXE attacks)
    - Type-safe configuration extraction
    - Hierarchical structure preservation for LLMs
    - Comprehensive error handling and validation
    """

    def __init__(self):
        """Initialize the XML parser."""
        # Use defusedxml for security (prevents XXE attacks)
        try:
            from defusedxml import ElementTree as SecureET
            self.ET = SecureET
        except ImportError:
            print("⚠️  Warning: defusedxml not available, using standard ElementTree")
            print("ℹ️  Install defusedxml for better security: pip install defusedxml")
            self.ET = ET

    @staticmethod
    def parse(config_path: str) -> Dict[str, Any]:
        """
        Parse XML config with validation and security.

        Args:
            config_path: Path to XML configuration file

        Returns:
            Parsed configuration dictionary

        Raises:
            ConfigurationError: If XML is invalid or file not found
        """
        parser = ConfigParser()
        return parser._parse_file(config_path)

    def _parse_file(self, config_path: str) -> Dict[str, Any]:
        """Parse XML file with comprehensive error handling."""
        try:
            # Validate file path
            path = Path(config_path)
            if not path.exists():
                raise FileNotFoundError(f"Configuration file not found: {config_path}")

            if not path.is_file():
                raise ValueError(f"Path is not a file: {config_path}")

            # Parse XML with security considerations
            tree = self.ET.parse(config_path)
            root = tree.getroot()

            # Extract configuration with full structure preservation
            config = {
                'raw_xml': self.ET.tostring(root, encoding='unicode'),  # For LLM context
                'hierarchy': self._extract_hierarchy(root),              # For LLM understanding
                'parsed_config': self._parse_recursive(root),            # For runtime use
                'llm_context': self._generate_llm_context(root)          # For prompt enhancement
            }

            return config

        except ImportError as e:
            raise ImportError(f"XML parsing failed - missing required library: {e}")
        except FileNotFoundError as e:
            raise FileNotFoundError(f"Configuration file not found: {e}")
        except PermissionError as e:
            raise PermissionError(f"Permission denied accessing config file: {e}")
        except self.ET.ParseError as e:
            raise ValueError(f"Invalid XML in configuration file: {e}")
        except Exception as e:
            raise RuntimeError(f"Unexpected error parsing configuration: {e}")

    def _parse_recursive(self, element) -> Dict[str, Any]:
        """Recursively parse XML element to dictionary with type conversion."""
        result = {}

        # Handle attributes
        if element.attrib:
            result.update(element.attrib)

        # Handle text content
        if element.text and element.text.strip():
            text_value = element.text.strip()
            # Try to convert to appropriate type
            result['value'] = self._convert_value(text_value)

        # Process children
        for child in element:
            child_dict = self._parse_recursive(child)

            # Handle name collisions
            child_name = child.tag
            if child_name in result:
                if not isinstance(result[child_name], list):
                    result[child_name] = [result[child_name]]
                result[child_name].append(child_dict)
            else:
                result[child_name] = child_dict

        return result

    def _convert_value(self, value: str) -> Any:
        """Convert string value to appropriate type."""
        # Boolean conversion
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'

        # Integer conversion
        try:
            # Check if it's a valid integer (no decimal point)
            if '.' not in value and 'e' not in value.lower():
                return int(value)
        except ValueError:
            pass

        # Float conversion
        try:
            return float(value)
        except ValueError:
            pass

        # String (default)
        return value

    def _extract_hierarchy(self, element, depth: int = 0) -> Dict[str, Any]:
        """Extract XML hierarchy for LLM understanding."""
        hierarchy = {
            'tag': element.tag,
            'depth': depth,
            'children': []
        }

        for child in element:
            hierarchy['children'].append(self._extract_hierarchy(child, depth + 1))

        return hierarchy

    def _generate_llm_context(self, root) -> str:
        """Generate structured context for LLM processing."""
        hierarchy = self._extract_hierarchy(root)
        return f"""
Configuration Hierarchy:
{self._format_hierarchy(hierarchy)}

Full XML Structure:
{self.ET.tostring(root, encoding='unicode')}
"""

    def _format_hierarchy(self, hierarchy: Dict, indent: int = 0) -> str:
        """Format hierarchy for display."""
        result = "  " * indent + f"{hierarchy['tag']}\n"
        for child in hierarchy['children']:
            result += self._format_hierarchy(child, indent + 1)
        return result


class ConfigurationError(Exception):
    """Raised when there's an error in configuration parsing or validation."""
    pass


# Convenience functions for common use cases
def load_config(config_path: str) -> Dict[str, Any]:
    """
    Load configuration from XML file.

    Args:
        config_path: Path to configuration file

    Returns:
        Parsed configuration dictionary

    Example:
        config = load_config('config/rag/rag.xml')
        embedding_model = config['parsed_config']['vectorization']['embedding_model']['value']
    """
    return ConfigParser.parse(config_path)


def get_config_value(config: Dict[str, Any], key: str, default: Any = None) -> Any:
    """
    Safely extract a value from parsed configuration.

    Args:
        config: Parsed configuration dictionary
        key: Dot-separated key path (e.g., 'vectorization.embedding_model.value')
        default: Default value if key not found

    Returns:
        Configuration value or default

    Example:
        model = get_config_value(config, 'vectorization.embedding_model.value', 'BAAI/bge-base-en')
    """
    keys = key.split('.')
    current = config.get('parsed_config', {})

    try:
        for k in keys:
            if isinstance(current, dict):
                current = current.get(k, {})
            elif isinstance(current, list) and k.isdigit():
                current = current[int(k)]
            else:
                return default
        return current if current != {} else default
    except (KeyError, IndexError, ValueError):
        return default