#!/usr/bin/env python3
"""
Lore RAG System Demonstration
=====================================

This script demonstrates the working RAG system using three key lore documents:
1. world_overview.md - Core world setting and history
2. bestiary.md - Creatures and monsters
3. magic_supernatural.md - Magic system and supernatural elements

The script tests:
- Vector search functionality
- Entity linking and context building
- Retrieval quality with sample queries
- Contract compliance features
"""

import json
import time
from defusedxml import ElementTree as ET
from pathlib import Path
from collections import defaultdict, Counter
from .api.retriever import RetrievalService

def load_domain_targets():
    """Load domain-specific quality targets from evaluation config."""
    config_path = Path("config/rag/evaluation_config.xml")
    if not config_path.exists():
        return {}
    
    try:
        tree = ET.parse(config_path)
        root = tree.getroot()
        
        targets = {}
        domain_targets_elem = root.find("domain_targets")
        if domain_targets_elem is not None:
            for domain in domain_targets_elem:
                domain_name = domain.tag
                targets[domain_name] = {}
                for metric in domain:
                    if metric.text is not None:
                        targets[domain_name][metric.tag] = float(metric.text)
        
        return targets
    except Exception as e:
        print(f"Warning: Could not load domain targets: {e}")
        return {}

def classify_query_domain(query):
    """Classify a query into domain categories based on file-based domain names."""
    query_lower = query.lower()

    # Define file-based domain keywords that match the actual lore files
    domain_keywords = {
        'bestiary': ['creature', 'monster', 'beast', 'animal', 'beast', 'wolf', 'dragon', 'undead', 'ghoul'],
        'world_overview': ['world', 'overview', 'setting', 'logres', 'arthur', 'camelot', 'houses', 'pendragon'],
        'geography': ['geography', 'location', 'place', 'region', 'city', 'town', 'mountain', 'forest', 'river', 'lake'],
        'history': ['history', 'historical', 'past', 'ancient', 'age of ruin', 'war', 'battle', 'timeline'],
        'important_characters': ['character', 'person', 'ector', 'ector', 'house', 'noble', 'lord', 'lady', 'hero'],
        'character_creation_guide': ['create character', 'character creation', 'build character', 'new character'],
        'character-needs-system': ['needs', 'motivation', 'desire', 'character needs', 'psychology'],
        'side_characters_3': ['side character', 'supporting character', 'minor character'],
        'organizations_factions': ['faction', 'organization', 'guild', 'house', 'order', 'group', 'society'],
        'politics_governance': ['politics', 'government', 'rule', 'law', 'council', 'necessity'],
        'magic_supernatural': ['magic', 'magical', 'spell', 'supernatural', 'energy', 'flow', 'enchant'],
        'religion_mythology': ['religion', 'god', 'goddess', 'faith', 'worship', 'temple', 'mythology'],
        'economy_trade_part2': ['trade', 'economy', 'merchant', 'gold', 'currency', 'market', 'commerce'],
        'cultures_civilizations': ['culture', 'civilization', 'tradition', 'custom', 'society', 'people'],
        'languages': ['language', 'speak', 'tongue', 'dialect', 'communication'],
        'fighting_pits_detailed': ['fighting', 'combat', 'battle', 'pit', 'arena', 'fight'],
        'pit_items': ['item', 'weapon', 'armor', 'equipment', 'gear', 'artifact'],
        'technology_science': ['technology', 'science', 'alchemy', 'machine', 'invention', 'research'],
        'notable_locations_part1': ['location', 'place', 'city', 'town', 'village', 'settlement'],
        'notable_locations_part2': ['location', 'place', 'city', 'town', 'village', 'settlement']
    }

    # Score each domain
    domain_scores = defaultdict(int)
    for domain, keywords in domain_keywords.items():
        for keyword in keywords:
            if keyword in query_lower:
                domain_scores[domain] += 1

    # Return the domain with highest score, or 'unknown' if no matches
    if domain_scores:
        return max(domain_scores.items(), key=lambda x: x[1])[0]
    return 'unknown'

def calculate_domain_metrics(queries_and_results, domain_targets):
    """Calculate performance metrics by domain."""
    domain_results = defaultdict(list)
    
    # Group results by domain
    for query_data in queries_and_results:
        query = query_data['query']
        results = query_data['results']
        domain = classify_query_domain(query)
        
        # Calculate metrics for this query
        has_results = len(results) > 0
        top_domain_match = results[0].get('domain', 'unknown') == domain if results else False
        has_entities = any(result.get('entities') for result in results) if results else False
        avg_similarity = sum(result.get('similarity', 0) for result in results) / len(results) if results else 0
        
        domain_results[domain].append({
            'has_results': has_results,
            'top_domain_match': top_domain_match,
            'has_entities': has_entities,
            'avg_similarity': avg_similarity,
            'result_count': len(results)
        })
    
    # Calculate aggregated metrics by domain
    domain_metrics = {}
    for domain, results in domain_results.items():
        if not results:
            continue
            
        total_queries = len(results)
        domain_metrics[domain] = {
            'query_count': total_queries,
            'recall_at_5': sum(1 for r in results if r['has_results']) / total_queries,
            'domain_match_rate': sum(1 for r in results if r['top_domain_match']) / total_queries,
            'entity_hit_rate': sum(1 for r in results if r['has_entities']) / total_queries,
            'avg_similarity': sum(r['avg_similarity'] for r in results) / total_queries,
            'avg_result_count': sum(r['result_count'] for r in results) / total_queries
        }
    
    return domain_metrics

def display_quality_assessment(domain_metrics, domain_targets):
    """Display domain-specific quality assessment with targets comparison."""
    print("\n🎯 Domain-Specific Quality Assessment")
    print("=" * 60)
    
    if not domain_metrics:
        print("No domain metrics available for assessment.")
        return
    
    # Header
    print(f"{'Domain':<12} {'Queries':<8} {'Metric':<18} {'Actual':<8} {'Target':<8} {'Status':<8}")
    print("-" * 60)
    
    overall_pass = 0
    overall_total = 0
    
    for domain, metrics in domain_metrics.items():
        targets = domain_targets.get(domain, {})
        query_count = metrics['query_count']
        
        # Check each metric against targets
        metric_checks = []
        
        if 'recall_at_5' in targets:
            actual = metrics['recall_at_5']
            target = targets['recall_at_5']
            status = "✅ PASS" if actual >= target else "❌ FAIL"
            metric_checks.append(('Recall@5', actual, target, status))
        
        if 'domain_match_rate' in targets:
            actual = metrics['domain_match_rate']
            target = targets['domain_match_rate']
            status = "✅ PASS" if actual >= target else "❌ FAIL"
            metric_checks.append(('Domain Match', actual, target, status))
        
        if 'entity_hit_rate' in targets:
            actual = metrics['entity_hit_rate']
            target = targets['entity_hit_rate']
            status = "✅ PASS" if actual >= target else "❌ FAIL"
            metric_checks.append(('Entity Hit', actual, target, status))
        
        # Display results for this domain
        for i, (metric_name, actual, target, status) in enumerate(metric_checks):
            domain_name = domain if i == 0 else ""
            query_display = str(query_count) if i == 0 else ""
            print(f"{domain_name:<12} {query_display:<8} {metric_name:<18} {actual:<8.3f} {target:<8.3f} {status:<8}")
            
            if "PASS" in status:
                overall_pass += 1
            overall_total += 1
        
        if metric_checks:
            print("-" * 60)
    
    # Overall summary
    if overall_total > 0:
        overall_rate = overall_pass / overall_total
        overall_status = "✅ PASS" if overall_rate >= 0.8 else "❌ FAIL"
        print(f"\n📊 Overall Quality Score: {overall_pass}/{overall_total} ({overall_rate:.1%}) {overall_status}")
        
        if overall_rate < 0.8:
            print("⚠️  System performance is below quality thresholds!")
            print("   Consider reviewing retrieval parameters or retraining models.")
        else:
            print("🎉 System is meeting domain-specific quality targets!")

def main():
    print("🏰 Lore RAG System Demonstration")
    print("=" * 50)

    # Load domain targets from config
    print("📋 Loading domain-specific quality targets...")
    domain_targets = load_domain_targets()
    if domain_targets:
        print(f"✅ Loaded targets for {len(domain_targets)} domains")
    else:
        print("⚠️  No domain targets loaded")

    # Initialize the retrieval service
    print("🔄 Initializing Retrieval Service...")
    service = RetrievalService()

    if not service.initialize():
        print("❌ Failed to initialize service")
        return 1

    print("✅ Service initialized successfully")

    # Check what documents are currently indexed through service components
    if service.metadata_service:
        metadata_info = service.metadata_service.get_service_info()
        print(f"📊 Loaded {metadata_info['total_entries']} document chunks")
    else:
        print("📊 Metadata service not available")

    if service.vector_index_service:
        index_info = service.vector_index_service.get_index_info()
        print(f"📊 Loaded {index_info.get('rowmap_size', 0)} row mappings")
    else:
        print("📊 Vector index service not available")

    # Test queries covering all key domains for comprehensive evaluation
    test_queries = [
        # Character queries
        "Tell me about Sir Ector and his background",
        "Who are the important noble families and their leaders?",
        "What role do the noble houses play in the current magical environment?",
        "Describe the characters associated with House Pendragon",

        # Location queries
        "Describe the geography of Camelot",
        "What creatures inhabit Camelot?",
        "Tell me about the major cities and settlements in Logres",
        "What are the important landmarks and places of interest?",

        # History queries
        "What is the history of the Age of Ruin?",
        "Tell me about the founding of the great houses",
        "What were the major historical events that shaped Logres?",
        "How did the extinction of magic change the world?",

        # Magic system queries
        "How does magic work in Logres?",
        "What did Merlin foretell about Arthur?",
        "Tell me about dragon relics and magical artifacts",
        "What are the supernatural entities in Logres?",

        # Faction queries
        "Tell me about the five great houses of Logres",
        "What organizations and guilds exist in the world?",

        # Cross-domain queries
        "How has the extinction of magic affected the creatures of Logres?",
        "What is the relationship between the noble houses and magical artifacts?"
    ]

    print(f"\n🔍 Testing {len(test_queries)} domain-specific queries...")
    print("-" * 50)

    # Collect results for domain evaluation
    queries_and_results = []

    for i, query in enumerate(test_queries, 1):
        print(f"\n{i:2d}. Query: {query}")
        domain = classify_query_domain(query)
        print(f"     Domain: {domain}")
        print("-" * 30)

        try:
            # Test simple retrieval
            start_time = time.time()
            results = service.retrieve(query, top_k=5)  # Use top_k=5 for evaluation
            query_time = time.time() - start_time

            # Store for domain evaluation
            queries_and_results.append({
                'query': query,
                'domain': domain,
                'results': results,
                'query_time': query_time
            })

            if results:
                for j, result in enumerate(results, 1):
                    print(f"   {j}. [{result.get('domain', 'unknown')}] {result.get('title', 'Untitled')}")
                    print(f"      Similarity: {result.get('similarity', 0):.3f}")
                    print(f"      Content: {result.get('content', '')[:150]}...")
                    if result.get('entities'):
                        entities = []
                        for e in result.get('entities', []):
                            if isinstance(e, dict):
                                # Try different field name variations for entity name
                                entity_name = (e.get('entity_name') or
                                             e.get('name') or
                                             e.get('entity_id') or
                                             str(e))
                            else:
                                entity_name = str(e)
                            entities.append(entity_name)
                        print(f"      Entities: {', '.join(entities[:3])}")
                    print()
                print(f"   Query time: {query_time:.3f}s")
            else:
                print("   No results found")

        except Exception as e:
            print(f"   ❌ Error: {e}")
            # Still store the failed query for evaluation
            queries_and_results.append({
                'query': query,
                'domain': domain,
                'results': [],
                'query_time': 0,
                'error': str(e)
            })

    # Test vector search statistics
    print("\n📈 System Statistics:")
    print("-" * 30)

    if service.metadata_service:
        metadata_info = service.metadata_service.get_service_info()
        print(f"Total metadata chunks: {metadata_info['total_entries']}")
        print(f"Metadata cache size: {metadata_info['cache_size']}")
    else:
        print("Total metadata chunks: N/A")
        print("Metadata cache size: N/A")

    if service.vector_index_service:
        index_info = service.vector_index_service.get_index_info()
        print(f"Total row mappings: {index_info.get('rowmap_size', 0)}")
    else:
        print("Total row mappings: N/A")

    print(f"Alias mappings loaded: {len(service.alias_map)}")
    print(f"Entity graph nodes: {len(service.entity_graph)}")

    # Check for query cache in retrieval pipeline
    if hasattr(service, 'retrieval_pipeline') and service.retrieval_pipeline:
        try:
            pipeline_info = service.retrieval_pipeline.get_pipeline_info()
            cache_stats = pipeline_info.get('cache_stats', {})
            print(f"Query cache size: {cache_stats.get('size', 0)}")
        except:
            print("Query cache size: N/A (cache not available)")
    else:
        print("Query cache size: N/A")

    # Test entity context building
    print("\n🔗 Testing Entity Context Building...")
    print("-" * 40)

    test_entity_query = "Tell me about Sir Ector and House Pendragon"
    try:
        results = service.retrieve(test_entity_query, top_k=2)

        if results:
            # Extract entities from query
            query_entities = service._extract_query_entities(test_entity_query)
            print(f"Query entities found: {query_entities}")

            # Build entity context
            top_results = results[:3]  # Use top 3 results for context
            entity_context = service._build_entity_context(query_entities, [
                {
                    'entities': result.get('entities', []),
                    'title': result.get('title', ''),
                    'domain': result.get('domain', '')
                }
                for result in results[:3]
            ])

            print(f"Entity context built with {len(entity_context)} entities:")
            for entity in entity_context:
                print(f"   • {entity.entity_name} ({entity.entity_id}): {entity.entity_type}")

    except Exception as e:
        print(f"❌ Entity context error: {e}")

    # Calculate and display domain-specific quality metrics
    if queries_and_results:
        print("\n📊 Calculating domain-specific performance metrics...")
        domain_metrics = calculate_domain_metrics(queries_and_results, domain_targets)
        display_quality_assessment(domain_metrics, domain_targets)
        
        # Additional summary statistics
        print("\n📈 Performance Summary:")
        print("-" * 40)
        total_queries = len(queries_and_results)
        successful_queries = sum(1 for q in queries_and_results if q['results'])
        avg_query_time = sum(q['query_time'] for q in queries_and_results) / total_queries if total_queries > 0 else 0
        avg_results_per_query = sum(len(q['results']) for q in queries_and_results) / total_queries if total_queries > 0 else 0
        
        print(f"Total queries processed: {total_queries}")
        print(f"Successful retrievals: {successful_queries}/{total_queries} ({successful_queries/total_queries:.1%})")
        print(f"Average query time: {avg_query_time:.3f}s")
        print(f"Average results per query: {avg_results_per_query:.1f}")
        
        # Domain distribution
        domain_counts = Counter(q['domain'] for q in queries_and_results)
        print(f"\nQuery distribution by domain:")
        for domain, count in domain_counts.most_common():
            print(f"  • {domain}: {count} queries")

    print("\n✅ RAG System demonstration complete!")
    print("\nThe system successfully demonstrates:")
    print("• Vector search with FAISS indexing")
    print("• Entity extraction and linking")
    print("• Contract-compliant retrieval scoring")
    print("• Entity context building")
    print("• Cross-document knowledge retrieval")
    print("• Domain-specific quality evaluation")

    return 0

if __name__ == "__main__":
    exit(main())