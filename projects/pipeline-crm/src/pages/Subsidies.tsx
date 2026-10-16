import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ExternalLink, Pencil, Trash2, Clock, Euro } from 'lucide-react';
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
  listSubsidies,
  createSubsidy,
  updateSubsidy,
  deleteSubsidy,
} from '@/api/subsidies.api';
import type { Subsidy, SubsidyFormData, SubsidyType, SubsidyStatus } from '@/types/subsidy';
import {
  SUBSIDY_TYPE_LABELS,
  SUBSIDY_STATUS_LABELS,
  SUBSIDY_STATUS_COLORS,
} from '@/types/subsidy';

const defaultFormData: SubsidyFormData = {
  name: '',
  type: 'grant',
  description: '',
  provider: '',
  providerCountry: '',
  website: '',
  applicationUrl: '',
  amount: '',
  amountMin: undefined,
  amountMax: undefined,
  fundingPercentage: undefined,
  deadline: '',
  openDate: '',
  decisionDate: '',
  isRolling: false,
  eligibility: '',
  eligibilityCountries: [],
  eligibilityRequirements: [],
  status: 'tracking',
  priority: 'medium',
  relevantFor: ['both'],
  applicationStartedAt: '',
  applicationSubmittedAt: '',
  nextAction: '',
  nextActionDue: '',
  notes: '',
  tags: [],
  documents: [],
};

export const Subsidies: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubsidy, setEditingSubsidy] = useState<Subsidy | null>(null);
  const [formData, setFormData] = useState<SubsidyFormData>(defaultFormData);

  // Fetch subsidies
  const { data: subsidies = [], isLoading } = useQuery({
    queryKey: ['subsidies'],
    queryFn: () => listSubsidies(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createSubsidy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subsidies'] });
      toast.success('Subsidy created');
      closeDialog();
    },
    onError: () => toast.error('Failed to create subsidy'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubsidyFormData> }) =>
      updateSubsidy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subsidies'] });
      toast.success('Subsidy updated');
      closeDialog();
    },
    onError: () => toast.error('Failed to update subsidy'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubsidy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subsidies'] });
      toast.success('Subsidy deleted');
    },
    onError: () => toast.error('Failed to delete subsidy'),
  });

  // Filter subsidies
  const filteredSubsidies = subsidies.filter((subsidy) => {
    const matchesSearch =
      !search ||
      subsidy.name.toLowerCase().includes(search.toLowerCase()) ||
      subsidy.provider.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || subsidy.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Dialog handlers
  const openCreateDialog = () => {
    setEditingSubsidy(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (subsidy: Subsidy) => {
    setEditingSubsidy(subsidy);
    setFormData({
      name: subsidy.name,
      type: subsidy.type,
      description: subsidy.description || '',
      provider: subsidy.provider,
      providerCountry: subsidy.providerCountry,
      website: subsidy.website,
      applicationUrl: subsidy.applicationUrl || '',
      amount: subsidy.amount || '',
      amountMin: subsidy.amountMin,
      amountMax: subsidy.amountMax,
      fundingPercentage: subsidy.fundingPercentage,
      deadline: subsidy.deadline || '',
      openDate: subsidy.openDate || '',
      decisionDate: subsidy.decisionDate || '',
      isRolling: subsidy.isRolling,
      eligibility: subsidy.eligibility,
      eligibilityCountries: subsidy.eligibilityCountries || [],
      eligibilityRequirements: subsidy.eligibilityRequirements || [],
      status: subsidy.status,
      priority: subsidy.priority,
      relevantFor: subsidy.relevantFor,
      applicationStartedAt: subsidy.applicationStartedAt || '',
      applicationSubmittedAt: subsidy.applicationSubmittedAt || '',
      nextAction: subsidy.nextAction || '',
      nextActionDue: subsidy.nextActionDue || '',
      notes: subsidy.notes,
      tags: subsidy.tags,
      documents: subsidy.documents || [],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSubsidy(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubsidy) {
      updateMutation.mutate({ id: editingSubsidy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this subsidy?')) {
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

  const isDeadlineSoon = (deadline?: string) => {
    if (!deadline) return false;
    const days = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 && days <= 30;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subsidies</h1>
          <p className="text-muted-foreground">
            Track grants, tax credits, and funding opportunities
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subsidy
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search subsidies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(SUBSIDY_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subsidies Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredSubsidies.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No subsidies found. Add your first subsidy!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubsidies.map((subsidy) => (
            <Card key={subsidy.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{subsidy.name}</CardTitle>
                    <CardDescription>{subsidy.provider}</CardDescription>
                  </div>
                  <Badge className={SUBSIDY_STATUS_COLORS[subsidy.status]}>
                    {SUBSIDY_STATUS_LABELS[subsidy.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Euro className="mr-2 h-4 w-4" />
                  {subsidy.amount || 'Amount TBD'}
                </div>
                {subsidy.deadline && (
                  <div
                    className={`flex items-center text-sm ${
                      isDeadlineSoon(subsidy.deadline)
                        ? 'text-orange-600 font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Deadline: {formatDate(subsidy.deadline)}
                  </div>
                )}
                {subsidy.isRolling && (
                  <div className="text-sm text-muted-foreground">
                    Rolling deadline
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Eligibility: </span>
                  <span className="line-clamp-2">{subsidy.eligibility}</span>
                </div>
                {subsidy.nextAction && (
                  <div className="text-sm bg-muted p-2 rounded">
                    <span className="font-medium">Next: </span>
                    {subsidy.nextAction}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {subsidy.relevantFor.map((company) => (
                    <Badge key={company} variant="outline" className="text-xs">
                      {company === 'both' ? 'A + B' : company.toUpperCase()}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">
                    {SUBSIDY_TYPE_LABELS[subsidy.type]}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-2">
                  {subsidy.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(subsidy.website, '_blank')}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Website
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(subsidy)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(subsidy.id)}
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
              {editingSubsidy ? 'Edit Subsidy' : 'Add Subsidy'}
            </DialogTitle>
            <DialogDescription>
              {editingSubsidy
                ? 'Update subsidy details'
                : 'Add a new funding opportunity to track'}
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
                  placeholder="WBSO 2026"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v as SubsidyType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBSIDY_TYPE_LABELS).map(([value, label]) => (
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
                <Label htmlFor="provider">Provider *</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData({ ...formData, provider: e.target.value })
                  }
                  placeholder="RVO"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="providerCountry">Country</Label>
                <Input
                  id="providerCountry"
                  value={formData.providerCountry}
                  onChange={(e) =>
                    setFormData({ ...formData, providerCountry: e.target.value })
                  }
                  placeholder="Netherlands"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="€50K or Up to 32%"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData({ ...formData, status: v as SubsidyStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBSIDY_STATUS_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      priority: v as 'high' | 'medium' | 'low',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRolling"
                checked={formData.isRolling}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isRolling: !!checked })
                }
              />
              <Label htmlFor="isRolling">Rolling deadline</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eligibility">Eligibility *</Label>
              <Input
                id="eligibility"
                value={formData.eligibility}
                onChange={(e) =>
                  setFormData({ ...formData, eligibility: e.target.value })
                }
                placeholder="Dutch R&D companies"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nextAction">Next Action</Label>
                <Input
                  id="nextAction"
                  value={formData.nextAction}
                  onChange={(e) =>
                    setFormData({ ...formData, nextAction: e.target.value })
                  }
                  placeholder="Gather financial docs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextActionDue">Due</Label>
                <Input
                  id="nextActionDue"
                  type="date"
                  value={formData.nextActionDue}
                  onChange={(e) =>
                    setFormData({ ...formData, nextActionDue: e.target.value })
                  }
                />
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
                {editingSubsidy ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
