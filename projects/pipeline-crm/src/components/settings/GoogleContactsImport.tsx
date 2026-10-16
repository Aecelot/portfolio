import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGmail } from '@/hooks/useGmail';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, Timestamp, collection, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Users, Loader2, Download, CheckCircle2 } from 'lucide-react';

interface GoogleContact {
  resourceName: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
}

export const GoogleContactsImport: React.FC = () => {
  const { status } = useGmail();
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImport = async () => {
    if (!status.connected) {
      toast.error('Please connect Gmail first');
      return;
    }

    setImporting(true);
    try {
      const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const requestRef = doc(db, 'contactImportRequests', requestId);

      // Write the request
      await setDoc(requestRef, {
        createdAt: Timestamp.now(),
        status: 'pending',
      });

      // Listen for result
      const unsubscribe = onSnapshot(requestRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'completed') {
          unsubscribe();
          const importedContacts = data.contacts || [];
          setContacts(importedContacts);
          // Select all by default
          setSelectedContacts(new Set(importedContacts.map((c: GoogleContact) => c.resourceName)));
          setShowPreview(true);
          setImporting(false);
          toast.success(`Found ${importedContacts.length} contacts`);
        } else if (data?.status === 'error') {
          unsubscribe();
          toast.error(data.error || 'Failed to import contacts');
          setImporting(false);
        }
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        unsubscribe();
        if (importing) {
          toast.error('Import timed out. Please try again.');
          setImporting(false);
        }
      }, 60000);
    } catch (error) {
      console.error('Error importing contacts:', error);
      toast.error('Failed to start import');
      setImporting(false);
    }
  };

  const toggleContact = (resourceName: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(resourceName)) {
      newSelected.delete(resourceName);
    } else {
      newSelected.add(resourceName);
    }
    setSelectedContacts(newSelected);
  };

  const toggleAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.resourceName)));
    }
  };

  const handleSaveContacts = async () => {
    if (!user?.uid) {
      toast.error('You must be logged in');
      return;
    }

    const contactsToSave = contacts.filter(c => selectedContacts.has(c.resourceName));
    if (contactsToSave.length === 0) {
      toast.error('No contacts selected');
      return;
    }

    setSaving(true);
    try {
      const contactsCollection = collection(db, 'contacts');
      let savedCount = 0;

      for (const contact of contactsToSave) {
        await addDoc(contactsCollection, {
          name: contact.name || contact.email.split('@')[0],
          email: contact.email,
          phone: contact.phone || '',
          company: contact.company || '',
          role: contact.jobTitle || '',
          notes: '',
          tags: ['imported-from-google'],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user.uid,
        });
        savedCount++;
      }

      toast.success(`Imported ${savedCount} contacts successfully!`);
      setShowPreview(false);
      setContacts([]);
      setSelectedContacts(new Set());
    } catch (error) {
      console.error('Error saving contacts:', error);
      toast.error('Failed to save contacts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Google Contacts
          </CardTitle>
          <CardDescription>
            Bulk import contacts from your Google account into the CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!status.connected ? (
            <p className="text-sm text-muted-foreground">
              Connect Gmail above to enable contact import.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Import your Google Contacts into the CRM. You'll be able to preview
                and select which contacts to import.
              </p>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching contacts...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import from Google Contacts
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Select which contacts to import. {selectedContacts.size} of {contacts.length} selected.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-2 border-b">
            <Checkbox
              checked={selectedContacts.size === contacts.length && contacts.length > 0}
              onChange={toggleAll}
            />
            <span className="text-sm font-medium">Select All</span>
          </div>

          <div className="h-[400px] overflow-y-auto pr-4">
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.resourceName}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleContact(contact.resourceName)}
                >
                  <Checkbox
                    checked={selectedContacts.has(contact.resourceName)}
                    onChange={() => toggleContact(contact.resourceName)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {contact.name || contact.email}
                    </div>
                    {contact.name && contact.email && (
                      <div className="text-sm text-muted-foreground truncate">
                        {contact.email}
                      </div>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                      {contact.company && <span>{contact.company}</span>}
                      {contact.jobTitle && <span>{contact.jobTitle}</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveContacts} disabled={saving || selectedContacts.size === 0}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Import {selectedContacts.size} Contacts
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
