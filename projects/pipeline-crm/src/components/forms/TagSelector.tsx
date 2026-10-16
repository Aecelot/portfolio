import React, { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, X, Check, Tags } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { getTagColorClasses, TAG_COLORS } from '@/types/tag';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onChange,
}) => {
  const { tags, addTag } = useTags();
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleToggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter((t) => t !== tagName));
    } else {
      onChange([...selectedTags, tagName]);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    onChange(selectedTags.filter((t) => t !== tagName));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      await addTag({ name: newTagName.trim(), color: newTagColor });
      // Automatically select the new tag
      onChange([...selectedTags, newTagName.trim()]);
      setNewTagName('');
      setShowCreateForm(false);
      toast.success('Tag created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  const getTagColor = (tagName: string) => {
    const tag = tags.find((t) => t.name === tagName);
    return tag?.color || 'gray';
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tagName) => (
          <Badge
            key={tagName}
            className={`${getTagColorClasses(getTagColor(tagName))} pr-1`}
          >
            {tagName}
            <button
              type="button"
              onClick={() => handleRemoveTag(tagName)}
              className="ml-1 rounded-full hover:bg-black/10 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-6 px-2">
              <Plus className="h-3 w-3 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            {!showCreateForm ? (
              <>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">
                      No tags yet
                    </p>
                  ) : (
                    tags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.name);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.name)}
                          className="flex items-center gap-2 w-full p-2 rounded hover:bg-accent text-left"
                        >
                          <Badge className={getTagColorClasses(tag.color)}>
                            {tag.name}
                          </Badge>
                          {isSelected && <Check className="h-4 w-4 ml-auto text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="border-t mt-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <Tags className="h-4 w-4 mr-2" />
                    Create new tag
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-1 flex-wrap">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewTagColor(color.value)}
                      className={`h-6 w-6 rounded-full ${color.bg} ${
                        newTagColor === color.value ? 'ring-2 ring-offset-1 ring-primary' : ''
                      }`}
                      title={color.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewTagName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    onClick={handleCreateTag}
                    disabled={isCreating || !newTagName.trim()}
                  >
                    {isCreating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
