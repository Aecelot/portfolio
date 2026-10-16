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

interface LeadsByTypeChartProps {
  leads: Lead[];
  loading?: boolean;
}

const TYPE_COLORS = {
  studio: '#a855f7', // Purple
  investor: '#22c55e', // Green
};

export const LeadsByTypeChart: React.FC<LeadsByTypeChartProps> = ({
  leads,
  loading,
}) => {
  const chartData = useMemo(() => {
    const studios = leads.filter((l) => l.type === 'studio').length;
    const investors = leads.filter((l) => l.type === 'investor').length;

    return [
      { name: 'Studios', value: studios, color: TYPE_COLORS.studio },
      { name: 'Investors', value: investors, color: TYPE_COLORS.investor },
    ].filter((d) => d.value > 0);
  }, [leads]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads by Type</CardTitle>
          <CardDescription>Distribution of lead types</CardDescription>
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
          <CardTitle>Leads by Type</CardTitle>
          <CardDescription>Distribution of lead types</CardDescription>
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
        <CardTitle>Leads by Type</CardTitle>
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
