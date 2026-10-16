import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
  },
  db: {},
  googleProvider: {},
}));

// Mock Firestore operations
vi.mock('@/lib/firestore', () => ({
  getLeadsRealtime: vi.fn((callback) => {
    callback([]);
    return vi.fn();
  }),
  getPipelinesRealtime: vi.fn((callback) => {
    callback([]);
    return vi.fn();
  }),
  getNotesForLeadRealtime: vi.fn((_leadId, callback) => {
    callback([]);
    return vi.fn();
  }),
  createLead: vi.fn().mockResolvedValue('mock-id'),
  updateLead: vi.fn().mockResolvedValue(undefined),
  deleteLead: vi.fn().mockResolvedValue(undefined),
  updateLeadStage: vi.fn().mockResolvedValue(undefined),
  createNote: vi.fn().mockResolvedValue('mock-note-id'),
  updateNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  initializeDefaultPipelines: vi.fn().mockResolvedValue(['studio-pipeline', 'investor-pipeline']),
}));

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});
