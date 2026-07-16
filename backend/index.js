import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Inicializa o cliente do Supabase
const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = (rawSupabaseUrl && rawSupabaseUrl.startsWith('http')) ? rawSupabaseUrl : 'https://your-supabase-url.supabase.co';

const rawSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAnonKey = (rawSupabaseAnonKey && !rawSupabaseAnonKey.startsWith('INSERIR')) ? rawSupabaseAnonKey : 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORE_COORDS = [-22.9112951, -43.5602961];

// Armazenamento em memória para simulações de Pix local
if (!global.mockPayments) {
  global.mockPayments = {};
}

// Helper nativo para requisições HTTPS
function nativeRequest(url, method, headers, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300, status: res.statusCode, json: parsed });
        } catch (e) {
          resolve({ ok: (res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300, status: res.statusCode, text: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// 1. Rota de sincronização do perfil do usuário com o Supabase (Chamada no fluxo de Registro)
app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, name, role, phoneNumber, clientAddress, cpf, tableNumber } = req.body;
    
    if (!uid || !email) {
      return res.status(400).json({ success: false, message: 'UID e Email são obrigatórios.' });
    }

    const dbData = {};
    if (uid !== undefined) dbData.uid = uid;
    if (email !== undefined) dbData.email = email;
    if (name !== undefined) dbData.name = name;
    if (role !== undefined) dbData.role = role;
    if (phoneNumber !== undefined) dbData.phone_number = phoneNumber;
    if (clientAddress !== undefined) dbData.client_address = clientAddress;
    if (cpf !== undefined) dbData.cpf = cpf;
    if (tableNumber !== undefined) dbData.table_number = tableNumber;
    
    dbData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('users')
      .upsert(dbData)
      .select();
      
    if (error) throw error;
    
    return res.status(200).json({ success: true, user: data?.[0] || dbData });
  } catch (err) {
    console.error('Erro na sincronização de perfil (users/sync):', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Buscar perfil de usuário por UID
app.get('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (error) throw error;
    return res.status(200).json({ success: true, user: data });
  } catch (err) {
    console.error('Erro ao buscar perfil de usuário:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2.1 Buscar perfil de usuário por email (busca de pré-cadastro)
app.get('/api/users/by-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase());

    if (error) throw error;
    return res.status(200).json({ success: true, users: data });
  } catch (err) {
    console.error('Erro ao buscar usuário por email:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2.2 Deletar pré-cadastro antigo (sincronização de UIDs)
app.post('/api/users/delete-old-pre-reg', async (req, res) => {
  try {
    const { oldUid } = req.body;
    if (!oldUid) {
      return res.status(400).json({ success: false, message: 'oldUid é obrigatório.' });
    }
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('uid', oldUid);

    if (error) throw error;
    return res.status(200).json({ success: true, message: 'Registro antigo deletado com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar registro antigo:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Processar Checkout do Pedido
app.post('/api/checkout', async (req, res) => {
  try {
    const {
      items,
      paymentMethod,
      deliveryAddress,
      orderType,
      tableNumber,
      couponCode,
      clientCpf,
      saveCardConsent,
      encryptedCard,
      useSavedCard,
      savedCustomerId,
      savedCardToken,
      clientName,
      clientEmail,
      clientPhone,
      clientUid,
      routeDistance
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Carrinho de compras vazio.' });
    }

    // 3.1 Validar produtos e preços no Supabase (antifraude)
    const productIds = items.map(i => i.id);
    const { data: dbProducts, error: dbErr } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (dbErr || !dbProducts || dbProducts.length === 0) {
      return res.status(500).json({ success: false, message: 'Erro ao validar produtos no estoque.' });
    }

    let calculatedSubtotal = 0;
    const validatedItems = items.map(item => {
      const dbProd = dbProducts.find(p => p.id === item.id);
      if (!dbProd) {
        throw new Error(`Produto ID ${item.id} não encontrado.`);
      }
      calculatedSubtotal += Number(dbProd.price) * item.quantity;
      return {
        id: dbProd.id,
        name: dbProd.name,
        price: Number(dbProd.price),
        quantity: item.quantity
      };
    });

    // 3.2 Taxa de entrega baseada em distância do cliente (OSRM)
    let deliveryFee = 0;
    if (orderType === 'delivery' && routeDistance) {
      const distanceKm = Number(routeDistance) / 1000;
      deliveryFee = distanceKm <= 3 ? 5.00 : 5.00 + Math.floor(distanceKm - 3.0) * 1.00;
    }

    // 3.3 Taxa de serviço se consumo local
    let serviceFee = 0;
    if (orderType === 'dine_in_table') {
      serviceFee = Number((calculatedSubtotal * 0.10).toFixed(2));
    }

    // 3.4 Aplicar cupom se houver
    let discountAmount = 0;
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .maybeSingle();

      if (coupon) {
        const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;
        const now = new Date();
        if (!expiresAt || expiresAt > now) {
          if (calculatedSubtotal >= Number(coupon.minimum_order)) {
            if (coupon.type === 'percentage') {
              discountAmount = calculatedSubtotal * (Number(coupon.value) / 100);
            } else {
              discountAmount = Number(coupon.value);
            }
          }
        }
      }
    }

    const calculatedTotal = Math.max(0, calculatedSubtotal + deliveryFee + serviceFee - discountAmount);
    
    // 3.5 Integração de pagamentos
    let gatewayResponse = { success: true };

    if (paymentMethod === 'pix') {
      const mpToken = process.env.MP_TOKEN;
      const isMock = !mpToken || mpToken === 'mock';

      if (isMock) {
        const mockPaymentId = 'PAY_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase();
        global.mockPayments[mockPaymentId] = { status: 'pending', createdAt: Date.now() };
        gatewayResponse = {
          success: true,
          paymentId: mockPaymentId,
          qrCode: '00020101021226870014br.gov.bcb.pix2565qr-mock-code-deposito-bebidas-12345',
          qrCodeBase64: '',
          status: 'pending'
        };
      } else {
        const mpUrl = 'https://api.mercadopago.com/v1/payments';
        const headers = {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': 'PIX_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
        };

        const first = clientName?.split(' ')[0] || 'Cliente';
        const last = clientName?.split(' ').slice(1).join(' ') || 'Bebidas';
        const cpfDigits = clientCpf?.replace(/\D/g, '') || '45678912364';

        const payload = {
          transaction_amount: calculatedTotal,
          description: 'Pedido Depósito de Bebidas',
          payment_method_id: 'pix',
          payer: {
            email: clientEmail || 'cliente@email.com',
            first_name: first,
            last_name: last,
            identification: { type: 'CPF', number: cpfDigits }
          }
        };

        const resMp = await nativeRequest(mpUrl, 'POST', headers, payload);
        if (!resMp.ok) {
          return res.status(400).json({ success: false, message: resMp.json?.message || 'Erro ao gerar Pix no Mercado Pago.' });
        }
        
        const r = resMp.json;
        gatewayResponse = {
          success: true,
          paymentId: r.id.toString(),
          qrCode: r.point_of_interaction?.transaction_data?.qr_code || '',
          qrCodeBase64: r.point_of_interaction?.transaction_data?.qr_code_base64 || '',
          status: r.status
        };
      }
    } else if (paymentMethod === 'credito') {
      const pagbankToken = process.env.PAGBANK_TOKEN;
      const isMock = !pagbankToken || pagbankToken === 'mock';
      const amountCents = Math.round(calculatedTotal * 100);

      if (isMock) {
        if (encryptedCard === 'fail' || encryptedCard === 'invalid_card') {
          return res.status(400).json({ success: false, message: 'Cartão recusado pelo emissor.' });
        }
        
        gatewayResponse = {
          success: true,
          chargeId: 'CHAR_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase()
        };

        if (!useSavedCard && saveCardConsent) {
          gatewayResponse.card = {
            customer_id: savedCustomerId || 'CUST_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase(),
            card_token: 'CARD_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase(),
            brand: 'visa',
            last_digits: '4111'
          };
        }
      } else {
        const headers = {
          'Authorization': `Bearer ${pagbankToken}`,
          'Content-Type': 'application/json'
        };
        const baseUrl = 'https://sandbox.api.pagseguro.com'; 

        const chargePayload = {
          reference_id: 'ORDER_' + Date.now(),
          description: 'Pedido Depósito de Bebidas',
          amount: { value: amountCents, currency: 'BRL' },
          payment_method: {
            type: 'CREDIT_CARD',
            installments: 1,
            capture: true,
            card: useSavedCard ? { id: savedCardToken } : { encrypted: encryptedCard }
          }
        };

        const resPb = await nativeRequest(`${baseUrl}/charges`, 'POST', headers, chargePayload);
        if (!resPb.ok || (resPb.json.status !== 'AUTHORIZED' && resPb.json.status !== 'PAID')) {
          const errMsg = resPb.json?.error_messages?.[0]?.description || 'Pagamento recusado pelo emissor do cartão.';
          return res.status(400).json({ success: false, message: errMsg });
        }

        gatewayResponse = {
          success: true,
          chargeId: resPb.json.id
        };

        // Salvar cartão no cofre do cliente
        if (!useSavedCard && saveCardConsent) {
          let customerId = savedCustomerId;
          if (!customerId) {
            const customerPayload = {
              name: clientName,
              email: clientEmail,
              tax_id: clientCpf?.replace(/\D/g, '') || ''
            };
            const custRes = await nativeRequest(`${baseUrl}/v1/customers`, 'POST', headers, customerPayload);
            if (custRes.ok && custRes.json.id) {
              customerId = custRes.json.id;
            }
          }

          if (customerId) {
            const cardPayload = { encrypted: encryptedCard };
            const cardRes = await nativeRequest(`${baseUrl}/v1/customers/${customerId}/cards`, 'POST', headers, cardPayload);
            if (cardRes.ok && cardRes.json.id) {
              gatewayResponse.card = {
                customer_id: customerId,
                card_token: cardRes.json.id,
                brand: cardRes.json.brand || 'visa',
                last_digits: cardRes.json.last_digits || '9999'
              };
            }
          }
        }
      }
    }

    // 3.6 Criar pedido
    const todayStr = new Date().toISOString().split('T')[0];
    const { count: dailyCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStr);
    const dailySeq = (dailyCount || 0) + 1;

    const newOrder = {
      client_uid: clientUid || null,
      client_name: clientName || 'Cliente Anônimo',
      client_phone: clientPhone || '',
      items: validatedItems,
      total: calculatedTotal,
      delivery_fee: orderType === 'delivery' ? deliveryFee : 0,
      service_fee: orderType === 'dine_in_table' ? serviceFee : 0,
      status: paymentMethod === 'pix' ? 'pendente_pagamento' : 'pending',
      order_type: orderType,
      table_number: orderType === 'dine_in_table' ? tableNumber : null,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'credito' ? 'paid' : 'pending',
      daily_seq: dailySeq,
      address: orderType === 'delivery' ? {
        street: deliveryAddress.street,
        number: deliveryAddress.number || '',
        neighborhood: deliveryAddress.neighborhood || '',
        city: deliveryAddress.city || 'Rio de Janeiro',
        zipCode: deliveryAddress.zipCode || '',
        complement: deliveryAddress.complement || '',
        lat: deliveryAddress.lat,
        lng: deliveryAddress.lng,
      } : null,
    };

    const { data: createdOrder, error: insertErr } = await supabase
      .from('orders')
      .insert(newOrder)
      .select()
      .single();

    if (insertErr) {
      console.error('Erro ao gravar pedido:', insertErr);
      return res.status(500).json({ success: false, message: 'Pedido gerado, mas erro ao gravar no banco.' });
    }

    return res.status(200).json({
      success: true,
      order: createdOrder,
      ...gatewayResponse
    });

  } catch (err) {
    console.error('Erro no Checkout API:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4. PagBank process-payment (crédito) direto
app.post('/api/pagamentos/process-payment', async (req, res) => {
  try {
    const {
      encryptedCard,
      cpf,
      saveCard,
      orderTotal,
      clientName,
      clientEmail,
      useSavedCard,
      savedCustomerId,
      savedCardToken
    } = req.body;
    
    const pagbankToken = process.env.PAGBANK_TOKEN;
    const isMock = !pagbankToken || pagbankToken === 'mock';
    const amountCents = Math.round(orderTotal * 100);
    
    if (isMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (encryptedCard === 'fail' || encryptedCard === 'invalid_card') {
        return res.status(400).json({ success: false, message: 'Cartão recusado pelo emissor.' });
      }
      
      const responseData = {
        success: true,
        chargeId: 'CHAR_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase()
      };
      
      if (!useSavedCard && saveCard) {
        responseData.card = {
          customer_id: savedCustomerId || 'CUST_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase(),
          card_token: 'CARD_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase(),
          brand: 'visa',
          last_digits: '4111'
        };
      }
      return res.status(200).json(responseData);
    }
    
    const headers = {
      'Authorization': `Bearer ${pagbankToken}`,
      'Content-Type': 'application/json'
    };
    
    const baseUrl = 'https://sandbox.api.pagseguro.com';
    
    const chargePayload = {
      reference_id: 'ORDER_' + Date.now(),
      description: 'Pedido Depósito de Bebidas',
      amount: { value: amountCents, currency: 'BRL' },
      payment_method: {
        type: 'CREDIT_CARD',
        installments: 1,
        capture: true,
        card: useSavedCard ? { id: savedCardToken } : { encrypted: encryptedCard }
      }
    };
    
    const chargeRes = await nativeRequest(`${baseUrl}/charges`, 'POST', headers, chargePayload);
    if (!chargeRes.ok || (chargeRes.json.status !== 'AUTHORIZED' && chargeRes.json.status !== 'PAID')) {
      const errMsg = chargeRes.json?.error_messages?.[0]?.description || 'Pagamento recusado pelo emissor do cartão.';
      return res.status(400).json({ success: false, message: errMsg });
    }
    
    const responseData = {
      success: true,
      chargeId: chargeRes.json.id
    };
    
    if (!useSavedCard && saveCard) {
      let customerId = savedCustomerId;
      if (!customerId) {
        const customerPayload = {
          name: clientName,
          email: clientEmail,
          tax_id: cpf.replace(/\D/g, '')
        };
        const customerRes = await nativeRequest(`${baseUrl}/v1/customers`, 'POST', headers, customerPayload);
        if (customerRes.ok && customerRes.json.id) {
          customerId = customerRes.json.id;
        }
      }
      
      if (customerId) {
        const cardPayload = { encrypted: encryptedCard };
        const cardRes = await nativeRequest(`${baseUrl}/v1/customers/${customerId}/cards`, 'POST', headers, cardPayload);
        if (cardRes.ok && cardRes.json.id) {
          responseData.card = {
            customer_id: customerId,
            card_token: cardRes.json.id,
            brand: cardRes.json.brand || 'visa',
            last_digits: cardRes.json.last_digits || '9999'
          };
        }
      }
    }
    
    return res.status(200).json(responseData);
  } catch (err) {
    console.error('Erro ao processar pagamento:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar pagamento.' });
  }
});

// 5. Mercado Pago create-pix
app.post('/api/pagamentos/create-pix', async (req, res) => {
  try {
    const { token, amount, email, name, cpf } = req.body;
    const isMock = !token || token === 'mock';
    
    if (isMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockPaymentId = 'PAY_MOCK_' + Math.random().toString(36).substring(2, 11).toUpperCase();
      global.mockPayments[mockPaymentId] = { status: 'pending', createdAt: Date.now() };
      
      return res.status(200).json({
        success: true,
        paymentId: mockPaymentId,
        qrCode: '00020101021226870014br.gov.bcb.pix2565qr-mock-code-deposito-12345',
        qrCodeBase64: '',
        status: 'pending'
      });
    }
    
    const mpUrl = 'https://api.mercadopago.com/v1/payments';
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'PIX_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
    };
    
    const firstName = name?.split(' ')[0] || 'Cliente';
    const lastName = name?.split(' ').slice(1).join(' ') || 'Bebidas';
    
    const payload = {
      transaction_amount: parseFloat(amount),
      description: 'Pedido Depósito de Bebidas',
      payment_method_id: 'pix',
      payer: {
        email: email || 'cliente@email.com',
        first_name: firstName,
        last_name: lastName,
        identification: { type: 'CPF', number: cpf.replace(/\D/g, '') }
      }
    };
    
    const response = await nativeRequest(mpUrl, 'POST', headers, payload);
    if (!response.ok) {
      return res.status(400).json({ success: false, message: response.json?.message || 'Erro ao gerar Pix.' });
    }
    
    const r = response.json;
    return res.status(200).json({
      success: true,
      paymentId: r.id.toString(),
      qrCode: r.point_of_interaction?.transaction_data?.qr_code || '',
      qrCodeBase64: r.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      status: r.status
    });
  } catch (err) {
    console.error('Erro ao criar Pix:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao criar Pix.' });
  }
});

// 6. Mercado Pago check-pix (consultar status do Pix)
app.get('/api/pagamentos/check-pix', async (req, res) => {
  try {
    const { paymentId, token } = req.query;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'paymentId é obrigatório.' });
    }
    
    const isMock = !token || token === 'mock';
    
    if (isMock) {
      const mockPay = global.mockPayments[paymentId];
      if (mockPay) {
        if (Date.now() - mockPay.createdAt > 5000) {
          mockPay.status = 'approved';
        }
        return res.status(200).json({ success: true, status: mockPay.status });
      }
      return res.status(200).json({ success: true, status: 'approved' });
    }
    
    const mpUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const response = await nativeRequest(mpUrl, 'GET', headers);
    if (!response.ok) {
      return res.status(400).json({ success: false, message: 'Erro ao verificar pagamento.' });
    }
    
    return res.status(200).json({ success: true, status: response.json.status });
  } catch (err) {
    console.error('Erro ao verificar Pix:', err);
    return res.status(500).json({ success: false, message: 'Erro interno ao checar Pix.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STORES (MULTI-TENANT)
// ─────────────────────────────────────────────────────────────────────────────

// S1. Verificar disponibilidade de slug
app.get('/api/stores/check-slug', async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug é obrigatório.' });

    const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const { data, error } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', normalized)
      .maybeSingle();

    if (error) throw error;
    return res.status(200).json({ success: true, available: !data, slug: normalized });
  } catch (err) {
    console.error('Erro ao verificar slug:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// S2. Buscar loja por slug (público — carrega o cardápio)
app.get('/api/stores/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Loja não encontrada.' });
    return res.status(200).json({ success: true, store: data });
  } catch (err) {
    console.error('Erro ao buscar loja:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// S3. Criar loja (owner)
app.post('/api/stores', async (req, res) => {
  try {
    const { slug, name, description, city, phone, logoUrl, theme, primaryColor, ownerUid } = req.body;
    if (!slug || !name || !ownerUid) {
      return res.status(400).json({ success: false, message: 'Slug, nome e ownerUid são obrigatórios.' });
    }

    const normalized = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Verificar slug disponível
    const { data: existing } = await supabase.from('stores').select('id').eq('slug', normalized).maybeSingle();
    if (existing) return res.status(409).json({ success: false, message: 'Este slug já está em uso.' });

    const { data, error } = await supabase.from('stores').insert({
      slug: normalized,
      name,
      description,
      city,
      phone,
      logo_url: logoUrl,
      theme: theme || 'dark',
      primary_color: primaryColor || '#FFD100',
      owner_uid: ownerUid,
    }).select().single();

    if (error) throw error;

    // Atualizar store_id do owner
    await supabase.from('users').update({ store_id: data.id }).eq('uid', ownerUid);

    return res.status(201).json({ success: true, store: data });
  } catch (err) {
    console.error('Erro ao criar loja:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// S4. Atualizar configurações da loja
app.put('/api/stores/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { name, description, city, phone, logoUrl, theme, primaryColor, allowCrossStore, requestingUid } = req.body;

    // Buscar loja e verificar se solicitante é owner/dev
    const { data: store, error: fetchError } = await supabase.from('stores').select('*').eq('slug', slug).maybeSingle();
    if (fetchError) throw fetchError;
    if (!store) return res.status(404).json({ success: false, message: 'Loja não encontrada.' });

    const { data: requester } = await supabase.from('users').select('role').eq('uid', requestingUid).maybeSingle();
    const isAuthorized = requester && (requester.role === 'developer' || store.owner_uid === requestingUid);
    if (!isAuthorized) return res.status(403).json({ success: false, message: 'Sem permissão para editar esta loja.' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (city !== undefined) updates.city = city;
    if (phone !== undefined) updates.phone = phone;
    if (logoUrl !== undefined) updates.logo_url = logoUrl;
    if (theme !== undefined) updates.theme = theme;
    if (primaryColor !== undefined) updates.primary_color = primaryColor;

    // Cooldown de 24h para allow_cross_store
    if (allowCrossStore !== undefined) {
      if (store.cross_store_changed_at) {
        const lastChanged = new Date(store.cross_store_changed_at);
        const hoursSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          const hoursLeft = Math.ceil(24 - hoursSince);
          return res.status(429).json({
            success: false,
            message: `Esta configuração só pode ser alterada novamente em ${hoursLeft} hora(s).`,
            hoursLeft,
          });
        }
      }
      updates.allow_cross_store = allowCrossStore;
      updates.cross_store_changed_at = new Date().toISOString();
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('stores').update(updates).eq('slug', slug).select().single();
    if (error) throw error;
    return res.status(200).json({ success: true, store: data });
  } catch (err) {
    console.error('Erro ao atualizar loja:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// S5. Listar lojas (developer only)
app.get('/api/stores', async (req, res) => {
  try {
    const { data, error } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ success: true, stores: data });
  } catch (err) {
    console.error('Erro ao listar lojas:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`[Depósito Delivery Backend] Rodando com sucesso na porta ${PORT}`);
});
