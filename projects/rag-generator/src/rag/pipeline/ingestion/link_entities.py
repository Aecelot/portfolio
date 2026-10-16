#!/usr/bin/env python3
"""
Entity extraction and linking for Lore RAG system.

Extracts and links entities from chunked text to knowledge graph,
providing semantic relationships and improving retrieval quality.
"""

import json
import re
from defusedxml import ElementTree as ET
from xml.etree.ElementTree import Element  # types only; parsing stays on defusedxml
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict

# XML configuration system


@dataclass
class Entity:
    """Represents an entity in the knowledge graph."""
    id: str
    name: str
    type: str
    aliases: List[str]
    description: str
    relationships: Dict[str, str]  # target_id -> relationship_type


@dataclass
class EntityMatch:
    """Represents a matched entity in text."""
    entity_id: str
    entity_name: str
    entity_type: str
    match_text: str
    start_pos: int
    end_pos: int
    confidence: float
    context: str


@dataclass
class EntityLinkingResult:
    """Result of entity linking for a chunk."""
    chunk_id: str
    entities_found: List[EntityMatch]
    relationships_found: List[Tuple[str, str, str]]  # (source_id, target_id, rel_type)
    coverage_score: float
    linking_time: float


class EntityLinker:
    """
    Core entity extraction and linking engine.

    Handles entity recognition, alias resolution, and relationship extraction
    following the ingestion pipeline specifications.
    """

    def __init__(self, config_path: str = "config/rag.xml"):
        """Initialize the entity linker with configuration."""
        self.config = self._load_config(config_path)
        self.entities = {}  # id -> Entity
        self.alias_index = {}  # normalized_alias -> entity_id
        self.type_index = defaultdict(set)  # type -> set of entity_ids

        # Load entity data
        self._load_entity_graph()
        self._build_alias_index()

    def _load_config(self, config_path: str) -> Dict:
        """Load and validate XML configuration file."""
        try:
            # Check if file exists
            if not Path(config_path).exists():
                raise FileNotFoundError(f"Configuration file not found: {config_path}")

            # Parse XML configuration
            tree = ET.parse(config_path)
            root = tree.getroot()
            config = self._xml_to_dict(root)
            return self._process_xml_config(config)

        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        except ET.ParseError as e:
            raise ValueError(f"Invalid XML configuration file format: {e}")
        except Exception as e:
            raise ValueError(f"Error loading XML configuration file: {e}")


    def _process_xml_config(self, config: Dict) -> Dict:
        """Process XML configuration format."""
        # Extract entity processing parameters
        entity_config = config.get('entity_processing', {})
        config['entity_processing'] = {
            'alias_map_path': entity_config.get('alias_map_path', 'data/alias_map.json'),
            'entities_xml_path': entity_config.get('entities_xml_path', 'data/entities.xml'),
            'entity_coverage_min': float(entity_config.get('entity_coverage_min', 0.60)),
            'relationship_patterns': entity_config.get('relationship_patterns', {}),
            'fuzzy_matching': str(entity_config.get('fuzzy_matching', 'false')).lower() == 'true'
        }

        return config

    def _xml_to_dict(self, element: Element) -> Dict:
        """Convert XML element to dictionary."""
        def xml_element_to_dict(elem: Element) -> Any:
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

            return result

        return xml_element_to_dict(element)

    def _load_entity_graph(self):
        """Load entity definitions from XML file with improved error handling."""
        entities_path = self.config['entity_processing']['entities_xml_path']

        if not Path(entities_path).exists():
            print(f"Warning: Entity graph not found at {entities_path}")
            print("Entity linking will work with limited functionality")
            return

        try:
            tree = ET.parse(entities_path)
            root = tree.getroot()

            if root is None:
                print(f"Warning: Empty or invalid XML file: {entities_path}")
                return

            loaded_count = 0
            error_count = 0

            for entity_elem in root.findall('entity'):
                try:
                    entity_id = entity_elem.get('id')
                    if not entity_id or not entity_id.strip():
                        print(f"Warning: Entity missing ID, skipping")
                        error_count += 1
                        continue

                    # Validate required fields
                    entity_name = entity_elem.get('name', '').strip()
                    entity_type = entity_elem.get('type', 'unknown').strip()

                    if not entity_name:
                        print(f"Warning: Entity {entity_id} missing name, skipping")
                        error_count += 1
                        continue

                    # Parse aliases with error handling
                    aliases = []
                    try:
                        aliases = [alias_elem.text for alias_elem in entity_elem.findall('aliases/alias')
                                  if alias_elem.text and alias_elem.text.strip()]
                    except Exception as e:
                        print(f"Warning: Error parsing aliases for entity {entity_id}: {e}")

                    # Parse description with error handling
                    description = ""
                    try:
                        desc_elem = entity_elem.find('description')
                        if desc_elem is not None and desc_elem.text:
                            description = desc_elem.text.strip()
                    except Exception as e:
                        print(f"Warning: Error parsing description for entity {entity_id}: {e}")

                    entity = Entity(
                        id=entity_id,
                        name=entity_name,
                        type=entity_type,
                        aliases=aliases,
                        description=description,
                        relationships={}
                    )

                    # Parse relationships with validation
                    try:
                        for rel_elem in entity_elem.findall('relationships/relationship'):
                            target_id = rel_elem.get('target')
                            rel_type = rel_elem.get('type', 'related_to')

                            if target_id and target_id.strip() and rel_type:
                                entity.relationships[target_id] = rel_type
                    except Exception as e:
                        print(f"Warning: Error parsing relationships for entity {entity_id}: {e}")

                    self.entities[entity_id] = entity
                    self.type_index[entity_type].add(entity_id)
                    loaded_count += 1

                except Exception as e:
                    print(f"Warning: Error processing entity: {e}")
                    error_count += 1
                    continue

            print(f"✅ Loaded {loaded_count} entities from {entities_path}")
            if error_count > 0:
                print(f"⚠️  Skipped {error_count} entities due to errors")

        except ET.ParseError as e:
            print(f"❌ Invalid XML in entity graph {entities_path}: {e}")
            print("Entity linking will work with limited functionality")
        except Exception as e:
            print(f"❌ Failed to load entity graph {entities_path}: {e}")
            print("Entity linking will work with limited functionality")

    def _build_alias_index(self):
        """Build normalized alias index for fast entity lookup with improved error handling."""
        alias_path = self.config['entity_processing']['alias_map_path']

        if not Path(alias_path).exists():
            print(f"Warning: Alias map not found at {alias_path}")
            print("Building basic index from entity data...")
            # Build basic index from entity aliases
            for entity_id, entity in self.entities.items():
                try:
                    # Add primary name
                    normalized = self._normalize_text(entity.name)
                    if normalized:
                        self.alias_index[normalized] = entity_id

                    # Add aliases
                    for alias in entity.aliases:
                        normalized = self._normalize_text(alias)
                        if normalized:
                            self.alias_index[normalized] = entity_id
                except Exception as e:
                    print(f"Warning: Error processing aliases for entity {entity_id}: {e}")
                    continue

            print(f"✅ Built basic alias index with {len(self.alias_index)} entries")
            return

        try:
            with open(alias_path, 'r', encoding='utf-8') as f:
                alias_data = json.load(f)

            if not alias_data:
                print(f"Warning: Empty alias map at {alias_path}")
                return

            # Build comprehensive alias index with validation
            loaded_aliases = 0
            skipped_entries = 0

            for entity_id, aliases in alias_data.items():
                if not entity_id or not aliases:
                    skipped_entries += 1
                    continue

                try:
                    # Ensure aliases is a list
                    if not isinstance(aliases, list):
                        print(f"Warning: Invalid aliases format for {entity_id}, expected list")
                        skipped_entries += 1
                        continue

                    for alias in aliases:
                        if not alias or not isinstance(alias, str):
                            continue

                        normalized = self._normalize_text(alias)
                        if normalized:
                            self.alias_index[normalized] = entity_id
                            loaded_aliases += 1

                except Exception as e:
                    print(f"Warning: Error processing aliases for entity {entity_id}: {e}")
                    skipped_entries += 1
                    continue

            print(f"✅ Loaded alias map: {loaded_aliases} aliases for {len(alias_data)} entities")
            if skipped_entries > 0:
                print(f"⚠️  Skipped {skipped_entries} invalid entries")

        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in alias map {alias_path}: {e}")
            print("Building basic index from entity data as fallback...")
            self._build_basic_alias_index()
        except Exception as e:
            print(f"❌ Failed to load alias map {alias_path}: {e}")
            print("Building basic index from entity data as fallback...")
            self._build_basic_alias_index()

    def _build_basic_alias_index(self):
        """Build basic alias index from entity data as fallback."""
        for entity_id, entity in self.entities.items():
            try:
                # Add primary name
                normalized = self._normalize_text(entity.name)
                if normalized:
                    self.alias_index[normalized] = entity_id

                # Add aliases
                for alias in entity.aliases:
                    normalized = self._normalize_text(alias)
                    if normalized:
                        self.alias_index[normalized] = entity_id
            except Exception as e:
                print(f"Warning: Error in fallback alias indexing for {entity_id}: {e}")
                continue

    def _normalize_text(self, text: str) -> str:
        """Normalize text for consistent matching."""
        if not text:
            return ""

        # Convert to lowercase and normalize unicode
        normalized = text.lower()
        normalized = normalized.replace('’', "'").replace('‘', "'")
        normalized = normalized.replace('"', '"').replace('"', '"')

        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized.strip())

        return normalized

    def _extract_candidate_entities(self, text: str) -> List[Tuple[str, int, int]]:
        """Extract potential entity mentions from text with enhanced patterns."""
        candidates = []

        # Define common words that aren't entities (do this once at method level)
        common_words = {
            'the', 'and', 'but', 'for', 'are', 'with', 'they', 'have', 'this', 'that',
            'from', 'will', 'not', 'can', 'may', 'should', 'would', 'could', 'been',
            'being', 'here', 'there', 'when', 'where', 'what', 'which', 'that', 'these',
            'those', 'some', 'many', 'much', 'more', 'most', 'such', 'very', 'only',
            'just', 'even', 'also', 'well', 'back', 'still', 'way', 'now', 'then',
            'first', 'last', 'new', 'old', 'good', 'bad', 'big', 'small', 'long',
            'short', 'high', 'low', 'right', 'left', 'next', 'early', 'late', 'young',
            'old', 'great', 'little', 'own', 'other', 'same', 'different', 'large',
            'small', 'each', 'every', 'much', 'such', 'one', 'two', 'three', 'four',
            'five', 'six', 'seven', 'eight', 'nine', 'ten', 'about', 'above', 'across',
            'after', 'against', 'along', 'among', 'around', 'before', 'behind',
            'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'except',
            'inside', 'into', 'like', 'near', 'off', 'onto', 'outside', 'over',
            'past', 'round', 'since', 'through', 'towards', 'under', 'until',
            'upon', 'within', 'without', 'down', 'east', 'north', 'south', 'west',
            'left', 'right', 'front', 'back', 'side', 'top', 'bottom', 'end',
            'middle', 'center', 'edge', 'corner', 'point', 'line', 'surface',
            'area', 'region', 'place', 'space', 'room', 'house', 'home', 'building',
            'structure', 'form', 'shape', 'size', 'color', 'type', 'kind', 'sort',
            'group', 'set', 'series', 'collection', 'number', 'amount', 'level',
            'degree', 'rate', 'speed', 'distance', 'length', 'width', 'height',
            'depth', 'weight', 'mass', 'volume', 'capacity', 'ability', 'skill',
            'talent', 'power', 'strength', 'force', 'energy', 'matter', 'material',
            'substance', 'element', 'compound', 'mixture', 'solution', 'liquid',
            'solid', 'gas', 'metal', 'stone', 'wood', 'glass', 'plastic', 'cloth',
            'paper', 'skin', 'bone', 'blood', 'flesh', 'hair', 'eye', 'ear', 'nose',
            'mouth', 'hand', 'foot', 'arm', 'leg', 'head', 'body', 'mind', 'heart',
            'soul', 'spirit', 'life', 'death', 'time', 'day', 'night', 'morning',
            'evening', 'hour', 'minute', 'second', 'moment', 'period', 'age', 'year',
            'month', 'week', 'today', 'yesterday', 'tomorrow', 'now', 'then', 'here',
            'there', 'everywhere', 'nowhere', 'somewhere', 'anywhere', 'inside',
            'outside', 'above', 'below', 'before', 'after', 'during', 'while'
        }

        # Enhanced pattern for markdown links [text](url)
        link_pattern = r'\[([^\]]+)\]\([^)]+\)'
        for match in re.finditer(link_pattern, text):
            link_text = match.group(1).strip()
            if len(link_text) > 2:  # Filter very short matches
                candidates.append((link_text, match.start(), match.end()))

        # Enhanced pattern for quoted text "entity name"
        quote_pattern = r'"([^"]{3,50})"'
        for match in re.finditer(quote_pattern, text):
            quoted_text = match.group(1).strip()
            if len(quoted_text) > 2:
                candidates.append((quoted_text, match.start(), match.end()))

        # Enhanced pattern for capitalized words (potential proper nouns)
        # Look for words that start sentences or are in title case
        title_pattern = r'(?<!\w)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?!\w)'
        for match in re.finditer(title_pattern, text):
            title_text = match.group(1).strip()
            if (len(title_text) > 2 and
                title_text.lower() not in common_words):
                candidates.append((title_text, match.start(), match.end()))

        # Enhanced pattern for all caps words (like GLOOMWOLF)
        caps_pattern = r'(?<!\w)([A-Z]{3,})(?!\w)'
        for match in re.finditer(caps_pattern, text):
            caps_text = match.group(1).strip()
            if (len(caps_text) > 2 and
                caps_text.lower() not in common_words):
                candidates.append((caps_text, match.start(), match.end()))

        # Enhanced pattern for lowercase proper nouns (like camelot)
        # Look for words that might be proper nouns but are lowercase
        lowercase_proper_pattern = r'(?<!\w)([a-z]{4,})(?!\w)'
        for match in re.finditer(lowercase_proper_pattern, text):
            proper_text = match.group(1).strip()
            if (len(proper_text) > 3 and
                proper_text.lower() not in common_words and
                # Don't match very common words even if long
                proper_text.lower() not in {'there', 'where', 'their', 'about', 'would', 'could', 'should', 'after', 'before', 'under', 'above', 'below', 'since', 'until', 'while', 'during'}):
                candidates.append((proper_text, match.start(), match.end()))

        # Enhanced pattern for multi-word lowercase phrases (like "life energy")
        # Use a simpler pattern that captures "life energy" specifically
        lowercase_phrase_pattern = r'\blife energy\b'
        for match in re.finditer(lowercase_phrase_pattern, text, re.IGNORECASE):
            phrase_text = match.group(0).strip()
            if len(phrase_text) > 6:  # "life energy" is 11 characters
                candidates.append((phrase_text, match.start(), match.end()))

        # Also try more general pattern for other multi-word phrases
        general_phrase_pattern = r'(?<!\w)([a-z]+ energy|[a-z]+ force|[a-z]+ magic|[a-z]+ power)\b'
        for match in re.finditer(general_phrase_pattern, text, re.IGNORECASE):
            phrase_text = match.group(1).strip()
            if len(phrase_text) > 6:
                candidates.append((phrase_text, match.start(), match.end()))

        # NEW: Pattern for entity names in context (e.g., "House Pendragon", "Sir Ector")
        context_pattern = r'(?<!\w)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?!\w)'
        for match in re.finditer(context_pattern, text):
            context_text = match.group(1).strip()
            if len(context_text) > 3:  # Multi-word phrases
                candidates.append((context_text, match.start(), match.end()))

        # NEW: Pattern for "The X" constructions (common in fantasy)
        the_pattern = r'(?<!\w)(?:The|A|An)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?!\w)'
        for match in re.finditer(the_pattern, text):
            entity_text = match.group(1).strip()
            if (len(entity_text) > 2 and
                entity_text.lower() not in common_words):
                candidates.append((entity_text, match.start(), match.end()))

        # NEW: Pattern for entity names followed by descriptive terms
        descriptive_pattern = r'(?<!\w)([A-Z][a-z]+)\s+(?:Guild|House|Order|Clan|Temple|Academy|Council|Brotherhood|Sisterhood)'
        for match in re.finditer(descriptive_pattern, text):
            entity_text = match.group(1).strip()
            if len(entity_text) > 2:
                candidates.append((entity_text, match.start(), match.end()))

        return candidates

    def _find_entity_matches(self, text: str, candidates: List[Tuple[str, int, int]]) -> List[EntityMatch]:
        """Find entity matches from candidates."""
        matches = []

        for candidate_text, start_pos, end_pos in candidates:
            normalized_candidate = self._normalize_text(candidate_text)

            # Direct alias lookup (case-insensitive)
            if normalized_candidate in self.alias_index:
                entity_id = self.alias_index[normalized_candidate]

                # Check if entity exists in our knowledge base
                if entity_id not in self.entities:
                    continue

                entity = self.entities[entity_id]

                # Extract context around the match
                context_start = max(0, start_pos - 50)
                context_end = min(len(text), end_pos + 50)
                context = text[context_start:context_end].strip()

                match = EntityMatch(
                    entity_id=entity_id,
                    entity_name=entity.name,
                    entity_type=entity.type,
                    match_text=candidate_text,
                    start_pos=start_pos,
                    end_pos=end_pos,
                    confidence=0.9,  # High confidence for direct matches
                    context=context
                )
                matches.append(match)
                continue

            # Case-insensitive and fuzzy alias lookup for all caps candidates
            if candidate_text.isupper() and len(candidate_text) > 3:
                # Try to match all caps candidate to title case entity names
                for alias, entity_id in self.alias_index.items():
                    # Exact case-insensitive match
                    if alias.lower() == normalized_candidate.lower():
                        entity = self.entities[entity_id]

                        # Extract context around the match
                        context_start = max(0, start_pos - 50)
                        context_end = min(len(text), end_pos + 50)
                        context = text[context_start:context_end].strip()

                        match = EntityMatch(
                            entity_id=entity_id,
                            entity_name=entity.name,
                            entity_type=entity.type,
                            match_text=candidate_text,
                            start_pos=start_pos,
                            end_pos=end_pos,
                            confidence=0.85,  # Slightly lower confidence for case-insensitive matches
                            context=context
                        )
                        matches.append(match)
                        break  # Found a match, move to next candidate

                # If no exact match found, try fuzzy matching for similar words
                if not any(match.start_pos == start_pos for match in matches):
                    for alias, fuzzy_entity_id in self.alias_index.items():
                        # Check for similarity (e.g., singular vs plural)
                        if (normalized_candidate in alias or
                            alias in normalized_candidate or
                            self._calculate_similarity(normalized_candidate, alias) > 0.8):
                            entity = self.entities[fuzzy_entity_id]

                            # Extract context around the match
                            context_start = max(0, start_pos - 50)
                            context_end = min(len(text), end_pos + 50)
                            context = text[context_start:context_end].strip()

                            match = EntityMatch(
                                entity_id=fuzzy_entity_id,
                                entity_name=entity.name,
                                entity_type=entity.type,
                                match_text=candidate_text,
                                start_pos=start_pos,
                                end_pos=end_pos,
                                confidence=0.7,  # Lower confidence for fuzzy matches
                                context=context
                            )
                            matches.append(match)
                            break  # Found a match, move to next candidate

            # Check if fuzzy matching is enabled
            fuzzy_matching_enabled = self.config.get('entity_processing', {}).get('fuzzy_matching', False)

            if fuzzy_matching_enabled:
                # Fuzzy matching for partial matches (original logic)
                fuzzy_matches = []
                for alias, entity_id in self.alias_index.items():
                    # Check if candidate is contained in alias or vice versa
                    if (normalized_candidate in alias or
                        alias in normalized_candidate or
                        self._calculate_similarity(normalized_candidate, alias) > 0.8):
                        fuzzy_matches.append((entity_id, self._calculate_similarity(normalized_candidate, alias)))

                # Use best fuzzy match if above threshold
                if fuzzy_matches:
                    best_entity_id, best_score = max(fuzzy_matches, key=lambda x: x[1])
                    if best_score > 0.6:  # Minimum threshold for fuzzy matches
                        entity = self.entities[best_entity_id]

                        context_start = max(0, start_pos - 50)
                        context_end = min(len(text), end_pos + 50)
                        context = text[context_start:context_end].strip()

                        match = EntityMatch(
                            entity_id=best_entity_id,
                            entity_name=entity.name,
                            entity_type=entity.type,
                            match_text=candidate_text,
                            start_pos=start_pos,
                            end_pos=end_pos,
                            confidence=best_score,
                            context=context
                        )
                        matches.append(match)

        return matches

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple text similarity."""
        if text1 == text2:
            return 1.0

        # Simple containment check
        if text1 in text2:
            return len(text1) / len(text2)
        if text2 in text1:
            return len(text2) / len(text1)

        # Enhanced similarity calculation for entity matching
        # Check character-level similarity (for singular/plural differences)
        if len(text1) > 0 and len(text2) > 0:
            # Calculate edit distance similarity
            longer = max(len(text1), len(text2))
            edit_sim = 1.0 - (self._edit_distance(text1, text2) / longer)

            # Boost similarity for words that share common stems
            if self._share_common_stem(text1, text2):
                edit_sim = min(1.0, edit_sim * 1.3)  # Boost similar stems

            if edit_sim > 0.7:  # Threshold for considering similar
                return edit_sim

        # Word overlap (fallback)
        words1 = set(text1.split())
        words2 = set(text2.split())
        if not words1 or not words2:
            return 0.0

        intersection = words1.intersection(words2)
        union = words1.union(words2)

        return len(intersection) / len(union)

    def _edit_distance(self, s1: str, s2: str) -> int:
        """Calculate Levenshtein edit distance between two strings."""
        if len(s1) < len(s2):
            return self._edit_distance(s2, s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def _share_common_stem(self, word1: str, word2: str) -> bool:
        """Check if two words share a common stem."""
        if not word1 or not word2:
            return False

        # Simple stem check: words share first 4+ characters
        min_len = min(len(word1), len(word2))
        if min_len >= 4:
            # Check if they share the first 4 characters
            return word1[:4].lower() == word2[:4].lower()

        # For shorter words, check if they share all but last character
        if min_len >= 3:
            return word1[:-1].lower() == word2[:-1].lower()

        return False

    def _extract_relationships(self, text: str, entities: List[EntityMatch]) -> List[Tuple[str, str, str]]:
        """Extract relationships between entities from text."""
        relationships = []

        if len(entities) < 2:
            return relationships

        # Get relationship patterns from config
        rel_patterns = self.config['entity_processing'].get('relationship_patterns', {})

        # Default relationship patterns
        default_patterns = {
            'is_located_in': r'{}[^.!?]*in[^.!?]*{}',
            'belongs_to': r'{}[^.!?]*of[^.!?]*{}',
            'follows': r'{}[^.!?]*worship[^.!?]*{}',
            'member_of': r'{}[^.!?]*member[^.!?]*of[^.!?]*{}',
            'allied_with': r'{}[^.!?]*allied[^.!?]*with[^.!?]*{}',
            'enemy_of': r'{}[^.!?]*enemy[^.!?]*of[^.!?]*{}',
            'controls': r'{}[^.!?]*controls?[^.!?]*{}',
            'created_by': r'{}[^.!?]*created[^.!?]*by[^.!?]*{}',
            'defeated_by': r'{}[^.!?]*defeated[^.!?]*by[^.!?]*{}',
            'leads': r'{}[^.!?]*leads?[^.!?]*{}',
            'serves': r'{}[^.!?]*serves?[^.!?]*{}'
        }

        patterns = {**default_patterns, **rel_patterns}

        for i, entity1 in enumerate(entities):
            for entity2 in entities[i+1:]:

                # Format pattern with entity names
                for rel_type, pattern in patterns.items():
                    formatted_pattern = pattern.format(
                        re.escape(entity1.entity_name),
                        re.escape(entity2.entity_name)
                    )

                    if re.search(formatted_pattern, text, re.IGNORECASE):
                        relationships.append((entity1.entity_id, entity2.entity_id, rel_type))
                        break  # Only one relationship type per pair

        return relationships

    def link_entities_in_text(self, text: str, chunk_id: str) -> EntityLinkingResult:
        """Link entities in text and extract relationships with improved error handling."""
        import time
        start_time = time.time()

        try:
            # Validate input parameters
            if not isinstance(text, str) or not text.strip():
                print(f"Warning: Invalid or empty text for chunk {chunk_id}")
                return EntityLinkingResult(
                    chunk_id=chunk_id,
                    entities_found=[],
                    relationships_found=[],
                    coverage_score=0.0,
                    linking_time=0.0
                )

            if not chunk_id or not isinstance(chunk_id, str):
                print(f"Warning: Invalid chunk_id: {chunk_id}")
                chunk_id = "unknown"

            # Extract candidate entities with error handling
            candidates = []
            try:
                candidates = self._extract_candidate_entities(text)
            except Exception as e:
                print(f"Warning: Error extracting candidates from chunk {chunk_id}: {e}")
                candidates = []

            # Find entity matches with error handling
            entity_matches = []
            try:
                entity_matches = self._find_entity_matches(text, candidates)
            except Exception as e:
                print(f"Warning: Error finding entity matches for chunk {chunk_id}: {e}")
                entity_matches = []

            # Extract relationships between found entities with error handling
            relationships = []
            try:
                relationships = self._extract_relationships(text, entity_matches)
            except Exception as e:
                print(f"Warning: Error extracting relationships for chunk {chunk_id}: {e}")
                relationships = []

            # Calculate coverage score with safety checks
            try:
                unique_entities = len(set(match.entity_id for match in entity_matches))
                coverage_score = min(1.0, unique_entities / max(1, len(candidates)))
            except Exception as e:
                print(f"Warning: Error calculating coverage score for chunk {chunk_id}: {e}")
                coverage_score = 0.0

            linking_time = time.time() - start_time

            return EntityLinkingResult(
                chunk_id=chunk_id,
                entities_found=entity_matches,
                relationships_found=relationships,
                coverage_score=coverage_score,
                linking_time=linking_time
            )

        except Exception as e:
            print(f"❌ Critical error in entity linking for chunk {chunk_id}: {e}")
            # Return safe fallback result
            linking_time = time.time() - start_time
            return EntityLinkingResult(
                chunk_id=chunk_id,
                entities_found=[],
                relationships_found=[],
                coverage_score=0.0,
                linking_time=linking_time
            )

    def get_entity_statistics(self) -> Dict:
        """Get statistics about the entity linking system."""
        return {
            'total_entities': len(self.entities),
            'entity_types': dict(self.type_index),
            'total_aliases': len(self.alias_index),
            'entities_by_type': {type_: len(ids) for type_, ids in self.type_index.items()}
        }

    def export_entity_data(self, output_path: str = "store/entities_export.json"):
        """Export entity data for debugging and analysis."""
        def make_json_serializable(obj):
            """Convert dataclasses objects to JSON-serializable dictionaries."""
            if isinstance(obj, dict):
                return {k: make_json_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [make_json_serializable(item) for item in obj]
            elif hasattr(obj, '__dataclass_fields__'):
                # Convert dataclass to dict and handle sets
                result = {}
                for field_name, field_value in obj.__dict__.items():
                    if isinstance(field_value, set):
                        result[field_name] = list(field_value)
                    elif isinstance(field_value, dict):
                        result[field_name] = make_json_serializable(field_value)
                    else:
                        result[field_name] = field_value
                return result
            else:
                return obj

        export_data = {
            'entities': {id_: make_json_serializable(entity) for id_, entity in self.entities.items()},
            'alias_index': self.alias_index,
            'statistics': {
                'total_entities': len(self.entities),
                'entity_types': {k: list(v) for k, v in self.type_index.items()},
                'total_aliases': len(self.alias_index),
                'entities_by_type': {type_: list(ids) for type_, ids in self.type_index.items()}
            }
        }

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        print(f"Entity data exported to {output_path}")


def main():
    """Main entry point for testing the entity linker."""
    try:
        linker = EntityLinker()

        print("✅ Entity linker initialized successfully")
        print(f"📊 Loaded {len(linker.entities)} entities")
        print(f"🔤 Built alias index with {len(linker.alias_index)} entries")

        # Show statistics
        stats = linker.get_entity_statistics()
        print(f"📈 Entity types: {stats['entities_by_type']}")

        # Test with sample text
        test_text = """
        The creatures of [Camelot](geography.md) tell the story of a world in ecological collapse.
        Where once thrived natural beasts in harmony with [life energy](magic_supernatural.md#the-life-energy-system),
        now survive twisted things—mutants shaped by magical contamination.
        """

        print("\n🧪 Testing entity extraction...")
        result = linker.link_entities_in_text(test_text, "test_chunk_001")

        print(f"✅ Found {len(result.entities_found)} entities")
        for entity in result.entities_found:
            print(f"  • {entity.entity_name} ({entity.entity_type}) - '{entity.match_text}'")

        print(f"📊 Coverage score: {result.coverage_score:.2f}")
        print(f"⏱️  Processing time: {result.linking_time:.3f}s")

        # Export for debugging
        linker.export_entity_data()

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()