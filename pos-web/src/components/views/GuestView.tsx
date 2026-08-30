'use client';

import React, { useState, useEffect } from 'react';
import { Product, TableItem, Order, CartItem } from '@/lib/types';
import { fetchProducts, fetchTables, submitOrder, fetchActiveOrders } from '@/lib/api';
import { signalRManager } from '@/lib/signalr';
import { ShoppingBag, CheckCircle2, UtensilsCrossed, Clock, Flame, Sparkles, X, Plus, Minus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { showSuccess, showError, showWarning } from '@/lib/swal';

export default function GuestView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductModal, setSelectedProductModal] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalNotes, setModalNotes] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    loadData();

    // SignalR live updates
    const unsubNewOrder = signalRManager.onNewOrder(order => {
      if (selectedTable && order.tableId === selectedTable.id) {
        setActiveOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
      }
    });

    const unsubCooking = signalRManager.onCooking(order => {
      setActiveOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });

    const unsubReady = signalRManager.onReady(order => {
      setActiveOrders(prev => prev.map(o => o.id === order.id ? order : o));
      if (selectedTable && order.tableId === selectedTable.id) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }
    });

    const unsubPaid = signalRManager.onPaid(order => {
      setActiveOrders(prev => prev.filter(o => o.id !== order.id));
    });

    return () => {
      unsubNewOrder();
      unsubCooking();
      unsubReady();
      unsubPaid();
    };
  }, [selectedTable]);

  async function loadData() {
    const [prods, tbls, orders] = await Promise.all([
      fetchProducts(),
      fetchTables(),
      fetchActiveOrders()
    ]);
    setProducts(prods);
    setTables(tbls);
    if (!selectedTable && tbls.length > 0) {
      setSelectedTable(tbls[0]);
    }
    setActiveOrders(orders);
  }

  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'FOOD') return p.category === 0 || p.category === 'Food';
    if (selectedCategory === 'BEVERAGE') return p.category === 1 || p.category === 'Beverage';
    if (selectedCategory === 'DESSERT') return p.category === 2 || p.category === 'Dessert';
    return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product, quantity = 1, notes = '') {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.specialInstructions === notes);
      if (existing) {
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { product, quantity, specialInstructions: notes }];
    });
    setSelectedProductModal(null);
    setModalQuantity(1);
    setModalNotes('');
  }

  function updateCartQuantity(index: number, delta: number) {
    setCart(prev => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index].quantity = newQty;
      }
      return copy;
    });
  }

  async function handleCheckout() {
    if (!selectedTable || cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = {
        tableId: selectedTable.id,
        actor: 'Guest' as const,
        items: cart.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions
        }))
      };

      const order = await submitOrder(payload);
      setCart([]);
      setIsCartOpen(false);
      setActiveOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      showSuccess('ส่งออเดอร์สำเร็จ!', `ออเดอร์ #${order.orderNumber} ถูกส่งไปยังห้องครัวเรียบร้อยแล้ว`);
    } catch (err: any) {
      showError('ส่งออเดอร์ไม่สำเร็จ', err.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  }

  const tableOrders = selectedTable
    ? activeOrders.filter(o => o.tableId === selectedTable.id && o.status !== 'PAID')
    : [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Header & Table Selector */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles style={{ color: 'var(--accent-cyan)', width: 22, height: 22 }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              เมนูดิจิทัล & สั่งอาหารที่โต๊ะ (Self-Order)
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            เลือกชมเมนูอาหารและเครื่องดื่ม สั่งออเดอร์ตรงถึงครัว พร้อมติดตามสถานะการปรุงแบบเรียลไทม์
          </p>
        </div>

        {/* Table Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>โต๊ะที่นั่ง:</span>
          <select
            value={selectedTable?.id || ''}
            onChange={e => {
              const t = tables.find(tbl => tbl.id === Number(e.target.value));
              if (t) setSelectedTable(t);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border: '1px solid var(--border-glass-bright)',
              borderRadius: '10px',
              padding: '8px 14px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {tables.map(t => (
              <option key={t.id} value={t.id} style={{ background: '#121826', color: '#fff' }}>
                โต๊ะ {t.tableNumber} ({t.seats} ที่นั่ง)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Orders Tracker for this Table */}
      {tableOrders.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock style={{ width: 18, height: 18, color: 'var(--accent-cyan)' }} />
              สถานะออเดอร์ของโต๊ะ ({selectedTable?.tableNumber})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>สัญญาณสด SIGNALR</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {tableOrders.map(ord => (
              <div key={ord.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>ออเดอร์ #{ord.orderNumber}</span>
                  <span
                    className={`badge-${ord.status.toLowerCase()}`}
                    style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    {ord.status === 'SUBMITTED' && '⏳ กำลังรอคิวครัว'}
                    {ord.status === 'COOKING' && '🔥 เชฟกำลังปรุง'}
                    {ord.status === 'READY' && '✨ ปรุงเสร็จพร้อมเสิร์ฟ!'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {ord.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-muted)' }}>ยอดรวม:</span>
                  <span style={{ color: 'var(--accent-emerald)' }}>{ord.grandTotal.toLocaleString()} บาท</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'ALL', label: '✨ เมนูทั้งหมด' },
          { id: 'FOOD', label: '🍔 อาหารจานหลัก' },
          { id: 'BEVERAGE', label: '☕ เครื่องดื่มพิเศษ' },
          { id: 'DESSERT', label: '🍰 ขนมหวาน & เบเกอรี่' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '24px',
              border: selectedCategory === cat.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
              background: selectedCategory === cat.id ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '80px' }}>
        {filteredProducts.map(product => (
          <div
            key={product.id}
            className="glass-panel glass-panel-hover"
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ height: '180px', position: 'relative', overflow: 'hidden' }}>
              <img
                src={product.imageUrl}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
              />
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(10, 13, 20, 0.85)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'var(--accent-emerald)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                {product.price.toLocaleString()} THB
              </div>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>{product.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.4', marginBottom: '14px' }}>
                  {product.description}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    setSelectedProductModal(product);
                    setModalQuantity(1);
                    setModalNotes('');
                  }}
                  className="btn-primary"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <Plus style={{ width: 16, height: 16 }} /> Add to Order
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, width: '90%', maxWidth: '500px' }}>
          <button
            onClick={() => setIsCartOpen(true)}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 10px 30px rgba(6, 182, 212, 0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingBag style={{ width: 22, height: 22 }} />
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>ตะกร้าสินค้า ({cartItemCount} รายการ)</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              {cartTotal.toLocaleString()} บาท →
            </div>
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', overflow: 'hidden', border: '1px solid var(--border-glass-bright)' }}>
            <div style={{ height: '200px', position: 'relative' }}>
              <img src={selectedProductModal.imageUrl} alt={selectedProductModal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => setSelectedProductModal(null)}
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>{selectedProductModal.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>{selectedProductModal.description}</p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>หมายเหตุพิเศษ / การแพ้อาหาร:</label>
                <input
                  type="text"
                  placeholder="เช่น ไม่หวาน, เพิ่มซอส, ไม่ใส่ผัก..."
                  value={modalNotes}
                  onChange={e => setModalNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>จำนวน</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button
                    onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                    style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-glass)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Minus style={{ width: 16, height: 16 }} />
                  </button>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', minWidth: '24px', textAlign: 'center' }}>{modalQuantity}</span>
                  <button
                    onClick={() => setModalQuantity(q => q + 1)}
                    style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-glass)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Plus style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>

              <button
                onClick={() => addToCart(selectedProductModal, modalQuantity, modalNotes)}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }}
              >
                เพิ่ม {modalQuantity} รายการลงตะกร้า • {(selectedProductModal.price * modalQuantity).toLocaleString()} บาท
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-glass-bright)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag style={{ color: 'var(--accent-cyan)', width: 22, height: 22 }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>ตะกร้าสั่งอาหาร</h2>
              </div>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X style={{ width: 22, height: 22 }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ background: 'rgba(6,182,212,0.08)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                📍 โต๊ะที่สั่ง: <strong>โต๊ะ {selectedTable?.tableNumber}</strong>
              </div>

              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-glass)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.product.price} บาท/ชิ้น
                      {item.specialInstructions && ` • "${item.specialInstructions}"`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => updateCartQuantity(idx, -1)}
                      style={{ width: 28, height: 28, borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Minus style={{ width: 14, height: 14 }} />
                    </button>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(idx, 1)}
                      style={{ width: 28, height: 28, borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>ราคารวมสินค้า</span>
                <span>{cartTotal.toLocaleString()} บาท</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>ภาษีมูลค่าเพิ่ม VAT 7%</span>
                <span>{(cartTotal * 0.07).toFixed(2)} บาท</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="btn-success"
                style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 700 }}
              >
                {isSubmitting ? 'Sending to Kitchen...' : `Submit Order (Table ${selectedTable?.tableNumber})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


