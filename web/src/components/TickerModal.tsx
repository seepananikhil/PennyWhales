import React, { useState } from 'react';
import { theme } from '../theme';

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

  if (!isOpen) return null;

  const handleSave = () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().toUpperCase())
      .filter(ticker => ticker.length > 0);
    
    if (replaceMode) {
      // Show confirmation before replacing
      setShowConfirmation(true);
    } else {
      // Add new tickers without replacing
      onAddNew(newTickers);
      setBulkText('');
      onClose();
    }
  };

  const handleConfirmReplace = () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().toUpperCase())
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
    if (!showConfirmation) {
      setBulkText('');
      setReplaceMode(false);
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
          borderRadius: theme.borderRadius.lg,
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: theme.ui.shadow.xl,
          border: `1px solid ${theme.ui.border}`
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
        <div style={{ padding: theme.spacing.xl }}>
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
                  : 'Enter new tickers to add to your existing list. Fire levels will be automatically analyzed.'
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
                  onClick={handleSave}
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TickerModal;