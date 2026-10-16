"""
Context Injection Module for chat frontend Integration.

This module provides intelligent context injection capabilities for
dynamic memory surfacing and smart prompt construction.
"""

from .injection_engine import ContextInjectionEngine, InjectionPlan
from .decision_logic import InjectionDecisionLogic
from .rules import InjectionRuleManager, InjectionRule, InjectionRuleSet

__all__ = [
    'ContextInjectionEngine',
    'InjectionPlan',
    'InjectionDecisionLogic',
    'InjectionRuleManager',
    'InjectionRule',
    'InjectionRuleSet'
]

__version__ = "1.0.0"
