import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar, MapPin, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/api/events.api';
import type { Event, EventFormData, EventType, EventStatus } from '@/types/event';
import {
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_COLORS,
} from '@/types/event';

const defaultFormData: EventFormData = {
  name: '',
  type: 'conference',
  description: '',
  startDate: '',
  endDate: '',
  applicationDeadline: '',
  location: '',
  isOnline: false,
  venue: '',
  website: '',
  applicationUrl: '',
  cost: '',
  travelRequired: true,
  status: 'tracking',
  priority: 'medium',
  relevantFor: ['both'],
  expectedAudience: '',
  notes: '',
  tags: [],
};

export const Events: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>(defaultFormData);

  // Fetch events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => listEvents(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created');
      closeDialog();
    },
    onError: () => toast.error('Failed to create event'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EventFormData> }) =>
      updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated');
      closeDialog();
    },
    onError: () => toast.error('Failed to update event'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
    },
    onError: () => toast.error('Failed to delete event'),
  });

  // Filter events
  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      !search ||
      event.name.toLowerCase().includes(search.toLowerCase()) ||
      event.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Dialog handlers
  const openCreateDialog = () => {
    setEditingEvent(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      type: event.type,
      description: event.description || '',
      startDate: event.startDate,
      endDate: event.endDate || '',
      applicationDeadline: event.applicationDeadline || '',
      location: event.location,
      isOnline: event.isOnline,
      venue: event.venue || '',
      website: event.website,
      applicationUrl: event.applicationUrl || '',
      cost: event.cost || '',
      travelRequired: event.travelRequired,
      status: event.status,
      priority: event.priority,
      relevantFor: event.relevantFor,
      expectedAudience: event.expectedAudience || '',
      notes: event.notes,
      tags: event.tags,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Track conferences, showcases, and meetups
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No events found. Add your first event!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{event.name}</CardTitle>
                    <CardDescription>
                      {EVENT_TYPE_LABELS[event.type]}
                    </CardDescription>
                  </div>
                  <Badge className={EVENT_STATUS_COLORS[event.status]}>
                    {EVENT_STATUS_LABELS[event.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formatDate(event.startDate)}
                  {event.endDate && ` - ${formatDate(event.endDate)}`}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="mr-2 h-4 w-4" />
                  {event.location}
                  {event.isOnline && ' (Online)'}
                </div>
                {event.applicationDeadline && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Deadline: </span>
                    <span className="font-medium">
                      {formatDate(event.applicationDeadline)}
                    </span>
                  </div>
                )}
                {event.cost && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cost: </span>
                    {event.cost}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {event.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(event.website, '_blank')}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Website
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(event)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(event.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </DialogTitle>
            <DialogDescription>
              {editingEvent
                ? 'Update event details'
                : 'Add a new event to track'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v as EventType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="Malmö, Sweden"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website *</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://..."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="applicationDeadline">Application Deadline</Label>
                <Input
                  id="applicationDeadline"
                  type="date"
                  value={formData.applicationDeadline}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      applicationDeadline: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                  placeholder="€500 or Free"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData({ ...formData, status: v as EventStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isOnline"
                  checked={formData.isOnline}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isOnline: !!checked })
                  }
                />
                <Label htmlFor="isOnline">Online Event</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="travelRequired"
                  checked={formData.travelRequired}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, travelRequired: !!checked })
                  }
                />
                <Label htmlFor="travelRequired">Travel Required</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
