import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Lead, CompetitionInfo, CompetitionTargetMarket } from '@/types/lead';
import { COMPETITION_TARGET_LABELS } from '@/types/lead';

interface LeadCompetitionFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: CompetitionInfo) => void;
  errors?: Record<string, string>;
}

export const LeadCompetitionFields: React.FC<LeadCompetitionFieldsProps> = ({
  values,
  onChange,
}) => {
  const competition: Partial<CompetitionInfo> = values.competition || {};

  const handleCompetitionChange = (
    field: keyof CompetitionInfo,
    value: string | number | boolean | string[] | Date | undefined
  ) => {
    const newCompetition = {
      ...competition,
      [field]: value,
    } as CompetitionInfo;

    onChange('competition', newCompetition);
  };

  // Helper to handle array fields (products, strengths, weaknesses)
  const handleArrayChange = (field: 'products' | 'strengths' | 'weaknesses', value: string) => {
    const items = value.split('\n').filter(item => item.trim() !== '');
    handleCompetitionChange(field, items);
  };

  const getArrayValue = (field: 'products' | 'strengths' | 'weaknesses'): string => {
    const arr = competition[field];
    return Array.isArray(arr) ? arr.join('\n') : '';
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Competition Details</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="targetMarket">Target Market</Label>
          <Select
            value={competition.targetMarket || ''}
            onValueChange={(value) => handleCompetitionChange('targetMarket', value as CompetitionTargetMarket)}
          >
            <SelectTrigger id="targetMarket">
              <SelectValue placeholder="Select target" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(COMPETITION_TARGET_LABELS) as [CompetitionTargetMarket, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="threatLevel">Threat Level</Label>
          <Select
            value={competition.threatLevel?.toString() || ''}
            onValueChange={(value) => handleCompetitionChange('threatLevel', parseInt(value) as 1 | 2 | 3 | 4 | 5)}
          >
            <SelectTrigger id="threatLevel">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 - Minimal</SelectItem>
              <SelectItem value="2">2 - Low</SelectItem>
              <SelectItem value="3">3 - Moderate</SelectItem>
              <SelectItem value="4">4 - High</SelectItem>
              <SelectItem value="5">5 - Major Threat</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="products">Products (one per line)</Label>
        <Textarea
          id="products"
          value={getArrayValue('products')}
          onChange={(e) => handleArrayChange('products', e.target.value)}
          placeholder="AI dialogue system&#10;Quest generator&#10;NPC behavior tool"
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="strengths">Strengths (one per line)</Label>
          <Textarea
            id="strengths"
            value={getArrayValue('strengths')}
            onChange={(e) => handleArrayChange('strengths', e.target.value)}
            placeholder="Strong brand&#10;Large user base&#10;Good documentation"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weaknesses">Weaknesses (one per line)</Label>
          <Textarea
            id="weaknesses"
            value={getArrayValue('weaknesses')}
            onChange={(e) => handleArrayChange('weaknesses', e.target.value)}
            placeholder="Expensive pricing&#10;Limited integrations&#10;Slow updates"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="differentiator">What makes them different from us?</Label>
        <Textarea
          id="differentiator"
          value={competition.differentiator || ''}
          onChange={(e) => handleCompetitionChange('differentiator', e.target.value)}
          placeholder="Key differentiators and unique selling points..."
          rows={2}
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-medium text-sm">Company Context</h4>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fundingStage">Funding Stage</Label>
            <Input
              id="fundingStage"
              value={competition.fundingStage || ''}
              onChange={(e) => handleCompetitionChange('fundingStage', e.target.value)}
              placeholder="e.g., Series A, Bootstrapped"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamSize">Team Size</Label>
            <Input
              id="teamSize"
              value={competition.teamSize || ''}
              onChange={(e) => handleCompetitionChange('teamSize', e.target.value)}
              placeholder="e.g., 10-50, startup"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="foundedYear">Founded Year</Label>
            <Input
              id="foundedYear"
              type="number"
              value={competition.foundedYear || ''}
              onChange={(e) => handleCompetitionChange('foundedYear', parseInt(e.target.value) || undefined)}
              placeholder="e.g., 2020"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-medium text-sm">Links & Metrics</h4>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="competitionWebsite">Website</Label>
            <Input
              id="competitionWebsite"
              value={competition.website || ''}
              onChange={(e) => handleCompetitionChange('website', e.target.value)}
              placeholder="https://competitor.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricingInfo">Pricing Info</Label>
            <Input
              id="pricingInfo"
              value={competition.pricingInfo || ''}
              onChange={(e) => handleCompetitionChange('pricingInfo', e.target.value)}
              placeholder="e.g., $29/mo, freemium, enterprise"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="estimatedPaidUsers">Est. Paid Users</Label>
            <Input
              id="estimatedPaidUsers"
              type="number"
              value={competition.estimatedPaidUsers || ''}
              onChange={(e) => handleCompetitionChange('estimatedPaidUsers', parseInt(e.target.value) || undefined)}
              placeholder="e.g., 5000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedFreeUsers">Est. Free Users</Label>
            <Input
              id="estimatedFreeUsers"
              type="number"
              value={competition.estimatedFreeUsers || ''}
              onChange={(e) => handleCompetitionChange('estimatedFreeUsers', parseInt(e.target.value) || undefined)}
              placeholder="e.g., 50000"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="estimatedRevenue">Est. Revenue ($)</Label>
            <Input
              id="estimatedRevenue"
              type="number"
              value={competition.estimatedRevenue || ''}
              onChange={(e) => handleCompetitionChange('estimatedRevenue', parseInt(e.target.value) || undefined)}
              placeholder="e.g., 1000000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountRaised">Amount Raised ($)</Label>
            <Input
              id="amountRaised"
              type="number"
              value={competition.amountRaised || ''}
              onChange={(e) => handleCompetitionChange('amountRaised', parseInt(e.target.value) || undefined)}
              placeholder="e.g., 5000000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastChecked">Last Checked</Label>
          <Input
            id="lastChecked"
            type="date"
            value={competition.lastChecked ? new Date(competition.lastChecked).toISOString().split('T')[0] : ''}
            onChange={(e) => handleCompetitionChange('lastChecked', e.target.value ? new Date(e.target.value) : undefined)}
          />
          <p className="text-xs text-muted-foreground">When was this competitor last researched?</p>
        </div>
      </div>
    </div>
  );
};
