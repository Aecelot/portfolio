import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Edit, Trash2, Send, Eye, MousePointer, UserMinus } from 'lucide-react';
import type { Newsletter } from '@/types/newsletter';

interface CampaignCardProps {
  newsletter: Newsletter;
  listName: string;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sending: 'bg-yellow-500',
  sent: 'bg-green-500',
  failed: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sending: 'Sending...',
  sent: 'Sent',
  failed: 'Failed',
};

export const CampaignCard: React.FC<CampaignCardProps> = ({
  newsletter,
  listName,
  onEdit,
  onDelete,
  onSend,
}) => {
  const { stats, status } = newsletter;
  const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
  const clickRate = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0;

  const sentAt = newsletter.sentAt?.toDate?.();
  const formattedDate = sentAt
    ? sentAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{newsletter.subject}</CardTitle>
              <Badge className={statusColors[status]}>
                {statusLabels[status]}
              </Badge>
            </div>
            <CardDescription className="mt-1">
              {listName} {formattedDate && `• Sent ${formattedDate}`}
            </CardDescription>
          </div>
          {status === 'draft' && (
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={onSend}>
                <Send className="h-4 w-4 mr-1" />
                Send
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {status !== 'draft' && (
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Sent</p>
              <p className="text-2xl font-semibold">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">of {stats.total}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                Opens
              </div>
              <p className="text-2xl font-semibold">{openRate}%</p>
              <Progress value={openRate} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MousePointer className="h-3 w-3" />
                Clicks
              </div>
              <p className="text-2xl font-semibold">{clickRate}%</p>
              <Progress value={clickRate} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <UserMinus className="h-3 w-3" />
                Unsubscribed
              </div>
              <p className="text-2xl font-semibold">{stats.unsubscribed}</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
