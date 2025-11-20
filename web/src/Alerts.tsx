import React, { useState, useEffect } from 'react';
import { theme } from './theme';
import api from './api';
import { Stock } from './types';
import AlertChartView from './components/AlertChartView';

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
  fire_level?: number;
  blackrock_pct?: number;
  vanguard_pct?: number;
  market_cap?: number;
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
  const [stockData, setStockData] = useState<Map<string, Stock>>(new Map());
  const [livePriceData, setLivePriceData] = useState<Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>>(new Map());
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
      
      // Get unique tickers from alerts
      const tickers = Array.from(new Set(response.alerts.map((a: Alert) => a.ticker)));
      const stockDataMap = new Map<string, Stock>();
      const livePriceMap = new Map<string, { price: number; priceChange: number; timestamp: string }>();
      
      // Fetch live prices and build stock data from enriched alerts
      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            // Get live price data
            const livePrice = await api.getLivePrice(ticker);
            
            // Find alert for this ticker to get enriched data
            const alertData = response.alerts.find((a: Alert) => a.ticker === ticker);
            
            // Create Stock object using enriched alert data
            const stock: Stock = {
              ticker: ticker,
              price: livePrice.price,
              fire_level: alertData?.fire_level || 0,
              blackrock_pct: alertData?.blackrock_pct || 0,
              vanguard_pct: alertData?.vanguard_pct || 0,
              market_cap: alertData?.market_cap,
              blackrock_source: '',
              vanguard_source: '',
              data_quality: '',
              sources_count: 0,
              discrepancy: false,
              notes: '',
            };
            
            stockDataMap.set(ticker, stock);
            livePriceMap.set(ticker, {
              price: livePrice.price,
              priceChange: livePrice.priceChange || 0,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error(`Error loading data for ${ticker}:`, error);
          }
        })
      );
      
      setStockData(stockDataMap);
      setLivePriceData(livePriceMap);
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
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: theme.typography.fontFamily
    }}>
      {/* Header Section */}
      <div style={{
        padding: theme.spacing.lg,
        borderBottom: `1px solid ${theme.ui.border}`,
        backgroundColor: theme.ui.surface,
        flexShrink: 0
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: theme.spacing.md,
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h1 style={{ 
            margin: 0,
            fontSize: theme.typography.fontSize.xxl,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.ui.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.md
          }}>
            🔔 Price Alerts
          </h1>
          <button
            onClick={loadAlerts}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              transition: `all ${theme.transition.normal}`
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
          gap: theme.spacing.sm, 
          marginBottom: theme.spacing.md,
          borderBottom: `2px solid ${theme.ui.border}`
        }}>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              backgroundColor: 'transparent',
              color: activeTab === 'active' ? '#4F46E5' : theme.ui.text.secondary,
              border: 'none',
              borderBottom: activeTab === 'active' ? '3px solid #4F46E5' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.base,
              fontWeight: '600',
              transition: `all ${theme.transition.normal}`,
              marginBottom: '-2px'
            }}
          >
            🟢 Active ({activeAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('triggered')}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              backgroundColor: 'transparent',
              color: activeTab === 'triggered' ? '#4F46E5' : theme.ui.text.secondary,
              border: 'none',
              borderBottom: activeTab === 'triggered' ? '3px solid #4F46E5' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.base,
              fontWeight: '600',
              transition: `all ${theme.transition.normal}`,
              marginBottom: '-2px'
            }}
          >
            🔴 Triggered ({triggeredAlerts.length})
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {displayAlerts.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.xl
          }}>
            <div style={{
              textAlign: 'center',
              padding: `${theme.spacing.xxl} ${theme.spacing.xl}`,
              backgroundColor: '#f8f9fa',
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${theme.ui.border}`,
              maxWidth: '500px'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: theme.spacing.lg }}>
                {activeTab === 'active' ? '📭' : '🔕'}
              </div>
              <div style={{ 
                fontSize: theme.typography.fontSize.xl, 
                color: theme.ui.text.primary, 
                marginBottom: theme.spacing.sm, 
                fontWeight: '600' 
              }}>
                {activeTab === 'active' ? 'No Active Alerts' : 'No Triggered Alerts'}
              </div>
              <div style={{ fontSize: theme.typography.fontSize.base, color: theme.ui.text.secondary }}>
                {activeTab === 'active' 
                  ? 'Create alerts by clicking the bell icon on any stock card'
                  : 'Triggered alerts will appear here when price targets are hit'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', padding: theme.spacing.lg }}>
            <AlertChartView
              alerts={displayAlerts}
              stockData={stockData}
              livePriceData={livePriceData}
              onDeleteAlert={handleDeleteClick}
              deleteConfirm={deleteConfirm}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
