import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SlugChecker } from '../../components/SlugChecker';
import logoDepo from '../../assets/logo_deposito.png';
import { Store, Sun, Moon, ArrowRight, Upload } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface CreateStorePageProps {
  onStoreCreated: (slug: string) => void;
}

export function CreateStorePage({ onStoreCreated }: CreateStorePageProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState(false);
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [primaryColor, setPrimaryColor] = useState('#FFD100');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!user || !slug || !name || !slugAvailable) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          description,
          city,
          phone,
          logoUrl: logoPreview,
          theme,
          primaryColor,
          ownerUid: user.uid,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Erro ao criar loja.');
      onStoreCreated(json.store.slug);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,209,0,0.1)', border: '2px solid var(--primary-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={28} style={{ color: 'var(--primary-gold)' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Criar meu Depósito</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure o seu espaço na plataforma. Você poderá editar tudo depois.</p>
        </div>

        {/* Logo Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Logo do Depósito</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img
              src={logoPreview || logoDepo}
              alt="Logo Preview"
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-gold)' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1.25rem', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem', transition: 'border-color 0.2s' }}>
              <Upload size={16} />
              Escolher imagem
              <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Store Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Nome do Depósito</label>
          <input type="text" placeholder="Ex: Depósito do Fulano" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>

        {/* Slug Checker */}
        <SlugChecker value={slug} onChange={(val, avail) => { setSlug(val); setSlugAvailable(avail); }} />

        {/* Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Descrição <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(opcional)</span></label>
          <textarea placeholder="Bebidas geladas e destilados premium..." value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* City & Phone */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Cidade</label>
            <input type="text" placeholder="Campo Grande, RJ" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Telefone</label>
            <input type="text" placeholder="(21) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Theme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Tema do Site</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {(['dark', 'light'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTheme(t)} style={{
                flex: 1, padding: '0.75rem', borderRadius: '12px', border: `2px solid ${theme === t ? 'var(--primary-gold)' : 'rgba(255,255,255,0.1)'}`,
                background: theme === t ? 'rgba(255,209,0,0.08)' : 'transparent',
                color: theme === t ? 'var(--primary-gold)' : 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', transition: 'all 0.2s',
              }}>
                {t === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t === 'dark' ? 'Escuro' : 'Claro'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>Cor Principal</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ width: 52, height: 52, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '10px' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cor usada em botões, ícones e destaques do cardápio</span>
          </div>
        </div>

        {error && <p style={{ margin: 0, color: '#ef4444', fontSize: '0.88rem', textAlign: 'center' }}>⚠️ {error}</p>}

        <button
          type="button"
          onClick={handleCreate}
          disabled={!name || !slugAvailable || saving}
          style={{
            width: '100%', padding: '1rem', borderRadius: '12px', border: 'none',
            background: (!name || !slugAvailable || saving) ? '#2a2a2a' : 'var(--primary-gold)',
            color: (!name || !slugAvailable || saving) ? '#666' : '#121212',
            fontWeight: 700, fontSize: '1rem', cursor: (!name || !slugAvailable || saving) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Criando...' : <><ArrowRight size={18} /> Criar meu Depósito</>}
        </button>
      </div>
    </div>
  );
}
