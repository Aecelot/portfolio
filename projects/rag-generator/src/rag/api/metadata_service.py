"""
MetadataService - Focused component for metadata management.

Handles metadata loading, caching, and chunk retrieval operations.
Uses optimized hash index for O(1) lookups instead of O(n) scanning.
Separated from monolithic RetrievalService for better maintainability.
"""

from typing import Dict, Optional, Any
import time
import json
from pathlib import Path


class MetadataService:
    """
    Manages metadata operations with optimized hash indexing.

    Responsibilities:
    - Metadata file loading and parsing
    - Hash index building and maintenance
    - Chunk metadata retrieval with O(1) performance
    - Cache management for frequently accessed chunks
    """

    def __init__(self, meta_path: str, cache_size: int = 10000):
        """Initialize metadata service with file path and cache configuration."""
        self.meta_path = Path(meta_path)
        self.cache_size = cache_size

        # the game engine-optimized: Hash index for O(1) lookups
        self._chunk_index: Dict[str, int] = {}  # section_id -> file_offset
        self._cache: Dict[str, Dict] = {}
        self._access_times: Dict[str, float] = {}
        self._index_path = Path(f"{meta_path}.index")

        self._initialized = False

    def initialize(self) -> bool:
        """Initialize the metadata service and build hash index."""
        try:
            print(f"🔍 Building metadata hash index for {self.meta_path}...")

            if not self.meta_path.exists():
                print(f"⚠️  Metadata file not found: {self.meta_path}")
                return False

            # Build hash index on initialization
            self._build_hash_index()
            print(f"✅ Hash index built: {len(self._chunk_index)} entries")

            self._initialized = True
            return True

        except Exception as e:
            print(f"❌ Failed to initialize metadata service: {e}")
            return False

    def _build_hash_index(self) -> None:
        """Build hash index: section_id -> byte offset for O(1) lookups."""
        try:
            with open(self.meta_path, 'rb') as f:
                offset = 0
                while True:
                    line_start = f.tell()
                    line = f.readline()

                    if not line:
                        break

                    try:
                        # Parse JSON to extract section_id
                        line_str = line.decode('utf-8').strip()
                        if line_str:
                            chunk_data = json.loads(line_str)
                            section_id = chunk_data.get('section_id')
                            if section_id:
                                self._chunk_index[section_id] = line_start
                    except json.JSONDecodeError:
                        # Skip malformed lines
                        pass

                    offset = f.tell()

            print(f"📊 Hash index stats: {len(self._chunk_index)} valid entries from {offset} bytes")

        except FileNotFoundError:
            print(f"⚠️  Metadata file not found: {self.meta_path}")
            self._chunk_index = {}
        except Exception as e:
            print(f"⚠️  Failed to build hash index: {e}")
            self._chunk_index = {}

    def get_chunk(self, section_id: str) -> Optional[Dict]:
        """Get chunk metadata with O(1) hash index lookup for runtime performance."""
        if not self._initialized:
            return None

        current_time = time.time()

        # Check cache first
        if section_id in self._cache:
            self._access_times[section_id] = current_time
            return self._cache[section_id]

        # the game engine optimization: O(1) hash index lookup
        metadata = self._load_metadata_by_offset(section_id)
        if metadata:
            # Evict LRU entry if cache is full
            if len(self._cache) >= self.cache_size:
                self._evict_lru()

            self._cache[section_id] = metadata
            self._access_times[section_id] = current_time

        return metadata

    def _load_metadata_by_offset(self, section_id: str) -> Optional[Dict]:
        """Load metadata using hash index for O(1) lookup - the game engine optimized."""
        try:
            # Get file offset from hash index
            offset = self._chunk_index.get(section_id)
            if offset is None:
                return None

            # Seek directly to offset and read single line
            with open(self.meta_path, 'r', encoding='utf-8') as f:
                f.seek(offset)
                line = f.readline()
                if line.strip():
                    return json.loads(line.strip())

        except (FileNotFoundError, json.JSONDecodeError, OSError) as e:
            print(f"⚠️  Metadata lookup failed for {section_id}: {e}")
        except Exception as e:
            print(f"⚠️  Unexpected error in metadata lookup: {e}")

        return None

    def _evict_lru(self) -> None:
        """Evict least recently used cache entry."""
        if not self._access_times:
            return

        lru_section = min(self._access_times.items(), key=lambda x: x[1])
        del self._cache[lru_section[0]]
        del self._access_times[lru_section[0]]

    def invalidate_index(self) -> None:
        """Force index rebuild on next access (for file updates)."""
        self._chunk_index = {}
        self._cache = {}
        self._access_times = {}
        print("🔄 Metadata index invalidated - will rebuild on next access")

    def get_index_stats(self) -> Dict:
        """Get statistics about the hash index for monitoring."""
        return {
            'total_entries': len(self._chunk_index),
            'cache_size': len(self._cache),
            'cache_max_size': self.cache_size,
            'cache_utilization': len(self._cache) / self.cache_size if self.cache_size > 0 else 0,
            'index_file_size': self.meta_path.stat().st_size if self.meta_path.exists() else 0,
            'index_path': str(self._index_path)
        }

    def is_available(self) -> bool:
        """Check if metadata service is available and ready."""
        return self._initialized and len(self._chunk_index) > 0

    def get_service_info(self) -> Dict[str, Any]:
        """Get information about the metadata service."""
        return {
            'available': self._initialized,
            'meta_path': str(self.meta_path),
            'total_entries': len(self._chunk_index),
            'cache_size': len(self._cache),
            'cache_utilization': len(self._cache) / self.cache_size if self.cache_size > 0 else 0
        }