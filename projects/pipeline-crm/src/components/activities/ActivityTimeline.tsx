import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivities } from '@/hooks/useActivities';
import type { Activity, ActivityType } from '@/types/activity';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  MessageSquarePlus,
  MessageSquare,
  MessageSquareX,
  History,
  Phone,
  Mail,
  Calendar,
  Monitor,
  Linkedin,
  CircleDot,
} from 'lucide-react';

interface ActivityTimelineProps {
  leadId: string;
  onLogActivity?: () => void;
}

// Map activity types to icons
const ActivityIcon: React.FC<{ type: ActivityType }> = ({ type }) => {
  const iconClass = 'h-4 w-4';
  switch (type) {
    case 'lead_created':
      return <Plus className={iconClass} />;
    case 'lead_updated':
      return <Pencil className={iconClass} />;
    case 'lead_deleted':
      return <Trash2 className={iconClass} />;
    case 'stage_changed':
      return <ArrowRight className={iconClass} />;
    case 'note_added':
      return <MessageSquarePlus className={iconClass} />;
    case 'note_updated':
      return <MessageSquare className={iconClass} />;
    case 'note_deleted':
      return <MessageSquareX className={iconClass} />;
    // Manual activity types
    case 'call':
      return <Phone className={iconClass} />;
    case 'email':
      return <Mail className={iconClass} />;
    case 'meeting':
      return <Calendar className={iconClass} />;
    case 'demo':
      return <Monitor className={iconClass} />;
    case 'linkedin_message':
      return <Linkedin className={iconClass} />;
    case 'other':
      return <CircleDot className={iconClass} />;
    default:
      return <History className={iconClass} />;
  }
};

// Get color classes for activity type
const getActivityColor = (type: ActivityType): string => {
  switch (type) {
    case 'lead_created':
      return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400';
    case 'lead_updated':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400';
    case 'lead_deleted':
      return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400';
    case 'stage_changed':
      return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400';
    case 'note_added':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400';
    case 'note_updated':
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400';
    case 'note_deleted':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    // Manual activity types - use teal/cyan for user interactions
    case 'call':
      return 'bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-400';
    case 'email':
      return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400';
    case 'meeting':
      return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400';
    case 'demo':
      return 'bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400';
    case 'linkedin_message':
      return 'bg-sky-100 text-sky-600 dark:bg-sky-900 dark:text-sky-400';
    case 'other':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
};

// Format timestamp
const formatTime = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Older - show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const ActivityItem: React.FC<{ activity: Activity }> = ({ activity }) => {
  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      {/* Icon */}
      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
        <ActivityIcon type={activity.type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{activity.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {activity.userEmail}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {formatTime(activity.createdAt)}
          </span>
        </div>

        {/* Show changes if available */}
        {activity.changes && activity.changes.length > 0 && (
          <div className="mt-2 text-xs space-y-1">
            {activity.changes.map((change, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">{change.field}:</span>
                <span className="line-through opacity-60">{String(change.from || '(empty)')}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{String(change.to || '(empty)')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ leadId, onLogActivity }) => {
  const { activities, loading } = useActivities(leadId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity ({activities.length})
          </CardTitle>
          {onLogActivity && (
            <Button variant="outline" size="sm" onClick={onLogActivity}>
              <Plus className="h-4 w-4 mr-1" />
              Log Activity
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No activity recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
