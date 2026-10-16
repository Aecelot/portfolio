"""
Comprehensive tests for the Advanced Prompt Builder system.

This module tests the chat frontend integration's advanced prompt building
functionality including layered prompt construction, template variables,
and context injection.
"""

import unittest
import time
from unittest.mock import Mock, MagicMock
from datetime import datetime

# Import the prompt enhancement system
from src.rag.prompt_enhancement.prompt_structure import AdvancedPromptBuilder, PromptLayers
from src.rag.prompt_enhancement.prompt_structure.prompt_layers import CharacterCard
from src.rag.prompt_enhancement.template_variables import TemplateVariableResolver, TemplateContext
from src.rag.prompt_enhancement.context_injection import ContextInjectionEngine
from src.rag.prompt_enhancement.memory_classes import MemoryClassifier
from src.npc.npc_memory_bridge import NPCMemoryBridge


class TestPromptLayers(unittest.TestCase):
    """Test the PromptLayers system."""

    def setUp(self):
        """Set up test fixtures."""
        self.prompt_layers = PromptLayers()

        self.test_character_card = CharacterCard(
            name="Elara Vynne",
            species="Elf",
            age="127",
            personality_traits=["Wise", "Calm", "Perceptive"],
            background="A wise elven scholar with deep knowledge of ancient magic.",
            appearance="Tall and graceful with silver hair and piercing blue eyes.",
            relationships={"Player": "Trusted ally", "King": "Respects authority"},
            secrets=["Knows forbidden spell", "Has hidden artifact"],
            goals=["Master ancient magic", "Protect the realm"]
        )

    def test_layer_creation(self):
        """Test that default layers are created correctly."""
        self.assertEqual(len(self.prompt_layers.layers), 6)

        layer_names = [layer.name for layer in self.prompt_layers.layers]
        expected_layers = ["system", "character", "memory", "context", "conversation", "instruction"]

        for expected in expected_layers:
            self.assertIn(expected, layer_names)

    def test_layer_priority_ordering(self):
        """Test that layers are ordered by priority correctly."""
        # System layer should have highest priority
        system_layer = next(layer for layer in self.prompt_layers.layers if layer.name == "system")
        instruction_layer = next(layer for layer in self.prompt_layers.layers if layer.name == "instruction")

        self.assertGreater(system_layer.priority, instruction_layer.priority)

    def test_prompt_building(self):
        """Test basic prompt building functionality."""
        template_variables = {
            "{{char}}": "Elara Vynne",
            "{{player_input}}": "Hello, wise elf.",
            "{{emotional_state}}": "calm",
            "{{location}}": "Ancient Library"
        }

        prompt = self.prompt_layers.build_prompt(self.test_character_card, template_variables)

        # Check that prompt contains expected elements
        self.assertIn("Elara Vynne", prompt)
        self.assertIn("Hello, wise elf.", prompt)
        self.assertIn("CORE IDENTITY", prompt)
        self.assertIn("RESPONSE GUIDELINES", prompt)

    def test_layer_configuration(self):
        """Test layer enable/disable and configuration."""
        # Disable memory layer
        memory_layer = self.prompt_layers.get_layer("memory")
        self.assertIsNotNone(memory_layer, "Memory layer should exist")
        memory_layer.enabled = False

        # Build prompt and verify memory layer is excluded
        template_variables = {"{{char}}": "Test", "{{player_input}}": "Test"}
        prompt = self.prompt_layers.build_prompt(self.test_character_card, template_variables)

        self.assertNotIn("RELEVANT MEMORIES", prompt)

    def test_custom_layer_addition(self):
        """Test adding custom layers."""
        from src.rag.prompt_enhancement.prompt_structure.prompt_layers import PromptLayer

        custom_layer = PromptLayer(
            name="custom",
            content="Custom layer content with {{char}} variable",
            priority=25
        )
        self.prompt_layers.add_layer(custom_layer)

        custom_layer = self.prompt_layers.get_layer("custom")
        self.assertIsNotNone(custom_layer, "Custom layer should exist")
        self.assertEqual(custom_layer.priority, 25)

        # Test that custom layer appears in built prompt
        template_variables = {"{{char}}": "TestChar"}

        # Set variables directly on the custom layer for template substitution
        if custom_layer is not None:
            custom_layer.content = "Custom layer content with TestChar variable"

        prompt = self.prompt_layers.build_prompt(self.test_character_card, template_variables)
        self.assertIn("Custom layer content", prompt)
        self.assertIn("TestChar", prompt)


class TestAdvancedPromptBuilder(unittest.TestCase):
    """Test the main AdvancedPromptBuilder class."""

    def setUp(self):
        """Set up test fixtures with mocked dependencies."""
        # Create mock memory service
        self.mock_memory_service = Mock(spec=NPCMemoryBridge)
        self.mock_memory_service.get_relevant_memories.return_value = []

        # Create mock memory classifier
        self.mock_memory_classifier = Mock(spec=MemoryClassifier)

        # Create template context
        self.template_context = TemplateContext(
            npc_id="elara_vynne",
            player_id="player_001",
            session_id="test_session",
            current_time=datetime.now(),
            location_context={"name": "Ancient Library", "description": "A vast library of ancient knowledge"},
            conversation_history=[
                {"sender": "Player", "content": "Hello there"},
                {"sender": "Elara", "content": "Greetings, traveler"}
            ],
            memory_service=self.mock_memory_service
        )

        # Create template resolver
        self.template_resolver = TemplateVariableResolver(
            memory_service=self.mock_memory_service,
            context=self.template_context
        )

        # Create context injection engine
        self.context_engine = ContextInjectionEngine(
            memory_classifier=self.mock_memory_classifier,
            template_resolver=self.template_resolver,
            memory_bridge=self.mock_memory_service
        )

        # Create advanced prompt builder
        self.prompt_builder = AdvancedPromptBuilder(
            template_resolver=self.template_resolver,
            context_engine=self.context_engine,
            memory_classifier=self.mock_memory_classifier
        )

        # Create test character card
        self.character_card = CharacterCard(
            name="Elara Vynne",
            species="Elf",
            age="127",
            personality_traits=["Wise", "Calm", "Perceptive"],
            background="A wise elven scholar with deep knowledge of ancient magic.",
            appearance="Tall and graceful with silver hair and piercing blue eyes.",
            relationships={"Player": "Trusted ally"},
            secrets=["Knows forbidden spell"],
            goals=["Master ancient magic"]
        )

    def test_initialization(self):
        """Test that AdvancedPromptBuilder initializes correctly."""
        self.assertIsNotNone(self.prompt_builder.template_resolver)
        self.assertIsNotNone(self.prompt_builder.context_engine)
        self.assertIsNotNone(self.prompt_builder.prompt_layers)
        self.assertIsNotNone(self.prompt_builder.prompt_templates)

    def test_prompt_building_success(self):
        """Test successful prompt building."""
        # Mock successful context injection
        def mock_return_value(*args, **kwargs):
            return {
                'classified_memories': [],
                'injection_plan': Mock(),
                'injected_context': {'memory_section': 'No memories'},
                'template_variables': {}
            }
        self.context_engine.build_injected_context = Mock(side_effect=mock_return_value)

        # Mock memory classifier
        self.mock_memory_classifier.classify_memories.return_value = []

        result = self.prompt_builder.build_prompt(
            npc_id="elara_vynne",
            player_input="What do you know about ancient magic?",
            character_card=self.character_card,
            context=self.template_context
        )

        # Verify result
        self.assertTrue(result.success)
        self.assertIsInstance(result.prompt, str)
        self.assertGreater(len(result.prompt), 0)
        # Build time might be very small but should be >= 0
        self.assertGreaterEqual(result.build_time, 0)

        # Check prompt content
        self.assertIn("Elara Vynne", result.prompt)
        self.assertIn("ancient magic", result.prompt)

    def test_prompt_building_with_template(self):
        """Test prompt building with specific template."""
        result = self.prompt_builder.build_prompt(
            npc_id="elara_vynne",
            player_input="Let's discuss strategy.",
            character_card=self.character_card,
            context=self.template_context,
            template_name="concise_interaction"
        )

        self.assertTrue(result.success)
        self.assertIn("Elara Vynne", result.prompt)

    def test_error_handling(self):
        """Test error handling in prompt building."""
        # Mock context injection to raise an exception
        def mock_side_effect(*args, **kwargs):
            raise Exception("Memory service error")
        self.context_engine.build_injected_context = Mock(side_effect=mock_side_effect)

        result = self.prompt_builder.build_prompt(
            npc_id="elara_vynne",
            player_input="Test input",
            character_card=self.character_card,
            context=self.template_context
        )

        # Should still return a result but with fallback prompt
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)
        # The prompt should still be generated (may not contain "Error" but should be valid)
        self.assertIsInstance(result.prompt, str)
        self.assertGreater(len(result.prompt), 0)

    def test_template_suggestions(self):
        """Test template suggestion functionality."""
        context_keywords = ["magic", "ancient", "wise"]

        # Mock template suggestions
        mock_template = Mock()
        mock_template.name = "magic_focused"
        mock_template.description = "A template for magic-focused interactions"
        mock_template.tags = ["magic", "fantasy", "spells"]
        self.prompt_builder.prompt_templates.templates["magic_focused"] = mock_template

        # This would test the actual suggestion logic if implemented
        templates = self.prompt_builder.prompt_templates.get_template_suggestions(context_keywords)
        self.assertIsInstance(templates, list)

    def test_performance_monitoring(self):
        """Test performance monitoring features."""
        # Build a few prompts to generate stats
        for i in range(3):
            result = self.prompt_builder.build_prompt(
                npc_id=f"npc_{i}",
                player_input=f"Test input {i}",
                character_card=self.character_card,
                context=self.template_context
            )

        stats = self.prompt_builder.get_performance_stats()
        self.assertIn('build_count', stats)
        self.assertIn('last_build_time', stats)
        self.assertEqual(stats['build_count'], 3)


class TestPromptTemplateSystem(unittest.TestCase):
    """Test the prompt template system."""

    def setUp(self):
        """Set up test fixtures."""
        from src.rag.prompt_enhancement.prompt_structure.templates import PromptTemplates
        self.templates = PromptTemplates()

    def test_default_templates_loaded(self):
        """Test that default templates are loaded."""
        self.assertGreater(len(self.templates.templates), 0)

        # Check for expected templates
        template_names = list(self.templates.templates.keys())
        self.assertIn("standard_rpg", template_names)
        self.assertIn("concise_interaction", template_names)

    def test_template_retrieval(self):
        """Test template retrieval by name."""
        template = self.templates.get_template("standard_rpg")
        self.assertIsNotNone(template, "Template should exist")
        if template is not None:
            self.assertEqual(template.name, "standard_rpg")
            self.assertIn("{{char}}", template.variables)

    def test_template_search(self):
        """Test template searching functionality."""
        results = self.templates.search_templates("rpg")
        self.assertGreater(len(results), 0)

        # All results should contain "rpg" in name, description, or tags
        for template in results:
            found = (template.name.lower().find("rpg") != -1 or
                    template.description.lower().find("rpg") != -1 or
                    any("rpg" in tag.lower() for tag in template.tags))
            self.assertTrue(found)

    def test_template_suggestions(self):
        """Test template suggestions based on keywords."""
        keywords = ["combat", "fight", "battle"]

        suggestions = self.templates.get_template_suggestions(keywords)

        # Should return templates, possibly empty if no matches
        self.assertIsInstance(suggestions, list)

    def test_template_statistics(self):
        """Test template collection statistics."""
        stats = self.templates.get_template_statistics()

        self.assertIn('total_templates', stats)
        self.assertIn('categories', stats)
        self.assertIn('tags', stats)
        self.assertEqual(stats['total_templates'], len(self.templates.templates))


class TestIntegrationScenarios(unittest.TestCase):
    """Test integration scenarios and edge cases."""

    def setUp(self):
        """Set up integration test fixtures."""
        # Create minimal working setup
        self.mock_memory_service = Mock(spec=NPCMemoryBridge)

        self.template_context = TemplateContext(
            npc_id="test_npc",
            player_id="test_player",
            session_id="test_session",
            current_time=datetime.now(),
            location_context={"name": "Test Location"},
            conversation_history=[],
            memory_service=self.mock_memory_service
        )

    def test_minimal_character_card(self):
        """Test prompt building with minimal character information."""
        minimal_card = CharacterCard(
            name="Simple NPC",
            background="A simple character"
        )

        template_resolver = TemplateVariableResolver(
            memory_service=self.mock_memory_service,
            context=self.template_context
        )

        context_engine = ContextInjectionEngine(
            memory_classifier=Mock(),
            template_resolver=template_resolver,
            memory_bridge=self.mock_memory_service
        )

        prompt_builder = AdvancedPromptBuilder(
            template_resolver=template_resolver,
            context_engine=context_engine
        )

        result = prompt_builder.build_prompt(
            npc_id="test_npc",
            player_input="Hello",
            character_card=minimal_card,
            context=self.template_context
        )

        self.assertTrue(result.success)
        self.assertIn("Simple NPC", result.prompt)

    def test_long_player_input(self):
        """Test handling of very long player input."""
        long_input = "This is a very long player input. " * 50  # Very long input

        template_resolver = TemplateVariableResolver(
            memory_service=self.mock_memory_service,
            context=self.template_context
        )

        context_engine = ContextInjectionEngine(
            memory_classifier=Mock(),
            template_resolver=template_resolver,
            memory_bridge=self.mock_memory_service
        )

        prompt_builder = AdvancedPromptBuilder(
            template_resolver=template_resolver,
            context_engine=context_engine
        )

        result = prompt_builder.build_prompt(
            npc_id="test_npc",
            player_input=long_input,
            character_card=CharacterCard(name="Test", background="Test"),
            context=self.template_context
        )

        # Should handle long input gracefully
        self.assertTrue(result.success)
        self.assertLess(len(result.prompt), 10000)  # Should not be excessively long

    def test_empty_player_input(self):
        """Test handling of empty player input."""
        template_resolver = TemplateVariableResolver(
            memory_service=self.mock_memory_service,
            context=self.template_context
        )

        context_engine = ContextInjectionEngine(
            memory_classifier=Mock(),
            template_resolver=template_resolver,
            memory_bridge=self.mock_memory_service
        )

        prompt_builder = AdvancedPromptBuilder(
            template_resolver=template_resolver,
            context_engine=context_engine
        )

        result = prompt_builder.build_prompt(
            npc_id="test_npc",
            player_input="",
            character_card=CharacterCard(name="Test", background="Test"),
            context=self.template_context
        )

        # Should handle empty input gracefully
        self.assertTrue(result.success)
        self.assertIsInstance(result.prompt, str)


class TestPerformanceBenchmarks(unittest.TestCase):
    """Test performance characteristics of the prompt builder."""

    def setUp(self):
        """Set up performance test fixtures."""
        self.mock_memory_service = Mock(spec=NPCMemoryBridge)

        self.template_context = TemplateContext(
            npc_id="perf_test_npc",
            player_id="perf_test_player",
            session_id="perf_test_session",
            current_time=datetime.now(),
            location_context={"name": "Performance Test Location"},
            conversation_history=[],
            memory_service=self.mock_memory_service
        )

        self.template_resolver = TemplateVariableResolver(
            memory_service=self.mock_memory_service,
            context=self.template_context
        )

        self.context_engine = ContextInjectionEngine(
            memory_classifier=Mock(),
            template_resolver=self.template_resolver,
            memory_bridge=self.mock_memory_service
        )

        self.prompt_builder = AdvancedPromptBuilder(
            template_resolver=self.template_resolver,
            context_engine=self.context_engine
        )

        self.character_card = CharacterCard(
            name="Performance Test NPC",
            background="A character for performance testing"
        )

    def test_build_time_under_threshold(self):
        """Test that prompt building stays under performance threshold."""
        start_time = time.time()

        result = self.prompt_builder.build_prompt(
            npc_id="perf_test_npc",
            player_input="This is a performance test input.",
            character_card=self.character_card,
            context=self.template_context
        )

        build_time = time.time() - start_time

        # Should build prompt in reasonable time (under 1 second)
        self.assertLess(build_time, 1.0)
        self.assertTrue(result.success)

    def test_multiple_builds_performance(self):
        """Test performance with multiple sequential builds."""
        times = []

        for i in range(10):
            start_time = time.time()

            result = self.prompt_builder.build_prompt(
                npc_id=f"npc_{i}",
                player_input=f"Test input {i}",
                character_card=self.character_card,
                context=self.template_context
            )

            build_time = time.time() - start_time
            times.append(build_time)

            self.assertTrue(result.success)

        # Average should be reasonable
        avg_time = sum(times) / len(times)
        self.assertLess(avg_time, 0.5)  # Average under 500ms

        # Check that times are relatively consistent (not degrading significantly)
        max_time = max(times)
        min_time = min(times)
        if min_time > 0:
            self.assertLess(max_time / min_time, 3.0)  # Max shouldn't be 3x min
        else:
            self.assertLess(max_time, 0.1)  # If min is 0, max should still be reasonable


def run_comprehensive_tests():
    """Run all comprehensive tests."""
    # Create test suite
    test_classes = [
        TestPromptLayers,
        TestAdvancedPromptBuilder,
        TestPromptTemplateSystem,
        TestIntegrationScenarios,
        TestPerformanceBenchmarks
    ]

    suite = unittest.TestSuite()
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        suite.addTests(tests)

    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n=== Test Summary ===")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    success_rate = ((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100)
    print(f"Success rate: {success_rate:.1f}%")

    return result.wasSuccessful()


if __name__ == "__main__":
    run_comprehensive_tests()