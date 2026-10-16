import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, AlertTriangle, CalendarCheck, Calendar } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns';
import type { Lead } from '@/types/lead';

interface FollowUpWidgetProps {
  leads: Lead[];
  loading?: boolean;
}

type LeadWithFollowUp = Lead & { followUpDate: Date };

interface FollowUpGroup {
  label: string;
  icon: React.ReactNode;
  leads: LeadWithFollowUp[];
  badgeVariant: 'destructive' | 'default' | 'secondary' | 'outline';
}

const parseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (dateValue?.toDate) return dateValue.toDate();
  return new Date(dateValue);
};

export const FollowUpWidget: React.FC<FollowUpWidgetProps> = ({ leads, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5" />
            Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter and categorize leads with follow-up dates
  const leadsWithFollowUp: LeadWithFollowUp[] = leads
    .filter((lead) => lead.nextFollowUpAt)
    .map((lead) => ({
      ...lead,
      followUpDate: parseDate(lead.nextFollowUpAt)!,
    }))
    .sort((a, b) => a.followUpDate.getTime() - b.followUpDate.getTime());

  const overdue = leadsWithFollowUp.filter(
    (lead) => isPast(lead.followUpDate) && !isToday(lead.followUpDate)
  );
  const dueToday = leadsWithFollowUp.filter((lead) => isToday(lead.followUpDate));
  const dueTomorrow = leadsWithFollowUp.filter((lead) => isTomorrow(lead.followUpDate));
  const dueThisWeek = leadsWithFollowUp.filter(
    (lead) =>
      isThisWeek(lead.followUpDate) &&
      !isToday(lead.followUpDate) &&
      !isTomorrow(lead.followUpDate) &&
      !isPast(lead.followUpDate)
  );

  const groups: FollowUpGroup[] = ([
    {
      label: 'Overdue',
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      leads: overdue,
      badgeVariant: 'destructive' as const,
    },
    {
      label: 'Today',
      icon: <CalendarCheck className="h-4 w-4 text-orange-500" />,
      leads: dueToday,
      badgeVariant: 'default' as const,
    },
    {
      label: 'Tomorrow',
      icon: <Calendar className="h-4 w-4 text-blue-500" />,
      leads: dueTomorrow,
      badgeVariant: 'secondary' as const,
    },
    {
      label: 'This Week',
      icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
      leads: dueThisWeek,
      badgeVariant: 'outline' as const,
    },
  ] as FollowUpGroup[]).filter((group) => group.leads.length > 0);

  const totalFollowUps = overdue.length + dueToday.length + dueTomorrow.length + dueThisWeek.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Follow-ups
          </span>
          {totalFollowUps > 0 && (
            <Badge variant={overdue.length > 0 ? 'destructive' : 'secondary'}>
              {totalFollowUps} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming follow-ups scheduled
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-2">
                  {group.icon}
                  <span className="text-sm font-medium">{group.label}</span>
                  <Badge variant={group.badgeVariant} className="ml-auto">
                    {group.leads.length}
                  </Badge>
                </div>
                <ul className="space-y-1">
                  {group.leads.slice(0, 3).map((lead) => (
                    <li key={lead.id}>
                      <Link
                        to={`/leads/${lead.id}`}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-sm"
                      >
                        <span className="font-medium truncate">{lead.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(lead.followUpDate, 'MMM d')}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {group.leads.length > 3 && (
                    <li className="text-xs text-muted-foreground text-center py-1">
                      +{group.leads.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
