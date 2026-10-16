import React from 'react';
import { useLeads } from '@/hooks/useLeads';
import { useActivity } from '@/hooks/useActivity';
import {
  StatsCards,
  RecentLeads,
  ActivityFeed,
  OnboardingEmptyState,
  LeadsByStageChart,
  LeadsByTypeChart,
  LeadsByPriorityChart,
} from '@/components/dashboard';

export const Dashboard: React.FC = () => {
  const { leads, loading: leadsLoading } = useLeads();
  const { activities, loading: activitiesLoading } = useActivity(10);

  // Show onboarding empty state for new users with no leads
  if (!leadsLoading && leads.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Pipeline CRM</p>
        </div>
        <OnboardingEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Pipeline CRM</p>
      </div>

      <StatsCards leads={leads} loading={leadsLoading} />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <LeadsByTypeChart leads={leads} loading={leadsLoading} />
        <LeadsByPriorityChart leads={leads} loading={leadsLoading} />
        <LeadsByStageChart leads={leads} pipelineType="studio" loading={leadsLoading} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RecentLeads leads={leads} loading={leadsLoading} limit={5} />
        <ActivityFeed activities={activities} loading={activitiesLoading} limit={10} />
      </div>
    </div>
  );
};
