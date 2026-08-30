'use client';

import React, { useState, useEffect } from 'react';
import { Order, PaymentMethod, Ingredient, TableItem } from '@/lib/types';
import { fetchActiveOrders, fetchTables, settlePayment, fetchInventory, adjustInventoryStock } from '@/lib/api';
import { signalRManager } from '@/lib/signalr';
import { playPaymentSuccessSound } from '@/lib/sound';
import { printViaWebBluetooth, base64ToUint8Array } from '@/lib/escpos';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Banknote, CreditCard, QrCode, Printer, CheckCircle2, Clock, 
  AlertCircle, DollarSign, Package, RefreshCw, X, Receipt, 
  ArrowRight, ShieldCheck, Sparkles, Bluetooth 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { showSuccess, showError, showInfo } from '@/lib/swal';

export default function CashierView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [inventory, setInventory] = useState<Ingredient[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Payment Modal State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [txnRef, setTxnRef] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Completed Receipt Modal State
  const [receiptData, setReceiptData] = useState<{ order: Order; payment: any; receiptText: string; escposBase64: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'INVENTORY'>('REGISTER');

  useEffect(() => {
    loadData();

    const unsubNewOrder = signalRManager.onNewOrder(order => {
      setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
    });

    const unsubReady = signalRManager.onReady(order => {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    });

    const unsubPaid = signalRManager.onPaid(order => {
      setOrders(prev => prev.filter(o => o.id !== order.id));
      loadInventory(); // Refresh BOM stock after deduction
    });

    return () => {
      unsubNewOrder();
      unsubReady();
      unsubPaid();
    };
  }, []);

  async function loadData() {
    const [ordList, tblList, invList] = await Promise.all([
      fetchActiveOrders(),
      fetchTables(),
      fetchInventory()
    ]);
    setOrders(ordList);
    setTables(tblList);
    setInventory(invList);
  }

  async function loadInventory() {
    const inv = await fetchInventory();
    setInventory(inv);
  }

  function handleSelectOrderForSettlement(order: Order) {
    setSelectedOrder(order);
    setAmountTendered(order.grandยอดรวม);
    setPaymentMethod('CASH');
    setTxnRef('');
    setErrorMessage(null);
  }

  async function handleSettlePayment() {
    if (!selectedOrder) return;
    if (amountTendered < selectedOrder.grandยอดรวม) {
      setErrorMessage(`Amount tendered (${amountTendered} THB) is less than total due (${selectedOrder.grandยอดรวม} THB).`);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Transition 4: READY -> PAID (Trigger: SETTLE_BILL)
      // Side-effects: BOM.DeductStock & ThermalPrint.PrintReceipt
      const result = await settlePayment({
        orderId: selectedOrder.id,
        method: paymentMethod,
        amountPaid: amountTendered,
        transactionReference: txnRef || undefined
      });

      playPaymentSuccessSound();
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });

      setReceiptData(result);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Settlement failed.');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBluetoothPrint() {
    if (!receiptData?.escposBase64) return;
    try {
      const bytes = base64ToUint8Array(receiptData.escposBase64);
      await printViaWebBluetooth(bytes);
      showSuccess('พิมพ์สำเร็จ', 'ส่งใบเสร็จไปยังเครื่องพิมพ์เทอร์มอล Bluetooth เรียบร้อยแล้ว');
    } catch (err: any) {
      showError('การพิมพ์ขัดข้อง', err.message);
    }
  }

  function handleDownloadRawEscPos() {
    if (!receiptData?.escposBase64) return;
    const bytes = base64ToUint8Array(receiptData.escposBase64);
    const blob = new Blob([bytes as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${receiptData.order.orderNumber}.bin`;
    a.click();
    URL.revokeObjectURL(url);
    showInfo('ดาวน์โหลดเสร็จสิ้น', `บันทึกไฟล์ Binary ESC/POS สำหรับเครื่องพิมพ์ Thermal แล้ว`);
  }

  async function handleRestock(ingredientId: number, qty: number) {
    try {
      await adjustInventoryStock(ingredientId, qty, 'Manual Restock');
      await loadInventory();
      showSuccess('เติมสต็อกสำเร็จ', `เพิ่มวัตถุดิบ ${qty} หน่วยเรียบร้อยแล้ว`);
    } catch (err: any) {
      showError('เติมสต็อกไม่สำเร็จ', err.message);
    }
  }

  const changeDue = selectedOrder ? Math.max(0, amountTendered - selectedOrder.grandยอดรวม) : 0;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Header & Tabs */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Banknote style={{ color: 'var(--accent-emerald)', width: 26, height: 26 }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>แคชเชียร์รับชำระเงิน & ออกใบเสร็จ (Cashier POS)</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            รับชำระเงินหลายช่องทาง • ตัดสต็อกวัตถุดิบอัตโนมัติตามสูตร BOM • สั่งพิมพ์สลิป ESC/POS Thermal
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('REGISTER')}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: activeTab === 'REGISTER' ? '1px solid var(--accent-emerald)' : '1px solid var(--border-glass)',
              background: activeTab === 'REGISTER' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'REGISTER' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Banknote style={{ width: 16, height: 16 }} /> เครื่องคิดเงิน POS ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('INVENTORY')}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: activeTab === 'INVENTORY' ? '1px solid var(--accent-purple)' : '1px solid var(--border-glass)',
              background: activeTab === 'INVENTORY' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'INVENTORY' ? 'var(--accent-purple)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Package style={{ width: 16, height: 16 }} /> ตรวจสอบสต็อกวัตถุดิบ BOM ({inventory.length})
          </button>
        </div>
      </div>

      {activeTab === 'REGISTER' ? (
        /* Register Layout: Order Grid */
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>
            รายการบิลที่รอชำระเงิน
          </h2>

          {orders.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle2 style={{ width: 44, height: 44, margin: '0 auto 16px', opacity: 0.5, color: 'var(--accent-emerald)' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                ชำระเงินครบถ้วนแล้วทุกบิล
              </h3>
              <p style={{ fontSize: '0.9rem' }}>ไม่มีบิลค้างชำระในระบบขณะนี้</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {orders.map(order => {
                const isReady = order.status === 'READY';
                return (
                  <div
                    key={order.id}
                    className="glass-panel glass-panel-hover"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      border: isReady ? '2px solid var(--accent-emerald)' : '1px solid var(--border-glass)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>Table {order.tableNumber}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.orderNumber}</div>
                      </div>

                      <span
                        className={`badge-${order.status.toLowerCase()}`}
                        style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        {order.status}
                      </span>
                    </div>

                    {/* Order Line Items */}
                    <div style={{ flex: 1, margin: '12px 0', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px' }}>
                      {order.items.map((i, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                          <span>{i.quantity}x {i.productName}</span>
                          <span style={{ fontWeight: 600 }}>{(i.unitPrice * i.quantity).toLocaleString()} THB</span>
                        </div>
                      ))}

                      <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '8px', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>Subtotal:</span>
                          <span>{order.subtotal.toLocaleString()} THB</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>VAT (7% Incl.):</span>
                          <span>{order.taxAmount.toFixed(2)} THB</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, marginTop: '4px' }}>
                          <span>ยอดรวม Due:</span>
                          <span style={{ color: 'var(--accent-emerald)' }}>{order.grandยอดรวม.toLocaleString()} THB</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectOrderForSettlement(order)}
                      className="btn-success"
                      style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                    >
                      <Banknote style={{ width: 18, height: 18 }} /> Settle Bill & Print
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Inventory BOM Stock Inspector */
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>BOM Raw Ingredients & Inventory</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Guaranteed Invariant: <strong style={{ color: 'var(--accent-cyan)' }}>StockCannotBeNegative</strong>. Stock automatically decrements upon settlement.
              </p>
            </div>
            <button onClick={loadInventory} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
              <RefreshCw style={{ width: 14, height: 14 }} /> Refresh Stock
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass-bright)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>ID</th>
                  <th style={{ padding: '12px 16px' }}>Ingredient Name</th>
                  <th style={{ padding: '12px 16px' }}>Current Stock</th>
                  <th style={{ padding: '12px 16px' }}>Min. Threshold</th>
                  <th style={{ padding: '12px 16px' }}>Unit Cost</th>
                  <th style={{ padding: '12px 16px' }}>สถานะ</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Quick Restock</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => {
                  const isLow = item.currentStock <= item.minimumThreshold;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>#{item.id}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: '1rem', color: isLow ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                        {item.currentStock}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{item.minimumThreshold}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{item.costPerUnit} THB</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isLow ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: isLow ? 'var(--accent-rose)' : 'var(--accent-emerald)'
                        }}>
                          {isLow ? '⚠️ LOW STOCK' : '✅ HEALTHY'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleRestock(item.id, 20)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            +20
                          </button>
                          <button
                            onClick={() => handleRestock(item.id, 50)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            +50
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settle Payment Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', overflow: 'hidden', border: '1px solid var(--border-glass-bright)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Settle Payment (Table {selectedOrder.tableNumber})</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Order #{selectedOrder.orderNumber}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X style={{ width: 22, height: 22 }} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {errorMessage && (
                <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: '10px', padding: '12px', marginBottom: '16px', color: '#fca5a5', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ยอดรวม Due Banner */}
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount Due</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                  {selectedOrder.grandยอดรวม.toLocaleString()} THB
                </div>
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Payment Method:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'CASH', label: 'Cash', icon: Banknote },
                    { id: 'PROMPTPAY_QR', label: 'PromptPay', icon: QrCode },
                    { id: 'CREDIT_CARD', label: 'Card', icon: CreditCard },
                  ].map(m => {
                    const Icon = m.icon;
                    const isSel = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as any);
                          if (m.id === 'PROMPTPAY_QR' || m.id === 'CREDIT_CARD') {
                            setAmountTendered(selectedOrder.grandยอดรวม);
                          }
                        }}
                        style={{
                          padding: '12px 8px',
                          borderRadius: '10px',
                          border: isSel ? '1px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                          background: isSel ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.04)',
                          color: isSel ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}
                      >
                        <Icon style={{ width: 20, height: 20 }} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Method-Specific Input */}
              {paymentMethod === 'CASH' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Amount Tendered (THB):</label>
                  <input
                    type="number"
                    value={amountTendered || ''}
                    onChange={e => setAmountTendered(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}
                  />

                  {/* Fast denomination buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {[
                      { label: 'Exact', val: selectedOrder.grandยอดรวม },
                      { label: '500฿', val: 500 },
                      { label: '1,000฿', val: 1000 },
                      { label: '2,000฿', val: 2000 },
                    ].map((den, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAmountTendered(den.val)}
                        className="btn-secondary"
                        style={{ flex: 1, padding: '8px', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        {den.label}
                      </button>
                    ))}
                  </div>

                  {/* Change Calculation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Change Due:</span>
                    <span style={{ fontWeight: 800, color: changeDue >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                      {changeDue.toLocaleString()} THB
                    </span>
                  </div>
                </div>
              )}

              {paymentMethod === 'PROMPTPAY_QR' && (
                <div style={{ textAlign: 'center', padding: '10px' }}>
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '12px' }}>
                    <QRCodeSVG
                      value={`00020101021229370016A000000677010111011300668999988885802TH5303764540${selectedOrder.grandยอดรวม.toFixed(2)}6304`}
                      size={180}
                      level="H"
                    />
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Scan with any Thai Banking App to pay <strong>{selectedOrder.grandยอดรวม.toLocaleString()} THB</strong>
                  </p>
                </div>
              )}

              {paymentMethod === 'CREDIT_CARD' && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>EDC Slip / Card Ref:</label>
                  <input
                    type="text"
                    placeholder="e.g. CARD-XXXX-9872"
                    value={txnRef}
                    onChange={e => setTxnRef(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.95rem' }}
                  />
                </div>
              )}

              <button
                onClick={handleSettlePayment}
                disabled={isProcessing}
                className="btn-success"
                style={{ width: '100%', padding: '16px', marginTop: '20px', fontSize: '1.05rem', fontWeight: 800 }}
              >
                {isProcessing ? 'Processing & Printing...' : `Complete Settlement (${selectedOrder.grandยอดรวม.toLocaleString()} THB)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed ESC/POS Thermal Receipt Modal */}
      {receiptData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }}>
          <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer style={{ color: 'var(--accent-emerald)', width: 22, height: 22 }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Payment Settled & ESC/POS Receipt</h2>
              </div>
              <button onClick={() => setReceiptData(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X style={{ width: 22, height: 22 }} />
              </button>
            </div>

            {/* Receipt Preview */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc', color: '#0f172a', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'pre', lineHeight: '1.3' }}>
              {receiptData.receiptText}
            </div>

            {/* Action Buttons */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleBluetoothPrint}
                className="btn-primary"
                style={{ flex: 1, fontSize: '0.85rem' }}
              >
                <Printer style={{ width: 16, height: 16 }} /> Web Bluetooth Print
              </button>

              <button
                onClick={handleDownloadRawEscPos}
                className="btn-secondary"
                style={{ flex: 1, fontSize: '0.85rem' }}
              >
                <FileText style={{ width: 16, height: 16 }} /> Download .bin
              </button>

              <button
                onClick={() => setReceiptData(null)}
                className="btn-secondary"
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                Done / Next Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

