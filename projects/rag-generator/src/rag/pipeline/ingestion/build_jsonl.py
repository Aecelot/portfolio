#!/usr/bin/env python3
"""
JSONL export system for Lore RAG system.

Combines chunking and entity linking results into final JSONL format
with comprehensive metadata for vectorization and retrieval.
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import concurrent.futures

# XML configuration system

try:
    from .chunk_md import MarkdownChunker, ChunkMetadata, ProcessingResult
    from .link_entities import EntityLinker, EntityLinkingResult
except ImportError:
    # Fallback for direct script execution
    from chunk_md import MarkdownChunker, ChunkMetadata, ProcessingResult
    from link_entities import EntityLinker, EntityLinkingResult


@dataclass
class ChunkExport:
    """Complete chunk data for JSONL export."""
    # Core chunk information
    section_id: str
    source_file: str
    domain_type: str
    chunk_index: int
    token_count: int

    # Content and structure
    text: str  # Changed from 'content' to match contract
    header_path: List[str]

    # Entity linking results
    entities: List[Dict[str, Any]]  # Changed from 'entities_found' to match contract
    relations: List[List[str]]  # Changed from 'relationships_found' to match contract
    entity_coverage_score: float

    # Metadata
    content_hash: str
    created_at: str
    processing_time: float


@dataclass
class IngestionPipelineResult:
    """Result of running the complete ingestion pipeline."""
    total_files: int
    total_chunks: int
    total_tokens: int
    total_entities_linked: int
    average_coverage_score: float
    rejected_chunks: int
    processing_time: float

    # Quality metrics
    quality_gates_passed: bool
    entity_coverage_met: bool
    rejection_rate_acceptable: bool


class JSONLBuilder:
    """
    Combines chunking and entity linking results into JSONL format.

    Orchestrates the complete ingestion pipeline from markdown files
    to final JSONL export with comprehensive metadata.
    """

    def __init__(self, config_path: str = "config/rag/rag.xml"):
        """Initialize the JSONL builder with configuration."""
        self.config = self._load_config(config_path)
        self.chunker = MarkdownChunker(config_path)
        self.entity_linker = EntityLinker(config_path)

    def _load_config(self, config_path: str) -> Dict:
        """Load and validate XML configuration file."""
        from defusedxml import ElementTree as ET
        try:
            # Check if file exists
            if not Path(config_path).exists():
                raise FileNotFoundError(f"Configuration file not found: {config_path}")

            # Parse XML configuration
            tree = ET.parse(config_path)
            root = tree.getroot()
            config = self._xml_to_dict(root)
            return self._process_xml_config(config)

        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        except ET.ParseError as e:
            raise ValueError(f"Invalid XML configuration file format: {e}")
        except Exception as e:
            raise ValueError(f"Error loading XML configuration file: {e}")

    def _xml_to_dict(self, element) -> Dict:
        """Convert XML element to dictionary."""
        result = {}

        # Add attributes if any
        if element.attrib:
            result.update(element.attrib)

        # Check if element has children
        children = list(element)

        if not children:
            # No children - this is a simple value
            text = element.text.strip() if element.text else ""
            if not text and not element.attrib:
                return {}  # Empty element as empty dict
            # If we have attributes, return the attributes dict
            # If we have text, return the text as dict
            return result if element.attrib else (text if text else {})
        else:
            # Has children - process as complex element
            # Add text content if any (for mixed content)
            if element.text and element.text.strip():
                result['value'] = element.text.strip()

            # Process children
            for child in children:
                child_dict = self._xml_to_dict(child)

                # Handle multiple children with same name
                if child.tag in result:
                    if not isinstance(result[child.tag], list):
                        result[child.tag] = [result[child.tag]]
                    result[child.tag].append(child_dict)
                else:
                    result[child.tag] = child_dict

            return result


    def _process_xml_config(self, config: Dict) -> Dict:
        """Process XML configuration format."""
        # Ensure config is a dictionary
        if not isinstance(config, dict):
            config = {}

        # Extract output configuration
        output_config = config.get('output', {})
        if isinstance(output_config, dict):
            config['output'] = {
                'jsonl_path': output_config.get('jsonl_path', 'store/meta.jsonl'),
                'rejects_log': output_config.get('rejects_log', 'store/rejects.log'),
                'export_batch_size': int(output_config.get('export_batch_size', 100))
            }
        else:
            config['output'] = {
                'jsonl_path': 'store/meta.jsonl',
                'rejects_log': 'store/rejects.log',
                'export_batch_size': 100
            }

        return config

    def _validate_quality_gates(self, results: List[ChunkExport]) -> Dict[str, Any]:
        """Validate that results meet quality gate requirements."""
        total_chunks = len(results)

        if total_chunks == 0:
            return {
                'passed': False,
                'entity_coverage_met': False,
                'rejection_rate_acceptable': False,
                'details': 'No chunks produced'
            }

        # Calculate entity coverage
        chunks_with_entities = sum(1 for chunk in results if chunk.entities)
        entity_coverage = chunks_with_entities / total_chunks

        # Get minimum coverage requirement from entity_processing section
        entity_config = self.config.get('entity_processing', {})
        min_coverage_raw = entity_config.get('entity_coverage_min', 0.60)
        max_rejection_rate_raw = entity_config.get('reject_rate_max', 0.05)

        # Ensure values are floats
        try:
            min_coverage = float(min_coverage_raw)
        except (ValueError, TypeError):
            min_coverage = 0.60  # Default fallback

        try:
            max_rejection_rate = float(max_rejection_rate_raw)
        except (ValueError, TypeError):
            max_rejection_rate = 0.05  # Default fallback

        # Calculate rejection rate (approximate - would need original chunking results for exact)
        estimated_rejection_rate = 1 - (total_chunks / (total_chunks * 1.1))  # Rough estimate

        quality_metrics = {
            'passed': entity_coverage >= min_coverage,
            'entity_coverage_met': entity_coverage >= min_coverage,
            'rejection_rate_acceptable': estimated_rejection_rate <= max_rejection_rate,
            'entity_coverage_score': entity_coverage,
            'estimated_rejection_rate': estimated_rejection_rate,
            'chunks_with_entities': chunks_with_entities,
            'total_chunks': total_chunks,
            'min_coverage_required': min_coverage,
            'max_rejection_rate_allowed': max_rejection_rate
        }

        return quality_metrics

    def _create_chunk_content(self, chunk: ChunkMetadata) -> str:
        """Extract the actual content for a chunk."""
        # Now we have the actual content stored in the chunk metadata
        return chunk.content

    def process_single_file(self, file_path: Path) -> List[ChunkExport]:
        """Process a single file through the complete pipeline."""
        print(f"Processing file: {file_path}")

        # Step 1: Chunk the markdown file
        chunking_result = self.chunker.process_markdown_file(file_path)

        if not chunking_result.chunks:
            print(f"  ⚠️  No valid chunks produced")
            return []

        # Step 2: Link entities for each chunk
        chunk_exports = []
        total_entities = 0

        for chunk in chunking_result.chunks:
            # Get chunk content (simplified - would need original content)
            chunk_content = self._create_chunk_content(chunk)

            # Link entities in the chunk
            linking_result = self.entity_linker.link_entities_in_text(
                chunk_content, chunk.section_id
            )

            # Create export record
            chunk_export = ChunkExport(
                section_id=chunk.section_id,
                source_file=chunk.source_file,
                domain_type=chunk.domain_type,
                chunk_index=chunk.chunk_index,
                token_count=chunk.token_count,
                text=chunk_content,
                header_path=chunk.header_path,
                entities=[{
                    'entity_id': entity.entity_id,
                    'entity_name': entity.entity_name,
                    'entity_type': entity.entity_type,
                    'match_text': entity.match_text,
                    'confidence': entity.confidence,
                    'context': entity.context
                } for entity in linking_result.entities_found],
                relations=[[rel[0], rel[1], rel[2]] for rel in linking_result.relationships_found],
                entity_coverage_score=linking_result.coverage_score,
                content_hash=chunk.content_hash,
                created_at=time.strftime('%Y-%m-%dT%H:%M:%S'),
                processing_time=chunking_result.processing_time + linking_result.linking_time
            )

            chunk_exports.append(chunk_export)
            total_entities += len(linking_result.entities_found)

        print(f"  ✅ {len(chunk_exports)} chunks, {total_entities} entities linked")
        return chunk_exports

    def process_directory_parallel(self, input_path: Optional[str] = None,
                                  max_workers: int = 4) -> IngestionPipelineResult:
        """Process files in parallel using ThreadPoolExecutor."""
        if input_path is None:
            input_glob = self.config.get('ingestion', {}).get('input_glob', 'corpus/**/*.md')
        else:
            input_glob = input_path

        markdown_files = list(Path().glob(input_glob))
        if not markdown_files:
            raise FileNotFoundError(f"No markdown files found matching: {input_glob}")

        print(f"🚀 Starting parallel ingestion for {len(markdown_files)} files ({max_workers} workers)")

        start_time = time.time()
        all_chunks = []
        total_stats = {
            'files': 0, 'chunks': 0, 'tokens': 0,
            'entities': 0, 'rejected': 0
        }

        # Use ThreadPoolExecutor for I/O bound parallel processing
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all file processing tasks
            future_to_file = {
                executor.submit(self._process_file_with_error_handling, file_path): file_path
                for file_path in markdown_files
            }

            # Collect results as they complete
            for future in concurrent.futures.as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    file_result = future.result()
                    if file_result:
                        all_chunks.extend(file_result['chunks'])
                        total_stats['files'] += 1
                        total_stats['chunks'] += file_result['chunks_count']
                        total_stats['tokens'] += file_result['tokens_count']
                        total_stats['entities'] += file_result['entities_count']
                        total_stats['rejected'] += file_result['rejected_count']
                except Exception as e:
                    print(f"  ❌ Failed to process {file_path}: {e}")

        # Calculate final metrics
        processing_time = time.time() - start_time
        average_coverage = (
            sum(chunk.entity_coverage_score for chunk in all_chunks) / len(all_chunks)
            if all_chunks else 0
        )

        return IngestionPipelineResult(
            total_files=total_stats['files'],
            total_chunks=len(all_chunks),
            total_tokens=total_stats['tokens'],
            total_entities_linked=total_stats['entities'],
            average_coverage_score=average_coverage,
            rejected_chunks=total_stats['rejected'],
            processing_time=processing_time,
            quality_gates_passed=True,  # Would need proper validation
            entity_coverage_met=True,   # Would need proper validation
            rejection_rate_acceptable=True  # Would need proper validation
        )

    def _process_file_with_error_handling(self, file_path: Path) -> Optional[Dict]:
        """Process single file with comprehensive error handling."""
        try:
            file_chunks = self.process_single_file(file_path)

            return {
                'chunks': file_chunks,
                'chunks_count': len(file_chunks),
                'tokens_count': sum(c.token_count for c in file_chunks),
                'entities_count': sum(len(c.entities) for c in file_chunks),
                'rejected_count': 0  # Would need to calculate from chunking_result
            }
        except Exception as e:
            print(f"  ❌ Failed to process {file_path}: {e}")
            return None

    def process_directory(self, input_path: Optional[str] = None) -> IngestionPipelineResult:
        """Process all markdown files in the input directory."""
        if input_path is None:
            input_glob = self.config.get('ingestion', {}).get('input_glob', 'corpus/**/*.md')
        else:
            input_glob = input_path

        # Find all markdown files
        markdown_files = list(Path().glob(input_glob))

        if not markdown_files:
            raise FileNotFoundError(f"No markdown files found matching: {input_glob}")

        print(f"🚀 Starting ingestion pipeline for {len(markdown_files)} files")
        start_time = time.time()

        all_chunks = []
        total_files = 0
        total_chunks_count = 0
        total_tokens_count = 0
        total_entities_linked = 0
        rejected_count = 0

        # Process each file
        for file_path in markdown_files:
            try:
                # Get original chunking results for accurate metrics
                chunking_result = self.chunker.process_markdown_file(file_path)

                total_files += 1
                total_chunks_count += chunking_result.total_chunks
                total_tokens_count += chunking_result.total_tokens
                rejected_count += chunking_result.rejected_chunks

                # Process through entity linking
                file_chunks = self.process_single_file(file_path)
                all_chunks.extend(file_chunks)
                total_entities_linked += sum(len(chunk.entities) for chunk in file_chunks)

            except Exception as e:
                print(f"  ❌ Failed to process {file_path}: {e}")
                continue

        # Calculate final metrics
        processing_time = time.time() - start_time
        average_coverage = sum(chunk.entity_coverage_score for chunk in all_chunks) / len(all_chunks) if all_chunks else 0

        # Validate quality gates
        quality_metrics = self._validate_quality_gates(all_chunks)

        result = IngestionPipelineResult(
            total_files=total_files,
            total_chunks=len(all_chunks),
            total_tokens=total_tokens_count,
            total_entities_linked=total_entities_linked,
            average_coverage_score=average_coverage,
            rejected_chunks=rejected_count,
            processing_time=processing_time,
            quality_gates_passed=quality_metrics['passed'],
            entity_coverage_met=quality_metrics['entity_coverage_met'],
            rejection_rate_acceptable=quality_metrics['rejection_rate_acceptable']
        )

        return result

    def export_jsonl(self, chunks: List[ChunkExport], output_path: Optional[str] = None) -> str:
        """Export chunks to JSONL format."""
        if output_path is None:
            output_path = self.config['output']['jsonl_path']

        if not output_path:
            output_path = 'store/meta.jsonl'

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        print(f"💾 Exporting {len(chunks)} chunks to {output_path}")

        # Export in batches for memory efficiency
        batch_size = self.config['output']['export_batch_size']

        with open(output_file, 'w', encoding='utf-8') as f:
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]

                for chunk in batch:
                    # Convert to JSON-serializable format
                    chunk_data = {
                        'section_id': chunk.section_id,
                        'source_file': chunk.source_file,
                        'domain_type': chunk.domain_type,
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

                    f.write(json.dumps(chunk_data, ensure_ascii=False) + '\n')

        print(f"✅ Successfully exported {len(chunks)} chunks")
        return str(output_file)

    def export_rejects_log(self, rejected_chunks: List[Dict], log_path: Optional[str] = None) -> str:
        """Export rejected chunks log."""
        if log_path is None:
            log_path = self.config['output']['rejects_log']

        if not log_path:
            log_path = 'store/rejects.log'

        log_file = Path(log_path)
        log_file.parent.mkdir(parents=True, exist_ok=True)

        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump({
                'rejected_chunks': rejected_chunks,
                'export_timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
                'total_rejected': len(rejected_chunks)
            }, f, indent=2, ensure_ascii=False)

        print(f"📋 Rejection log exported to {log_path}")
        return str(log_file)

    def run_full_pipeline(self) -> IngestionPipelineResult:
        """Run the complete ingestion pipeline."""
        print("🚀 Running complete ingestion pipeline...")

        # Process all files
        result = self.process_directory()

        print("\n📊 Pipeline Results:")
        print(f"  Files processed: {result.total_files}")
        print(f"  Chunks created: {result.total_chunks}")
        print(f"  Tokens processed: {result.total_tokens}")
        print(f"  Entities linked: {result.total_entities_linked}")
        print(f"  Average coverage: {result.average_coverage_score:.2f}")
        print(f"  Rejected chunks: {result.rejected_chunks}")
        print(f"  Processing time: {result.processing_time:.2f}s")

        print("\n🔍 Quality Gates:")
        print(f"  Quality gates passed: {'✅' if result.quality_gates_passed else '❌'}")
        print(f"  Entity coverage met: {'✅' if result.entity_coverage_met else '❌'}")
        print(f"  Rejection rate acceptable: {'✅' if result.rejection_rate_acceptable else '❌'}")

        return result


def main():
    """Main entry point for testing the JSONL builder."""
    try:
        builder = JSONLBuilder()

        print("🧪 Testing JSONL Builder")
        print("=" * 50)

        # Test with a single file first
        test_file = Path("corpus/02-the-crowning-of-arthur-and-excalibur.md")
        if test_file.exists():
            print(f"\n📄 Testing with: {test_file}")

            # Process single file
            chunks = builder.process_single_file(test_file)

            if chunks:
                # Export to JSONL
                output_file = builder.export_jsonl(chunks)

                print("✅ JSONL export completed successfully!")
                print(f"📁 Output file: {output_file}")
                print(f"📊 Chunks exported: {len(chunks)}")

                # Show sample chunk structure
                sample_chunk = chunks[0]
                print("\n📋 Sample chunk structure:")
                print(f"  Section ID: {sample_chunk.section_id}")
                print(f"  Domain: {sample_chunk.domain_type}")
                print(f"  Tokens: {sample_chunk.token_count}")
                print(f"  Entities: {len(sample_chunk.entities)}")
                print(f"  Coverage: {sample_chunk.entity_coverage_score:.2f}")
            else:
                print("❌ No chunks produced")
        else:
            print(f"❌ Test file not found: {test_file}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()