import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BulkEnrollment } from '@/components/sequences/BulkEnrollment';
import type { Lead, Pipeline } from '@/types';
import { Loader2, Users } from 'lucide-react';

export const BulkEnroll: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(searchParams.get('pipeline') || '');
  const [selectedStageId, setSelectedStageId] = useState(searchParams.get('stage') || '');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPipelines, setLoadingPipelines] = useState(true);

  // Load pipelines on mount
  useEffect(() => {
    const loadPipelines = async () => {
      const snap = await getDocs(collection(db, 'pipelines'));
      const pipelineList = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pipeline[];
      setPipelines(pipelineList);
      setLoadingPipelines(false);
    };
    loadPipelines();
  }, []);

  // Get stages for selected pipeline
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const stages = selectedPipeline?.stages || [];

  // Load leads when pipeline/stage changes
  useEffect(() => {
    if (!selectedPipelineId) {
      setLeads([]);
      return;
    }

    const loadLeads = async () => {
      setLoading(true);
      try {
        let q = query(
          collection(db, 'leads'),
          where('pipeline.id', '==', selectedPipelineId),
          orderBy('name')
        );

        if (selectedStageId) {
          q = query(
            collection(db, 'leads'),
            where('pipeline.id', '==', selectedPipelineId),
            where('pipeline.stageId', '==', selectedStageId),
            orderBy('name')
          );
        }

        const snap = await getDocs(q);
        const leadList = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Lead[];
        
        // Filter to only leads with email
        const leadsWithEmail = leadList.filter((l) => l.contact?.email);
        setLeads(leadsWithEmail);
      } catch (error) {
        console.error('Error loading leads:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeads();
  }, [selectedPipelineId, selectedStageId]);

  if (loadingPipelines) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Sequence Enrollment</h1>
        <p className="text-muted-foreground">
          Select leads from a pipeline and enroll them in an email sequence with personalized content.
        </p>
      </div>

      {/* Pipeline & Stage Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Leads</CardTitle>
          <CardDescription>
            Choose a pipeline and optionally a stage to filter leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-64">
              <Select value={selectedPipelineId} onValueChange={(v) => {
                setSelectedPipelineId(v);
                setSelectedStageId('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPipelineId && stages.length > 0 && (
              <div className="w-48">
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All stages</SelectItem>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            
            {!loading && selectedPipelineId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {leads.length} leads with email
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Enrollment Component */}
      {leads.length > 0 && <BulkEnrollment leads={leads} />}

      {selectedPipelineId && !loading && leads.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leads with email addresses</h3>
            <p className="text-muted-foreground text-center">
              Add email addresses to leads to enroll them in sequences.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkEnroll;
