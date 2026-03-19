import { type Control, type FieldValues, type Path, useWatch } from 'react-hook-form'

type RequiredFieldConfig<TFormValues extends FieldValues> =
  | Path<TFormValues>
  | {
      name: Path<TFormValues>
      isFilled?: (value: unknown, values: Partial<TFormValues>) => boolean
    }

function getValueAtPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment]
    }

    return undefined
  }, source)
}

export function hasFilledValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime())
  }

  return value !== null && value !== undefined
}

export function useRequiredFieldsFilled<TFormValues extends FieldValues>(
  control: Control<TFormValues>,
  requiredFields: Array<RequiredFieldConfig<TFormValues>>
) {
  const values = (useWatch({ control }) ?? {}) as Partial<TFormValues>

  return requiredFields.every((field) => {
    const config = typeof field === 'string' ? { name: field } : field
    const value = getValueAtPath(values, String(config.name))

    return config.isFilled ? config.isFilled(value, values) : hasFilledValue(value)
  })
}
