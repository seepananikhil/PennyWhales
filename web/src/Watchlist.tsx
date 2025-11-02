import React, { useState } from 'react';

const Watchlist: React.FC = () => {
  const [fireStocks, setFireStocks] = useState<string[]>(['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL']);
  const [newTicker, setNewTicker] = useState('');

  const stockInfo = {
    'AAPL': { name: 'Apple Inc.', price: '$190.25', change: '+2.4%' },
    'TSLA': { name: 'Tesla Inc.', price: '$248.50', change: '+5.2%' },
    'NVDA': { name: 'NVIDIA Corp.', price: '$450.75', change: '+3.8%' },
    'MSFT': { name: 'Microsoft Corp.', price: '$375.20', change: '+1.9%' },
    'GOOGL': { name: 'Alphabet Inc.', price: '$135.80', change: '+2.1%' }
  };

  const addTicker = () => {
    if (!newTicker.trim()) return;
    
    const ticker = newTicker.trim().toUpperCase();
    if (!fireStocks.includes(ticker)) {
      setFireStocks([...fireStocks, ticker]);
    }
    setNewTicker('');
  };

  const removeTicker = (ticker: string) => {
    setFireStocks(fireStocks.filter(t => t !== ticker));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTicker();
    }
  };

  return (
    <div className="watchlist-container">
      <div className="watchlist-header">
        <h1>🔥 Fire Stocks Watchlist</h1>
        <p>Track your hottest stock picks</p>
      </div>

      <div className="add-ticker-section">
        <div className="add-ticker-form">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter ticker symbol (e.g., AAPL)"
            className="ticker-input"
          />
          <button onClick={addTicker} className="add-btn">
            Add Stock
          </button>
        </div>
      </div>

      <div className="stocks-grid">
        {fireStocks.length === 0 ? (
          <div className="empty-state">
            <h3>No stocks in your fire list yet!</h3>
            <p>Add some hot stocks to get started</p>
          </div>
        ) : (
          fireStocks.map((ticker, index) => (
            <div key={ticker} className="stock-card fire-stock">
              <div className="stock-header">
                <div className="stock-symbol">
                  <span className="fire-emoji">🔥</span>
                  <strong>{ticker}</strong>
                </div>
                <button 
                  onClick={() => removeTicker(ticker)}
                  className="remove-btn"
                  title="Remove from watchlist"
                >
                  ×
                </button>
              </div>
              <div className="stock-info">
                <div className="stock-name">
                  {stockInfo[ticker as keyof typeof stockInfo]?.name || 'Company Name'}
                </div>
                <div className="stock-price">
                  {stockInfo[ticker as keyof typeof stockInfo]?.price || '$---.--'}
                </div>
                <div className="stock-change positive">
                  {stockInfo[ticker as keyof typeof stockInfo]?.change || '+0.0%'} ↗
                </div>
              </div>
              <div className="stock-rank">
                #{index + 1} Fire Stock
              </div>
            </div>
          ))
        )}
      </div>

      <div className="watchlist-stats">
        <div className="stat-card">
          <span className="stat-label">🔥 Fire Stocks</span>
          <span className="stat-value">{fireStocks.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">📈 Trending</span>
          <span className="stat-value">All Hot</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">💰 Portfolio Value</span>
          <span className="stat-value">$12,450</span>
        </div>
      </div>
    </div>
  );
};

export default Watchlist;