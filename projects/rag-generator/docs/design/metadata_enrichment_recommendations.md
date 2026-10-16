# Metadata Enrichment Recommendations for Lore RAG System

## Analysis Summary

This document outlines the current issues with metadata generation during ingestion and provides comprehensive recommendations for enriching the metadata to improve retrieval quality and system performance.

## Current Issues Identified

### 1. Domain Field Mismatch

**Problem**: The retrieval system expects a `domain` field but the ingestion pipeline only provides `domain_type`.

- **Expected domains** (from `evaluation_config.xml`): `characters`, `locations`, `history`, `factions`, `religion`, `magic`, `rules`, `economy`, `cultures`, `laws`
- **Current behavior**: Files like `corpus/bestiary.md` are mapped to `general_lore` instead of the expected `bestiary` domain

**Impact**: Domain-based filtering and quality metrics fail because the field names don't match.

### 2. Entity Linking Failure

**Problem**: The `entities` array is empty and `entity_coverage_score` is 0.0 in all chunks.

- **Entity definitions exist**: `backend/data/entities.xml` contains comprehensive entity definitions
- **Alias mappings exist**: `backend/data/alias_map.json` provides extensive alias mappings
- **Entity linker exists**: `link_entities.py` has sophisticated entity extraction logic
- **Issue**: The entity linking process isn't finding matches in text chunks despite comprehensive data

**Impact**: Loss of entity-based retrieval boosting and relationship graph functionality.

### 3. Domain Mapping Configuration Issues

**Problem**: The `rag.xml` configuration has domain mappings but they're not working correctly.

- **Configuration exists**: Domain mappings are defined in `rag.xml` lines 45-66
- **Patterns defined**: `**/bestiary*` should map to `bestiary` domain
- **File structure**: Actual files like `corpus/bestiary.md` should match these patterns
- **Issue**: Domain mapping logic in `chunk_md.py` may not be working correctly

## Detailed Findings

### Metadata Structure Analysis

Current `meta.jsonl` structure:
```json
{
  "section_id": "6ef67b7321f41e1e",
  "source_file": "lore\\corpus\\bestiary.md",
  "domain_type": "general_lore",
  "chunk_index": 0,
  "token_count": 286,
  "text": "Table of Contents...",
  "header_path": ["Table of Contents", "Environmental Manifestations"],
  "entities": [],
  "relations": [],
  "entity_coverage_score": 0.0,
  "content_hash": "1d116e23bfb2af9a46dbba0fcda6c9e4",
  "metadata": {
    "created_at": "2025-10-10T15:27:35",
    "processing_time": 0.4880690574645996,
    "export_version": "1.0"
  }
}
```

### Entity Data Quality

**Entity Definitions** (`entities.xml`):
- ✅ 60+ entities defined with proper IDs, names, types
- ✅ Comprehensive aliases for each entity
- ✅ Relationship mappings between entities
- ✅ Well-structured XML format

**Alias Mappings** (`alias_map.json`):
- ✅ 570+ alias entries across all entities
- ✅ Multiple variations including case-insensitive matches
- ✅ Proper JSON structure with entity_id → aliases mapping

**Entity Linker Logic** (`link_entities.py`):
- ✅ Sophisticated pattern matching for entity extraction
- ✅ Fuzzy matching capabilities for similar terms
- ✅ Relationship extraction between co-occurring entities
- ✅ Comprehensive error handling and fallback mechanisms

## Recommendations for Metadata Enrichment

### 1. Fix Domain Mapping Configuration

Update `backend/config/rag.xml` domain configuration:

```xml
<domains>
    <domain name="bestiary">
        <path_glob>**/bestiary*.md</path_glob>
        <type>creature_profile</type>
    </domain>
    <domain name="history">
        <path_glob>**/history.md</path_glob>
        <type>historical_content</type>
    </domain>
    <domain name="magic">
        <path_glob>**/magic_supernatural*.md</path_glob>
        <type>magic_system</type>
    </domain>
    <domain name="characters">
        <path_glob>**/characters/**</path_glob>
        <type>character_bio</type>
    </domain>
    <domain name="locations">
        <path_glob>**/locations/**</path_glob>
        <type>location_profile</type>
    </domain>
    <domain name="factions">
        <path_glob>**/organizations_factions*.md</path_glob>
        <type>faction_profile</type>
    </domain>
    <domain name="geography">
        <path_glob>**/geography.md</path_glob>
        <type>geographical_content</type>
    </domain>
</domains>
```

### 2. Add Missing Domain Field

Modify `backend/pipeline/ingestion/build_jsonl.py` to include both fields:

```python
# In the chunk_data creation (around line 361):
chunk_data = {
    'section_id': chunk.section_id,
    'source_file': chunk.source_file,
    'domain': chunk.domain_type,  # Add this field for retrieval compatibility
    'domain_type': chunk.domain_type,  # Keep existing field
    'chunk_index': chunk.chunk_index,
    'token_count': chunk.token_count,
    'text': chunk.text,
    'header_path': chunk.header_path,
    'entities': chunk.entities,
    'relations': chunk.relations,
    'entity_coverage_score': chunk.entity_coverage_score,
    'content_hash': chunk.content_hash,
    'metadata': {
        'created_at': chunk.created_at,
        'processing_time': chunk.processing_time,
        'export_version': '1.0'
    }
}
```

### 3. Enhance Entity Linking

Update `backend/config/rag.xml` to enable fuzzy matching:

```xml
<entity_processing>
    <alias_map_path>data/alias_map.json</alias_map_path>
    <entities_xml_path>data/entities.xml</entities_xml_path>
    <entity_coverage_min>0.60</entity_coverage_min>
    <reject_rate_max>0.05</reject_rate_max>
    <fuzzy_matching>true</fuzzy_matching>  <!-- Enable this -->
</entity_processing>
```

### 4. Add Content Classification Metadata

Enhance the `ChunkExport` dataclass in `build_jsonl.py`:

```python
@dataclass
class ChunkExport:
    """Complete chunk data for JSONL export."""
    # Core chunk information
    section_id: str
    source_file: str
    domain: str  # Add this
    domain_type: str
    chunk_index: int
    token_count: int

    # Content and structure
    text: str
    header_path: List[str]

    # Entity linking results
    entities: List[Dict[str, Any]]
    relations: List[List[str]]
    entity_coverage_score: float

    # Enhanced metadata
    content_type: str  # 'narrative', 'mechanical', 'descriptive', 'instructional'
    key_terms: List[str]  # Important terms extracted from content
    summary: str  # Brief summary of chunk content
    complexity_score: float  # How complex the content is (0-1)
    semantic_categories: List[str]  # ['combat', 'magic', 'social', etc.]
    temporal_context: str  # 'past', 'present', 'future', 'timeless'
    spatial_context: str  # 'urban', 'wilderness', 'specific_location'
    tone: str  # 'neutral', 'formal', 'casual', 'technical'

    # Existing metadata
    content_hash: str
    created_at: str
    processing_time: float
```

### 5. Add Semantic Analysis Pipeline

Create a new content analysis module to extract semantic metadata:

```python
# Add to backend/pipeline/ingestion/
class ContentAnalyzer:
    def __init__(self):
        self.domain_keywords = {
            'characters': ['character', 'person', 'individual', 'hero', 'villain'],
            'locations': ['location', 'place', 'area', 'region', 'city', 'town'],
            'magic': ['magic', 'spell', 'energy', 'power', 'supernatural'],
            'creatures': ['creature', 'beast', 'monster', 'animal', 'being'],
            # ... more categories
        }

    def analyze_content(self, text: str, domain: str) -> Dict[str, Any]:
        # Analyze content and return semantic metadata
        return {
            'content_type': self._classify_content_type(text),
            'key_terms': self._extract_key_terms(text),
            'summary': self._generate_summary(text),
            'complexity_score': self._calculate_complexity(text),
            'semantic_categories': self._extract_semantic_categories(text),
            'temporal_context': self._determine_temporal_context(text),
            'spatial_context': self._determine_spatial_context(text),
            'tone': self._analyze_tone(text)
        }
```

### 6. Improve Entity Recognition Patterns

Enhance the entity extraction patterns in `link_entities.py`:

```python
def _extract_candidate_entities(self, text: str) -> List[Tuple[str, int, int]]:
    """Extract potential entity mentions with improved patterns."""
    candidates = []

    # Enhanced patterns for better entity detection
    patterns = [
        # Existing patterns...
        (r'\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b', 3),  # Multi-word proper nouns
        (r'\b([A-Z][a-z]+)\s+(Guild|House|Order|Clan|Temple)\b', 2),  # Organizations
        (r'\b(The\s+)?([A-Z][a-z]+)\s+(Desert|Mountains|Forest|River|Sea)\b', 2),  # Places
        (r'\b([A-Z][a-z]+)\s+(the\s+)?([A-Z][a-z]+)\b', 3),  # Names and titles
    ]

    for pattern, group in patterns:
        for match in re.finditer(pattern, text):
            candidate_text = match.group(group).strip()
            if len(candidate_text) > 2:
                candidates.append((candidate_text, match.start(), match.end()))

    return candidates
```

### 7. Add Metadata Validation Pipeline

Create validation for enriched metadata:

```python
def validate_chunk_metadata(chunk_data: Dict) -> List[str]:
    """Validate that chunk has required metadata fields."""
    errors = []

    # Required fields
    required_fields = ['section_id', 'source_file', 'domain', 'domain_type', 'text']
    for field in required_fields:
        if field not in chunk_data:
            errors.append(f"Missing required field: {field}")

    # Domain validation
    if chunk_data.get('domain') not in EXPECTED_DOMAINS:
        errors.append(f"Invalid domain: {chunk_data.get('domain')}")

    # Entity validation
    if not isinstance(chunk_data.get('entities', []), list):
        errors.append("Entities field must be a list")

    # Coverage score validation
    coverage = chunk_data.get('entity_coverage_score', 0)
    if not (0 <= coverage <= 1):
        errors.append("Entity coverage score must be between 0 and 1")

    return errors
```

## Implementation Steps

### Phase 1: Quick Fixes (High Impact, Low Effort)

1. **Fix domain mapping** in `rag.xml`
2. **Add domain field** to JSONL export
3. **Enable fuzzy matching** in entity processing
4. **Test entity linking** with sample text

### Phase 2: Enhanced Metadata (Medium Impact, Medium Effort)

1. **Add content classification** to ChunkExport
2. **Implement semantic analysis** pipeline
3. **Enhance entity recognition** patterns
4. **Add metadata validation**

### Phase 3: Advanced Features (High Impact, High Effort)

1. **Implement relationship graph** extraction
2. **Add temporal/spatial indexing**
3. **Create metadata-based filtering**
4. **Build semantic similarity matching**

## Testing and Verification

### Immediate Testing

```bash
# Test domain mapping
cd backend/pipeline/ingestion
python -c "
from chunk_md import MarkdownChunker
chunker = MarkdownChunker()
result = chunker.process_markdown_file('corpus/bestiary.md')
print(f'Domain type: {result.domain_type}')
"
```

### Entity Linking Test

```python
# Test entity linking
from link_entities import EntityLinker
linker = EntityLinker()
test_text = '''
Camelot is home to many creatures like Gloomwolves.
The life energy flows through all living things.
House Pendragon controls the military forces.
'''
result = linker.link_entities_in_text(test_text, 'test_chunk')
print(f"Found {len(result.entities_found)} entities")
for entity in result.entities_found:
    print(f"  - {entity.entity_name} ({entity.entity_type})")
```

### Full Pipeline Test

```bash
# Test complete ingestion pipeline
python build_jsonl.py
```

## Expected Improvements

### After Implementation

1. **Domain matching rate**: Should improve from 0% to 80%+
2. **Entity hit rate**: Should improve from 0% to 60%+
3. **Retrieval quality**: Better domain filtering and entity boosting
4. **Metadata richness**: More comprehensive chunk descriptions
5. **System performance**: Faster and more accurate retrieval

### Quality Metrics to Monitor

- Domain match rate in evaluation results
- Entity coverage scores in meta.jsonl
- Retrieval precision and recall metrics
- Query response times and relevance

## Long-term Benefits

1. **Better retrieval accuracy** through proper domain classification
2. **Enhanced entity-based search** with working entity linking
3. **Improved semantic matching** with enriched metadata
4. **More sophisticated filtering** options for users
5. **Better evaluation metrics** alignment with expected fields

This comprehensive approach to metadata enrichment will significantly improve the RAG system's ability to understand, categorize, and retrieve relevant information from the Logres lore corpus.