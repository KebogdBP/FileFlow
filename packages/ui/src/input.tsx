import type { InputHTMLAttributes, ReactNode } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  description?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({
  id,
  label,
  description,
  error,
  prefix,
  suffix,
  disabled,
  style,
  ...props
}: InputProps) {
  const descriptionId = description && id ? `${id}-description` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <label
      htmlFor={id}
      style={{ display: 'grid', gap: 'var(--ff-space-2)', color: 'var(--ff-color-text)' }}
    >
      {label ? <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span> : null}
      <span
        style={{
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--ff-space-2)',
          padding: '0 var(--ff-space-3)',
          border: `1px solid ${error ? 'var(--ff-color-danger)' : 'var(--ff-color-border)'}`,
          borderRadius: 'var(--ff-radius-sm)',
          background: disabled ? 'var(--ff-color-surface-raised)' : 'var(--ff-color-surface)',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        {prefix ? <span aria-hidden="true">{prefix}</span> : null}
        <input
          {...props}
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? descriptionId}
          style={{
            width: '100%',
            minWidth: 0,
            border: 0,
            outline: 0,
            color: 'var(--ff-color-text)',
            background: 'transparent',
            font: 'inherit',
            ...style,
          }}
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </span>
      {description ? (
        <span id={descriptionId} style={{ color: 'var(--ff-color-text-muted)', fontSize: 12 }}>
          {description}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" style={{ color: 'var(--ff-color-danger)', fontSize: 12 }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
