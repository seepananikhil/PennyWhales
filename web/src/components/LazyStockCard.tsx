import React, { useState, useEffect, useRef } from 'react';
import { Stock } from '../types';
import StockCard from './StockCard';

interface LazyStockCardProps {
  ticker: string;
  stock?: Stock;
  livePrice?: {
    price: number;
    priceChange: number;
    timestamp: string;
  };
  isHolding: boolean;
  isInWatchlist?: boolean;
  onToggleHolding: (ticker: string) => void;
  onToggleWatchlist?: (ticker: string) => void;
  onOpenChart: (ticker: string) => void;
  onLoadLivePrice?: (ticker: string) => Promise<void>;
  showWatchButton?: boolean;
}

const LazyStockCard: React.FC<LazyStockCardProps> = ({
  ticker,
  stock,
  livePrice,
  isHolding,
  isInWatchlist = false,
  onToggleHolding,
  onToggleWatchlist,
  onOpenChart,
  onLoadLivePrice,
  showWatchButton = true
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoadedPrice, setHasLoadedPrice] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          
          // Load live price when card becomes visible
          if (onLoadLivePrice && !hasLoadedPrice && stock) {
            onLoadLivePrice(ticker).then(() => {
              setHasLoadedPrice(true);
            }).catch((err) => {
              console.error(`Error loading live price for ${ticker}:`, err);
            });
          }
        }
      },
      {
        root: null,
        rootMargin: '50px', // Start loading 50px before the card is visible
        threshold: 0.1 // Trigger when 10% of the card is visible
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [ticker, onLoadLivePrice, hasLoadedPrice, stock, isVisible]);

  return (
    <div ref={cardRef}>
      {isVisible && stock ? (
        <StockCard
          stock={stock}
          livePrice={livePrice}
          isHolding={isHolding}
          isInWatchlist={isInWatchlist}
          onToggleHolding={onToggleHolding}
          onToggleWatchlist={onToggleWatchlist}
          onOpenChart={onOpenChart}
          showWatchButton={showWatchButton}
        />
      ) : (
        // Placeholder while not visible or loading
        <div
          style={{
            height: '200px', // Approximate height of a StockCard
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6c757d',
            fontSize: '14px'
          }}
        >
          {stock ? 'Loading...' : 'No data available'}
        </div>
      )}
    </div>
  );
};

export default LazyStockCard;