import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { MapAddress } from '../components/DeliveryMap';

interface LocationContextType {
  address: MapAddress | null;
  setAddress: (address: MapAddress | null) => void;
  clearAddress: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddressState] = useState<MapAddress | null>(() => {
    const saved = localStorage.getItem('delivery_address');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setAddress = (addr: MapAddress | null) => {
    setAddressState(addr);
    if (addr) {
      localStorage.setItem('delivery_address', JSON.stringify(addr));
    } else {
      localStorage.removeItem('delivery_address');
    }
  };

  const clearAddress = () => {
    setAddress(null);
  };

  return (
    <LocationContext.Provider value={{ address, setAddress, clearAddress }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation deve ser usado dentro de um LocationProvider');
  return context;
};
