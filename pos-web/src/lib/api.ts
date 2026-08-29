import { db } from './db';
import { Product, TableItem, Order, Ingredient, PaymentMethod, ActorRole } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    // Cache to Dexie
    await db.products.clear();
    await db.products.bulkPut(data);
    return data;
  } catch (err) {
    console.warn('Using offline cached products:', err);
    return await db.products.toArray();
  }
}

export async function fetchTables(): Promise<TableItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/tables`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    await db.diningTables.clear();
    await db.diningTables.bulkPut(data);
    return data;
  } catch (err) {
    console.warn('Using offline cached tables:', err);
    return await db.diningTables.toArray();
  }
}

export async function fetchActiveOrders(): Promise<Order[]> {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch active orders:', err);
    return await db.orders.toArray();
  }
}

export async function fetchKdsQueue(): Promise<Order[]> {
  try {
    const res = await fetch(`${API_BASE}/api/kds/queue`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch KDS queue:', err);
    return [];
  }
}

export async function submitOrder(payload: {
  tableId: number;
  actor: ActorRole;
  items: { productId: number; quantity: number; modifiers?: string; specialInstructions?: string }[];
  notes?: string;
}): Promise<Order> {
  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Order failed' }));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }

    const order: Order = await res.json();
    await db.orders.put(order);
    return order;
  } catch (err: any) {
    console.warn('Offline: Saving order to offline queue:', err);
    // Queue offline
    await db.offlineQueue.add({
      type: 'SUBMIT_ORDER',
      payload,
      createdAt: Date.now(),
      status: 'PENDING'
    });

    // Create local optimistic order
    const localOrder: Order = {
      id: Date.now(),
      orderNumber: `OFFLINE-${Math.floor(Math.random() * 9000 + 1000)}`,
      tableId: payload.tableId,
      tableNumber: `T-${payload.tableId}`,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      createdByActor: payload.actor,
      notes: payload.notes,
      items: payload.items.map(i => ({
        productId: i.productId,
        productName: 'Item (Offline)',
        unitPrice: 0,
        quantity: i.quantity,
        modifiers: i.modifiers,
        specialInstructions: i.specialInstructions
      })),
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 0
    };
    await db.orders.put(localOrder);
    return localOrder;
  }
}

export async function acceptKdsOrder(orderId: number): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/kds/${orderId}/accept`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to accept order' }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return await res.json();
}

export async function completeKdsOrder(orderId: number): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/kds/${orderId}/complete`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to complete order' }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return await res.json();
}

export async function settlePayment(payload: {
  orderId: number;
  method: PaymentMethod;
  amountPaid: number;
  transactionReference?: string;
}): Promise<{ order: Order; payment: any; receiptText: string; escposBase64: string }> {
  const res = await fetch(`${API_BASE}/api/payments/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Settlement failed' }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }

  return await res.json();
}

export async function fetchInventory(): Promise<Ingredient[]> {
  const res = await fetch(`${API_BASE}/api/inventory`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

export async function adjustInventoryStock(id: number, delta: number, reason: string): Promise<Ingredient> {
  const res = await fetch(`${API_BASE}/api/inventory/${id}/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta, reason })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Adjustment failed' }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }

  return await res.json();
}

export async function syncOfflineQueue(): Promise<number> {
  const pending = await db.offlineQueue.where('status').equals('PENDING').toArray();
  let count = 0;

  for (const item of pending) {
    try {
      if (item.type === 'SUBMIT_ORDER') {
        await submitOrder(item.payload);
      }
      if (item.id) {
        await db.offlineQueue.update(item.id, { status: 'SYNCED' });
        count++;
      }
    } catch (err: any) {
      if (item.id) {
        await db.offlineQueue.update(item.id, { status: 'FAILED', errorMessage: err.message });
      }
    }
  }

  return count;
}
