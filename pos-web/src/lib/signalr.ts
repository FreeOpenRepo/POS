import * as signalR from '@microsoft/signalr';
import { Order, TableItem } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type OrderCallback = (order: Order) => void;
type TableCallback = (table: TableItem) => void;
type AlertCallback = (msg: string) => void;

class SignalRManager {
  private connection: signalR.HubConnection | null = null;
  private newOrderListeners: Set<OrderCallback> = new Set();
  private cookingListeners: Set<OrderCallback> = new Set();
  private readyListeners: Set<OrderCallback> = new Set();
  private paidListeners: Set<OrderCallback> = new Set();
  private tableListeners: Set<TableCallback> = new Set();
  private alertListeners: Set<AlertCallback> = new Set();
  private isConnecting: boolean = false;

  public async connect(): Promise<signalR.HubConnection | null> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    if (this.isConnecting) return null;
    this.isConnecting = true;

    try {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_BASE}/hubs/pos`, {
          skipNegotiation: false,
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build();

      this.connection.on('BroadcastNewOrder', (order: Order) => {
        this.newOrderListeners.forEach(cb => cb(order));
      });

      this.connection.on('NotifyCooking', (order: Order) => {
        this.cookingListeners.forEach(cb => cb(order));
      });

      this.connection.on('NotifyReady', (order: Order) => {
        this.readyListeners.forEach(cb => cb(order));
      });

      this.connection.on('NotifyOrderPaid', (order: Order) => {
        this.paidListeners.forEach(cb => cb(order));
      });

      this.connection.on('BroadcastTableUpdate', (table: TableItem) => {
        this.tableListeners.forEach(cb => cb(table));
      });

      this.connection.on('BroadcastInventoryAlert', (msg: string) => {
        this.alertListeners.forEach(cb => cb(msg));
      });

      await this.connection.start();
      console.log('SignalR POS Hub Connected successfully.');
      this.isConnecting = false;
      return this.connection;
    } catch (err) {
      console.warn('SignalR connection failed (backend might still be starting):', err);
      this.isConnecting = false;
      return null;
    }
  }

  public onNewOrder(cb: OrderCallback) {
    this.newOrderListeners.add(cb);
    return () => this.newOrderListeners.delete(cb);
  }

  public onCooking(cb: OrderCallback) {
    this.cookingListeners.add(cb);
    return () => this.cookingListeners.delete(cb);
  }

  public onReady(cb: OrderCallback) {
    this.readyListeners.add(cb);
    return () => this.readyListeners.delete(cb);
  }

  public onPaid(cb: OrderCallback) {
    this.paidListeners.add(cb);
    return () => this.paidListeners.delete(cb);
  }

  public onTableUpdate(cb: TableCallback) {
    this.tableListeners.add(cb);
    return () => this.tableListeners.delete(cb);
  }

  public onAlert(cb: AlertCallback) {
    this.alertListeners.add(cb);
    return () => this.alertListeners.delete(cb);
  }

  public getConnectionState(): signalR.HubConnectionState {
    return this.connection ? this.connection.state : signalR.HubConnectionState.Disconnected;
  }
}

export const signalRManager = new SignalRManager();
