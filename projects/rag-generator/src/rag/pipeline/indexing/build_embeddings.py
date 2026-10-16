#!/usr/bin/env python3
"""
Embedding generation for Lore RAG system.

Generates BAAI/bge-base-en embeddings for text chunks with L2 normalization
and deterministic row mapping for vector index alignment.
"""

import json
import time
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
import tempfile
import gc

import numpy as np
from sentence_transformers import SentenceTransformer

try:
    from ingestion.chunk_md import ChunkMetadata
except ImportError:
    # For standalone execution
    ChunkMetadata = None


class EmbeddingBuilder:
    """
    Generates embeddings for text chunks using BAAI/bge-base-en.

    Handles batch processing, L2 normalization, and deterministic
    row mapping for vector index alignment.
    """

    def __init__(self, config_path: str = "config/rag/rag.xml"):
        """Initialize the embedding builder with configuration."""
        self.config = self._load_config(config_path)
        self.model_name = self.config['vectorization']['embedding_model'].get('value', 'BAAI/bge-base-en')
        self.batch_size = self.config['vectorization']['batch_size']
        self.normalize = self.config['vectorization']['normalize_embeddings']

        # Initialize the embedding model
        print(f"🔄 Loading embedding model: {self.model_name}")
        self.model = SentenceTransformer(self.model_name)
        print(f"✅ Model loaded (dim: {self.model.get_sentence_embedding_dimension()})")

    def _load_config(self, config_path: str) -> Dict:
        """Load and validate configuration file."""
        try:
            import xml.etree.ElementTree as ET

            # Parse XML file
            tree = ET.parse(config_path)
            root = tree.getroot()

            # Convert XML to dictionary
            def xml_to_dict(element):
                result = {}

                # Add attributes if any
                if element.attrib:
                    result.update(element.attrib)

                # Add text content if any (for mixed content)
                if element.text and element.text.strip():
                    result['value'] = element.text.strip()

                # Process children
                for child in element:
                    child_dict = xml_to_dict(child)

                    # Handle multiple children with same name
                    if child.tag in result:
                        if not isinstance(result[child.tag], list):
                            result[child.tag] = [result[child.tag]]
                        result[child.tag].append(child_dict)
                    else:
                        result[child.tag] = child_dict

                return result

            config = xml_to_dict(root)

            # Extract embedding parameters with defaults
            embedding_config = config.get('embedding', {})
            config['vectorization'] = {
                'embedding_model': embedding_config.get('model', 'BAAI/bge-base-en'),
                'normalize_embeddings': embedding_config.get('normalize_embeddings', {}).get('value', 'true').lower() == 'true',
                'batch_size': int(embedding_config.get('batch_size', {}).get('value', 64))
            }

            return config

        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        except Exception as e:
            raise ValueError(f"Error loading configuration file: {e}")

    def _compute_file_hash(self, file_path: str) -> str:
        """Compute SHA-256 hash of a file for change detection."""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception:
            # Fallback for non-existent files
            return "unknown"

    def _validate_jsonl_integrity(self, jsonl_path: str) -> Tuple[bool, str]:
        """Validate JSONL file integrity before processing."""
        line_num = 0
        try:
            with open(jsonl_path, 'r', encoding='utf-8') as f:
                # Check first few lines for valid JSON
                for line_num, line in enumerate(f):
                    if line_num >= 5:  # Check first 5 lines
                        break
                    if line.strip():
                        json.loads(line.strip())

            return True, ""

        except json.JSONDecodeError as e:
            return False, f"Invalid JSON in line {line_num+1}: {e}"
        except Exception as e:
            return False, f"Error reading file: {e}"

    def _extract_texts_and_metadata(self, jsonl_path: str) -> Tuple[List[str], List[Dict], str]:
        """Extract texts and metadata from JSONL file."""
        texts = []
        metadata_list = []
        file_hash = self._compute_file_hash(jsonl_path)

        print(f"📖 Reading chunks from {jsonl_path}")

        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if not line.strip():
                    continue

                try:
                    chunk_data = json.loads(line.strip())

                    # Extract text content
                    text = chunk_data.get('text', '')
                    if not text.strip():
                        print(f"⚠️  Empty text in chunk {i+1}, skipping")
                        continue

                    texts.append(text)
                    metadata_list.append({
                        'row': i,
                        'section_id': chunk_data.get('section_id', f'unknown_{i}'),
                        'doc_id': chunk_data.get('doc_id', ''),
                        'domain': chunk_data.get('domain', ''),
                        'token_count': chunk_data.get('token_count', 0)
                    })

                except json.JSONDecodeError as e:
                    print(f"⚠️  Invalid JSON in line {i+1}: {e}")
                    continue
                except Exception as e:
                    print(f"⚠️  Error processing line {i+1}: {e}")
                    continue

        print(f"✅ Extracted {len(texts)} texts from {len(metadata_list)} chunks")
        return texts, metadata_list, file_hash

    def _generate_embeddings_optimized(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings with adaptive batching and memory optimization."""
        if not texts:
            raise ValueError("No texts provided for embedding generation")

        print(f"🧠 Generating embeddings for {len(texts)} chunks with adaptive batching")

        # Adaptive batch sizing based on available memory and text length
        optimal_batch_size = self._calculate_optimal_batch_size(texts)
        model_dim = self.model.get_sentence_embedding_dimension()

        start_time = time.time()

        try:
            # Pre-allocate output array for better memory efficiency
            estimated_memory_mb = (len(texts) * model_dim * 4) / (1024 * 1024)  # float32 = 4 bytes
            print(f"📊 Estimated memory usage: {estimated_memory_mb:.1f} MB")

            # Use memory-mapped array for large datasets
            if estimated_memory_mb > 1000:  # > 1GB
                print("💾 Using memory-mapped array for large dataset")
                temp_file = tempfile.NamedTemporaryFile(delete=False)
                embeddings = np.memmap(
                    temp_file.name,
                    dtype='float32',
                    mode='w+',
                    shape=(len(texts), model_dim)
                )
            else:
                embeddings = np.empty((len(texts), model_dim), dtype=np.float32)

            # Process in optimized batches
            for i in range(0, len(texts), optimal_batch_size):
                end_idx = min(i + optimal_batch_size, len(texts))
                batch_texts = texts[i:end_idx]

                print(f"  🔄 Processing batch {i//optimal_batch_size + 1}/{(len(texts)-1)//optimal_batch_size + 1} "
                      f"({len(batch_texts)} texts)")

                # Generate batch embeddings with optimized settings
                batch_embeddings = self.model.encode(
                    batch_texts,
                    batch_size=min(optimal_batch_size, 32),  # Sub-batch for model efficiency
                    normalize_embeddings=self.normalize,
                    convert_to_numpy=True,
                    show_progress_bar=False  # Disable for batch processing
                )

                # Store in pre-allocated array
                embeddings[i:end_idx] = batch_embeddings.astype(np.float32)

                # Force garbage collection for large batches
                if end_idx - i >= 1000:
                    gc.collect()

            # Apply normalization if not done by model
            if not self.normalize:
                print("🧮 Applying L2 normalization...")
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                norms[norms == 0] = 1  # Avoid division by zero
                embeddings = embeddings / norms

            processing_time = time.time() - start_time

            # Validate results
            self._validate_embeddings(embeddings, model_dim)

            print(f"✅ Generated embeddings: shape {embeddings.shape}")
            print(f"⏱️  Processing time: {processing_time:.2f}s")
            print(f"📊 Throughput: {len(texts) / processing_time:.0f} texts/second")

            return np.array(embeddings)  # Convert from memmap if necessary

        except MemoryError:
            print("💾 Memory error - falling back to chunked processing")
            return self._generate_embeddings_chunked(texts, chunk_size=100)
        except Exception as e:
            raise RuntimeError(f"Failed to generate embeddings: {e}")

    def _calculate_optimal_batch_size(self, texts: List[str]) -> int:
        """Calculate optimal batch size based on memory and text characteristics."""
        # Base batch size from config
        base_batch_size = self.batch_size

        # Adjust based on average text length
        if texts:
            avg_length = sum(len(text) for text in texts) / len(texts)
            if avg_length > 1000:  # Long texts
                batch_size = max(8, base_batch_size // 2)
            elif avg_length < 200:  # Short texts
                batch_size = min(128, base_batch_size * 2)
            else:
                batch_size = base_batch_size
        else:
            batch_size = base_batch_size

        # Consider available memory
        try:
            import psutil
            available_memory_gb = psutil.virtual_memory().available / (1024**3)
            if available_memory_gb < 2:  # Low memory system
                batch_size = max(4, batch_size // 4)
            elif available_memory_gb > 8:  # High memory system
                batch_size = min(256, batch_size * 2)
        except ImportError:
            pass  # Use default if psutil not available

        return max(1, batch_size)

    def _validate_embeddings(self, embeddings: np.ndarray, expected_dim: int):
        """Fast validation of embedding results."""
        if embeddings.shape[1] != expected_dim:
            raise ValueError(f"Expected {expected_dim} dimensions, got {embeddings.shape[1]}")

        if self.normalize:
            norms = np.linalg.norm(embeddings, axis=1)
            mean_norm = np.mean(norms)
            if not np.allclose(mean_norm, 1.0, atol=1e-2):
                print(f"⚠️  Warning: Mean L2 norm is {mean_norm:.4f}, expected ~1.0")

    def _generate_embeddings_chunked(self, texts: List[str], chunk_size: int = 100) -> np.ndarray:
        """Fallback chunked processing for memory issues."""
        print(f"🔄 Processing {len(texts)} texts in chunks of {chunk_size}")

        all_embeddings = []
        for i in range(0, len(texts), chunk_size):
            chunk_texts = texts[i:i + chunk_size]
            chunk_embeddings = self.model.encode(
                chunk_texts,
                batch_size=min(self.batch_size, 16),
                normalize_embeddings=self.normalize,
                convert_to_numpy=True,
                show_progress_bar=True
            )
            all_embeddings.append(chunk_embeddings)

            # Clear memory
            if len(all_embeddings) % 10 == 0:
                gc.collect()

        return np.vstack(all_embeddings)

    def _generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for text chunks (legacy method - delegates to optimized version)."""
        return self._generate_embeddings_optimized(texts)

    def _save_embeddings(self, embeddings: np.ndarray, output_path: Path) -> str:
        """Save embeddings to disk."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        print(f"💾 Saving embeddings to {output_path}")
        np.save(str(output_path), embeddings.astype(np.float32))

        return str(output_path)

    def _save_rowmap(self, metadata_list: List[Dict], output_path: Path, file_hash: str) -> str:
        """Save row mapping for vector-to-metadata alignment."""
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Create rowmap with integrity information
        rowmap_data = {
            'rowmap': metadata_list,
            'file_hash': file_hash,
            'total_chunks': len(metadata_list),
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'model': self.model_name,
            'normalize': self.normalize
        }

        print(f"🗺️  Saving rowmap to {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(rowmap_data, f, indent=2, ensure_ascii=False)

        return str(output_path)

    def build_embeddings(self, jsonl_path: Optional[str] = None, output_dir: str = "store") -> Dict[str, Any]:
        """
        Build embeddings from JSONL chunk file.

        Args:
            jsonl_path: Path to input JSONL file (default: store/meta.jsonl)
            output_dir: Output directory for embeddings and rowmap

        Returns:
            Dictionary with build statistics and file paths
        """
        if jsonl_path is None:
            jsonl_path_raw = self.config.get('ingestion', {}).get('output_jsonl', 'store/meta.jsonl')
            jsonl_path = jsonl_path_raw.get('value', 'store/meta.jsonl') if isinstance(jsonl_path_raw, dict) else jsonl_path_raw

        jsonl_path = str(jsonl_path)  # Ensure it's a string

        output_dir_path = Path(output_dir)
        vectors_path = output_dir_path / "vectors.npy"
        rowmap_path = output_dir_path / "rowmap.json"

        start_time = time.time()

        # Step 1: Validate input file
        print(f"🔍 Validating input file: {jsonl_path}")
        is_valid, error_msg = self._validate_jsonl_integrity(jsonl_path)
        if not is_valid:
            raise ValueError(f"Input validation failed: {error_msg}")

        # Step 2: Extract texts and metadata
        texts, metadata_list, file_hash = self._extract_texts_and_metadata(jsonl_path)

        if not texts:
            raise ValueError("No valid texts found in input file")

        # Step 3: Generate embeddings
        embeddings = self._generate_embeddings(texts)

        # Step 4: Save results
        vectors_file = self._save_embeddings(embeddings, vectors_path)
        rowmap_file = self._save_rowmap(metadata_list, rowmap_path, file_hash)

        total_time = time.time() - start_time

        # Build result statistics
        result = {
            'success': True,
            'vectors_file': vectors_file,
            'rowmap_file': rowmap_file,
            'file_hash': file_hash,
            'total_chunks': len(texts),
            'embedding_dim': embeddings.shape[1],
            'total_tokens': sum(meta['token_count'] for meta in metadata_list),
            'processing_time': total_time,
            'model': self.model_name,
            'normalized': self.normalize
        }

        print("\n📊 Build Summary:")
        print(f"  Vectors file: {vectors_file}")
        print(f"  Rowmap file: {rowmap_file}")
        print(f"  Chunks processed: {result['total_chunks']}")
        print(f"  Embedding dimensions: {result['embedding_dim']}")
        print(f"  Total tokens: {result['total_tokens']}")
        print(f"  Processing time: {total_time:.2f}s")

        return result


def main():
    """Main entry point for testing the embedding builder."""
    try:
        builder = EmbeddingBuilder()

        print("🧪 Testing Embedding Builder")
        print("=" * 50)

        # Test with existing JSONL file
        jsonl_file = Path("storage/store/meta.jsonl")
        if jsonl_file.exists():
            print(f"\n📄 Building embeddings from: {jsonl_file}")

            result = builder.build_embeddings()

            if result['success']:
                print("✅ Embedding generation completed successfully!")

                # Validate output files exist
                vectors_file = Path(result['vectors_file'])
                rowmap_file = Path(result['rowmap_file'])

                if vectors_file.exists() and rowmap_file.exists():
                    print("✅ Output files created:")
                    print(f"  Vectors: {vectors_file} ({vectors_file.stat().st_size:,} bytes)")
                    print(f"  Rowmap: {rowmap_file}")
                else:
                    print("❌ Output files not found")
            else:
                print("❌ Embedding generation failed")
        else:
            print(f"❌ JSONL file not found: {jsonl_file}")
            print("Run 'make ingest' first to generate chunk data")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()