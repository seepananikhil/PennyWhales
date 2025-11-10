import React, { useState, useEffect } from 'react';
import { theme } from './theme';
import api from './api';
import { MdDelete, MdDeleteForever } from 'react-icons/md';

interface Alert {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'above' | 'below';
  active: boolean;
  triggered: boolean;
  created: string;
  triggeredAt?: string;
  triggeredPrice?: number;
}

interface StockData {
  ticker: string;
  price: number;
  priceChange?: number;
  fire_level?: number;
  blackrock_pct?: number;
  vanguard_pct?: number;
}

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stockData, setStockData] = useState<{ [ticker: string]: StockData }>({});
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'triggered'>('active');

  useEffect(() => {
    loadAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await api.getAlerts();
      setAlerts(response.alerts);
      
      // Load stock data for all unique tickers
      const tickers = Array.from(new Set(response.alerts.map((a: Alert) => a.ticker)));
      const stockDataMap: { [ticker: string]: StockData } = {};
      
      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const data = await api.getLivePrice(ticker);
            stockDataMap[ticker] = data;
          } catch (error) {
            console.error(`Error loading data for ${ticker}:`, error);
          }
        })
      );
      
      setStockData(stockDataMap);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await api.deleteAlert(alertId);
      await loadAlerts();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleDeleteClick = (alertId: string) => {
    if (deleteConfirm === alertId) {
      handleDeleteAlert(alertId);
    } else {
      setDeleteConfirm(alertId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const activeAlerts = alerts.filter(a => a.active && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered).sort((a, b) => 
    new Date(b.triggeredAt || b.created).getTime() - new Date(a.triggeredAt || a.created).getTime()
  );

  const displayAlerts = activeTab === 'active' ? activeAlerts : triggeredAlerts;

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <div style={{ marginTop: '12px', color: '#666' }}>Loading alerts...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '24px',
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      overflowY: 'auto',
      height: '100vh'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <h1 style={{ color: '#4F46E5', fontSize: '2rem', margin: 0 }}>
          🔔 Price Alerts
        </h1>
        <button
          onClick={loadAlerts}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: theme.borderRadius.md,
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3730a3'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px',
        borderBottom: `2px solid ${theme.ui.border}`
      }}>
        <button
          onClick={() => setActiveTab('active')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: activeTab === 'active' ? '#4F46E5' : '#666',
            border: 'none',
            borderBottom: activeTab === 'active' ? '3px solid #4F46E5' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          🟢 Active ({activeAlerts.length})
        </button>
        <button
          onClick={() => setActiveTab('triggered')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: activeTab === 'triggered' ? '#4F46E5' : '#666',
            border: 'none',
            borderBottom: activeTab === 'triggered' ? '3px solid #4F46E5' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            transition: 'all 0.2s',
            marginBottom: '-2px'
          }}
        >
          🔴 Triggered ({triggeredAlerts.length})
        </button>
      </div>

      {/* Alerts List */}
      {displayAlerts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          backgroundColor: '#f8f9fa',
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.ui.border}`
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '24px' }}>
            {activeTab === 'active' ? '📭' : '🔕'}
          </div>
          <div style={{ fontSize: '1.5rem', color: '#333', marginBottom: '12px', fontWeight: '600' }}>
            {activeTab === 'active' ? 'No Active Alerts' : 'No Triggered Alerts'}
          </div>
          <div style={{ fontSize: '1rem', color: '#666' }}>
            {activeTab === 'active' 
              ? 'Create alerts by clicking the bell icon on any stock card'
              : 'Triggered alerts will appear here when price targets are hit'}
          </div>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {displayAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                backgroundColor: 'white',
                padding: '24px',
                borderRadius: theme.borderRadius.lg,
                border: `2px solid ${alert.triggered ? '#28a745' : '#4F46E5'}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '2rem' }}>
                    {alert.condition === 'above' ? '⬆️' : '⬇️'}
                  </span>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
                      {alert.ticker}
                    </div>
                    {alert.triggered && (
                      <span style={{
                        fontSize: '0.75rem',
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        TRIGGERED
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClick(alert.id)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: deleteConfirm === alert.id ? '#b02a37' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  title={deleteConfirm === alert.id ? 'Click again to confirm' : 'Delete alert'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {deleteConfirm === alert.id ? MdDeleteForever({}) : MdDelete({})}
                </button>
              </div>

              {/* Alert Details */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${theme.ui.border}`
              }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>
                  Target Price
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4F46E5' }}>
                  ${alert.targetPrice.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                  {alert.condition === 'above' ? 'When price goes above' : 'When price drops below'}
                </div>
              </div>

              {/* Triggered Info */}
              {alert.triggered && alert.triggeredAt && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#d4edda',
                  borderRadius: theme.borderRadius.md,
                  border: '1px solid #c3e6cb'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#155724', fontWeight: '600', marginBottom: '4px' }}>
                    ✅ TRIGGERED
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#155724' }}>
                    {new Date(alert.triggeredAt).toLocaleString()}
                  </div>
                  {alert.triggeredPrice && (
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#155724', marginTop: '4px' }}>
                      Price: ${alert.triggeredPrice.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {/* Created Date */}
              {!alert.triggered && (
                <div style={{ 
                  fontSize: '0.8rem', 
                  color: '#999',
                  borderTop: `1px solid ${theme.ui.border}`,
                  paddingTop: '12px'
                }}>
                  Created: {new Date(alert.created).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginTop: '32px'
      }}>
        <div style={{
          padding: '24px',
          backgroundColor: '#e3f2fd',
          borderRadius: theme.borderRadius.lg,
          textAlign: 'center',
          border: '2px solid #90caf9',
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1976d2' }}>
            {activeAlerts.length}
          </div>
          <div style={{ fontSize: '1rem', color: '#0d47a1', marginTop: '8px', fontWeight: '600' }}>
            🟢 Active Alerts
          </div>
        </div>
        <div style={{
          padding: '24px',
          backgroundColor: '#e8f5e9',
          borderRadius: theme.borderRadius.lg,
          textAlign: 'center',
          border: '2px solid #81c784',
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#388e3c' }}>
            {triggeredAlerts.length}
          </div>
          <div style={{ fontSize: '1rem', color: '#1b5e20', marginTop: '8px', fontWeight: '600' }}>
            🔴 Triggered Alerts
          </div>
        </div>
        <div style={{
          padding: '24px',
          backgroundColor: '#f3e5f5',
          borderRadius: theme.borderRadius.lg,
          textAlign: 'center',
          border: '2px solid #ce93d8',
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#7b1fa2' }}>
            {alerts.length}
          </div>
          <div style={{ fontSize: '1rem', color: '#4a148c', marginTop: '8px', fontWeight: '600' }}>
            📊 Total Alerts
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
