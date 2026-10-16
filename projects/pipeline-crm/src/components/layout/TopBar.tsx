import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Search, Bell, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface TopBarProps {
  onSearch?: (searchTerm: string) => void;
}

export interface TopBarRef {
  focusSearch: () => void;
  clearSearch: () => void;
}

export const TopBar = forwardRef<TopBarRef, TopBarProps>(({ onSearch }, ref) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
    clearSearch: () => {
      setSearchTerm('');
      onSearch?.('');
    },
  }));

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchTerm('');
      onSearch?.('');
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      {/* Search */}
      <div className="flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search leads... (press / to focus)"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className="pl-10"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>

        {/* User avatar */}
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || ''}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <span className="hidden sm:block text-sm font-medium">
            {user?.displayName}
          </span>
        </div>
      </div>
    </header>
  );
});

TopBar.displayName = 'TopBar';
