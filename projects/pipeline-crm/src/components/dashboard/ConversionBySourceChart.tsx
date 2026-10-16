import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Lead, LeadSource } from '@/types/lead';

interface ConversionBySourceChartProps {
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
  cold_outreach: 'Cold',
  linkedin: 'LinkedIn',
  inbound: 'Inbound',
  other: 'Other',
  unknown: 'Unknown',
};

// Statuses that count as converted
const CONVERTED_STATUSES = ['closed-won', 'won', 'converted', 'closed'];

export const ConversionBySourceChart: React.FC<ConversionBySourceChartProps> = ({
  leads,
  loading,
}) => {
  const chartData = useMemo(() => {
    const sourceStats: Record<string, { total: number; converted: number }> = {};

    leads.forEach((lead) => {
      const source = lead.leadSource || 'unknown';
      if (!sourceStats[source]) {
        sourceStats[source] = { total: 0, converted: 0 };
      }
      sourceStats[source].total++;
      if (CONVERTED_STATUSES.includes(lead.status.toLowerCase())) {
        sourceStats[source].converted++;
      }
    });

    return Object.entries(sourceStats)
      .map(([source, stats]) => ({
        name: SOURCE_LABELS[source as LeadSource | 'unknown'] || source,
        rate: stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0,
        total: stats.total,
        converted: stats.converted,
        color: SOURCE_COLORS[source as LeadSource | 'unknown'] || SOURCE_COLORS.unknown,
      }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [leads]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion by Source</CardTitle>
          <CardDescription>Conversion rates by lead source</CardDescription>
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
          <CardTitle>Conversion by Source</CardTitle>
          <CardDescription>Conversion rates by lead source</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No leads yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalConverted = chartData.reduce((sum, d) => sum + d.converted, 0);
  const totalLeads = chartData.reduce((sum, d) => sum + d.total, 0);
  const overallRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion by Source</CardTitle>
        <CardDescription>{overallRate}% overall conversion rate</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={70} fontSize={12} />
            <Tooltip
              formatter={(value, _name, props) => [
                `${value}% (${props.payload.converted}/${props.payload.total})`,
                'Conversion Rate',
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
