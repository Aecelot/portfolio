import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { createLead } from '@/lib/firestore';
import { findDuplicates, type DuplicateMatch } from '@/lib/duplicateDetection';
import type { Lead } from '@/types/lead';

interface ImportResult {
  success: number;
  failed: number;
  skippedDuplicates: number;
  errors: string[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

export interface ParsedLead {
  name: string;
  type: 'studio' | 'investor';
  status: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  contact: {
    name: string;
    email: string;
    role: string;
    phone: string;
    linkedin: string;
  };
  website: string;
  country: string;
  location: string;
  notes: string;
  tags: string[];
  // Validation metadata
  validationIssues?: ValidationIssue[];
  duplicateOf?: DuplicateMatch;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validate a single lead and return issues
function validateLead(lead: ParsedLead): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Required fields
  if (!lead.name?.trim()) {
    issues.push({ type: 'error', field: 'name', message: 'Name is required' });
  }

  if (!lead.contact.email?.trim()) {
    issues.push({ type: 'error', field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(lead.contact.email.trim())) {
    issues.push({ type: 'error', field: 'email', message: 'Invalid email format' });
  }

  // Warnings for recommended fields
  if (!lead.contact.name?.trim()) {
    issues.push({ type: 'warning', field: 'contactName', message: 'Contact name is recommended' });
  }

  // URL validation for website
  if (lead.website?.trim()) {
    try {
      new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`);
    } catch {
      issues.push({ type: 'warning', field: 'website', message: 'Invalid website URL' });
    }
  }

  return issues;
}

export const useImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedLead[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File): Promise<ParsedLead[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const parsedLeads: ParsedLead[] = jsonData.map((row: any) => ({
            name: row['Name'] || row['name'] || '',
            type: normalizeType(row['Type'] || row['type']),
            status: row['Status'] || row['status'] || 'new',
            priority: normalizePriority(row['Priority'] || row['priority']),
            contact: {
              name: row['Contact Name'] || row['contact_name'] || '',
              email: row['Contact Email'] || row['contact_email'] || row['Email'] || row['email'] || '',
              role: row['Contact Role'] || row['contact_role'] || row['Role'] || row['role'] || '',
              phone: row['Contact Phone'] || row['contact_phone'] || row['Phone'] || row['phone'] || '',
              linkedin: row['Contact LinkedIn'] || row['contact_linkedin'] || row['LinkedIn'] || row['linkedin'] || '',
            },
            website: row['Website'] || row['website'] || '',
            country: row['Country'] || row['country'] || '',
            location: row['Location'] || row['location'] || '',
            notes: row['Notes'] || row['notes'] || '',
            tags: parseTags(row['Tags'] || row['tags']),
          }));

          resolve(parsedLeads);
        } catch (err) {
          reject(new Error('Failed to parse file. Please ensure it is a valid Excel or CSV file.'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file.'));
      };

      reader.readAsBinaryString(file);
    });
  }, []);

  const loadPreview = useCallback(async (file: File, currentLeads: Lead[] = []) => {
    setError(null);
    setPreview([]);

    try {
      const leads = await parseFile(file);

      // Validate and check for duplicates
      const validatedLeads = leads.map((lead) => {
        const issues = validateLead(lead);
        const duplicates = findDuplicates(lead as Partial<Lead>, currentLeads);

        return {
          ...lead,
          validationIssues: issues,
          duplicateOf: duplicates[0] || undefined,
        };
      });

      setPreview(validatedLeads);
      return validatedLeads;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse file';
      setError(errorMessage);
      throw err;
    }
  }, [parseFile]);

  const importLeads = useCallback(async (
    leads: ParsedLead[],
    userId: string,
    defaultPipelineId: string,
    defaultStageId: string,
    options: { skipDuplicates?: boolean } = {}
  ): Promise<ImportResult> => {
    const { skipDuplicates = true } = options;

    setIsImporting(true);
    setError(null);

    const result: ImportResult = {
      success: 0,
      failed: 0,
      skippedDuplicates: 0,
      errors: [],
    };

    for (const lead of leads) {
      try {
        // Check for duplicates
        if (skipDuplicates && lead.duplicateOf) {
          result.skippedDuplicates++;
          continue;
        }

        // Check for validation errors
        const errors = lead.validationIssues?.filter(i => i.type === 'error') || [];
        if (errors.length > 0) {
          result.failed++;
          result.errors.push(`"${lead.name || 'Unknown'}": ${errors.map(e => e.message).join(', ')}`);
          continue;
        }

        // Validate required fields (fallback if not pre-validated)
        if (!lead.name) {
          result.failed++;
          result.errors.push(`Row skipped: Missing name`);
          continue;
        }

        if (!lead.contact.email) {
          result.failed++;
          result.errors.push(`"${lead.name}": Missing contact email`);
          continue;
        }

        // Create lead data
        const leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> = {
          name: lead.name,
          type: lead.type,
          status: lead.status,
          priority: lead.priority,
          owner: userId,
          contact: lead.contact,
          website: lead.website,
          country: lead.country,
          location: lead.location,
          notes: lead.notes,
          tags: lead.tags,
          pipeline: {
            pipelineId: defaultPipelineId,
            stageId: defaultStageId,
            enteredStageAt: new Date(),
          },
          createdBy: userId,
        };

        // Add type-specific empty objects
        if (lead.type === 'studio') {
          leadData.studio = {
            size: '',
            type: '',
            games: [],
            focus: '',
            fitScore: 0,
            fitReason: '',
          };
        } else {
          leadData.investor = {
            type: '',
            founded: '',
            investmentFocus: '',
            fundingPreferences: '',
            geographicalRegions: [],
            hqRegion: '',
          };
        }

        await createLead(leadData);
        result.success++;
      } catch (err) {
        result.failed++;
        result.errors.push(`"${lead.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setIsImporting(false);
    return result;
  }, []);

  const clearPreview = useCallback(() => {
    setPreview([]);
    setError(null);
  }, []);

  return {
    parseFile,
    loadPreview,
    importLeads,
    clearPreview,
    preview,
    isImporting,
    error,
  };
};

// Helper functions
function normalizeType(type: string): 'studio' | 'investor' {
  const normalized = (type || '').toLowerCase().trim();
  if (normalized === 'investor' || normalized === 'investors') {
    return 'investor';
  }
  return 'studio';
}

function normalizePriority(priority: string): 'high' | 'medium' | 'low' | 'none' {
  const normalized = (priority || '').toLowerCase().trim();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium' || normalized === 'med') return 'medium';
  if (normalized === 'low') return 'low';
  return 'none';
}

function parseTags(tags: string | undefined): string[] {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter(Boolean);
}
