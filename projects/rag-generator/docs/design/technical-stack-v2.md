# Lore RAG System - Technical Stack v2.0

## System Architecture Overview

The Lore RAG System v2.0 is built on a modern, distributed microservices architecture designed for high-performance retrieval-augmented generation with advanced features including graph-based retrieval, NPC generation, story arc management, and comprehensive evaluation frameworks.

## Core Technology Stack

### Programming Languages & Runtime
- **Python 3.9+**: Primary implementation language with full type coverage
- **Type Hints**: Comprehensive type annotations with strict mypy validation
- **AsyncIO**: Enhanced asynchronous processing with uvloop for improved performance
- **Multiprocessing**: Parallel processing with proper synchronization primitives
- **Concurrency**: Threading and process pool management for CPU-intensive tasks

### Web Framework & API
- **FastAPI**: High-performance asynchronous web framework with automatic validation (Port 8000)
  - Automatic OpenAPI/Swagger documentation with ReDoc integration
  - Built-in validation with Pydantic v2 models and custom validators
  - Async endpoint support with dependency injection
  - Request/response serialization with automatic JSON schema generation
  - WebSocket support for real-time features
- **Flask**: Lightweight web framework for NPC chat server (Port 5000)
  - Simple routing and template rendering for web interface
  - REST API endpoints for chat functionality
  - Development server with auto-reload capabilities
  - Production deployment with WSGI servers (Gunicorn)
- **Pydantic v2**: Advanced data validation and serialization
  - Runtime type checking with detailed error messages
  - Automatic API documentation with examples
  - Settings management with environment variable support and validation
  - Custom validators for domain-specific constraints
- **Uvicorn**: ASGI server with performance optimizations
  - Multi-worker support with proper signal handling
  - Development auto-reload with file system monitoring
  - Production deployment configurations

### Machine Learning & NLP

#### Embedding Models
- **SentenceTransformers**: Neural sentence embedding with performance optimizations
  - **BAAI/bge-base-en**: Default embedding model (768 dimensions) with INT8 quantization support
  - **BAAI/bge-large-en**: Larger model option for enhanced accuracy (1024 dimensions)
  - Configurable model selection via XML configuration with hot-swapping
  - Automatic model caching and memory management
  - Batch processing with automatic padding and truncation
  - GPU acceleration with CUDA support and memory pooling

#### Vector Search & Indexing
- **FAISS (Facebook AI Similarity Search)**: High-performance vector similarity search
  - **IndexFlatIP**: Exact Inner Product search for development and testing
  - **IndexHNSWFlat**: Hierarchical Navigable Small World for production deployment
  - **IndexIVFFlat**: Inverted File with quantization for large-scale deployment
  - **IndexScalarQuantizer**: Product quantization for memory-efficient storage
  - Configurable index types with automatic selection based on dataset size
  - GPU acceleration support with multiple device management
  - Real-time index updates with minimal performance impact

#### Cross-Encoder Reranking
- **BGE-Reranker-v2-M3**: State-of-the-art reranking model with optimizations
  - Cross-encoder architecture for improved relevance scoring
  - Score interpolation with configurable alpha weighting and dynamic adjustment
  - Intelligent caching with LRU eviction and TTL-based expiration
  - Configurable precision modes (fp16, int8, fp32)
  - Batch processing with automatic query-chunk pairing
  - Model parallelism for improved throughput

#### Graph Neural Networks
- **PyTorch Geometric**: Graph neural network framework for entity relationships
  - Graph embedding generation with node2vec and GraphSAGE
  - Relationship scoring with attention mechanisms
  - Heterogeneous graph support for multi-type entities
  - Temporal graph evolution for story progression
  - GPU-accelerated graph computations

### Data Processing Pipeline

#### Document Ingestion
- **BeautifulSoup4**: HTML/XML parsing with encoding detection
- **Markdown-it-py**: Enhanced markdown processing with plugin ecosystem
- **Custom Parsers**: Specialized parsers for XML character cards and JSON configurations
- **Semantic Chunking**: Advanced text splitting with linguistic analysis
  - Structure-preserving chunk boundaries with configurable overlap
  - Sentence boundary detection and paragraph grouping
  - Domain-specific chunking strategies for different content types

#### Entity Processing
- **Advanced Regex Engine**: High-performance pattern matching with caching
- **Alias Resolution**: Multi-strategy entity name normalization
- **Fuzzy Matching**: Approximate string matching for entity linking
- **Graph Construction**: Entity relationship modeling with weighted edges
- **XML Processing**: Native XML parsing for structured data integration

#### Content Classification
- **Domain Classification**: Multi-label classification for lore categorization
- **Canon Level Detection**: Automatic primary/secondary canon identification
- **Quality Assessment**: Content quality scoring and filtering
- **Language Detection**: Multi-language content identification

### Storage & Persistence

#### Vector Storage
- **NumPy Arrays**: Memory-mapped arrays for large vector collections
- **HDF5 Integration**: Hierarchical storage for very large datasets
- **Memory Pool Management**: Efficient memory allocation and garbage collection
- **Compression**: Optional vector compression for storage optimization

#### Metadata Storage
- **JSON Lines (JSONL)**: Efficient chunk metadata storage with compression
- **SQLite**: Relational storage for caching, analytics, and relationships
- **DuckDB**: Analytical queries for evaluation and monitoring data
- **Row Mapping**: High-performance section_id to vector index mapping

#### Graph Storage
- **NetworkX**: In-memory graph operations and algorithms
- **Graph Database Integration**: Neo4j or Amazon Neptune for persistent graph storage
- **Adjacency Lists**: Compressed sparse row format for memory efficiency
- **Graph Serialization**: Custom binary format for fast loading

#### Configuration Management
- **XML Configuration**: Hierarchical configuration with XSD validation
  - Vectorization parameters with model hot-swapping
  - Index configuration with algorithm selection
  - Entity processing settings with regex compilation caching
  - API server configuration with security settings
- **Environment Variables**: Secure configuration with validation
- **Remote Configuration**: Optional centralized configuration management

### LLM Integration & NPC Generation

#### API Clients
- **OpenAI SDK**: Official client with retry logic and streaming support
- **OpenRouter Integration**: Multi-provider gateway with load balancing
  - Automatic provider detection and failover
  - Custom headers and authentication per provider
  - Rate limiting and quota management
- **Custom LLM Clients**: Modular client architecture for new providers

#### Supported Models
- **OpenAI GPT Series**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic Claude**: Claude-3.5, Claude-3, Claude-2.1
- **Mistral Models**: Mistral-large, Mistral-medium, Mistral-small
- **Meta Llama**: Llama-3.1, Llama-3, CodeLlama variants
- **Local Models**: Support for Ollama, vLLM, KoboldCpp, and other local deployments
- **KoboldCpp Integration**: Native support for KoboldCpp with Mistral 7B and other GGUF models

#### NPC Generation Framework
- **Character Templates**: Structured NPC generation with trait inheritance
- **Memory Architecture**: Vector-based memory storage and retrieval
- **Behavioral Models**: State machines for NPC decision making
- **Integration Layer**: Seamless integration with main RAG system

#### Token Management
- **Tiktoken**: High-performance BPE tokenization with model-specific encodings
- **Context Window Management**: Dynamic token budgeting with sliding window
- **Streaming Support**: Real-time response generation with backpressure handling
- **Prompt Optimization**: Automatic prompt compression and optimization

### Development & Testing

#### Testing Framework
- **Pytest**: Comprehensive testing with advanced features
  - Async test support with pytest-asyncio and proper event loop handling
  - Fixture-based test organization with dependency injection
  - Comprehensive test coverage reporting with branch coverage
  - Performance testing with benchmarking utilities
- **HTTP Testing**: FastAPI TestClient and httpx for API integration testing
- **Mocking**: Flexible mocking with pytest-mock and dependency injection

#### Code Quality
- **Black**: Code formatting with preview style and line ending handling
- **isort**: Import organization with custom configuration
- **Flake8**: Style checking with McCabe complexity analysis
- **MyPy**: Static type checking with strict mode
- **Bandit**: Security vulnerability scanning
- **Pre-commit Hooks**: Automated quality checks on commit

#### Development Tools
- **Makefile**: Sophisticated build automation with target dependencies
- **Environment Management**: UV package manager for fast installations
- **Git Integration**: Advanced .gitignore with IDE-specific patterns
- **Docker Support**: Containerization for development and deployment

## System Architecture Components

### 1. Ingestion Service (`backend/pipeline/ingestion/`)
**Purpose**: Transform diverse content sources into structured knowledge chunks.

**Key Classes**:
- **DocumentProcessor**: Multi-format document loading and validation
- **SemanticChunker**: Intelligent text segmentation with linguistic analysis
- **EntityLinker**: Advanced entity extraction and relationship building
- **MetadataBuilder**: Comprehensive metadata extraction and enrichment
- **JSONLBuilder**: Efficient serialization and storage optimization

**Processing Flow**:
1. Multi-format document loading with encoding detection
2. Content validation and quality assessment
3. Domain classification and canon level detection
4. Semantic chunking with context preservation
5. Entity extraction using multiple strategies (regex, fuzzy matching, graph-based)
6. Metadata enrichment with relationships and classifications
7. Efficient serialization to JSONL with compression
8. Row mapping generation for vector index alignment

### 2. Vector Service (`backend/pipeline/indexing/`)
**Purpose**: Generate vector representations and build search indices.

**Key Classes**:
- **EmbeddingBuilder**: Vector embedding generation with model management
- **FAISSBuilder**: Multi-index construction and optimization
- **VectorValidator**: Embedding integrity and quality validation
- **IndexManager**: Index lifecycle management and performance monitoring

**Embedding Process**:
1. Model loading with caching and memory management
2. Batch encoding with normalization and quantization
3. Vector validation and quality assessment
4. Multi-index construction with algorithm selection
5. Performance optimization and parameter tuning
6. Metadata persistence and integrity verification

### 3. Graph Service (`backend/core/graph/`)
**Purpose**: Entity relationship processing and graph-based retrieval.

**Key Classes**:
- **GraphStore**: Entity graph construction and persistence
- **GraphRouter**: Graph traversal and relationship queries
- **EntityResolver**: Multi-strategy entity linking and resolution
- **PathFinder**: Multi-hop relationship path discovery

**Graph Operations**:
1. Entity graph construction from multiple sources
2. Relationship weight calculation and normalization
3. Graph traversal algorithms for context expansion
4. Subgraph extraction for focused retrieval
5. Dynamic graph updates with conflict resolution
6. Graph embedding generation for similarity computation

### 4. Retrieval Service (`backend/api/`)
**Purpose**: Sophisticated retrieval orchestration with multi-dimensional scoring.

**Core Algorithm** (Enhanced §6.1-6.3):
- **Semantic Scoring** (40%): Cosine similarity with query expansion
- **Entity Overlap** (25%): Multi-strategy entity intersection analysis
- **Graph Proximity** (15%): Entity relationship path scoring with decay
- **Type Matching** (10%): Intent classification and domain alignment
- **Canon Compliance** (5%): Primary canon level enforcement with validation
- **Contextual Relevance** (5%): Discourse coherence and topical consistency

**Key Features**:
- **Advanced Query Processing**: Multi-strategy normalization and entity extraction
- **Hybrid Retrieval**: Combines semantic, graph, and keyword-based approaches
- **Intelligent Scoring**: Dynamic weight adjustment based on query characteristics
- **Context Building**: Graph-enhanced entity context with relationship information
- **Performance Optimization**: Intelligent caching and batch processing

### 5. NPC Service (`backend/npc_generator.py`)
**Purpose**: Dynamic NPC generation with memory integration.

**Key Components**:
- **NPCGenerator**: Template-based character creation with lore integration
- **MemoryBridge**: Vector-based memory storage and retrieval system
- **BehavioralEngine**: State-based NPC decision making and actions
- **TraitSystem**: Personality and motivation modeling

**NPC Features**:
1. Dynamic character generation based on lore context
2. Memory integration with main RAG knowledge base
3. Behavioral trait modeling with evolution over time
4. Context-aware NPC responses and interactions
5. Persistent memory across sessions and story arcs

### 6. Story Service (`story_arc_tracker.py`)
**Purpose**: Complex story arc management and progression tracking.

**Key Components**:
- **ArcTracker**: Multi-threaded storyline monitoring and updates
- **ProgressEngine**: Story progression logic and trigger evaluation
- **StateManager**: Character and world state persistence
- **BranchHandler**: Conditional branching based on player/NPC actions

**Story Features**:
1. Multi-arc storyline management with dependencies
2. Character development tracking and arc progression
3. Dynamic event triggering based on story state
4. Integration with NPC memories and behaviors

### 7. NPC Chat Server (`src/rag/npc_server.py`)
**Purpose**: Web-based interface for interactive NPC conversations with RAG integration.

**Key Components**:
- **Flask Application**: Web server with HTML/CSS frontend and REST API
- **NPC Chat Endpoint**: POST /api/npc-chat for conversational interactions
- **KPI Dashboard**: Real-time performance monitoring interface
- **Health Monitoring**: System status and RAG service availability checking
- **Error Handling**: Graceful degradation when RAG system is unavailable

**Chat Server Features**:
1. Interactive web interface for NPC conversations
2. JSON API for chat functionality with structured responses
3. Real-time KPI metrics display and historical tracking
4. Multi-threaded request handling with proper locking
5. Template-based HTML responses with dynamic styling

### 8. KoboldCpp Integration (`apps/koboldcpp_api_server.py`)
**Purpose**: Local LLM deployment and API server for KoboldCpp integration.

**Key Components**:
- **KoboldCpp Server Wrapper**: Python interface for KoboldCpp executable management
- **API Server**: REST API server providing LLM functionality via KoboldCpp
- **Configuration Management**: JSON-based configuration for easy deployment switching
- **Health Monitoring**: Real-time health checks and performance monitoring
- **Error Handling**: Comprehensive error recovery and logging system

**KoboldCpp Features**:
1. **Process Management**: Automatic KoboldCpp process lifecycle management
2. **Model Loading**: Support for GGUF model formats with GPU acceleration
3. **API Compatibility**: OpenAI-compatible API endpoints for seamless integration
4. **Performance Optimization**: GPU layer configuration and memory management
5. **Network Flexibility**: Configurable host/port with network mode support

**Supported Models**:
- **Mistral 7B**: Mistral-7B-Instruct-v0.1 and variants (GGUF format)
- **Llama 2**: Llama-2-7B, Llama-2-13B, and CodeLlama models
- **Other GGUF Models**: Any GGUF-compatible model supported by KoboldCpp

**Configuration Schema**:
```json
{
  "mode": "local|network",
  "koboldcpp_path": "/path/to/koboldcpp.exe",
  "model_path": "/path/to/model.gguf",
  "host": "localhost",
  "port": 8080,
  "use_gpu": true,
  "gpu_layers": 35,
  "context_size": 2048,
  "threads": 8
}
```

**API Endpoints**:
- **GET /health**: Server health and model status
- **GET /stats**: Performance statistics and model information
- **POST /generate**: Text generation with KoboldCpp backend
- **POST /completion**: OpenAI-compatible completion endpoint

**Integration Benefits**:
1. **Offline Capability**: Full system functionality without internet
2. **Privacy**: Local processing of sensitive data
3. **Cost Control**: No API usage costs for LLM operations
4. **Performance**: Optimized for local hardware with GPU acceleration
5. **Reliability**: No dependency on external API availability

## Performance Characteristics

### Latency Targets
- **Query Processing**: <1.5 seconds p95 for complex graph-enhanced queries
- **Vector Search**: <50ms for FAISS similarity search with caching
- **Graph Operations**: <100ms for relationship traversal and context building
- **NPC Generation**: <2 seconds for full character creation with memory
- **LLM Generation**: <4 seconds for typical responses with streaming
- **Index Construction**: Optimized for incremental updates

### Throughput Capabilities
- **Concurrent Queries**: Support for 100+ simultaneous requests
- **Batch Processing**: Optimized batch embedding and indexing
- **Graph Operations**: Parallel graph traversal for multiple queries
- **Caching**: Multi-level caching with intelligent eviction policies
- **Memory Efficiency**: Streaming processing for large document collections

### Scalability Features
- **Microservices Design**: Independent scaling of each service component
- **Stateless Services**: Horizontal scaling capability with load balancing
- **Connection Pooling**: Efficient API client and database connection management
- **Async Processing**: Non-blocking I/O with proper backpressure handling
- **Resource Management**: Memory-efficient data structures and processing

## Configuration Management

### Enhanced XML Configuration Schema
```xml
<config>
  <system>
    <version>2.0</version>
    <environment>production</environment>
  </system>
  <vectorization>
    <embedding_model>BAAI/bge-base-en</embedding_model>
    <normalize_embeddings>true</normalize_embeddings>
    <batch_size>32</batch_size>
    <quantization>int8</quantization>
  </vectorization>
  <index>
    <type>faiss_hnsw</type>
    <hnsw>
      <M>64</M>
      <efConstruction>400</efConstruction>
      <efSearch>64</efSearch>
    </hnsw>
  </index>
  <graph>
    <enabled>true</enabled>
    <max_depth>3</max_depth>
    <relationship_weights>
      <employer_employee>0.9</employer_employee>
      <family>0.8</family>
      <ally>0.7</ally>
    </relationship_weights>
  </graph>
  <reranker>
    <enabled>true</enabled>
    <model>BAAI/bge-reranker-v2-m3</model>
    <alpha>0.6</alpha>
    <batch_size>16</batch_size>
  </reranker>
  <npc_generation>
    <memory_integration>true</memory_integration>
    <max_memory_items>100</max_memory_items>
    <behavior_model>state_machine</behavior_model>
  </npc_generation>
</config>
```

### Environment Variables
- **OPENAI_API_KEY**: OpenAI API authentication with key rotation support
- **OPENROUTER_API_KEY**: OpenRouter API authentication with provider management
- **LLM_TEMPERATURE**: Response generation temperature with per-provider settings
- **LLM_MAX_TOKENS**: Maximum response length with dynamic adjustment
- **FAISS_INDEX_TYPE**: Vector index algorithm with automatic selection
- **GRAPH_DB_URI**: Graph database connection string for persistent storage
- **REDIS_URI**: Redis connection for distributed caching
- **LOG_LEVEL**: Configurable logging level with structured output

### NPC Chat Server Environment Variables
- **HOST**: Server host binding (default: 0.0.0.0)
- **PORT**: Server port for NPC chat interface (default: 5000)
- **DEBUG**: Debug mode for development (default: true)

## Deployment Architecture

### Service Components
- **API Gateway**: FastAPI application with Uvicorn ASGI server (Port 8000)
- **NPC Chat Server**: Flask-based web interface for interactive conversations (Port 5000)
- **Ingestion Service**: Batch processing service for document intake with queue management
- **Vector Service**: Embedding generation and index management with GPU support
- **Graph Service**: Entity relationship processing with dedicated graph storage
- **NPC Service**: Character generation and memory management service
- **Story Service**: Arc tracking and narrative progression service
- **the game engine Integration Service**: Communication interface for a game engine
- **Cache Layer**: Multi-level caching with Redis and in-memory tiers
- **Monitoring Service**: Metrics collection, alerting, and dashboard

### Infrastructure Requirements
- **Memory**: 16GB+ RAM for model loading, vector storage, and graph operations
- **Storage**: NVMe SSD storage for vector indices, metadata, and graph data
- **Network**: High-bandwidth, low-latency network for inter-service communication
- **GPU**: Multiple CUDA-compatible GPUs for accelerated ML workloads
- **CPU**: High-core-count CPUs for parallel processing tasks

## Monitoring & Observability

### Enhanced Metrics Collection
- **Performance Metrics**: Latency percentiles, throughput, error rates, queue depths
- **Resource Metrics**: CPU, memory, disk, GPU utilization across all services
- **Cache Performance**: Hit rates, cache size, eviction statistics, cache invalidation
- **Index Statistics**: Vector count, index type, build metadata, search performance
- **Graph Metrics**: Node/edge counts, traversal performance, relationship statistics
- **NPC Metrics**: Generation latency, memory usage, behavioral model performance
- **Story Metrics**: Arc progression, trigger evaluation, state consistency

### Logging & Debugging
- **Structured Logging**: JSON-formatted logs with correlation IDs and trace context
- **Distributed Tracing**: OpenTelemetry integration for request flow visualization
- **Performance Profiling**: Query execution time breakdown with flame graphs
- **Error Tracking**: Comprehensive error categorization with stack trace analysis
- **Debug Endpoints**: Health checks, statistics, configuration dumps, and diagnostics
- **Alerting**: Proactive monitoring with PagerDuty/Slack integration

## Security Considerations

### API Security
- **Authentication**: JWT-based authentication with role-based access control
- **Authorization**: Fine-grained permissions for different API endpoints
- **Input Validation**: Comprehensive request validation with custom sanitizers
- **Rate Limiting**: Advanced rate limiting with sliding window and burst handling
- **CORS Configuration**: Secure cross-origin request handling with preflight checks

### Data Protection
- **Content Filtering**: Advanced input/output content validation and PII detection
- **Encryption**: TLS 1.3 for all communications, encryption at rest for sensitive data
- **Secure Headers**: Security headers and CSP for API responses
- **Dependency Scanning**: Automated security vulnerability assessment with Snyk
- **Access Control**: Attribute-based access control for data governance

## Development Workflow

### Enhanced Build Process
```bash
# Install dependencies with UV for speed
uv pip install -r requirements.txt

# Run comprehensive tests
make test-all

# Build embeddings with progress monitoring
make embed-progress

# Start all services with docker-compose
make services-up

# Run full pipeline with validation
make build-validate

# Performance benchmarking
make benchmark

# Start NPC chat server (Port 5000)
python src/rag/npc_server.py

python apps/run_demo.py

# Start evaluation suite with parallel processing
make eval-offline
make eval-api

# Development workflow with multiple services
make dev_api        # FastAPI server in development mode
make faiss-monitor  # Monitor FAISS performance for cron jobs
make faiss-sweep    # Run parameter sweeps for optimization
```

### Multi-Service Development Workflow

```bash
# Terminal 1: Core RAG System
make build
make retrieve

# Terminal 2: NPC Chat Server
python src/rag/npc_server.py
# Access at: http://localhost:5000/chat

python apps/run_demo.py

# Terminal 4: Monitoring & Testing
make faiss-kpis     # Performance evaluation
make eval-offline   # Golden query evaluation
```

### Testing Strategy
- **Unit Tests**: Individual component validation with 95%+ coverage
- **Integration Tests**: End-to-end pipeline testing with service dependencies
- **Performance Tests**: Load testing with realistic traffic patterns
- **Contract Tests**: API contract validation with consumer-driven testing
- **Chaos Tests**: Resilience testing with failure injection
- **Quality Gates**: Automated quality thresholds with build blocking

### Continuous Integration
- **Automated Testing**: Parallel test execution with matrix builds
- **Code Quality Checks**: Comprehensive linting, type checking, and security scanning
- **Performance Regression**: Automated benchmarking with trend analysis
- **Dependency Updates**: Automated dependency vulnerability scanning and updates
- **Documentation Updates**: Automated API documentation regeneration

## Future Technical Enhancements

### Planned Improvements (v3.0)
- **Vector Database Migration**: Dedicated vector database (Qdrant, Pinecone, Weaviate)
- **Distributed Graph Processing**: Multi-node graph computation with Apache Spark
- **Advanced Chunking**: LLM-powered semantic chunking with sliding window optimization
- **Multi-modal Support**: Image, audio, and video content understanding and indexing
- **Real-time Updates**: Live document ingestion with incremental index updates
- **Federated Search**: Cross-system search with result aggregation and ranking

### Performance Optimizations
- **Model Quantization**: INT4 quantization for all models with calibration
- **Advanced Caching**: Semantic caching with vector similarity for query results
- **Batch Optimization**: Dynamic batch sizing based on hardware capabilities
- **Hardware Acceleration**: Multi-GPU training and inference with NCCL
- **Edge Deployment**: Model optimization for CPU-only deployment

### Scalability Enhancements
- **Service Mesh**: Istio-based service mesh for traffic management and security
- **Load Balancing**: Advanced load distribution with machine learning prediction
- **Auto-scaling**: Predictive auto-scaling based on historical patterns and ML forecasting
- **Global Distribution**: Multi-region deployment with intelligent traffic routing
- **Data Locality**: Edge computing for reduced latency and bandwidth usage