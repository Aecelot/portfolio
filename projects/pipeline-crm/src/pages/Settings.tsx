import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ExportDialog, ImportDialog, TagManager, GmailConnection, GoogleContactsImport } from '@/components/settings';
import { initializeDefaultPipelines, migrateLeadsWithCreatedBy, migrateStudioPipelineWithQualifiedLead, initializeCommunityPipeline, initializeCommunityTags, initializeCompetitionPipeline } from '@/lib/firestore';
import { Download, Upload, User, Database, GitBranch, Wrench } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [initializingPipelines, setInitializingPipelines] = useState(false);
  const [pipelinesInitialized, setPipelinesInitialized] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ updated: number; skipped: number } | null>(null);
  const [migratingPipeline, setMigratingPipeline] = useState(false);
  const [pipelineMigrationResult, setPipelineMigrationResult] = useState<{ updated: boolean; message: string } | null>(null);
  const [initializingCommunity, setInitializingCommunity] = useState(false);
  const [communityResult, setCommunityResult] = useState<{ pipeline: string; tags: string } | null>(null);
  const [initializingCompetition, setInitializingCompetition] = useState(false);
  const [competitionResult, setCompetitionResult] = useState<{ created: boolean; message: string } | null>(null);

  const handleInitializePipelines = async () => {
    setInitializingPipelines(true);
    try {
      await initializeDefaultPipelines();
      setPipelinesInitialized(true);
      toast.success('Pipelines initialized successfully');
    } catch {
      toast.error('Failed to initialize pipelines. They may already exist.');
    } finally {
      setInitializingPipelines(false);
    }
  };

  const handleMigration = async () => {
    if (!user?.uid) return;
    setMigrating(true);
    try {
      const result = await migrateLeadsWithCreatedBy(user.uid);
      setMigrationResult(result);
      if (result.updated > 0) {
        toast.success(`Migration complete: ${result.updated} leads updated`);
      } else {
        toast.info('No leads needed migration');
      }
    } catch {
      toast.error('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handlePipelineMigration = async () => {
    setMigratingPipeline(true);
    try {
      const result = await migrateStudioPipelineWithQualifiedLead();
      setPipelineMigrationResult(result);
      if (result.updated) {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
    } catch {
      toast.error('Pipeline migration failed');
    } finally {
      setMigratingPipeline(false);
    }
  };

  const handleInitializeCommunity = async () => {
    if (!user?.uid) return;
    setInitializingCommunity(true);
    try {
      const pipelineResult = await initializeCommunityPipeline();
      const tagsResult = await initializeCommunityTags(user.uid);

      setCommunityResult({
        pipeline: pipelineResult.message,
        tags: `${tagsResult.created} tags created, ${tagsResult.skipped} already existed`,
      });

      if (pipelineResult.created || tagsResult.created > 0) {
        toast.success('Community features initialized');
      } else {
        toast.info('Community features already set up');
      }
    } catch {
      toast.error('Failed to initialize community features');
    } finally {
      setInitializingCommunity(false);
    }
  };

  const handleInitializeCompetition = async () => {
    setInitializingCompetition(true);
    try {
      const result = await initializeCompetitionPipeline();
      setCompetitionResult(result);
      if (result.created) {
        toast.success('Competition pipeline initialized');
      } else {
        toast.info(result.message);
      }
    } catch {
      toast.error('Failed to initialize competition pipeline');
    } finally {
      setInitializingCompetition(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.photoURL && (
              <div className="flex justify-center">
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profile'}
                  className="h-20 w-20 rounded-full"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Name</label>
              <p className="text-muted-foreground">{user?.displayName || 'Not set'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <p className="text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>Import and export your leads data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Export</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Export all your leads or filter by type. The export includes contact information,
                pipeline status, and all custom fields.
              </p>
              <Button onClick={() => setShowExportDialog(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export Leads
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Import</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Import leads from an Excel or CSV file. Required columns: Name, Contact Email.
              </p>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Leads
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TagManager />

      <GmailConnection />

      <GoogleContactsImport />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Data Migration
          </CardTitle>
          <CardDescription>Fix leads missing ownership data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Migrate existing leads to add your user ID as the owner. This is required
            for leads created before the security update. Run once to fix visibility issues.
          </p>
          {migrationResult && (
            <p className="text-sm text-green-600 mb-3">
              Last migration: {migrationResult.updated} updated, {migrationResult.skipped} already migrated
            </p>
          )}
          <Button
            onClick={handleMigration}
            disabled={migrating}
            variant="outline"
          >
            {migrating ? 'Migrating...' : 'Run Migration'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Pipeline Setup
          </CardTitle>
          <CardDescription>Initialize default pipeline stages</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Create the default Studio and Investor pipelines with predefined stages.
              Only run this once when setting up the CRM.
            </p>
            <Button
              onClick={handleInitializePipelines}
              disabled={initializingPipelines || pipelinesInitialized}
            >
              {initializingPipelines
                ? 'Initializing...'
                : pipelinesInitialized
                ? 'Pipelines Created'
                : 'Initialize Pipelines'}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Add Qualified Lead Stage</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Add the "Qualified Lead" stage to the studio pipeline (between Researched and Contacted).
              Run this once if your pipeline was created before this stage was added.
            </p>
            {pipelineMigrationResult && (
              <p className={`text-sm mb-3 ${pipelineMigrationResult.updated ? 'text-green-600' : 'text-muted-foreground'}`}>
                {pipelineMigrationResult.message}
              </p>
            )}
            <Button
              onClick={handlePipelineMigration}
              disabled={migratingPipeline}
              variant="outline"
            >
              {migratingPipeline ? 'Updating Pipeline...' : 'Add Qualified Lead Stage'}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Community/Channels Pipeline</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Add the Community lead type for tracking distribution channels (Discord servers,
              subreddits, game jams, etc.). This creates the Channels pipeline and community-specific tags.
            </p>
            {communityResult && (
              <div className="text-sm mb-3 space-y-1">
                <p className="text-muted-foreground">{communityResult.pipeline}</p>
                <p className="text-muted-foreground">{communityResult.tags}</p>
              </div>
            )}
            <Button
              onClick={handleInitializeCommunity}
              disabled={initializingCommunity}
              variant="outline"
            >
              {initializingCommunity ? 'Initializing...' : 'Add Community Features'}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Competition Pipeline</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Add the Competition lead type for tracking competitors. This creates a pipeline
              with stages: New, Researched, Tracking, Outreach - Product A, Outreach - Product B.
            </p>
            {competitionResult && (
              <p className={`text-sm mb-3 ${competitionResult.created ? 'text-green-600' : 'text-muted-foreground'}`}>
                {competitionResult.message}
              </p>
            )}
            <Button
              onClick={handleInitializeCompetition}
              disabled={initializingCompetition}
              variant="outline"
            >
              {initializingCompetition ? 'Initializing...' : 'Add Competition Pipeline'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} />
      <ImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
    </div>
  );
};
