import type { ButtonHTMLAttributes } from 'react';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};
export function Button({ variant = 'primary', style, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        minHeight: 44,
        padding: '0 18px',
        borderRadius: 14,
        border: variant === 'primary' ? '1px solid transparent' : '1px solid #d9e1ec',
        color: variant === 'primary' ? '#fff' : '#10243f',
        background:
          variant === 'primary'
            ? 'linear-gradient(135deg,#3977ff,#2559e8)'
            : 'rgba(255,255,255,.78)',
        fontWeight: 800,
        cursor: 'pointer',
        ...style,
      }}
    />
  );
}
