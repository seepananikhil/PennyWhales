import React, { useState, useEffect } from 'react';
import { Stock } from '../types';
import { theme, getFireLevelStyle } from '../theme';
import { FaBell } from 'react-icons/fa';
import { SiTradingview } from 'react-icons/si';
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

interface AlertChartViewProps {
  alerts: Alert[];
  stockData: Map<string, Stock>;
  livePriceData: Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>;
  onDeleteAlert?: (alertId: string) => void;
  deleteConfirm?: string | null;
}

const AlertChartView: React.FC<AlertChartViewProps> = ({
  alerts,
  stockData,
  livePriceData,
  onDeleteAlert,
  deleteConfirm
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(
    alerts.length > 0 ? alerts[0].ticker : null
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && alerts.length > 0) {
        e.preventDefault();
        const currentIndex = selectedTicker ? alerts.findIndex(a => a.ticker === selectedTicker) : -1;
        const nextIndex = (currentIndex + 1) % alerts.length;
        setSelectedTicker(alerts[nextIndex].ticker);
        
        // Scroll the selected card into view
        const cardElement = document.querySelector(`[data-alert-ticker="${alerts[nextIndex].ticker}"]`);
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alerts, selectedTicker]);

  // Auto-select first item when alerts change
  useEffect(() => {
    if (alerts.length > 0 && !selectedTicker) {
      setSelectedTicker(alerts[0].ticker);
    }
  }, [alerts, selectedTicker]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Main Content Area */}
      <div style={{
        display: 'flex',
        flex: 1,
        gap: theme.spacing.md,
        minHeight: 0
      }}>
        {/* Left Sidebar - Alert Cards */}
        <div style={{
          width: '400px',
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: `1px solid ${theme.ui.border}`,
          paddingRight: theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm
        }}>
          {alerts.map(alert => {
            const stock = stockData.get(alert.ticker);
            const livePrice = livePriceData.get(alert.ticker);
            
            if (!stock) return null;
            
            const isSelected = selectedTicker === alert.ticker;
            
            const fireLevel = stock.fire_level || 0;
            const fireStyle = getFireLevelStyle(fireLevel);
            const cardBorderColor = isSelected
              ? (fireLevel > 0 ? fireStyle.primary : theme.status.info)
              : (fireLevel > 0 ? fireStyle.border : '#4F46E5');
            const cardBackgroundColor = isSelected
              ? (fireLevel > 0 ? fireStyle.background : '#e3f2fd')
              : (fireLevel > 0 ? fireStyle.background : '#f8f9fa');
            const currentPrice = livePrice?.price || stock.price;
            const priceChangeValue = livePrice?.priceChange || 0;
            
            return (
              <div 
                key={alert.id}
                data-alert-ticker={alert.ticker}
                onClick={() => setSelectedTicker(alert.ticker)}
                style={{
                  padding: '6px',
                  backgroundColor: cardBackgroundColor,
                  border: `${isSelected ? '2px' : '1px'} solid ${cardBorderColor}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.08)',
                  fontFamily: theme.typography.fontFamily,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.08)';
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#333', textTransform: 'uppercase' }}>
                      {stock.ticker}
                    </span>
                    <span style={{ fontSize: '1rem' }}>{fireStyle.emoji}</span>
                    {stock.market_cap && stock.market_cap > 0 && (
                      <span style={{
                        fontSize: '0.8rem',
                        color: '#6c757d',
                        fontWeight: '600',
                        backgroundColor: '#fafafa',
                        padding: '2px 6px',
                        borderRadius: '5px',
                        border: '1px solid #e9ecef',
                        marginRight: '4px',
                      }}>
                        {stock.market_cap >= 1000 ? `${(stock.market_cap / 1000).toFixed(1)}B` : `${Math.round(stock.market_cap)}M`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {/* TradingView Chart Button */}
                    <span
                      style={{
                        color: '#000000',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        backgroundColor: '#E3F2FD',
                        padding: '3px 4px',
                        borderRadius: '8px',
                        border: '1px solid #BBDEFB',
                        boxShadow: '0 1px 2px rgba(41,98,255,0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://www.tradingview.com/chart/StTMbjgz/?symbol=${stock.ticker}`, '_blank');
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.backgroundColor = '#BBDEFB';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(41,98,255,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.backgroundColor = '#E3F2FD';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(41,98,255,0.2)';
                      }}
                      title="View on TradingView"
                    >
                      {SiTradingview({ size: 12 })}
                    </span>
                   
                    {/* Delete Button */}
                    {onDeleteAlert && (
                      <span
                        style={{
                          color: deleteConfirm === alert.id ? '#dc3545' : '#6c757d',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          backgroundColor: deleteConfirm === alert.id ? '#f8d7da' : '#f8f9fa',
                          padding: '3px 4px',
                          borderRadius: '8px',
                          border: deleteConfirm === alert.id ? '1px solid #f5c6cb' : '1px solid #dee2e6',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          transition: 'all 0.2s ease',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAlert(alert.id);
                        }}
                        onMouseEnter={(e) => {
                          if (deleteConfirm !== alert.id) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.backgroundColor = '#f8d7da';
                            e.currentTarget.style.borderColor = '#f5c6cb';
                            e.currentTarget.style.color = '#dc3545';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (deleteConfirm !== alert.id) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#dee2e6';
                            e.currentTarget.style.color = '#6c757d';
                          }
                        }}
                        title={deleteConfirm === alert.id ? 'Click again to confirm' : 'Delete alert'}
                      >
                        {deleteConfirm === alert.id ? MdDeleteForever({ size: 12 }) : MdDelete({ size: 12 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price Section */}
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  marginBottom: '6px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid #e9ecef',
                }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4F46E5' }}>
                    ${currentPrice.toFixed(2)}
                  </span>
                  {priceChangeValue !== undefined && priceChangeValue !== 0 && (
                    <span style={{
                      fontSize: '0.85rem',
                      color: priceChangeValue > 0 ? '#28a745' : '#dc3545',
                      fontWeight: '600',
                    }}>
                      {priceChangeValue > 0 ? '+' : ''}{priceChangeValue.toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* Alert Target Price Section */}
                <div style={{
                  backgroundColor: alert.triggered ? '#d4edda' : alert.condition === 'above' ? '#fff4e6' : '#ffe6e6',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  border: alert.triggered ? '1px solid #c3e6cb' : alert.condition === 'above' ? '1px solid #ffd8a8' : '1px solid #ffcccb',
                }}>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#6c757d',
                    fontWeight: '600',
                    marginBottom: '2px',
                    letterSpacing: '0.5px',
                  }}>
                    {alert.triggered ? '✅ TRIGGERED TARGET' : 'ALERT TARGET'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ 
                      fontSize: '1rem', 
                      fontWeight: 'bold', 
                      color: alert.triggered ? '#155724' : alert.condition === 'above' ? '#28a745' : '#dc3545'
                    }}>
                      ${alert.targetPrice.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                      ({alert.condition === 'above' ? 'above' : 'below'})
                    </span>
                  </div>
                  {alert.triggered && alert.triggeredAt && (
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#155724',
                      marginTop: '3px',
                    }}>
                      {new Date(alert.triggeredAt).toLocaleDateString()} at ${alert.triggeredPrice?.toFixed(2) || 'N/A'}
                    </div>
                  )}
                </div>

                {/* Performance Metrics */}
                {stock.performance && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                  }}>
                    <div style={{
                      textAlign: 'center',
                      backgroundColor: stock.performance.week > 0 ? '#d4edda' : stock.performance.week < 0 ? '#f8d7da' : '#f8f9fa',
                      padding: '5px 4px',
                      borderRadius: '6px',
                      border: `1px solid ${stock.performance.week > 0 ? '#c3e6cb' : stock.performance.week < 0 ? '#f5c6cb' : '#e9ecef'}`,
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#6c757d',
                        fontWeight: '600',
                        marginBottom: '2px',
                      }}>
                        Week
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: stock.performance.week > 0 ? '#28a745' : stock.performance.week < 0 ? '#dc3545' : '#6c757d',
                      }}>
                        {stock.performance.week > 0 ? '+' : ''}{stock.performance.week.toFixed(1)}%
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'center',
                      backgroundColor: stock.performance.month > 0 ? '#d4edda' : stock.performance.month < 0 ? '#f8d7da' : '#f8f9fa',
                      padding: '5px 4px',
                      borderRadius: '6px',
                      border: `1px solid ${stock.performance.month > 0 ? '#c3e6cb' : stock.performance.month < 0 ? '#f5c6cb' : '#e9ecef'}`,
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#6c757d',
                        fontWeight: '600',
                        marginBottom: '2px',
                      }}>
                        Month
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: stock.performance.month > 0 ? '#28a745' : stock.performance.month < 0 ? '#dc3545' : '#6c757d',
                      }}>
                        {stock.performance.month > 0 ? '+' : ''}{stock.performance.month.toFixed(1)}%
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'center',
                      backgroundColor: stock.performance.year > 0 ? '#d4edda' : stock.performance.year < 0 ? '#f8d7da' : '#f8f9fa',
                      padding: '5px 4px',
                      borderRadius: '6px',
                      border: `1px solid ${stock.performance.year > 0 ? '#c3e6cb' : stock.performance.year < 0 ? '#f5c6cb' : '#e9ecef'}`,
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#6c757d',
                        fontWeight: '600',
                        marginBottom: '2px',
                      }}>
                        Year
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: stock.performance.year > 0 ? '#28a745' : stock.performance.year < 0 ? '#dc3545' : '#6c757d',
                      }}>
                        {stock.performance.year > 0 ? '+' : ''}{stock.performance.year.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Side - TradingView Chart */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          {selectedTicker ? (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                flex: 1,
                position: 'relative'
              }}>
                <iframe
                  src={`https://www.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${selectedTicker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=light&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${selectedTicker}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title={`${selectedTicker} Chart`}
                />
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.ui.text.secondary,
              fontSize: theme.typography.fontSize.lg
            }}>
              Select an alert to view chart
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertChartView;
