import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Gamepad2, Target, Star, Tags } from 'lucide-react';
import type { Lead, StudioSize } from '@/types/lead';
import { STUDIO_SIZE_LABELS } from '@/types/lead';

interface LeadStudioInfoProps {
  lead: Lead;
}

// Get display label for size
const getSizeLabel = (size: string): string => {
  if (size in STUDIO_SIZE_LABELS) {
    return STUDIO_SIZE_LABELS[size as StudioSize];
  }
  return size; // Fallback for old string values
};

export const LeadStudioInfo: React.FC<LeadStudioInfoProps> = ({ lead }) => {
  const studio = lead.studio;
  const isPublisher = lead.type === 'publisher';

  if (!studio) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{isPublisher ? 'Publisher Details' : 'Studio Details'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {studio.size && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Team Size</p>
                <p className="text-sm text-muted-foreground">{getSizeLabel(studio.size)}</p>
              </div>
            </div>
          )}

          {studio.type && (
            <div className="flex items-start gap-3">
              <Gamepad2 className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Studio Type</p>
                <p className="text-sm text-muted-foreground capitalize">{studio.type}</p>
              </div>
            </div>
          )}

          {studio.focus && (
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Focus</p>
                <p className="text-sm text-muted-foreground">{studio.focus}</p>
              </div>
            </div>
          )}

          {studio.fitScore !== undefined && (
            <div className="flex items-start gap-3">
              <Star className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Fit Score</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${studio.fitScore}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">{studio.fitScore}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {studio.fitReason && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Fit Reason</p>
            <p className="text-sm text-muted-foreground">{studio.fitReason}</p>
          </div>
        )}

        {studio.games && studio.games.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Games</p>
            <div className="flex flex-wrap gap-2">
              {studio.games.map((game, index) => (
                <Badge key={index} variant="outline">
                  {game}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {studio.fitTags && studio.fitTags.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Tags className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Fit Tags</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {studio.fitTags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
