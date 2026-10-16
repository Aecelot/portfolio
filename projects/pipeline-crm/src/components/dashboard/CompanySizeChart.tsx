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
import type { Lead, CompanySize } from '@/types/lead';

interface CompanySizeChartProps {
  leads: Lead[];
  loading?: boolean;
}

const SIZE_COLORS: Record<CompanySize | 'unknown', string> = {
  startup: '#22c55e', // Green
  small: '#3b82f6', // Blue
  medium: '#f59e0b', // Amber
  large: '#8b5cf6', // Violet
  enterprise: '#ef4444', // Red
  unknown: '#9ca3af', // Light gray
};

const SIZE_LABELS: Record<CompanySize | 'unknown', string> = {
  startup: 'Startup (1-10)',
  small: 'Small (11-50)',
  medium: 'Medium (51-200)',
  large: 'Large (201-1000)',
  enterprise: 'Enterprise (1000+)',
  unknown: 'Unknown',
};

// Order for consistent display
const SIZE_ORDER: (CompanySize | 'unknown')[] = [
  'startup',
  'small',
  'medium',
  'large',
  'enterprise',
  'unknown',
];

export const CompanySizeChart: React.FC<CompanySizeChartProps> = ({
  leads,
  loading,
}) => {
  const chartData = useMemo(() => {
    const sizeCounts: Record<string, number> = {};

    leads.forEach((lead) => {
      const size = lead.companySize || 'unknown';
      sizeCounts[size] = (sizeCounts[size] || 0) + 1;
    });

    return SIZE_ORDER
      .filter((size) => sizeCounts[size] && sizeCounts[size] > 0)
      .map((size) => ({
        name: SIZE_LABELS[size],
        value: sizeCounts[size],
        color: SIZE_COLORS[size],
      }));
  }, [leads]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Size</CardTitle>
          <CardDescription>Lead distribution by company size</CardDescription>
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
          <CardTitle>Company Size</CardTitle>
          <CardDescription>Lead distribution by company size</CardDescription>
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
        <CardTitle>Company Size</CardTitle>
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
                `${(name ?? '').split(' ')[0]} ${((percent ?? 0) * 100).toFixed(0)}%`
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
