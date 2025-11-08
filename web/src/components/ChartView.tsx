import React, { useState } from 'react';
import { Stock } from '../types';
import { theme } from '../theme';
import LazyStockCard from './LazyStockCard';

interface ChartViewProps {
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
  onDeleteTicker?: (ticker: string) => void;
  onLoadLivePrice: (ticker: string) => Promise<void>;
  showWatchButton?: boolean;
  showDeleteButton?: boolean;
  tradingViewChartUrl?: string;
}

const ChartView: React.FC<ChartViewProps> = ({
  stocks,
  stockData,
  livePriceData,
  holdings,
  watchlistStocks,
  onToggleHolding,
  onToggleWatchlist,
  onDeleteTicker,
  onLoadLivePrice,
  showWatchButton = true,
  showDeleteButton = false,
  tradingViewChartUrl = 'https://www.tradingview.com/chart/StTMbjgz/?symbol='
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(
    stocks.length > 0 ? stocks[0] : null
  );

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
        {/* Left Sidebar - Stock Cards */}
        <div style={{
          width: '400px',
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: `1px solid ${theme.ui.border}`,
          paddingRight: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm
        }}>
          {stocks.map(ticker => {
            const stock = stockData.get(ticker);
            const livePrice = livePriceData.get(ticker);
            
            if (!stock) return null;
            
            return (
              <div 
                key={ticker}
                onClick={() => setSelectedTicker(ticker)}
                style={{
                  border: selectedTicker === ticker ? `3px solid ${theme.status.info}` : 'none',
                  borderRadius: theme.borderRadius.md,
                  cursor: 'pointer',
                  transition: `all ${theme.transition.normal}`,
                  boxShadow: selectedTicker === ticker ? theme.ui.shadow.lg : 'none'
                }}
              >
                <LazyStockCard
                  ticker={ticker}
                  stock={stock}
                  livePrice={livePrice}
                  isHolding={holdings.has(ticker)}
                  isInWatchlist={watchlistStocks.has(ticker)}
                  onToggleHolding={onToggleHolding}
                  onToggleWatchlist={onToggleWatchlist}
                  onOpenChart={(t) => {
                    setSelectedTicker(t);
                  }}
                  onLoadLivePrice={onLoadLivePrice}
                  showWatchButton={showWatchButton}
                  showDeleteButton={showDeleteButton}
                  onDeleteTicker={onDeleteTicker}
                />
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
              Select a ticker to view chart
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartView;
