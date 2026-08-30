'use client';

import React, { useState, useEffect } from 'react';
import { Order } from '@/lib/types';
import { fetchKdsQueue, acceptKdsOrder, completeKdsOrder } from '@/lib/api';
import { signalRManager } from '@/lib/signalr';
import { playKitchenNewOrderChime } from '@/lib/sound';
import { ChefHat, Flame, CheckCircle2, Clock, AlertTriangle, Filter, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { showSuccess, showError, showInfo } from '@/lib/swal';

export default function KdsView() {
  const [queue, setQueue] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SUBMITTED' | 'COOKING'>('ALL');

  useEffect(() => {
    loadQueue();

    // Timer tick every 1 second to update elapsed time badges accurately
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    // SignalR listeners
    const unsubNewOrder = signalRManager.onNewOrder(order => {
      setQueue(prev => {
        if (prev.some(o => o.id === order.id)) return prev;
        return [...prev, order];
      });
      playKitchenNewOrderChime();
    });

    const unsubCooking = signalRManager.onCooking(order => {
      setQueue(prev => prev.map(o => o.id === order.id ? order : o));
    });

    const unsubReady = signalRManager.onReady(order => {
      setQueue(prev => prev.filter(o => o.id !== order.id));
    });

    const unsubPaid = signalRManager.onPaid(order => {
      setQueue(prev => prev.filter(o => o.id !== order.id));
    });

    return () => {
      clearInterval(timer);
      unsubNewOrder();
      unsubCooking();
      unsubReady();
      unsubPaid();
    };
  }, []);

  async function loadQueue() {
    const data = await fetchKdsQueue();
    setQueue(data);
  }

  async function handleAccept(orderId: number) {
    try {
      const updated = await acceptKdsOrder(orderId);
      setQueue(prev => prev.map(o => o.id === orderId ? updated : o));
      showInfo('รับออเดอร์แล้ว', `กำลังปรุงออเดอร์ #${updated.orderNumber}`);
    } catch (err: any) {
      showError('ไม่สามารถรับออเดอร์ได้', err.message);
    }
  }

  async function handleComplete(orderId: number) {
    try {
      await completeKdsOrder(orderId);
      setQueue(prev => prev.filter(o => o.id !== orderId));
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
      showSuccess('ปรุงอาหารเสร็จแล้ว!', 'ส่งสัญญาณแจ้งเตือนพนักงานเสิร์ฟเรียบร้อย');
    } catch (err: any) {
      showError('ไม่สามารถจบออเดอร์ได้', err.message);
    }
  }

  function getElapsedTime(timestampStr?: string): { minutes: number; seconds: number; formatted: string } {
    if (!timestampStr) return { minutes: 0, seconds: 0, formatted: '00:00' };
    const diffMs = Math.max(0, currentTime - new Date(timestampStr).getTime());
    const totalSecs = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSecs / 60);
    const seconds = totalSecs % 60;
    return {
      minutes,
      seconds,
      formatted: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  }

  const filteredQueue = queue.filter(ord => {
    if (activeFilter === 'SUBMITTED') return ord.status === 'SUBMITTED';
    if (activeFilter === 'COOKING') return ord.status === 'COOKING';
    return true;
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* KDS Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat style={{ color: '#fff', width: 26, height: 26 }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>จอครัวดิจิทัล (Kitchen Display System)</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              คิวปรุงอาหารสำหรับเชฟ • ลำดับสถานะ (รอคิว ➔ กำลังปรุง ➔ ปรุงเสร็จ)
            </p>
          </div>
        </div>

        {/* สถานะ Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'ALL', label: `ทั้งหมด (${queue.length})` },
            { id: 'SUBMITTED', label: `รอคิวครัว (${queue.filter(q => q.status === 'SUBMITTED').length})` },
            { id: 'COOKING', label: `กำลังปรุง (${queue.filter(q => q.status === 'COOKING').length})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: activeFilter === f.id ? '1px solid var(--accent-amber)' : '1px solid var(--border-glass)',
                background: activeFilter === f.id ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.04)',
                color: activeFilter === f.id ? 'var(--accent-amber)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Grid */}
      {filteredQueue.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ChefHat style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            ไม่มีออเดอร์ค้างในครัว!
          </h3>
          <p style={{ fontSize: '0.9rem' }}>ปรุงอาหารและส่งมอบครบถ้วนแล้ว พร้อมรับออเดอร์ใหม่</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredQueue.map(order => {
            const isCooking = order.status === 'COOKING';
            const { minutes, formatted } = getElapsedTime(order.submittedAt || order.createdAt);

            // Timer color scheme: Green (<5m), Amber (5-10m), Red (>10m)
            const timerColor = minutes < 5 ? '#10b981' : minutes < 10 ? '#f59e0b' : '#f43f5e';
            const timerBg = minutes < 5 ? 'rgba(16, 185, 129, 0.15)' : minutes < 10 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(244, 63, 94, 0.15)';

            return (
              <div
                key={order.id}
                className={`glass-panel ${isCooking ? 'ticket-cooking' : ''}`}
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `4px solid ${isCooking ? 'var(--accent-amber)' : 'var(--accent-cyan)'}`
                }}
              >
                {/* Ticket Top Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                      โต๊ะ {order.tableNumber || `T-${order.id}`}
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      #{order.orderNumber}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: timerBg, border: `1px solid ${timerColor}40`, padding: '4px 10px', borderRadius: '12px' }}>
                    <Clock style={{ width: 14, height: 14, color: timerColor }} />
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: timerColor, fontFamily: 'var(--font-mono)' }}>
                      {formatted}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div style={{ flex: 1, borderTop: '1px dashed var(--border-glass)', borderBottom: '1px dashed var(--border-glass)', padding: '12px 0', marginBottom: '16px' }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                          {item.quantity}x
                        </span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                          {item.productName}
                        </span>
                      </div>
                      {item.specialInstructions && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', marginLeft: '26px', marginTop: '2px', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '6px', display: 'inline-block' }}>
                          ⚠️ หมายเหตุ: {item.specialInstructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Transition Action Button */}
                {order.status === 'SUBMITTED' ? (
                  <button
                    onClick={() => handleAccept(order.id)}
                    className="btn-primary"
                    style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}
                  >
                    <Flame style={{ width: 18, height: 18 }} />
                    <span>🔥 รับออเดอร์ & เริ่มปรุง</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleComplete(order.id)}
                    className="btn-success"
                    style={{ width: '100%', padding: '12px' }}
                  >
                    <CheckCircle2 style={{ width: 18, height: 18 }} />
                    <span>✨ ปรุงเสร็จ • ส่งให้พนักงานเสิร์ฟ</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

