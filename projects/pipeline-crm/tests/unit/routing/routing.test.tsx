import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { Dashboard, Leads, Login, Settings, PipelineView } from '@/pages';
import { Layout } from '@/components/layout/Layout';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      // Default to unauthenticated
      callback(null);
      return vi.fn();
    }),
  },
  googleProvider: {},
}));

// Mock useAuth for controlled testing
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Routes', () => {
    it('renders Login page at /login', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Pipeline CRM')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });
  });

  describe('Protected Routes - Unauthenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('redirects to /login when accessing / without auth', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      // Should redirect to login
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('redirects to /login when accessing /leads without auth', () => {
      render(
        <MemoryRouter initialEntries={['/leads']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="leads" element={<Leads />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });
  });

  describe('Protected Routes - Authenticated', () => {
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'member' as const,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });
    });

    it('renders Dashboard at / when authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Welcome to Pipeline CRM')).toBeInTheDocument();
    });

    it('renders Leads page at /leads when authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/leads']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="leads" element={<Leads />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    });

    it('renders Settings page at /settings when authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });

    it('renders Pipeline page at /pipeline/studios when authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/pipeline/studios']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="pipeline/:type" element={<PipelineView />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Studios Pipeline' })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        signIn: vi.fn(),
        signOut: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <ConfigProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                </Route>
              </Routes>
            </ConfigProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});
