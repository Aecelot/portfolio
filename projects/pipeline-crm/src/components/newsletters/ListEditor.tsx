import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagSelector } from '@/components/forms/TagSelector';
import { RecipientPreview } from './RecipientPreview';
import { useListSubscribers } from '@/hooks/useNewsletterLists';
import { useContacts } from '@/hooks/useContacts';
import type { NewsletterList, NewsletterListFormData } from '@/types/newsletter';

interface ListEditorProps {
  list: NewsletterList | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<NewsletterListFormData>) => Promise<void>;
  onRemoveContact: (listId: string, contactId: string) => Promise<void>;
  onAddContact: (listId: string, contactId: string) => Promise<void>;
}

export const ListEditor: React.FC<ListEditorProps> = ({
  list,
  open,
  onOpenChange,
  onSave,
  onRemoveContact,
  onAddContact,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterLeadTypes, setFilterLeadTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [contactSearch, setContactSearch] = useState('');

  const { subscribers, loading: subscribersLoading } = useListSubscribers(list?.id || null);
  const { contacts } = useContacts();

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description);
      setFilterTags(list.filterTags || []);
      setFilterLeadTypes(list.filterLeadTypes || []);
    }
  }, [list]);

  const handleSave = async () => {
    if (!list) return;
    setSaving(true);
    try {
      await onSave(list.id, {
        name,
        description,
        filterTags,
        filterLeadTypes,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSubscriber = async (contactId: string) => {
    if (!list) return;
    await onRemoveContact(list.id, contactId);
  };

  const handleAddContact = async (contactId: string) => {
    if (!list) return;
    await onAddContact(list.id, contactId);
    setContactSearch('');
  };

  const toggleLeadType = (type: string) => {
    setFilterLeadTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Filter contacts that aren't already subscribers
  const availableContacts = contacts.filter(
    (contact) =>
      !subscribers.some((s) => s.contactId === contact.id) &&
      contact.email &&
      (contactSearch === '' ||
        contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        contact.email.toLowerCase().includes(contactSearch.toLowerCase()))
  );

  if (!list) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit List: {list.name}</DialogTitle>
          <DialogDescription>
            Configure filters and manage subscribers for this newsletter list.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="subscribers">
              Subscribers ({subscribers.length})
            </TabsTrigger>
            <TabsTrigger value="add">Add Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">List Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Auto-include Lead Types</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="studio"
                    checked={filterLeadTypes.includes('studio')}
                    onChange={() => toggleLeadType('studio')}
                  />
                  <Label htmlFor="studio" className="font-normal">
                    Studios (Customers)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="investor"
                    checked={filterLeadTypes.includes('investor')}
                    onChange={() => toggleLeadType('investor')}
                  />
                  <Label htmlFor="investor" className="font-normal">
                    Investors
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Contacts from leads of these types will be automatically included.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Auto-include Tags</Label>
              <TagSelector
                selectedTags={filterTags}
                onChange={setFilterTags}
              />
              <p className="text-xs text-muted-foreground">
                Contacts with these tags will be automatically included.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="subscribers" className="mt-4">
            <RecipientPreview
              subscribers={subscribers}
              loading={subscribersLoading}
              showRemoveButton
              onRemove={handleRemoveSubscriber}
            />
          </TabsContent>

          <TabsContent value="add" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Contacts</Label>
              <Input
                id="search"
                placeholder="Search by name or email..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>

            {availableContacts.length > 0 ? (
              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                {availableContacts.slice(0, 20).map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {contact.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddContact(contact.id)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
                {availableContacts.length > 20 && (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    Showing 20 of {availableContacts.length} contacts. Use search to find more.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center py-4 text-muted-foreground">
                {contactSearch
                  ? 'No matching contacts found'
                  : 'All contacts are already in this list'}
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
