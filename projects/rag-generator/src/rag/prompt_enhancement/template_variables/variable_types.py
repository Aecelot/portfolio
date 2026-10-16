from dataclasses import dataclass, field
from typing import Callable, Dict, List, Any
from datetime import datetime
import time
import logging

logger = logging.getLogger(__name__)


@dataclass
class TemplateVariable:
    """Represents a template variable and its resolution logic."""
    name: str
    description: str
    resolver_func: Callable
    dependencies: List[str] = field(default_factory=list)
    cache_duration: int = 300  # 5 minutes
    variable_type: str = "base"  # base, memory_enhanced, derived


@dataclass
class TemplateContext:
    """Complete context for template variable resolution."""
    npc_id: str
    player_id: str
    session_id: str
    current_time: datetime
    location_context: Dict[str, Any] = field(default_factory=dict)
    conversation_history: List[Dict] = field(default_factory=list)
    memory_service: Any = None  # NPC Memory Service reference
    game_state: Dict[str, Any] = field(default_factory=dict)
    character_data: Dict[str, Any] = field(default_factory=dict)
    player_data: Dict[str, Any] = field(default_factory=dict)