import Dexie, { type Table } from 'dexie';
import { Product, TableItem, Order, CartItem } from './types';

export interface OfflineQueueItem {
  id?: number;
  type: 'SUBMIT_ORDER' | 'ACCEPT_ORDER' | 'COMPLETE_ORDER' | 'SETTLE_PAYMENT';
  payload: any;
  createdAt: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  errorMessage?: string;
}

export class PosDatabase extends Dexie {
  products!: Table<Product, number>;
  diningTables!: Table<TableItem, number>;
  orders!: Table<Order, number>;
  cart!: Table<CartItem, number>;
  offlineQueue!: Table<OfflineQueueItem, number>;

  constructor() {
    super('ArtisanPosOfflineDb');
    this.version(1).stores({
      products: 'id, name, category, price',
      diningTables: 'id, tableNumber, status',
      orders: 'id, orderNumber, tableId, status, createdAt',
      cart: '++id, product.id',
      offlineQueue: '++id, type, status, createdAt'
    });
  }
}

export const db = new PosDatabase();
