import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FlowCategory } from '@/core/types';
import { flowCategories } from './flowUtils';

export function FlowMetadataPanel({
  name,
  primaryCategory,
  isBusy,
  readOnly,
  starterLinkedToCategory,
  onNameChange,
  onCategoryChange,
  onOpenMetaFlowBuilder,
}: {
  name: string;
  primaryCategory: FlowCategory;
  isBusy?: boolean;
  readOnly?: boolean;
  starterLinkedToCategory?: boolean;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: FlowCategory) => void;
  onOpenMetaFlowBuilder: () => void;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Flow metadata</CardTitle>
            <CardDescription>
              Keep the essentials compact here. Nyife saves the selected primary category as a single-item Meta category array.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onOpenMetaFlowBuilder} disabled={isBusy}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Meta Flow Builder
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
        <div className="space-y-2">
          <Label htmlFor="flow-name">Flow name</Label>
          <Input
            id="flow-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Lead capture flow"
            disabled={readOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="flow-category">Primary category</Label>
          <Select
            value={primaryCategory}
            onValueChange={(value) => onCategoryChange(value as FlowCategory)}
            disabled={readOnly}
          >
            <SelectTrigger id="flow-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {flowCategories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {starterLinkedToCategory
              ? 'Changing the category still swaps the starter while this new flow stays untouched.'
              : 'Changing the category only updates flow metadata now. It does not rewrite an already edited builder or JSON draft.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
