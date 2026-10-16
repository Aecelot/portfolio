import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  Calendar,
  Users,
  Clock,
  CalendarCheck,
  Building2,
  UserCheck,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Lead, LeadSource, CompanySize } from '@/types/lead';

interface LeadQualificationInfoProps {
  lead: Lead;
}

const sourceLabels: Record<LeadSource, string> = {
  website: 'Website',
  referral: 'Referral',
  conference: 'Conference',
  cold_outreach: 'Cold Outreach',
  linkedin: 'LinkedIn',
  inbound: 'Inbound',
  other: 'Other',
};

const sizeLabels: Record<CompanySize, string> = {
  startup: 'Startup (1-10)',
  small: 'Small (11-50)',
  medium: 'Medium (51-200)',
  large: 'Large (201-1000)',
  enterprise: 'Enterprise (1000+)',
};

const formatDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : dateValue?.toDate?.() ?? new Date(dateValue);
  return format(date, 'MMM d, yyyy');
};

const formatRelativeDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? dateValue : dateValue?.toDate?.() ?? new Date(dateValue);
  return formatDistanceToNow(date, { addSuffix: true });
};

// Calculate qualification completion score
export const getQualificationScore = (lead: Lead): { filled: number; total: number; percentage: number } => {
  const qualificationFields = [
    'budgetRange',
    'decisionTimeline',
    'leadSource',
    'companySize',
    'lastContactedAt',
    'nextFollowUpAt',
  ] as const;

  let filled = 0;
  for (const field of qualificationFields) {
    const value = lead[field];
    if (value !== undefined && value !== null && value !== '') {
      filled++;
    }
  }

  // isDecisionMaker is a boolean, count it if explicitly set to true
  if (lead.isDecisionMaker === true) {
    filled++;
  }

  const total = qualificationFields.length + 1; // +1 for isDecisionMaker
  return {
    filled,
    total,
    percentage: Math.round((filled / total) * 100),
  };
};

export const LeadQualificationInfo: React.FC<LeadQualificationInfoProps> = ({ lead }) => {
  const qualificationScore = useMemo(() => getQualificationScore(lead), [lead]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Qualification</CardTitle>
          <span className="text-sm text-muted-foreground">
            {qualificationScore.filled}/{qualificationScore.total} fields
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Progress
            value={qualificationScore.percentage}
            className="h-2"
          />
          <span className={`text-xs font-medium ${
            qualificationScore.percentage >= 80 ? 'text-green-600' :
            qualificationScore.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {qualificationScore.percentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {lead.budgetRange && (
            <div className="flex items-center gap-3 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Budget:</span>
              <span className="font-medium">{lead.budgetRange}</span>
            </div>
          )}

          {lead.decisionTimeline && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Timeline:</span>
              <span className="font-medium">{lead.decisionTimeline}</span>
            </div>
          )}

          {lead.leadSource && (
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Source:</span>
              <Badge variant="secondary">{sourceLabels[lead.leadSource]}</Badge>
            </div>
          )}

          {lead.companySize && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Company Size:</span>
              <span className="font-medium">{sizeLabels[lead.companySize]}</span>
            </div>
          )}

          {lead.isDecisionMaker && (
            <div className="flex items-center gap-3 text-sm">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">Key Decision Maker</span>
            </div>
          )}
        </div>

        {(lead.lastContactedAt || lead.nextFollowUpAt) && (
          <div className="pt-4 border-t space-y-3">
            {lead.lastContactedAt && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Contacted:</span>
                <span title={formatDate(lead.lastContactedAt) || ''}>
                  {formatRelativeDate(lead.lastContactedAt)}
                </span>
              </div>
            )}

            {lead.nextFollowUpAt && (
              <div className="flex items-center gap-3 text-sm">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Next Follow-up:</span>
                <span className="font-medium">{formatDate(lead.nextFollowUpAt)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
