import React, { useState, useEffect } from 'react';
import api from './api';

const TickerManagement: React.FC = () => {
  const [tickers, setTickers] = useState<string[]>([]);
  const [bulkTickersText, setBulkTickersText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTickers();
  }, []);

  const loadTickers = async () => {
    try {
      setLoading(true);
      const data = await api.getTickers();
      setTickers(data?.tickers || []);
      setError(null);
    } catch (err) {
      setError('Failed to load tickers');
      console.error('Error loading tickers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkTickersText.trim()) return;

    try {
      const newTickers = bulkTickersText
        .split(/[,\n\r\s]+/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t && t.length > 0);

      if (newTickers.length === 0) {
        setError('No valid tickers provided');
        return;
      }

      // Use PUT to replace all tickers
      const response = await fetch('http://localhost:9000/api/tickers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: newTickers })
      });

      if (response.ok) {
        setTickers(newTickers);
        setBulkTickersText('');
        setError(null);
      } else {
        setError('Failed to update tickers');
      }
    } catch (err) {
      setError('Failed to update tickers');
      console.error('Error updating tickers:', err);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkTickersText.trim()) return;

    try {
      const tickersToAdd = bulkTickersText
        .split(/[,\n\r\s]+/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t && t.length > 0 && !tickers.includes(t));

      if (tickersToAdd.length === 0) {
        setError('No new tickers to add');
        return;
      }

      // Use PATCH to add new tickers
      const response = await fetch('http://localhost:9000/api/tickers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: tickersToAdd })
      });

      if (response.ok) {
        setTickers([...tickers, ...tickersToAdd]);
        setBulkTickersText('');
        setError(null);
      } else {
        setError('Failed to add tickers');
      }
    } catch (err) {
      setError('Failed to add tickers');
      console.error('Error adding tickers:', err);
    }
  };

  const handleDeleteTicker = async (ticker: string) => {
    if (!window.confirm(`Are you sure you want to delete ticker ${ticker}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:9000/api/tickers/${ticker}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setTickers(tickers.filter(t => t !== ticker));
        setError(null);
      } else {
        setError(`Failed to delete ticker ${ticker}`);
      }
    } catch (err) {
      setError(`Failed to delete ticker ${ticker}`);
      console.error('Error deleting ticker:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '100%', 
      backgroundColor: '#f8f9fa', 
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#333' }}>🎯 Ticker Management</h1>
        <p style={{ color: '#666', margin: 0 }}>Total Tickers: <strong>{tickers.length}</strong></p>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Bulk Input Section */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: '#333' }}>Add/Update Tickers</h2>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 15px 0' }}>
          Enter tickers separated by commas, spaces, or new lines
        </p>
        
        <textarea
          value={bulkTickersText}
          onChange={(e) => setBulkTickersText(e.target.value)}
          placeholder="AAPL, MSFT, GOOGL, TSLA&#10;NVDA AMZN META&#10;NFLX"
          rows={6}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />
        
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleBulkAdd}
            disabled={!bulkTickersText.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: bulkTickersText.trim() ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: bulkTickersText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            ➕ Add New Tickers
          </button>
          
          <button
            onClick={handleBulkUpdate}
            disabled={!bulkTickersText.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: bulkTickersText.trim() ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: bulkTickersText.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            🔄 Replace All Tickers
          </button>
        </div>
      </div>

      {/* All Tickers Display */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>All Tickers ({tickers.length})</h2>
        
        {tickers.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '8px',
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px'
          }}>
            {tickers.map((ticker) => (
              <div
                key={ticker}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#495057',
                  fontFamily: 'monospace',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  position: 'relative'
                }}
              >
                <span style={{ flex: 1 }}>{ticker}</span>
                <button
                  onClick={() => handleDeleteTicker(ticker)}
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    marginLeft: '6px',
                    fontWeight: 'bold'
                  }}
                  title={`Delete ${ticker}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>No tickers configured</h3>
            <p style={{ margin: 0 }}>Add some tickers above to start scanning</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TickerManagement;