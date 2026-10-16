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
import type { Lead } from '@/types/lead';

interface LeadsByPriorityChartProps {
  leads: Lead[];
  loading?: boolean;
}

const PRIORITY_COLORS = {
  high: '#ef4444', // Red
  medium: '#eab308', // Yellow
  low: '#3b82f6', // Blue
  none: '#6b7280', // Gray
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

export const LeadsByPriorityChart: React.FC<LeadsByPriorityChartProps> = ({
  leads,
  loading,
}) => {
  const chartData = useMemo(() => {
    const priorities = {
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    leads.forEach((lead) => {
      const priority = lead.priority || 'none';
      priorities[priority]++;
    });

    return Object.entries(priorities)
      .map(([key, value]) => ({
        name: PRIORITY_LABELS[key as keyof typeof PRIORITY_LABELS],
        value,
        color: PRIORITY_COLORS[key as keyof typeof PRIORITY_COLORS],
      }))
      .filter((d) => d.value > 0);
  }, [leads]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads by Priority</CardTitle>
          <CardDescription>Priority distribution</CardDescription>
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
          <CardTitle>Leads by Priority</CardTitle>
          <CardDescription>Priority distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No leads yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads by Priority</CardTitle>
        <CardDescription>Priority distribution</CardDescription>
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
              label={({ name, value }) => `${name}: ${value}`}
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
