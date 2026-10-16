"""
Template Variables System for chat frontend Integration.

This module provides sophisticated template variable resolution with caching
and memory-enhanced context injection for AAA-narrative quality NPC interactions.
"""

from .variable_types import TemplateVariable, TemplateContext
from .resolver import TemplateVariableResolver
from .cache import TemplateCache, VariableResolutionPipeline

__all__ = [
    'TemplateVariable',
    'TemplateContext',
    'TemplateVariableResolver',
    'TemplateCache',
    'VariableResolutionPipeline'
]

__version__ = "1.0.0"