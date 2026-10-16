import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePipeline } from '@/hooks/usePipeline';
import type { Lead } from '@/types/lead';

interface LeadsByStageChartProps {
  leads: Lead[];
  pipelineType: 'studio' | 'investor' | 'community';
  loading?: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  gray: '#6b7280',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  green: '#22c55e',
  red: '#ef4444',
};

export const LeadsByStageChart: React.FC<LeadsByStageChartProps> = ({
  leads,
  pipelineType,
  loading,
}) => {
  const { pipelines, loading: pipelinesLoading } = usePipeline();

  const chartData = useMemo(() => {
    const pipeline = pipelines.find((p) => p.type === pipelineType);
    if (!pipeline) return [];

    const activeStages = pipeline.stages
      .filter((s) => s.isActive)
      .sort((a, b) => a.order - b.order);

    // Filter leads by type
    const typedLeads = leads.filter((l) => l.type === pipelineType);

    return activeStages.map((stage) => {
      const count = typedLeads.filter((l) => l.pipeline?.stageId === stage.id).length;
      return {
        name: stage.name,
        count,
        color: STAGE_COLORS[stage.color] || STAGE_COLORS.gray,
      };
    });
  }, [leads, pipelines, pipelineType]);

  const title = pipelineType === 'studio' ? 'Studios by Stage' : 'Investors by Stage';

  if (loading || pipelinesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Pipeline distribution</CardDescription>
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
          <CardTitle>{title}</CardTitle>
          <CardDescription>Pipeline distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No pipeline data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Pipeline distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [`${value ?? 0} Leads`]}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
