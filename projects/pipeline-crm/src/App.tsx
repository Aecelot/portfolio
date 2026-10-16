import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { ProtectedRoute, ErrorBoundary } from '@/components/common';
import { Layout } from '@/components/layout/Layout';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import './index.css';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
// Using paginated leads page for better performance
const Leads = lazy(() => import('@/pages/LeadsPaginated').then(m => ({ default: m.LeadsPaginated })));
const LeadDetail = lazy(() => import('@/pages/LeadDetail').then(m => ({ default: m.LeadDetail })));
const Contacts = lazy(() => import('@/pages/Contacts').then(m => ({ default: m.Contacts })));
const Login = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const PipelineView = lazy(() => import('@/pages/PipelineView').then(m => ({ default: m.PipelineView })));
const Sequences = lazy(() => import('@/pages/Sequences').then(m => ({ default: m.Sequences })));
const BulkEnroll = lazy(() => import('@/pages/BulkEnroll').then(m => ({ default: m.BulkEnroll })));
const Newsletters = lazy(() => import('@/pages/Newsletters').then(m => ({ default: m.Newsletters })));
const NewsletterCompose = lazy(() => import('@/pages/NewsletterCompose').then(m => ({ default: m.NewsletterCompose })));
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Tasks = lazy(() => import('@/pages/Tasks').then(m => ({ default: m.Tasks })));
const Events = lazy(() => import('@/pages/Events').then(m => ({ default: m.Events })));
const Subsidies = lazy(() => import('@/pages/Subsidies').then(m => ({ default: m.Subsidies })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex-1 p-6">
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ConfigProvider>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />

                  {/* Protected routes with layout */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="leads" element={<Leads />} />
                    <Route path="leads/:id" element={<LeadDetail />} />
                    <Route path="contacts" element={<Contacts />} />
                    <Route path="pipeline/:type" element={<PipelineView />} />
                    <Route path="sequences" element={<Sequences />} />
                    <Route path="sequences/enroll" element={<BulkEnroll />} />
                    <Route path="newsletters" element={<Newsletters />} />
                    <Route path="newsletters/compose" element={<NewsletterCompose />} />
                    <Route path="newsletters/compose/:id" element={<NewsletterCompose />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="events" element={<Events />} />
                    <Route path="subsidies" element={<Subsidies />} />
                  </Route>

                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
            <Toaster richColors position="top-right" />
          </ConfigProvider>
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
