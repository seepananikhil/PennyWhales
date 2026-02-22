import React, { useState, useEffect } from 'react';
import { theme } from './theme';
import api from './api';
import ChartView from './components/ChartView';
import { Stock } from './types';

interface InstitutionalChange {
  ticker: string;
  price: number;
  previous_close?: number;
  fire_level: number;
  previous_fire_level?: number;
  blackrock_pct?: number;
  vanguard_pct?: number;
  statestreet_pct?: number;
  blackrock_change?: number;
  vanguard_change?: number;
  statestreet_change?: number;
  blackrock_market_value?: number;
  vanguard_market_value?: number;
  statestreet_market_value?: number;
  totalChange: number;
  market_cap: number;
  avg_volume?: number;
  employee_count?: number;
  ipo_date?: string;
  sector?: string;
  industry?: string;
  company_name?: string;
  description?: string;
  inst_own?: number;
  inst_trans?: number;
  sma200?: number;
  recommendation?: string | null;
  performance?: {
    day?: number;
    week?: number;
    month?: number;
    quarter?: number;
    halfYear?: number;
    ytd?: number;
    year?: number;
    threeYear?: number;
    fiveYear?: number;
  };
  detected_at: string;
  first_detected_at?: string;
  aggregation_count?: number;
  is_new?: boolean;
}

interface InstitutionalChangesData {
  additions: InstitutionalChange[];
  sells: InstitutionalChange[];
}

const InstitutionalChanges: React.FC = () => {
  const [changesData, setChangesData] = useState<InstitutionalChangesData>({ additions: [], sells: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'additions' | 'sells'>('additions');

  useEffect(() => {
    loadChanges();
    // Refresh every 5 minutes
    const interval = setInterval(loadChanges, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadChanges = async () => {
    try {
      const data = await api.getInstitutionalChanges();
      setChangesData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading institutional changes:', error);
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all institutional changes history?')) {
      return;
    }
    
    try {
      await api.clearInstitutionalChanges();
      setChangesData({ additions: [], sells: [] });
    } catch (error) {
      console.error('Error clearing institutional changes:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentData = activeTab === 'additions' ? changesData.additions : changesData.sells;

  // Convert institutional changes to Stock objects for ChartView/GridView
  const stockData = new Map<string, Stock>();
  const livePriceData = new Map<string, { price: number; priceChange: number; timestamp: string }>();
  
  currentData.forEach(change => {
    // Build notes with aggregation info
    let notes = `Total change: ${change.totalChange.toFixed(2)}%`;
    if (change.aggregation_count && change.aggregation_count > 1) {
      const firstDate = new Date(change.first_detected_at || change.detected_at);
      const lastDate = new Date(change.detected_at);
      const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      notes += ` (${change.aggregation_count} detections over ${daysDiff} days)`;
    }
    
    const stock: Stock = {
      ticker: change.ticker,
      price: change.price,
      previous_close: change.previous_close,
      blackrock_pct: change.blackrock_pct || 0,
      vanguard_pct: change.vanguard_pct || 0,
      statestreet_pct: change.statestreet_pct,
      blackrock_change: change.blackrock_change,
      vanguard_change: change.vanguard_change,
      statestreet_change: change.statestreet_change,
      blackrock_market_value: change.blackrock_market_value,
      vanguard_market_value: change.vanguard_market_value,
      statestreet_market_value: change.statestreet_market_value,
      market_cap: change.market_cap,
      avg_volume: change.avg_volume,
      employee_count: change.employee_count,
      ipo_date: change.ipo_date,
      sector: change.sector,
      industry: change.industry,
      company_name: change.company_name,
      description: change.description,
      inst_own: change.inst_own,
      inst_trans: change.inst_trans,
      sma200: change.sma200,
      recommendation: change.recommendation,
      performance: change.performance,
      fire_level: change.fire_level,
      previous_fire_level: change.previous_fire_level,
      is_new: change.is_new,
      blackrock_source: 'institutional_changes',
      vanguard_source: 'institutional_changes',
      data_quality: 'standard',
      sources_count: 1,
      discrepancy: false,
      notes: notes
    };
    stockData.set(change.ticker, stock);
    
    livePriceData.set(change.ticker, {
      price: change.price,
      priceChange: 0,
      timestamp: change.detected_at
    });
  });

  return (
    <div style={{ 
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Fixed Header */}
      <div style={{ 
        padding: '16px 24px 0',
        backgroundColor: 'white',
        borderBottom: `1px solid ${theme.ui.border}`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        flexShrink: 0
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: theme.ui.text.primary, lineHeight: 1.2 }}>
              🏦 Institutional Changes
            </h1>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: theme.ui.text.secondary, lineHeight: 1.4 }}>
              Track significant institutional ownership changes (≥1%)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={clearHistory}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: `1px solid ${theme.ui.border}`,
                backgroundColor: 'white',
                color: theme.ui.text.secondary,
                fontSize: '14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(220,38,38,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = theme.ui.border;
                e.currentTarget.style.color = theme.ui.text.secondary;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              }}
            >
              🗑️ Clear History
            </button>
          </div>
        </div>

        {/* Sticky Tabs */}
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto',
          display: 'flex', 
          gap: '32px',
          borderBottom: `1px solid ${theme.ui.border}`
        }}>
          <button
            onClick={() => setActiveTab('additions')}
            style={{
              padding: '12px 0',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'additions' ? '#059669' : theme.ui.text.secondary,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'additions' ? '2px solid #059669' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            Additions
            <span style={{
              backgroundColor: activeTab === 'additions' ? '#d1fae5' : '#f3f4f6',
              color: activeTab === 'additions' ? '#059669' : theme.ui.text.secondary,
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              {changesData.additions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sells')}
            style={{
              padding: '12px 0',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'sells' ? '#dc2626' : theme.ui.text.secondary,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: activeTab === 'sells' ? '2px solid #dc2626' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            Sells
            <span style={{
              backgroundColor: activeTab === 'sells' ? '#fecaca' : '#f3f4f6',
              color: activeTab === 'sells' ? '#dc2626' : theme.ui.text.secondary,
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              {changesData.sells.length}
            </span>
          </button>
        </div>
      </div>

      {/* Content Area - ChartView handles its own scrolling */}
      <div style={{ 
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
          {loading ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <div style={{ fontSize: '16px', color: theme.ui.text.secondary, fontWeight: 500 }}>
                  Loading institutional changes...
                </div>
              </div>
            </div>
          ) : currentData.length === 0 ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>
                  {activeTab === 'additions' ? '📈' : '📉'}
                </div>
                <div style={{ fontSize: '20px', color: theme.ui.text.primary, fontWeight: 600, marginBottom: '8px' }}>
                  No {activeTab === 'additions' ? 'additions' : 'sells'} detected yet
                </div>
                <div style={{ fontSize: '14px', color: theme.ui.text.secondary }}>
                  Institutional changes will appear here after scans complete
                </div>
              </div>
            </div>
          ) : (
            <ChartView
              stocks={currentData.map(c => c.ticker)}
              stockData={stockData}
              livePriceData={livePriceData}
              holdings={new Set()}
              watchlistStocks={new Set()}
              onToggleHolding={() => {}}
              onToggleWatchlist={() => {}}
              onDeleteTicker={() => {}}
              showWatchButton={false}
              showDeleteButton={false}
              tradingViewChartUrl="https://www.tradingview.com/chart/?symbol="
              showLastUpdated={true}
            />
          )}
      </div>
    </div>
  );
};

export default InstitutionalChanges;
