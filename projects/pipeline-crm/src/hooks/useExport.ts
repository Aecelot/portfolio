import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Lead } from '@/types/lead';

interface ExportOptions {
  filename?: string;
  includeNotes?: boolean;
}

export const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportLeadsToExcel = useCallback(
    async (leads: Lead[], options: ExportOptions = {}) => {
      const { filename = 'leads-export', includeNotes = true } = options;

      setIsExporting(true);
      setError(null);

      try {
        // Transform leads to flat structure for Excel
        const data = leads.map((lead) => {
          const row: Record<string, string | number | undefined> = {
            Name: lead.name,
            Type: lead.type,
            Status: lead.status,
            Priority: lead.priority,
            Owner: lead.owner,
            'Contact Name': lead.contact?.name,
            'Contact Email': lead.contact?.email,
            'Contact Role': lead.contact?.role,
            'Contact Phone': lead.contact?.phone,
            'Contact LinkedIn': lead.contact?.linkedin,
            Website: lead.website,
            Country: lead.country,
            Location: lead.location,
            Tags: lead.tags?.join(', '),
          };

          if (includeNotes) {
            row.Notes = lead.notes;
          }

          // Add studio-specific fields
          if (lead.type === 'studio' && lead.studio) {
            row['Studio Size'] = lead.studio.size;
            row['Studio Type'] = lead.studio.type;
            row['Studio Focus'] = lead.studio.focus;
            row['Games'] = lead.studio.games?.join(', ');
            row['Fit Score'] = lead.studio.fitScore;
            row['Fit Reason'] = lead.studio.fitReason;
          }

          // Add investor-specific fields
          if (lead.type === 'investor' && lead.investor) {
            row['Investor Type'] = lead.investor.type;
            row['Founded'] = lead.investor.founded;
            row['Investment Focus'] = lead.investor.investmentFocus;
            row['HQ Region'] = lead.investor.hqRegion;
            row['Geographical Regions'] = lead.investor.geographicalRegions?.join(', ');
            row['Funding Preferences'] = lead.investor.fundingPreferences;
          }

          // Add pipeline info
          row['Pipeline Stage'] = lead.pipeline?.stageId;

          // Add timestamps
          if (lead.createdAt) {
            const createdAt = lead.createdAt.toDate
              ? lead.createdAt.toDate()
              : new Date(lead.createdAt);
            row['Created At'] = createdAt.toISOString();
          }
          if (lead.updatedAt) {
            const updatedAt = lead.updatedAt.toDate
              ? lead.updatedAt.toDate()
              : new Date(lead.updatedAt);
            row['Updated At'] = updatedAt.toISOString();
          }

          return row;
        });

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

        // Auto-fit column widths
        const maxWidths = Object.keys(data[0] || {}).reduce(
          (acc, key) => {
            const maxLen = Math.max(
              key.length,
              ...data.map((row) => String(row[key] || '').length)
            );
            acc[key] = Math.min(maxLen + 2, 50); // Cap at 50 chars
            return acc;
          },
          {} as Record<string, number>
        );

        worksheet['!cols'] = Object.values(maxWidths).map((w) => ({ wch: w }));

        // Generate filename with date
        const date = new Date().toISOString().split('T')[0];
        const fullFilename = `${filename}-${date}.xlsx`;

        // Download file
        XLSX.writeFile(workbook, fullFilename);

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to export';
        setError(errorMessage);
        throw err;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  const exportFilteredLeads = useCallback(
    async (
      leads: Lead[],
      filter: { type?: 'studio' | 'investor' },
      options: ExportOptions = {}
    ) => {
      let filteredLeads = leads;

      if (filter.type) {
        filteredLeads = leads.filter((lead) => lead.type === filter.type);
      }

      const defaultFilename = filter.type ? `${filter.type}-leads` : 'leads-export';
      return exportLeadsToExcel(filteredLeads, {
        filename: options.filename || defaultFilename,
        ...options,
      });
    },
    [exportLeadsToExcel]
  );

  return {
    exportLeadsToExcel,
    exportFilteredLeads,
    isExporting,
    error,
  };
};
