import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Lead, LeadContact } from '@/types/lead';

interface LeadContactFieldsProps {
  values: Partial<Lead>;
  onChange: (field: keyof Lead, value: LeadContact) => void;
  errors?: Record<string, string>;
}

export const LeadContactFields: React.FC<LeadContactFieldsProps> = ({
  values,
  onChange,
  errors = {},
}) => {
  const contact: LeadContact = values.contact || { name: '', email: '', role: '', phone: '', linkedin: '' };

  const handleContactChange = (field: keyof LeadContact, value: string) => {
    onChange('contact', {
      ...contact,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Contact Person</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactName">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contactName"
            value={contact.name || ''}
            onChange={(e) => handleContactChange('name', e.target.value)}
            placeholder="Contact name"
            className={errors['contact.name'] ? 'border-destructive' : ''}
          />
          {errors['contact.name'] && (
            <p className="text-sm text-destructive">{errors['contact.name']}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactRole">Role</Label>
          <Input
            id="contactRole"
            value={contact.role || ''}
            onChange={(e) => handleContactChange('role', e.target.value)}
            placeholder="Job title"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactEmail">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contactEmail"
            type="email"
            value={contact.email || ''}
            onChange={(e) => handleContactChange('email', e.target.value)}
            placeholder="email@example.com"
            className={errors['contact.email'] ? 'border-destructive' : ''}
          />
          {errors['contact.email'] && (
            <p className="text-sm text-destructive">{errors['contact.email']}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPhone">Phone</Label>
          <Input
            id="contactPhone"
            type="tel"
            value={contact.phone || ''}
            onChange={(e) => handleContactChange('phone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactLinkedin">LinkedIn Profile</Label>
        <Input
          id="contactLinkedin"
          type="url"
          value={contact.linkedin || ''}
          onChange={(e) => handleContactChange('linkedin', e.target.value)}
          placeholder="https://linkedin.com/in/username"
          className={errors['contact.linkedin'] ? 'border-destructive' : ''}
        />
        {errors['contact.linkedin'] && (
          <p className="text-sm text-destructive">{errors['contact.linkedin']}</p>
        )}
      </div>
    </div>
  );
};
