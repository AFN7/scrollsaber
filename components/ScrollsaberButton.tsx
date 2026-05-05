import { Swords } from 'lucide-react';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

// Inline critical styles so the button renders correctly on first paint —
// Tailwind CSS is injected into the shadow root asynchronously.
const BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '40px',
  padding: '0 14px',
  borderRadius: '9999px',
  border: '1px solid rgba(255, 59, 59, 0.4)',
  background: 'rgba(255, 59, 59, 0.1)',
  color: '#FF3B3B',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
  whiteSpace: 'nowrap',
};

export function ScrollsaberButton({
  onClick,
  disabled,
  label = 'Shorten with Scrollsaber',
  className,
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={BASE_STYLE}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 59, 59, 0.18)';
        e.currentTarget.style.borderColor = 'rgba(255, 59, 59, 0.65)';
        e.currentTarget.style.boxShadow = '0 0 14px rgba(255, 59, 59, 0.45)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 59, 59, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(255, 59, 59, 0.4)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <Swords width={16} height={16} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      <span>Scrollsaber</span>
    </button>
  );
}
