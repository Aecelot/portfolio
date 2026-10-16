import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calculateInvestorFitScore } from '@/lib/utils';
import type { Lead, InvestorInfo, InvestorFitCriteria } from '@/types/lead';

interface LeadInvestorFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: InvestorInfo) => void;
  errors?: Record<string, string>;
}

export const LeadInvestorFields: React.FC<LeadInvestorFieldsProps> = ({
  values,
  onChange,
}) => {
  const investor: Partial<InvestorInfo> = values.investor || {};
  const fitCriteria: InvestorFitCriteria = investor.fitCriteria || {};

  const handleInvestorChange = (field: keyof InvestorInfo, value: string | string[] | number | InvestorFitCriteria) => {
    const newInvestor = {
      ...investor,
      [field]: value,
    } as InvestorInfo;

    // Auto-calculate fitScore when criteria changes
    if (field === 'fitCriteria') {
      newInvestor.fitScore = calculateInvestorFitScore(value as InvestorFitCriteria);
    }

    onChange('investor', newInvestor);
  };

  const handleCriteriaChange = (field: keyof InvestorFitCriteria, value: boolean | number | string) => {
    const newCriteria = {
      ...fitCriteria,
      [field]: value,
    };
    handleInvestorChange('fitCriteria', newCriteria);
  };

  const handleRegionsChange = (value: string) => {
    const regions = value.split(',').map((r) => r.trim()).filter(Boolean);
    handleInvestorChange('geographicalRegions', regions);
  };

  // Calculate fit score for display
  const calculatedFitScore = calculateInvestorFitScore(fitCriteria);

  // Sync fitScore with calculated value on mount if criteria exists
  useEffect(() => {
    if (fitCriteria && Object.keys(fitCriteria).length > 0 && investor.fitScore !== calculatedFitScore) {
      onChange('investor', {
        ...investor,
        fitScore: calculatedFitScore,
      } as InvestorInfo);
    }
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Investor Details</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="investorType">Investor Type</Label>
          <Select
            value={investor.type || ''}
            onValueChange={(value) => handleInvestorChange('type', value)}
          >
            <SelectTrigger id="investorType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vc">Venture Capital</SelectItem>
              <SelectItem value="angel">Angel Investor</SelectItem>
              <SelectItem value="publisher">Publisher</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="family-office">Family Office</SelectItem>
              <SelectItem value="pe">Private Equity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="investorFounded">Year Founded</Label>
          <Input
            id="investorFounded"
            value={investor.founded || ''}
            onChange={(e) => handleInvestorChange('founded', e.target.value)}
            placeholder="e.g., 2015"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="investorFocus">Investment Focus</Label>
        <Input
          id="investorFocus"
          value={investor.investmentFocus || ''}
          onChange={(e) => handleInvestorChange('investmentFocus', e.target.value)}
          placeholder="e.g., Gaming, Entertainment Tech"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="investorHqRegion">HQ Region</Label>
          <Input
            id="investorHqRegion"
            value={investor.hqRegion || ''}
            onChange={(e) => handleInvestorChange('hqRegion', e.target.value)}
            placeholder="e.g., North America"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="investorRegions">Geographical Regions</Label>
          <Input
            id="investorRegions"
            value={investor.geographicalRegions?.join(', ') || ''}
            onChange={(e) => handleRegionsChange(e.target.value)}
            placeholder="North America, Europe"
          />
          <p className="text-xs text-muted-foreground">Separate regions with commas</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="investorFundingPrefs">Funding Preferences</Label>
        <Textarea
          id="investorFundingPrefs"
          value={investor.fundingPreferences || ''}
          onChange={(e) => handleInvestorChange('fundingPreferences', e.target.value)}
          placeholder="Preferred investment stages, amounts, terms..."
          rows={3}
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Fit Score Criteria</h4>
          <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">
            Score: {calculatedFitScore}/10
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="preSeedFocus"
              checked={fitCriteria.preSeedFocus || false}
              onChange={(e) => handleCriteriaChange('preSeedFocus', e.target.checked)}
            />
            <Label htmlFor="preSeedFocus" className="text-sm font-normal cursor-pointer">
              Pre-seed stage focus <span className="text-muted-foreground">+3</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="gamingSectorActive"
              checked={fitCriteria.gamingSectorActive || false}
              onChange={(e) => handleCriteriaChange('gamingSectorActive', e.target.checked)}
            />
            <Label htmlFor="gamingSectorActive" className="text-sm font-normal cursor-pointer">
              Active in gaming sector <span className="text-muted-foreground">+3</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="aiDevToolsThesis"
              checked={fitCriteria.aiDevToolsThesis || false}
              onChange={(e) => handleCriteriaChange('aiDevToolsThesis', e.target.checked)}
            />
            <Label htmlFor="aiDevToolsThesis" className="text-sm font-normal cursor-pointer">
              AI / Dev Tools investment thesis <span className="text-muted-foreground">+2</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="euBased"
              checked={fitCriteria.euBased || false}
              onChange={(e) => handleCriteriaChange('euBased', e.target.checked)}
            />
            <Label htmlFor="euBased" className="text-sm font-normal cursor-pointer">
              EU-based or invests in EU <span className="text-muted-foreground">+1</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="relevantPortfolio"
              checked={fitCriteria.relevantPortfolio || false}
              onChange={(e) => handleCriteriaChange('relevantPortfolio', e.target.checked)}
            />
            <Label htmlFor="relevantPortfolio" className="text-sm font-normal cursor-pointer">
              Relevant portfolio companies <span className="text-muted-foreground">+1</span>
            </Label>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label className="text-sm font-medium">Other (custom adjustment)</Label>
          <div className="grid gap-3 sm:grid-cols-[1fr_80px]">
            <Input
              value={fitCriteria.otherReason || ''}
              onChange={(e) => handleCriteriaChange('otherReason', e.target.value)}
              placeholder="Reason for adjustment..."
            />
            <Input
              type="number"
              min={0}
              max={10}
              value={fitCriteria.otherScore ?? ''}
              onChange={(e) => handleCriteriaChange('otherScore', parseInt(e.target.value) || 0)}
              placeholder="+0"
            />
          </div>
          <p className="text-xs text-muted-foreground">Add custom points (0-10) with an explanation</p>
        </div>
      </div>
    </div>
  );
};
