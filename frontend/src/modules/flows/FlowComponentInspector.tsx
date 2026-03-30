import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { FlowComponent, FlowOption, FlowScreen } from '@/core/types';
import { getFlowComponentCapabilities } from './flowUtils';

export function FlowComponentInspector({
  component,
  readOnly,
  screens,
  onChange,
}: {
  component: FlowComponent;
  readOnly?: boolean;
  screens: FlowScreen[];
  onChange: (updater: (component: FlowComponent) => FlowComponent) => void;
}) {
  const capabilities = getFlowComponentCapabilities(component.type);
  const updateOption = (index: number, updater: (option: FlowOption) => FlowOption) => {
    onChange((current) => ({
      ...current,
      options: (current.options || []).map((option, optionIndex) => (
        optionIndex === index ? updater(option) : option
      )),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-3 py-2">
        <p className="text-sm font-medium">{component.type}</p>
      </div>

      {'text' in component && component.type !== 'Footer' && (
        <div className="space-y-2">
          <Label>Text</Label>
          <Textarea
            value={component.text || ''}
            onChange={(event) => onChange((current) => ({ ...current, text: event.target.value }))}
            rows={component.type === 'TextBody' ? 5 : 3}
            disabled={readOnly}
          />
        </div>
      )}

      {(capabilities.supportsName || capabilities.supportsLabel || capabilities.supportsHelperText || capabilities.supportsRequired) && (
        <>
          {capabilities.supportsName ? (
            <div className="space-y-2">
              <Label>Field name</Label>
              <Input
                value={component.name || ''}
                onChange={(event) => onChange((current) => ({ ...current, name: event.target.value.replace(/\s+/g, '_') }))}
                disabled={readOnly}
              />
            </div>
          ) : null}
          {capabilities.supportsLabel ? (
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={component.label || ''}
                onChange={(event) => onChange((current) => ({ ...current, label: event.target.value }))}
                disabled={readOnly}
              />
            </div>
          ) : null}
          {capabilities.supportsHelperText ? (
            <div className="space-y-2">
              <Label>Helper text</Label>
              <Input
                value={component.helper_text || ''}
                onChange={(event) => onChange((current) => ({ ...current, helper_text: event.target.value }))}
                disabled={readOnly}
              />
            </div>
          ) : null}
          {capabilities.supportsRequired ? (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Required</p>
                <p className="text-xs text-muted-foreground">Mark this answer as mandatory.</p>
              </div>
              <Switch
                checked={Boolean(component.required)}
                onCheckedChange={(checked) => onChange((current) => ({ ...current, required: checked }))}
                disabled={readOnly}
              />
            </div>
          ) : null}
        </>
      )}

      {(capabilities.supportsMinLength || capabilities.supportsMaxLength) && component.type === 'TextInput' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Min length</Label>
            <Input
              type="number"
              min={0}
              value={component.min_length ?? ''}
              onChange={(event) => onChange((current) => ({
                ...current,
                min_length: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Max length</Label>
            <Input
              type="number"
              min={0}
              value={component.max_length ?? ''}
              onChange={(event) => onChange((current) => ({
                ...current,
                max_length: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              disabled={readOnly}
            />
          </div>
        </div>
      )}

      {capabilities.supportsOptions && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={() => onChange((current) => ({
                ...current,
                options: [...(current.options || []), { id: `option_${(current.options || []).length + 1}`, title: `Option ${(current.options || []).length + 1}` }],
              }))}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add option
            </Button>
          </div>
          {(component.options || []).map((option, index) => (
            <div key={option.id} className="rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Option {index + 1}</Label>
                <Input
                  value={option.title}
                  onChange={(event) => updateOption(index, (current) => ({ ...current, title: event.target.value }))}
                  disabled={readOnly}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={readOnly}
                    onClick={() => onChange((current) => ({
                      ...current,
                      options: (current.options || []).filter((_, optionIndex) => optionIndex !== index),
                    }))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {capabilities.supportsSelectionBounds && component.type === 'CheckboxGroup' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Min selections</Label>
            <Input
              type="number"
              min={0}
              value={component.min_selections ?? ''}
              onChange={(event) => onChange((current) => ({
                ...current,
                min_selections: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Max selections</Label>
            <Input
              type="number"
              min={0}
              value={component.max_selections ?? ''}
              onChange={(event) => onChange((current) => ({
                ...current,
                max_selections: event.target.value === '' ? undefined : Number(event.target.value),
              }))}
              disabled={readOnly}
            />
          </div>
        </div>
      )}

      {component.type === 'Image' && (
        <>
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input
              value={component.image_url || ''}
              onChange={(event) => onChange((current) => ({ ...current, image_url: event.target.value }))}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Caption</Label>
            <Input
              value={component.caption || ''}
              onChange={(event) => onChange((current) => ({ ...current, caption: event.target.value }))}
              disabled={readOnly}
            />
          </div>
        </>
      )}

      {component.type === 'Footer' && (
        <>
          <div className="space-y-2">
            <Label>CTA label</Label>
            <Input
              value={component.label || ''}
              onChange={(event) => onChange((current) => ({ ...current, label: event.target.value }))}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select
              value={component.action?.type || 'complete'}
              onValueChange={(value) => onChange((current) => ({
                ...current,
                action: {
                  ...(current.action || {}),
                  type: value as 'complete' | 'navigate',
                },
              }))}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complete">Complete flow</SelectItem>
                <SelectItem value="navigate">Navigate to screen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {component.action?.type === 'navigate' && (
            <div className="space-y-2">
              <Label>Target screen</Label>
              <Select
                value={component.action.target_screen_id || ''}
                onValueChange={(value) => onChange((current) => ({
                  ...current,
                  action: {
                    ...(current.action || { type: 'navigate' }),
                    type: 'navigate',
                    target_screen_id: value,
                  },
                }))}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select screen" />
                </SelectTrigger>
                <SelectContent>
                  {screens.map((screen) => (
                    <SelectItem key={screen.id} value={screen.id}>{screen.title} ({screen.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  );
}
