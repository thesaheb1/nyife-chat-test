import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { FlowComponent, FlowDefinition, FlowScreen } from '@/core/types';
import { cn } from '@/lib/utils';

type PreviewValues = Record<string, unknown>;
type PreviewErrors = Record<string, string>;

export type FlowPreviewAppearance = 'default' | 'whatsapp';
export type FlowPreviewTheme = 'light' | 'dark';

function isEmptyValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return value === undefined || value === null || String(value).trim() === '';
}

function validateComponent(component: FlowComponent, values: PreviewValues) {
  const value = component.name ? values[component.name] : undefined;

  if (component.required && isEmptyValue(value)) {
    return `${component.label || component.name || 'This field'} is required.`;
  }

  if ((component.type === 'Dropdown' || component.type === 'RadioButtonsGroup') && component.required && isEmptyValue(value)) {
    return `${component.label || 'This selection'} is required.`;
  }

  if (component.type === 'CheckboxGroup') {
    const selected = Array.isArray(value) ? value : [];
    if (component.required && selected.length === 0) {
      return `${component.label || 'This selection'} is required.`;
    }
    if (component.min_selections !== undefined && selected.length < component.min_selections) {
      return `Select at least ${component.min_selections} option${component.min_selections === 1 ? '' : 's'}.`;
    }
    if (component.max_selections !== undefined && selected.length > component.max_selections) {
      return `Select no more than ${component.max_selections} option${component.max_selections === 1 ? '' : 's'}.`;
    }
  }

  if ((component.type === 'TextInput' || component.type === 'TextArea') && typeof value === 'string') {
    if (component.min_length !== undefined && value.length < component.min_length) {
      return `Enter at least ${component.min_length} characters.`;
    }
    if (component.max_length !== undefined && value.length > component.max_length) {
      return `Enter no more than ${component.max_length} characters.`;
    }
  }

  return null;
}

function collectScreenErrors(screen: FlowScreen, values: PreviewValues) {
  return screen.layout.children.reduce<PreviewErrors>((errors, component) => {
    if (!component.name && component.type !== 'CheckboxGroup') {
      return errors;
    }

    const error = validateComponent(component, values);
    if (error && component.name) {
      errors[component.name] = error;
    }
    return errors;
  }, {});
}

function deriveInitialValues(definition: FlowDefinition) {
  return definition.screens.reduce<PreviewValues>((values, screen) => {
    screen.layout.children.forEach((component) => {
      if (!component.name) {
        return;
      }

      if (component.default_value !== undefined) {
        values[component.name] = component.default_value;
        return;
      }

      if (component.type === 'CheckboxGroup') {
        values[component.name] = [];
      } else {
        values[component.name] = '';
      }
    });
    return values;
  }, {});
}

function getFieldInputClassName(
  appearance: FlowPreviewAppearance,
  theme: FlowPreviewTheme,
  showFieldError: boolean
) {
  if (appearance === 'whatsapp') {
    return cn(
      'w-full rounded-[14px] border px-3 py-3 text-[13px] outline-none transition',
      theme === 'dark'
        ? 'bg-[#0f1a20] text-[#e9edef] placeholder:text-[#7f8b93]'
        : 'bg-[#f7f8fa] text-[#111b21] placeholder:text-[#667781]',
      showFieldError
        ? 'border-[#e74c3c] ring-2 ring-[#f8d7d4]'
        : theme === 'dark'
          ? 'border-white/8 focus:border-[#25d366]'
          : 'border-black/10 focus:border-[#00a884]'
    );
  }

  return cn(
    'w-full rounded-2xl border bg-white px-3 py-3 text-sm outline-none transition',
    showFieldError ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 focus:border-emerald-500'
  );
}

export function FlowComponentPreview({
  component,
  interactive = false,
  values = {},
  errors = {},
  touched = {},
  disableActions = false,
  appearance = 'default',
  theme = 'light',
  onBlur,
  onAction,
  onValueChange,
}: {
  component: FlowComponent;
  interactive?: boolean;
  values?: PreviewValues;
  errors?: PreviewErrors;
  touched?: Record<string, boolean>;
  disableActions?: boolean;
  appearance?: FlowPreviewAppearance;
  theme?: FlowPreviewTheme;
  onBlur?: (name: string) => void;
  onAction?: (component: FlowComponent) => void;
  onValueChange?: (name: string, value: unknown) => void;
}) {
  const fieldError = component.name ? errors[component.name] : null;
  const showFieldError = component.name ? Boolean(fieldError && touched[component.name]) : false;
  const value = component.name ? values[component.name] : undefined;
  const isWhatsApp = appearance === 'whatsapp';
  const isDark = theme === 'dark';
  const labelClassName = cn(
    isWhatsApp ? 'text-[12px] font-semibold' : 'text-sm font-medium',
    isDark && isWhatsApp ? 'text-[#e9edef]' : isWhatsApp ? 'text-[#111b21]' : 'text-slate-800'
  );
  const helperClassName = cn(
    isWhatsApp ? 'text-[11px]' : 'text-xs',
    isDark && isWhatsApp ? 'text-[#aebac1]' : isWhatsApp ? 'text-[#667781]' : 'text-slate-500'
  );
  const errorClassName = cn(isWhatsApp ? 'text-[11px] text-[#e74c3c]' : 'text-xs text-rose-600');

  if (!interactive) {
    if (component.type === 'TextHeading') {
      return <p className={cn(isWhatsApp ? 'text-[16px] font-semibold' : 'text-base font-semibold', isDark && isWhatsApp ? 'text-[#e9edef]' : 'text-slate-900')}>{component.text || 'Heading'}</p>;
    }
    if (component.type === 'TextSubheading') {
      return <p className={cn(isWhatsApp ? 'text-[13px] font-medium' : 'text-sm font-medium', isDark && isWhatsApp ? 'text-[#d1d7db]' : 'text-slate-700')}>{component.text || 'Subheading'}</p>;
    }
    if (component.type === 'TextBody') {
      return <p className={cn(isWhatsApp ? 'text-[12px] leading-5' : 'text-sm', isDark && isWhatsApp ? 'text-[#aebac1]' : 'text-slate-600')}>{component.text || 'Body text'}</p>;
    }
    if (component.type === 'Image') {
      return (
        <div className="space-y-2">
          <div className={cn('overflow-hidden bg-slate-100', isWhatsApp ? 'rounded-[16px]' : 'rounded-xl')}>
            {component.image_url ? (
              <img src={component.image_url} alt={component.caption || 'Flow image'} className="h-32 w-full object-cover" />
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">Image placeholder</div>
            )}
          </div>
          {component.caption ? <p className={helperClassName}>{component.caption}</p> : null}
        </div>
      );
    }
    if (component.type === 'Footer') {
      return (
        <div className="space-y-2">
          <p className={helperClassName}>Footer CTA</p>
          <div className={cn('px-4 py-3 text-center font-medium text-white', isWhatsApp ? 'rounded-[14px] bg-[#00a884] text-[13px]' : 'rounded-xl bg-emerald-600 text-sm')}>
            {component.label || 'Continue'}
          </div>
          <p className={helperClassName}>
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
          <p className={labelClassName}>{component.label || 'Selection field'}</p>
          <div className="space-y-2">
            {(component.options || []).map((option) => (
              <div key={option.id} className={cn('border px-3 py-2', isWhatsApp ? 'rounded-[14px] border-black/10 text-[13px] text-[#54656f]' : 'rounded-xl text-sm text-slate-600')}>
                {option.title}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className={labelClassName}>{component.label || component.text || component.type}</p>
        <div className={cn('border px-3 py-2', isWhatsApp ? 'rounded-[14px] border-black/10 bg-[#f7f8fa] text-[13px] text-[#667781]' : 'rounded-xl bg-slate-50 text-sm text-slate-500')}>
          {component.placeholder || component.helper_text || component.name || 'Input field'}
        </div>
      </div>
    );
  }

  if (component.type === 'TextHeading') {
    return <p className={cn(isWhatsApp ? 'text-[16px] font-semibold' : 'text-base font-semibold', isDark && isWhatsApp ? 'text-[#e9edef]' : 'text-slate-900')}>{component.text || 'Heading'}</p>;
  }
  if (component.type === 'TextSubheading') {
    return <p className={cn(isWhatsApp ? 'text-[13px] font-medium' : 'text-sm font-medium', isDark && isWhatsApp ? 'text-[#d1d7db]' : 'text-slate-700')}>{component.text || 'Subheading'}</p>;
  }
  if (component.type === 'TextBody') {
    return <p className={cn(isWhatsApp ? 'text-[12px] leading-5' : 'text-sm leading-6', isDark && isWhatsApp ? 'text-[#aebac1]' : 'text-slate-600')}>{component.text || 'Body text'}</p>;
  }
  if (component.type === 'Image') {
    return (
      <div className="space-y-2">
        <div className={cn('overflow-hidden bg-slate-100', isWhatsApp ? 'rounded-[16px]' : 'rounded-2xl')}>
          {component.image_url ? (
            <img src={component.image_url} alt={component.caption || 'Flow image'} className="h-40 w-full object-cover" />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Image placeholder</div>
          )}
        </div>
        {component.caption ? <p className={helperClassName}>{component.caption}</p> : null}
      </div>
    );
  }
  if (component.type === 'TextInput' || component.type === 'TextArea' || component.type === 'DatePicker') {
    const inputProps = {
      value: typeof value === 'string' ? value : '',
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onValueChange?.(component.name || '', event.target.value);
      },
      onBlur: () => {
        if (component.name) {
          onBlur?.(component.name);
        }
      },
      placeholder: component.placeholder || component.helper_text || component.label,
      className: getFieldInputClassName(appearance, theme, showFieldError),
    };

    return (
      <div className="space-y-2">
        <p className={labelClassName}>
          {component.label}
          {component.required ? <span className="ml-1 text-[#e74c3c]">*</span> : null}
        </p>
        {component.type === 'TextArea' ? (
          <textarea rows={4} {...inputProps} />
        ) : (
          <input type={component.type === 'DatePicker' ? 'date' : 'text'} {...inputProps} />
        )}
        {component.helper_text ? <p className={helperClassName}>{component.helper_text}</p> : null}
        {showFieldError ? <p className={errorClassName}>{fieldError}</p> : null}
      </div>
    );
  }
  if (component.type === 'Dropdown') {
    return (
      <div className="space-y-2">
        <p className={labelClassName}>
          {component.label}
          {component.required ? <span className="ml-1 text-[#e74c3c]">*</span> : null}
        </p>
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onValueChange?.(component.name || '', event.target.value)}
          onBlur={() => component.name && onBlur?.(component.name)}
          className={getFieldInputClassName(appearance, theme, showFieldError)}
        >
          <option value="">Select an option</option>
          {(component.options || []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
        {showFieldError ? <p className={errorClassName}>{fieldError}</p> : null}
      </div>
    );
  }
  if (component.type === 'RadioButtonsGroup') {
    return (
      <div className="space-y-2">
        <p className={labelClassName}>
          {component.label}
          {component.required ? <span className="ml-1 text-[#e74c3c]">*</span> : null}
        </p>
        <div className="space-y-2">
          {(component.options || []).map((option) => (
            <label
              key={option.id}
              className={cn(
                'flex items-center gap-3 border px-3 py-3',
                isWhatsApp
                  ? cn(
                    'rounded-[14px] text-[13px]',
                    isDark ? 'border-white/8 bg-[#0f1a20] text-[#e9edef]' : 'border-black/10 bg-[#f7f8fa] text-[#111b21]'
                  )
                  : 'rounded-2xl border-slate-200 text-sm'
              )}
            >
              <input
                type="radio"
                name={component.name}
                checked={value === option.id}
                onChange={() => onValueChange?.(component.name || '', option.id)}
                onBlur={() => component.name && onBlur?.(component.name)}
              />
              <span>{option.title}</span>
            </label>
          ))}
        </div>
        {showFieldError ? <p className={errorClassName}>{fieldError}</p> : null}
      </div>
    );
  }
  if (component.type === 'CheckboxGroup') {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <p className={labelClassName}>
          {component.label}
          {component.required ? <span className="ml-1 text-[#e74c3c]">*</span> : null}
        </p>
        <div className="space-y-2">
          {(component.options || []).map((option) => {
            const checked = selectedValues.includes(option.id);
            return (
              <label
                key={option.id}
                className={cn(
                  'flex items-center gap-3 border px-3 py-3',
                  isWhatsApp
                    ? cn(
                      'rounded-[14px] text-[13px]',
                      isDark ? 'border-white/8 bg-[#0f1a20] text-[#e9edef]' : 'border-black/10 bg-[#f7f8fa] text-[#111b21]'
                    )
                    : 'rounded-2xl border-slate-200 text-sm'
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedValues, option.id]
                      : selectedValues.filter((entry) => entry !== option.id);
                    onValueChange?.(component.name || '', next);
                  }}
                  onBlur={() => component.name && onBlur?.(component.name)}
                />
                <span>{option.title}</span>
              </label>
            );
          })}
        </div>
        {showFieldError ? <p className={errorClassName}>{fieldError}</p> : null}
      </div>
    );
  }
  if (component.type === 'Footer') {
    return (
      <div className="space-y-2 pt-2">
        <button
          type="button"
          disabled={disableActions}
          onClick={() => onAction?.(component)}
          className={cn(
            'w-full px-4 py-3 text-center font-semibold text-white transition',
            isWhatsApp ? 'rounded-[14px] text-[13px]' : 'rounded-2xl text-sm',
            disableActions ? 'cursor-not-allowed bg-slate-300' : 'bg-[#00a884] hover:bg-[#01916f]'
          )}
        >
          {component.label || 'Continue'}
        </button>
        <p className={cn('text-center', helperClassName)}>
          {component.action?.type === 'navigate'
            ? `Navigates to ${component.action.target_screen_id || 'the next screen'}`
            : 'Completes the flow'}
        </p>
      </div>
    );
  }

  return null;
}

export function FlowJourneyPreview({
  definition,
  className,
  emptyMessage = 'Add a screen to preview the flow.',
  appearance = 'default',
  theme = 'light',
}: {
  definition: FlowDefinition;
  className?: string;
  emptyMessage?: string;
  appearance?: FlowPreviewAppearance;
  theme?: FlowPreviewTheme;
}) {
  const firstScreenId = definition.screens[0]?.id || '';
  const [currentScreenId, setCurrentScreenId] = useState(firstScreenId);
  const [values, setValues] = useState<PreviewValues>(() => deriveInitialValues(definition));
  const [errors, setErrors] = useState<PreviewErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const isWhatsApp = appearance === 'whatsapp';
  const isDark = theme === 'dark';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentScreenId(definition.screens[0]?.id || '');
    setValues(deriveInitialValues(definition));
    setErrors({});
    setTouched({});
    setCompleted(false);
  }, [definition]);

  const activeScreen = useMemo(
    () => definition.screens.find((screen) => screen.id === currentScreenId) || definition.screens[0] || null,
    [currentScreenId, definition.screens]
  );

  const liveErrors = useMemo(
    () => (activeScreen ? collectScreenErrors(activeScreen, values) : {}),
    [activeScreen, values]
  );

  const canContinue = Object.keys(liveErrors).length === 0;

  if (!activeScreen) {
    return (
      <div
        className={cn(
          'text-center',
          isWhatsApp
            ? cn(
              'rounded-[18px] border border-dashed px-4 py-8 text-[12px]',
              isDark ? 'border-white/10 text-[#aebac1]' : 'border-black/10 text-[#667781]'
            )
            : 'rounded-2xl border border-dashed p-8 text-sm text-muted-foreground',
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  if (completed) {
    return (
      <div className={cn('space-y-4', className)}>
        <div
          className={cn(
            isWhatsApp
              ? 'rounded-[18px] border px-4 py-4'
              : 'rounded-2xl p-5',
            isWhatsApp
              ? isDark
                ? 'border-[#184d3b] bg-[#10251d] text-[#d8fdd2]'
                : 'border-[#b8e7cb] bg-[#e7ffef] text-[#0b6e4f]'
              : 'bg-emerald-50 text-emerald-900'
          )}
        >
          <p className={cn(isWhatsApp ? 'text-[13px] font-semibold' : 'text-sm font-semibold')}>Flow complete</p>
          <p className={cn(isWhatsApp ? 'mt-1 text-[12px]' : 'mt-1 text-sm')}>
            The local preview completed successfully with the current field values.
          </p>
        </div>
        <div
          className={cn(
            isWhatsApp
              ? cn(
                'rounded-[18px] border p-4',
                isDark ? 'border-white/8 bg-[#111b21]' : 'border-black/8 bg-white'
              )
              : 'rounded-2xl border border-slate-200 bg-slate-50 p-4'
          )}
        >
          <p className={cn('mb-2 font-semibold uppercase tracking-wide', isWhatsApp ? (isDark ? 'text-[10px] text-[#aebac1]' : 'text-[10px] text-[#667781]') : 'text-xs text-slate-500')}>Preview payload</p>
          <pre className={cn('overflow-auto', isWhatsApp ? (isDark ? 'text-[11px] text-[#d1d7db]' : 'text-[11px] text-[#334155]') : 'text-xs text-slate-700')}>{JSON.stringify(values, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isWhatsApp ? 'space-y-3' : 'space-y-3', className)}>
      <div
        className={cn(
          isWhatsApp
            ? 'rounded-[18px] border p-4 shadow-sm'
            : 'rounded-2xl border border-slate-200 bg-white p-4',
          isWhatsApp
            ? isDark
              ? 'border-white/8 bg-[#111b21]'
              : 'border-black/8 bg-white'
            : ''
        )}
      >
        <div
          className={cn(
            isWhatsApp
              ? isDark
                ? 'rounded-[16px] bg-[#103529] px-4 py-3 text-white'
                : 'rounded-[16px] bg-[#dcf8c6] px-4 py-3 text-[#111b21]'
              : 'rounded-2xl bg-emerald-950 px-4 py-3 text-white'
          )}
        >
          <p className={cn(isWhatsApp ? 'text-[13px] font-semibold' : 'text-sm font-semibold')}>{activeScreen.title}</p>
          <p className={cn(isWhatsApp ? (isDark ? 'text-[10px] text-white/70' : 'text-[10px] text-[#54656f]') : 'text-xs text-emerald-100')}>{activeScreen.id}</p>
        </div>

        <div className={cn(isWhatsApp ? 'mt-4 space-y-3' : 'mt-3 space-y-3')}>
          {activeScreen.layout.children.map((component, index) => {
            const componentWrapperClassName = isWhatsApp && component.type !== 'Footer'
              ? cn(
                'rounded-[16px] border px-3 py-3',
                isDark ? 'border-white/8 bg-[#0f1a20]' : 'border-black/10 bg-[#fafafa]'
              )
              : component.type === 'Footer'
                ? ''
                : 'rounded-2xl border border-slate-200 bg-white p-4';

            return (
              <div key={`${activeScreen.id}-${index}-${component.type}`} className={componentWrapperClassName}>
                <FlowComponentPreview
                  component={component}
                  interactive
                  values={values}
                  errors={errors}
                  touched={touched}
                  appearance={appearance}
                  theme={theme}
                  disableActions={component.type === 'Footer' ? !canContinue : false}
                  onBlur={(name) => setTouched((current) => ({ ...current, [name]: true }))}
                  onValueChange={(name, nextValue) => {
                    setValues((current) => ({ ...current, [name]: nextValue }));
                    setErrors((current) => ({ ...current, [name]: '' }));
                  }}
                  onAction={(footer) => {
                    const nextErrors = collectScreenErrors(activeScreen, values);
                    if (Object.keys(nextErrors).length > 0) {
                      setTouched((current) => ({
                        ...current,
                        ...Object.keys(nextErrors).reduce<Record<string, boolean>>((draft, key) => {
                          draft[key] = true;
                          return draft;
                        }, {}),
                      }));
                      setErrors(nextErrors);
                      return;
                    }

                    setErrors({});
                    if (footer.action?.type === 'navigate' && footer.action.target_screen_id) {
                      setCurrentScreenId(footer.action.target_screen_id);
                      return;
                    }

                    setCompleted(true);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
