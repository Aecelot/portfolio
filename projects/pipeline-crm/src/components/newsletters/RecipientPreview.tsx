import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Users } from 'lucide-react';
import type { ComputedSubscriber } from '@/types/newsletter';

interface RecipientPreviewProps {
  subscribers: ComputedSubscriber[];
  loading: boolean;
  onRemove?: (contactId: string) => void;
  showRemoveButton?: boolean;
}

const sourceLabels: Record<string, string> = {
  tag: 'Tag',
  leadType: 'Lead Type',
  manual: 'Manual',
};

const sourceBadgeVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
  tag: 'secondary',
  leadType: 'default',
  manual: 'outline',
};

export const RecipientPreview: React.FC<RecipientPreviewProps> = ({
  subscribers,
  loading,
  onRemove,
  showRemoveButton = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading subscribers...
      </div>
    );
  }

  if (subscribers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mb-2" />
        <p>No subscribers match the current filters</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Source</TableHead>
            {showRemoveButton && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscribers.map((subscriber) => (
            <TableRow key={subscriber.contactId}>
              <TableCell className="font-medium">{subscriber.name}</TableCell>
              <TableCell>{subscriber.email}</TableCell>
              <TableCell>{subscriber.company || '-'}</TableCell>
              <TableCell>
                <Badge variant={sourceBadgeVariants[subscriber.source]}>
                  {sourceLabels[subscriber.source]}
                </Badge>
              </TableCell>
              {showRemoveButton && onRemove && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(subscriber.contactId)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="px-4 py-2 border-t bg-muted/50 text-sm text-muted-foreground">
        {subscribers.length} recipient{subscribers.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
