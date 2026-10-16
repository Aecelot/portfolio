"""
Advanced Prompt Builder

This module implements the AdvancedPromptBuilder class, which orchestrates the
construction of sophisticated prompts using layered architecture, template variables,
and dynamic context injection for AAA-narrative quality NPC interactions.
"""

import time
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from ..template_variables import TemplateVariableResolver, TemplateContext
from ..memory_classes import MemoryClassifier, ClassifiedMemory
from ..context_injection import ContextInjectionEngine
from .prompt_layers import PromptLayers, CharacterCard
from .templates import PromptTemplates, PromptTemplate


@dataclass
class PromptBuildResult:
    """Result of prompt building operation."""
    success: bool
    prompt: str
    build_time: float
    layers_used: int
    variables_resolved: int
    memories_injected: int
    template_name: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class AdvancedPromptBuilder:
    """
    Advanced prompt builder for chat frontend integration.

    This class orchestrates the construction of sophisticated prompts using:
    - Layered prompt architecture
    - Template variable resolution
    - Dynamic context injection
    - Memory classification and surfacing
    """

    def __init__(self,
                 template_resolver: TemplateVariableResolver,
                 context_engine: ContextInjectionEngine,
                 memory_classifier: Optional[MemoryClassifier] = None):
        """
        Initialize the AdvancedPromptBuilder.

        Args:
            template_resolver: Template variable resolution system
            context_engine: Context injection engine for memory surfacing
            memory_classifier: Optional memory classifier (uses context_engine's if not provided)
        """
        self.template_resolver = template_resolver
        self.context_engine = context_engine
        self.memory_classifier = memory_classifier or context_engine.memory_classifier

        # Initialize prompt components
        self.prompt_layers = PromptLayers()
        self.prompt_templates = PromptTemplates()

        # Performance tracking and optimization
        self.last_build_time = 0.0
        self.build_count = 0
        self.total_build_time = 0.0
        self.performance_history = []
        self.max_performance_history = 100

        # Prompt optimization settings
        self.optimization_config = {
            'enable_length_optimization': True,
            'max_prompt_length': 4000,
            'target_prompt_length': 3000,
            'compression_ratio': 0.8,
            'enable_caching': True,
            'cache_ttl': 300,  # 5 minutes
            'enable_performance_monitoring': True,
            'performance_threshold_ms': 1000  # 1 second threshold
        }

        # Prompt cache for optimization
        self.prompt_cache = {}
        self.logger = logging.getLogger(__name__)

    def build_prompt(self,
                    npc_id: str,
                    player_input: str,
                    character_card: CharacterCard,
                    context: TemplateContext,
                    template_name: Optional[str] = None,
                    max_length: Optional[int] = None) -> PromptBuildResult:
        """
        Build an enhanced prompt using chat-frontend-inspired structure.

        Args:
            npc_id: ID of the NPC character
            player_input: Current player input/dialogue
            character_card: Character card data
            context: Template context for variable resolution
            template_name: Optional template to use (defaults to standard_rpg)
            max_length: Maximum prompt length (optional)

        Returns:
            PromptBuildResult with success status and built prompt
        """
        start_time = time.time()
        errors = []
        warnings = []

        try:
            self.logger.info(f"Building prompt for NPC {npc_id}")

            # Step 1: Build injected context
            try:
                # Convert TemplateContext to dict for context injection engine
                context_dict = {
                    'npc_id': context.npc_id,
                    'player_id': context.player_id,
                    'session_id': context.session_id,
                    'current_time': context.current_time.isoformat() if context.current_time else None,
                    'location_context': context.location_context,
                    'conversation_history': context.conversation_history,
                    'memory_service': str(context.memory_service)  # Convert to string for context
                }
                injected_context = self.context_engine.build_injected_context(
                    npc_id, player_input, context_dict)
            except Exception as e:
                error_msg = f"Failed to build injected context: {e}"
                self.logger.error(error_msg)
                errors.append(error_msg)
                # Create minimal injected context for fallback
                injected_context = {
                    'classified_memories': [],
                    'injection_plan': {},
                    'injected_context': {},
                    'template_variables': {}
                }

            # Step 2: Resolve template variables
            try:
                template_variables = self.template_resolver.resolve_all_variables()
                template_variables.update(injected_context.get('template_variables', {}))
            except Exception as e:
                error_msg = f"Failed to resolve template variables: {e}"
                self.logger.error(error_msg)
                errors.append(error_msg)
                template_variables = {}

            # Step 3: Select and configure template
            if template_name:
                template = self.prompt_templates.get_template(template_name)
                if not template:
                    warning_msg = f"Template '{template_name}' not found, using default"
                    warnings.append(warning_msg)
                    template = self.prompt_templates.get_template("standard_rpg")
            else:
                # Auto-select template based on context
                context_keywords = self._extract_context_keywords(player_input, character_card)
                suggestions = self.prompt_templates.get_template_suggestions(context_keywords)
                template = suggestions[0] if suggestions else self.prompt_templates.get_template("standard_rpg")

            # Step 4: Build prompt using layers
            try:
                if template:
                    # Use template's layer structure
                    self._apply_template_to_layers(template, character_card, template_variables)
                else:
                    # Use default layer structure
                    self._apply_default_layer_structure(character_card, template_variables)

                # Add injected memories to template variables
                template_variables.update(self._format_memories_for_template(
                    injected_context.get('classified_memories', [])))

                # Build final prompt
                prompt = self.prompt_layers.build_prompt(character_card, template_variables)

            except Exception as e:
                error_msg = f"Failed to build prompt layers: {e}"
                self.logger.error(error_msg)
                errors.append(error_msg)
                prompt = self._build_fallback_prompt(character_card, player_input, template_variables)

            # Step 5: Apply advanced prompt optimization
            optimization_result = self._optimize_prompt(
                prompt, character_card, template_variables, max_length)
            prompt = optimization_result['optimized_prompt']
            if optimization_result['was_optimized']:
                warnings.append(f"Prompt optimized: {optimization_result['optimization_summary']}")

            # Step 6: Validate prompt
            validation_result = self._validate_prompt(prompt, character_card)
            if not validation_result['valid']:
                warnings.extend(validation_result['warnings'])
                if validation_result['critical_issues']:
                    errors.extend(validation_result['critical_issues'])

            # Calculate final statistics
            build_time = time.time() - start_time
            layers_used = sum(1 for layer in self.prompt_layers.layers if layer.enabled)
            variables_resolved = len(template_variables)
            memories_injected = len(injected_context.get('classified_memories', []))

            # Update performance tracking
            self.last_build_time = build_time
            self.build_count += 1
            self.total_build_time += build_time

            # Record performance metrics
            if self.optimization_config['enable_performance_monitoring']:
                self._record_performance_metrics(build_time, len(prompt), len(errors))

            success = len(errors) == 0

            return PromptBuildResult(
                success=success,
                prompt=prompt,
                build_time=build_time,
                layers_used=layers_used,
                variables_resolved=variables_resolved,
                memories_injected=memories_injected,
                template_name=template.name if template else None,
                errors=errors,
                warnings=warnings,
                metadata={
                    'npc_id': npc_id,
                    'prompt_length': len(prompt),
                    'context_memories_count': len(injected_context.get('classified_memories', [])),
                    'cache_stats': self._get_cache_statistics(),
                    'performance_metrics': self._get_performance_metrics(),
                    'optimization_applied': optimization_result.get('was_optimized', False)
                }
            )

        except Exception as e:
            build_time = time.time() - start_time
            error_msg = f"Critical error in prompt building: {e}"
            self.logger.error(error_msg)

            return PromptBuildResult(
                success=False,
                prompt="",
                build_time=build_time,
                layers_used=0,
                variables_resolved=0,
                memories_injected=0,
                errors=[error_msg],
                warnings=warnings
            )

    def _apply_template_to_layers(self, template: PromptTemplate,
                                character_card: CharacterCard,
                                template_variables: Dict[str, str]):
        """Apply template structure to prompt layers."""
        # For now, use the default layer structure
        # In a more advanced implementation, this would parse the template
        # and create custom layers based on template structure
        self._apply_default_layer_structure(character_card, template_variables)

    def _apply_default_layer_structure(self, character_card: CharacterCard,
                                     template_variables: Dict[str, str]):
        """Apply default layer structure with template variables."""
        # Update all layers with current template variables
        for layer in self.prompt_layers.layers:
            layer.variables.update(template_variables)

        # Add character-specific variables to appropriate layers
        self._enhance_character_context(character_card)

    def _enhance_character_context(self, character_card: CharacterCard):
        """Enhance prompt layers with character-specific context."""
        # Update system layer with character identity
        system_layer = self.prompt_layers.get_layer("system")
        if system_layer:
            character_vars = {
                "{{char}}": character_card.name,
                "{{char_species}}": character_card.species or "Not specified",
                "{{char_age}}": character_card.age or "Not specified"
            }
            system_layer.variables.update(character_vars)

        # Update character layer with detailed background
        character_layer = self.prompt_layers.get_layer("character")
        if character_layer:
            if character_card.personality_traits:
                traits_text = "\n".join(f"- {trait}" for trait in character_card.personality_traits)
                character_layer.variables["{{personality_traits}}"] = traits_text
            else:
                character_layer.variables["{{personality_traits}}"] = "Complex and multifaceted personality"

    def _format_memories_for_template(self, classified_memories: List[ClassifiedMemory]) -> Dict[str, str]:
        """Format classified memories for template injection."""
        memory_vars = {}

        # Group memories by class
        memories_by_class = {}
        for memory in classified_memories:
            class_name = memory.memory_class.value
            if class_name not in memories_by_class:
                memories_by_class[class_name] = []
            memories_by_class[class_name].append(memory)

        # Format each memory class
        for class_name, memories in memories_by_class.items():
            var_name = f"{{{{{class_name}_memories}}}}"
            if memories:
                formatted_memories = []
                for memory in memories[:3]:  # Limit to top 3 memories per class
                    formatted_memories.append(f"- {memory.formatted_content}")
                memory_vars[var_name] = "\n".join(formatted_memories)
            else:
                memory_vars[var_name] = "No relevant memories"

        return memory_vars

    def _extract_context_keywords(self, player_input: str, character_card: CharacterCard) -> List[str]:
        """Extract context keywords for template suggestion."""
        keywords = []

        # Add keywords from player input
        words = player_input.lower().split()
        keywords.extend([word for word in words if len(word) > 4])  # Words longer than 4 chars

        # Add character-related keywords
        if character_card.species:
            keywords.append(character_card.species.lower())
        if character_card.personality_traits:
            keywords.extend([trait.lower() for trait in character_card.personality_traits])

        return list(set(keywords))  # Remove duplicates

    def _validate_prompt(self, prompt: str, character_card: CharacterCard) -> Dict[str, Any]:
        """Validate the built prompt for quality and completeness."""
        warnings = []
        critical_issues = []

        # Check minimum length
        if len(prompt) < 100:
            warning_msg = "Prompt is unusually short (< 100 characters)"
            warnings.append(warning_msg)

        # Check maximum length (prevent token overflow)
        if len(prompt) > 6000:
            critical_msg = f"Prompt is too long ({len(prompt)} characters, max 6000)"
            critical_issues.append(critical_msg)

        # Check for character name inclusion
        if character_card.name not in prompt:
            warning_msg = f"Character name '{character_card.name}' not found in prompt"
            warnings.append(warning_msg)

        # Check for required sections
        required_sections = ["CORE IDENTITY", "RESPONSE GUIDELINES"]
        for section in required_sections:
            if section not in prompt:
                warning_msg = f"Required section '{section}' missing from prompt"
                warnings.append(warning_msg)

        # Check for variable resolution issues (unresolved variables)
        import re
        unresolved_vars = re.findall(r'\{\{[^}]+\}\}', prompt)
        if unresolved_vars:
            warning_msg = f"Unresolved template variables: {unresolved_vars[:5]}"
            warnings.append(warning_msg)

        return {
            'valid': len(critical_issues) == 0,
            'warnings': warnings,
            'critical_issues': critical_issues
        }

    def _build_fallback_prompt(self, character_card: CharacterCard,
                              player_input: str, template_variables: Dict[str, str]) -> str:
        """Build a minimal fallback prompt when normal building fails."""
        return f"""You are {character_card.name}.

{character_card.background or "A complex character with rich backstory."}

Current context: {player_input}

Respond as {character_card.name}: """

    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for the prompt builder."""
        return {
            'build_count': self.build_count,
            'last_build_time': self.last_build_time,
            'average_build_time': self.last_build_time / max(1, self.build_count),
            'template_resolver_stats': 'Template resolver statistics not available',
            'layer_stats': self.prompt_layers.get_prompt_statistics(),
            'template_stats': self.prompt_templates.get_template_statistics()
        }

    def configure_layer(self, layer_name: str, enabled: bool = True,
                       max_length: Optional[int] = None, priority: Optional[int] = None):
        """Configure a specific prompt layer."""
        layer = self.prompt_layers.get_layer(layer_name)
        if layer:
            if enabled is not None:
                layer.enabled = enabled
            if max_length is not None:
                layer.max_length = max_length
            if priority is not None:
                layer.priority = priority
                # Re-sort layers after priority change
                self.prompt_layers.layers.sort(key=lambda x: x.priority, reverse=True)

    def add_custom_layer(self, name: str, content: str, priority: int = 50,
                        max_length: Optional[int] = None):
        """Add a custom layer to the prompt structure."""
        from .prompt_layers import PromptLayer

        layer = PromptLayer(
            name=name,
            content=content,
            priority=priority,
            max_length=max_length
        )
        self.prompt_layers.add_layer(layer)

    def set_template(self, template_name: str):
        """Set the active template for prompt building."""
        template = self.prompt_templates.get_template(template_name)
        if template:
            self._apply_template_to_layers(template, CharacterCard("Template"), {})
            return True
        return False

    def get_available_templates(self) -> List[str]:
        """Get list of available template names."""
        return list(self.prompt_templates.templates.keys())

    def _optimize_prompt(self, prompt: str, character_card: CharacterCard,
                        template_variables: Dict[str, str], max_length: Optional[int] = None) -> Dict[str, Any]:
        """Apply advanced prompt optimization strategies."""
        original_prompt = prompt
        optimization_summary = ""
        was_optimized = False

        # Determine target length
        target_length = max_length or self.optimization_config['max_prompt_length']

        if len(prompt) <= target_length:
            return {
                'optimized_prompt': prompt,
                'was_optimized': False,
                'optimization_summary': "No optimization needed"
            }

        # Apply optimization strategies
        optimizations_applied = []

        # Strategy 1: Memory compression
        if self.optimization_config['enable_length_optimization']:
            compressed_prompt = self._compress_memories_in_prompt(prompt, template_variables)
            if len(compressed_prompt) < len(prompt):
                prompt = compressed_prompt
                optimizations_applied.append("memory_compression")
                was_optimized = True

        # Strategy 2: Layer prioritization
        if len(prompt) > target_length:
            prioritized_prompt = self._prioritize_prompt_layers(prompt, character_card, target_length)
            if len(prioritized_prompt) < len(prompt):
                prompt = prioritized_prompt
                optimizations_applied.append("layer_prioritization")
                was_optimized = True

        # Strategy 3: Variable truncation
        if len(prompt) > target_length:
            truncated_prompt = self._truncate_long_variables(prompt, target_length)
            if len(truncated_prompt) <= target_length:
                prompt = truncated_prompt
                optimizations_applied.append("variable_truncation")
                was_optimized = True

        # Strategy 4: Content summarization (last resort)
        if len(prompt) > target_length:
            summarized_prompt = self._summarize_prompt_content(prompt, target_length)
            if len(summarized_prompt) <= target_length:
                prompt = summarized_prompt
                optimizations_applied.append("content_summarization")
                was_optimized = True

        if was_optimized:
            optimization_summary = f"Applied {', '.join(optimizations_applied)}: {len(original_prompt)} → {len(prompt)} chars"
        else:
            optimization_summary = "No effective optimizations found"

        return {
            'optimized_prompt': prompt,
            'was_optimized': was_optimized,
            'optimization_summary': optimization_summary,
            'original_length': len(original_prompt),
            'optimized_length': len(prompt),
            'target_length': target_length,
            'optimizations_applied': optimizations_applied
        }

    def _compress_memories_in_prompt(self, prompt: str, template_variables: Dict[str, str]) -> str:
        """Compress memory sections in prompt while preserving key information."""
        # Find memory sections and compress them
        import re

        # Pattern to match memory sections
        memory_patterns = [
            r'RELEVANT MEMORIES:(.*?)(?=\n\n|\Z)',
            r'Character Memories:(.*?)(?=\n\n|\Z)',
            r'Player Memories:(.*?)(?=\n\n|\Z)',
            r'World Context:(.*?)(?=\n\n|\Z)'
        ]

        compressed_prompt = prompt

        for pattern in memory_patterns:
            matches = re.finditer(pattern, compressed_prompt, re.DOTALL)
            for match in matches:
                memory_section = match.group(1).strip()
                if len(memory_section) > 200:  # Only compress long sections
                    compressed_section = self._compress_memory_section(memory_section)
                    compressed_prompt = compressed_prompt.replace(match.group(1), compressed_section)

        return compressed_prompt

    def _compress_memory_section(self, section: str) -> str:
        """Compress a memory section while preserving key information."""
        lines = section.split('\n')
        compressed_lines = []

        for line in lines:
            if len(line.strip()) > 100:
                # Truncate very long lines
                compressed_lines.append(line[:97] + "...")
            else:
                compressed_lines.append(line)

        # Limit total memory section length
        max_memory_length = 300
        if len('\n'.join(compressed_lines)) > max_memory_length:
            # Keep only the most important lines (first and last few)
            important_lines = compressed_lines[:2] + compressed_lines[-2:]
            return '\n'.join(important_lines) + f"\n... ({len(compressed_lines) - 4} memories omitted)"

        return '\n'.join(compressed_lines)

    def _prioritize_prompt_layers(self, prompt: str, character_card: CharacterCard, target_length: int) -> str:
        """Prioritize and potentially remove lower-priority layers."""
        # This is a simplified implementation - in practice, you'd parse the prompt
        # and selectively remove or compress sections based on priority

        current_length = len(prompt)

        # If prompt is only slightly over target, try simple truncation
        if current_length - target_length < 200:
            return prompt[:target_length - 3] + "..."

        # For significantly oversized prompts, we'd need more sophisticated layer management
        # This would require parsing the prompt structure and selectively removing sections

        return prompt  # Return original if no effective prioritization possible

    def _truncate_long_variables(self, prompt: str, target_length: int) -> str:
        """Truncate overly long template variables."""
        import re

        # Find template variables that are extremely long
        long_var_pattern = r'\{\{[^}]+\}\}'

        def truncate_variable(match):
            var_content = match.group(0)
            if len(var_content) > 150:
                return var_content[:147] + "..."
            return var_content

        truncated_prompt = re.sub(long_var_pattern, truncate_variable, prompt)

        # If still too long, truncate overall prompt
        if len(truncated_prompt) > target_length:
            return truncated_prompt[:target_length - 3] + "..."

        return truncated_prompt

    def _summarize_prompt_content(self, prompt: str, target_length: int) -> str:
        """Summarize prompt content as last resort optimization."""
        # Simple summarization - keep essential sections
        sections_to_keep = [
            "CORE IDENTITY",
            "PERSONALITY TRAITS",
            "RESPONSE GUIDELINES"
        ]

        lines = prompt.split('\n')
        essential_lines = []
        current_section = None

        for line in lines:
            # Check if this line starts a new section
            for section in sections_to_keep:
                if section in line:
                    current_section = section
                    break

            # Keep section headers and essential content
            if any(section in line for section in sections_to_keep):
                essential_lines.append(line)
            elif current_section and len(essential_lines) < 10:  # Limit lines per section
                essential_lines.append(line)

        summarized_prompt = '\n'.join(essential_lines)

        # Final truncation if still too long
        if len(summarized_prompt) > target_length:
            return summarized_prompt[:target_length - 3] + "..."

        return summarized_prompt

    def _record_performance_metrics(self, build_time: float, prompt_length: int, error_count: int):
        """Record performance metrics for monitoring."""
        import time

        metric = {
            'timestamp': time.time(),
            'build_time_ms': build_time * 1000,
            'prompt_length': prompt_length,
            'error_count': error_count,
            'performance_rating': 'good' if build_time < 0.5 else 'slow' if build_time > 2.0 else 'acceptable'
        }

        self.performance_history.append(metric)

        # Maintain history size limit
        if len(self.performance_history) > self.max_performance_history:
            self.performance_history = self.performance_history[-self.max_performance_history:]

    def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics."""
        if not self.performance_history:
            return {
                'average_build_time_ms': 0.0,
                'total_builds': 0,
                'performance_trend': 'no_data'
            }

        recent_metrics = self.performance_history[-10:] if len(self.performance_history) > 10 else self.performance_history

        avg_build_time = sum(m['build_time_ms'] for m in recent_metrics) / len(recent_metrics)

        # Calculate trend
        if len(recent_metrics) >= 5:
            first_half = recent_metrics[:len(recent_metrics)//2]
            second_half = recent_metrics[len(recent_metrics)//2:]

            first_avg = sum(m['build_time_ms'] for m in first_half) / len(first_half)
            second_avg = sum(m['build_time_ms'] for m in second_half) / len(second_half)

            if second_avg > first_avg * 1.2:
                trend = 'degrading'
            elif second_avg < first_avg * 0.8:
                trend = 'improving'
            else:
                trend = 'stable'
        else:
            trend = 'insufficient_data'

        return {
            'average_build_time_ms': avg_build_time,
            'total_builds': len(self.performance_history),
            'performance_trend': trend,
            'recent_performance_rating': recent_metrics[-1]['performance_rating'] if recent_metrics else 'unknown'
        }

    def _get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache performance statistics."""
        return {
            'cache_enabled': self.optimization_config['enable_caching'],
            'cache_size': len(self.prompt_cache),
            'cache_ttl_seconds': self.optimization_config['cache_ttl'],
            'hit_ratio': 'Not tracked'  # Would need hit/miss tracking implementation
        }

    def configure_optimization(self, **config_updates):
        """Configure prompt optimization settings."""
        for key, value in config_updates.items():
            if key in self.optimization_config:
                self.optimization_config[key] = value
                self.logger.info(f"Updated optimization config: {key} = {value}")

    def clear_performance_history(self):
        """Clear performance monitoring history."""
        self.performance_history.clear()
        self.logger.info("Cleared performance history")

    def get_optimization_recommendations(self) -> Dict[str, Any]:
        """Get recommendations for prompt optimization based on performance data."""
        recommendations = []

        if not self.performance_history:
            return {'recommendations': ['No performance data available']}

        metrics = self._get_performance_metrics()

        # Analyze performance trends
        if metrics['average_build_time_ms'] > 1000:
            recommendations.append("High build times detected - consider reducing memory injection limits")

        if metrics['performance_trend'] == 'degrading':
            recommendations.append("Performance degrading - check for memory leaks or increasing complexity")

        # Check prompt length trends
        if self.performance_history:
            recent_lengths = [m['prompt_length'] for m in self.performance_history[-5:]]
            avg_recent_length = sum(recent_lengths) / len(recent_lengths)

            if avg_recent_length > self.optimization_config['max_prompt_length']:
                recommendations.append("Prompts frequently exceed max length - consider enabling more aggressive optimization")

        return {
            'recommendations': recommendations,
            'performance_metrics': metrics,
            'current_config': self.optimization_config
        }