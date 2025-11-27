import React from 'react';
import { theme, getFireLevelStyle, sectors as sectorConfig } from '../theme';
import { FaFilter, FaSort, FaTimes, FaFire, FaDollarSign, FaBriefcase, FaCalendarAlt, FaUsers, FaIndustry } from 'react-icons/fa';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    fireLevels: Set<number>;
    priceFilters: Set<string>;
    marketValueFilters: Set<string>;
    sectors: Set<string>;
    employeeCount: Set<string>;
    ipoDate: Set<string>;
  };
  onToggleFilter: (type: 'fire' | 'price' | 'marketValue' | 'sector' | 'employee' | 'ipo', value: any) => void;
  onClearFilters: () => void;
  sortBy: string;
  sortOrder?: string[];
  onSortChange: (sort: string) => void;
  availableSectors: string[];
}

const FilterSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
}> = ({ title, icon, children, isOpen = true }) => {
  const [isExpanded, setIsExpanded] = React.useState(isOpen);

  return (
    <div style={{ marginBottom: theme.spacing.lg, borderBottom: `1px solid ${theme.ui.border}`, paddingBottom: theme.spacing.md }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: theme.spacing.sm
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, fontWeight: 600, color: theme.ui.text.primary }}>
          {icon}
          <span>{title}</span>
        </div>
        <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </div>
      
      {isExpanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {children}
        </div>
      )}
    </div>
  );
};

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  icon?: string;
}> = ({ label, active, onClick, color = theme.status.info, icon }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: '20px',
      border: `1px solid ${active ? color : theme.ui.border}`,
      backgroundColor: active ? `${color}20` : theme.ui.surface,
      color: active ? color : theme.ui.text.secondary,
      fontSize: '0.85rem',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontWeight: active ? 600 : 400
    }}
  >
    {icon && <span>{icon}</span>}
    {label}
  </button>
);

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  filters,
  onToggleFilter,
  onClearFilters,
  sortBy,
  sortOrder = [],
  onSortChange,
  availableSectors
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            zIndex: 998,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: isOpen ? 0 : '-400px',
        width: '380px',
        height: '100vh',
        backgroundColor: theme.ui.surface,
        boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
        zIndex: 999,
        transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `1px solid ${theme.ui.border}`
      }}>
        {/* Header */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.ui.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.ui.background
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            {FaFilter({})}
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Filters & Sort</h2>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.ui.text.secondary,
              padding: theme.spacing.xs
            }}
          >
            {FaTimes({ size: 20 })}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: theme.spacing.lg }}>
          
          {/* Sort Section */}
          <FilterSection title="Sort By" icon={FaSort({})}>
            <select 
              value="" 
              onChange={(e) => onSortChange(e.target.value)}
              style={{
                width: '100%',
                padding: theme.spacing.sm,
                borderRadius: theme.borderRadius.md,
                border: `1px solid ${theme.ui.border}`,
                fontSize: '0.9rem',
                backgroundColor: theme.ui.surface,
                marginBottom: theme.spacing.sm
              }}
            >
              <option value="">Add Sort Criteria...</option>
              <option value="combined-desc">🔥 VG + BR + SS % (High to Low)</option>
              <option value="combined-asc">🔥 VG + BR + SS % (Low to High)</option>
              <option value="vg-desc">🔄 VG % (High to Low)</option>
              <option value="vg-asc">🔄 VG % (Low to High)</option>
              <option value="br-desc">🔄 BR % (High to Low)</option>
              <option value="br-asc">🔄 BR % (Low to High)</option>
              <option value="ss-desc">🔄 SS % (High to Low)</option>
              <option value="ss-asc">🔄 SS % (Low to High)</option>
              <option value="fire-desc">🔥 Fire Level (High to Low)</option>
              <option value="price-desc">💰 Price (High to Low)</option>
              <option value="price-asc">💰 Price (Low to High)</option>
              <option value="price-change-desc">📈 Price Change % (High to Low)</option>
              <option value="price-change-asc">📉 Price Change % (Low to High)</option>
              <option value="market-value-desc">💎 Market Value (High to Low)</option>
              <option value="market-value-asc">💎 Market Value (Low to High)</option>
              <option value="daily-gainers">📈 Daily Gainers</option>
              <option value="daily-losers">📉 Daily Losers</option>
              <option value="weekly-gainers">📅 Weekly Gainers</option>
              <option value="weekly-losers">📅 Weekly Losers</option>
              <option value="monthly-gainers">📅 Monthly Gainers</option>
              <option value="monthly-losers">📅 Monthly Losers</option>
              <option value="ipo-newest">🆕 IPO Date (Newest)</option>
              <option value="ipo-oldest">👴 IPO Date (Oldest)</option>
              <option value="employees-desc">👥 Employees (High to Low)</option>
              <option value="price-asc-combined-desc">🎯 Low Price + High % (Combo)</option>
              {sortOrder.length > 0 && <option value="CLEAR_ALL">❌ Clear All Sorts</option>}
            </select>

            {/* Active Sorts Display */}
            {sortOrder.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sortOrder.map((sortKey, index) => (
                  <div key={sortKey} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    backgroundColor: `${theme.status.info}15`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '0.85rem',
                    border: `1px solid ${theme.status.info}30`
                  }}>
                    <span style={{ fontWeight: 600, color: theme.status.info, marginRight: '8px' }}>{index + 1}.</span>
                    <span style={{ flex: 1 }}>
                      {sortKey === 'combined-desc' && 'VG + BR + SS % (High to Low)'}
                      {sortKey === 'combined-asc' && 'VG + BR + SS % (Low to High)'}
                      {sortKey === 'vg-desc' && 'VG % (High to Low)'}
                      {sortKey === 'vg-asc' && 'VG % (Low to High)'}
                      {sortKey === 'br-desc' && 'BR % (High to Low)'}
                      {sortKey === 'br-asc' && 'BR % (Low to High)'}
                      {sortKey === 'ss-desc' && 'SS % (High to Low)'}
                      {sortKey === 'ss-asc' && 'SS % (Low to High)'}
                      {sortKey === 'fire-desc' && 'Fire Level (High to Low)'}
                      {sortKey === 'price-desc' && 'Price (High to Low)'}
                      {sortKey === 'price-asc' && 'Price (Low to High)'}
                      {sortKey === 'price-change-desc' && 'Price Change % (High to Low)'}
                      {sortKey === 'price-change-asc' && 'Price Change % (Low to High)'}
                      {sortKey === 'market-value-desc' && 'Market Value (High to Low)'}
                      {sortKey === 'market-value-asc' && 'Market Value (Low to High)'}
                      {sortKey === 'daily-gainers' && 'Daily Gainers'}
                      {sortKey === 'daily-losers' && 'Daily Losers'}
                      {sortKey === 'weekly-gainers' && 'Weekly Gainers'}
                      {sortKey === 'weekly-losers' && 'Weekly Losers'}
                      {sortKey === 'monthly-gainers' && 'Monthly Gainers'}
                      {sortKey === 'monthly-losers' && 'Monthly Losers'}
                      {sortKey === 'ipo-newest' && 'IPO Date (Newest)'}
                      {sortKey === 'ipo-oldest' && 'IPO Date (Oldest)'}
                      {sortKey === 'employees-desc' && 'Employees (High to Low)'}
                      {sortKey === 'price-asc-combined-desc' && 'Low Price + High %'}
                    </span>
                    <button
                      onClick={() => onSortChange(sortKey)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.ui.text.secondary,
                        padding: '2px'
                      }}
                    >
                      {FaTimes({ size: 12 })}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FilterSection>

          {/* Fire Level */}
          <FilterSection title="Fire Level" icon={FaFire({})}>
            {[5, 4, 3, 2, 1].map(level => (
              <FilterChip
                key={level}
                label={`${level} Fire`}
                icon={getFireLevelStyle(level).emoji}
                active={filters.fireLevels.has(level)}
                onClick={() => onToggleFilter('fire', level)}
                color={getFireLevelStyle(level).primary}
              />
            ))}
          </FilterSection>

          {/* Price */}
          <FilterSection title="Price" icon={FaDollarSign({})}>
            {[
              { id: 'under3', label: '< $3' },
              { id: '3to5', label: '$3 - $5' },
              { id: '5to10', label: '$5 - $10' },
              { id: '10to15', label: '$10 - $15' },
              { id: 'over15', label: '$15+' }
            ].map(opt => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.priceFilters.has(opt.id)}
                onClick={() => onToggleFilter('price', opt.id)}
                color="#28a745"
              />
            ))}
          </FilterSection>

          {/* Market Cap */}
          <FilterSection title="Market Cap" icon={FaBriefcase({})}>
            {[
              { id: 'under10', label: '< $10M' },
              { id: '10to50', label: '$10M - $50M' },
              { id: '50to100', label: '$50M - $100M' },
              { id: 'over100', label: '$100M+' }
            ].map(opt => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.marketValueFilters.has(opt.id)}
                onClick={() => onToggleFilter('marketValue', opt.id)}
                color="#6f42c1"
              />
            ))}
          </FilterSection>

          {/* Sectors */}
          <FilterSection title="Sector" icon={FaIndustry({})}>
            {availableSectors.map(sector => {
              const config = sectorConfig[sector as keyof typeof sectorConfig];
              return (
                <FilterChip
                  key={sector}
                  label={sector}
                  icon={config?.icon}
                  active={filters.sectors.has(sector)}
                  onClick={() => onToggleFilter('sector', sector)}
                  color={config?.color || theme.ui.text.primary}
                />
              );
            })}
          </FilterSection>

          {/* Employee Count */}
          <FilterSection title="Employees" icon={FaUsers({})}>
            {[
              { id: 'under100', label: '< 100' },
              { id: '100to500', label: '100 - 500' },
              { id: '500to1000', label: '500 - 1k' },
              { id: 'over1000', label: '1k+' }
            ].map(opt => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.employeeCount.has(opt.id)}
                onClick={() => onToggleFilter('employee', opt.id)}
                color="#17a2b8"
              />
            ))}
          </FilterSection>

          {/* IPO Date */}
          <FilterSection title="IPO Date" icon={FaCalendarAlt({})}>
            {[
              { id: 'lastYear', label: 'Last Year' },
              { id: 'last3Years', label: 'Last 3 Years' },
              { id: 'last5Years', label: 'Last 5 Years' },
              { id: 'older', label: 'Older' }
            ].map(opt => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.ipoDate.has(opt.id)}
                onClick={() => onToggleFilter('ipo', opt.id)}
                color="#e83e8c"
              />
            ))}
          </FilterSection>

        </div>

        {/* Footer */}
        <div style={{
          padding: theme.spacing.lg,
          borderTop: `1px solid ${theme.ui.border}`,
          backgroundColor: theme.ui.background
        }}>
          <button
            onClick={onClearFilters}
            style={{
              width: '100%',
              padding: theme.spacing.md,
              backgroundColor: theme.ui.surface,
              border: `1px solid ${theme.ui.border}`,
              borderRadius: theme.borderRadius.md,
              color: theme.status.danger,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff5f5'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = theme.ui.surface}
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </>
  );
};

export default FilterPanel;
