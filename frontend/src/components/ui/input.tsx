import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, id, disabled, autoCapitalize, autoCorrect, spellCheck, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const isPasswordField = type === 'password'
    const [isPasswordVisible, setIsPasswordVisible] = React.useState(false)

    React.useEffect(() => {
      if (!isPasswordField && isPasswordVisible) {
        setIsPasswordVisible(false)
      }
    }, [isPasswordField, isPasswordVisible])

    const resolvedType = isPasswordField
      ? (isPasswordVisible ? 'text' : 'password')
      : (type ?? 'text')

    const input = (
      <input
        ref={ref}
        id={inputId}
        type={resolvedType}
        data-slot="input"
        disabled={disabled}
        autoCapitalize={autoCapitalize ?? (isPasswordField ? 'none' : undefined)}
        autoCorrect={autoCorrect ?? (isPasswordField ? 'off' : undefined)}
        spellCheck={spellCheck ?? (isPasswordField ? false : undefined)}
        className={cn(
          'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
          isPasswordField && 'pr-10',
          className
        )}
        {...props}
      />
    )

    if (!isPasswordField) {
      return input
    }

    return (
      <div className="relative">
        {input}
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50"
          aria-controls={inputId}
          aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isPasswordVisible}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsPasswordVisible((current) => !current)}
        >
          {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
