import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLeads } from '@/hooks/useLeads';
import { useExport } from '@/hooks/useExport';
import { Download, FileSpreadsheet } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ open, onOpenChange }) => {
  const { leads } = useLeads();
  const { exportFilteredLeads, isExporting, error } = useExport();
  const [leadType, setLeadType] = useState<'all' | 'studio' | 'investor'>('all');
  const [includeNotes, setIncludeNotes] = useState(true);

  const studioCount = leads.filter((l) => l.type === 'studio').length;
  const investorCount = leads.filter((l) => l.type === 'investor').length;

  const getExportCount = () => {
    if (leadType === 'studio') return studioCount;
    if (leadType === 'investor') return investorCount;
    return leads.length;
  };

  const handleExport = async () => {
    try {
      await exportFilteredLeads(
        leads,
        leadType === 'all' ? {} : { type: leadType },
        { includeNotes }
      );
      onOpenChange(false);
    } catch (err) {
      // Error is handled in useExport
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export Leads
          </DialogTitle>
          <DialogDescription>
            Export your leads to an Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Lead Type</Label>
            <Select value={leadType} onValueChange={(v) => setLeadType(v as typeof leadType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads ({leads.length})</SelectItem>
                <SelectItem value="studio">Studios Only ({studioCount})</SelectItem>
                <SelectItem value="investor">Investors Only ({investorCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeNotes"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="includeNotes" className="text-sm font-normal cursor-pointer">
              Include notes in export
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm text-muted-foreground">
              {getExportCount()} lead{getExportCount() !== 1 ? 's' : ''} will be exported.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || leads.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
