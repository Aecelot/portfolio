import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import type { Contact } from '@/types/contact';

interface ContactFormProps {
  initialValues?: Partial<Contact>;
  onSubmit: (values: Partial<Contact>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  isSubmitting = false,
}) => {
  const { tags: availableTags } = useTags();
  const [values, setValues] = useState<Partial<Contact>>({
    name: '',
    email: '',
    role: '',
    phone: '',
    linkedin: '',
    company: '',
    notes: '',
    tags: [],
    ...initialValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof Contact, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is changed
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleTagToggle = (tagId: string) => {
    const currentTags = values.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((t) => t !== tagId)
      : [...currentTags, tagId];
    handleChange('tags', newTags);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!values.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!values.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (values.linkedin && !values.linkedin.includes('linkedin.com')) {
      newErrors.linkedin = 'Please enter a valid LinkedIn URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={values.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Full name"
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={values.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@example.com"
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={values.company || ''}
            onChange={(e) => handleChange('company', e.target.value)}
            placeholder="Company name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            value={values.role || ''}
            onChange={(e) => handleChange('role', e.target.value)}
            placeholder="Job title"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={values.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="linkedin">LinkedIn Profile</Label>
          <Input
            id="linkedin"
            type="url"
            value={values.linkedin || ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/username"
            className={errors.linkedin ? 'border-destructive' : ''}
          />
          {errors.linkedin && (
            <p className="text-sm text-destructive">{errors.linkedin}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={values.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes about this contact..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const isSelected = values.tags?.includes(tag.id);
            return (
              <Badge
                key={tag.id}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer"
                style={isSelected ? { backgroundColor: tag.color } : {}}
                onClick={() => handleTagToggle(tag.id)}
              >
                {tag.name}
                {isSelected && <X className="ml-1 h-3 w-3" />}
              </Badge>
            );
          })}
          {availableTags.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tags available. Create tags in Settings.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};
