-- Script de Migração para Banco de Dados Supabase (PostgreSQL)
-- Para "Depósito de Bebidas Delivery" (Fork mobile-first)

-- Habilitar extensão para geração de UUID se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE USUÁRIOS/PERFIS
CREATE TABLE IF NOT EXISTS public.users (
  uid VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'client',
  phone_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cpf VARCHAR(20),
  client_address JSONB, -- { street, number, neighborhood, city, zipCode, complement }
  pagbank_customer_id VARCHAR(255),
  pagbank_card_token VARCHAR(255),
  pagbank_card_brand VARCHAR(50),
  pagbank_card_last_digits VARCHAR(10),
  staff_functions JSONB, -- { cook, attendant, cashier, delivery }
  temp_password VARCHAR(255)
);

-- Índices para otimização de busca em usuários
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users(cpf);

-- 2. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  icon_name VARCHAR(100), -- Ex: 'beer', 'wine', 'grape', 'coffee', 'ice'
  sort_order INTEGER DEFAULT 0
);

-- Semeando categorias iniciais inspiradas no Zé Delivery
INSERT INTO public.categories (name, icon_name, sort_order) VALUES
  ('Cervejas', 'beer', 1),
  ('Destilados', 'wine', 2),
  ('Petiscos', 'grape', 3),
  ('Gelo e Carvão', 'coffee', 4),
  ('Refrigerantes e Águas', 'beer', 5)
ON CONFLICT (name) DO UPDATE SET icon_name = EXCLUDED.icon_name, sort_order = EXCLUDED.sort_order;

-- 3. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  category VARCHAR(255) REFERENCES public.categories(name) ON UPDATE CASCADE,
  image TEXT, -- URL ou base64
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE ESTOQUE POR REGIÃO (GEOLOCALIZAÇÃO)
CREATE TABLE IF NOT EXISTS public.inventory_regions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES public.products(id) ON DELETE CASCADE,
  neighborhood VARCHAR(255) NOT NULL, -- Nome do bairro (ex: 'Campo Grande', 'Bangu')
  stock_qty INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT TRUE,
  UNIQUE(product_id, neighborhood)
);

CREATE INDEX IF NOT EXISTS idx_inventory_neighborhood ON public.inventory_regions(neighborhood);

-- 5. TABELA DE PEDIDOS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uid VARCHAR(255) REFERENCES public.users(uid) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  items JSONB NOT NULL, -- Array de { id, name, price, quantity }
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled' | 'aguardando_caixa' | 'pendente_pagamento'
  order_type VARCHAR(50) DEFAULT 'delivery', -- 'pickup' | 'delivery' | 'dine_in' | 'dine_in_table'
  table_number VARCHAR(50),
  delivery_fee NUMERIC(10, 2) DEFAULT 0,
  service_fee NUMERIC(10, 2) DEFAULT 0,
  address JSONB, -- Endereço completo de entrega
  delivery_uid VARCHAR(255),
  delivery_name VARCHAR(255),
  delivery_coords JSONB, -- { lat, lng }
  client_coords JSONB, -- { lat, lng }
  client_phone VARCHAR(50),
  daily_seq SERIAL, -- Sequência diária para identificação fácil
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by VARCHAR(100),
  payment_method VARCHAR(100), -- 'pix' | 'cartao_credito' | 'dinheiro' etc.
  change_for NUMERIC(10, 2),
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'paid' | 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_client ON public.orders(client_uid);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 6. TABELA DE CUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'percentage' | 'fixed'
  value NUMERIC(10, 2) NOT NULL,
  minimum_order NUMERIC(10, 2) DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE CONFIGURAÇÕES (Lojas, status de funcionamento, etc)
CREATE TABLE IF NOT EXISTS public.settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL
);

-- Semeando a configuração inicial da loja
INSERT INTO public.settings (key, value) VALUES
  ('store_config', '{"isOpen": true, "openingTime": "08:00", "closingTime": "23:59", "deliveryTimeEstimate": "35-45 min"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. TABELA DE CÂMERAS DE SEGURANÇA
CREATE TABLE IF NOT EXISTS public.cameras (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  ip VARCHAR(100) NOT NULL,
  port INTEGER NOT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(100),
  stream_type VARCHAR(50) DEFAULT 'RTSP',
  stream_path VARCHAR(255) DEFAULT '/onvif1',
  wifi_ssid VARCHAR(100),
  mac_address VARCHAR(100),
  device_id VARCHAR(100),
  use_cloud_stream BOOLEAN DEFAULT FALSE,
  cloud_provider VARCHAR(100) DEFAULT 'None',
  cloud_stream_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABELA DE LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  action_type VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABELA DE RESERVAS DE MESAS
CREATE TABLE IF NOT EXISTS public.reservations (
  table_number VARCHAR(50) PRIMARY KEY,
  reserved BOOLEAN DEFAULT TRUE,
  client_name VARCHAR(255),
  client_uid VARCHAR(255) REFERENCES public.users(uid) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABELA DE TRANSAÇÕES (BAIXA MANUAL DE CAIXA)
CREATE TABLE IF NOT EXISTS public.transactions (
  id SERIAL PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  client_name VARCHAR(255),
  client_uid VARCHAR(255) REFERENCES public.users(uid) ON DELETE SET NULL,
  total NUMERIC(10, 2) NOT NULL,
  payment_method VARCHAR(100),
  type VARCHAR(100),
  approved_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);





