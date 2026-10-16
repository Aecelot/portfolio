import { vi } from 'vitest';

// Mock Firebase Auth
export const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((callback) => {
    callback(null);
    return vi.fn(); // Unsubscribe function
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
};

// Mock Firestore
export const mockDb = {
  collection: vi.fn(),
  doc: vi.fn(),
};

// Mock Google Auth Provider
export const mockGoogleProvider = {};

// Mock user for authenticated tests
export const mockUser = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

// Helper to set authenticated state
export const setAuthenticatedUser = (user = mockUser) => {
  mockAuth.currentUser = user as any;
  mockAuth.onAuthStateChanged.mockImplementation((callback) => {
    callback(user);
    return vi.fn();
  });
};

// Helper to set unauthenticated state
export const setUnauthenticatedUser = () => {
  mockAuth.currentUser = null;
  mockAuth.onAuthStateChanged.mockImplementation((callback) => {
    callback(null);
    return vi.fn();
  });
};

// Reset all mocks
export const resetFirebaseMocks = () => {
  mockAuth.currentUser = null;
  mockAuth.onAuthStateChanged.mockClear();
  mockAuth.signInWithPopup.mockClear();
  mockAuth.signOut.mockClear();
};
