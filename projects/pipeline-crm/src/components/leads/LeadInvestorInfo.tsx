import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, Target, Globe2 } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface LeadInvestorInfoProps {
  lead: Lead;
}

export const LeadInvestorInfo: React.FC<LeadInvestorInfoProps> = ({ lead }) => {
  const investor = lead.investor;

  if (!investor) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Investor Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {investor.type && (
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Investor Type</p>
                <p className="text-sm text-muted-foreground">{investor.type}</p>
              </div>
            </div>
          )}

          {investor.founded && (
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Founded</p>
                <p className="text-sm text-muted-foreground">{investor.founded}</p>
              </div>
            </div>
          )}

          {investor.investmentFocus && (
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Investment Focus</p>
                <p className="text-sm text-muted-foreground">{investor.investmentFocus}</p>
              </div>
            </div>
          )}

          {investor.hqRegion && (
            <div className="flex items-start gap-3">
              <Globe2 className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">HQ Region</p>
                <p className="text-sm text-muted-foreground">{investor.hqRegion}</p>
              </div>
            </div>
          )}
        </div>

        {investor.fundingPreferences && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Funding Preferences</p>
            <p className="text-sm text-muted-foreground">{investor.fundingPreferences}</p>
          </div>
        )}

        {investor.geographicalRegions && investor.geographicalRegions.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Geographical Regions</p>
            <div className="flex flex-wrap gap-2">
              {investor.geographicalRegions.map((region, index) => (
                <Badge key={index} variant="outline">
                  {region}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
