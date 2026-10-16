import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSequences } from '@/hooks/useSequences';
import type { Lead, MergeFields, EmailSequence } from '@/types';
import {
  extractSequencePlaceholders,
  buildMergeFieldsFromLead,
  previewEmail,
} from '@/lib/mergeFields';
import { Loader2, Send, Eye, CheckCircle, AlertCircle } from 'lucide-react';

interface LeadEnrollmentRow {
  lead: Lead;
  selected: boolean;
  mergeFields: MergeFields;
  status: 'pending' | 'enrolling' | 'enrolled' | 'error' | 'already-enrolled';
  error?: string;
}

interface BulkEnrollmentProps {
  leads: Lead[];
  onComplete?: () => void;
}

export const BulkEnrollment: React.FC<BulkEnrollmentProps> = ({ leads, onComplete }) => {
  const { sequences } = useSequences();
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [rows, setRows] = useState<LeadEnrollmentRow[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);

  // Get the selected sequence
  const selectedSequence = useMemo(
    () => sequences.find((s) => s.id === selectedSequenceId),
    [sequences, selectedSequenceId]
  );

  // Extract placeholders from selected sequence
  const placeholders = useMemo(() => {
    if (!selectedSequence) return [];
    return extractSequencePlaceholders(selectedSequence.emails);
  }, [selectedSequence]);

  // Initialize rows when leads change
  useEffect(() => {
    const initialRows: LeadEnrollmentRow[] = leads
      .filter((lead) => lead.contact?.email) // Only leads with email
      .map((lead) => ({
        lead,
        selected: true,
        mergeFields: {
          firstName: '',
          studioName: lead.name,
          ...buildMergeFieldsFromLead(lead),
        },
        status: 'pending',
      }));
    setRows(initialRows);
  }, [leads]);

  // Check which leads are already enrolled when sequence changes
  useEffect(() => {
    if (!selectedSequenceId) return;

    const checkEnrollments = async () => {
      const leadIds = rows.map((r) => r.lead.id);
      if (leadIds.length === 0) return;

      const q = query(
        collection(db, 'leadSequences'),
        where('sequenceId', '==', selectedSequenceId),
        where('leadId', 'in', leadIds.slice(0, 10)) // Firestore 'in' limit
      );

      const snap = await getDocs(q);
      const enrolledIds = new Set(snap.docs.map((d) => d.data().leadId));

      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          status: enrolledIds.has(row.lead.id) ? 'already-enrolled' : 'pending',
          selected: enrolledIds.has(row.lead.id) ? false : row.selected,
        }))
      );
    };

    checkEnrollments();
  }, [selectedSequenceId, rows.length]);

  // Update merge field for a specific row
  const updateRowField = (leadId: string, field: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.lead.id === leadId
          ? { ...row, mergeFields: { ...row.mergeFields, [field]: value } }
          : row
      )
    );
  };

  // Toggle selection for a row
  const toggleRow = (leadId: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.lead.id === leadId && row.status !== 'already-enrolled'
          ? { ...row, selected: !row.selected }
          : row
      )
    );
  };

  // Select/deselect all
  const toggleAll = (selected: boolean) => {
    setRows((prev) =>
      prev.map((row) =>
        row.status !== 'already-enrolled' ? { ...row, selected } : row
      )
    );
  };

  // Enroll selected leads
  const handleEnroll = async () => {
    if (!selectedSequence) {
      toast.error('Please select a sequence');
      return;
    }

    const selectedRows = rows.filter((r) => r.selected && r.status === 'pending');
    if (selectedRows.length === 0) {
      toast.error('No leads selected');
      return;
    }

    setEnrolling(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of selectedRows) {
      setRows((prev) =>
        prev.map((r) =>
          r.lead.id === row.lead.id ? { ...r, status: 'enrolling' } : r
        )
      );

      try {
        const firstSendDate = new Date();
        firstSendDate.setHours(firstSendDate.getHours() + 1);

        await addDoc(collection(db, 'leadSequences'), {
          leadId: row.lead.id,
          sequenceId: selectedSequenceId,
          sequenceName: selectedSequence.name,
          currentStep: 1,
          status: 'active',
          startedAt: Timestamp.now(),
          nextSendAt: Timestamp.fromDate(firstSendDate),
          history: [],
          recipientEmail: row.lead.contact?.email,
          recipientName: row.lead.contact?.name || row.lead.name,
          mergeFields: row.mergeFields,
        });

        setRows((prev) =>
          prev.map((r) =>
            r.lead.id === row.lead.id ? { ...r, status: 'enrolled' } : r
          )
        );
        successCount++;
      } catch (error) {
        setRows((prev) =>
          prev.map((r) =>
            r.lead.id === row.lead.id
              ? { ...r, status: 'error', error: String(error) }
              : r
          )
        );
        errorCount++;
      }
    }

    setEnrolling(false);
    toast.success(`Enrolled ${successCount} leads${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    
    if (onComplete && errorCount === 0) {
      onComplete();
    }
  };

  const selectedCount = rows.filter((r) => r.selected && r.status === 'pending').length;
  const previewRow = previewLeadId ? rows.find((r) => r.lead.id === previewLeadId) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Sequence Enrollment</CardTitle>
          <CardDescription>
            Enroll multiple leads in an email sequence with personalized merge fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sequence Selection */}
          <div className="flex items-center gap-4">
            <div className="w-64">
              <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sequence" />
                </SelectTrigger>
                <SelectContent>
                  {sequences.map((sequence) => (
                    <SelectItem key={sequence.id} value={sequence.id}>
                      {sequence.name} ({sequence.emails.length} emails)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedCount} of {rows.filter((r) => r.status !== 'already-enrolled').length} leads selected
            </div>
          </div>

          {/* Leads Table */}
          {selectedSequenceId && (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedCount === rows.filter((r) => r.status !== 'already-enrolled').length}
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead className="w-48">Lead</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Studio Name</TableHead>
                    <TableHead>Game Name</TableHead>
                    <TableHead>Custom Line</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.lead.id}
                      className={row.status === 'already-enrolled' ? 'opacity-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          disabled={row.status === 'already-enrolled' || row.status === 'enrolled'}
                          onCheckedChange={() => toggleRow(row.lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{row.lead.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.lead.contact?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.mergeFields.firstName || ''}
                          onChange={(e) => updateRowField(row.lead.id, 'firstName', e.target.value)}
                          className="h-8 w-28"
                          disabled={row.status !== 'pending'}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.mergeFields.studioName || ''}
                          onChange={(e) => updateRowField(row.lead.id, 'studioName', e.target.value)}
                          className="h-8 w-36"
                          disabled={row.status !== 'pending'}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.mergeFields.gameName || ''}
                          onChange={(e) => updateRowField(row.lead.id, 'gameName', e.target.value)}
                          className="h-8 w-36"
                          disabled={row.status !== 'pending'}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.mergeFields.customLine || ''}
                          onChange={(e) => updateRowField(row.lead.id, 'customLine', e.target.value)}
                          className="h-8 w-48"
                          placeholder="e.g., love the branching in..."
                          disabled={row.status !== 'pending'}
                        />
                      </TableCell>
                      <TableCell>
                        {row.status === 'pending' && (
                          <span className="text-muted-foreground text-sm">Ready</span>
                        )}
                        {row.status === 'enrolling' && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {row.status === 'enrolled' && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {row.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" title={row.error} />
                        )}
                        {row.status === 'already-enrolled' && (
                          <span className="text-xs text-amber-600">Already enrolled</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewLeadId(row.lead.id === previewLeadId ? null : row.lead.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Preview Panel */}
          {previewRow && selectedSequence && (
            <Card className="bg-muted/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Email Preview: {previewRow.lead.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedSequence.emails.slice(0, 1).map((email, idx) => {
                  const preview = previewEmail(email.subject, email.body, previewRow.mergeFields);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Subject: <span className="text-foreground">{preview.subject}</span>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-sans bg-background p-3 rounded border">
                        {preview.body}
                      </pre>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleEnroll}
              disabled={enrolling || !selectedSequenceId || selectedCount === 0}
            >
              {enrolling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enroll {selectedCount} Leads
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkEnrollment;
