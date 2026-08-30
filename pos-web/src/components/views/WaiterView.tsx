'use client';

import React, { useState, useEffect } from 'react';
import { TableItem, Order, Product } from '@/lib/types';
import { fetchTables, fetchActiveOrders, fetchProducts, submitOrder } from '@/lib/api';
import { signalRManager } from '@/lib/signalr';
import { playWaiterReadyAlert } from '@/lib/sound';
import { Bell, Users, Plus, Utensils, CheckCircle2, Clock, DollarSign, X, Sparkles } from 'lucide-react';
import { showSuccess, showError } from '@/lib/swal';
import confetti from 'canvas-confetti';

export default function WaiterView() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [readyAlerts, setReadyAlerts] = useState<{ id: number; orderNumber: string; tableNumber: string; timestamp: Date }[]>([]);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<TableItem | null>(null);
  const [orderCart, setOrderCart] = useState<{ productId: number; quantity: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();

    const unsubNewOrder = signalRManager.onNewOrder(order => {
      setActiveOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
      setTables(prev => prev.map(t => t.id === order.tableId ? { ...t, status: 'Occupied', currentOrderId: order.id } : t));
    });

    const unsubCooking = signalRManager.onCooking(order => {
      setActiveOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });

    // Side-effect from Kds.CompleteOrder: SignalR:waiterHub.NotifyReady
    const unsubReady = signalRManager.onReady(order => {
      setActiveOrders(prev => prev.map(o => o.id === order.id ? order : o));
      playWaiterReadyAlert();
      setReadyAlerts(prev => [
        { id: order.id, orderNumber: order.orderNumber, tableNumber: order.tableNumber, timestamp: new Date() },
        ...prev
      ]);
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.2 } });
    });

    const unsubPaid = signalRManager.onPaid(order => {
      setActiveOrders(prev => prev.filter(o => o.id !== order.id));
      setTables(prev => prev.map(t => t.id === order.tableId ? { ...t, status: 'Available', currentOrderId: null } : t));
      setReadyAlerts(prev => prev.filter(a => a.id !== order.id));
    });

    const unsubTable = signalRManager.onTableUpdate(tbl => {
      setTables(prev => prev.map(t => t.id === tbl.id ? tbl : t));
    });

    return () => {
      unsubNewOrder();
      unsubCooking();
      unsubReady();
      unsubPaid();
      unsubTable();
    };
  }, []);

  async function loadData() {
    const [tbls, orders, prods] = await Promise.all([
      fetchTables(),
      fetchActiveOrders(),
      fetchProducts()
    ]);
    setTables(tbls);
    setActiveOrders(orders);
    setProducts(prods);
  }

  function dismissAlert(id: number) {
    setReadyAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function handleTakeOrderSubmit() {
    if (!selectedTableForOrder || orderCart.length === 0) return;
    setIsSubmitting(true);
    try {
      await submitOrder({
        tableId: selectedTableForOrder.id,
        actor: 'Waiter',
        items: orderCart
      });
      setSelectedTableForOrder(null);
      setOrderCart([]);
      await loadData();
      showSuccess('บันทึกออเดอร์สำเร็จ', `ส่งออเดอร์โต๊ะ ${selectedTableForOrder.tableNumber} เข้าครัวแล้ว`);
    } catch (err: any) {
      showError('บันทึกออเดอร์ไม่สำเร็จ', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ color: 'var(--accent-blue)', width: 24, height: 24 }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>ระบบบริการ & ผังโต๊ะอาหาร (Floor Plan)</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            สถานะโต๊ะแบบสด, แจ้งเตือนอาหารพร้อมเสิร์ฟ และรับออเดอร์สำหรับพนักงานเสิร์ฟ
          </p>
        </div>

        {/* Ready Orders Counter */}
        {readyAlerts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', padding: '8px 16px' }}>
            <Bell style={{ width: 20, height: 20, color: 'var(--accent-emerald)', animation: 'bounce 1s infinite' }} />
            <span style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontSize: '0.9rem' }}>
              มีอาหารพร้อมเสิร์ฟ {readyAlerts.length} รายการ!
            </span>
          </div>
        )}
      </div>

      {/* Floating Ready Alerts Banner */}
      {readyAlerts.length > 0 && (
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {readyAlerts.map(alert => (
            <div
              key={alert.id}
              className="glass-panel"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Utensils style={{ color: '#fff', width: 20, height: 20 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
                    🍽️ ออเดอร์ #{alert.orderNumber} ปรุงเสร็จพร้อมเสิร์ฟ!
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                    ส่งไปที่: <strong>โต๊ะ {alert.tableNumber}</strong> • รับอาหารได้ที่เคาน์เตอร์ครัว
                  </div>
                </div>
              </div>

              <button
                onClick={() => dismissAlert(alert.id)}
                className="btn-success"
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                <CheckCircle2 style={{ width: 16, height: 16 }} /> เสิร์ฟเรียบร้อย
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Restaurant Floor Plan Grid */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>ผังโต๊ะอาหารทั้งหมด</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>(ทั้งหมด {tables.length} โต๊ะ)</span>
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px', marginBottom: '40px' }}>
        {tables.map(table => {
          const tableOrder = activeOrders.find(o => o.tableId === table.id && o.status !== 'PAID');
          const isReady = tableOrder?.status === 'READY';
          const isCooking = tableOrder?.status === 'COOKING';
          const isSubmitted = tableOrder?.status === 'SUBMITTED';

          return (
            <div
              key={table.id}
              className={`glass-panel glass-panel-hover ${isCooking ? 'ticket-cooking' : ''}`}
              style={{
                padding: '20px',
                border: isReady ? '2px solid var(--accent-emerald)' : undefined,
                background: isReady ? 'rgba(16, 185, 129, 0.1)' : undefined,
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>Table {table.tableNumber}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({table.seats}p)</span>
                </div>

                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: isReady
                      ? 'rgba(16, 185, 129, 0.25)'
                      : isCooking
                      ? 'rgba(245, 158, 11, 0.25)'
                      : isSubmitted
                      ? 'rgba(59, 130, 246, 0.25)'
                      : 'rgba(148, 163, 184, 0.15)',
                    color: isReady
                      ? '#34d399'
                      : isCooking
                      ? '#fbbf24'
                      : isSubmitted
                      ? '#60a5fa'
                      : '#94a3b8'
                  }}
                >
                  {isReady ? '✨ FOOD READY' : isCooking ? '🔥 COOKING' : isSubmitted ? '⏳ ORDERED' : 'VACANT'}
                </span>
              </div>

              {tableOrder ? (
                <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Active Order: <span style={{ color: '#fff', fontWeight: 600 }}>{tableOrder.orderNumber}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {tableOrder.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Bill:</span>
                    <span style={{ color: 'var(--accent-emerald)' }}>{tableOrder.grandยอดรวม.toLocaleString()} THB</span>
                  </div>
                </div>
              ) : (
                <div style={{ margin: '16px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Table is ready for new guests.
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={() => {
                    setSelectedTableForOrder(table);
                    setOrderCart([]);
                  }}
                  className="btn-secondary"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <Plus style={{ width: 14, height: 14 }} /> Take Order / Add Items
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Take Order Modal for Waiter */}
      {selectedTableForOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div className="glass-panel" style={{ maxWidth: '600px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Take Order for Table {selectedTableForOrder.tableNumber}
              </h2>
              <button onClick={() => setSelectedTableForOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X style={{ width: 22, height: 22 }} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {products.map(p => {
                  const inCart = orderCart.find(i => i.productId === p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setOrderCart(prev => {
                          const exist = prev.find(i => i.productId === p.id);
                          if (exist) {
                            return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
                          }
                          return [...prev, { productId: p.id, quantity: 1 }];
                        });
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: inCart ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: inCart ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>{p.price} THB</div>
                      </div>
                      {inCart && (
                        <span style={{ background: 'var(--accent-cyan)', color: '#000', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                          x{inCart.quantity}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Order Cart Summary */}
              {orderCart.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', marginTop: '10px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>Selected Items:</h4>
                  {orderCart.map(i => {
                    const prod = products.find(p => p.id === i.productId);
                    return (
                      <div key={i.productId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span>{i.quantity}x {prod?.name}</span>
                        <span>{((prod?.price || 0) * i.quantity).toLocaleString()} THB</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '18px 24px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedTableForOrder(null)} className="btn-secondary">
                ยกเลิก
              </button>
              <button
                onClick={handleTakeOrderSubmit}
                disabled={isSubmitting || orderCart.length === 0}
                className="btn-primary"
              >
                {isSubmitting ? 'Submitting...' : 'Send Order to Kitchen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

