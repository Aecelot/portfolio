import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Lead, LeadSource } from '@/types/lead';

interface LeadsBySourceChartProps {
  leads: Lead[];
  loading?: boolean;
}

const SOURCE_COLORS: Record<LeadSource | 'unknown', string> = {
  website: '#3b82f6', // Blue
  referral: '#22c55e', // Green
  conference: '#f59e0b', // Amber
  cold_outreach: '#8b5cf6', // Violet
  linkedin: '#0077b5', // LinkedIn blue
  inbound: '#06b6d4', // Cyan
  other: '#6b7280', // Gray
  unknown: '#9ca3af', // Light gray
};

const SOURCE_LABELS: Record<LeadSource | 'unknown', string> = {
  website: 'Website',
  referral: 'Referral',
  conference: 'Conference',
  cold_outreach: 'Cold Outreach',
  linkedin: 'LinkedIn',
  inbound: 'Inbound',
  other: 'Other',
  unknown: 'Unknown',
};

export const LeadsBySourceChart: React.FC<LeadsBySourceChartProps> = ({
  leads,
  loading,
}) => {
  const chartData = useMemo(() => {
    const sourceCounts: Record<string, number> = {};

    leads.forEach((lead) => {
      const source = lead.leadSource || 'unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    return Object.entries(sourceCounts)
      .map(([source, count]) => ({
        name: SOURCE_LABELS[source as LeadSource | 'unknown'] || source,
        value: count,
        color: SOURCE_COLORS[source as LeadSource | 'unknown'] || SOURCE_COLORS.unknown,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads by Source</CardTitle>
          <CardDescription>Where your leads come from</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads by Source</CardTitle>
          <CardDescription>Where your leads come from</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No leads yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads by Source</CardTitle>
        <CardDescription>{total} total leads</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value ?? 0} Leads`]}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
