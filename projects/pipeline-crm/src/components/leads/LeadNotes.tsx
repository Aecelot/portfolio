import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface LeadNotesProps {
  lead: Lead;
}

export const LeadNotes: React.FC<LeadNotesProps> = ({ lead }) => {
  if (!lead.notes) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
      </CardContent>
    </Card>
  );
};

interface LeadTagsProps {
  lead: Lead;
}

export const LeadTags: React.FC<LeadTagsProps> = ({ lead }) => {
  if (!lead.tags || lead.tags.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tags</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {lead.tags.map((tag, index) => (
            <Badge key={index} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
