import React, { useState } from 'react';
import { theme } from '../theme';

interface TickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tickers: string[]) => void;
  currentTickers: string[];
}

const TickerModal: React.FC<TickerModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [bulkText, setBulkText] = useState<string>('');

  if (!isOpen) return null;

  const handleSave = () => {
    const newTickers = bulkText
      .split(/[,\s\n]+/)
      .map(ticker => ticker.trim().toUpperCase())
      .filter(ticker => ticker.length > 0);
    
    onSave(newTickers);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
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
            🎯 Add/Update Tickers
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: theme.ui.text.secondary,
              padding: theme.spacing.xs,
              borderRadius: theme.borderRadius.sm,
              transition: `all ${theme.transition.normal}`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.ui.background;
              e.currentTarget.style.color = theme.ui.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.ui.text.secondary;
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: theme.spacing.xl }}>
          <p 
            style={{
              margin: `0 0 ${theme.spacing.md} 0`,
              color: theme.ui.text.secondary,
              fontSize: theme.typography.fontSize.sm,
              lineHeight: '1.5'
            }}
          >
            Enter tickers separated by commas, spaces, or new lines. 
            This will replace your current ticker list.
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
              e.currentTarget.style.borderColor = theme.status.info;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.ui.border;
            }}
          />

          <div 
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.lg
            }}
          >
            <button
              onClick={onClose}
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
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                border: 'none',
                borderRadius: theme.borderRadius.md,
                backgroundColor: theme.status.info,
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
              Save Tickers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TickerModal;