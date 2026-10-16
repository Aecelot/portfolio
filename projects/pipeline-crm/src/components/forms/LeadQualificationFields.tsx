import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Lead, LeadSource, CompanySize } from '@/types/lead';

interface LeadQualificationFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: unknown) => void;
  errors?: Record<string, string>;
}

const leadSourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'conference', label: 'Conference' },
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

const companySizeOptions: { value: CompanySize; label: string }[] = [
  { value: 'startup', label: 'Startup (1-10)' },
  { value: 'small', label: 'Small (11-50)' },
  { value: 'medium', label: 'Medium (51-200)' },
  { value: 'large', label: 'Large (201-1000)' },
  { value: 'enterprise', label: 'Enterprise (1000+)' },
];

export const LeadQualificationFields: React.FC<LeadQualificationFieldsProps> = ({
  values,
  onChange,
  errors = {},
}) => {
  // Format date for input
  const formatDateForInput = (dateValue: any): string => {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : dateValue?.toDate?.() ?? new Date(dateValue);
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-sm text-muted-foreground">Qualification</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="budgetRange">Budget / Deal Size</Label>
          <Input
            id="budgetRange"
            value={values.budgetRange || ''}
            onChange={(e) => onChange('budgetRange', e.target.value)}
            placeholder="e.g., $50k-100k"
            className={errors.budgetRange ? 'border-destructive' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="decisionTimeline">Decision Timeline</Label>
          <Input
            id="decisionTimeline"
            value={values.decisionTimeline || ''}
            onChange={(e) => onChange('decisionTimeline', e.target.value)}
            placeholder="e.g., Q2 2026, 3 months"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="leadSource">Lead Source</Label>
          <Select
            value={values.leadSource || ''}
            onValueChange={(value) => onChange('leadSource', value)}
          >
            <SelectTrigger id="leadSource">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {leadSourceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="companySize">Company Size</Label>
          <Select
            value={values.companySize || ''}
            onValueChange={(value) => onChange('companySize', value)}
          >
            <SelectTrigger id="companySize">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {companySizeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lastContactedAt">Last Contacted</Label>
          <Input
            id="lastContactedAt"
            type="date"
            value={formatDateForInput(values.lastContactedAt)}
            onChange={(e) => onChange('lastContactedAt', e.target.value ? new Date(e.target.value) : null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nextFollowUpAt">Next Follow-up</Label>
          <Input
            id="nextFollowUpAt"
            type="date"
            value={formatDateForInput(values.nextFollowUpAt)}
            onChange={(e) => onChange('nextFollowUpAt', e.target.value ? new Date(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isDecisionMaker"
          checked={values.isDecisionMaker || false}
          onChange={(e) => onChange('isDecisionMaker', e.target.checked)}
        />
        <Label htmlFor="isDecisionMaker" className="text-sm font-normal cursor-pointer">
          Contact is a key decision maker
        </Label>
      </div>

      <h3 className="font-medium text-sm text-muted-foreground pt-4">Intent Signals</h3>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="hasRequestedPricing"
          checked={values.hasRequestedPricing || false}
          onChange={(e) => onChange('hasRequestedPricing', e.target.checked)}
        />
        <Label htmlFor="hasRequestedPricing" className="text-sm font-normal cursor-pointer">
          Requested pricing information
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="hasRequestedDemo"
          checked={values.hasRequestedDemo || false}
          onChange={(e) => onChange('hasRequestedDemo', e.target.checked)}
        />
        <Label htmlFor="hasRequestedDemo" className="text-sm font-normal cursor-pointer">
          Requested demo or meeting
        </Label>
      </div>
    </div>
  );
};
