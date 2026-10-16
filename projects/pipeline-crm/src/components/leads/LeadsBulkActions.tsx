import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trash2, Archive, ChevronDown, GitBranch, Flag } from 'lucide-react';
import { usePipeline } from '@/hooks/usePipeline';
import type { Lead } from '@/types/lead';

interface LeadsBulkActionsProps {
  selectedCount: number;
  selectedLeads?: Lead[];
  onDelete: () => void;
  onArchive: () => void;
  onSetPriority: (priority: 'high' | 'medium' | 'low' | 'none') => void;
  onSetStage?: (stageId: string) => void;
}

export const LeadsBulkActions: React.FC<LeadsBulkActionsProps> = ({
  selectedCount,
  selectedLeads = [],
  onDelete,
  onArchive,
  onSetPriority,
  onSetStage,
}) => {
  const { getStudioPipeline, getInvestorPipeline, getCommunityPipeline } = usePipeline();

  if (selectedCount === 0) return null;

  // Determine which stages to show based on selected leads
  const selectedTypes = new Set(selectedLeads.map((l) => l.type));
  const showStudioStages = selectedTypes.has('studio') || selectedTypes.size === 0;
  const showInvestorStages = selectedTypes.has('investor') || selectedTypes.size === 0;
  const showCommunityStages = selectedTypes.has('community') || selectedTypes.size === 0;

  const studioPipeline = getStudioPipeline();
  const investorPipeline = getInvestorPipeline();
  const communityPipeline = getCommunityPipeline();

  return (
    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
      <span className="text-sm font-medium">
        {selectedCount} lead{selectedCount > 1 ? 's' : ''} selected
      </span>
      <div className="flex-1" />

      {/* Priority Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Flag className="h-4 w-4 mr-1" />
            Priority
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onSetPriority('high')}>
            <span className="h-2 w-2 rounded-full bg-red-500 mr-2" />
            High
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetPriority('medium')}>
            <span className="h-2 w-2 rounded-full bg-yellow-500 mr-2" />
            Medium
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSetPriority('low')}>
            <span className="h-2 w-2 rounded-full bg-blue-500 mr-2" />
            Low
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSetPriority('none')}>
            <span className="h-2 w-2 rounded-full bg-gray-400 mr-2" />
            None
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Stage Change Dropdown */}
      {onSetStage && (showStudioStages || showInvestorStages || showCommunityStages) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <GitBranch className="h-4 w-4 mr-1" />
              Move to Stage
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-64 overflow-y-auto">
            {showStudioStages && studioPipeline && (
              <>
                <DropdownMenuLabel>Studio Stages</DropdownMenuLabel>
                {studioPipeline.stages
                  .filter((s) => s.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => onSetStage(stage.id)}
                    >
                      {stage.name}
                    </DropdownMenuItem>
                  ))}
              </>
            )}
            {showStudioStages && showInvestorStages && studioPipeline && investorPipeline && (
              <DropdownMenuSeparator />
            )}
            {showInvestorStages && investorPipeline && (
              <>
                <DropdownMenuLabel>Investor Stages</DropdownMenuLabel>
                {investorPipeline.stages
                  .filter((s) => s.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => onSetStage(stage.id)}
                    >
                      {stage.name}
                    </DropdownMenuItem>
                  ))}
              </>
            )}
            {(showStudioStages || showInvestorStages) && showCommunityStages && communityPipeline && (
              <DropdownMenuSeparator />
            )}
            {showCommunityStages && communityPipeline && (
              <>
                <DropdownMenuLabel>Community Stages</DropdownMenuLabel>
                {communityPipeline.stages
                  .filter((s) => s.isActive)
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => onSetStage(stage.id)}
                    >
                      {stage.name}
                    </DropdownMenuItem>
                  ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="outline" size="sm" onClick={onArchive}>
        <Archive className="h-4 w-4 mr-1" />
        Archive
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 mr-1" />
        Delete
      </Button>
    </div>
  );
};
