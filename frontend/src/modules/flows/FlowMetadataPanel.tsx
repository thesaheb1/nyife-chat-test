import { WandSparkles } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import type { FlowCategory } from '@/core/types';
import { flowCategories } from './flowUtils';

export function FlowMetadataPanel({
  name,
  primaryCategory,
  isBusy,
  starterDirty,
  onNameChange,
  onCategoryChange,
  onApplyStarter,
}: {
  name: string;
  primaryCategory: FlowCategory;
  isBusy?: boolean;
  starterDirty?: boolean;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: FlowCategory) => void;
  onApplyStarter: () => void;
}) {
  return (
    <Card className="rounded-3xl border shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base">Flow metadata</CardTitle>
        <CardDescription>
          Keep the essentials compact here. The selected primary category controls the starter flow and stays Meta-compatible by saving as a single-item category array.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.75fr)]">
        <div className="space-y-2">
          <Label htmlFor="flow-name">Flow name</Label>
          <Input
            id="flow-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Lead capture flow"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="flow-category">Primary category</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={primaryCategory} onValueChange={(value) => onCategoryChange(value as FlowCategory)}>
              <SelectTrigger id="flow-category" className="flex-1">
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

            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={onApplyStarter}
              disabled={isBusy}
            >
              <WandSparkles className="mr-2 h-4 w-4" />
              {starterDirty ? 'Reset starter' : 'Apply starter'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick one official Meta category for this flow. You can reset the visual starter at any time without changing the stored JSON until you save.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
