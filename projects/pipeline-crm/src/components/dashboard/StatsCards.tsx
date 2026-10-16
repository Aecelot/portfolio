import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, DollarSign, Users, AlertCircle } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface StatsCardsProps {
  leads: Lead[];
  loading?: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ leads, loading }) => {
  const stats = React.useMemo(() => {
    const totalLeads = leads.length;
    const studios = leads.filter((l) => l.type === 'studio').length;
    const investors = leads.filter((l) => l.type === 'investor').length;
    const highPriority = leads.filter((l) => l.priority === 'high').length;

    return { totalLeads, studios, investors, highPriority };
  }, [leads]);

  const cards = [
    {
      title: 'Total Leads',
      value: stats.totalLeads,
      description: 'Studios and Investors',
      icon: Users,
    },
    {
      title: 'Studios',
      value: stats.studios,
      description: 'Game studios tracked',
      icon: Building,
    },
    {
      title: 'Investors',
      value: stats.investors,
      description: 'Investors tracked',
      icon: DollarSign,
    },
    {
      title: 'High Priority',
      value: stats.highPriority,
      description: 'Leads needing attention',
      icon: AlertCircle,
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded mb-1" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
