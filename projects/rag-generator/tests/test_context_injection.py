"""
Comprehensive tests for Context Injection System.

Tests the ContextInjectionEngine, InjectionDecisionLogic, and InjectionRuleManager
components of the chat frontend integration.
"""

import unittest
import time
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta

from src.rag.prompt_enhancement.context_injection import (
    ContextInjectionEngine, InjectionDecisionLogic, InjectionRuleManager,
    InjectionRule, InjectionRuleSet, InjectionPlan
)
from src.rag.prompt_enhancement.memory_classes import (
    MemoryClassifier, ClassifiedMemory, MemoryClass
)
from src.npc.npc_memory_bridge import NPCMemoryBridge


class TestInjectionDecisionLogic(unittest.TestCase):
    """Test cases for InjectionDecisionLogic."""

    def setUp(self):
        """Set up test fixtures."""
        self.decision_logic = InjectionDecisionLogic()

        # Mock classified memory
        self.character_memory = ClassifiedMemory(
            raw_memory={'description': 'I am a wise wizard'},
            memory_class=MemoryClass.CHARACTER,
            relevance_score=0.8,
            context_keywords=['wizard', 'wise'],
            formatted_content='CHARACTER: I am a wise wizard',
            injection_priority=70
        )

        self.player_memory = ClassifiedMemory(
            raw_memory={'description': 'Player helped me in battle'},
            memory_class=MemoryClass.PLAYER,
            relevance_score=0.9,
            context_keywords=['player', 'battle', 'help'],
            formatted_content='WITH PLAYER: Player helped me in battle',
            injection_priority=80
        )

    def test_analyze_injection_context_urgent(self):
        """Test context analysis for urgent situations."""
        context = {
            'player_input': 'Help! The dragon is attacking now!',
            'conversation_history': []
        }

        analysis = self.decision_logic.analyze_injection_context(
            context['player_input'], context)

        self.assertEqual(analysis['context_type'], 'urgent')
        self.assertGreater(analysis['urgency_level'], 0.7)

    def test_analyze_injection_context_emotional(self):
        """Test context analysis for emotional situations."""
        context = {
            'player_input': 'How do you feel about losing your family?',
            'conversation_history': []
        }

        analysis = self.decision_logic.analyze_injection_context(
            context['player_input'], context)

        self.assertEqual(analysis['context_type'], 'emotional')
        self.assertGreater(analysis['emotional_tone'], 0.6)

    def test_calculate_memory_priority(self):
        """Test memory priority calculation."""
        context_analysis = {
            'context_type': 'urgent',
            'urgency_level': 0.8,
            'emotional_tone': 0.2,
            'question_type': 'personal',
            'keyword_themes': ['magic'],
            'conversation_stage': 'developing'
        }

        priority = self.decision_logic.calculate_memory_priority(
            self.character_memory, context_analysis)

        self.assertGreater(priority, self.character_memory.injection_priority)

    def test_detect_memory_conflicts(self):
        """Test detection of conflicting memories."""
        memories = [self.character_memory, self.player_memory]

        # Create conflicting memory
        conflicting_memory = ClassifiedMemory(
            raw_memory={'description': 'I hate all players'},
            memory_class=MemoryClass.SOCIAL,
            relevance_score=0.7,
            context_keywords=['hate', 'players'],
            formatted_content='SOCIAL: I hate all players',
            injection_priority=50
        )

        memories.append(conflicting_memory)

        context = {'player_input': 'Do you like working with players?'}
        conflicts = self.decision_logic.detect_memory_conflicts(memories, context)

        self.assertGreater(len(conflicts), 0)


class TestInjectionRuleManager(unittest.TestCase):
    """Test cases for InjectionRuleManager."""

    def setUp(self):
        """Set up test fixtures."""
        self.rule_manager = InjectionRuleManager()

    def test_create_default_rule_set(self):
        """Test creation of default rule set."""
        rule_set = self.rule_manager._create_default_rule_set()

        self.assertIsInstance(rule_set, InjectionRuleSet)
        self.assertIsNotNone(rule_set.rules)
        self.assertGreater(len(rule_set.rules), 0)
        self.assertEqual(rule_set.name, "default_injection_rules")

    def test_add_custom_rule(self):
        """Test adding custom injection rules."""
        custom_rule = InjectionRule(
            name="test_rule",
            description="Test rule for unit testing",
            priority=8,
            conditions={'context_type': 'urgent'},
            actions={'max_memories': 2}
        )

        self.rule_manager.add_custom_rule(custom_rule)

        self.assertIn(custom_rule, self.rule_manager.custom_rules)

    def test_get_applicable_rules(self):
        """Test retrieval of applicable rules."""
        context = {
            'context_type': 'urgent',
            'urgency_level': 0.8,
            'conversation_stage': 'new'
        }

        applicable_rules = self.rule_manager.get_applicable_rules(context)

        self.assertGreater(len(applicable_rules), 0)

        # Should include urgent_context rule
        rule_names = [rule.name for rule in applicable_rules]
        self.assertIn('urgent_context', rule_names)

    def test_rule_validation(self):
        """Test rule validation functionality."""
        errors = self.rule_manager.validate_rules()

        # Default rules should be valid
        self.assertEqual(len(errors), 0)


class TestContextInjectionEngine(unittest.TestCase):
    """Test cases for ContextInjectionEngine."""

    def setUp(self):
        """Set up test fixtures."""
        # Mock dependencies
        self.mock_classifier = Mock(spec=MemoryClassifier)
        self.mock_resolver = Mock()
        self.mock_bridge = Mock(spec=NPCMemoryBridge)

        self.injection_engine = ContextInjectionEngine(
            memory_classifier=self.mock_classifier,
            template_resolver=self.mock_resolver,
            memory_bridge=self.mock_bridge
        )

        # Setup mock classified memories
        self.mock_memories = [
            ClassifiedMemory(
                raw_memory={'description': 'Test memory 1'},
                memory_class=MemoryClass.CHARACTER,
                relevance_score=0.8,
                context_keywords=['test'],
                formatted_content='CHARACTER: Test memory 1',
                injection_priority=70
            ),
            ClassifiedMemory(
                raw_memory={'description': 'Test memory 2'},
                memory_class=MemoryClass.PLAYER,
                relevance_score=0.9,
                context_keywords=['test', 'player'],
                formatted_content='PLAYER: Test memory 2',
                injection_priority=80
            )
        ]

    def test_build_injected_context_success(self):
        """Test successful context injection building."""
        # Setup mocks
        self.mock_bridge.get_relevant_memories.return_value = [
            {'description': 'Test memory', 'memory_type': 'character'}
        ]
        self.mock_classifier.classify_memories.return_value = self.mock_memories

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Tell me about yourself',
            'conversation_history': []
        }

        result = self.injection_engine.build_injected_context(
            'test_npc', 'Tell me about yourself', context)

        self.assertTrue(result['injection_successful'])
        self.assertGreater(result['injection_time'], 0)
        self.assertIsInstance(result['injection_plan'], InjectionPlan)

    def test_build_injected_context_no_memories(self):
        """Test context injection when no memories are found."""
        # Setup mocks
        self.mock_bridge.get_relevant_memories.return_value = []
        self.mock_classifier.classify_memories.return_value = []

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Unknown topic',
            'conversation_history': []
        }

        result = self.injection_engine.build_injected_context(
            'test_npc', 'Unknown topic', context)

        self.assertTrue(result['injection_successful'])
        self.assertEqual(len(result['classified_memories']), 0)

    def test_build_injected_context_error_handling(self):
        """Test error handling in context injection."""
        # Setup mock to raise exception
        self.mock_bridge.get_relevant_memories.side_effect = Exception("Memory service error")

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Test input',
            'conversation_history': []
        }

        result = self.injection_engine.build_injected_context(
            'test_npc', 'Test input', context)

        self.assertFalse(result['injection_successful'])
        self.assertIsNotNone(result.get('error'))

    def test_memory_filtering_and_limits(self):
        """Test memory filtering and class limits."""
        # Create more memories than limits allow
        many_memories = []
        for i in range(10):
            memory = ClassifiedMemory(
                raw_memory={'description': f'Memory {i}'},
                memory_class=MemoryClass.CHARACTER if i % 2 == 0 else MemoryClass.PLAYER,
                relevance_score=0.8,
                context_keywords=['test'],
                formatted_content=f'Memory {i}',
                injection_priority=70 + i
            )
            many_memories.append(memory)

        # Setup mocks
        self.mock_bridge.get_relevant_memories.return_value = [
            {'description': f'Memory {i}'} for i in range(10)
        ]
        self.mock_classifier.classify_memories.return_value = many_memories

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Test input',
            'conversation_history': []
        }

        result = self.injection_engine.build_injected_context(
            'test_npc', 'Test input', context)

        # Should respect class limits (default character limit is 2)
        injected_memories = result['injection_plan'].memories_to_inject
        character_memories = [m for m in injected_memories if m.memory_class == MemoryClass.CHARACTER]

        self.assertLessEqual(len(character_memories), 2)

    def test_injection_stats_tracking(self):
        """Test injection statistics tracking."""
        # Setup successful injection
        self.mock_bridge.get_relevant_memories.return_value = [
            {'description': 'Test memory'}
        ]
        self.mock_classifier.classify_memories.return_value = self.mock_memories

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Test input',
            'conversation_history': []
        }

        # Perform injection
        self.injection_engine.build_injected_context('test_npc', 'Test input', context)

        stats = self.injection_engine.get_injection_stats()

        self.assertGreater(stats['total_injections'], 0)
        self.assertGreater(stats['successful_injections'], 0)
        self.assertGreater(stats['average_injection_time'], 0)

    def test_reset_stats(self):
        """Test statistics reset functionality."""
        # Perform some injections first
        self.mock_bridge.get_relevant_memories.return_value = [
            {'description': 'Test memory'}
        ]
        self.mock_classifier.classify_memories.return_value = self.mock_memories

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Test input',
            'conversation_history': []
        }

        self.injection_engine.build_injected_context('test_npc', 'Test input', context)

        # Reset stats
        self.injection_engine.reset_stats()

        stats = self.injection_engine.get_injection_stats()

        self.assertEqual(stats['total_injections'], 0)
        self.assertEqual(stats['successful_injections'], 0)


class TestContextInjectionIntegration(unittest.TestCase):
    """Integration tests for the complete context injection system."""

    def setUp(self):
        """Set up integration test fixtures."""
        # Create real instances for integration testing
        self.memory_classifier = MemoryClassifier()
        self.decision_logic = InjectionDecisionLogic()
        self.rule_manager = InjectionRuleManager()

        # Mock memory bridge for testing
        self.mock_bridge = Mock(spec=NPCMemoryBridge)
        self.mock_resolver = Mock()

        self.injection_engine = ContextInjectionEngine(
            memory_classifier=self.memory_classifier,
            template_resolver=self.mock_resolver,
            memory_bridge=self.mock_bridge
        )

    def test_end_to_end_memory_injection(self):
        """Test complete end-to-end memory injection process."""
        # Setup realistic test data
        test_memories = [
            {
                'description': 'I am a wise elven scholar who has studied ancient magic for centuries',
                'memory_type': 'character',
                'importance': 0.8
            },
            {
                'description': 'The player helped me defeat a group of bandits last week',
                'memory_type': 'player',
                'sentiment': 0.7
            },
            {
                'description': 'The ancient library contains forbidden knowledge',
                'memory_type': 'world',
                'importance': 0.6
            }
        ]

        # Setup mocks
        self.mock_bridge.get_relevant_memories.return_value = test_memories

        context = {
            'npc_id': 'elara_vynne',
            'player_input': 'Tell me about your background and how we met',
            'conversation_history': [
                {'sender': 'player', 'content': 'Hello, I need your help'},
                {'sender': 'elara_vynne', 'content': 'What do you require?'}
            ]
        }

        # Execute injection
        result = self.injection_engine.build_injected_context(
            'elara_vynne', 'Tell me about your background', context)

        # Verify results
        self.assertTrue(result['injection_successful'])
        self.assertGreater(len(result['classified_memories']), 0)

        # Check that memories were properly classified
        classified_memories = result['classified_memories']
        memory_classes = [mem.memory_class for mem in classified_memories]

        self.assertIn(MemoryClass.CHARACTER, memory_classes)
        self.assertIn(MemoryClass.PLAYER, memory_classes)

        # Verify injection plan
        injection_plan = result['injection_plan']
        self.assertIsInstance(injection_plan, InjectionPlan)
        self.assertGreater(injection_plan.injection_confidence, 0)

    def test_context_aware_injection(self):
        """Test context-aware memory injection."""
        # Test urgent context
        urgent_memories = [
            {
                'description': 'Emergency: Dragon attacking the village',
                'memory_type': 'triggered',
                'importance': 0.9
            }
        ]

        self.mock_bridge.get_relevant_memories.return_value = urgent_memories

        urgent_context = {
            'npc_id': 'test_npc',
            'player_input': 'Help! The dragon is attacking!',
            'conversation_history': []
        }

        result = self.injection_engine.build_injected_context(
            'test_npc', 'Help! The dragon is attacking!', urgent_context)

        # Should prioritize triggered memories in urgent situations
        if result['classified_memories']:
            top_memory = result['classified_memories'][0]
            self.assertEqual(top_memory.memory_class, MemoryClass.TRIGGERED)

    def test_memory_redundancy_detection(self):
        """Test detection and handling of redundant memories."""
        # Create redundant memories
        redundant_memories = [
            {
                'description': 'The player is my friend and ally',
                'memory_type': 'social',
                'importance': 0.7
            },
            {
                'description': 'I consider the player a friend',
                'memory_type': 'social',
                'importance': 0.6
            }
        ]

        self.mock_bridge.get_relevant_memories.return_value = redundant_memories

        context = {
            'npc_id': 'test_npc',
            'player_input': 'Are we friends?',
            'conversation_history': [
                {'sender': 'player', 'content': 'I consider you a friend'},
                {'sender': 'test_npc', 'content': 'That warms my heart'}
            ]
        }

        result = self.injection_engine.build_injected_context(
            'test_npc', 'Are we friends?', context)

        # Should detect redundancy and filter appropriately
        self.assertTrue(result['injection_successful'])


if __name__ == '__main__':
    # Create test suite
    test_suite = unittest.TestSuite()

    # Add test cases
    test_suite.addTest(unittest.makeSuite(TestInjectionDecisionLogic))
    test_suite.addTest(unittest.makeSuite(TestInjectionRuleManager))
    test_suite.addTest(unittest.makeSuite(TestContextInjectionEngine))
    test_suite.addTest(unittest.makeSuite(TestContextInjectionIntegration))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)

    # Print summary
    print(f"\nTest Summary:")
    print(f"Ran: {result.testsRun} tests")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")

    if result.failures:
        print(f"\nFailures:")
        for test, failure in result.failures:
            print(f"- {test}: {failure}")

    if result.errors:
        print(f"\nErrors:")
        for test, error in result.errors:
            print(f"- {test}: {error}")