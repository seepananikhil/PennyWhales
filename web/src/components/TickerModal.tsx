import React, { useState } from 'react';
import { theme } from '../theme';
import api from '../api';
import StockCard from './StockCard';

interface TickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tickers: string[]) => void;
  onAddNew: (tickers: string[]) => void;
  currentTickers: string[];
}

const TickerModal: React.FC<TickerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onAddNew,
  currentTickers
}) => {
  const [bulkText, setBulkText] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [replaceMode, setReplaceMode] = useState<boolean>(false);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scannedStocks, setScannedStocks] = useState<any[]>([]);
  const [scanErrors, setScanErrors] = useState<any[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleScan = async () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().replace(/['"]/g, '').toUpperCase())
      .filter(ticker => ticker.length > 0);
    
    if (newTickers.length === 0) return;

    setScanning(true);
    try {
      const result = await api.scanMultipleStocks(newTickers);
      if (result.success && result.stocks) {
        setScannedStocks(result.stocks);
        setScanErrors(result.errors || []);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error scanning tickers:', error);
    } finally {
      setScanning(false);
    }
  };

  const handleAddSelected = (tickersToAdd: string[]) => {
    if (tickersToAdd.length === 0) return;

    // Filter only fire stocks
    const fireStocksToAdd = scannedStocks
      .filter(s => tickersToAdd.includes(s.ticker) && s.fire_level > 0)
      .map(s => s.ticker);

    if (fireStocksToAdd.length === 0) return;

    if (replaceMode) {
      onSave(fireStocksToAdd);
    } else {
      onAddNew(fireStocksToAdd);
    }

    // Remove added stocks from scanned list
    setScannedStocks(prev => prev.filter(s => !fireStocksToAdd.includes(s.ticker)));
  };

  const handleAddAllScanned = () => {
    const fireStockTickers = scannedStocks
      .filter(s => s.fire_level > 0)
      .map(s => s.ticker);
    handleAddSelected(fireStockTickers);
  };

  const handleIgnoreStock = (ticker: string) => {
    setScannedStocks(prev => prev.filter(s => s.ticker !== ticker));
  };

  const handleBackToInput = () => {
    setShowResults(false);
    setScannedStocks([]);
    setScanErrors([]);
  };

  const handleSave = () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().replace(/['"]/g, '').toUpperCase())
      .filter(ticker => ticker.length > 0);
    
    if (replaceMode) {
      // Show confirmation before replacing
      setShowConfirmation(true);
    } else {
      // Scan first instead of adding directly
      handleScan();
    }
  };

  const handleAddDirectly = () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().replace(/['"]/g, '').toUpperCase())
      .filter(ticker => ticker.length > 0);
    
    if (newTickers.length === 0) return;

    if (replaceMode) {
      onSave(newTickers);
    } else {
      onAddNew(newTickers);
    }
    
    setBulkText('');
    onClose();
  };

  const handleConfirmReplace = () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().replace(/['"]/g, '').toUpperCase())
      .filter(ticker => ticker.length > 0);
    
    onSave(newTickers);
    setBulkText('');
    setShowConfirmation(false);
    onClose();
  };

  const handleCancelReplace = () => {
    setShowConfirmation(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !showConfirmation) {
      onClose();
    }
  };

  const handleClose = () => {
    if (!showConfirmation && !scanning) {
      setBulkText('');
      setReplaceMode(false);
      setShowResults(false);
      setScannedStocks([]);
      setScanErrors([]);
      onClose();
    }
  };

  return (
    <div 
      className="ticker-modal-overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}
    >
      <div 
        className="ticker-modal-content"
        style={{
          backgroundColor: theme.ui.surface,
          borderRadius: theme.borderRadius.md,
          width: '95%',
          height: '95vh',
          overflow: 'hidden',
          boxShadow: theme.ui.shadow.xl,
          border: `1px solid ${theme.ui.border}`,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
            borderBottom: `1px solid ${theme.ui.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme.ui.surface
          }}
        >
          <h2 
            style={{
              margin: 0,
              fontSize: theme.typography.fontSize.xl,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.ui.text.primary
            }}
          >
            🎯 Manage Tickers
          </h2>
          <button
            onClick={handleClose}
            disabled={showConfirmation}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: showConfirmation ? 'not-allowed' : 'pointer',
              color: showConfirmation ? theme.ui.text.muted : theme.ui.text.secondary,
              padding: theme.spacing.xs,
              borderRadius: theme.borderRadius.sm,
              transition: `all ${theme.transition.normal}`,
              opacity: showConfirmation ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!showConfirmation) {
                e.currentTarget.style.backgroundColor = theme.ui.background;
                e.currentTarget.style.color = theme.ui.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!showConfirmation) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.ui.text.secondary;
              }
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ 
          padding: theme.spacing.xl, 
          flex: 1, 
          overflow: 'auto',
          height: 'calc(100vh - 80px)' // Account for header height
        }}>
          {showConfirmation ? (
            // Confirmation Dialog
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: theme.spacing.lg,
                color: theme.status.warning
              }}>
                ⚠️
              </div>
              <h3 style={{
                margin: `0 0 ${theme.spacing.md} 0`,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.ui.text.primary
              }}>
                Replace All Tickers?
              </h3>
              <p style={{
                margin: `0 0 ${theme.spacing.md} 0`,
                color: theme.ui.text.secondary,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: '1.5'
              }}>
                This will permanently replace your current {currentTickers.length} tickers. 
                This action cannot be undone.
              </p>
              <div style={{
                backgroundColor: theme.ui.background,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                marginBottom: theme.spacing.lg,
                border: `1px solid ${theme.ui.border}`
              }}>
                <p style={{
                  margin: 0,
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.ui.text.muted,
                  fontWeight: theme.typography.fontWeight.medium
                }}>
                  Current tickers: {currentTickers.join(', ')}
                </p>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: theme.spacing.md
              }}>
                <button
                  onClick={handleCancelReplace}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: `1px solid ${theme.ui.border}`,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: 'transparent',
                    color: theme.ui.text.secondary,
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    transition: `all ${theme.transition.normal}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.ui.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReplace}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: theme.status.warning,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.semibold,
                    transition: `all ${theme.transition.normal}`,
                    boxShadow: theme.ui.shadow.sm
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
                  }}
                >
                  🔄 Yes, Replace All
                </button>
              </div>
            </div>
          ) : showResults ? (
            // Scanned Results View
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing.lg
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.ui.text.primary
                }}>
                  📊 Scanned Results ({scannedStocks.length})
                </h3>
                <button
                  onClick={handleBackToInput}
                  style={{
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    border: `1px solid ${theme.ui.border}`,
                    borderRadius: theme.borderRadius.sm,
                    backgroundColor: 'transparent',
                    color: theme.ui.text.secondary,
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium
                  }}
                >
                  ← Back
                </button>
              </div>

              {/* Error Messages */}
              {scanErrors.length > 0 && (
                <div style={{
                  padding: theme.spacing.sm,
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  borderRadius: theme.borderRadius.sm,
                  marginBottom: theme.spacing.md,
                  fontSize: theme.typography.fontSize.xs
                }}>
                  ⚠️ Could not scan {scanErrors.length} ticker(s): {scanErrors.map((e: any) => e.ticker).join(', ')}
                </div>
              )}

              {/* Results Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: theme.spacing.md,
                marginBottom: theme.spacing.lg
              }}>
                {scannedStocks.map((stock) => (
                  <div key={stock.ticker} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                    <StockCard 
                      stock={stock}
                      isHolding={false}
                      onToggleHolding={() => {}}
                      onOpenChart={() => {}}
                    />
                    {/* Action Buttons */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: theme.spacing.sm
                    }}>
                      <button
                        onClick={() => handleIgnoreStock(stock.ticker)}
                        style={{
                          padding: theme.spacing.sm,
                          border: `1px solid ${theme.ui.border}`,
                          borderRadius: theme.borderRadius.sm,
                          backgroundColor: theme.ui.surface,
                          color: theme.ui.text.primary,
                          cursor: 'pointer',
                          fontSize: theme.typography.fontSize.xs,
                          fontWeight: theme.typography.fontWeight.medium
                        }}
                      >
                        ❌ Ignore
                      </button>
                      <button
                        onClick={() => handleAddSelected([stock.ticker])}
                        disabled={stock.fire_level === 0}
                        style={{
                          padding: theme.spacing.sm,
                          border: 'none',
                          borderRadius: theme.borderRadius.sm,
                          backgroundColor: stock.fire_level === 0 ? theme.ui.text.muted : theme.status.success,
                          color: 'white',
                          cursor: stock.fire_level === 0 ? 'not-allowed' : 'pointer',
                          fontSize: theme.typography.fontSize.xs,
                          fontWeight: theme.typography.fontWeight.semibold,
                          opacity: stock.fire_level === 0 ? 0.5 : 1
                        }}
                      >
                        ✅ Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                paddingTop: theme.spacing.md,
                borderTop: `1px solid ${theme.ui.border}`
              }}>
                <button
                  onClick={handleClose}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: `1px solid ${theme.ui.border}`,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: 'transparent',
                    color: theme.ui.text.secondary,
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium
                  }}
                >
                  Close
                </button>
                <button
                  onClick={handleAddAllScanned}
                  disabled={scannedStocks.filter(s => s.fire_level > 0).length === 0}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: scannedStocks.filter(s => s.fire_level > 0).length === 0 
                      ? theme.ui.text.muted 
                      : theme.status.success,
                    color: 'white',
                    cursor: scannedStocks.filter(s => s.fire_level > 0).length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.semibold,
                    opacity: scannedStocks.filter(s => s.fire_level > 0).length === 0 ? 0.6 : 1
                  }}
                >
                  ✅ Add All Fire Stocks ({scannedStocks.filter(s => s.fire_level > 0).length})
                </button>
              </div>
            </>
          ) : (
            // Main Form
            <>
              <p 
                style={{
                  margin: `0 0 ${theme.spacing.md} 0`,
                  color: theme.ui.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: '1.5'
                }}
              >
                {replaceMode 
                  ? 'Enter new tickers to completely replace your current list. You will be asked to confirm before replacing.'
                  : 'Enter tickers to add to your list. Click "Scan Stocks" to preview BlackRock & Vanguard holdings and fire levels before adding, or click "Add New" to add directly without scanning.'
                }
              </p>
              
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="AAPL, MSFT, GOOGL, TSLA..."
                style={{
                  width: '100%',
                  height: '300px',
                  padding: theme.spacing.md,
                  border: `2px solid ${theme.ui.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                  fontFamily: 'monospace',
                  backgroundColor: theme.ui.background,
                  color: theme.ui.text.primary,
                  resize: 'vertical',
                  outline: 'none',
                  transition: `border-color ${theme.transition.normal}`
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = replaceMode ? theme.status.warning : theme.status.success;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = theme.ui.border;
                }}
              />

              {/* Replace Mode Checkbox - Moved to bottom */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: theme.spacing.md,
                marginBottom: theme.spacing.lg
              }}>
                <input
                  type="checkbox"
                  id="replaceMode"
                  checked={replaceMode}
                  onChange={(e) => setReplaceMode(e.target.checked)}
                  style={{
                    marginRight: theme.spacing.sm
                  }}
                />
                <label
                  htmlFor="replaceMode"
                  style={{
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.ui.text.secondary
                  }}
                >
                  Replace all existing tickers ({currentTickers.length} current)
                </label>
              </div>

              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: theme.spacing.sm
                }}
              >
                <button
                  onClick={handleClose}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: `1px solid ${theme.ui.border}`,
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: 'transparent',
                    color: theme.ui.text.secondary,
                    cursor: 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    transition: `all ${theme.transition.normal}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.ui.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleAddDirectly}
                  disabled={!bulkText.trim()}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: !bulkText.trim()
                      ? theme.ui.text.muted 
                      : replaceMode 
                        ? theme.status.warning 
                        : theme.status.success,
                    color: 'white',
                    cursor: !bulkText.trim() ? 'not-allowed' : 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.semibold,
                    transition: `all ${theme.transition.normal}`,
                    boxShadow: theme.ui.shadow.sm,
                    opacity: !bulkText.trim() ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (bulkText.trim()) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (bulkText.trim()) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
                    }
                  }}
                >
                  {replaceMode ? '🔄 Replace All' : '➕ Add New'}
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={!bulkText.trim() || scanning}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: !bulkText.trim() || scanning
                      ? theme.ui.text.muted 
                      : theme.status.info,
                    color: 'white',
                    cursor: !bulkText.trim() || scanning ? 'not-allowed' : 'pointer',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.semibold,
                    transition: `all ${theme.transition.normal}`,
                    boxShadow: theme.ui.shadow.sm,
                    opacity: !bulkText.trim() || scanning ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (bulkText.trim() && !scanning) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (bulkText.trim() && !scanning) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = theme.ui.shadow.sm;
                    }
                  }}
                >
                  {scanning ? '⏳ Scanning...' : '🔍 Scan Stocks'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TickerModal;