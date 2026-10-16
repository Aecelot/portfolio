#!/usr/bin/env python3
"""
GraphFast Service

Main service implementing the GraphFast runtime system.
Provides high-performance graph-based evidence retrieval for LLM integration.
"""

import json
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import re

# Import our components
from .loaders import MMapCSRLoader, PathCatalogLoader, PayloadLoader
from ..graph.graph_store import GraphStore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PathEvidence:
    """Evidence from a graph path."""
    path_id: str
    nodes: List[int]
    node_names: List[str]
    edge_types: List[int]
    abstract: str
    confidence: float = 1.0


@dataclass
class FactEvidence:
    """Evidence from a factual statement."""
    node_id: int
    node_name: str
    fact_text: str
    relevance_score: float = 1.0


@dataclass
class RuleEvidence:
    """Evidence from a world rule or law."""
    node_id: int
    node_name: str
    rule_text: str
    rule_type: str
    applicability: float = 1.0


@dataclass
class QuoteEvidence:
    """Evidence from character quotes or dialogue."""
    node_id: int
    node_name: str
    quote_text: str
    context: str
    speaker_type: str


@dataclass
class GraphEvidence:
    """Complete evidence package for LLM."""
    paths: List[PathEvidence]
    facts: List[FactEvidence]
    rules: List[RuleEvidence]
    quotes: List[QuoteEvidence]
    source_shard: str = "global"
    timings_ms: Dict[str, float] = None
    method_used: str = "none"
    total_confidence: float = 0.0

    def __post_init__(self):
        if self.timings_ms is None:
            self.timings_ms = {}


class EvidenceFormatter:
    """Formats graph evidence for prompt injection."""

    def __init__(self):
        # Templates for different evidence types
        self.path_template = "Path: {nodes} (confidence: {confidence:.2f})"
        self.fact_template = "Fact: {fact} (relevance: {relevance:.2f})"
        self.rule_template = "Rule: {rule} (applies to: {applies})"
        self.quote_template = "Quote from {speaker}: '{quote}'"

    def format_evidence_slots(self, evidence: GraphEvidence) -> Dict[str, List[str]]:
        """Format evidence into prompt slots."""
        slots = {
            "paths": [],
            "facts": [],
            "rules": [],
            "quotes": []
        }

        # Format paths
        for path in evidence.paths:
            formatted = self.path_template.format(
                nodes=" → ".join(path.node_names),
                confidence=path.confidence
            )
            slots["paths"].append(formatted)

        # Format facts
        for fact in evidence.facts:
            formatted = self.fact_template.format(
                fact=fact.fact_text,
                relevance=fact.relevance_score
            )
            slots["facts"].append(formatted)

        # Format rules
        for rule in evidence.rules:
            formatted = self.rule_template.format(
                rule=rule.rule_text,
                applies=rule.rule_type
            )
            slots["rules"].append(formatted)

        # Format quotes
        for quote in evidence.quotes:
            formatted = self.quote_template.format(
                speaker=quote.node_name,
                quote=quote.quote_text
            )
            slots["quotes"].append(formatted)

        return slots

    def build_evidence_prompt_section(self, evidence: GraphEvidence) -> str:
        """Build complete evidence section for prompt."""
        if not any([evidence.paths, evidence.facts, evidence.rules, evidence.quotes]):
            return ""

        sections = ["# Graph Evidence", ""]

        # Add paths section
        if evidence.paths:
            sections.append("## Connection Paths")
            for path in evidence.paths[:2]:  # Limit to top 2 paths
                sections.append(f"- {path.abstract}")
            sections.append("")

        # Add facts section
        if evidence.facts:
            sections.append("## Relevant Facts")
            for fact in evidence.facts[:3]:  # Limit to top 3 facts
                sections.append(f"- {fact.fact_text}")
            sections.append("")

        # Add rules section
        if evidence.rules:
            sections.append("## World Rules")
            for rule in evidence.rules[:2]:  # Limit to top 2 rules
                sections.append(f"- {rule.rule_text}")
            sections.append("")

        # Add quotes section
        if evidence.quotes:
            sections.append("## Character Quotes")
            for quote in evidence.quotes[:2]:  # Limit to top 2 quotes
                sections.append(f"- {quote.quote_text}")
            sections.append("")

        return "\n".join(sections)


class GraphFastService:
    """Main GraphFast service implementing high-performance graph retrieval."""

    def __init__(self):
        self.initialized = False
        self.artifacts_path: Optional[str] = None

        # Core components
        self.csr_loader = MMapCSRLoader()
        self.catalog_loader = PathCatalogLoader()
        self.payload_loader = PayloadLoader()

        # Entity mapping for lookups
        self.entity_to_node: Dict[str, int] = {}
        self.node_to_entity: Dict[int, str] = {}

        # Performance tracking
        self.cache_hits = 0
        self.total_queries = 0

        # Evidence formatter
        self.formatter = EvidenceFormatter()

    def initialize(self, artifacts_root: str) -> bool:
        """Initialize GraphFast service with artifacts."""
        start_time = time.time()
        logger.info(f"Initializing GraphFast from {artifacts_root}")

        try:
            self.artifacts_path = artifacts_root
            artifacts_path = Path(artifacts_root)

            if not artifacts_path.exists():
                logger.error(f"Artifacts directory not found: {artifacts_root}")
                return False

            # Load CSR graph structure
            graph = self.csr_loader.load_graph(artifacts_root)
            if not graph:
                logger.error("Failed to load CSR graph")
                return False

            # Load path catalog
            catalog_file = artifacts_path / "paths" / "catalog.jsonl"
            if not self.catalog_loader.load_catalog(str(catalog_file)):
                logger.warning("Failed to load path catalog - will operate without pre-computed paths")

            # Load payloads
            payloads_file = artifacts_path / "payloads.bin"
            if not self.payload_loader.load_payloads(str(payloads_file)):
                logger.warning("Failed to load payloads - using simplified payloads")

            # Build entity mappings
            self._build_entity_mappings()

            # Load build report for metadata
            report_file = artifacts_path / "build_report.json"
            if report_file.exists():
                with open(report_file, 'r') as f:
                    self.build_info = json.load(f)

            self.initialized = True

            init_time = time.time() - start_time
            logger.info(f"✅ GraphFast initialized in {init_time:.3f}s")
            logger.info(f"📊 Loaded {graph.num_nodes} nodes, {graph.num_edges} edges")

            return True

        except Exception as e:
            logger.error(f"Error initializing GraphFast: {e}")
            return False

    def _build_entity_mappings(self) -> None:
        """Build mappings between entity IDs and node IDs."""
        if not self.csr_loader.graph:
            return

        # For each node, extract entity information
        for node_id in range(self.csr_loader.graph.num_nodes):
            try:
                node_type, flags, payload_offset = self.csr_loader.get_node_info(node_id)
                payload = self.csr_loader.get_payload(node_id)

                # Extract entity ID from payload (simplified approach)
                # In full implementation, would parse proper entity format
                entity_id = f"entity_{node_id}"
                self.entity_to_node[entity_id] = node_id
                self.node_to_entity[node_id] = entity_id

            except Exception as e:
                logger.warning(f"Error building mapping for node {node_id}: {e}")

    def retrieve(self, query: str, character_context: str = "") -> GraphEvidence:
        """Retrieve graph evidence for query."""
        if not self.initialized:
            raise RuntimeError("GraphFast not initialized")

        start_time = time.time()
        self.total_queries += 1

        try:
            # Parse query for entities
            query_entities = self._extract_entities_from_query(query)

            # Find relevant nodes
            relevant_nodes = self._find_relevant_nodes(query_entities, character_context)

            evidence = GraphEvidence(
                paths=[],
                facts=[],
                rules=[],
                quotes=[],
                timings_ms={},
                method_used="none"
            )

            if not relevant_nodes:
                logger.debug("No relevant nodes found for query")
                return evidence

            # Try different retrieval methods in order of preference (design section 5)

            # 1. Path Catalog lookup (fastest)
            catalog_time = time.time()
            paths = self._lookup_path_catalog(relevant_nodes)
            catalog_duration = time.time() - catalog_time

            if paths:
                evidence.paths = paths
                evidence.method_used = "catalog"
                evidence.timings_ms["catalog"] = catalog_duration
            else:
                # 2. Two-hop neighborhood (fallback)
                twohop_time = time.time()
                neighborhood_paths = self._find_two_hop_paths(relevant_nodes)
                twohop_duration = time.time() - twohop_time

                if neighborhood_paths:
                    evidence.paths = neighborhood_paths
                    evidence.method_used = "twohop"
                    evidence.timings_ms["twohop"] = twohop_duration

            # 3. Extract facts from relevant nodes
            facts_time = time.time()
            facts = self._extract_facts(relevant_nodes, query)
            facts_duration = time.time() - facts_time

            evidence.facts = facts
            evidence.timings_ms["facts"] = facts_duration

            # 4. Extract rules and quotes (simplified for now)
            rules_time = time.time()
            rules = self._extract_rules(relevant_nodes, query)
            rules_duration = time.time() - rules_time

            evidence.rules = rules
            evidence.timings_ms["rules"] = rules_duration

            # Calculate total confidence
            evidence.total_confidence = self._calculate_total_confidence(evidence)

            # Record total timing
            total_time = time.time() - start_time
            evidence.timings_ms["total"] = total_time

            logger.debug(f"Retrieved evidence via {evidence.method_used} in {total_time:.3f}s")
            return evidence

        except Exception as e:
            logger.error(f"Error in graph retrieval: {e}")
            total_time = time.time() - start_time
            return GraphEvidence(
                paths=[],
                facts=[],
                rules=[],
                quotes=[],
                timings_ms={"total": total_time, "error": 1.0},
                method_used="error"
            )

    def _extract_entities_from_query(self, query: str) -> List[str]:
        """Extract entity mentions from query text."""
        # Use simple pattern matching for entity extraction
        # In full implementation, would use NLP or existing entity linker

        entities = []

        # Look for capitalized words (potential entity names)
        words = re.findall(r'\b[A-Z][a-z]+\b', query)

        # Map common words to known entities
        entity_patterns = {
            'Ector': 'character_sir_ector',
            'Ector': 'character_sir_ector',
            'House': 'organization_house_pendragon',
            'Pendragon': 'organization_house_pendragon',
            'Camelot': 'location_camelot'
        }

        for word in words:
            if word in entity_patterns:
                entities.append(entity_patterns[word])

        # Remove duplicates while preserving order
        seen = set()
        unique_entities = []
        for entity in entities:
            if entity not in seen:
                seen.add(entity)
                unique_entities.append(entity)

        return unique_entities

    def _find_relevant_nodes(self, query_entities: List[str], character_context: str) -> List[int]:
        """Find relevant nodes for query."""
        relevant_nodes = []

        # Map query entities to node IDs
        for entity in query_entities:
            if entity in self.entity_to_node:
                relevant_nodes.append(self.entity_to_node[entity])

        # Also include character context if provided
        if character_context and character_context in self.entity_to_node:
            context_node = self.entity_to_node[character_context]
            if context_node not in relevant_nodes:
                relevant_nodes.append(context_node)

        return relevant_nodes

    def _lookup_path_catalog(self, nodes: List[int]) -> List[PathEvidence]:
        """Lookup pre-computed paths in catalog."""
        paths = []

        # Try to find paths between pairs of nodes
        for i, source in enumerate(nodes):
            for target in nodes[i+1:]:
                catalog_entry = self.catalog_loader.find_path(source, target)
                if catalog_entry:
                    # Convert catalog entry to PathEvidence
                    path = PathEvidence(
                        path_id=catalog_entry.get('path_id', f'path_{source}_{target}'),
                        nodes=catalog_entry.get('nodes', [source, target]),
                        node_names=self._get_node_names(catalog_entry.get('nodes', [source, target])),
                        edge_types=catalog_entry.get('etypes', []),
                        abstract=catalog_entry.get('abstract', ''),
                        confidence=0.9  # High confidence for catalog paths
                    )
                    paths.append(path)

        return paths

    def _find_two_hop_paths(self, nodes: List[int]) -> List[PathEvidence]:
        """Find two-hop paths between nodes."""
        paths = []

        for source in nodes:
            try:
                neighbors, _ = self.csr_loader.get_neighbors(source)

                for target in nodes:
                    if source == target:
                        continue

                    # Check if target is a direct neighbor
                    if target in neighbors:
                        path = PathEvidence(
                            path_id=f"direct_{source}_{target}",
                            nodes=[source, target],
                            node_names=self._get_node_names([source, target]),
                            edge_types=[1],
                            abstract=f"Direct connection: {self._get_node_names([source, target])}",
                            confidence=0.8
                        )
                        paths.append(path)

                    # Check for two-hop paths through other nodes
                    for neighbor in neighbors:
                        if neighbor == target or neighbor == source:
                            continue

                        try:
                            neighbor_neighbors, _ = self.csr_loader.get_neighbors(neighbor)
                            if target in neighbor_neighbors:
                                path = PathEvidence(
                                    path_id=f"twohop_{source}_{neighbor}_{target}",
                                    nodes=[source, neighbor, target],
                                    node_names=self._get_node_names([source, neighbor, target]),
                                    edge_types=[1, 1],
                                    abstract=f"Two-hop path: {self._get_node_names([source, target])} via {self._get_node_names([neighbor])}",
                                    confidence=0.6
                                )
                                paths.append(path)
                        except:
                            continue

            except Exception as e:
                logger.warning(f"Error finding paths from node {source}: {e}")

        return paths

    def _extract_facts(self, nodes: List[int], query: str) -> List[FactEvidence]:
        """Extract factual evidence from nodes."""
        facts = []

        for node_id in nodes:
            try:
                # Get node information
                payload = self.csr_loader.get_payload(node_id)
                node_name = self._get_node_name(node_id)

                # Generate fact based on node type and query relevance
                relevance = self._calculate_fact_relevance(payload, query)

                if relevance > 0.1:  # Only include somewhat relevant facts
                    fact = FactEvidence(
                        node_id=node_id,
                        node_name=node_name,
                        fact_text=payload,
                        relevance_score=relevance
                    )
                    facts.append(fact)

            except Exception as e:
                logger.warning(f"Error extracting fact from node {node_id}: {e}")

        # Sort by relevance and return top facts
        facts.sort(key=lambda x: x.relevance_score, reverse=True)
        return facts[:4]  # Limit to top 4 facts

    def _extract_rules(self, nodes: List[int], query: str) -> List[RuleEvidence]:
        """Extract rule evidence from nodes (simplified)."""
        rules = []

        # For now, generate simple rules based on entity types
        for node_id in nodes:
            try:
                node_type, _, _ = self.csr_loader.get_node_info(node_id)
                node_name = self._get_node_name(node_id)

                # Generate rule based on node type
                if "character" in node_name:
                    rule = RuleEvidence(
                        node_id=node_id,
                        node_name=node_name,
                        rule_text=f"{node_name} follows the code of their people",
                        rule_type="character_code",
                        applicability=0.7
                    )
                    rules.append(rule)

            except Exception as e:
                logger.warning(f"Error extracting rule from node {node_id}: {e}")

        return rules[:2]  # Limit to top 2 rules

    def _get_node_names(self, node_ids: List[int]) -> List[str]:
        """Get names for multiple nodes."""
        return [self._get_node_name(node_id) for node_id in node_ids]

    def _get_node_name(self, node_id: int) -> str:
        """Get name for a node."""
        if node_id in self.node_to_entity:
            return self.node_to_entity[node_id]
        return f"Node_{node_id}"

    def _calculate_fact_relevance(self, fact_text: str, query: str) -> float:
        """Calculate relevance of fact to query (simplified)."""
        if not fact_text or not query:
            return 0.0

        # Simple word overlap relevance
        fact_words = set(fact_text.lower().split())
        query_words = set(query.lower().split())

        if not query_words:
            return 0.0

        overlap = len(fact_words & query_words)
        return min(1.0, overlap / len(query_words))

    def _calculate_total_confidence(self, evidence: GraphEvidence) -> float:
        """Calculate overall confidence of evidence."""
        if not any([evidence.paths, evidence.facts, evidence.rules, evidence.quotes]):
            return 0.0

        # Weighted confidence based on evidence types and their individual confidences
        total_weight = 0.0
        weighted_sum = 0.0

        # Paths (highest weight)
        if evidence.paths:
            path_confidences = [p.confidence for p in evidence.paths]
            avg_path_conf = sum(path_confidences) / len(path_confidences)
            weighted_sum += avg_path_conf * 0.4
            total_weight += 0.4

        # Facts
        if evidence.facts:
            fact_confidences = [f.relevance_score for f in evidence.facts]
            avg_fact_conf = sum(fact_confidences) / len(fact_confidences)
            weighted_sum += avg_fact_conf * 0.3
            total_weight += 0.3

        # Rules and quotes (lower weight)
        for rules in [evidence.rules, evidence.quotes]:
            if rules:
                confidences = [0.5 for _ in rules]  # Default confidence
                avg_conf = sum(confidences) / len(confidences)
                weighted_sum += avg_conf * 0.15
                total_weight += 0.15

        return weighted_sum / total_weight if total_weight > 0 else 0.0

    def get_service_info(self) -> Dict[str, Any]:
        """Get service information and statistics."""
        if not self.csr_loader.graph:
            return {"status": "not_initialized"}

        return {
            "status": "initialized" if self.initialized else "not_initialized",
            "artifacts_path": self.artifacts_path,
            "graph_nodes": self.csr_loader.graph.num_nodes,
            "graph_edges": self.csr_loader.graph.num_edges,
            "path_catalog_entries": len(self.catalog_loader.catalog),
            "cache_stats": {
                "total_queries": self.total_queries,
                "hit_rate": self.cache_hits / max(1, self.total_queries)
            },
            "memory_usage_mb": sum(
                mmap_file.size for mmap_file in self.csr_loader.mmap_files
            ) / (1024 * 1024) if self.csr_loader.mmap_files else 0
        }

    def shutdown(self) -> None:
        """Shutdown service and cleanup resources."""
        logger.info("Shutting down GraphFast service")

        if self.csr_loader:
            self.csr_loader.close()

        if self.payload_loader:
            self.payload_loader.close()

        self.initialized = False
        logger.info("✅ GraphFast service shutdown complete")


def main():
    """Test the GraphFast service."""
    print("🧪 Testing GraphFast Service")
    print("=" * 40)

    # Initialize service
    service = GraphFastService()

    try:
        if not service.initialize("storage/graphfast_test"):
            print("❌ Failed to initialize GraphFast service")
            return 1

        # Get service info
        info = service.get_service_info()
        print("✅ Service initialized")
        print(f"📊 Service info: {info}")

        # Test queries
        test_queries = [
            "Tell me about Sir Ector",
            "What is the relationship between Sir Ector and House Pendragon",
            "Tell me about Camelot"
        ]

        for query in test_queries:
            print(f"\n🔍 Query: {query}")
            evidence = service.retrieve(query, "character_sir_ector")

            print(f"   Method: {evidence.method_used}")
            print(f"   Total time: {evidence.timings_ms.get('total', 0):.3f}s")
            print(f"   Confidence: {evidence.total_confidence:.2f}")
            print(f"   Paths: {len(evidence.paths)}")
            print(f"   Facts: {len(evidence.facts)}")
            print(f"   Rules: {len(evidence.rules)}")

            # Show sample evidence
            if evidence.facts:
                print(f"   Sample fact: {evidence.facts[0].fact_text[:50]}...")
            if evidence.paths:
                print(f"   Sample path: {evidence.paths[0].abstract}")

        print("\n✅ GraphFast service testing completed")
        return 0

    except Exception as e:
        print(f"❌ Error testing GraphFast service: {e}")
        return 1

    finally:
        service.shutdown()


if __name__ == "__main__":
    exit(main())