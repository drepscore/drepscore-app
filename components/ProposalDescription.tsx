'use client';

import { MarkdownContent } from '@/components/MarkdownContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProposalDescriptionProps {
  aiSummary: string | null;
  abstract: string | null;
}

export function ProposalDescription({ aiSummary, abstract }: ProposalDescriptionProps) {
  if (!aiSummary && !abstract) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {aiSummary ? 'Summary' : 'Description'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {aiSummary && (
          <MarkdownContent content={aiSummary} className="text-sm leading-relaxed mb-3" />
        )}
        {abstract && (
          <div className={aiSummary ? 'border-t pt-3' : ''}>
            {aiSummary && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Full Description
              </p>
            )}
            <MarkdownContent content={abstract} className="text-sm text-foreground/85 leading-relaxed" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
