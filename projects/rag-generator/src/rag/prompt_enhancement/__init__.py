"""
Enhanced Prompt Engineering for chat frontend Integration.

This module provides sophisticated prompt engineering features for
AAA-narrative quality NPC interactions using template variables,
memory classification, and intelligent context injection.
"""

from .template_variables import (
    TemplateVariable, TemplateContext, TemplateVariableResolver,
    TemplateCache, VariableResolutionPipeline
)
from .memory_classes import (
    MemoryClass, ClassifiedMemory, MemoryClassifier, ClassificationRules
)
from .context_injection import ContextInjectionEngine, InjectionPlan
from .prompt_structure import (
    AdvancedPromptBuilder, PromptLayers, PromptTemplates
)

__all__ = [
    # Template Variables
    'TemplateVariable',
    'TemplateContext',
    'TemplateVariableResolver',
    'TemplateCache',
    'VariableResolutionPipeline',
    # Memory Classification
    'MemoryClass',
    'ClassifiedMemory',
    'MemoryClassifier',
    'ClassificationRules',
    # Context Injection
    'ContextInjectionEngine',
    'InjectionPlan',
    # Prompt Structure
    'AdvancedPromptBuilder',
    'PromptLayers',
    'PromptTemplates'
]

__version__ = "1.0.0"