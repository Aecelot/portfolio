import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContactForm } from './ContactForm';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/contexts/AuthContext';
import type { Contact } from '@/types/contact';

interface ContactCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (contactId: string) => void;
}

export const ContactCreateDialog: React.FC<ContactCreateDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const { user } = useAuth();
  const { addContact } = useContacts();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: Partial<Contact>) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const contactId = await addContact({
        ...values,
        createdBy: user.uid,
      } as any);
      toast.success('Contact created successfully');
      onOpenChange(false);
      if (onCreated) {
        onCreated(contactId);
      }
    } catch {
      toast.error('Failed to create contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to your contact book.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Create Contact"
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};
