import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNewsletterLists, useListSubscribers } from '@/hooks/useNewsletterLists';
import { useNewsletters, useNewsletter } from '@/hooks/useNewsletters';
import { MarkdownEditor, RecipientPreview } from '@/components/newsletters';
import { ArrowLeft, Save, Send, Users, Loader2 } from 'lucide-react';

export const NewsletterCompose: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preselectedListId = searchParams.get('listId');

  const { lists, loading: listsLoading } = useNewsletterLists();
  const { createNewsletter, updateNewsletter, sendNewsletter } = useNewsletters();
  const { newsletter, loading: newsletterLoading } = useNewsletter(id || null);

  const [listId, setListId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);

  const { subscribers, loading: subscribersLoading } = useListSubscribers(listId || null);

  // Initialize form with existing newsletter or preselected list
  useEffect(() => {
    if (newsletter) {
      setListId(newsletter.listId);
      setSubject(newsletter.subject);
      setBody(newsletter.body);
    } else if (preselectedListId && !id) {
      setListId(preselectedListId);
    }
  }, [newsletter, preselectedListId, id]);

  const isEditing = !!id;
  const loading = listsLoading || (isEditing && newsletterLoading);

  const handleSave = async () => {
    if (!listId) {
      toast.error('Please select a list');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter content');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && newsletter) {
        await updateNewsletter(newsletter.id, { listId, subject, body });
        toast.success('Newsletter saved');
      } else {
        const newId = await createNewsletter({ listId, subject, body });
        toast.success('Newsletter created');
        navigate(`/newsletters/compose/${newId}`, { replace: true });
      }
    } catch (error) {
      toast.error('Failed to save newsletter');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!isEditing || !newsletter) {
      // Save first, then send
      await handleSave();
      return;
    }

    if (subscribers.length === 0) {
      toast.error('No subscribers in this list');
      return;
    }

    setSending(true);
    try {
      await sendNewsletter(newsletter.id);
      toast.success('Newsletter sending started');
      navigate('/newsletters');
    } catch (error) {
      toast.error('Failed to send newsletter');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const selectedList = lists.find((l) => l.id === listId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/newsletters')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEditing ? 'Edit Newsletter' : 'Compose Newsletter'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update your newsletter draft' : 'Create a new newsletter to send'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={handleSend} disabled={sending || subscribers.length === 0}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Send ({subscribers.length})
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Newsletter Details</CardTitle>
              <CardDescription>
                Configure the recipient list and compose your message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="list">Recipient List</Label>
                <Select value={listId} onValueChange={setListId}>
                  <SelectTrigger id="list">
                    <SelectValue placeholder="Select a list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Enter your email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <MarkdownEditor
                value={body}
                onChange={setBody}
                placeholder="Write your newsletter content in markdown..."
                label="Content"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recipients</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRecipients(!showRecipients)}
                >
                  <Users className="h-4 w-4 mr-1" />
                  {showRecipients ? 'Hide' : 'View All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!listId ? (
                <p className="text-sm text-muted-foreground">
                  Select a list to see recipients
                </p>
              ) : subscribersLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-2xl font-bold">{subscribers.length}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedList?.name || 'subscribers'}
                  </p>
                  {subscribers.length === 0 && (
                    <p className="text-sm text-amber-600">
                      No subscribers match the list filters. Edit the list to add contacts.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Template Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <code className="bg-muted px-1 rounded">{'{{name}}'}</code>
                  <span className="text-muted-foreground">Full name</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-1 rounded">{'{{firstName}}'}</code>
                  <span className="text-muted-foreground">First name</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-1 rounded">{'{{company}}'}</code>
                  <span className="text-muted-foreground">Company</span>
                </div>
                <div className="flex justify-between">
                  <code className="bg-muted px-1 rounded">{'{{unsubscribeUrl}}'}</code>
                  <span className="text-muted-foreground">Unsubscribe</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recipients Preview */}
      {showRecipients && listId && (
        <Card>
          <CardHeader>
            <CardTitle>All Recipients</CardTitle>
            <CardDescription>
              These contacts will receive this newsletter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecipientPreview
              subscribers={subscribers}
              loading={subscribersLoading}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
