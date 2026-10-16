import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useNewsletterLists, useListSubscribers } from '@/hooks/useNewsletterLists';
import { useNewsletters } from '@/hooks/useNewsletters';
import { useGmail } from '@/hooks/useGmail';
import { ListCard, ListEditor, CampaignCard } from '@/components/newsletters';
import type { NewsletterList, Newsletter } from '@/types/newsletter';
import { Mail, AlertCircle, Loader2, Plus } from 'lucide-react';

// Helper component to show subscriber count for a list
const ListCardWithCount: React.FC<{
  list: NewsletterList;
  onEdit: () => void;
  onCompose: () => void;
}> = ({ list, onEdit, onCompose }) => {
  const { subscribers } = useListSubscribers(list.id);
  return (
    <ListCard
      list={list}
      subscriberCount={subscribers.length}
      onEdit={onEdit}
      onCompose={onCompose}
    />
  );
};

export const Newsletters: React.FC = () => {
  const navigate = useNavigate();
  const { lists, loading: listsLoading, updateList, addContactToList, removeContactFromList } = useNewsletterLists();
  const { newsletters, loading: newslettersLoading, deleteNewsletter, sendNewsletter } = useNewsletters();
  const { status: gmailStatus } = useGmail();

  const [editingList, setEditingList] = useState<NewsletterList | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Newsletter | null>(null);
  const [sendConfirm, setSendConfirm] = useState<Newsletter | null>(null);
  const [activeTab, setActiveTab] = useState('lists');

  const loading = listsLoading || newslettersLoading;

  const handleEditList = (list: NewsletterList) => {
    setEditingList(list);
  };

  const handleCompose = (listId: string) => {
    navigate(`/newsletters/compose?listId=${listId}`);
  };

  const handleEditNewsletter = (newsletter: Newsletter) => {
    navigate(`/newsletters/compose/${newsletter.id}`);
  };

  const handleDelete = async (newsletter: Newsletter) => {
    try {
      await deleteNewsletter(newsletter.id);
      toast.success('Newsletter deleted');
      setDeleteConfirm(null);
    } catch (error) {
      toast.error('Failed to delete newsletter');
      console.error(error);
    }
  };

  const handleSend = async (newsletter: Newsletter) => {
    try {
      await sendNewsletter(newsletter.id);
      toast.success('Newsletter sending started');
      setSendConfirm(null);
    } catch (error) {
      toast.error('Failed to send newsletter');
      console.error(error);
    }
  };

  const handleSaveList = async (id: string, data: Parameters<typeof updateList>[1]) => {
    try {
      await updateList(id, data);
      toast.success('List updated');
    } catch (error) {
      toast.error('Failed to update list');
      throw error;
    }
  };

  // Get list name by ID
  const getListName = (listId: string) => {
    return lists.find((l) => l.id === listId)?.name || 'Unknown List';
  };

  // Group newsletters by status
  const draftNewsletters = newsletters.filter((n) => n.status === 'draft');
  const sentNewsletters = newsletters.filter((n) => n.status !== 'draft');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Newsletters</h1>
          <p className="text-muted-foreground">
            Send broadcast emails to your customers and investors
          </p>
        </div>
        <Button
          onClick={() => navigate('/newsletters/compose')}
          disabled={!gmailStatus.connected || lists.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Newsletter
        </Button>
      </div>

      {!gmailStatus.connected && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">Gmail not connected</p>
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account in Settings to send newsletters.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="lists">Lists ({lists.length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({draftNewsletters.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({sentNewsletters.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="lists" className="space-y-4 mt-4">
            {lists.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No lists yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Newsletter lists will be created automatically.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {lists.map((list) => (
                  <ListCardWithCount
                    key={list.id}
                    list={list}
                    onEdit={() => handleEditList(list)}
                    onCompose={() => handleCompose(list.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4 mt-4">
            {draftNewsletters.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No drafts</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Start composing a newsletter to create a draft.
                  </p>
                  <Button
                    onClick={() => navigate('/newsletters/compose')}
                    disabled={!gmailStatus.connected || lists.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Compose Newsletter
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {draftNewsletters.map((newsletter) => (
                  <CampaignCard
                    key={newsletter.id}
                    newsletter={newsletter}
                    listName={getListName(newsletter.listId)}
                    onEdit={() => handleEditNewsletter(newsletter)}
                    onDelete={() => setDeleteConfirm(newsletter)}
                    onSend={() => setSendConfirm(newsletter)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4 mt-4">
            {sentNewsletters.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No sent newsletters</h3>
                  <p className="text-muted-foreground text-center">
                    Newsletters you send will appear here with engagement stats.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {sentNewsletters.map((newsletter) => (
                  <CampaignCard
                    key={newsletter.id}
                    newsletter={newsletter}
                    listName={getListName(newsletter.listId)}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onSend={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* List Editor Dialog */}
      <ListEditor
        list={editingList}
        open={editingList !== null}
        onOpenChange={(open) => !open && setEditingList(null)}
        onSave={handleSaveList}
        onRemoveContact={removeContactFromList}
        onAddContact={addContactToList}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Newsletter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.subject}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Confirmation */}
      <AlertDialog open={!!sendConfirm} onOpenChange={() => setSendConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Newsletter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send "{sendConfirm?.subject}" to all subscribers in {sendConfirm && getListName(sendConfirm.listId)}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendConfirm && handleSend(sendConfirm)}>
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
