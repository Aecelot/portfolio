import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ConfigProvider,
  useConfig,
  defaultLeadTypes,
  defaultPriorities,
  defaultStatuses,
  defaultNoteStatuses,
  defaultTaskTypes,
} from '@/contexts/ConfigContext';

// Test component that uses the config
const ConfigConsumer = () => {
  const config = useConfig();

  return (
    <div>
      <div data-testid="title">{config.title}</div>
      <div data-testid="lead-types-count">{config.leadTypes.length}</div>
      <div data-testid="priorities-count">{config.priorities.length}</div>
      <div data-testid="statuses-count">{config.statuses.length}</div>
      <div data-testid="note-statuses-count">{config.noteStatuses.length}</div>
      <div data-testid="task-types-count">{config.taskTypes.length}</div>
      <ul data-testid="lead-types">
        {config.leadTypes.map((type) => (
          <li key={type.value}>{type.label}</li>
        ))}
      </ul>
      <ul data-testid="priorities">
        {config.priorities.map((p) => (
          <li key={p.value}>{p.label}</li>
        ))}
      </ul>
    </div>
  );
};

describe('ConfigContext', () => {
  describe('Default Configuration', () => {
    it('provides default title', () => {
      render(
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('title')).toHaveTextContent('Pipeline CRM');
    });

    it('provides default lead types (studio and investor)', () => {
      render(
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('lead-types-count')).toHaveTextContent('2');
      expect(screen.getByText('Studio')).toBeInTheDocument();
      expect(screen.getByText('Investor')).toBeInTheDocument();
    });

    it('provides default priorities', () => {
      render(
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('priorities-count')).toHaveTextContent('4');
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('None')).toBeInTheDocument();
    });

    it('provides default statuses', () => {
      render(
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('statuses-count')).toHaveTextContent('3');
    });

    it('provides default note statuses (cold/warm/hot)', () => {
      render(
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('note-statuses-count')).toHaveTextContent('3');
    });

    it('provides default task types', () => {
      render(
        <ConfigProvider>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('task-types-count')).toHaveTextContent('8');
    });
  });

  describe('Custom Configuration', () => {
    it('allows overriding title', () => {
      render(
        <ConfigProvider config={{ title: 'Custom CRM' }}>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('title')).toHaveTextContent('Custom CRM');
    });

    it('allows overriding lead types', () => {
      const customLeadTypes = [
        { value: 'partner', label: 'Partner' },
        { value: 'vendor', label: 'Vendor' },
        { value: 'client', label: 'Client' },
      ];

      render(
        <ConfigProvider config={{ leadTypes: customLeadTypes }}>
          <ConfigConsumer />
        </ConfigProvider>
      );

      expect(screen.getByTestId('lead-types-count')).toHaveTextContent('3');
      expect(screen.getByText('Partner')).toBeInTheDocument();
      expect(screen.getByText('Vendor')).toBeInTheDocument();
      expect(screen.getByText('Client')).toBeInTheDocument();
    });
  });

  describe('Exported Defaults', () => {
    it('exports correct default lead types', () => {
      expect(defaultLeadTypes).toEqual([
        { value: 'studio', label: 'Studio' },
        { value: 'investor', label: 'Investor' },
      ]);
    });

    it('exports correct default priorities', () => {
      expect(defaultPriorities).toHaveLength(4);
      expect(defaultPriorities[0]).toEqual({ value: 'high', label: 'High', color: 'red' });
    });

    it('exports correct default statuses', () => {
      expect(defaultStatuses).toHaveLength(3);
      expect(defaultStatuses.map(s => s.value)).toEqual(['active', 'inactive', 'archived']);
    });

    it('exports correct default note statuses', () => {
      expect(defaultNoteStatuses).toHaveLength(3);
      expect(defaultNoteStatuses.map(s => s.value)).toEqual(['cold', 'warm', 'hot']);
    });

    it('exports correct default task types', () => {
      expect(defaultTaskTypes).toContain('Email');
      expect(defaultTaskTypes).toContain('Call');
      expect(defaultTaskTypes).toContain('Meeting');
    });
  });
});
