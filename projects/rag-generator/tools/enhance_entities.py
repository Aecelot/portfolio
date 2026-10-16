#!/usr/bin/env python3
"""
Enhanced Entity Extractor for GraphFast

Extracts entities from NPC character XML files and enhances the entities.xml
file with comprehensive character data and relationships.
"""

import xml.etree.ElementTree as ET
from pathlib import Path
import re
from typing import Dict, List, Set
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EntityExtractor:
    """Extracts entities from NPC character files and other sources."""

    def __init__(self):
        self.entities = {}
        self.relationships = []

    def extract_from_npc_files(self, npc_dir: str = "src/npc/characters") -> None:
        """Extract entities from NPC character XML files."""
        logger.info(f"Extracting entities from NPC files in {npc_dir}")

        npc_path = Path(npc_dir)
        if not npc_path.exists():
            logger.warning(f"NPC directory {npc_dir} not found")
            return

        for npc_file in npc_path.glob("*.xml"):
            try:
                self._process_npc_file(npc_file)
            except Exception as e:
                logger.warning(f"Error processing {npc_file}: {e}")

    def _process_npc_file(self, npc_file: Path) -> None:
        """Process a single NPC character file."""
        try:
            tree = ET.parse(npc_file)
            root = tree.getroot()

            # Extract character information from character_card format
            character_name_elem = root.find('character_name')
            if character_name_elem is None or not character_name_elem.text:
                logger.warning(f"No character_name found in {npc_file}")
                return

            character_name = character_name_elem.text.strip()
            character_id = npc_file.stem  # Use filename as ID

            # Create entity ID from character name
            clean_id = character_id.lower().replace(' ', '_').replace("'", '')
            entity_id = f"character_{clean_id}"

            # Add character entity
            entity_id = f"character_{character_id.lower().replace(' ', '_')}"
            self.entities[entity_id] = {
                'id': entity_id,
                'name': character_name,
                'type': 'character',
                'aliases': self._extract_aliases(root, character_name),
                'source_file': str(npc_file)
            }

            # Extract relationships and other entities mentioned
            self._extract_relationships_from_npc(root, entity_id)

        except ET.ParseError as e:
            logger.error(f"Invalid XML in {npc_file}: {e}")
        except Exception as e:
            logger.error(f"Error processing NPC file {npc_file}: {e}")

    def _extract_aliases(self, npc_root: ET.Element, character_name: str) -> List[str]:
        """Extract aliases for a character."""
        aliases = []

        # Add variations of the character name
        name_parts = character_name.lower().split()
        if len(name_parts) > 1:
            # Add first name only
            aliases.append(name_parts[0])
            # Add last name only
            aliases.append(name_parts[-1])

        # Add full name variations
        aliases.append(character_name.lower())

        # Look for explicit aliases in the XML
        for elem in npc_root.iter():
            if elem.tag in ['alias', 'nickname', 'title']:
                alias_text = elem.text.strip() if elem.text else ""
                if alias_text:
                    aliases.append(alias_text.lower())

        # Remove duplicates while preserving order
        seen = set()
        unique_aliases = []
        for alias in aliases:
            if alias not in seen:
                seen.add(alias)
                unique_aliases.append(alias)

        return unique_aliases

    def _extract_relationships_from_npc(self, npc_root: ET.Element, character_entity_id: str) -> None:
        """Extract relationships and other entities from NPC content."""
        # Extract explicit relationships from relation_to_other_actors
        relations_elem = npc_root.find('relation_to_other_actors')
        if relations_elem is not None:
            for relation in relations_elem.findall('relation'):
                actor_elem = relation.find('actor')
                desc_elem = relation.find('description')

                if actor_elem is not None and actor_elem.text:
                    actor_name = actor_elem.text.strip()

                    # Determine entity type based on context
                    entity_type = self._classify_entity_type(actor_name, desc_elem.text if desc_elem is not None else "")

                    clean_name = actor_name.lower().replace(' ', '_').replace("'", '')
                    entity_id = f"{entity_type}_{clean_name}"
                    if entity_id not in self.entities:
                        self.entities[entity_id] = {
                            'id': entity_id,
                            'name': actor_name,
                            'type': entity_type,
                            'aliases': [actor_name.lower()],
                            'source_file': 'relationship'
                        }

                    # Create relationship
                    self.relationships.append({
                        'source': character_entity_id,
                        'target': entity_id,
                        'relationship_type': 'related_to'
                    })

        # Get all text content from the NPC file for additional entity extraction
        text_content = ET.tostring(npc_root, encoding='unicode')

        # Look for mentions of other entities in the text
        entity_mentions = self._find_entity_mentions_in_text(text_content)

        for mention in entity_mentions:
            if len(mention) > 3:  # Skip very short words
                # Check if it's already covered by explicit relationships
                existing_targets = [r['target'] for r in self.relationships if r['source'] == character_entity_id]

                entity_type = 'location'  # Default to location for mentions
                clean_mention = mention.lower().replace(' ', '_').replace("'", '')
                entity_id = f"{entity_type}_{clean_mention}"

                if entity_id not in existing_targets and entity_id not in self.entities:
                    self.entities[entity_id] = {
                        'id': entity_id,
                        'name': mention,
                        'type': entity_type,
                        'aliases': [mention.lower()],
                        'source_file': 'text_mention'
                    }

                    # Create relationship
                    self.relationships.append({
                        'source': character_entity_id,
                        'target': entity_id,
                        'relationship_type': 'mentions'
                    })

    def _classify_entity_type(self, entity_name: str, description: str = "") -> str:
        """Classify entity type based on name and description."""
        desc_lower = description.lower()
        name_lower = entity_name.lower()

        if any(word in desc_lower for word in ['guild', 'house', 'order', 'clan', 'brotherhood']):
            return 'organization'
        elif any(word in name_lower for word in ['guild', 'house', 'order', 'clan', 'brotherhood']):
            return 'organization'
        elif any(word in desc_lower for word in ['city', 'town', 'village', 'region', 'mountain', 'forest', 'river']):
            return 'location'
        elif any(word in name_lower for word in ['pit', 'arena', 'temple', 'castle', 'tower']):
            return 'location'
        else:
            return 'character'

    def _find_entity_mentions_in_text(self, text: str) -> Set[str]:
        """Find potential entity mentions in text."""
        mentions = set()

        # Pattern to find capitalized words that might be proper nouns
        words = re.findall(r'\b[A-Z][a-z]+\b', text)

        # Filter for likely entity names (longer words, not common words)
        common_words = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'had', 'but', 'its', 'his', 'her'}

        for word in words:
            if len(word) > 3 and word.lower() not in common_words:
                mentions.add(word)

        return mentions

    def _find_entity_mentions(self, text: str, entity_type: str) -> Set[str]:
        """Find mentions of specific entity types in text."""
        mentions = set()

        # Pattern to find capitalized words that might be entity names
        words = re.findall(r'\b[A-Z][a-z]+\b', text)

        # Filter for likely entity names (longer words, specific patterns)
        for word in words:
            if len(word) > 3:  # Skip short words
                mentions.add(word)

        return mentions

    def enhance_entities_xml(self, entities_file: str = "src/data/entities.xml") -> None:
        """Enhance the existing entities.xml file with new entities."""
        logger.info(f"Enhancing entities file: {entities_file}")

        # Load existing entities
        existing_entities = {}
        if Path(entities_file).exists():
            try:
                tree = ET.parse(entities_file)
                root = tree.getroot()

                for entity_elem in root.findall('entity'):
                    entity_id = entity_elem.get('id')
                    if entity_id:
                        existing_entities[entity_id] = entity_elem

            except Exception as e:
                logger.warning(f"Error loading existing entities file: {e}")

        # Create new entities.xml
        root = ET.Element('entities')

        # Add existing entities first
        for entity_id, entity_elem in existing_entities.items():
            root.append(entity_elem)

        # Add new entities
        for entity_id, entity_info in self.entities.items():
            if entity_id not in existing_entities:
                entity_elem = ET.SubElement(root, 'entity')
                entity_elem.set('id', entity_id)
                entity_elem.set('name', entity_info['name'])
                entity_elem.set('type', entity_info['type'])

                # Add aliases if any
                if entity_info['aliases']:
                    aliases_elem = ET.SubElement(entity_elem, 'aliases')
                    aliases_elem.text = ', '.join(entity_info['aliases'])

        # Write enhanced entities.xml
        tree = ET.ElementTree(root)
        tree.write(entities_file, encoding='utf-8', xml_declaration=True)
        logger.info(f"✅ Enhanced entities.xml with {len(self.entities)} total entities")


def main():
    """Main entry point for entity enhancement."""
    print("🧠 Enhancing Entity Data for GraphFast")
    print("=" * 45)

    extractor = EntityExtractor()

    # Extract from NPC files
    extractor.extract_from_npc_files()

    print(f"📊 Extracted {len(extractor.entities)} entities")
    print(f"🔗 Found {len(extractor.relationships)} relationships")

    # Show sample entities
    print("\n📋 Sample Entities:")
    for i, (entity_id, entity_info) in enumerate(extractor.entities.items()):
        if i >= 5:  # Show first 5
            break
        print(f"   • {entity_id}: {entity_info['name']} ({entity_info['type']})")

    # Enhance entities.xml
    extractor.enhance_entities_xml()

    print("✅ Entity enhancement completed!")
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)