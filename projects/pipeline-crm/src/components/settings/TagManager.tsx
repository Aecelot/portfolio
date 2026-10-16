import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { TAG_COLORS, getTagColorClasses } from '@/types/tag';
import type { Tag } from '@/types/tag';

export const TagManager: React.FC = () => {
  const { tags, loading, addTag, editTag, removeTag } = useTags();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('blue');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setTagName('');
    setTagColor('blue');
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (tag: Tag) => {
    setSelectedTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setShowEditDialog(true);
  };

  const handleOpenDelete = (tag: Tag) => {
    setSelectedTag(tag);
    setShowDeleteDialog(true);
  };

  const handleCreate = async () => {
    if (!tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTag({ name: tagName.trim(), color: tagColor });
      toast.success('Tag created');
      setShowCreateDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTag || !tagName.trim()) return;

    setIsSubmitting(true);
    try {
      await editTag(selectedTag.id, { name: tagName.trim(), color: tagColor });
      toast.success('Tag updated');
      setShowEditDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTag) return;

    setIsSubmitting(true);
    try {
      await removeTag(selectedTag.id);
      toast.success('Tag deleted');
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error('Failed to delete tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Tags
              </CardTitle>
              <CardDescription>Create and manage tags for organizing leads</CardDescription>
            </div>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Tag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-20 bg-muted animate-pulse rounded-full" />
              ))}
            </div>
          ) : tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tags created yet. Tags help you organize and filter your leads.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {tags.map((tag) => (
                <div key={tag.id} className="group relative">
                  <Badge className={`pr-8 ${getTagColorClasses(tag.color)}`}>
                    {tag.name}
                  </Badge>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                    <button
                      onClick={() => handleOpenEdit(tag)}
                      className="h-4 w-4 rounded hover:bg-black/10 flex items-center justify-center"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(tag)}
                      className="h-4 w-4 rounded hover:bg-black/10 flex items-center justify-center"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>Add a new tag to organize your leads</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter tag name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setTagColor(color.value)}
                    className={`h-8 w-8 rounded-full ${color.bg} ${
                      tagColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Preview</label>
              <div className="mt-2">
                <Badge className={getTagColorClasses(tagColor)}>
                  {tagName || 'Tag Preview'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Update the tag name and color</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter tag name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setTagColor(color.value)}
                    className={`h-8 w-8 rounded-full ${color.bg} ${
                      tagColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Preview</label>
              <div className="mt-2">
                <Badge className={getTagColorClasses(tagColor)}>
                  {tagName || 'Tag Preview'}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{selectedTag?.name}"? This will not remove the tag from existing leads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
