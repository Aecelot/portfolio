import React, { useEffect } from 'react';
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
import { calculateStudioFitScore } from '@/lib/utils';
import type { Lead, StudioInfo, StudioFitCriteria, StudioSize, FitTag } from '@/types/lead';
import { STUDIO_SIZE_LABELS, FIT_TAGS } from '@/types/lead';

interface LeadStudioFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: StudioInfo) => void;
  errors?: Record<string, string>;
  isPublisher?: boolean;
}

export const LeadStudioFields: React.FC<LeadStudioFieldsProps> = ({
  values,
  onChange,
  isPublisher = false,
}) => {
  const studio: Partial<StudioInfo> = values.studio || {};
  const fitCriteria: StudioFitCriteria = studio.fitCriteria || {};

  const handleStudioChange = (field: keyof StudioInfo, value: string | number | string[] | StudioFitCriteria) => {
    const newStudio = {
      ...studio,
      [field]: value,
    } as StudioInfo;

    // Auto-calculate fitScore when criteria changes
    if (field === 'fitCriteria') {
      newStudio.fitScore = calculateStudioFitScore(value as StudioFitCriteria);
    }

    onChange('studio', newStudio);
  };

  const handleCriteriaChange = (field: keyof StudioFitCriteria, value: boolean | number | string) => {
    const newCriteria = {
      ...fitCriteria,
      [field]: value,
    };
    handleStudioChange('fitCriteria', newCriteria);
  };

  const handleGamesChange = (value: string) => {
    const games = value.split(',').map((g) => g.trim()).filter(Boolean);
    handleStudioChange('games', games);
  };

  const handleFitTagToggle = (tag: FitTag) => {
    const currentTags = studio.fitTags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    handleStudioChange('fitTags', newTags);
  };

  // Calculate fit score for display
  const calculatedFitScore = calculateStudioFitScore(fitCriteria);

  // Sync fitScore with calculated value on mount if criteria exists
  useEffect(() => {
    if (fitCriteria && Object.keys(fitCriteria).length > 0 && studio.fitScore !== calculatedFitScore) {
      onChange('studio', {
        ...studio,
        fitScore: calculatedFitScore,
      } as StudioInfo);
    }
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="font-medium">{isPublisher ? 'Publisher Details' : 'Studio Details'}</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="studioSize">Team Size</Label>
          <Select
            value={studio.size || ''}
            onValueChange={(value) => handleStudioChange('size', value as StudioSize)}
          >
            <SelectTrigger id="studioSize">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(STUDIO_SIZE_LABELS) as [StudioSize, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="studioType">Studio Type</Label>
          <Select
            value={studio.type || ''}
            onValueChange={(value) => handleStudioChange('type', value)}
          >
            <SelectTrigger id="studioType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indie">Indie</SelectItem>
              <SelectItem value="aa">AA</SelectItem>
              <SelectItem value="aaa">AAA</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="vr">VR/AR</SelectItem>
              <SelectItem value="serious">Serious Games</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="studioFocus">Focus/Genre</Label>
        <Input
          id="studioFocus"
          value={studio.focus || ''}
          onChange={(e) => handleStudioChange('focus', e.target.value)}
          placeholder="e.g., RPG, Action-Adventure"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="studioGames">Notable Games</Label>
        <Input
          id="studioGames"
          value={studio.games?.join(', ') || ''}
          onChange={(e) => handleGamesChange(e.target.value)}
          placeholder="Game 1, Game 2, Game 3"
        />
        <p className="text-xs text-muted-foreground">Separate games with commas</p>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-medium text-sm">Fit Tags</h4>
        <p className="text-xs text-muted-foreground">Select which aspects of the product would be relevant</p>
        <div className="flex flex-wrap gap-2">
          {FIT_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleFitTagToggle(tag)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                studio.fitTags?.includes(tag)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-input'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
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
              id="narrativeHeavyGenre"
              checked={fitCriteria.narrativeHeavyGenre || false}
              onChange={(e) => handleCriteriaChange('narrativeHeavyGenre', e.target.checked)}
            />
            <Label htmlFor="narrativeHeavyGenre" className="text-sm font-normal cursor-pointer">
              Narrative-heavy genre (RPG, adventure, story-driven) <span className="text-muted-foreground">+3</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="aiPositiveAttitude"
              checked={fitCriteria.aiPositiveAttitude || false}
              onChange={(e) => handleCriteriaChange('aiPositiveAttitude', e.target.checked)}
            />
            <Label htmlFor="aiPositiveAttitude" className="text-sm font-normal cursor-pointer">
              AI-positive attitude (eager to use AI to scale) <span className="text-muted-foreground">+3</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rightSize"
              checked={fitCriteria.rightSize || false}
              onChange={(e) => handleCriteriaChange('rightSize', e.target.checked)}
            />
            <Label htmlFor="rightSize" className="text-sm font-normal cursor-pointer">
              Right size (indie to AA, not solo/AAA) <span className="text-muted-foreground">+2</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="inActiveProduction"
              checked={fitCriteria.inActiveProduction || false}
              onChange={(e) => handleCriteriaChange('inActiveProduction', e.target.checked)}
            />
            <Label htmlFor="inActiveProduction" className="text-sm font-normal cursor-pointer">
              In active production <span className="text-muted-foreground">+1</span>
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="usesTargetEngine"
              checked={fitCriteria.usesTargetEngine || false}
              onChange={(e) => handleCriteriaChange('usesTargetEngine', e.target.checked)}
            />
            <Label htmlFor="usesTargetEngine" className="text-sm font-normal cursor-pointer">
              Uses Unity or Unreal <span className="text-muted-foreground">+1</span>
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
