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
import type { Contact } from '@/types/contact';

interface ContactEditDialogProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactEditDialog: React.FC<ContactEditDialogProps> = ({
  contact,
  open,
  onOpenChange,
}) => {
  const { editContact } = useContacts();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: Partial<Contact>) => {
    if (!contact) return;

    setIsSubmitting(true);
    try {
      await editContact(contact.id, values);
      toast.success('Contact updated successfully');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update the contact information.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          initialValues={contact}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};
