export type OrderStatus = 'DRAFT' | 'SUBMITTED' | 'COOKING' | 'READY' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'PROMPTPAY_QR' | 'CREDIT_CARD';
export type ActorRole = 'Guest' | 'Waiter' | 'KitchenChef' | 'Cashier';
export type ItemCategory = 'Food' | 'Beverage' | 'Dessert' | 'Special';
export type TableStatus = 'Available' | 'Occupied' | 'BillRequested';

export interface Ingredient {
  id: number;
  name: string;
  currentStock: number;
  minimumThreshold: number;
  unit: number; // 0=Grams, 1=Milliliters, 2=Pieces, 3=Portions
  costPerUnit: number;
  lastUpdatedAt: string;
}

export interface BillOfMaterialItem {
  id: number;
  productId: number;
  ingredientId: number;
  quantityRequired: number;
  ingredient?: Ingredient;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: number | ItemCategory;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  taxRate: number;
  bomItems?: BillOfMaterialItem[];
}

export interface TableItem {
  id: number;
  tableNumber: string;
  seats: number;
  status: number | TableStatus;
  currentOrderId?: number | null;
  guestName?: string | null;
}

export interface OrderItem {
  id?: number;
  orderId?: number;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  totalPrice?: number;
  modifiers?: string;
  specialInstructions?: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  tableId: number;
  tableNumber: string;
  status: OrderStatus;
  createdAt: string;
  submittedAt?: string;
  cookingAt?: string;
  readyAt?: string;
  paidAt?: string;
  createdByActor: ActorRole;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
}

export interface Payment {
  id: number;
  orderId: number;
  amountDue: number;
  amountPaid: number;
  changeAmount: number;
  method: PaymentMethod;
  transactionReference?: string;
  paidAt: string;
  receiptEscPosBase64?: string;
  receiptTextPreview?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  modifiers?: string;
  specialInstructions?: string;
}
