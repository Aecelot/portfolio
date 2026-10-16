import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, X } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useTags } from '@/hooks/useTags';
import {
  ContactsTable,
  ContactCreateDialog,
  ContactEditDialog,
} from '@/components/contacts';
import type { ContactWithMeta, ContactFilters } from '@/types/contact';

interface OutletContext {
  searchTerm: string;
}

export const Contacts: React.FC = () => {
  const { searchTerm } = useOutletContext<OutletContext>();
  const [filters, setFilters] = useState<ContactFilters>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithMeta | null>(null);
  const [deletingContact, setDeletingContact] = useState<ContactWithMeta | null>(null);

  const { tags } = useTags();
  const { contacts, loading, removeContact } = useContacts(filters);

  // Sync search term from TopBar
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: searchTerm || undefined }));
  }, [searchTerm]);

  // Local search state for the input
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    setLocalSearch(searchTerm || '');
  }, [searchTerm]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: localSearch || undefined,
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleDelete = async () => {
    if (!deletingContact) return;

    try {
      await removeContact(deletingContact.id);
      toast.success('Contact deleted');
      setDeletingContact(null);
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const handleTagFilter = (tagId: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: tagId === 'all' ? undefined : [tagId],
    }));
  };

  const activeTagFilter = filters.tags?.[0] || 'all';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your contact book
            {!loading && ` (${contacts.length} total)`}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setLocalSearch('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Select value={activeTagFilter} onValueChange={handleTagFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <ContactsTable
        contacts={contacts}
        loading={loading}
        onEdit={setEditingContact}
        onDelete={setDeletingContact}
      />

      {/* Dialogs */}
      <ContactCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <ContactEditDialog
        contact={editingContact}
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
      />

      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingContact?.name}? This will also
              remove all links to leads. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
