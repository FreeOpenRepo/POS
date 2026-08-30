'use client';

import React, { useState, useEffect } from 'react';
import { ActorRole } from '@/lib/types';
import { signalRManager } from '@/lib/signalr';
import { syncOfflineQueue } from '@/lib/api';
import GuestView from '@/components/views/GuestView';
import WaiterView from '@/components/views/WaiterView';
import KdsView from '@/components/views/KdsView';
import CashierView from '@/components/views/CashierView';
import { Sparkles, ChefHat, Users, Banknote, UtensilsCrossed, Wifi, WifiOff, RefreshCw, Volume2 } from 'lucide-react';
import { showSuccess, showInfo, showError } from '@/lib/swal';

export default function Home() {
  const [activeRole, setActiveRole] = useState<ActorRole>('Cashier');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncCount, setSyncCount] = useState<number>(0);

  useEffect(() => {
    // Connect to SignalR pos hub
    signalRManager.connect().then(conn => {
      if (conn) {
        setIsConnected(true);
      }
    });

    const interval = setInterval(() => {
      const state = signalRManager.getConnectionState();
      setIsConnected(state === 'Connected');
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  async function handleManualSync() {
    setIsSyncing(true);
    try {
      const count = await syncOfflineQueue();
      setSyncCount(count);
      if (count > 0) {
        showSuccess('Sync สำเร็จ', `ซิงค์ออเดอร์ออฟไลน์ ${count} รายการขึ้นสู่เซิร์ฟเวอร์เรียบร้อยแล้ว`);
      } else {
        showInfo('ข้อมูลเป็นปัจจุบัน', 'ไม่มีรายการออฟไลน์ที่รอซิงค์');
      }
    } catch (err: any) {
      showError('ซิงค์ไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar & Role Switcher */}
      <header
        style={{
          background: 'rgba(10, 13, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-glass)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          padding: '12px 24px'
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Logo & System Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.4)'
            }}>
              <UtensilsCrossed style={{ color: '#fff', width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ARTISAN <span style={{ color: 'var(--accent-cyan)' }}>POS</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                01_POS_KDS_ENGINE
              </div>
            </div>
          </div>

          {/* Actor Role Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-glass)',
            padding: '4px',
            borderRadius: '14px',
            gap: '4px'
          }}>
            {[
              { role: 'Guest' as const, label: 'Guest Menu', icon: Sparkles, color: 'var(--accent-cyan)' },
              { role: 'Waiter' as const, label: 'Waiter Floor', icon: Users, color: 'var(--accent-blue)' },
              { role: 'KitchenChef' as const, label: 'Kitchen (KDS)', icon: ChefHat, color: 'var(--accent-amber)' },
              { role: 'Cashier' as const, label: 'Cashier POS', icon: Banknote, color: 'var(--accent-emerald)' },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeRole === tab.role;
              return (
                <button
                  key={tab.role}
                  onClick={() => setActiveRole(tab.role)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color: isActive ? tab.color : 'inherit' }} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Live Status Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* SignalR Connection State */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: isConnected ? '#34d399' : '#fca5a5'
            }}>
              {isConnected ? <Wifi style={{ width: 12, height: 12 }} /> : <WifiOff style={{ width: 12, height: 12 }} />}
              <span>{isConnected ? 'SignalR WSS Live' : 'Connecting API...'}</span>
            </div>

            {/* Offline Sync Trigger */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Dexie.js Offline Storage & Sync Queue"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)',
                borderRadius: '10px',
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw style={{ width: 12, height: 12, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              <span>Dexie Offline Store</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Role Content View */}
      <div style={{ flex: 1, padding: '16px' }}>
        {activeRole === 'Guest' && <GuestView />}
        {activeRole === 'Waiter' && <WaiterView />}
        {activeRole === 'KitchenChef' && <KdsView />}
        {activeRole === 'Cashier' && <CashierView />}
      </div>
    </main>
  );
}
