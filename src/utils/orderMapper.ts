import type { OrderDocument } from '../types/order';

export const mapOrderFromDb = (row: any): OrderDocument => {
  return {
    id: row.id,
    clientUid: row.client_uid,
    clientName: row.client_name,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    orderType: row.order_type,
    tableNumber: row.table_number,
    deliveryFee: row.delivery_fee !== null && row.delivery_fee !== undefined ? Number(row.delivery_fee) : undefined,
    serviceFee: row.service_fee !== null && row.service_fee !== undefined ? Number(row.service_fee) : undefined,
    address: row.address,
    deliveryUid: row.delivery_uid,
    deliveryName: row.delivery_name,
    deliveryCoords: row.delivery_coords,
    clientCoords: row.client_coords,
    clientPhone: row.client_phone,
    dailySeq: row.daily_seq,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    paymentMethod: row.payment_method,
    changeFor: row.change_for !== null && row.change_for !== undefined ? Number(row.change_for) : null,
  };
};

export const mapOrderToDb = (order: Partial<OrderDocument>) => {
  const dbData: any = {};
  if (order.id !== undefined) dbData.id = order.id;
  if (order.clientUid !== undefined) dbData.client_uid = order.clientUid;
  if (order.clientName !== undefined) dbData.client_name = order.clientName;
  if (order.items !== undefined) dbData.items = order.items;
  if (order.total !== undefined) dbData.total = order.total;
  if (order.status !== undefined) dbData.status = order.status;
  if (order.createdAt !== undefined) dbData.created_at = order.createdAt;
  if (order.orderType !== undefined) dbData.order_type = order.orderType;
  if (order.tableNumber !== undefined) dbData.table_number = order.tableNumber;
  if (order.deliveryFee !== undefined) dbData.delivery_fee = order.deliveryFee;
  if (order.serviceFee !== undefined) dbData.service_fee = order.serviceFee;
  if (order.address !== undefined) dbData.address = order.address;
  if (order.deliveryUid !== undefined) dbData.delivery_uid = order.deliveryUid;
  if (order.deliveryName !== undefined) dbData.delivery_name = order.deliveryName;
  if (order.deliveryCoords !== undefined) dbData.delivery_coords = order.deliveryCoords;
  if (order.clientCoords !== undefined) dbData.client_coords = order.clientCoords;
  if (order.clientPhone !== undefined) dbData.client_phone = order.clientPhone;
  if (order.dailySeq !== undefined) dbData.daily_seq = order.dailySeq;
  if (order.cancelReason !== undefined) dbData.cancel_reason = order.cancelReason;
  if (order.cancelledAt !== undefined) dbData.cancelled_at = order.cancelledAt;
  if (order.cancelledBy !== undefined) dbData.cancelled_by = order.cancelledBy;
  if (order.paymentMethod !== undefined) dbData.payment_method = order.paymentMethod;
  if (order.changeFor !== undefined) dbData.change_for = order.changeFor;
  return dbData;
};
