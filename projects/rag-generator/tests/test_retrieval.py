#!/usr/bin/env python3
import json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

print('🔍 Testing FAISS index and basic retrieval...')
print('=' * 50)

# Load FAISS index
try:
    index = faiss.read_index('storage/store/faiss.index')
    print(f'✅ FAISS index loaded: {index.ntotal} vectors, dimension: {index.d}')
except Exception as e:
    print(f'❌ Failed to load FAISS index: {e}')
    exit(1)

# Load vectors
try:
    vectors = np.load('storage/store/vectors.npy')
    print(f'✅ Vectors loaded: {vectors.shape}')
except Exception as e:
    print(f'❌ Failed to load vectors: {e}')
    exit(1)

# Load rowmap
try:
    with open('storage/store/rowmap.json', 'r') as f:
        rowmap_data = json.load(f)
    rowmap = {item['row']: item['section_id'] for item in rowmap_data.get('rowmap', [])}
    print(f'✅ Rowmap loaded: {len(rowmap)} entries')
except Exception as e:
    print(f'❌ Failed to load rowmap: {e}')
    exit(1)

# Load metadata
try:
    with open('storage/store/meta.jsonl', 'r') as f:
        metadata = {}
        for line in f:
            if line.strip():
                chunk_data = json.loads(line.strip())
                metadata[chunk_data['section_id']] = chunk_data
    print(f'✅ Metadata loaded: {len(metadata)} entries')
except Exception as e:
    print(f'❌ Failed to load metadata: {e}')
    exit(1)

# Test embedding model
try:
    model = SentenceTransformer('Snowflake/snowflake-arctic-embed-l')
    print(f'✅ Embedding model loaded: {model.get_sentence_embedding_dimension()} dimensions')
except Exception as e:
    print(f'❌ Failed to load embedding model: {e}')
    exit(1)

# Test query
test_query = 'Tell me about Sir Ector'
print(f'\n🔍 Testing query: {test_query}')

try:
    # Generate query embedding
    query_embedding = model.encode([test_query], normalize_embeddings=True, convert_to_numpy=True)
    print(f'✅ Query embedding generated: {query_embedding.shape}')

    # Search FAISS index
    k = 5
    distances, indices = index.search(query_embedding.astype('float32'), k)
    print(f'✅ FAISS search completed: found {len(indices[0])} results')

    # Show results with content
    print(f'\n📊 Top {k} results:')
    for i, (score, idx) in enumerate(zip(distances[0], indices[0])):
        if idx != -1:  # Valid result
            section_id = rowmap.get(idx, 'unknown')
            chunk_data = metadata.get(section_id, {})

            print(f'   {i+1}. Score: {score:.3f}')
            print(f'      Section: {section_id}')
            print(f'      Domain: {chunk_data.get("domain_type", "unknown")}')
            print(f'      Source: {chunk_data.get("source_file", "unknown")}')
            print(f'      Content: {chunk_data.get("text", "")[:200]}...')
            print(f'      Entities: {len(chunk_data.get("entities", []))}')
            print()
        else:
            print(f'   {i+1}. Invalid index: {idx}')

except Exception as e:
    print(f'❌ Search failed: {e}')
    import traceback
    traceback.print_exc()