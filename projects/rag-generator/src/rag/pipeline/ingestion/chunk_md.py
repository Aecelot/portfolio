#!/usr/bin/env python3
"""
Markdown processing and chunking for Lore RAG system.

Converts markdown files to structured chunks with metadata extraction.
Handles H3-based section chunking with configurable token boundaries.
"""

import hashlib
import os
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from defusedxml import ElementTree as ET
from xml.etree.ElementTree import Element  # types only; parsing stays on defusedxml
from bs4 import BeautifulSoup, Tag
from markdown_it import MarkdownIt

# XML configuration system


@dataclass
class ChunkMetadata:
    """Metadata for a processed text chunk."""
    section_id: str
    source_file: str
    domain_type: str
    chunk_index: int
    start_line: int
    end_line: int
    token_count: int
    has_entities: bool
    header_path: List[str]  # Hierarchical headers (h1 -> h2 -> h3)
    content_hash: str
    content: str  # Actual chunk content (previously missing!)


@dataclass
class ProcessingResult:
    """Result of processing a markdown file."""
    source_file: str
    total_chunks: int
    total_tokens: int
    domain_type: str
    chunks: List[ChunkMetadata]
    rejected_chunks: int
    processing_time: float


class MarkdownChunker:
    """
    Core markdown processing engine.

    Handles markdown parsing, section-based chunking, and metadata extraction
    following the ingestion pipeline specifications.
    """

    def __init__(self, config_path: str = "config/rag.xml"):
        """Initialize the chunker with configuration."""
        self.config = self._load_config(config_path)
        self.md_parser = MarkdownIt()

        # Token boundary configuration
        self.token_target = self.config['chunking']['token_target']
        self.token_min = self.config['chunking']['token_min']
        self.token_max = self.config['chunking']['token_max']
        self.overlap_pct = self.config['chunking']['overlap_pct']

    def _load_config(self, config_path: str) -> Dict:
        """Load and validate XML configuration file."""
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


    def _process_xml_config(self, config: Dict) -> Dict:
        """Process XML configuration format."""
        # Special handling for domains structure
        if 'domains' in config:
            domains_data = config['domains']
            if isinstance(domains_data, dict) and 'domain' in domains_data:
                # Flatten the nested domain structure
                domain_list = domains_data['domain']
                if isinstance(domain_list, list):
                    domains_dict = {}
                    for domain_item in domain_list:
                        if isinstance(domain_item, dict) and 'name' in domain_item:
                            domain_name = domain_item['name']
                            domains_dict[domain_name] = domain_item
                    config['domains'] = domains_dict

        # Extract chunking parameters with defaults
        chunking_config = config.get('chunking', {})
        config['chunking'] = {
            'token_target': int(chunking_config.get('token_target', 320)),
            'token_min': int(chunking_config.get('token_min', 120)),
            'token_max': int(chunking_config.get('token_max', 450)),
            'overlap_pct': float(chunking_config.get('overlap_pct', 0.15))
        }

        # Extract domains for domain type determination
        domains_config = config.get('domains', {})
        if isinstance(domains_config, dict):
            config['domains'] = domains_config
        else:
            config['domains'] = {}

        return config

    def _xml_to_dict(self, element: Element) -> Dict:
        """Convert XML element to dictionary."""
        def xml_element_to_dict(elem: Element) -> Any:
            # If element has no children and no attributes, treat as simple value
            if len(list(elem)) == 0 and not elem.attrib:
                text = elem.text.strip() if elem.text else ""
                # Try to convert to appropriate type
                if text.lower() in ('true', 'false'):
                    return text.lower() == 'true'
                elif text.isdigit():
                    return int(text)
                elif text.replace('.', '', 1).isdigit():
                    return float(text)
                else:
                    return text

            # Element has children - create dictionary
            result = {}

            # Add attributes if any
            if elem.attrib:
                result.update(elem.attrib)

            # Add text content if any (for mixed content)
            if elem.text and elem.text.strip():
                if not result:  # If no attributes or children yet
                    return elem.text.strip()

            # Process children
            for child in elem:
                child_dict = xml_element_to_dict(child)

                # Handle multiple children with same name
                if child.tag in result:
                    if not isinstance(result[child.tag], list):
                        result[child.tag] = [result[child.tag]]
                    result[child.tag].append(child_dict)
                else:
                    result[child.tag] = child_dict

            return result

        return xml_element_to_dict(element)

    def _determine_domain_type(self, file_path: Path) -> str:
        """Determine domain type based on file path patterns."""
        path_str = str(file_path)

        for domain, config in self.config.get('domains', {}).items():
            path_glob = config.get('path_glob', '')
            if Path(path_glob).match(path_str) or path_glob in path_str:
                return config.get('type', domain)

        return 'general_lore'

    def _extract_front_matter(self, content: str) -> Tuple[Dict, str]:
        """Extract structured front matter if present."""
        front_matter = {}
        body_content = content

        # Check for front matter (--- delimited)
        lines = content.split('\n')
        if len(lines) >= 2 and lines[0].strip() == '---':
            # Find closing ---
            front_matter_end = -1
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == '---':
                    front_matter_end = i
                    break

            if front_matter_end > 0:
                try:
                    # For now, skip front matter parsing
                    # In a full implementation, you'd need to parse structured front matter separately
                    front_matter = {}
                    body_content = '\n'.join(lines[front_matter_end + 1:])
                except Exception:
                    # Invalid front matter, treat as regular content
                    pass

        return front_matter, body_content

    def _parse_markdown_to_html(self, content: str) -> BeautifulSoup:
        """Convert markdown content to HTML with structure preservation."""
        # Convert markdown to HTML
        html_content = self.md_parser.render(content)

        # Parse with BeautifulSoup for structure analysis
        soup = BeautifulSoup(html_content, 'html.parser')

        return soup

    def _extract_header_hierarchy(self, soup: BeautifulSoup) -> List[Tag]:
        """Extract all headers (h1, h2, h3) maintaining hierarchy."""
        headers = []

        # Find all h1, h2, h3 tags
        for header in soup.find_all(['h1', 'h2', 'h3']):
            headers.append(header)

        return headers

    def _build_header_path(self, target_header: Tag, all_headers: List[Tag]) -> List[str]:
        """Build hierarchical path from root headers to target header."""
        header_path = []
        current_level = 0
        target_level = int(target_header.name[1])  # h1 -> 1, h2 -> 2, etc.

        # Work backwards through headers to build path
        for header in reversed(all_headers):
            if header == target_header:
                header_path.insert(0, header.get_text().strip())
                break

            header_level = int(header.name[1])
            if header_level < target_level and header_level > current_level:
                header_path.insert(0, header.get_text().strip())
                current_level = header_level

        return header_path

    def _extract_section_content(self, start_header: Tag, end_header: Optional[Tag] = None) -> str:
        """Extract content between two headers or from header to end."""
        content_parts = []

        # Start from the header
        current = start_header

        while current:
            # Stop if we hit the end header
            if end_header and current == end_header:
                break

            # Add content based on element type
            if current.name in ['h1', 'h2', 'h3']:
                # Add header text
                content_parts.append(current.get_text().strip())
            elif current.name == 'p':
                # Add paragraph text
                content_parts.append(current.get_text().strip())
            elif current.name in ['ul', 'ol']:
                # Add list content
                for li in current.find_all('li'):
                    content_parts.append(f"• {li.get_text().strip()}")
            elif current.name == 'table':
                # Add table content as structured text
                table_text = self._extract_table_content(current)
                if table_text:
                    content_parts.append(table_text)

            # Move to next element
            current = self._next_meaningful_element(current)

            # Stop if we hit another header of same or higher level
            if (current and current.name in ['h1', 'h2', 'h3'] and
                end_header is None):
                current_level = int(current.name[1])  # h1 -> 1, h2 -> 2, etc.
                start_level = int(start_header.name[1])
                if current_level <= start_level:  # Same or higher level
                    break

        return '\n\n'.join(content_parts)

    def _extract_table_content(self, table: Tag) -> str:
        """Extract table content as readable text."""
        rows = []
        for row in table.find_all('tr'):
            cells = [cell.get_text().strip() for cell in row.find_all(['th', 'td'])]
            if cells:
                rows.append(' | '.join(cells))

        return '\n'.join(rows)

    def _next_meaningful_element(self, element: Tag) -> Optional[Tag]:
        """Find next element with meaningful content."""
        current = element.find_next()

        while current:
            # Skip empty elements and navigation
            if (current.name in ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'table', 'blockquote'] and
                current.get_text().strip()):
                return current
            current = current.find_next()

        return None

    def _count_tokens(self, text: str) -> int:
        """Count tokens in text (approximate using tiktoken if available)."""
        try:
            import tiktoken
            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except ImportError:
            # Fallback: rough approximation (1 token ≈ 4 characters)
            return len(text) // 4

    def _calculate_overlap_tokens(self, chunk_tokens: int) -> int:
        """Calculate overlap tokens based on chunk size and overlap percentage."""
        return max(10, int(chunk_tokens * self.overlap_pct))

    def _generate_section_id(self, source_file: str, header_path: List[str],
                           chunk_index: int) -> str:
        """Generate deterministic section ID for chunk."""
        # Create deterministic string from components
        id_components = [source_file] + header_path + [str(chunk_index)]
        id_string = '|'.join(id_components)

        # Generate hash for deterministic ID
        hash_obj = hashlib.md5(id_string.encode('utf-8'))
        return hash_obj.hexdigest()[:16]

    def _validate_input_file(self, file_path: Path) -> Tuple[bool, str]:
        """Validate input file before processing."""
        # Check if file exists
        if not file_path.exists():
            return False, f"File does not exist: {file_path}"

        # Check if it's actually a file (not a directory)
        if not file_path.is_file():
            return False, f"Path is not a file: {file_path}"

        # Check file size (max 10MB to prevent memory issues)
        max_size = 10 * 1024 * 1024  # 10MB
        file_size = file_path.stat().st_size
        if file_size > max_size:
            return False, f"File too large ({file_size} bytes > {max_size} bytes): {file_path}"

        # Check file extension
        if file_path.suffix.lower() != '.md':
            return False, f"Invalid file type (expected .md): {file_path}"

        # Check if file is readable
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Try to read first few bytes to check encoding
                test_read = f.read(1024)
                if not test_read.strip():
                    return False, f"File appears to be empty or whitespace-only: {file_path}"
        except UnicodeDecodeError:
            return False, f"File encoding error (expected UTF-8): {file_path}"
        except Exception as e:
            return False, f"Cannot read file: {e}"

        return True, ""

    def _should_reject_chunk(self, chunk_text: str, metadata: ChunkMetadata) -> Tuple[bool, str]:
        """Check if chunk should be rejected based on quality gates."""
        # Check token boundaries
        if metadata.token_count < self.token_min:
            return True, f"Below minimum token threshold ({metadata.token_count} < {self.token_min})"

        if metadata.token_count > self.token_max:
            return True, f"Above maximum token threshold ({metadata.token_count} > {self.token_max})"

        # Check for empty or whitespace-only content
        if not chunk_text.strip():
            return True, "Empty content"

        # Check for minimum content quality
        sentences = re.split(r'[.!?]+', chunk_text.strip())
        meaningful_sentences = [s for s in sentences if len(s.strip()) > 10]

        if len(meaningful_sentences) < 1:
            return True, "Insufficient meaningful content"

        return False, ""

    def _split_long_content(self, content: str, max_tokens: int) -> List[Tuple[str, int]]:
        """
        Split long content on sentence boundaries respecting token limits.

        Returns list of (chunk_content, overlap_tokens) tuples.
        """
        # Split into sentences using regex
        sentences = re.split(r'([.!?]+\s+)', content.strip())
        sentences = [s for s in sentences if s.strip()]  # Remove empty strings

        if not sentences:
            return [(content, 0)]

        chunks = []
        current_chunk = ""
        current_tokens = 0

        for i, sentence in enumerate(sentences):
            sentence_tokens = self._count_tokens(sentence)

            # If adding this sentence would exceed max_tokens, finalize current chunk
            if current_chunk and current_tokens + sentence_tokens > max_tokens:
                # Calculate overlap for this chunk
                overlap_tokens = self._calculate_overlap_tokens(current_tokens)
                chunks.append((current_chunk.strip(), overlap_tokens))

                # Start new chunk with overlap from previous chunk
                overlap_text = ""
                if overlap_tokens > 0 and current_chunk:
                    # Take last part of current chunk as overlap (rough approximation)
                    words = current_chunk.split()[-50:]  # Last 50 words as overlap
                    overlap_text = " ".join(words)
                    current_chunk = overlap_text
                    current_tokens = self._count_tokens(overlap_text)
                else:
                    current_chunk = ""
                    current_tokens = 0

            # Add sentence to current chunk
            current_chunk += sentence
            current_tokens += sentence_tokens

        # Add final chunk if not empty
        if current_chunk.strip():
            overlap_tokens = self._calculate_overlap_tokens(current_tokens)
            chunks.append((current_chunk.strip(), overlap_tokens))

        return chunks

    def process_markdown_file(self, file_path: Path) -> ProcessingResult:
        """Process a single markdown file into chunks."""
        import time
        start_time = time.time()

        try:
            # Validate input file first
            is_valid, error_msg = self._validate_input_file(file_path)
            if not is_valid:
                raise ValueError(f"Input validation failed: {error_msg}")

            # Read and decode file
            content = file_path.read_text(encoding='utf-8')

            # Extract front matter and clean content
            front_matter, clean_content = self._extract_front_matter(content)

            # Parse markdown to HTML for structure analysis
            soup = self._parse_markdown_to_html(clean_content)

            # Extract all headers for hierarchy building
            all_headers = self._extract_header_hierarchy(soup)

            # Determine domain type
            domain_type = self._determine_domain_type(file_path)

            chunks = []
            rejected_count = 0

            # Process headers as potential chunk boundaries, with fallback strategy
            # Try H3 first, then H2, then H1 if no lower-level headers exist
            h3_headers = [h for h in all_headers if h.name == 'h3']
            h2_headers = [h for h in all_headers if h.name == 'h2']
            h1_headers = [h for h in all_headers if h.name == 'h1']

            # Choose the most appropriate header level for chunking
            if h3_headers:
                chunk_headers = h3_headers
                print(f"  Using {len(chunk_headers)} H3 headers for chunk boundaries")
            elif h2_headers:
                chunk_headers = h2_headers
                print(f"  No H3 headers found, using {len(chunk_headers)} H2 headers for chunk boundaries")
            elif h1_headers:
                chunk_headers = h1_headers
                print(f"  No H2/H3 headers found, using {len(chunk_headers)} H1 headers for chunk boundaries")
            else:
                # No headers at all - create single chunk from entire content
                chunk_headers = []
                print("  No headers found, creating single chunk from entire content")

            # Handle case with no headers - create single chunk from entire content
            if not chunk_headers:
                print("  Creating single chunk from entire content")
                chunk_metadata = ChunkMetadata(
                    section_id=self._generate_section_id(
                        str(file_path), ["Document"], 0
                    ),
                    source_file=str(file_path),
                    domain_type=domain_type,
                    chunk_index=0,
                    start_line=0,
                    end_line=0,
                    token_count=self._count_tokens(clean_content),
                    has_entities=False,
                    header_path=["Document"],
                    content_hash=hashlib.md5(clean_content.encode()).hexdigest(),
                    content=clean_content
                )

                # Check quality gates
                should_reject, reject_reason = self._should_reject_chunk(clean_content, chunk_metadata)

                if should_reject:
                    print(f"    Rejecting document chunk: {reject_reason}")
                    rejected_count += 1
                else:
                    chunks.append(chunk_metadata)

            for i, header in enumerate(chunk_headers):
                # Build header path for context
                header_path = self._build_header_path(header, all_headers)

                # Extract content from this header to next header of same level or end
                next_header = chunk_headers[i + 1] if i + 1 < len(chunk_headers) else None
                section_content = self._extract_section_content(header, next_header)

                if not section_content.strip():
                    continue

                # Count tokens
                token_count = self._count_tokens(section_content)

                # Handle long sections by splitting them
                if token_count > self.token_max:
                    print(f"  Splitting long section ({token_count} tokens > {self.token_max} max)")
                    split_chunks = self._split_long_content(section_content, self.token_max)

                    # Create multiple chunks from the split content
                    for split_idx, (chunk_content, _) in enumerate(split_chunks):
                        chunk_token_count = self._count_tokens(chunk_content)

                        # Create chunk metadata
                        chunk_metadata = ChunkMetadata(
                            section_id="",  # Will be set below
                            source_file=str(file_path),
                            domain_type=domain_type,
                            chunk_index=i,
                            start_line=0,
                            end_line=0,
                            token_count=chunk_token_count,
                            has_entities=False,
                            header_path=header_path,
                            content_hash=hashlib.md5(chunk_content.encode()).hexdigest(),
                            content=chunk_content
                        )

                        # Generate deterministic section ID with suffix for split chunks
                        if split_idx == 0:
                            chunk_metadata.section_id = self._generate_section_id(
                                str(file_path), header_path, i
                            )
                        else:
                            # Add suffix for split chunks
                            base_id = self._generate_section_id(str(file_path), header_path, i)
                            chunk_metadata.section_id = f"{base_id}-{split_idx+1:03d}"

                        # Check quality gates
                        should_reject, reject_reason = self._should_reject_chunk(chunk_content, chunk_metadata)

                        if should_reject:
                            print(f"    Rejecting split chunk {split_idx}: {reject_reason}")
                            rejected_count += 1
                            continue

                        chunks.append(chunk_metadata)

                else:
                    # Handle normal-sized sections
                    chunk_metadata = ChunkMetadata(
                        section_id="",  # Will be set below
                        source_file=str(file_path),
                        domain_type=domain_type,
                        chunk_index=i,
                        start_line=0,
                        end_line=0,
                        token_count=token_count,
                        has_entities=False,
                        header_path=header_path,
                        content_hash=hashlib.md5(section_content.encode()).hexdigest(),
                        content=section_content
                    )

                    # Generate deterministic section ID
                    chunk_metadata.section_id = self._generate_section_id(
                        str(file_path), header_path, i
                    )

                    # Check quality gates
                    should_reject, reject_reason = self._should_reject_chunk(section_content, chunk_metadata)

                    if should_reject:
                        print(f"Rejecting chunk {i}: {reject_reason}")
                        rejected_count += 1
                        continue

                    chunks.append(chunk_metadata)

            processing_time = time.time() - start_time

            return ProcessingResult(
                source_file=str(file_path),
                total_chunks=len(chunks),
                total_tokens=sum(c.token_count for c in chunks),
                domain_type=domain_type,
                chunks=chunks,
                rejected_chunks=rejected_count,
                processing_time=processing_time
            )

        except Exception as e:
            raise RuntimeError(f"Failed to process {file_path}: {e}")

    def process_directory(self, input_path: Optional[str] = None) -> List[ProcessingResult]:
        """Process all markdown files in the input directory."""
        if input_path is None:
            input_glob = self.config.get('input_glob', 'corpus/**/*.md')
        else:
            input_glob = input_path

        # Find all markdown files
        markdown_files = list(Path().glob(input_glob))

        if not markdown_files:
            raise FileNotFoundError(f"No markdown files found matching: {input_glob}")

        results = []
        for file_path in markdown_files:
            print(f"Processing: {file_path}")
            result = self.process_markdown_file(file_path)
            results.append(result)

            print(f"  -> {result.total_chunks} chunks, {result.total_tokens} tokens, "
                  f"{result.rejected_chunks} rejected")

        return results


def main():
    """Main entry point for testing the chunker."""
    chunker = MarkdownChunker()

    try:
        # Test with a single file first
        test_file = Path("corpus/bestiary.md")
        if test_file.exists():
            result = chunker.process_markdown_file(test_file)
            print("\n✅ Processing successful!")
            print(f"File: {result.source_file}")
            print(f"Chunks: {result.total_chunks}")
            print(f"Tokens: {result.total_tokens}")
            print(f"Rejected: {result.rejected_chunks}")
            print(f"Time: {result.processing_time:.2f}s")

            # Show first chunk details
            if result.chunks:
                first_chunk = result.chunks[0]
                print("\n📄 First chunk details:")
                print(f"  Section ID: {first_chunk.section_id}")
                print(f"  Domain: {first_chunk.domain_type}")
                print(f"  Tokens: {first_chunk.token_count}")
                print(f"  Headers: {' -> '.join(first_chunk.header_path)}")
        else:
            print(f"Test file not found: {test_file}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()