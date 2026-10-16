import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Lead } from '@/types/lead';

interface RecentLeadsProps {
  leads: Lead[];
  loading?: boolean;
  limit?: number;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export const RecentLeads: React.FC<RecentLeadsProps> = ({
  leads,
  loading,
  limit = 5,
}) => {
  const recentLeads = React.useMemo(() => {
    return [...leads]
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.() ?? new Date(0);
        const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.() ?? new Date(0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, limit);
  }, [leads, limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentLeads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No leads yet. Add your first lead to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Leads</CardTitle>
        <Link
          to="/leads"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentLeads.map((lead) => {
            const createdAt = lead.createdAt instanceof Date
              ? lead.createdAt
              : lead.createdAt?.toDate?.() ?? new Date();
            const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });

            return (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                className="flex items-center gap-4 p-2 -mx-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  {lead.type === 'studio' ? (
                    <Building className="h-5 w-5 text-primary" />
                  ) : (
                    <DollarSign className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.contact.name} • {timeAgo}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={priorityColors[lead.priority] || priorityColors.none}
                >
                  {lead.priority}
                </Badge>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
