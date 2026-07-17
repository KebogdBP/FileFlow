import type { InputHTMLAttributes } from 'react';

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  valueLabel?: string;
};

export function Slider({
  id,
  label,
  valueLabel,
  min = 0,
  max = 100,
  value,
  defaultValue,
  ...props
}: SliderProps) {
  return (
    <label
      htmlFor={id}
      style={{ display: 'grid', gap: 'var(--ff-space-2)', color: 'var(--ff-color-text)' }}
    >
      {label ? (
        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--ff-space-3)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span>{label}</span>
          {valueLabel ? (
            <span style={{ color: 'var(--ff-color-text-muted)' }}>{valueLabel}</span>
          ) : null}
        </span>
      ) : null}
      <input
        {...props}
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        defaultValue={defaultValue}
        style={{ width: '100%', accentColor: 'var(--ff-color-primary)' }}
      />
    </label>
  );
}
