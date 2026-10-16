import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Plus,
  MoreHorizontal,
  Star,
  Unlink,
  Mail,
  Phone,
  Linkedin,
  User,
} from 'lucide-react';
import { useLeadContacts, type LinkedContact } from '@/hooks/useLeadContacts';
import { LinkContactDialog } from './LinkContactDialog';

interface LeadContactsProps {
  leadId: string;
}

export const LeadContacts: React.FC<LeadContactsProps> = ({ leadId }) => {
  const { linkedContacts, loading, unlinkContact, setPrimary } = useLeadContacts(leadId);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [contactToUnlink, setContactToUnlink] = useState<LinkedContact | null>(null);

  const handleSetPrimary = async (linkId: string) => {
    try {
      await setPrimary(linkId);
      toast.success('Primary contact updated');
    } catch {
      toast.error('Failed to update primary contact');
    }
  };

  const handleUnlink = async () => {
    if (!contactToUnlink) return;

    try {
      await unlinkContact(contactToUnlink.linkId);
      toast.success('Contact unlinked');
      setContactToUnlink(null);
    } catch {
      toast.error('Failed to unlink contact');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-medium">
            Contacts
            {linkedContacts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {linkedContacts.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => setShowLinkDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Link Contact
          </Button>
        </CardHeader>
        <CardContent>
          {linkedContacts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <User className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No contacts linked to this lead</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setShowLinkDialog(true)}
              >
                Link a contact
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedContacts.map((contact) => (
                <div
                  key={contact.linkId}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{contact.name}</p>
                      {contact.isPrimary && (
                        <Badge variant="default" className="shrink-0">
                          <Star className="mr-1 h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    {(contact.linkRole || contact.role) && (
                      <p className="text-sm text-muted-foreground">
                        {contact.linkRole || contact.role}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2">
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.linkedin && (
                        <a
                          href={contact.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!contact.isPrimary && (
                        <DropdownMenuItem onClick={() => handleSetPrimary(contact.linkId)}>
                          <Star className="mr-2 h-4 w-4" />
                          Set as Primary
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setContactToUnlink(contact)}
                        className="text-destructive"
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        Unlink
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LinkContactDialog
        leadId={leadId}
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
      />

      <AlertDialog open={!!contactToUnlink} onOpenChange={() => setContactToUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink {contactToUnlink?.name} from this lead?
              The contact will remain in your contact book.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
