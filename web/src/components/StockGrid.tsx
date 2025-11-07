import React from 'react';
import { Stock } from '../types';
import { theme } from '../theme';
import LazyStockCard from './LazyStockCard';

interface StockGridProps {
  stocks: Stock[];
  holdings: Set<string>;
  watchlistStocks?: Set<string>;
  onToggleHolding: (ticker: string) => void;
  onToggleWatchlist?: (ticker: string) => void;
  onOpenChart: (ticker: string) => void;
  borderColor?: string;
  showHoldingStar?: boolean;
  showWatchButton?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
}

const StockGrid: React.FC<StockGridProps> = ({
  stocks,
  holdings,
  watchlistStocks,
  onToggleHolding,
  onToggleWatchlist,
  onOpenChart,
  borderColor,
  showHoldingStar = true,
  showWatchButton = true,
  emptyMessage = "No stocks found",
  emptyDescription = "Try adjusting your filters or running a new scan"
}) => {
  if (stocks.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: theme.spacing.xxl,
          backgroundColor: theme.ui.surface,
          borderRadius: theme.borderRadius.md,
          color: theme.ui.text.secondary,
          boxShadow: theme.ui.shadow.md,
        }}
      >
        <h3 
          style={{ 
            fontSize: theme.typography.fontSize.xl, 
            marginBottom: theme.spacing.sm, 
            color: theme.ui.text.primary,
            fontFamily: theme.typography.fontFamily,
            fontWeight: theme.typography.fontWeight.semibold
          }}
        >
          {emptyMessage}
        </h3>
        <p 
          style={{ 
            fontSize: theme.typography.fontSize.base,
            fontFamily: theme.typography.fontFamily,
            margin: 0
          }}
        >
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(stocks.length, 4)}, minmax(160px, 1fr))`,
        gap: theme.spacing.md,
        maxHeight: "75vh",
        overflowY: "auto",
        padding: theme.spacing.md,
        backgroundColor: theme.ui.surface,
        borderRadius: theme.borderRadius.md,
        boxShadow: theme.ui.shadow.md,
        width: "100%",
      }}
    >
      {stocks.map((stock) => (
                <LazyStockCard
          key={stock.ticker}
          ticker={stock.ticker}
          stock={stock}
          isHolding={holdings.has(stock.ticker)}
          isInWatchlist={watchlistStocks?.has(stock.ticker)}
          onToggleHolding={onToggleHolding}
          onToggleWatchlist={onToggleWatchlist}
          onOpenChart={onOpenChart}
          showWatchButton={showWatchButton}
        />
      ))}
    </div>
  );
};

export default StockGrid;