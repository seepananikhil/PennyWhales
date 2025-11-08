import React from 'react';
import { Stock } from '../types';
import { theme } from '../theme';
import LazyStockCard from './LazyStockCard';

interface GridViewProps {
  stocks: string[];
  stockData: Map<string, Stock>;
  livePriceData: Map<string, {
    price: number;
    priceChange: number;
    timestamp: string;
  }>;
  holdings: Set<string>;
  watchlistStocks: Set<string>;
  onToggleHolding: (ticker: string) => void;
  onToggleWatchlist?: (ticker: string) => void;
  onOpenChart: (ticker: string) => void;
  onDeleteTicker?: (ticker: string) => void;
  onLoadLivePrice: (ticker: string) => Promise<void>;
  showWatchButton?: boolean;
  showDeleteButton?: boolean;
  activeFilter?: string;
}

const GridView: React.FC<GridViewProps> = ({
  stocks,
  stockData,
  livePriceData,
  holdings,
  watchlistStocks,
  onToggleHolding,
  onToggleWatchlist,
  onOpenChart,
  onDeleteTicker,
  onLoadLivePrice,
  showWatchButton = true,
  showDeleteButton = false,
  activeFilter
}) => {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: theme.spacing.md,
      height: 'fit-content'
    }}>
      {stocks.map(ticker => {
        const stock = stockData.get(ticker);
        const livePrice = livePriceData.get(ticker);
        
        // For holdings without stock data, show a placeholder card
        if (!stock && activeFilter === 'holdings') {
          return (
            <div
              key={ticker}
              style={{
                padding: theme.spacing.md,
                backgroundColor: theme.ui.surface,
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.ui.border}`,
                boxShadow: theme.ui.shadow.sm,
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing.sm
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.ui.text.primary
                }}>
                  {ticker}
                </h3>
                <button
                  onClick={() => onToggleHolding(ticker)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    padding: theme.spacing.xs
                  }}
                  title="Remove from holdings"
                >
                  ⭐
                </button>
              </div>
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.ui.text.secondary,
                fontStyle: 'italic'
              }}>
                No scan data available
              </div>
              <button
                onClick={() => onOpenChart(ticker)}
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  border: `1px solid ${theme.ui.border}`,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.ui.surface,
                  color: theme.ui.text.primary,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  transition: `all ${theme.transition.normal}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.ui.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.ui.surface;
                }}
              >
                📈 View Chart
              </button>
            </div>
          );
        }
        
        // For stocks with data, show the lazy-loaded StockCard
        if (stock) {
          return (
            <LazyStockCard
              key={ticker}
              ticker={ticker}
              stock={stock}
              livePrice={livePrice}
              isHolding={holdings.has(ticker)}
              isInWatchlist={watchlistStocks.has(ticker)}
              onToggleHolding={onToggleHolding}
              onToggleWatchlist={onToggleWatchlist}
              onOpenChart={onOpenChart}
              onLoadLivePrice={onLoadLivePrice}
              showWatchButton={showWatchButton}
              showDeleteButton={showDeleteButton}
              onDeleteTicker={onDeleteTicker}
            />
          );
        }
        
        return null;
      })}
    </div>
  );
};

export default GridView;
