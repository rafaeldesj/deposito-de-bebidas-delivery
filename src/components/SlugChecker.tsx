import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface SlugCheckerProps {
  value: string;
  onChange: (value: string, isAvailable: boolean) => void;
}

export function SlugChecker({ value, onChange }: SlugCheckerProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [normalized, setNormalized] = useState('');

  useEffect(() => {
    const norm = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setNormalized(norm);

    if (!norm || norm.length < 3) {
      setStatus(norm.length > 0 && norm.length < 3 ? 'invalid' : 'idle');
      onChange(norm, false);
      return;
    }

    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/stores/check-slug?slug=${norm}`);
        const json = await res.json();
        if (json.available) {
          setStatus('available');
          onChange(norm, true);
        } else {
          setStatus('taken');
          onChange(norm, false);
        }
      } catch {
        setStatus('idle');
        onChange(norm, false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value]);

  const getStatusUI = () => {
    switch (status) {
      case 'checking': return { icon: '⏳', color: '#94a3b8', text: 'Verificando...' };
      case 'available': return { icon: '✅', color: '#22c55e', text: `"${normalized}" está disponível!` };
      case 'taken': return { icon: '❌', color: '#ef4444', text: `"${normalized}" já está em uso.` };
      case 'invalid': return { icon: '⚠️', color: '#f59e0b', text: 'Mínimo de 3 caracteres (apenas letras, números e hífens).' };
      default: return null;
    }
  };

  const ui = getStatusUI();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
        URL do seu Depósito
      </label>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', overflow: 'hidden' }}>
        <span style={{ padding: '0.75rem 0.75rem 0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          /
        </span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value, false)}
          placeholder="meu-deposito"
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        />
      </div>
      {ui && (
        <p style={{ margin: 0, fontSize: '0.83rem', color: ui.color, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {ui.icon} {ui.text}
        </p>
      )}
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        Apenas letras minúsculas, números e hífens. Este será o endereço do seu depósito:
        <strong style={{ color: 'var(--text-primary)' }}> depositodelivery.web.app/{normalized || 'seu-deposito'}</strong>
      </p>
    </div>
  );
}
