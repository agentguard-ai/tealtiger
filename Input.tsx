import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  wrapperClassName?: string;
  labelClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  icon,
  iconPosition = 'left',
  className,
  wrapperClassName,
  labelClassName,
  id: externalId,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = externalId || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={clsx('w-full', wrapperClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className={clsx(
            'block text-sm font-medium text-slate-700 mb-1',
            labelClassName
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        {icon && iconPosition === 'right' && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          className={clsx(
            'w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-teal-600 focus:ring-teal-200',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
            icon && iconPosition === 'left' && 'pl-9',
            icon && iconPosition === 'right' && 'pr-9',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export { Input };