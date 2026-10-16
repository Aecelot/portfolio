import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { createActivity } from '@/lib/firestore';
import { toast } from 'sonner';
import type { ManualActivityType } from '@/types/activity';
import { MANUAL_ACTIVITY_TYPES } from '@/types/activity';

interface LogActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
}

export const LogActivityModal: React.FC<LogActivityModalProps> = ({
  open,
  onOpenChange,
  leadId,
  leadName,
}) => {
  const { user } = useAuth();
  const [activityType, setActivityType] = useState<ManualActivityType>('call');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error('Please add a description');
      return;
    }

    setIsSubmitting(true);
    try {
      const activityLabel = MANUAL_ACTIVITY_TYPES.find(t => t.value === activityType)?.label || activityType;

      await createActivity({
        leadId,
        type: activityType,
        description: `${activityLabel}: ${description.trim()}`,
        userId: user?.uid || '',
        userEmail: user?.email || '',
      });

      toast.success('Activity logged');
      onOpenChange(false);
      // Reset form
      setActivityType('call');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      toast.error('Failed to log activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset form
    setActivityType('call');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>
              Record an interaction with {leadName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activityType">Activity Type</Label>
              <Select
                value={activityType}
                onValueChange={(value) => setActivityType(value as ManualActivityType)}
              >
                <SelectTrigger id="activityType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_ACTIVITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? Any follow-up needed?"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Log Activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
