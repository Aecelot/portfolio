import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, Linkedin, MapPin, Globe } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface LeadContactInfoProps {
  lead: Lead;
}

export const LeadContactInfo: React.FC<LeadContactInfoProps> = ({ lead }) => {
  const { contact } = lead;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Contact Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{contact.name}</h3>
          <p className="text-sm text-muted-foreground">{contact.role}</p>
        </div>

        <div className="grid gap-3">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4 text-muted-foreground" />
              {contact.email}
            </a>
          )}

          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              {contact.phone}
            </a>
          )}

          {contact.linkedin && (
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Linkedin className="h-4 w-4 text-muted-foreground" />
              LinkedIn Profile
            </a>
          )}
        </div>

        {(lead.location || lead.country) && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {[lead.location, lead.country].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>
        )}

        {lead.website && (
          <div className="pt-4 border-t">
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              {new URL(lead.website).hostname}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
