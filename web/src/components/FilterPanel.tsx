import React from "react";
import { theme, getFireLevelStyle, sectors as sectorConfig } from "../theme";
import {
  FaFilter,
  FaSort,
  FaTimes,
  FaFire,
  FaDollarSign,
  FaBriefcase,
  FaCalendarAlt,
  FaUsers,
  FaIndustry,
} from "react-icons/fa";
import { BsSortDown, BsSortUp } from "react-icons/bs";

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
    recommendations: Set<string>;
    industries: Set<string>;
    volumeFilter: Set<string>;
  };
  onToggleFilter: (
    type:
      | "fire"
      | "price"
      | "marketValue"
      | "sector"
      | "employee"
      | "ipo"
      | "recommendation"
      | "industry"
      | "volume",
    value: any
  ) => void;
  onClearFilters: () => void;
  sortBy: string;
  sortOrder?: string[];
  onSortChange: (sort: string) => void;
  availableSectors: string[];
  availableIndustries: string[];
}

const FilterSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
}> = ({ title, icon, children, isOpen = true }) => {
  const [isExpanded, setIsExpanded] = React.useState(isOpen);

  return (
    <div
      style={{
        marginBottom: theme.spacing.lg,
        borderBottom: `1px solid ${theme.ui.border}`,
        paddingBottom: theme.spacing.md,
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          marginBottom: theme.spacing.sm,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.sm,
            fontWeight: 600,
            color: theme.ui.text.primary,
          }}
        >
          {icon}
          <span>{title}</span>
        </div>
        <span
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </div>

      {isExpanded && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm }}
        >
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
      padding: "6px 12px",
      borderRadius: "20px",
      border: `1px solid ${active ? color : theme.ui.border}`,
      backgroundColor: active ? `${color}20` : theme.ui.surface,
      color: active ? color : theme.ui.text.secondary,
      fontSize: "0.85rem",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontWeight: active ? 600 : 400,
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
  availableSectors,
  availableIndustries,
}) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 998,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: isOpen ? 0 : "-400px",
          width: "320px",
          height: "100vh",
          backgroundColor: theme.ui.surface,
          boxShadow: "-4px 0 16px rgba(0,0,0,0.1)",
          zIndex: 999,
          transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          borderLeft: `1px solid ${theme.ui.border}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: theme.spacing.lg,
            borderBottom: `1px solid ${theme.ui.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: theme.ui.background,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.sm,
            }}
          >
            {FaFilter({})}
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Filters & Sort</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.ui.text.secondary,
              padding: theme.spacing.xs,
            }}
          >
            {FaTimes({ size: 20 })}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: theme.spacing.lg }}>
          {/* Sort Section */}
          <FilterSection title="Sort By" icon={FaSort({})}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm,
              }}
            >
              {[
                { key: "combined", label: "🔥 Big 3 %", icon: "🔥" },
                { key: "fire", label: "🔥 Fire Level", icon: "🔥" },
                { key: "holdings-value", label: "💎 Holdings $", icon: "💎" },
                { key: "holdings-change", label: "📊 Holdings %", icon: "📊" },
                { key: "price", label: "💰 Price", icon: "💰" },
                { key: "daily-change", label: "📈 Daily %", icon: "📈" },
                { key: "weekly-change", label: "📅 Weekly %", icon: "📅" },
                { key: "monthly-change", label: "📆 Monthly %", icon: "📆" },
                { key: "market-value", label: "💎 Market Cap", icon: "💎" },
                { key: "employees", label: "👥 Employees", icon: "👥" },
                { key: "inst-trans", label: "🟢 Inst. Activity", icon: "📊" },
                { key: "inst-own", label: "🏢 Inst. Own", icon: "🏢" },
                { key: "ipo-date", label: "📅 IPO Date", icon: "📅" },
                { key: "sma200", label: "📊 SMA200", icon: "📊" },
              ].map((sort) => {
                const descKey = `${sort.key}-desc`;
                const ascKey = `${sort.key}-asc`;
                const isDescActive = sortOrder.includes(descKey);
                const isAscActive = sortOrder.includes(ascKey);
                const isActive = isDescActive || isAscActive;

                return (
                  <button
                    key={sort.key}
                    onClick={(e) => {
                      e.preventDefault();
                      // Toggle between desc and asc indefinitely
                      if (!isActive) {
                        // First click: Add desc
                        onSortChange(descKey);
                      } else if (isDescActive) {
                        // Currently desc, switch to asc
                        onSortChange(`TOGGLE_${sort.key}_TO_ASC`);
                      } else {
                        // Currently asc, switch to desc
                        onSortChange(`TOGGLE_${sort.key}_TO_DESC`);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Double click removes the sort
                      if (isDescActive) onSortChange(descKey);
                      if (isAscActive) onSortChange(ascKey);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: `1px solid ${
                        isActive ? theme.status.info : theme.ui.border
                      }`,
                      backgroundColor: isActive
                        ? `${theme.status.info}15`
                        : theme.ui.surface,
                      color: isActive
                        ? theme.status.info
                        : theme.ui.text.secondary,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "4px",
                      fontWeight: isActive ? 600 : 400,
                      width: "100%",
                    }}
                  >
                    <span>{sort.label}</span>
                    <span
                      style={{
                        fontSize: "1rem",
                        display: "flex",
                        alignItems: "center",
                        minWidth: "16px",
                        justifyContent: "center",
                      }}
                    >
                      {isDescActive
                        ? BsSortDown({})
                        : isAscActive
                        ? BsSortUp({})
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {sortOrder.length > 0 && (
              <button
                onClick={() => onSortChange("CLEAR_ALL")}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: `1px solid ${theme.status.danger}`,
                  backgroundColor: `${theme.status.danger}10`,
                  color: theme.status.danger,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ❌ Clear All Sorts
              </button>
            )}
          </FilterSection>

          {/* Fire Level */}
          <FilterSection title="Fire Level" icon={FaFire({})}>
            {[5, 4, 3, 2, 1].map((level) => (
              <FilterChip
                key={level}
                label={`${level} Fire`}
                icon={getFireLevelStyle(level).emoji}
                active={filters.fireLevels.has(level)}
                onClick={() => onToggleFilter("fire", level)}
                color={getFireLevelStyle(level).primary}
              />
            ))}
          </FilterSection>

          {/* Price */}
          <FilterSection title="Price" icon={FaDollarSign({})}>
            {[
              { id: "under1", label: "< $1" },
              { id: "1to3", label: "$1 - $3" },
              { id: "3to5", label: "$3 - $5" },
              { id: "5to10", label: "$5 - $10" },
              { id: "over10", label: "$10+" },
            ].map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.priceFilters.has(opt.id)}
                onClick={() => onToggleFilter("price", opt.id)}
                color="#28a745"
              />
            ))}
          </FilterSection>

          {/* Market Cap */}
          <FilterSection title="Market Cap" icon={FaBriefcase({})}>
            {[
              { id: "under100", label: "🔬 < $100M" },
              { id: "100to300", label: "💎 $100M - $300M" },
              { id: "300to1b", label: "📊 $300M - $1B" },
              { id: "over1b", label: "🏛️ $1B+" },
            ].map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.marketValueFilters.has(opt.id)}
                onClick={() => onToggleFilter("marketValue", opt.id)}
                color="#6f42c1"
              />
            ))}
          </FilterSection>

          {/* Volume */}
          <FilterSection title="Avg Volume" icon={<span style={{ fontSize: "1.2rem" }}>📊</span>}>
            {[
              { id: "under500k", label: "< 500K" },
              { id: "500kto1m", label: "500K - 1M" },
              { id: "1mto2m", label: "1M - 2M" },
              { id: "2mto5m", label: "2M - 5M" },
              { id: "5mto10m", label: "5M - 10M" },
              { id: "over10m", label: "> 10M" },
            ].map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.volumeFilter.has(opt.id)}
                onClick={() => onToggleFilter("volume", opt.id)}
                color="#17a2b8"
              />
            ))}
          </FilterSection>

          {/* Sectors */}
          <FilterSection title="Sector" icon={FaIndustry({})}>
            {availableSectors.map((sector) => {
              const config = sectorConfig[sector as keyof typeof sectorConfig];
              return (
                <FilterChip
                  key={sector}
                  label={sector}
                  icon={config?.icon}
                  active={filters.sectors.has(sector)}
                  onClick={() => onToggleFilter("sector", sector)}
                  color={config?.color || theme.ui.text.primary}
                />
              );
            })}
          </FilterSection>

          {/* Industries - Only show when sectors are selected */}
          <FilterSection
            title="Industry"
            icon={<span style={{ fontSize: "1.2rem" }}>🏭</span>}
            isOpen={false}
          >
            {availableIndustries.length > 0 ? (
              availableIndustries.map((industry) => (
                <FilterChip
                  key={industry}
                  label={industry}
                  active={filters.industries.has(industry)}
                  onClick={() => onToggleFilter("industry", industry)}
                  color="#6c757d"
                />
              ))
            ) : (
              <div
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.ui.text.secondary,
                  fontStyle: "italic",
                  padding: theme.spacing.sm,
                }}
              >
                No industries available for selected sectors
              </div>
            )}
          </FilterSection>

          {/* Employee Count */}
          <FilterSection title="Employees" icon={FaUsers({})}>
            {[
              { id: "under50", label: "🔬 Micro (< 50)" },
              { id: "50to200", label: "🏠 Small (50 - 200)" },
              { id: "200to1000", label: "🏢 Medium (200 - 1k)" },
              { id: "1000to5000", label: "🏭 Large (1k - 5k)" },
              { id: "over5000", label: "🏛️ Enterprise (5k+)" },
            ].map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.employeeCount.has(opt.id)}
                onClick={() => onToggleFilter("employee", opt.id)}
                color="#17a2b8"
              />
            ))}
          </FilterSection>

          {/* IPO Date */}
          <FilterSection title="IPO Date" icon={FaCalendarAlt({})}>
            {[
              { id: "lastYear", label: "Last Year" },
              { id: "last3Years", label: "Last 3 Years" },
              { id: "last5Years", label: "Last 5 Years" },
              { id: "older", label: "Older" },
            ].map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.ipoDate.has(opt.id)}
                onClick={() => onToggleFilter("ipo", opt.id)}
                color="#e83e8c"
              />
            ))}
          </FilterSection>

          {/* Recommendation */}
          <FilterSection
            title="Recommendation"
            icon={<span style={{ fontSize: "1.2rem" }}>⭐</span>}
          >
            {[
              {
                id: "STRONG_BUY",
                label: "🔥🔥🔥 Strong Buy",
                color: "#dc3545",
              },
              { id: "BUY", label: "🔥🔥 Buy", color: "#fd7e14" },
              { id: "WATCH", label: "🔥 Watch", color: "#ffc107" },
              { id: "NONE", label: "❄️ No Recommendation", color: "#6c757d" },
            ].map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                active={filters.recommendations.has(opt.id)}
                onClick={() => onToggleFilter("recommendation", opt.id)}
                color={opt.color}
              />
            ))}
          </FilterSection>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: theme.spacing.lg,
            borderTop: `1px solid ${theme.ui.border}`,
            backgroundColor: theme.ui.background,
          }}
        >
          <button
            onClick={onClearFilters}
            style={{
              width: "100%",
              padding: theme.spacing.md,
              backgroundColor: theme.ui.surface,
              border: `1px solid ${theme.ui.border}`,
              borderRadius: theme.borderRadius.md,
              color: theme.status.danger,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#fff5f5")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = theme.ui.surface)
            }
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </>
  );
};

export default FilterPanel;
