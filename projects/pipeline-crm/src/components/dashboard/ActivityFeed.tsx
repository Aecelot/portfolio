import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Edit, ArrowRight, MessageSquare, Activity, Phone, Mail, Calendar, Monitor, Linkedin, CircleDot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityType } from '@/types/activity';

// DerivedActivity type used by useActivity hook for dashboard
interface DerivedActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  description: string;
  createdAt: Date;
  leadName?: string;
}

interface ActivityFeedProps {
  activities: DerivedActivity[];
  loading?: boolean;
  limit?: number;
}

const activityIcons: Record<ActivityType, React.ElementType> = {
  lead_created: PlusCircle,
  lead_updated: Edit,
  lead_deleted: Activity,
  stage_changed: ArrowRight,
  note_added: MessageSquare,
  note_updated: MessageSquare,
  note_deleted: MessageSquare,
  // Manual activity types
  call: Phone,
  email: Mail,
  meeting: Calendar,
  demo: Monitor,
  linkedin_message: Linkedin,
  other: CircleDot,
};

const activityColors: Record<ActivityType, string> = {
  lead_created: 'text-green-500',
  lead_updated: 'text-blue-500',
  lead_deleted: 'text-red-500',
  stage_changed: 'text-purple-500',
  note_added: 'text-yellow-500',
  note_updated: 'text-orange-500',
  note_deleted: 'text-gray-500',
  // Manual activity types
  call: 'text-teal-500',
  email: 'text-cyan-500',
  meeting: 'text-indigo-500',
  demo: 'text-pink-500',
  linkedin_message: 'text-sky-500',
  other: 'text-slate-500',
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  loading,
  limit = 10,
}) => {
  const displayActivities = activities.slice(0, limit);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayActivities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No recent activity.</p>
            <p className="text-sm text-muted-foreground">
              Activities will appear here as you work with leads.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayActivities.map((activity) => {
            const Icon = activityIcons[activity.type] || Activity;
            const colorClass = activityColors[activity.type] || 'text-gray-500';
            const timeAgo = formatDistanceToNow(activity.createdAt, { addSuffix: true });

            return (
              <div key={activity.id} className="flex items-start gap-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-muted ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  {activity.leadId ? (
                    <Link
                      to={`/leads/${activity.leadId}`}
                      className="text-sm hover:underline"
                    >
                      {activity.description}
                    </Link>
                  ) : (
                    <p className="text-sm">{activity.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{timeAgo}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
