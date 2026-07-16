import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthButton } from '../../components/common/AuthButton';
import logoDepo from '../../assets/logo_deposito.png';

export function LandingPage() {
  const { user, userData, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user || !userData) return;

    // Owner sem loja criada → criar loja
    if (['owner', 'developer'].includes(userData.role) && !userData.storeId) {
      navigate('/criar-deposito');
      return;
    }

    // Se tem storeId (client, staff, manager, owner) → vai para a loja
    if (userData.storeId) {
      // Buscar slug da loja pelo storeId
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      fetch(`${API_BASE}/api/stores?id=${userData.storeId}`)
        .then(r => r.json())
        .then(json => {
          if (json.stores && json.stores.length > 0) {
            navigate(`/${json.stores[0].slug}`);
          }
        })
        .catch(() => {});
    }
  }, [user, userData, loading]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      gap: '2rem',
    }}>
      <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <img
          src={logoDepo}
          alt="Depósito Delivery"
          style={{ width: 100, height: 100, borderRadius: '50%', border: '3px solid var(--primary-gold)', boxShadow: '0 0 30px rgba(255,209,0,0.3)' }}
        />
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: 'var(--primary-gold)' }}>
          Depósito Delivery
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>
          A plataforma de vendas para depósitos de bebidas
        </p>
      </header>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
          Entrar na Plataforma
        </h2>
        <AuthButton />
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          Após entrar, você será redirecionado para o depósito no qual está cadastrado.
        </p>
      </div>

      <footer style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        © 2026 Depósito Delivery — Plataforma Multi-Tenant
      </footer>
    </div>
  );
}
