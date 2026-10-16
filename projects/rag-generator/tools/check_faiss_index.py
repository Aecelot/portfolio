#!/usr/bin/env python3
"""Check FAISS index properties and diagnose issues."""

import faiss
import numpy as np

try:
    print("🔍 Loading FAISS index...")
    index = faiss.read_index('store/faiss.index')

    print(f"✅ Index loaded successfully")
    print(f"   Type: {type(index)}")

    if hasattr(index, 'd'):
        print(f"   Dimensions: {index.d}")
    else:
        print("   ❌ No dimension attribute found")

    if hasattr(index, 'ntotal'):
        print(f"   Vectors: {index.ntotal}")
    else:
        print("   ❌ No ntotal attribute found")

    if hasattr(index, 'metric_type'):
        print(f"   Metric type: {index.metric_type}")
        if index.metric_type == faiss.METRIC_INNER_PRODUCT:
            print("   ✅ Using Inner Product metric (compatible)")
        elif index.metric_type == faiss.METRIC_L2:
            print("   ℹ️ Using L2 metric (may need conversion)")
        else:
            print(f"   ❓ Unknown metric type: {index.metric_type}")
    else:
        print("   ❌ No metric_type attribute found")

    # Check if it's a GPU or CPU index
    if hasattr(index, 'is_trained'):
        print(f"   Is trained: {index.is_trained}")
    else:
        print("   ❌ No is_trained attribute found")

    # Try to check index parameters
    try:
        if hasattr(index, 'hnsw'):
            print(f"   HNSW efSearch: {index.hnsw.efSearch}")
            print(f"   HNSW efConstruction: {index.hnsw.efConstruction}")
            print(f"   HNSW M: {index.hnsw.M}")
        elif hasattr(index, 'nlist'):
            print(f"   IVF nlist: {index.nlist}")
            if hasattr(index, 'nprobe'):
                print(f"   IVF nprobe: {index.nprobe}")
    except:
        pass

except Exception as e:
    print(f"❌ Failed to load FAISS index: {e}")
    import traceback
    traceback.print_exc()

# Check vectors file
try:
    print("\n🔍 Checking vectors file...")
    vectors = np.load('store/vectors.npy')
    print(f"✅ Vectors loaded: {vectors.shape}")
    print(f"   Data type: {vectors.dtype}")
    print(f"   Is normalized: {np.allclose(np.linalg.norm(vectors, axis=1), 1.0)}")
except Exception as e:
    print(f"❌ Failed to load vectors: {e}")

# Check rowmap
try:
    print("\n🔍 Checking rowmap...")
    import json
    with open('store/rowmap.json', 'r') as f:
        rowmap_data = json.load(f)
    print(f"✅ Rowmap loaded: {len(rowmap_data.get('rowmap', []))} entries")
except Exception as e:
    print(f"❌ Failed to load rowmap: {e}")