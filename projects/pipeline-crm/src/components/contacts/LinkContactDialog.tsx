import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useLeadContacts } from '@/hooks/useLeadContacts';
import { useAuth } from '@/contexts/AuthContext';
import { ContactCreateDialog } from './ContactCreateDialog';

interface LinkContactDialogProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LinkContactDialog: React.FC<LinkContactDialogProps> = ({
  leadId,
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { contacts, loading: contactsLoading } = useContacts();
  const { linkedContacts, linkContact } = useLeadContacts(leadId);
  const [search, setSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filter out already linked contacts and apply search
  const availableContacts = contacts.filter((contact) => {
    const isAlreadyLinked = linkedContacts.some((lc) => lc.id === contact.id);
    if (isAlreadyLinked) return false;

    if (search) {
      const searchLower = search.toLowerCase();
      return (
        contact.name.toLowerCase().includes(searchLower) ||
        contact.email.toLowerCase().includes(searchLower) ||
        contact.company?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const handleSubmit = async () => {
    if (!selectedContactId || !user) return;

    setIsSubmitting(true);
    try {
      await linkContact({
        contactId: selectedContactId,
        isPrimary,
        role: role || undefined,
        createdBy: user.uid,
      });
      toast.success('Contact linked successfully');
      onOpenChange(false);
      // Reset form
      setSelectedContactId(null);
      setRole('');
      setIsPrimary(false);
      setSearch('');
    } catch {
      toast.error('Failed to link contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactCreated = (contactId: string) => {
    setSelectedContactId(contactId);
    setShowCreateDialog(false);
  };

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Contact to Lead</DialogTitle>
            <DialogDescription>
              Search for an existing contact or create a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Create new button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Contact
            </Button>

            {/* Contact list */}
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {contactsLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading contacts...
                </div>
              ) : availableContacts.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {search ? 'No contacts match your search' : 'No available contacts'}
                </div>
              ) : (
                <div className="divide-y">
                  {availableContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                        selectedContactId === contact.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedContactId(contact.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{contact.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.email}
                            {contact.company && ` - ${contact.company}`}
                          </p>
                        </div>
                        {selectedContactId === contact.id && (
                          <Badge variant="default">Selected</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Link options */}
            {selectedContact && (
              <div className="space-y-4 border-t pt-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedContact.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkRole">Role for this Lead (optional)</Label>
                  <Input
                    id="linkRole"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g., Decision Maker, Technical Contact"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPrimary"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                  />
                  <Label htmlFor="isPrimary" className="text-sm font-normal cursor-pointer">
                    Set as primary contact for this lead
                  </Label>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedContactId || isSubmitting}
              >
                {isSubmitting ? 'Linking...' : 'Link Contact'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContactCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleContactCreated}
      />
    </>
  );
};
