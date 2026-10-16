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
import { calculateCommunityFitScore } from '@/lib/utils';
import type { Lead, CommunityInfo, CommunityFitCriteria, CommunityPlatform, CommunityType } from '@/types/lead';
import { COMMUNITY_PLATFORM_LABELS, COMMUNITY_TYPE_LABELS } from '@/types/lead';

interface LeadCommunityFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: CommunityInfo) => void;
  errors?: Record<string, string>;
}

// Helper to generate referral code from name
function generateReferralCode(name: string, platform?: CommunityPlatform): string {
  const baseName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30);

  if (platform && platform !== 'other') {
    return `${platform}-${baseName}`;
  }
  return baseName;
}

export const LeadCommunityFields: React.FC<LeadCommunityFieldsProps> = ({
  values,
  onChange,
}) => {
  const community: Partial<CommunityInfo> = values.community || {};
  const fitCriteria: CommunityFitCriteria = community.fitCriteria || {};

  const handleCommunityChange = (
    field: keyof CommunityInfo,
    value: string | number | boolean | CommunityFitCriteria | Date
  ) => {
    const newCommunity = {
      ...community,
      [field]: value,
    } as CommunityInfo;

    // Auto-calculate fitScore when criteria changes
    if (field === 'fitCriteria') {
      newCommunity.fitScore = calculateCommunityFitScore(value as CommunityFitCriteria);
    }

    // Auto-generate referral code when platform changes (if not manually set)
    if (field === 'platform' && values.name && !community.referralCode) {
      newCommunity.referralCode = generateReferralCode(values.name, value as CommunityPlatform);
    }

    onChange('community', newCommunity);
  };

  const handleCriteriaChange = (field: keyof CommunityFitCriteria, value: boolean | number | string) => {
    const newCriteria = {
      ...fitCriteria,
      [field]: value,
    };
    handleCommunityChange('fitCriteria', newCriteria);
  };

  // Calculate fit score for display
  const calculatedFitScore = calculateCommunityFitScore(fitCriteria);

  // Sync fitScore with calculated value on mount if criteria exists
  useEffect(() => {
    if (fitCriteria && Object.keys(fitCriteria).length > 0 && community.fitScore !== calculatedFitScore) {
      onChange('community', {
        ...community,
        fitScore: calculatedFitScore,
      } as CommunityInfo);
    }
  }, []);

  // Auto-generate referral code when name changes (if not manually set)
  useEffect(() => {
    if (values.name && !community.referralCode) {
      const newCommunity = {
        ...community,
        referralCode: generateReferralCode(values.name, community.platform),
      } as CommunityInfo;
      onChange('community', newCommunity);
    }
  }, [values.name]);

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Community Details</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="communityPlatform">Platform</Label>
          <Select
            value={community.platform || ''}
            onValueChange={(value) => handleCommunityChange('platform', value as CommunityPlatform)}
          >
            <SelectTrigger id="communityPlatform">
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(COMMUNITY_PLATFORM_LABELS) as [CommunityPlatform, string][]).map(
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
          <Label htmlFor="communityType">Community Type</Label>
          <Select
            value={community.communityType || ''}
            onValueChange={(value) => handleCommunityChange('communityType', value as CommunityType)}
          >
            <SelectTrigger id="communityType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(COMMUNITY_TYPE_LABELS) as [CommunityType, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="estimatedReach">Estimated Reach</Label>
          <Input
            id="estimatedReach"
            type="number"
            value={community.estimatedReach || ''}
            onChange={(e) => handleCommunityChange('estimatedReach', parseInt(e.target.value) || 0)}
            placeholder="e.g., 10000"
          />
          <p className="text-xs text-muted-foreground">Members, followers, or participants</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="engagementQuality">Engagement Quality</Label>
          <Select
            value={community.engagementQuality || ''}
            onValueChange={(value) =>
              handleCommunityChange('engagementQuality', value as 'high' | 'medium' | 'low')
            }
          >
            <SelectTrigger id="engagementQuality">
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High (very active)</SelectItem>
              <SelectItem value="medium">Medium (regular activity)</SelectItem>
              <SelectItem value="low">Low (occasional activity)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accessMethod">Access Method</Label>
          <Select
            value={community.accessMethod || ''}
            onValueChange={(value) =>
              handleCommunityChange('accessMethod', value as 'public' | 'invite-only' | 'paid' | 'application')
            }
          >
            <SelectTrigger id="accessMethod">
              <SelectValue placeholder="Select access" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="invite-only">Invite Only</SelectItem>
              <SelectItem value="application">Application Required</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="platformUrl">Platform URL</Label>
          <Input
            id="platformUrl"
            value={community.platformUrl || ''}
            onChange={(e) => handleCommunityChange('platformUrl', e.target.value)}
            placeholder="https://discord.gg/... or subreddit URL"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="narrativeFocusToggle"
          checked={community.narrativeFocus || false}
          onChange={(e) => handleCommunityChange('narrativeFocus', e.target.checked)}
        />
        <Label htmlFor="narrativeFocusToggle" className="text-sm font-normal cursor-pointer">
          Narrative/storytelling focused community
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="postingRules">Posting Rules / Notes</Label>
        <Textarea
          id="postingRules"
          value={community.postingRules || ''}
          onChange={(e) => handleCommunityChange('postingRules', e.target.value)}
          placeholder="Self-promo rules, showcase channel info, best times to post..."
          rows={3}
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-medium text-sm">Attribution</h4>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="referralCode">Referral Code</Label>
            <Input
              id="referralCode"
              value={community.referralCode || ''}
              onChange={(e) => handleCommunityChange('referralCode', e.target.value)}
              placeholder="e.g., reddit-gamedev"
            />
            <p className="text-xs text-muted-foreground">Used in UTM parameters: ?ref=code</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="betaSignupsAttributed">Beta Signups Attributed</Label>
            <Input
              id="betaSignupsAttributed"
              type="number"
              value={community.betaSignupsAttributed || 0}
              onChange={(e) => handleCommunityChange('betaSignupsAttributed', parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Fit Score Criteria</h4>
          <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">
            Score: {calculatedFitScore}/12
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="narrativeFocused"
              checked={fitCriteria.narrativeFocused || false}
              onChange={(e) => handleCriteriaChange('narrativeFocused', e.target.checked)}
            />
            <Label htmlFor="narrativeFocused" className="text-sm font-normal cursor-pointer">
              Narrative/IF/storytelling focused <span className="text-muted-foreground">+3</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="activeCommunity"
              checked={fitCriteria.activeCommunity || false}
              onChange={(e) => handleCriteriaChange('activeCommunity', e.target.checked)}
            />
            <Label htmlFor="activeCommunity" className="text-sm font-normal cursor-pointer">
              Active community (regular posts, engaged members) <span className="text-muted-foreground">+3</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="toolFriendly"
              checked={fitCriteria.toolFriendly || false}
              onChange={(e) => handleCriteriaChange('toolFriendly', e.target.checked)}
            />
            <Label htmlFor="toolFriendly" className="text-sm font-normal cursor-pointer">
              Tool-friendly (welcomes showcases, has promo channels) <span className="text-muted-foreground">+2</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="targetDemographic"
              checked={fitCriteria.targetDemographic || false}
              onChange={(e) => handleCriteriaChange('targetDemographic', e.target.checked)}
            />
            <Label htmlFor="targetDemographic" className="text-sm font-normal cursor-pointer">
              Target demographic (indies, students, small teams) <span className="text-muted-foreground">+2</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="largeReach"
              checked={fitCriteria.largeReach || false}
              onChange={(e) => handleCriteriaChange('largeReach', e.target.checked)}
            />
            <Label htmlFor="largeReach" className="text-sm font-normal cursor-pointer">
              Large reach (10K+ members/followers) <span className="text-muted-foreground">+1</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="lowSaturation"
              checked={fitCriteria.lowSaturation || false}
              onChange={(e) => handleCriteriaChange('lowSaturation', e.target.checked)}
            />
            <Label htmlFor="lowSaturation" className="text-sm font-normal cursor-pointer">
              Low saturation (not flooded with tool announcements) <span className="text-muted-foreground">+1</span>
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
