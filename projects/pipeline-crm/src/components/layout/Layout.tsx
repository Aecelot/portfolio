import React, { useState, useRef, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import type { TopBarRef } from './TopBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { LeadCreateDialog } from '@/components/leads/LeadCreateDialog';

export const Layout: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const topBarRef = useRef<TopBarRef>(null);

  // Keyboard shortcuts
  const shortcuts = useMemo(
    () => [
      {
        key: 'n',
        handler: () => setShowCreateDialog(true),
        description: 'Create new lead',
      },
      {
        key: '/',
        handler: () => topBarRef.current?.focusSearch(),
        description: 'Focus search',
      },
      {
        key: 'Escape',
        handler: () => {
          setShowCreateDialog(false);
          topBarRef.current?.clearSearch();
        },
        description: 'Close dialog / Clear search',
      },
    ],
    []
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar ref={topBarRef} onSearch={setSearchTerm} />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet context={{ searchTerm }} />
        </main>
      </div>

      {/* New Lead Dialog - triggered by 'N' key */}
      <LeadCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};
