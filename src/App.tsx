import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import type { OrderItem } from './types/order';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider, useLocation } from './context/LocationContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { AuthButton } from './components/common/AuthButton';
import { DeliveryMap } from './components/DeliveryMap';
import type { MapAddress } from './components/DeliveryMap';
import { LandingPage } from './pages/platform/LandingPage';
import { CreateStorePage } from './pages/platform/CreateStorePage';
import { ShieldCheck, ChefHat, CreditCard, Bell, ShoppingCart, Heart, FileText, Users, Navigation, CheckCircle, Clock, Map, Settings, Menu, ChevronDown, Grid } from 'lucide-react';
import logoDepo from './assets/logo_deposito.png';
import { supabase } from './config/supabase';

// Lazy-loaded components for code-splitting performance
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const AdminDashboard = lazy(() => import('./pages/manager/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/manager/UserManagement'));
const DeliveryActive = lazy(() => import('./pages/delivery/DeliveryActive'));
const DeliveryHistory = lazy(() => import('./pages/delivery/DeliveryHistory'));
const ManagerDeliveryActive = lazy(() => import('./pages/manager/ManagerDeliveryActive'));
const OrderTracking = lazy(() => import('./pages/client/OrderTracking'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TableMap = lazy(() => import('./pages/staff/TableMap'));

// Premium feedback state for lazy loading
const ViewLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1.25rem', padding: '2rem' }} className="animate-fade-in">
    <div className="spinner" style={{ width: '42px', height: '42px', borderWidth: '3.5px', borderColor: 'rgba(255, 209, 0, 0.1)', borderTopColor: 'var(--primary-gold)' }} />
    <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.02em' }}>Carregando painel...</span>
  </div>
);

const MainLayout = () => {
  const { user, userData, logout } = useAuth();
  const { address, setAddress } = useLocation();
  const [tempAddress, setTempAddress] = useState<MapAddress | null>(null);
  
  const [activeView, setActiveView] = useState<string>('menu');
  const [isVisitor, setIsVisitor] = useState<boolean>(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Real-time store configurations and status
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [storeStatus, setStoreStatus] = useState<{ status: 'open' | 'closing_soon' | 'closed'; label: string }>({ status: 'closed', label: 'Fechado' });

  // Listen to store configurations from Supabase in real-time
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'store_config')
          .maybeSingle();

        if (data && data.value) {
          setStoreConfig(data.value);
        }
      } catch (err) {
        console.error("Erro ao carregar store_config no MainLayout:", err);
      }
    };
    
    fetchConfig();

    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.store_config' }, (payload) => {
        if (payload.new && (payload.new as any).value) {
          setStoreConfig((payload.new as any).value);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Recalculate status every 30 seconds
  useEffect(() => {
    const checkStatus = () => {
      if (!storeConfig) {
        setStoreStatus({ status: 'closed', label: 'Fechado' });
        return;
      }
      if (storeConfig.isOpen === false) {
        setStoreStatus({ status: 'closed', label: 'Fechado' });
        return;
      }

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      const [openH, openM] = (storeConfig.openingTime || '18:00').split(':').map(Number);
      const [closeH, closeM] = (storeConfig.closingTime || '23:30').split(':').map(Number);

      const openTimeInMinutes = openH * 60 + openM;
      let closeTimeInMinutes = closeH * 60 + closeM;

      // Handle next day closing time
      const closesNextDay = closeTimeInMinutes < openTimeInMinutes;

      let isOpen = false;
      let minutesToClose = 9999;

      if (closesNextDay) {
        if (currentTimeInMinutes >= openTimeInMinutes) {
          isOpen = true;
          minutesToClose = (24 * 60 - currentTimeInMinutes) + closeTimeInMinutes;
        } else if (currentTimeInMinutes < closeTimeInMinutes) {
          isOpen = true;
          minutesToClose = closeTimeInMinutes - currentTimeInMinutes;
        }
      } else {
        if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
          isOpen = true;
          minutesToClose = closeTimeInMinutes - currentTimeInMinutes;
        }
      }

      if (!isOpen) {
        setStoreStatus({ status: 'closed', label: 'Fechado' });
      } else if (minutesToClose <= 30) {
        setStoreStatus({ status: 'closing_soon', label: 'Fecharemos em breve' });
      } else {
        setStoreStatus({ status: 'open', label: 'Em funcionamento' });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [storeConfig, userData]);

  const handleCartClick = () => {
    setActiveView('menu');
    setTimeout(() => {
      const element = document.getElementById('cart-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  const role = userData?.role || 'client';
  const staff = userData?.staffFunctions;

  // Atualiza a visualização inicial ativa baseando-se no papel
  useEffect(() => {
    if (user && userData) {
      if (userData.role === 'staff') {
        if (userData.staffFunctions?.cook) setActiveView('cozinha');
        else if (userData.staffFunctions?.attendant) setActiveView('atendimento');
        else if (userData.staffFunctions?.cashier) setActiveView('caixa');
        else if (userData.staffFunctions?.delivery) setActiveView('entrega_andamento');
      } else if (['manager', 'owner', 'developer'].includes(userData.role)) {
        setActiveView('admin');
      } else {
        setActiveView('menu');
      }
    }
  }, [user, userData]);

  const isProfileIncomplete = !!user && (!userData || !userData.phoneNumber);

  // 1. Tela de Login se não logado e não visitante
  if ((!user || isProfileIncomplete) && !isVisitor) {
    return (
      <div className="login-page-layout">
        <header className="app-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <img 
            src={logoDepo} 
            alt="Depósito de Bebidas Delivery" 
            decoding="async" 
            className="logo-desktop"
            style={{ width: '100px', height: '100px', borderRadius: '50%', border: '2px solid var(--primary-gold)', boxShadow: '0 4px 15px rgba(255, 209, 0, 0.4)' }} 
          />
          <img 
            src={logoDepo} 
            alt="Depósito de Bebidas Delivery" 
            decoding="async" 
            className="logo-mobile"
            style={{ width: '120px', height: '120px', borderRadius: '50%', border: '2px solid var(--primary-gold)', boxShadow: '0 4px 15px rgba(255, 209, 0, 0.4)' }} 
          />
          <h1 className="logo-title" style={{ marginTop: '0.5rem', marginBottom: 0, color: 'var(--primary-gold)' }}>Depósito de Bebidas Delivery</h1>
          <p className="subtitle" style={{ margin: 0, color: '#e5e7eb' }}>Bebidas estupidamente geladas entregues na sua porta!</p>
        </header>
        <div className="login-card-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <AuthButton />
          <button 
            type="button" 
            onClick={() => setIsVisitor(true)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--primary-gold)', 
              cursor: 'pointer', 
              fontSize: '0.95rem', 
              textDecoration: 'underline',
              fontWeight: 600,
              padding: '0.5rem',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary-gold)'}
          >
            Entrar como Visitante (Apenas Visualizar Cardápio)
          </button>
        </div>
        <footer className="app-footer">
          <p style={{ margin: 0 }}>📍 © 2026 Depósito de Bebidas Delivery • Campo Grande, Rio de Janeiro</p>
        </footer>
      </div>
    );
  }

  // 2. Tela de Geolocalização Obrigatória se for cliente e não tiver selecionado endereço
  if (!address && role === 'client') {
    return (
      <div className="login-page-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
        <div style={{ maxWidth: '640px', width: '100%', padding: '2rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade-in">
          <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <img 
              src={logoDepo} 
              alt="Logo" 
              style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--primary-gold)', boxShadow: '0 4px 12px rgba(255, 209, 0, 0.3)' }} 
            />
            <h2 style={{ margin: '0.5rem 0 0.25rem 0', color: 'var(--primary-gold)', fontSize: '1.6rem', fontWeight: 800 }}>Onde você quer receber seu pedido?</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Insira seu endereço abaixo para ver o cardápio e os estoques da sua região.</p>
          </header>

          <DeliveryMap 
            onAddressSelect={(addr) => {
              setTempAddress(addr);
            }} 
          />

          {tempAddress && tempAddress.street && (
            <button
              type="button"
              onClick={() => setAddress(tempAddress)}
              style={{
                width: '100%',
                padding: '1rem',
                background: 'var(--primary-gold)',
                color: '#121212',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '1.05rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s, transform 0.1s',
                boxShadow: '0 4px 14px rgba(255, 209, 0, 0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E6BC00'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-gold)'}
            >
              Confirmar Endereço e Ver Bebidas ➔
            </button>
          )}

          {user && (
            <button 
              type="button" 
              onClick={logout} 
              style={{ background: 'none', border: 'none', color: '#f87171', textDecoration: 'underline', fontSize: '0.85rem', cursor: 'pointer', alignSelf: 'center' }}
            >
              Sair da conta
            </button>
          )}
        </div>
      </div>
    );
  }

  // Lista dinâmica de botões de navegação conforme o nível de privilégio do usuário
  const menuItems: any[] = [];
  const isOnlyDelivery = role === 'staff' && staff?.delivery;

  if (isOnlyDelivery) {
    menuItems.push({ id: 'entrega_andamento', label: 'Entrega em Andamento', icon: Navigation });
    menuItems.push({ id: 'entrega_finalizada', label: 'Entregas Finalizadas', icon: CheckCircle });
  } else {
    if (['client', 'developer', 'owner', 'manager'].includes(role)) {
      menuItems.push({ id: 'menu', label: 'Produtos', icon: ShoppingCart });
    }

    if (role === 'client' && user) {
      menuItems.push({ id: 'tracking', label: 'Meus Pedidos', icon: Clock });
    }

    if (['client', 'developer'].includes(role) && user) {
      menuItems.push({ id: 'fidelidade', label: 'Fidelidade', icon: Heart });
    }

    if (role === 'developer' || role === 'owner' || role === 'manager' || (role === 'staff' && staff?.cook)) {
      menuItems.push({ id: 'cozinha', label: 'Fila Cozinha', icon: ChefHat });
    }

    if (role === 'developer' || role === 'owner' || role === 'manager' || (role === 'staff' && staff?.attendant)) {
      menuItems.push({ id: 'atendimento', label: 'Balcão de Entrega', icon: Bell });
    }

    if (role === 'developer' || role === 'owner' || role === 'manager' || (role === 'staff' && staff?.cashier)) {
      menuItems.push({ id: 'caixa', label: 'Fila Caixa', icon: CreditCard });
    }

    if (role === 'developer' || role === 'owner' || role === 'manager' || (role === 'staff' && staff?.delivery)) {
      menuItems.push({ id: 'entrega_andamento', label: 'Entrega em Andamento', icon: Navigation });
      menuItems.push({ id: 'entrega_finalizada', label: 'Entregas Finalizadas', icon: CheckCircle });
    }

    if (['developer', 'owner', 'manager'].includes(role)) {
      menuItems.push({ id: 'admin', label: 'Painel Admin', icon: FileText });
    }

    if (['developer', 'owner', 'manager'].includes(role)) {
      menuItems.push({ id: 'mapa_mesas', label: 'Mapa de Mesas', icon: Grid });
    }

    if (['developer', 'owner', 'manager'].includes(role)) {
      menuItems.push({ id: 'users', label: 'Usuários', icon: Users });
    }

    if (role === 'developer') {
      menuItems.push({ id: 'teste_mapa', label: 'Localização Entregadores', icon: Map });
    }

    if (user) {
      menuItems.push({ id: 'configuracoes', label: 'Configurações', icon: Settings });
    }
  }

  const menuGroups = [
    { label: 'Cliente', ids: ['menu', 'tracking', 'fidelidade'] },
    { label: 'Operações de Entrega', ids: ['entrega_andamento', 'entrega_finalizada'] },
    { label: 'Operações Internas', ids: ['cozinha', 'atendimento', 'caixa', 'mapa_mesas', 'admin', 'teste_mapa'] },
    { label: 'Configurações', ids: ['users', 'configuracoes'] },
  ];

  const getRoleLabel = (r: string): React.ReactNode => {
    switch (r) {
      case 'developer': return 'Dev';
      case 'owner': return 'Proprietário';
      case 'manager': return 'Gerente';
      case 'staff': {
        const subroles: string[] = [];
        if (userData?.staffFunctions?.cook) subroles.push('Cozinha');
        if (userData?.staffFunctions?.attendant) subroles.push('Balcão');
        if (userData?.staffFunctions?.cashier) subroles.push('Caixa');
        if (userData?.staffFunctions?.delivery) subroles.push('Entrega');
        return subroles.length > 0 ? `Colaborador [${subroles.join(', ')}]` : 'Colaborador';
      }
      case 'client':
      default:
        return 'Cliente';
    }
  };

  return (
    <div className="main-grid-layout">
      {/* 1. Header (Topo) */}
      <header className="site-header">
        <div className="header-brand">
          <img src={logoDepo} alt="Logo" decoding="async" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--primary-gold)' }} />
          <span className="brand-text" style={{ background: 'none', WebkitTextFillColor: 'initial', color: 'var(--primary-gold)', fontWeight: 800 }}>Depósito de Bebidas</span>
          <div className={`store-status-container status-${storeStatus.status}`} title={storeStatus.label}>
            <span className={`status-dot status-${storeStatus.status}`}></span>
            <span className="store-status-text">{storeStatus.label}</span>
          </div>
          {address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#e5e7eb', background: 'rgba(255,259,0,0.06)', border: '1px solid rgba(255,209,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '12px', marginLeft: '0.5rem' }}>
              <Navigation size={12} style={{ color: 'var(--primary-gold)' }} />
              <span>Receber em: <strong>{address.street}, {address.number}</strong></span>
              <button 
                type="button" 
                onClick={() => setAddress(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--primary-gold)', textDecoration: 'underline', fontSize: '0.75rem', cursor: 'pointer', marginLeft: '4px', padding: 0 }}
              >
                Alterar
              </button>
            </div>
          )}
        </div>
        <div className="header-user-status">
          {['client', 'developer', 'owner', 'manager'].includes(role) && (
            <button 
              onClick={handleCartClick} 
              className={`header-cart-btn ${cart.length > 0 ? 'has-items' : ''}`}
              title="Ir para o Carrinho"
            >
              <ShoppingCart size={18} />
              {cart.length > 0 && (
                <span className="cart-count-badge" style={{ backgroundColor: '#121212', color: 'var(--primary-gold)', border: '1px solid var(--primary-gold)' }}>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          )}
          <div className="header-user-info-stack">
            <span className="welcome-msg">Olá, <strong>{user ? (user.displayName?.split(' ')[0] || user.email?.split('@')[0]) : 'Visitante'}</strong></span>
            {userData?.role && (
              <span className="role-badge">
                <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                {getRoleLabel(userData.role)}
              </span>
            )}
          </div>
          {user ? (
            <button onClick={logout} className="logout-action-btn">Sair</button>
          ) : (
            <button onClick={() => setIsVisitor(false)} className="logout-action-btn" style={{ background: 'var(--primary-gold)', color: '#0b0f19', fontWeight: 600 }}>Entrar</button>
          )}
        </div>
      </header>

      {/* Seção Central */}
      <div className="middle-content-area">
        {/* 2. Left Navigation (Navegação Esquerda) */}
        <aside className="left-navigation-sidebar">
          <button 
            type="button" 
            className="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Menu size={16} />
              <span>Navegação / Menu</span>
            </div>
            <ChevronDown 
              size={16} 
              style={{ 
                transform: mobileMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease-in-out'
              }} 
            />
          </button>

          <div className={`sidebar-collapsible-wrapper ${mobileMenuOpen ? 'open' : ''}`}>
            {menuGroups.map((group) => {
              const groupItems = menuItems.filter((item) => group.ids.includes(item.id));
              if (groupItems.length === 0) return null;
              return (
                <div key={group.label} className="sidebar-group-container">
                  <div className="menu-group-label">{group.label}</div>
                  <nav className="sidebar-nav-menu">
                    {groupItems.map((item) => {
                      const IconComponent = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`nav-menu-item ${activeView === item.id ? 'active' : ''}`}
                          onClick={() => {
                            setActiveView(item.id);
                            setMobileMenuOpen(false);
                          }}
                        >
                          <IconComponent size={18} className="nav-icon" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
          </div>
        </aside>

        {/* 3. Content (Área de Conteúdo Direita) */}
        <main className="content-area-main">
          <Suspense fallback={<ViewLoader />}>
            {activeView === 'menu' && <ClientDashboard showOnly="menu" isVisitor={isVisitor} onLoginRequired={() => setIsVisitor(false)} onNavigate={setActiveView} cart={cart} setCart={setCart} storeStatus={storeStatus} />}
            {activeView === 'tracking' && <OrderTracking />}
            {activeView === 'fidelidade' && <ClientDashboard showOnly="loyalty" isVisitor={isVisitor} onLoginRequired={() => setIsVisitor(false)} onNavigate={setActiveView} cart={cart} setCart={setCart} storeStatus={storeStatus} />}
            {activeView === 'cozinha' && <StaffDashboard filter="cook" />}
            {activeView === 'atendimento' && <StaffDashboard filter="attendant" />}
            {activeView === 'caixa' && <StaffDashboard filter="cashier" />}
            {activeView === 'entrega_andamento' && (
              ['developer', 'owner', 'manager'].includes(role) ? (
                <ManagerDeliveryActive />
              ) : (
                <DeliveryActive />
              )
            )}
            {activeView === 'entrega_finalizada' && <DeliveryHistory />}
            {activeView === 'admin' && <AdminDashboard />}
            {activeView === 'users' && <UserManagement />}
            {activeView === 'configuracoes' && <SettingsPage />}
            {activeView === 'mapa_mesas' && <TableMap />}
            {activeView === 'teste_mapa' && (
              <div style={{ maxWidth: '680px', margin: '0 auto' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>🗺️ Localização dos Entregadores</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Valide aqui a busca de endereço e a geolocalização antes de integrar ao pedido.</p>
                </div>
                <DeliveryMap onAddressSelect={(addr) => console.log('Endereço selecionado:', addr)} />
              </div>
            )}
          </Suspense>
          
          <footer className="mobile-only-footer">
            <p>📍 © 2026 Depósito de Bebidas Delivery • Campo Grande, RJ</p>
          </footer>
        </main>
      </div>

      {/* 4. Footer (Rodapé) */}
      <footer className="site-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}>📍 © 2026 Depósito de Bebidas Delivery • Campo Grande, RJ</p>
      </footer>
    </div>
  );
};

// Store-scoped layout wrapper that reads :slug from the URL
function StoreLayout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  return (
    <StoreProvider slug={slug || ''}>
      <StoreLayoutInner onStoreCreated={(s) => navigate(`/${s}`)} />
    </StoreProvider>
  );
}

function StoreLayoutInner({ onStoreCreated }: { onStoreCreated: (s: string) => void }) {
  const { loading, notFound } = useStore();
  const { user, userData } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
        <span style={{ color: 'var(--text-secondary)' }}>Carregando depósito...</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ color: 'var(--primary-gold)', margin: 0 }}>🍺 Depósito não encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Este endereço não corresponde a nenhum depósito cadastrado.</p>
        <a href="/" style={{ color: 'var(--primary-gold)', textDecoration: 'underline' }}>Voltar à página inicial</a>
      </div>
    );
  }

  // Owner sem loja → criar
  if (user && userData && ['owner', 'developer'].includes(userData.role) && !userData.storeId) {
    return <CreateStorePage onStoreCreated={onStoreCreated} />;
  }

  return (
    <LocationProvider>
      <MainLayout />
    </LocationProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/criar-deposito" element={
          <AuthProvider>
            <CreateStorePage onStoreCreated={(slug) => window.location.href = `/${slug}`} />
          </AuthProvider>
        } />
        <Route path="/:slug" element={<StoreLayout />} />
        <Route path="/:slug/*" element={<StoreLayout />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
