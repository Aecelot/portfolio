"""
Memory Classes Module for chat frontend Integration.

This module provides memory classification functionality to organize
NPC memories into conceptual categories for intelligent prompt injection.
"""

from .memory_types import MemoryClass, ClassifiedMemory
from .classifier import MemoryClassifier
from .classification_rules import ClassificationRules

__all__ = [
    'MemoryClass',
    'ClassifiedMemory',
    'MemoryClassifier',
    'ClassificationRules'
]

__version__ = "1.0.0"