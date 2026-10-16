import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// Note status for leads (cold/warm/hot)
export interface NoteStatus {
  value: string;
  label: string;
  color: string;
}

// Lead category config (prospect/lead)
export interface LeadCategoryConfig {
  value: string;
  label: string;
  color: string;
}

// Configuration interface for the CRM
export interface ConfigContextValue {
  // Lead types
  leadTypes: Array<{ value: string; label: string }>;

  // Priority levels
  priorities: Array<{ value: string; label: string; color: string }>;

  // Lead statuses
  statuses: Array<{ value: string; label: string }>;

  // Note statuses (temperature)
  noteStatuses: NoteStatus[];

  // Lead categories (prospect/lead)
  categories: LeadCategoryConfig[];

  // Task types
  taskTypes: string[];

  // App info
  title: string;
  logo?: string;
}

// Default configuration values
const defaultLeadTypes = [
  { value: 'studio', label: 'Studio' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'investor', label: 'Investor' },
  { value: 'community', label: 'Community' },
  { value: 'competition', label: 'Competition' },
];

const defaultPriorities = [
  { value: 'high', label: 'High', color: 'red' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'low', label: 'Low', color: 'blue' },
  { value: 'none', label: 'None', color: 'gray' },
];

const defaultStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const defaultNoteStatuses: NoteStatus[] = [
  { value: 'cold', label: 'Cold', color: 'blue' },
  { value: 'warm', label: 'Warm', color: 'yellow' },
  { value: 'hot', label: 'Hot', color: 'orange' },
];

const defaultCategories: LeadCategoryConfig[] = [
  { value: 'prospect', label: 'Prospect', color: 'orange' },
  { value: 'lead', label: 'Lead', color: 'teal' },
];

const defaultTaskTypes = [
  'Email',
  'Call',
  'Meeting',
  'Demo',
  'Follow-up',
  'Research',
  'Proposal',
  'Other',
];

const defaultConfig: ConfigContextValue = {
  leadTypes: defaultLeadTypes,
  priorities: defaultPriorities,
  statuses: defaultStatuses,
  noteStatuses: defaultNoteStatuses,
  categories: defaultCategories,
  taskTypes: defaultTaskTypes,
  title: 'Pipeline CRM',
};

// Create context
const ConfigContext = createContext<ConfigContextValue>(defaultConfig);

// Hook to use config
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Provider props
interface ConfigProviderProps {
  children: ReactNode;
  config?: Partial<ConfigContextValue>;
}

// Provider component
export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  config = {}
}) => {
  const value: ConfigContextValue = {
    ...defaultConfig,
    ...config,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

// Export defaults for testing
export {
  defaultLeadTypes,
  defaultPriorities,
  defaultStatuses,
  defaultNoteStatuses,
  defaultCategories,
  defaultTaskTypes,
  defaultConfig,
};
