"""
ScoringEngine - Focused component for candidate scoring and ranking.

Handles multi-dimensional scoring, entity matching, and result ranking.
Implements the retrieval contract §6 weighted scoring system.
Separated from monolithic RetrievalService for better maintainability.
"""

from typing import List, Dict, Any, Optional
import re
from .retriever import EntityReference, normalize_entities, entities_to_strings


class ScoringEngine:
    """
    Handles candidate scoring and ranking according to retrieval contract.

    Responsibilities:
    - Query entity extraction and normalization
    - Multi-dimensional scoring (semantic, entity, type, canon, graph)
    - Graph proximity and path evidence computation
    - Result ranking and filtering
    - Contract-compliant weighted scoring (§6.2)
    """

    def __init__(self, config: Dict[str, Any]):
        """Initialize scoring engine with configuration."""
        self.config = config
        self.graph_store = None
        self.alias_map: Dict[str, List[str]] = {}
        self.entity_graph: Dict[str, Dict[str, str]] = {}

    def initialize(self, graph_store=None, alias_map: Optional[Dict] = None,
                   entity_graph: Optional[Dict] = None) -> None:
        """Initialize scoring engine with supporting data."""
        self.graph_store = graph_store
        self.alias_map = alias_map or {}
        self.entity_graph = entity_graph or {}

    def score_candidates(self, query: str, candidates: List[Dict]) -> List[Dict]:
        """Apply retrieval contract §6 weighted scoring to candidates."""
        # Step 1: Query normalization and entity extraction per contract §12.1
        normalized_query = self._normalize_query(query)
        query_entities = self._extract_query_entities(query)

        # Step 2: Query intent classification per contract §12.2
        query_category = self._classify_query_intent(query)

        scored_candidates = []

        for candidate in candidates:
            # Extract features according to retrieval contract §6.1
            semantic_score = self._normalize_similarity(candidate.get('similarity', 0.0))
            entity_score = self._compute_entity_overlap(query_entities, candidate.get('entities', []))
            type_score = self._compute_type_match_enhanced(query_category, candidate)
            canon_score = self._compute_canon_score(candidate)
            graph_score = self._compute_graph_proximity(query_entities, candidate.get('entities', []))

            # Apply exact weights from retrieval contract §6.2
            # Base weights: semantic=0.60, entity=0.25, type=0.10, canon=0.05
            w_semantic = 0.60
            w_entity = 0.25
            w_type = 0.10
            w_canon = 0.05

            # Graph boost (0.05-0.10 when applicable) per contract §6.2
            w_graph = 0.08 if graph_score > 0 else 0.05

            # Compute final score per contract formula §6.2
            final_score = (
                w_semantic * semantic_score +
                w_entity * entity_score +
                w_type * type_score +
                w_canon * canon_score +
                w_graph * graph_score
            )

            # Store detailed scoring information for diagnostics
            candidate['final_score'] = final_score
            candidate['query_category'] = query_category
            candidate['features'] = {
                'semantic': semantic_score,
                'entity': entity_score,
                'type': type_score,
                'canon': canon_score,
                'graph': graph_score,
                'weights': {
                    'semantic': w_semantic,
                    'entity': w_entity,
                    'type': w_type,
                    'canon': w_canon,
                    'graph': w_graph
                }
            }

            # Add path evidence to candidates with graph proximity
            if graph_score > 0 and self.graph_store:
                candidate_entity_ids = []
                for entity in candidate.get('entities', []):
                    if isinstance(entity, dict):
                        candidate_entity_ids.append(entity.get('entity_id', ''))
                    else:
                        candidate_entity_ids.append(str(entity))

                path_evidence = self._compute_graph_path_evidence(query_entities, candidate_entity_ids)
                if path_evidence:
                    candidate['graph_path_evidence'] = path_evidence

            scored_candidates.append(candidate)

        # Sort by final score (descending) - contract §6.3 requires reranking
        scored_candidates.sort(key=lambda x: x['final_score'], reverse=True)

        return scored_candidates

    def _normalize_query(self, query: str) -> str:
        """Normalize query text."""
        # Basic normalization
        normalized = query.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)  # Collapse whitespace
        return normalized

    def _extract_query_entities(self, query: str) -> List[str]:
        """Extract entity IDs mentioned in query using GraphStore (enhanced) or fallback method."""
        # Try graph-based entity extraction first (more accurate)
        if self.graph_store:
            try:
                entities = self.graph_store.extract_entities_from_query(query)
                print(f"🧠 Graph-based entity extraction: {entities}")
                return entities
            except Exception as e:
                print(f"⚠️  Graph entity extraction failed: {e}, falling back to alias map")

        # Fallback to original alias map method
        entities = []
        query_lower = query.lower()

        if not self.alias_map:
            return entities

        # Enhanced entity extraction using alias map
        for entity_id, aliases in self.alias_map.items():
            if isinstance(aliases, list):
                for alias in aliases:
                    if alias.lower() in query_lower:
                        if entity_id not in entities:
                            entities.append(entity_id)

        # Also check for direct entity name matches (case-insensitive)
        for entity_id in self.alias_map.keys():
            if entity_id.lower() in query_lower:
                if entity_id not in entities:
                    entities.append(entity_id)

        return entities

    def _compute_entity_overlap(self, query_entities: List[str], chunk_entities: List) -> float:
        """Compute entity overlap score between query and chunk per contract §6.1 S_entity."""
        if not query_entities or not chunk_entities:
            return 0.0

        # Normalize chunk entities to EntityReference objects and extract IDs
        normalized_entities = normalize_entities(chunk_entities)
        chunk_entity_ids = {entity.entity_id for entity in normalized_entities}

        # Calculate overlap with query entities
        if not chunk_entity_ids:
            return 0.0

        overlap = len(set(query_entities) & chunk_entity_ids)
        return min(1.0, overlap / len(query_entities))

    def _compute_graph_proximity(self, query_entities: List[str], chunk_entities: List) -> float:
        """Compute graph proximity boost using GraphStore or fallback to entity_graph."""
        if not query_entities or not chunk_entities:
            return 0.0

        # Normalize chunk entities and extract IDs
        normalized_entities = normalize_entities(chunk_entities)
        chunk_entity_ids = [entity.entity_id for entity in normalized_entities]

        # Use GraphStore for enhanced graph proximity calculation
        if self.graph_store:
            try:
                # Check for direct connections and path-based proximity
                proximity_score = 0.0

                for query_entity in query_entities:
                    for chunk_entity in chunk_entity_ids:
                        # Direct entity match gets highest score
                        if query_entity == chunk_entity:
                            proximity_score = max(proximity_score, 1.0)
                            continue

                        # Find shortest path between entities
                        path = self.graph_store.find_shortest_path(query_entity, chunk_entity)
                        if path:
                            # Score based on path length (shorter = higher score)
                            path_length = len(path)
                            if path_length == 2:  # Direct neighbors
                                proximity_score = max(proximity_score, 0.8)
                            elif path_length == 3:  # 2-hop
                                proximity_score = max(proximity_score, 0.6)
                            elif path_length <= 4:  # 3-hop
                                proximity_score = max(proximity_score, 0.4)

                return proximity_score

            except Exception as e:
                print(f"⚠️  GraphStore proximity calculation failed: {e}")

        # Fallback to original entity_graph method
        if not self.entity_graph:
            return 0.0

        # Check for one-hop proximity: if any query entity has a neighbor in chunk entities
        for query_entity in query_entities:
            if query_entity in self.entity_graph:
                neighbors = self.entity_graph[query_entity]
                for chunk_entity in chunk_entity_ids:
                    if chunk_entity in neighbors:
                        return 1.0  # One-hop neighbor found

        return 0.0

    def _normalize_similarity(self, similarity: float) -> float:
        """Normalize similarity score to [0,1] range per contract §6.1 S_semantic."""
        # Assuming similarity is already in [0,1] range from FAISS Inner Product
        # If similarity can be negative, clamp to [0,1]
        return max(0.0, min(1.0, similarity))

    def _classify_query_intent(self, query: str) -> str:
        """Classify query intent per contract §12.2 for enhanced type matching."""
        query_lower = query.lower()

        # Query category heuristics (from contract §12.2)
        # Order matters - more specific patterns first
        if any(word in query_lower for word in ['who', 'character', 'person', 'warrior', 'mage', 'priest', 'merchant', 'noble']):
            return 'characters'
        elif any(word in query_lower for word in ['where', 'location', 'city', 'town', 'village', 'region', 'geography', 'place']):
            return 'locations'
        elif any(word in query_lower for word in ['faction', 'organization', 'guild', 'house', 'order', 'clan', 'group']):
            return 'factions'
        elif any(word in query_lower for word in ['religion', 'god', 'belief', 'faith', 'temple', 'church', 'cult', 'philosophy']):
            return 'religion'
        elif any(word in query_lower for word in ['quest', 'mission', 'adventure', 'contract', 'task', 'journey']):
            return 'quests'
        elif any(word in query_lower for word in ['culture', 'customs', 'tradition', 'ritual', 'ceremony', 'clan']):
            return 'cultures'
        elif any(word in query_lower for word in ['secret', 'knows', 'hidden', 'mysterious', 'conspiracy', 'plot']):
            return 'secrets'
        elif any(word in query_lower for word in ['creature', 'monster', 'beast', 'animal', 'species']):
            return 'creatures'
        elif any(word in query_lower for word in ['magic', 'spell', 'artifact', 'item', 'weapon', 'armor']):
            return 'magic'
        elif any(word in query_lower for word in ['history', 'event', 'war', 'battle', 'timeline']):
            return 'events'
        elif any(word in query_lower for word in ['rule', 'mechanic', 'system', 'how', 'work', 'function']):
            return 'rules'
        else:
            return 'general'

    def _compute_type_match_enhanced(self, query_category: str, candidate: Dict) -> float:
        """Enhanced type match score per contract §6.1 S_type with query classification."""
        candidate_domain = candidate.get('domain', '')
        candidate_type = candidate.get('type', '')

        # Enhanced matching logic per contract specifications
        # Exact match gets 1.0
        if query_category == candidate_domain or query_category == candidate_type:
            return 1.0

        # Related categories get 0.5 (expanded from contract guidance)
        related_matches = {
            'characters': ['factions', 'religion', 'cultures', 'locations'],
            'locations': ['geography', 'cultures', 'events'],
            'factions': ['characters', 'religion', 'politics'],
            'religion': ['characters', 'factions', 'cultures', 'philosophy'],
            'quests': ['characters', 'locations', 'factions'],
            'cultures': ['characters', 'locations', 'religion'],
            'secrets': ['characters', 'factions', 'religion'],
            'creatures': ['locations', 'magic'],
            'magic': ['characters', 'creatures'],
            'events': ['characters', 'locations', 'factions'],
            'rules': ['magic', 'characters']
        }

        if query_category in related_matches:
            related_categories = related_matches[query_category]
            if candidate_domain in related_categories or candidate_type in related_categories:
                return 0.5

        return 0.0

    def _compute_canon_score(self, candidate: Dict) -> float:
        """Compute canon level score per contract §6.1 S_canon."""
        # Contract requires canon_level = "primary" for v1
        return 1.0 if candidate.get('canon_level') == 'primary' else 0.0

    def _compute_graph_path_evidence(self, query_entities: List[str], candidate_entities: List[str]) -> Optional[Dict[str, Any]]:
        """Compute path evidence between query entities and candidate entities."""
        if not self.graph_store or not query_entities or not candidate_entities:
            return None

        try:
            # Find meaningful paths between query and candidate entities
            all_entities = query_entities + candidate_entities
            paths = self.graph_store.find_paths_between_entities(all_entities, max_paths=3)

            if not paths:
                return None

            # Convert paths to serializable format
            path_evidence = {
                'paths_found': len(paths),
                'paths': [
                    {
                        'nodes': path.nodes,
                        'relationships': path.relationships,
                        'length': len(path),
                        'description': str(path)
                    }
                    for path in paths[:3]  # Limit to top 3 paths
                ]
            }

            return path_evidence

        except Exception as e:
            print(f"⚠️  Path evidence computation failed: {e}")
            return None