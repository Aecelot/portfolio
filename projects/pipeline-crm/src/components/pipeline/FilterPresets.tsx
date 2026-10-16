import React, { useState } from 'react';
import { Bookmark, Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import type { ColumnFilter, ColumnSort } from '@/types/filters';
import { isFilterActive } from '@/types/filters';
import { toast } from 'sonner';

interface FilterPresetsProps {
  pipelineType: 'studio' | 'investor' | 'community' | 'competition';
  columnFilters: Record<string, ColumnFilter>;
  columnSorts: Record<string, ColumnSort>;
  onApplyPreset: (filters: Record<string, ColumnFilter>, sorts: Record<string, ColumnSort>) => void;
}

export const FilterPresets: React.FC<FilterPresetsProps> = ({
  pipelineType,
  columnFilters,
  columnSorts,
  onApplyPreset,
}) => {
  const { presets, loading, savePreset, deletePreset } = useFilterPresets(pipelineType);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  // Check if there are any active filters to save
  const hasActiveFilters = Object.values(columnFilters).some(isFilterActive);

  const handleSave = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    setSaving(true);
    try {
      await savePreset(presetName, columnFilters, columnSorts);
      toast.success(`Saved preset "${presetName}"`);
      setShowSaveDialog(false);
      setPresetName('');
    } catch (err) {
      toast.error('Failed to save preset');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deletePreset(id);
      toast.success(`Deleted preset "${name}"`);
    } catch (err) {
      toast.error('Failed to delete preset');
      console.error(err);
    }
  };

  const handleApply = (preset: typeof presets[0]) => {
    // Convert single-stage preset to full filter state
    const filters: Record<string, ColumnFilter> = {};
    const sorts: Record<string, ColumnSort> = {};

    if (preset.stageId) {
      // Single stage preset
      filters[preset.stageId] = preset.filters as ColumnFilter;
      if (preset.sort) {
        sorts[preset.stageId] = preset.sort;
      }
    } else {
      // Multi-stage preset (filters is already a Record)
      Object.assign(filters, preset.filters);
    }

    onApplyPreset(filters, sorts);
    toast.success(`Applied preset "${preset.name}"`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Presets</span>
            {presets.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                {presets.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Save current */}
          {hasActiveFilters && (
            <>
              <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Save current filters...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* List presets */}
          {loading ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          ) : presets.length === 0 ? (
            <DropdownMenuItem disabled>
              No saved presets
            </DropdownMenuItem>
          ) : (
            presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                className="flex items-center justify-between group"
                onClick={() => handleApply(preset)}
              >
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                  <span>{preset.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(preset.id, preset.name);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onApplyPreset({}, {})}>
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save your current filter settings as a preset for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Preset name (e.g., High ICP Europe)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !presetName.trim()}>
              {saving ? 'Saving...' : 'Save Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
