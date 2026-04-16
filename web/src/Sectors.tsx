import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowTrendUp, FaArrowTrendDown } from 'react-icons/fa6';
import { theme, getSectorStyle } from './theme';

// Map SPDR sector names to our theme sector names
const SECTOR_NAME_MAP: { [key: string]: string } = {
  'Information Technology': 'Technology',
  'Communication Services': 'Communication Services',
  'Utilities': 'Utilities',
  'Consumer Discretionary': 'Consumer Cyclical',
  'Industrials': 'Industrials',
  'Health Care': 'Healthcare',
  'Financials': 'Financial',
  'Consumer Staples': 'Consumer Defensive',
  'Energy': 'Energy',
  'Materials': 'Basic Materials',
  'Real Estate': 'Real Estate',
};

interface SectorData {
  ticker: string;
  sector: string;
  currentPrice: number;
  lastPrice: number;
  changeAmount: number;
  changePercent: number;
  priceDate: string;
  lastPriceDate: string;
  isBenchmark: boolean;
}

const Sectors: React.FC = () => {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'dayOne' | 'dayFive' | 'monthOne' | 'yearOne' | 'yearFive'>('yearOne');

  useEffect(() => {
    fetchSectorPerformance();
  }, [timeframe]);

  const fetchSectorPerformance = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:9001/api/sectors/performance?timeframe=${timeframe}`);
      const data = await response.json();
      
      if (data.sectors) {
        // Separate benchmark and sectors, sort sectors by performance
        const benchmark = data.sectors.find((s: SectorData) => s.isBenchmark);
        const regularSectors = data.sectors
          .filter((s: SectorData) => !s.isBenchmark)
          .sort((a: SectorData, b: SectorData) => b.changePercent - a.changePercent);
        
        // Put benchmark at the end
        setSectors(benchmark ? [...regularSectors, benchmark] : regularSectors);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching sector performance:', err);
      setError('Failed to load sector performance data');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getPerformanceColor = (percent: number) => {
    if (percent > 5) return '#00e676'; // Green
    if (percent >= -5) return '#ffc107'; // Yellow
    return '#ef5350'; // Red
  };

  const handleSectorClick = (sectorName: string) => {
    // Map SPDR sector name to our theme sector name
    const mappedSector = SECTOR_NAME_MAP[sectorName] || sectorName;
    // Navigate to dashboard with sector filter
    navigate(`/dashboard?sector=${encodeURIComponent(mappedSector)}`);
  };

  const getTimeframeLabel = (tf: string) => {
    switch (tf) {
      case 'dayOne': return '1 Day';
      case 'dayFive': return '5 Days';
      case 'monthOne': return '1 Month';
      case 'yearOne': return '1 Year';
      case 'yearFive': return '5 Years';
      default: return tf;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '80vh',
        fontSize: theme.typography.fontSize.lg,
        color: theme.ui.text.secondary
      }}>
        <div style={{ animation: 'spin 1s linear infinite', fontSize: '2rem' }}>⏳</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ 
          padding: theme.spacing.md,
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: theme.borderRadius.md,
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: theme.spacing.lg }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: theme.spacing.lg 
      }}>
        <div>
          <h1 style={{
            margin: `0 0 ${theme.spacing.sm} 0`,
            fontSize: theme.typography.fontSize.xxl,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.ui.text.primary
          }}>
            Sector Performance
          </h1>

          <p style={{ 
            margin: 0,
            color: theme.ui.text.secondary,
            fontSize: theme.typography.fontSize.base
          }}>
            {getTimeframeLabel(timeframe)} performance based on SPDR Sector ETFs
          </p>
        </div>

        {/* Timeframe Selector */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.xs,
          backgroundColor: theme.ui.surface,
          padding: theme.spacing.xs,
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.ui.border}`
        }}>
          {(['dayOne', 'dayFive', 'monthOne', 'yearOne', 'yearFive'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: timeframe === tf ? theme.status.info : 'transparent',
                color: timeframe === tf ? 'white' : theme.ui.text.primary,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                transition: `all ${theme.transition.normal}`,
                fontFamily: theme.typography.fontFamily
              }}
              onMouseEnter={(e) => {
                if (timeframe !== tf) {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }
              }}
              onMouseLeave={(e) => {
                if (timeframe !== tf) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {getTimeframeLabel(tf)}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: theme.spacing.md
      }}>
        {sectors.map((sector) => {
          const mappedSectorName = SECTOR_NAME_MAP[sector.sector] || sector.sector;
          const sectorStyle = getSectorStyle(mappedSectorName);
          
          return (
          <div
            key={sector.ticker}
            onClick={() => !sector.isBenchmark && handleSectorClick(sector.sector)}
            style={{
              padding: theme.spacing.lg,
              background: sector.isBenchmark 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : `${getPerformanceColor(sector.changePercent)}15`,
              border: sector.isBenchmark ? '2px solid #764ba2' : `1px solid ${theme.ui.border}`,
              borderRadius: theme.borderRadius.lg,
              transition: `all ${theme.transition.normal}`,
              cursor: sector.isBenchmark ? 'default' : 'pointer',
              boxShadow: theme.ui.shadow.sm
            }}
            onMouseEnter={(e) => {
              if (!sector.isBenchmark) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.lg;
              }
            }}
            onMouseLeave={(e) => {
              if (!sector.isBenchmark) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
              }
            }}
          >
            {/* Ticker - Small */}
            <div style={{ 
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: sector.isBenchmark ? 'rgba(255,255,255,0.8)' : theme.ui.text.secondary,
              marginBottom: theme.spacing.xs
            }}>
              {sector.ticker}
            </div>

            {/* Sector Name - Big with Icon */}
            <h3 style={{ 
              margin: `0 0 ${theme.spacing.md} 0`,
              fontWeight: theme.typography.fontWeight.bold,
              fontSize: theme.typography.fontSize.xl,
              color: sector.isBenchmark ? '#fff' : theme.ui.text.primary,
              lineHeight: '1.3',
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm
            }}>
              {!sector.isBenchmark && <span style={{ fontSize: '1.5rem' }}>{sectorStyle.icon}</span>}
              {sector.sector}
            </h3>

            {/* Performance with Icon */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.sm
            }}>
              <span style={{
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: theme.typography.fontSize.xxl,
                color: sector.isBenchmark 
                  ? '#fff' 
                  : sector.changePercent >= 0 
                    ? '#00e676' 
                    : '#ef5350'
              }}>
                {formatPercent(sector.changePercent)}
              </span>
              {sector.changePercent >= 0 ? (
                FaArrowTrendUp({ 
                  color: sector.isBenchmark ? '#fff' : '#00e676',
                  size: 24
                })
              ) : (
                FaArrowTrendDown({ 
                  color: sector.isBenchmark ? '#fff' : '#ef5350',
                  size: 24
                })
              )}
            </div>

            {/* Price */}
            <div style={{ 
              fontSize: theme.typography.fontSize.base,
              color: sector.isBenchmark ? 'rgba(255,255,255,0.9)' : theme.ui.text.secondary,
              marginBottom: theme.spacing.xs
            }}>
              {formatPrice(sector.currentPrice)}
              <span style={{ marginLeft: theme.spacing.xs, fontSize: theme.typography.fontSize.sm }}>
                ({sector.changeAmount >= 0 ? '+' : ''}{formatPrice(sector.changeAmount)})
              </span>
            </div>

            {sector.isBenchmark && (
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: 'rgba(255,255,255,0.9)',
                fontWeight: theme.typography.fontWeight.semibold,
                marginTop: theme.spacing.sm,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                S&P 500 Benchmark
              </div>
            )}
          </div>
        )})}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Sectors;
