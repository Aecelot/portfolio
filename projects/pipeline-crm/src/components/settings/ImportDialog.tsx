import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useImport } from '@/hooks/useImport';
import { useAuth } from '@/contexts/AuthContext';
import { usePipeline } from '@/hooks/usePipeline';
import { useLeads } from '@/hooks/useLeads';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, AlertTriangle, Copy } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { pipelines } = usePipeline();
  const { leads } = useLeads();
  const { loadPreview, importLeads, clearPreview, preview, isImporting, error } = useImport();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; skippedDuplicates: number; errors: string[] } | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    try {
      await loadPreview(selectedFile, leads);
    } catch {
      // Error is handled in useImport
    }
  };

  const handleImport = async () => {
    if (!user || !preview.length) return;

    // Get default pipeline and stage
    const defaultPipeline = pipelines.find((p) => p.type === 'studio');
    const defaultStageId = defaultPipeline?.stages[0]?.id || 'new-lead';
    const defaultPipelineId = defaultPipeline?.id || 'default';

    const result = await importLeads(preview, user.uid, defaultPipelineId, defaultStageId, { skipDuplicates });
    setImportResult(result);

    if (result.success > 0) {
      clearPreview();
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClose = () => {
    clearPreview();
    setFile(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  // Count leads by status
  const validLeads = preview.filter((l) => {
    const hasErrors = l.validationIssues?.some(i => i.type === 'error');
    return !hasErrors && (!skipDuplicates || !l.duplicateOf);
  });
  const invalidLeads = preview.filter((l) => l.validationIssues?.some(i => i.type === 'error'));
  const duplicateLeads = preview.filter((l) => l.duplicateOf);
  const warningLeads = preview.filter((l) =>
    l.validationIssues?.some(i => i.type === 'warning') &&
    !l.validationIssues?.some(i => i.type === 'error')
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Leads
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {file ? file.name : 'Click to upload or drag and drop'}
              </span>
              <span className="text-xs text-muted-foreground">
                Excel (.xlsx, .xls) or CSV files
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !importResult && (
            <div className="space-y-3">
              <h4 className="font-medium">Preview ({preview.length} rows)</h4>

              {/* Validation summary */}
              <div className="flex flex-wrap gap-2">
                {invalidLeads.length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    {invalidLeads.length} with errors
                  </Badge>
                )}
                {duplicateLeads.length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    <Copy className="h-3 w-3" />
                    {duplicateLeads.length} duplicate{duplicateLeads.length > 1 ? 's' : ''}
                  </Badge>
                )}
                {warningLeads.length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {warningLeads.length} with warnings
                  </Badge>
                )}
              </div>

              {/* Duplicate handling option */}
              {duplicateLeads.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-md">
                  <Checkbox
                    id="skip-duplicates"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  <Label htmlFor="skip-duplicates" className="text-sm">
                    Skip {duplicateLeads.length} potential duplicate{duplicateLeads.length > 1 ? 's' : ''}
                  </Label>
                </div>
              )}

              <div className="max-h-48 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((lead, i) => {
                      const hasErrors = lead.validationIssues?.some(v => v.type === 'error');
                      const hasWarnings = lead.validationIssues?.some(v => v.type === 'warning');
                      const isDuplicate = !!lead.duplicateOf;

                      return (
                        <tr key={i} className={`border-t ${hasErrors ? 'bg-destructive/5' : isDuplicate ? 'bg-yellow-500/5' : ''}`}>
                          <td className="p-2">
                            {lead.name || <span className="text-destructive">Missing</span>}
                          </td>
                          <td className="p-2 capitalize">{lead.type}</td>
                          <td className="p-2">
                            {lead.contact.email || <span className="text-destructive">Missing</span>}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {hasErrors && (
                                <Badge variant="destructive" className="text-xs">Error</Badge>
                              )}
                              {isDuplicate && (
                                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                  Duplicate
                                </Badge>
                              )}
                              {hasWarnings && !hasErrors && (
                                <Badge variant="secondary" className="text-xs">Warning</Badge>
                              )}
                              {!hasErrors && !isDuplicate && !hasWarnings && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">OK</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="p-2 text-xs text-muted-foreground text-center border-t">
                    ...and {preview.length - 10} more rows
                  </p>
                )}
              </div>

              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm">
                  <strong>{validLeads.length}</strong> lead(s) will be imported
                  {skipDuplicates && duplicateLeads.length > 0 && (
                    <span className="text-muted-foreground"> ({duplicateLeads.length} duplicate{duplicateLeads.length > 1 ? 's' : ''} will be skipped)</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                {importResult.success > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span>{importResult.success} imported</span>
                  </div>
                )}
                {importResult.skippedDuplicates > 0 && (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <Copy className="h-5 w-5" />
                    <span>{importResult.skippedDuplicates} duplicate{importResult.skippedDuplicates > 1 ? 's' : ''} skipped</span>
                  </div>
                )}
                {importResult.failed > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span>{importResult.failed} failed</span>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-destructive/10 p-3 rounded-md">
                  <p className="text-sm font-medium text-destructive mb-2">Errors:</p>
                  <ul className="text-xs text-destructive space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Template Download */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Required columns: <strong>Name</strong>, <strong>Contact Email</strong>
            </p>
            <p>
              Optional: Type, Status, Priority, Contact Name, Phone, Website, Country, Location, Tags
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {importResult?.success ? 'Done' : 'Cancel'}
          </Button>
          {preview.length > 0 && !importResult && (
            <Button onClick={handleImport} disabled={isImporting || validLeads.length === 0}>
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? 'Importing...' : `Import ${validLeads.length} Lead${validLeads.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
