import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../context/LocationContext';
import { supabase } from '../../config/supabase';
import { PromotionalBanners } from '../../components/PromotionalBanners';
import { ShoppingCart, Plus, Minus, Trash2, Edit2, Check, X, ReceiptText } from 'lucide-react';
import type { OrderItem } from '../../types/order';

interface ClientDashboardProps {
  showOnly?: 'menu' | 'loyalty';
  isVisitor?: boolean;
  onLoginRequired?: () => void;
  onNavigate?: (view: string) => void;
  cart?: OrderItem[];
  setCart?: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  storeStatus?: { status: 'open' | 'closing_soon' | 'closed'; label: string };
}

export const ClientDashboard = ({
  isVisitor = false,
  onLoginRequired,
  onNavigate,
  cart = [],
  setCart = () => {},
  storeStatus
}: ClientDashboardProps) => {
  const { user, userData } = useAuth();
  const { address } = useLocation();
  const role = userData?.role || 'client';

  // Local state
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [storeConfig, setStoreConfig] = useState<any>(null);

  // Discount & Coupon State
  const [couponInput, setCouponInput] = useState<string>('');
  const [activeCoupon, setActiveCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Checkout State
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credito' | 'dinheiro' | 'debito' | 'google_pay'>('pix');
  const clientCpf = userData?.cpf || '';
  const saveCardConsent = false;
  const [cardNumber, setCardNumber] = useState<string>('');
  const [expMonth, setExpMonth] = useState<string>('');
  const [expYear, setExpYear] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const orderType = 'delivery';

  // Modals & Flows
  const [showOrderSummary, setShowOrderSummary] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [orderPlaced, setOrderPlaced] = useState<boolean>(false);
  const [showPixLightbox, setShowPixLightbox] = useState<boolean>(false);
  const [pixQrCode, setPixQrCode] = useState<string>('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Admin / Editing states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editImage, setEditImage] = useState<string>('');
  const [isNewItem, setIsNewItem] = useState<number | null>(null);

  const canEdit = ['owner', 'manager', 'developer'].includes(userData?.role || '');
  const isStoreClosed = storeStatus?.status === 'closed';
  const isClosedForUser = isStoreClosed && !canEdit;

  // Load store configurations on mount
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
        console.error("Erro ao carregar store_config no ClientDashboard:", err);
      }
    };
    fetchConfig();
  }, []);

  // Load Categories & Products on mount / category changes
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('name')
          .order('sort_order', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          const catList = data.map(c => c.name);
          setCategories(catList);
          if (!activeCategory || !catList.includes(activeCategory)) {
            setActiveCategory(catList[0]);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar categorias do Supabase:", err);
      }
    };

    loadCategories();
  }, [activeCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, inventory_regions(*)');
      
      if (error) throw error;

      if (data && data.length > 0) {
        setProducts(data);
      } else {
        // Se estiver totalmente vazio, semeamos alguns produtos no Supabase
        console.log("Banco de dados vazio. Semeando produtos iniciais no Supabase...");
        await seedDefaultProducts();
      }
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    // Inscrição em tempo real para atualizações do estoque/produtos
    const channel = supabase
      .channel('public:products_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadProducts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_regions' }, loadProducts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const seedDefaultProducts = async () => {
    try {
      // 1. Garante categorias válidas
      const sampleCategories = ['Cervejas', 'Destilados', 'Petiscos', 'Gelo e Carvão', 'Refrigerantes e Águas'];
      for (let i = 0; i < sampleCategories.length; i++) {
        await supabase.from('categories').upsert({ name: sampleCategories[i], sort_order: i + 1 });
      }

      // 2. Insere produtos iniciais
      const itemsToSeed = [
        { name: 'Cerveja Brahma Duplo Malte Lata 350ml', price: 4.50, description: 'Cerveja Puro Malte Brahma, lata gelada.', category: 'Cervejas' },
        { name: 'Cerveja Corona Extra Garrafa 330ml', price: 7.90, description: 'Cerveja premium Corona gelada, com limão.', category: 'Cervejas' },
        { name: 'Combo Gin Tanqueray + 4 Tônicas Antárctica', price: 139.90, description: 'Tanqueray London Dry Gin 750ml e tônicas.', category: 'Destilados' },
        { name: 'Vodka Smirnoff 998ml', price: 39.90, description: 'Vodka destilada clássica Smirnoff.', category: 'Destilados' },
        { name: 'Batata Pringles Creme e Cebola 114g', price: 11.50, description: 'Batata Pringles clássica.', category: 'Petiscos' },
        { name: 'Amendoim Japonês Pettiz Dori 120g', price: 5.20, description: 'Amendoim crocante Pettiz.', category: 'Petiscos' },
        { name: 'Saco de Gelo Cubo Cristal 5kg', price: 12.00, description: 'Gelo em cubo de água mineral.', category: 'Gelo e Carvão' },
        { name: 'Carvão Vegetal Ipanema 3kg', price: 16.50, description: 'Carvão de acendimento rápido para churrasco.', category: 'Gelo e Carvão' },
        { name: 'Refrigerante Coca-Cola Lata 350ml', price: 5.50, description: 'Lata trincando de gelada.', category: 'Refrigerantes e Águas' },
        { name: 'Água Mineral Crystal Sem Gás 500ml', price: 3.00, description: 'Água mineral cristalina gelada.', category: 'Refrigerantes e Águas' }
      ];

      const { data: inserted, error: insertErr } = await supabase
        .from('products')
        .insert(itemsToSeed)
        .select();

      if (insertErr) throw insertErr;

      // 3. Cadastra estoques genéricos para Campo Grande
      if (inserted && inserted.length > 0) {
        const stockEntries = inserted.map(prod => ({
          product_id: prod.id,
          neighborhood: 'Campo Grande',
          stock_qty: 15,
          available: true
        }));
        await supabase.from('inventory_regions').insert(stockEntries);
      }
      loadProducts();
    } catch (err) {
      console.error("Erro ao semear banco:", err);
    }
  };

  // Helper para ícones de categorias
  const getCategoryEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('cerveja')) return '🍺';
    if (n.includes('destilado')) return '🥃';
    if (n.includes('petisco')) return '🍢';
    if (n.includes('gelo') || n.includes('carvão') || n.includes('carvao')) return '🧊';
    if (n.includes('refri') || n.includes('suco') || n.includes('água') || n.includes('agua') || n.includes('bebida')) return '🥤';
    return '📦';
  };

  // Geolocation inventory filtering
  const filteredProducts = products.filter((p: any) => {
    const matchCategory = (p.category || '').toLowerCase() === activeCategory.toLowerCase();
    if (!matchCategory) return false;

    // Se for cliente, filtra pelo estoque no bairro dele
    if (role === 'client' && address) {
      const regionData = p.inventory_regions?.find((r: any) =>
        r.neighborhood.toLowerCase().trim() === address.neighborhood.toLowerCase().trim()
      );
      if (regionData) {
        return regionData.available && regionData.stock_qty > 0;
      }
      return false; // Fora de estoque se não mapeado
    }
    return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  // Delivery Fee mock calculation
  const deliveryFee = orderType === 'delivery' ? 5.90 : 0;
  const finalTotal = Math.max(0, cartTotal + deliveryFee - (activeCoupon ? calculateDiscount() : 0));

  function calculateDiscount() {
    if (!activeCoupon) return 0;
    if (cartTotal < activeCoupon.minimum_order) return 0;
    if (activeCoupon.type === 'percentage') {
      return cartTotal * (activeCoupon.value / 100);
    }
    return activeCoupon.value;
  }

  // Cart operations
  const addToCart = (prod: any) => {
    if (isVisitor) {
      onLoginRequired?.();
      return;
    }
    setCart((prev) => {
      const existing = prev.find(item => item.id === prod.id);
      if (existing) {
        return prev.map(item => item.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: prod.id, name: prod.name, price: prod.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
        .filter(item => item.quantity > 0)
    );
  };

  const applyCoupon = async () => {
    setCouponError(null);
    if (!couponInput.trim()) return;
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponInput.trim().toUpperCase())
        .eq('active', true)
        .maybeSingle();

      if (error || !data) {
        setCouponError('Cupom inválido ou expirado.');
        setActiveCoupon(null);
        return;
      }

      if (cartTotal < Number(data.minimum_order)) {
        setCouponError(`Compra mínima para este cupom é de R$ ${Number(data.minimum_order).toFixed(2)}`);
        setActiveCoupon(null);
        return;
      }

      setActiveCoupon(data);
    } catch {
      setCouponError('Erro ao validar cupom.');
    }
  };

  // Checkout submission
  const handlePlaceOrder = async () => {
    setError(null);
    if (isClosedForUser) {
      setError('O depósito está fechado no momento.');
      return;
    }
    setSubmitting(true);

    try {
      // Build checkout payload
      const payload = {
        items: cart.map(item => ({ id: item.id, quantity: item.quantity })),
        paymentMethod,
        deliveryAddress: address,
        orderType: 'delivery',
        couponCode: activeCoupon?.code,
        clientCpf,
        saveCardConsent,
        encryptedCard: paymentMethod === 'credito' ? (cardNumber ? 'valid_card' : 'invalid_card') : undefined,
        clientName: user?.displayName || user?.email?.split('@')[0] || 'Cliente',
        clientEmail: user?.email || '',
        clientPhone: userData?.phoneNumber || '',
        clientUid: user?.uid || '',
        routeDistance: 1200 // Mock meters
      };

      const res = await fetch(`/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao processar pedido.');
      }

      setCreatedOrderId(data.order.id);

      if (paymentMethod === 'pix') {
        setPixQrCode(data.qrCode);
        setShowPixLightbox(true);
      } else {
        // Cartão ou outro pagamento aprovado
        setCart([]);
        setShowOrderSummary(false);
        setOrderPlaced(true);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  // Realtime subscription for Pix approval
  useEffect(() => {
    if (!createdOrderId || !showPixLightbox) return;

    const channel = supabase
      .channel(`order_status:${createdOrderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${createdOrderId}` }, (payload) => {
        if (payload.new && ((payload.new as any).status === 'pending' || (payload.new as any).status === 'preparing')) {
          setTimeout(() => {
            setCart([]);
            setShowPixLightbox(false);
            setShowOrderSummary(false);
            setOrderPlaced(true);
          }, 1500);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [createdOrderId, showPixLightbox]);

  // Simulate payment approval for local development
  const simulatePaymentApproval = async () => {
    if (!createdOrderId) return;
    try {
      await supabase
        .from('orders')
        .update({ status: 'pending', payment_status: 'paid' })
        .eq('id', createdOrderId);
    } catch (err) {
      console.error(err);
    }
  };

  // Product Editing / Creation Handlers for Admin
  const startEdit = (prod: any) => {
    setEditingId(prod.id);
    setEditName(prod.name);
    setEditDescription(prod.description);
    setEditPrice(prod.price);
    setEditImage(prod.image || '');
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    try {
      const docId = editingId;
      const payload = {
        name: editName,
        description: editDescription,
        price: editPrice,
        image: editImage,
        category: activeCategory
      };

      if (isNewItem === editingId) {
        // Insert new product
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        setIsNewItem(null);
      } else {
        // Update product
        const { error } = await supabase.from('products').update(payload).eq('id', docId);
        if (error) throw error;
      }
      setEditingId(null);
      loadProducts();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar produto.');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsNewItem(null);
  };

  const handleDeleteItem = async (id: number) => {
    if (window.confirm("Deseja realmente remover este produto?")) {
      try {
        await supabase.from('products').delete().eq('id', id);
        loadProducts();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddNewItem = () => {
    const tempId = Date.now();
    setProducts(prev => [{ id: tempId, name: '', description: '', price: 0, image: '', category: activeCategory }, ...prev]);
    setEditingId(tempId);
    setIsNewItem(tempId);
    setEditName('');
    setEditDescription('');
    setEditPrice(0);
  };

  return (
    <div className="dashboard-layout animate-fade-in" style={{ paddingBottom: cart.length > 0 ? '90px' : '2rem' }}>
      
      {/* 1. Banners promocionais */}
      <PromotionalBanners />

      {/* 2. Grade de categorias estilo Zé Delivery */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
        marginTop: '1rem'
      }}>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '0.25rem',
              gap: '0.4rem',
              outline: 'none'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: activeCategory === category ? 'var(--primary-gold)' : '#1e1e1e',
              border: activeCategory === category ? '2.5px solid #fff' : '1px solid rgba(255,209,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: activeCategory === category ? '0 4px 15px rgba(255,209,0,0.4)' : 'none',
              transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {getCategoryEmoji(category)}
            </div>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: activeCategory === category ? 'var(--primary-gold)' : 'var(--text-primary)',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {category}
            </span>
          </button>
        ))}
      </div>

      <div className="client-grid">
        {/* Menu Seção */}
        <div className="menu-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-gold)' }}>{activeCategory}</h3>
            {canEdit && (
              <button onClick={handleAddNewItem} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,209,0,0.1)', border: '1px dashed var(--primary-gold)', color: 'var(--primary-gold)', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                <Plus size={16} /> Adicionar Bebida
              </button>
            )}
          </div>

          <div className="pastels-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Carregando bebidas...</div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', padding: '3rem 1rem', textAlign: 'center', width: '100%', background: '#1e1e1e', borderRadius: '12px', border: '1px dashed rgba(255,209,0,0.1)' }}>
                Nenhuma bebida disponível nesta categoria para a sua região.
              </div>
            ) : (
              filteredProducts.map((prod: any) => {
                const cartItem = cart.find(item => item.id === prod.id);
                return (
                  <div key={prod.id} className="pastel-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#1e1e1e', borderRadius: '12px', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', flex: 1 }}>
                      <div className="pastel-img-container" style={{ width: '80px', height: '80px', borderRadius: '8px', background: '#121212', overflow: 'hidden' }}>
                        {prod.image ? (
                          <img src={prod.image} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '1.2rem' }}>🍺</div>
                        )}
                      </div>
                      <div style={{ flex: 1, marginLeft: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {editingId === prod.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <input type="text" className="pastel-edit-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome" />
                            <input type="text" className="pastel-edit-input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descrição" />
                            <input type="number" className="pastel-edit-input" value={editPrice} onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)} placeholder="Preço" />
                          </div>
                        ) : (
                          <>
                            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{prod.name}</h4>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prod.description}</p>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary-gold)' }}>R$ {prod.price.toFixed(2).replace('.', ',')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '1rem' }}>
                      {editingId === prod.id ? (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={saveEdit} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><Check size={16} /></button>
                          <button onClick={cancelEdit} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                          {canEdit && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => startEdit(prod)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}><Edit2 size={13} /></button>
                              <button onClick={() => handleDeleteItem(prod.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={13} /></button>
                            </div>
                          )}

                          {/* Quantidade no card (+ e -) */}
                          {cartItem ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--primary-gold)', borderRadius: '20px', padding: '0.25rem 0.65rem' }}>
                              <button onClick={() => updateQuantity(prod.id, -1)} style={{ background: 'none', border: 'none', color: '#121212', cursor: 'pointer', padding: '0.15rem' }}><Minus size={14} strokeWidth={3} /></button>
                              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#121212' }}>{cartItem.quantity}</span>
                              <button onClick={() => updateQuantity(prod.id, 1)} style={{ background: 'none', border: 'none', color: '#121212', cursor: 'pointer', padding: '0.15rem' }}><Plus size={14} strokeWidth={3} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(prod)}
                              style={{ background: 'var(--primary-gold)', border: 'none', color: '#121212', fontWeight: 800, fontSize: '0.8rem', borderRadius: '20px', padding: '0.4rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              disabled={isClosedForUser}
                            >
                              <Plus size={14} strokeWidth={3} />
                              <span>Adicionar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sacola Lateral (Hidden on mobile, uses standard view on desktop) */}
        <div className="profile-section" id="cart-section">
          <div className="loyalty-card" style={{ background: '#1e1e1e', border: '1px solid rgba(255,209,0,0.1)' }}>
            <h3 style={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>Sacola de Compras</h3>
            {cart.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0' }}>Sua sacola está vazia.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {cart.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#121212', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{item.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-gold)' }}>R$ {item.price.toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={() => updateQuantity(item.id, -1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><Minus size={12} /></button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><Plus size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cupom de desconto */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input type="text" className="pastel-edit-input" style={{ marginBottom: 0 }} placeholder="CUPOM" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
                  <button onClick={applyCoupon} style={{ background: 'rgba(255,209,0,0.1)', border: '1px solid var(--primary-gold)', color: 'var(--primary-gold)', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>Aplicar</button>
                </div>
                {couponError && <span style={{ fontSize: '0.75rem', color: '#f87171' }}>{couponError}</span>}
                {activeCoupon && <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Cupom {activeCoupon.code} aplicado! (-R$ {calculateDiscount().toFixed(2)})</span>}

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Subtotal:</span>
                    <span>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  {orderType === 'delivery' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Entrega:</span>
                      <span>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {activeCoupon && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                      <span>Desconto:</span>
                      <span>-R$ {calculateDiscount().toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', color: '#fff', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                    <span>Total:</span>
                    <span style={{ color: 'var(--primary-gold)' }}>R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                {/* Forma de pagamento */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Forma de Pagamento:</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,209,0,0.15)', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}>
                    <option value="pix">Pix (Mercado Pago)</option>
                    <option value="credito">Cartão de Crédito (PagBank)</option>
                    <option value="debito">Cartão de Débito (Máquina na entrega)</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>

                <button onClick={() => setShowOrderSummary(true)} style={{ width: '100%', background: 'var(--primary-gold)', color: '#121212', padding: '0.85rem', borderRadius: '8px', border: 'none', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <ReceiptText size={18} /> Finalizar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Carrinho Flutuante Inferior para Mobile */}
      {cart.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '500px',
          height: '60px',
          backgroundColor: 'var(--primary-gold)',
          borderRadius: '30px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 1.5rem',
          boxSizing: 'border-box',
          zIndex: 1000,
          cursor: 'pointer',
          animation: 'fadeInUp 0.3s ease-out'
        }}
        onClick={() => {
          const element = document.getElementById('cart-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#121212' }}>
            <div style={{ position: 'relative' }}>
              <ShoppingCart size={22} strokeWidth={2.5} />
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#121212',
                color: 'var(--primary-gold)',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid var(--primary-gold)'
              }}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.85 }}>Entrega: {storeConfig?.deliveryTimeEstimate || '35-45 min'}</span>
            </div>
          </div>
          <span style={{ color: '#121212', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ver Sacola ➔
          </span>
        </div>
      )}

      {/* Lightbox do Pix */}
      {showPixLightbox && (
        <div className="lightbox-overlay" style={{ zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '400px', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-gold)' }}>Aguardando Pagamento Pix</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Escaneie o código Pix abaixo para confirmar seu pedido:</p>
            
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', display: 'inline-block', margin: '0 auto' }}>
              {/* QR Code Simulado ou Real */}
              <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#121212', fontSize: '0.8rem', border: '1px solid #ddd' }}>
                [QR Code Pix]
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Código Pix Copia e Cola:</span>
              <input type="text" readOnly value={pixQrCode} style={{ background: '#121212', border: '1px solid rgba(255,259,0,0.15)', color: '#fff', padding: '0.5rem', borderRadius: '6px', fontSize: '0.7rem', width: '100%', textAlign: 'center' }} onClick={(e) => (e.target as any).select()} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button onClick={simulatePaymentApproval} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>✓ Simular Aprovação</button>
              <button onClick={() => setShowPixLightbox(false)} style={{ background: 'none', border: '1.5px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação do Checkout */}
      {showOrderSummary && (
        <div className="lightbox-overlay" style={{ zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '450px', color: '#fff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-gold)', textAlign: 'center' }}>Resumo do Pedido</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Endereço de Entrega:</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{address?.street}, {address?.number}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{address?.neighborhood} · {address?.city}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Itens:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '120px', overflowY: 'auto' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{item.quantity}x {item.name}</span>
                    <span>R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>
            </div>

            {paymentMethod === 'credito' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-gold)', fontWeight: 700 }}>Dados do Cartão (Simulado)</span>
                <input type="text" placeholder="Número do Cartão" className="pastel-edit-input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" placeholder="Mês Ex (MM)" className="pastel-edit-input" style={{ flex: 1 }} value={expMonth} onChange={(e) => setExpMonth(e.target.value)} />
                  <input type="text" placeholder="Ano Ex (AA)" className="pastel-edit-input" style={{ flex: 1 }} value={expYear} onChange={(e) => setExpYear(e.target.value)} />
                  <input type="text" placeholder="CVV" className="pastel-edit-input" style={{ flex: 1 }} value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Subtotal:</span>
                <span>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>Entrega:</span>
                <span>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
              </div>
              {activeCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#10b981' }}>
                  <span>Desconto:</span>
                  <span>-R$ {calculateDiscount().toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-gold)' }}>
                <span>Total Final:</span>
                <span>R$ {finalTotal.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {error && <div style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handlePlaceOrder} disabled={submitting} style={{ flex: 1.5, background: 'var(--primary-gold)', color: '#121212', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}>
                {submitting ? 'Processando...' : 'Confirmar e Pagar'}
              </button>
              <button onClick={() => setShowOrderSummary(false)} disabled={submitting} style={{ flex: 1, background: 'none', border: '1.5px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '0.8rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso do Pedido */}
      {orderPlaced && (
        <div className="lightbox-overlay" style={{ zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '24px', padding: '2.5rem 2rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', boxShadow: '0 0 60px rgba(16,185,129,0.15), 0 24px 60px rgba(0,0,0,0.6)', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>✅</div>
            <div>
              <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.4rem', color: '#10b981', fontWeight: 800 }}>Pedido Recebido!</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>Seu pedido foi confirmado e as bebidas <strong style={{ color: '#fff' }}>já estão sendo separadas e embaladas</strong>! 🍻🚀</p>
            </div>
            <button type="button" onClick={() => { setOrderPlaced(false); onNavigate?.('tracking'); }} className="auth-btn auth-btn-login" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}>👀 Acompanhar Meus Pedidos</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
