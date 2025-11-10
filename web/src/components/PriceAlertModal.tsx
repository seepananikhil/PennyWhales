import React, { useState, useEffect } from 'react';
import { MdDelete, MdDeleteForever } from 'react-icons/md';
import { theme } from '../theme';
import api from '../api';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  currentPrice: number;
}

const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  isOpen,
  onClose,
  ticker,
  currentPrice
}) => {
  const [targetPrice, setTargetPrice] = useState<string>(currentPrice.toFixed(2));
  const [condition, setCondition] = useState<'above' | 'below'>('below');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingAlerts, setExistingAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadExistingAlerts();
    }
  }, [isOpen, ticker]);

  const loadExistingAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const response = await api.getAlertsByTicker(ticker);
      setExistingAlerts(response.alerts.filter(a => a.active && !a.triggered));
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage('');
    try {
      await api.createAlert(ticker, price, condition);
      setSuccessMessage(`✅ Alert created! You'll be notified when ${ticker} goes ${condition} $${price.toFixed(2)}`);
      await loadExistingAlerts();
      setTargetPrice(currentPrice.toFixed(2));
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      console.error('Error creating alert:', error);
      setSuccessMessage('❌ Failed to create alert: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (alertId: string) => {
    if (deleteConfirm === alertId) {
      // Second click - confirm delete
      handleDeleteAlert(alertId);
      setDeleteConfirm(null);
    } else {
      // First click - show confirm
      setDeleteConfirm(alertId);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await api.deleteAlert(alertId);
      setSuccessMessage('✅ Alert removed successfully');
      await loadExistingAlerts();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error deleting alert:', error);
      setSuccessMessage('❌ Failed to delete alert');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: theme.borderRadius.lg,
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#4F46E5', fontSize: '1.5rem' }}>
            🔔 Set Price Alert
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#999',
              padding: '0 8px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: theme.borderRadius.md }}>
          <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '4px' }}>Current Price</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4F46E5' }}>
            {ticker}: ${currentPrice.toFixed(2)}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' }}>
              Alert Condition
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="above"
                  checked={condition === 'above'}
                  onChange={(e) => setCondition(e.target.value as 'above')}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '0.95rem' }}>⬆️ Price goes above</span>
              </label>
              <label style={{ flex: 1, cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="below"
                  checked={condition === 'below'}
                  onChange={(e) => setCondition(e.target.value as 'below')}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ fontSize: '0.95rem' }}>⬇️ Price drops below</span>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#333' }}>
              Target Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Enter target price"
              required
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                border: `1px solid ${theme.ui.border}`,
                borderRadius: theme.borderRadius.md,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: isSubmitting ? '#ccc' : '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#3730a3';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#4F46E5';
              }
            }}
          >
            {isSubmitting ? 'Creating Alert...' : '🔔 Create Alert'}
          </button>
        </form>

        {/* Success/Error Message */}
        {successMessage && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            backgroundColor: successMessage.startsWith('✅') ? '#d4edda' : '#f8d7da',
            color: successMessage.startsWith('✅') ? '#155724' : '#721c24',
            borderRadius: theme.borderRadius.md,
            fontSize: '0.9rem',
            border: successMessage.startsWith('✅') ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
          }}>
            {successMessage}
          </div>
        )}

        {/* Existing Alerts */}
        {existingAlerts.length > 0 && (
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${theme.ui.border}` }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#333' }}>
              Active Alerts ({existingAlerts.length})
            </h3>
            {existingAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: theme.borderRadius.md,
                  marginBottom: '8px'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                    {alert.condition === 'above' ? '⬆️' : '⬇️'} {alert.condition === 'above' ? 'Above' : 'Below'} ${alert.targetPrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                    Created: {new Date(alert.created).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClick(alert.id)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: deleteConfirm === alert.id ? '#b02a37' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {deleteConfirm === alert.id ? MdDeleteForever({}) : MdDelete({})}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceAlertModal;
