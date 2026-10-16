import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

// Simple markdown to HTML converter for preview
function markdownToHtml(markdown: string): string {
  let html = markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: underline;">$1</a>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap in paragraphs
  html = '<p>' + html + '</p>';

  return html;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your newsletter content in markdown...',
  label = 'Content',
}) => {
  const [activeTab, setActiveTab] = useState<string>('write');

  // Preview with template variable placeholders shown
  const previewHtml = markdownToHtml(value)
    .replace(/\{\{name\}\}/g, '<span style="background: #fef3c7; padding: 0 4px; border-radius: 2px;">John Doe</span>')
    .replace(/\{\{firstName\}\}/g, '<span style="background: #fef3c7; padding: 0 4px; border-radius: 2px;">John</span>')
    .replace(/\{\{company\}\}/g, '<span style="background: #fef3c7; padding: 0 4px; border-radius: 2px;">Acme Inc</span>')
    .replace(/\{\{unsubscribeUrl\}\}/g, '<span style="background: #fee2e2; padding: 0 4px; border-radius: 2px;">[Unsubscribe Link]</span>');

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="mt-0">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[300px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Supports markdown. Variables: {'{{name}}'}, {'{{firstName}}'}, {'{{company}}'}, {'{{unsubscribeUrl}}'}
          </p>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div
            className="min-h-[300px] p-4 border rounded-md bg-white dark:bg-gray-900 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-muted-foreground">Nothing to preview</p>' }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
