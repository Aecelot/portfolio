import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building,
  DollarSign,
  Hash,
  Shield,
  Mail,
  Newspaper,
  Settings,
  LogOut,
  User,
  BookUser,
  CheckSquare,
  Calendar,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Contacts', href: '/contacts', icon: BookUser },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Subsidies', href: '/subsidies', icon: Banknote },
  { name: 'Studios Pipeline', href: '/pipeline/studios', icon: Building },
  { name: 'Investors Pipeline', href: '/pipeline/investors', icon: DollarSign },
  { name: 'Channels Pipeline', href: '/pipeline/channels', icon: Hash },
  { name: 'Competition Pipeline', href: '/pipeline/competition', icon: Shield },
  { name: 'Sequences', href: '/sequences', icon: Mail },
  { name: 'Newsletters', href: '/newsletters', icon: Newspaper },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    signOut().catch(() => toast.error('Failed to sign out'));
  };

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b px-6">
        <h1 className="text-xl font-bold text-foreground">Pipeline CRM</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t p-4">
        <div className="flex items-center space-x-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="h-8 w-8 rounded-full" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSignOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};