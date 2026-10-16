import time
from typing import Dict, Tuple, Optional, Any
import threading
import logging

logger = logging.getLogger(__name__)


class TemplateCache:
    """Thread-safe cache for template variable results."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: Dict[str, Tuple[Any, float]] = {}
        self.lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        with self.lock:
            if key not in self.cache:
                return None

            value, timestamp = self.cache[key]
            if time.time() - timestamp > self.default_ttl:
                del self.cache[key]
                return None

            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set cached value with optional TTL override."""
        with self.lock:
            if len(self.cache) >= self.max_size:
                self._evict_lru()

            actual_ttl = ttl if ttl is not None else self.default_ttl
            self.cache[key] = (value, time.time() + actual_ttl)

    def clear(self, pattern: Optional[str] = None) -> int:
        """Clear cache entries, optionally filtered by pattern. Returns count of cleared entries."""
        with self.lock:
            if pattern is None:
                count = len(self.cache)
                self.cache.clear()
                return count

            keys_to_remove = []
            for key in self.cache.keys():
                if pattern in key:
                    keys_to_remove.append(key)

            for key in keys_to_remove:
                del self.cache[key]

            return len(keys_to_remove)

    def _evict_lru(self) -> None:
        """Evict least recently used entries."""
        if not self.cache:
            return

        # Find oldest entry
        oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k][1])
        del self.cache[oldest_key]

    def size(self) -> int:
        """Get current cache size."""
        with self.lock:
            return len(self.cache)

    def cleanup_expired(self) -> int:
        """Remove expired entries. Returns count of removed entries."""
        with self.lock:
            expired_keys = []
            current_time = time.time()

            for key, (value, expiry_time) in self.cache.items():
                if current_time > expiry_time:
                    expired_keys.append(key)

            for key in expired_keys:
                del self.cache[key]

            return len(expired_keys)


class VariableResolutionPipeline:
    """Pipeline for resolving template variables with caching and dependency management."""

    def __init__(self, memory_service, context):
        self.memory_service = memory_service
        self.context = context
        self.cache = TemplateCache()
        self.resolver = None  # Will be set when resolver is initialized

    def initialize_resolver(self):
        """Initialize the template variable resolver."""
        if not self.resolver:
            self.resolver = self._create_resolver()

    def _create_resolver(self):
        """Create the template variable resolver instance."""
        from .resolver import TemplateVariableResolver
        return TemplateVariableResolver(self.memory_service, self.context)

    def resolve_variable(self, var_name: str, force_refresh: bool = False) -> str:
        """Resolve a single template variable through the pipeline."""
        if not self.resolver:
            self.initialize_resolver()

        if self.resolver is None:
            return f"{{{var_name}_ERROR}}"

        cache_key = f"var:{var_name}:{self.context.npc_id}:{self.context.session_id}"

        # Check cache unless force refresh
        if not force_refresh:
            cached_result = self.cache.get(cache_key)
            if cached_result is not None:
                return cached_result

        # Resolve variable
        result = self.resolver.resolve_variable(var_name, force_refresh)

        # Cache result (use variable's cache duration if available)
        if var_name in self.resolver.variables:
            ttl = self.resolver.variables[var_name].cache_duration
            self.cache.set(cache_key, result, ttl)

        return result

    def resolve_all_variables(self, force_refresh: bool = False) -> Dict[str, str]:
        """Resolve all template variables through the pipeline."""
        if not self.resolver:
            self.initialize_resolver()

        if self.resolver is None:
            return {}

        # Use resolver's built-in resolution with caching
        return self.resolver.resolve_all_variables(force_refresh)

    def clear_cache(self, pattern: Optional[str] = None) -> int:
        """Clear pipeline cache."""
        return self.cache.clear(pattern)

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            'size': self.cache.size(),
            'max_size': self.cache.max_size,
            'default_ttl': self.cache.default_ttl
        }

    def cleanup_expired_cache(self) -> int:
        """Clean up expired cache entries."""
        return self.cache.cleanup_expired()