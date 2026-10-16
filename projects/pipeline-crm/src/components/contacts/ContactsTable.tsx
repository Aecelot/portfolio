import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Mail, Phone, Linkedin, Users } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { EmptyState } from '@/components/common';
import type { ContactWithMeta } from '@/types/contact';

interface ContactsTableProps {
  contacts: ContactWithMeta[];
  loading?: boolean;
  onEdit: (contact: ContactWithMeta) => void;
  onDelete: (contact: ContactWithMeta) => void;
}

export const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  loading,
  onEdit,
  onDelete,
}) => {
  const { getTagById } = useTags();

  if (loading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Linked Leads</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-40 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-8 bg-muted animate-pulse rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="border rounded-lg">
        <EmptyState
          icon={Users}
          title="No contacts found"
          description="Try adjusting your filters or add a new contact to get started."
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Contact Info</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Linked Leads</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  {contact.role && (
                    <p className="text-sm text-muted-foreground">{contact.role}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {contact.company || '—'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1 text-sm hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </a>
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
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
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                    >
                      <Linkedin className="h-3 w-3" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.tags?.map((tagId) => {
                    const tag = getTagById(tagId);
                    if (!tag) return null;
                    return (
                      <Badge
                        key={tagId}
                        variant="secondary"
                        style={{ backgroundColor: tag.color, color: '#fff' }}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                  {(!contact.tags || contact.tags.length === 0) && (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {contact.linkedLeadsCount || 0} lead{(contact.linkedLeadsCount || 0) !== 1 ? 's' : ''}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(contact)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(contact)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
