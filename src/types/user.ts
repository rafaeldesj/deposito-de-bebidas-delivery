export type UserRole = 'developer' | 'owner' | 'manager' | 'staff' | 'client';

export interface StaffFunctions {
  cook: boolean;       // Cozinheiro
  attendant: boolean;  // Atendente
  cashier: boolean;    // Caixa
  delivery?: boolean;  // Entregador
}

export interface UserAddress {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  zipCode: string;
  complement?: string;
}

export interface UserDocument {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  phoneNumber?: string;
  staffFunctions?: StaffFunctions;
  clientAddress?: UserAddress;
  tempPassword?: string;
  cpf?: string;
  pagbank_customer_id?: string | null;
  pagbank_card_token?: string | null;
  pagbank_card_brand?: string | null;
  pagbank_card_last_digits?: string | null;
  tableNumber?: string | null;
  storeId?: string | null;
}
