import { useState, useEffect } from 'react';
import { getTagsRealtime, createTag, updateTag, deleteTag } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { Tag } from '@/types/tag';

export const useTags = () => {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = getTagsRealtime((tagsData) => {
      setTags(tagsData);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const addTag = async (data: { name: string; color: string }) => {
    if (!user) throw new Error('Not authenticated');

    // Check for duplicate name
    if (tags.some(t => t.name.toLowerCase() === data.name.toLowerCase())) {
      throw new Error('Tag with this name already exists');
    }

    const id = await createTag({
      ...data,
      createdBy: user.uid,
    });
    return id;
  };

  const editTag = async (id: string, data: { name?: string; color?: string }) => {
    // Check for duplicate name if name is being changed
    const newName = data.name;
    if (newName && tags.some(t => t.id !== id && t.name.toLowerCase() === newName.toLowerCase())) {
      throw new Error('Tag with this name already exists');
    }

    await updateTag(id, data);
  };

  const removeTag = async (id: string) => {
    await deleteTag(id);
  };

  const getTagById = (id: string) => {
    return tags.find(t => t.id === id);
  };

  const getTagByName = (name: string) => {
    return tags.find(t => t.name.toLowerCase() === name.toLowerCase());
  };

  return {
    tags,
    loading,
    error,
    addTag,
    editTag,
    removeTag,
    getTagById,
    getTagByName,
  };
};
