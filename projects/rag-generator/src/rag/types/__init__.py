"""
Type definitions for the RAG system.

Provides comprehensive type hints for better IDE support, documentation,
and code maintainability.
"""

from typing import Dict, List, Tuple, Any, Optional, Union, Protocol, runtime_checkable
from pathlib import Path
import numpy as np
from datetime import datetime


# Basic types
DocumentID = str
SectionID = str
ChunkID = str
EntityID = str
EntityType = str
Domain = str
CanonLevel = str
Query = str
Score = float

# Vector types
Vector = np.ndarray
EmbeddingVector = np.ndarray
QueryVector = np.ndarray

# File path types
FilePath = Union[str, Path]
ConfigPath = FilePath

# Metadata types
Metadata = Dict[str, Any]
ChunkMetadata = Dict[str, Any]
DocumentMetadata = Dict[str, Any]

# Entity types
EntityReference = Dict[str, Any]
EntityList = List[EntityReference]

# Search result types
SearchResult = Dict[str, Any]
SearchResults = List[SearchResult]

# Configuration types
ConfigDict = Dict[str, Any]
XMLConfig = Dict[str, Any]

# Model types
EmbeddingModel = Any  # SentenceTransformer or similar
RerankerModel = Any   # BGE reranker or similar
Index = Any          # FAISS index or similar

# Cache types
CacheKey = str
CacheValue = Any
CacheStats = Dict[str, int]

# Performance types
Latency = float
Throughput = float
MemoryUsage = int

# Request/Response types
RequestID = str
ProcessingTime = float

# Statistics types
Metrics = Dict[str, Any]
KPIData = Dict[str, Any]

# Protocol definitions for dependency injection
@runtime_checkable
class Configurable(Protocol):
    """Protocol for components that can be configured."""

    def initialize(self, config: ConfigDict) -> bool:
        """Initialize component with configuration."""
        ...

    def get_config(self) -> ConfigDict:
        """Get current configuration."""
        ...

@runtime_checkable
class Loggable(Protocol):
    """Protocol for components that support logging."""

    def set_logger(self, logger: Any) -> None:
        """Set logger for component."""
        ...

    def get_logs(self) -> List[str]:
        """Get recent log messages."""
        ...

@runtime_checkable
class Monitorable(Protocol):
    """Protocol for components that can be monitored."""

    def get_metrics(self) -> Metrics:
        """Get component metrics."""
        ...

    def get_health(self) -> Dict[str, Any]:
        """Get component health status."""
        ...

# Common type aliases for better readability
OptionalStr = Optional[str]
OptionalInt = Optional[int]
OptionalFloat = Optional[float]
OptionalBool = Optional[bool]

# File content types
TextContent = str
BinaryContent = bytes
JSONContent = Dict[str, Any]

# Error types
ErrorMessage = str
ExceptionInfo = Tuple[str, str, str]  # (type, message, traceback)

# Time types
Timestamp = datetime
Duration = float

# Collection types with constraints
BoundedList = List[Any]  # For bounded collections like caches
SizedDict = Dict[str, Any]  # For dicts with size constraints

# Network types (for API components)
Host = str
Port = int
URL = str

# Batch processing types
Batch = List[Any]
BatchSize = int
BatchResult = Any

# Index types
IndexID = str
IndexType = str
IndexConfig = Dict[str, Any]

# Pipeline types
PipelineStage = str
PipelineResult = Any
PipelineError = Exception

# Graph types (for entity relationships)
NodeID = str
EdgeID = str
GraphPath = List[NodeID]
GraphDistance = int

# the game engine specific types
UE5VRAMBudget = int  # In MB
UE5LatencyBudget = float  # In seconds
UE5MemoryConstraint = Dict[str, int]

# Validation types
ValidationResult = Tuple[bool, List[str]]  # (is_valid, errors)
ValidationRule = str

# Export types for external usage
__all__ = [
    # Basic types
    'DocumentID', 'SectionID', 'ChunkID', 'EntityID', 'EntityType',
    'Domain', 'CanonLevel', 'Query', 'Score',

    # Vector types
    'Vector', 'EmbeddingVector', 'QueryVector',

    # File types
    'FilePath', 'ConfigPath',

    # Data types
    'Metadata', 'ChunkMetadata', 'DocumentMetadata',
    'EntityReference', 'EntityList',

    # Result types
    'SearchResult', 'SearchResults',

    # Configuration types
    'ConfigDict', 'XMLConfig',

    # Model types
    'EmbeddingModel', 'RerankerModel', 'Index',

    # Protocol types
    'Configurable', 'Loggable', 'Monitorable',

    # Common aliases
    'OptionalStr', 'OptionalInt', 'OptionalFloat', 'OptionalBool',

    # Content types
    'TextContent', 'BinaryContent', 'JSONContent',

    # Performance types
    'Latency', 'Throughput', 'MemoryUsage',

    # Request types
    'RequestID', 'ProcessingTime',

    # Statistics types
    'Metrics', 'KPIData',

    # the game engine types
    'UE5VRAMBudget', 'UE5LatencyBudget', 'UE5MemoryConstraint',
]