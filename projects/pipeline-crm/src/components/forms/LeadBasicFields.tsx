import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfig } from '@/contexts/ConfigContext';
import { TagSelector } from './TagSelector';
import type { Lead } from '@/types/lead';

interface LeadBasicFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: unknown) => void;
  errors?: Record<string, string>;
}

export const LeadBasicFields: React.FC<LeadBasicFieldsProps> = ({
  values,
  onChange,
  errors = {},
}) => {
  const config = useConfig();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Company Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={values.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Enter company name"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">
            Lead Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={values.type || ''}
            onValueChange={(value) => onChange('type', value)}
          >
            <SelectTrigger id="type" className={errors.type ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {config.leadTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-sm text-destructive">{errors.type}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={values.priority || 'none'}
            onValueChange={(value) => onChange('priority', value)}
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {config.priorities.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  {priority.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={values.category || 'prospect'}
            onValueChange={(value) => onChange('category', value)}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {config.categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={values.status || 'new'}
            onValueChange={(value) => onChange('status', value)}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="closed-won">Closed Won</SelectItem>
              <SelectItem value="closed-lost">Closed Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            value={values.website || ''}
            onChange={(e) => onChange('website', e.target.value)}
            placeholder="https://example.com"
            className={errors.website ? 'border-destructive' : ''}
          />
          {errors.website && (
            <p className="text-sm text-destructive">{errors.website}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={values.location || ''}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="City"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={values.country || ''}
            onChange={(e) => onChange('country', e.target.value)}
            placeholder="Country"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <TagSelector
          selectedTags={values.tags || []}
          onChange={(tags) => onChange('tags', tags)}
        />
      </div>
    </div>
  );
};
