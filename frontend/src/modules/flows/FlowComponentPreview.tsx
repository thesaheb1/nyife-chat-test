import type { FlowComponent } from '@/core/types';

export function FlowComponentPreview({ component }: { component: FlowComponent }) {
  if (component.type === 'TextHeading') {
    return <p className="text-base font-semibold">{component.text || 'Heading'}</p>;
  }
  if (component.type === 'TextSubheading') {
    return <p className="text-sm font-medium text-slate-700">{component.text || 'Subheading'}</p>;
  }
  if (component.type === 'TextBody') {
    return <p className="text-sm text-slate-600">{component.text || 'Body text'}</p>;
  }
  if (component.type === 'Image') {
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-xl bg-slate-100">
          {component.image_url ? (
            <img src={component.image_url} alt={component.caption || 'Flow image'} className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">Image placeholder</div>
          )}
        </div>
        {component.caption && <p className="text-xs text-muted-foreground">{component.caption}</p>}
      </div>
    );
  }
  if (component.type === 'Footer') {
    return (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Footer CTA</p>
        <div className="rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white">
          {component.label || 'Continue'}
        </div>
        <p className="text-xs text-muted-foreground">
          {component.action?.type === 'navigate'
            ? `Navigate to ${component.action.target_screen_id || 'another screen'}`
            : 'Complete flow'}
        </p>
      </div>
    );
  }
  if (component.type === 'Dropdown' || component.type === 'RadioButtonsGroup' || component.type === 'CheckboxGroup') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{component.label || 'Selection field'}</p>
        <div className="space-y-2">
          {(component.options || []).map((option) => (
            <div key={option.id} className="rounded-xl border px-3 py-2 text-sm text-slate-600">{option.title}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{component.label || component.text || component.type}</p>
      <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-500">
        {component.placeholder || component.helper_text || component.name || 'Input field'}
      </div>
    </div>
  );
}
