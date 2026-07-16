import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface StoreData {
  id: string;
  slug: string;
  name: string;
  description?: string;
  city?: string;
  phone?: string;
  logo_url?: string;
  theme: 'dark' | 'light';
  primary_color: string;
  allow_cross_store: boolean;
  cross_store_changed_at?: string;
  owner_uid?: string;
  is_active: boolean;
  created_at: string;
}

interface StoreContextType {
  storeData: StoreData | null;
  storeId: string | null;
  storeSlug: string | null;
  loading: boolean;
  notFound: boolean;
  refreshStore: () => void;
}

const StoreContext = createContext<StoreContextType>({
  storeData: null,
  storeId: null,
  storeSlug: null,
  loading: true,
  notFound: false,
  refreshStore: () => {},
});

export function StoreProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchStore = async () => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stores/${slug}`);
      if (res.status === 404) {
        setNotFound(true);
        setStoreData(null);
      } else if (res.ok) {
        const json = await res.json();
        setStoreData(json.store);
        setNotFound(false);
      }
    } catch (err) {
      console.error('Erro ao carregar loja:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStore(); }, [slug]);

  // Apply theme & primary color to document root
  useEffect(() => {
    if (storeData) {
      document.documentElement.setAttribute('data-theme', storeData.theme);
      document.documentElement.style.setProperty('--primary-gold', storeData.primary_color);
      document.documentElement.style.setProperty('--primary-gold-hover', storeData.primary_color + 'cc');
    }
  }, [storeData]);

  return (
    <StoreContext.Provider value={{
      storeData,
      storeId: storeData?.id ?? null,
      storeSlug: slug,
      loading,
      notFound,
      refreshStore: fetchStore,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
