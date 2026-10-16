import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Shield, Calendar, DollarSign, Users, Globe, AlertTriangle } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { COMPETITION_TARGET_LABELS } from '@/types/lead';

interface LeadCompetitionInfoProps {
  lead: Lead;
}

const getThreatLevelColor = (level: number): string => {
  switch (level) {
    case 5: return 'bg-red-500 text-white';
    case 4: return 'bg-orange-500 text-white';
    case 3: return 'bg-yellow-500 text-black';
    case 2: return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getThreatLevelLabel = (level: number): string => {
  switch (level) {
    case 5: return 'Major Threat';
    case 4: return 'High';
    case 3: return 'Moderate';
    case 2: return 'Low';
    default: return 'Minimal';
  }
};

const formatCurrency = (value: number | undefined): string => {
  if (!value) return '-';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
};

const formatNumber = (value: number | undefined): string => {
  if (!value) return '-';
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
};

export const LeadCompetitionInfo: React.FC<LeadCompetitionInfoProps> = ({ lead }) => {
  const competition = lead.competition;

  if (!competition) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Competition Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {competition.targetMarket && (
            <div className="flex items-start gap-3">
              <Target className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Target Market</p>
                <p className="text-sm text-muted-foreground">
                  {COMPETITION_TARGET_LABELS[competition.targetMarket]}
                </p>
              </div>
            </div>
          )}

          {competition.threatLevel && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Threat Level</p>
                <Badge className={getThreatLevelColor(competition.threatLevel)}>
                  {competition.threatLevel} - {getThreatLevelLabel(competition.threatLevel)}
                </Badge>
              </div>
            </div>
          )}

          {competition.fundingStage && (
            <div className="flex items-start gap-3">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Funding Stage</p>
                <p className="text-sm text-muted-foreground">{competition.fundingStage}</p>
              </div>
            </div>
          )}

          {competition.teamSize && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Team Size</p>
                <p className="text-sm text-muted-foreground">{competition.teamSize}</p>
              </div>
            </div>
          )}

          {competition.foundedYear && (
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Founded</p>
                <p className="text-sm text-muted-foreground">{competition.foundedYear}</p>
              </div>
            </div>
          )}

          {competition.website && (
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                <p className="text-sm font-medium">Website</p>
                <a
                  href={competition.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {competition.website}
                </a>
              </div>
            </div>
          )}
        </div>

        {competition.products && competition.products.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Products</p>
            <div className="flex flex-wrap gap-2">
              {competition.products.map((product, index) => (
                <Badge key={index} variant="outline">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {competition.pricingInfo && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Pricing</p>
            <p className="text-sm text-muted-foreground">{competition.pricingInfo}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
          {(competition.estimatedPaidUsers || competition.estimatedFreeUsers) && (
            <div>
              <p className="text-sm font-medium mb-2">User Estimates</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {competition.estimatedPaidUsers && (
                  <p>Paid: {formatNumber(competition.estimatedPaidUsers)}</p>
                )}
                {competition.estimatedFreeUsers && (
                  <p>Free: {formatNumber(competition.estimatedFreeUsers)}</p>
                )}
              </div>
            </div>
          )}

          {(competition.estimatedRevenue || competition.amountRaised) && (
            <div>
              <p className="text-sm font-medium mb-2">Financials</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {competition.estimatedRevenue && (
                  <p>Est. Revenue: {formatCurrency(competition.estimatedRevenue)}</p>
                )}
                {competition.amountRaised && (
                  <p>Amount Raised: {formatCurrency(competition.amountRaised)}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {(competition.strengths?.length > 0 || competition.weaknesses?.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
            {competition.strengths && competition.strengths.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-green-600">Strengths</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {competition.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-green-500">+</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {competition.weaknesses && competition.weaknesses.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-red-600">Weaknesses</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {competition.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-500">-</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {competition.differentiator && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Differentiator</p>
            <p className="text-sm text-muted-foreground">{competition.differentiator}</p>
          </div>
        )}

        {competition.lastChecked && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(competition.lastChecked).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
