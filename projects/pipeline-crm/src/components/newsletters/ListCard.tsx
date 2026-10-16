import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Settings, Send } from 'lucide-react';
import type { NewsletterList } from '@/types/newsletter';

interface ListCardProps {
  list: NewsletterList;
  subscriberCount: number;
  onEdit: () => void;
  onCompose: () => void;
}

export const ListCard: React.FC<ListCardProps> = ({
  list,
  subscriberCount,
  onEdit,
  onCompose,
}) => {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{list.name}</CardTitle>
            <CardDescription>{list.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{subscriberCount} subscribers</span>
            </div>
            <div className="flex gap-1">
              {list.filterLeadTypes?.map((type) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type}
                </Badge>
              ))}
              {list.filterTags?.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{list.filterTags.length} tags
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Settings className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button size="sm" onClick={onCompose}>
              <Send className="h-4 w-4 mr-1" />
              Compose
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
