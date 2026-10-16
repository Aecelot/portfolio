# Lore RAG System - Functional Design v2.0

## Overview

The Lore RAG System is an advanced Retrieval-Augmented Generation platform specifically designed for immersive fantasy world-building and interactive storytelling. Version 2.0 introduces significant enhancements including graph-based retrieval, NPC generation capabilities, story arc management, and real-time evaluation frameworks.

## Core System Architecture

### 1. Enhanced Data Ingestion Pipeline

**Purpose**: Transform diverse content sources into structured, searchable knowledge representations.

**Components**:
- **Multi-Format Document Processing**: Markdown, XML, JSON, and structured data parsing
- **Intelligent Chunking**: Context-aware text segmentation (120-450 tokens) with overlap preservation
- **Advanced Entity Extraction**: Multi-strategy entity recognition using regex patterns, alias mapping, and relationship graphs
- **Vector Embedding Generation**: BAAI/bge-base-en model integration with batch processing and normalization
- **Metadata Enrichment**: Comprehensive metadata extraction including canon levels, entity relationships, and content classification

**Input Sources**:
- Markdown lore documents across multiple domains (geography, bestiary, magic, history, politics, religion, economy, culture)
- Character cards and NPC definitions in XML format
- Story arc configurations and progression data
- Entity relationship graphs and alias mappings

**Output**: Structured JSONL metadata with embeddings, entity relationships, and comprehensive indexing information

### 2. Advanced Vector Search & Indexing

**Purpose**: Enable fast, semantically-aware similarity search with multiple retrieval strategies.

**Components**:
- **FAISS Indexing Suite**: Multiple index types for different use cases:
  - IndexFlatIP: Exact Inner Product search for highest accuracy
  - IndexHNSWFlat: Hierarchical Navigable Small World for approximate search
  - IndexIVFFlat: Inverted File with quantization for large-scale deployment
- **Hybrid Retrieval**: Combines semantic similarity with keyword-based search
- **Graph-Enhanced Search**: Entity relationship proximity boosting
- **Metadata Filtering**: Domain, canon level, and entity-based filtering

**Features**:
- Configurable similarity thresholds and scoring weights
- Batch query processing for improved throughput
- Real-time index updates and metadata synchronization
- Performance monitoring and automatic index optimization

### 3. Graph-Based Retrieval Engine

**Purpose**: Leverage entity relationships and knowledge graph structures for enhanced retrieval accuracy.

**Components**:
- **Entity Graph Construction**: Build and maintain entity relationship networks
- **Graph Traversal Algorithms**: Multi-hop entity relationship exploration
- **Context Propagation**: Spread activation through related entities
- **Path-Based Ranking**: Score results based on graph distance and relationship strength

**Graph Features**:
- Multi-type entity support (Characters, Locations, Organizations, Religions, Magic Systems, Creatures)
- Weighted relationship edges with semantic meaning
- Dynamic graph updates as new content is ingested
- Subgraph extraction for focused context building

### 4. Advanced Retrieval Service

**Purpose**: Implement sophisticated multi-dimensional scoring and retrieval orchestration.

**Core Algorithm** (§6.1-6.3 Enhanced):
- **Semantic Similarity** (S_semantic): Vector cosine similarity (40% weight)
- **Entity Overlap** (S_entity): Query-chunk entity intersection analysis (25% weight)
- **Graph Proximity** (S_graph): Entity relationship path scoring (15% weight)
- **Type Matching** (S_type): Query intent and domain alignment (10% weight)
- **Canon Compliance** (S_canon): Primary canon level enforcement (5% weight)
- **Contextual Relevance** (S_context): Discourse coherence and topical alignment (5% weight)

**Query Processing Pipeline**:
1. Multi-strategy query normalization and preprocessing
2. Advanced entity extraction with alias resolution
3. Intent classification using multiple heuristics
4. Hybrid retrieval combining semantic and graph-based approaches
5. Multi-dimensional scoring with dynamic weight adjustment
6. Cross-encoder reranking with interpolation
7. Context-aware token budgeting and response truncation
8. Entity context building with relationship enrichment

### 5. NPC Generation & Memory System

**Purpose**: Generate dynamic NPCs with persistent memory and behavioral traits.

**Components**:
- **NPC Generator**: Create NPCs with rich backgrounds, motivations, and characteristics
- **Memory Bridge**: Integrate NPC memories with the main RAG system
- **Behavioral Modeling**: Define NPC behaviors, goals, and interaction patterns
- **Memory Persistence**: Store and retrieve NPC-specific memories and experiences

**NPC Features**:
- Dynamic character creation based on lore context
- Memory integration with retrieval system
- Behavioral trait modeling and evolution
- Context-aware NPC responses and actions

### 6. Story Arc Management

**Purpose**: Track and manage complex story arcs across multiple characters and plotlines.

**Components**:
- **Story Arc Tracker**: Monitor story progression and character development
- **Arc Configuration**: Define story structures and branching narratives
- **Progress Monitoring**: Track completion status and trigger conditions
- **Dynamic Adaptation**: Adjust story elements based on player/NPC interactions

**Story Features**:
- Multi-threaded storyline management
- Conditional branching based on player choices
- Character arc progression tracking
- Integration with NPC memory systems

### 8. LLM Deployment & Integration

**Purpose**: Support multiple LLM deployment strategies including local KoboldCpp and cloud-based services.

**Components**:
- **KoboldCpp Integration**: Local LLM deployment with Mistral 7B model support
- **Network Mode**: Remote LLM server connectivity with automatic failover
- **Easy Configuration**: JSON-based configuration management for deployment switching
- **Performance Optimization**: GPU acceleration and memory management for local deployment

**LLM Deployment Features**:
- **Offline Operation**: Full functionality without internet connectivity
- **Dynamic Switching**: Runtime switching between local and network modes
- **Auto-Discovery**: Automatic service discovery and connection management
- **Fallback System**: Graceful degradation when services are unavailable
- **Performance Monitoring**: Real-time performance tracking and optimization

**Supported Deployment Modes**:
1. **Local Mode**: KoboldCpp with Mistral 7B model on local hardware
2. **Network Mode**: Remote LLM servers with configurable endpoints
3. **Hybrid Mode**: Automatic failover between local and network deployments

**Configuration Management**:
```json
{
  "deployment_mode": "local|network|hybrid",
  "local_config": {
    "koboldcpp_path": "/path/to/koboldcpp",
    "model_path": "/path/to/model.gguf",
    "use_gpu": true,
    "gpu_layers": 35
  },
  "network_config": {
    "endpoints": ["http://localhost:8080", "http://backup:8080"],
    "timeout": 30,
    "retry_attempts": 3
  }
}
```

### 9. NPC Chat Server & Web Interface

**Purpose**: Provide a web-based interface for interactive NPC conversations with RAG-powered responses.

**Components**:
- **Flask Web Server**: REST API endpoints for NPC chat functionality
- **Interactive Chat Interface**: HTML/CSS/JavaScript frontend for user interaction
- **KPI Dashboard**: Real-time performance monitoring and metrics visualization
- **Health Monitoring**: System status and RAG service availability checking
- **Multi-format Response**: JSON API responses with structured metadata

**Chat Server Features**:
- **Real-time NPC Interaction**: Conversational interface for question answering
- **RAG-powered Responses**: Contextually relevant answers using the full lore system
- **Source Attribution**: Clear indication of information sources and confidence levels
- **Performance Monitoring**: Live KPI tracking and historical metrics
- **Graceful Degradation**: Limited functionality when RAG system is unavailable

## Enhanced Functional Requirements

### 1. Query Processing & Understanding
- **FR-1.1**: Accept natural language queries up to 2000 characters with context preservation
- **FR-1.2**: Extract and resolve entities using comprehensive alias mapping
- **FR-1.3**: Classify query intent across multiple dimensions (who, what, where, when, why, how)
- **FR-1.4**: Normalize queries while preserving semantic intent and cultural context
- **FR-1.5**: Support multi-turn conversation context and memory

### 2. Advanced Retrieval Quality
- **FR-2.1**: Return contextually relevant results with configurable top-k (k ≤ 20)
- **FR-2.2**: Apply sophisticated weighted scoring across multiple dimensions
- **FR-2.3**: Provide optional cross-encoder reranking with intelligent caching
- **FR-2.4**: Enforce canon compliance with configurable strictness levels
- **FR-2.5**: Implement intelligent token budgeting with context preservation
- **FR-2.6**: Support graph-based query expansion and entity relationship exploration

### 3. Entity Context & Graph Integration
- **FR-3.1**: Build rich entity context from query and retrieval results
- **FR-3.2**: Leverage knowledge graph for relationship-based context enrichment
- **FR-3.3**: Provide enhanced entity glosses with relationship information
- **FR-3.4**: Prioritize query-relevant entities in context selection
- **FR-3.5**: Support multi-hop entity relationship traversal

### 4. NPC Generation & Memory
- **FR-4.1**: Generate NPCs with rich, consistent backgrounds and motivations
- **FR-4.2**: Integrate NPC memories with main knowledge base
- **FR-4.3**: Support dynamic NPC behavior and personality modeling
- **FR-4.4**: Enable persistent NPC memory across sessions

### 5. Story Arc Management
- **FR-5.1**: Track complex story arcs with multiple branching paths
- **FR-5.2**: Monitor character development and story progression
- **FR-5.3**: Support conditional story triggers and events
- **FR-5.4**: Integrate story state with NPC memories and behaviors

### 6. Performance & Scalability
- **FR-6.1**: Maintain sub-2-second response times for complex queries (p95)
- **FR-6.2**: Support concurrent query processing with intelligent load balancing
- **FR-6.3**: Provide comprehensive caching for embeddings, reranking, and query results
- **FR-6.4**: Scale horizontally with stateless service design
- **FR-6.5**: Monitor and optimize resource usage across all components

### 8. NPC Chat Server & Web Interface
- **FR-8.1**: Provide responsive web interface for real-time NPC conversations
- **FR-8.2**: Implement REST API for chat functionality with proper error handling
- **FR-8.3**: Display real-time KPI metrics and system performance indicators
- **FR-8.4**: Support graceful degradation when RAG system is unavailable
- **FR-8.5**: Maintain conversation context and source attribution across interactions

## Domain Coverage & Knowledge Organization

### Core Lore Domains
- **Geography**: World regions, locations, environmental features, climate systems
- **Bestiary**: Creatures, monsters, wildlife with magical properties and behaviors
- **Magic Systems**: enchantments, magical artifacts, supernatural phenomena
- **History**: Timeline, historical events, Ages of Logres, cultural evolution
- **Politics**: Noble houses, governance structures, faction relationships, power dynamics
- **Religion**: Belief systems, deities, religious organizations, mythological frameworks
- **Economy**: Trade systems, currency, merchant organizations, resource management
- **Culture**: Customs, traditions, social structures, artistic expressions

### Character & NPC Domains
- **Character Backgrounds**: Personal histories, motivations, relationships
- **NPC Personalities**: Behavioral traits, goals, interaction patterns
- **Memory Systems**: Personal experiences, learned knowledge, evolving perspectives
- **Social Networks**: Character relationships, alliances, rivalries

### Story & Narrative Domains
- **Plot Arcs**: Main storyline progression and character development
- **Side Quests**: Secondary storylines and optional content
- **World Events**: Dynamic events that affect the world state
- **Character Arcs**: Individual character growth and transformation

### Entity Relationship Types
- **Characters ↔ Organizations**: Affiliations, memberships, hierarchical relationships
- **Locations ↔ Creatures**: Habitat relationships, ecological connections
- **Magic ↔ History**: Evolution of magical practices and their historical impact
- **Religion ↔ Politics**: Religious influence on governance and policy
- **Economy ↔ Organizations**: Trade networks, merchant guild structures
- **Characters ↔ Locations**: Personal connections to places, territorial claims
- **NPC Memories ↔ Lore**: Integration of personal experiences with world knowledge

## Quality Assurance & Evaluation

### Enhanced Evaluation Framework
- **Retrieval Quality Metrics**: Precision, recall, NDCG, MRR, semantic similarity
- **Entity Linking Accuracy**: Entity recognition precision, alias resolution success
- **Graph Retrieval Effectiveness**: Path accuracy, relationship relevance
- **Response Quality Assessment**: Coherence, factual accuracy, canon compliance
- **NPC Generation Quality**: Character consistency, behavioral appropriateness
- **Story Arc Coherence**: Narrative consistency, progression logic

### Testing Strategy
- **Unit Tests**: Individual component validation with comprehensive coverage
- **Integration Tests**: End-to-end pipeline testing across all modules
- **Performance Tests**: Load testing, latency validation, throughput measurement
- **Quality Gates**: Automated quality thresholds and continuous validation
- **Golden Query Evaluation**: Curated test queries with known expected results
- **Adversarial Testing**: Edge cases, malformed queries, conflicting information

## API Interface & Integration

### Primary Endpoints
- **POST /retrieve**: Advanced retrieval with graph and entity context support
- **POST /generate-npc**: Dynamic NPC creation with lore integration
- **GET /story-arcs**: Story progression and character arc status
- **POST /update-memory**: NPC memory and experience updates
- **GET /health**: Comprehensive service health and readiness status
- **GET /stats**: Detailed service statistics and performance metrics
- **GET /metrics**: Real-time performance monitoring and KPI data

### NPC Chat Server Endpoints (Port 5000)
- **GET /**: Main web interface with system status and navigation
- **GET /chat**: Interactive chat interface for NPC conversations
- **POST /api/npc-chat**: NPC chat API for conversational interactions
- **GET /api/health**: Health check with RAG system status
- **GET /api/kpi/current**: Current KPI metrics and performance data
- **GET /api/kpi/history**: Historical KPI data for trend analysis
- **GET /dashboard**: KPI dashboard interface for monitoring

### Enhanced Response Format
```json
{
  "query": "Tell me about Sir Ector and his relationship to House Pendragon",
  "entity_context": [
    {
      "id": "character_sir_ector",
      "name": "Sir Ector",
      "type": "character",
      "gloss": "Dwarf pit fighter and former Hammer Guild weaponsmith with deep connections to criminal underworld...",
      "relationships": [
        {"entity": "organization_house_pendragon", "type": "former_employer", "strength": 0.8},
        {"entity": "location_camelot", "type": "birthplace", "strength": 0.9}
      ]
    }
  ],
  "graph_context": {
    "paths": [
      ["character_sir_ector", "organization_house_pendragon", "character_marcus_pendragon"],
      ["character_sir_ector", "location_pit_fighting_arenas", "event_great_pit_war"]
    ],
    "subgraph_entities": ["character_sir_ector", "organization_house_pendragon", ...]
  },
  "results": [
    {
      "rank": 1,
      "text": "Sir Ector served as chief enforcer for House Pendragon's criminal operations...",
      "score": 0.94,
      "score_breakdown": {
        "semantic": 0.89,
        "entity_overlap": 0.95,
        "graph_proximity": 0.97,
        "canon_compliance": 1.0
      },
      "metadata": {
        "doc_id": "character_sir_ector_expanded",
        "domain": "characters",
        "canon_level": "primary",
        "entities": ["character_sir_ector", "organization_house_pendragon"],
        "graph_paths": [["character_sir_ector", "organization_house_pendragon"]]
      }
    }
  ],
  "npc_suggestions": [
    {
      "name": "Karg Ironfist",
      "background": "Fellow pit fighter who fought alongside Ector...",
      "connection_to_query": "Shared combat history with Sir Ector"
    }
  ]
}
```

### NPC Chat Server Response Format
```json
{
  "response": "Ah, young traveler, you inquire about Sir Ector? Now there is a knight with a story as weathered as the Iron Mountains themselves. I have known Ector since he first came to these lands as a wide-eyed weaponsmith's apprentice...",
  "sources": [
    {
      "title": "Sir Ector Character Profile",
      "domain": "characters",
      "relevance_score": 0.92,
      "extract": "Sir Ector served as chief enforcer for House Pendragon's criminal operations..."
    }
  ],
  "metadata": {
    "npc_name": "the assistant",
    "personality": "scholarly",
    "trust_level": 0.7,
    "response_length": "detailed",
    "source_count": 3,
    "processing_time_ms": 245
  }
}
```

## Deployment Architecture

### Service Components
- **API Service**: FastAPI-based retrieval and generation service (Port 8000)
- **NPC Chat Server**: Flask-based web interface for interactive NPC conversations (Port 5000)
- **Ingestion Pipeline**: Multi-format document processing service
- **Vector Store**: FAISS index with metadata storage and graph integration
- **Graph Service**: Entity relationship processing and graph queries
- **NPC Service**: Character generation and memory management
- **Story Service**: Arc tracking and narrative progression
- **the game engine Integration Service**: Communication interface for a game engine
- **Cache Layer**: Multi-level caching for performance optimization
- **Monitoring Service**: Comprehensive metrics collection and alerting

### Scalability Considerations
- **Microservices Architecture**: Independent scaling of each component
- **Horizontal Scaling**: Stateless design enabling load distribution
- **Graph Database Integration**: Dedicated graph storage for complex relationships
- **Async Processing**: Background jobs for ingestion and index updates
- **Load Balancing**: Intelligent request distribution and failover
- **Auto-scaling**: Dynamic resource allocation based on demand

## Security & Compliance

### Data Protection
- **Content Filtering**: Advanced input validation and sanitization
- **Rate Limiting**: Sophisticated API rate limiting with burst handling
- **Access Control**: Role-based authentication and authorization
- **Audit Logging**: Comprehensive activity tracking and compliance reporting

### Canon Compliance
- **Primary Canon Enforcement**: Strict adherence to established lore
- **Source Attribution**: Clear identification of information sources
- **Version Control**: Document versioning and update tracking
- **Consistency Validation**: Cross-reference validation for lore coherence
- **Conflict Resolution**: Automated detection and resolution of contradictory information

## Future Enhancements

### Planned Features (v3.0)
- **Multi-modal Content**: Image, audio, and video content integration
- **Conversational Memory**: Persistent multi-session conversation context
- **Advanced Reasoning**: Chain-of-thought and multi-step reasoning capabilities
- **Federated Search**: Cross-collection and multi-system search functionality
- **Real-time Collaboration**: Multi-user editing and content management
- **Procedural Generation**: Automated content creation for world expansion

### Performance Optimizations
- **Model Quantization**: Reduced precision for faster inference across all ML models
- **Advanced Caching**: Semantic caching for similar queries and context
- **Batch Optimization**: Improved batch processing efficiency for all pipelines
- **Hardware Acceleration**: GPU acceleration for embedding, reranking, and generation
- **Edge Deployment**: On-device deployment for reduced latency

### Scalability Enhancements
- **Distributed Graph Processing**: Multi-node graph computation and storage
- **Advanced Load Balancing**: Machine learning-based request distribution
- **Global Distribution**: Multi-region deployment with intelligent routing
- **Auto-scaling Intelligence**: Predictive scaling based on usage patterns