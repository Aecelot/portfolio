import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { NoteStatus } from '@/types/note';

interface NoteStatusBadgeProps {
  status: NoteStatus;
}

const statusConfig: Record<NoteStatus, { label: string; className: string }> = {
  cold: {
    label: 'Cold',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  warm: {
    label: 'Warm',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  hot: {
    label: 'Hot',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

export const NoteStatusBadge: React.FC<NoteStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
};
