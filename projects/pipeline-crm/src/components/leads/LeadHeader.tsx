import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ArrowLeft, Edit, Trash2, ExternalLink, Building, DollarSign, ArrowUpCircle, Info } from 'lucide-react';
import { calculateLeadPriority, getFitScore } from '@/lib/utils';
import type { Lead } from '@/types/lead';

interface LeadHeaderProps {
  lead: Lead;
  onEdit: () => void;
  onDelete: () => void;
  onQualify?: () => void;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const typeColors: Record<string, string> = {
  studio: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  investor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const categoryColors: Record<string, string> = {
  prospect: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  lead: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
};

export const LeadHeader: React.FC<LeadHeaderProps> = ({ lead, onEdit, onDelete, onQualify }) => {
  // Calculate priority scores for display
  const priorityData = calculateLeadPriority(lead);
  const fitScore = getFitScore(lead);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {lead.type === 'studio' ? (
                <Building className="h-6 w-6 text-primary" />
              ) : (
                <DollarSign className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{lead.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={typeColors[lead.type]}>
                  {lead.type}
                </Badge>
                <Badge variant="secondary" className={categoryColors[lead.category || 'prospect']}>
                  {lead.category === 'lead' ? 'Qualified Lead' : 'Prospect'}
                </Badge>
                <Popover>
                  <PopoverTrigger asChild>
                    <Badge
                      variant="secondary"
                      className={`${priorityColors[lead.priority]} cursor-pointer hover:opacity-80 inline-flex items-center gap-1`}
                    >
                      {lead.priority} priority
                      <Info className="h-3 w-3" />
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Priority Breakdown</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fit Score</span>
                          <span className="font-medium">{fitScore}/10</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Intent Score</span>
                          <span className="font-medium">{priorityData.intentScore}/10</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recency Score</span>
                          <span className="font-medium">{priorityData.recencyScore}/10</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="font-medium">Priority Score</span>
                          <span className="font-bold">{priorityData.priorityScore}/10</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Formula: (Fit × 40%) + (Intent × 40%) + (Recency × 20%)
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground capitalize">
                  {lead.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.category !== 'lead' && onQualify && (
            <Button variant="outline" size="sm" onClick={onQualify}>
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Qualify
            </Button>
          )}
          {lead.website && (
            <Button variant="outline" size="sm" asChild>
              <a href={lead.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Website
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};
