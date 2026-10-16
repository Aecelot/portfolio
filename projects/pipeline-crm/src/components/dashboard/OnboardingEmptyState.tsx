import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, DollarSign, Users, ArrowRight, Sparkles } from 'lucide-react';
import { LeadCreateDialog } from '@/components/leads/LeadCreateDialog';

export const OnboardingEmptyState: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [defaultLeadType, setDefaultLeadType] = useState<'studio' | 'investor'>('studio');

  const handleCreateStudioLead = () => {
    setDefaultLeadType('studio');
    setShowCreateDialog(true);
  };

  const handleCreateInvestorLead = () => {
    setDefaultLeadType('investor');
    setShowCreateDialog(true);
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Pipeline CRM</h2>
          <p className="text-muted-foreground max-w-md">
            Your game development CRM is ready. Start by adding your first lead to track studios and investors.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 max-w-2xl w-full">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleCreateStudioLead}>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                <Building className="h-6 w-6 text-purple-600 dark:text-purple-300" />
              </div>
              <CardTitle className="text-lg">Add a Studio</CardTitle>
              <CardDescription>
                Track game studios, publishers, and development partners
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Add Studio Lead
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleCreateInvestorLead}>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
              </div>
              <CardTitle className="text-lg">Add an Investor</CardTitle>
              <CardDescription>
                Track investors, VCs, and funding opportunities
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">
                <DollarSign className="h-4 w-4 mr-2" />
                Add Investor Lead
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">Or explore the app first</p>
          <div className="flex gap-2 justify-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/pipeline/studio')}>
              Studio Pipeline
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/pipeline/investor')}>
              Investor Pipeline
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <LeadCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultType={defaultLeadType}
      />
    </>
  );
};
