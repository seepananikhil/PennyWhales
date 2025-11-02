import React from 'react';
import { useTheme } from './ThemeContext';

const Categories: React.FC = () => {
  const { theme } = useTheme();

  const ratingCriteria = [
    {
      rating: 1,
      label: "🔥 Moderate",
      criteria: "At least one (Vanguard or BlackRock) ≥ 5%, and price ≤ $2",
      formula: "(V ≥ 5% or B ≥ 5%) and price ≤ $2",
      description: "Stocks with solid institutional backing from at least one major fund",
      color: "#ff9f43"
    },
    {
      rating: 2,
      label: "🔥🔥 Strong",
      criteria: "Both Vanguard & BlackRock ≥ 5%, and price ≤ $2",
      formula: "(V ≥ 5% and B ≥ 5%) and price ≤ $2",
      description: "Stocks with strong institutional confidence from both major funds",
      color: "#ff6348"
    },
    {
      rating: 3,
      label: "🔥🔥🔥 Excellent",
      criteria: "Both Vanguard & BlackRock ≥ 5%, and price < $1 (deep value + heavy institutional presence)",
      formula: "(V ≥ 5% and B ≥ 5%) and price < $1",
      description: "Premium deep value stocks with exceptional institutional backing",
      color: "#e55039"
    }
  ];

  const priorityTiers = [
    {
      tier: 1,
      label: "📈 High Priority",
      description: "Both BlackRock and Vanguard holdings ≥ 4%",
      criteria: "Strong institutional confidence with dual backing"
    },
    {
      tier: 2,
      label: "📊 Medium Priority", 
      description: "One major fund holding ≥ 3%",
      criteria: "Moderate institutional interest"
    },
    {
      tier: 3,
      label: "⚠️ Low Priority",
      description: "Below medium priority thresholds",
      criteria: "Lower institutional backing"
    }
  ];

  return (
    <div className="categories-container">
      <div className="categories-header">
        <h1>📊 Stock Rating Categories</h1>
        <p>Understanding our fire rating system and priority tiers</p>
      </div>

      {/* Fire Rating System */}
      <section className="rating-section">
        <h2>🔥 Fire Rating System</h2>
        <p className="section-description">
          Our fire rating system identifies stocks with exceptional institutional backing and value potential.
          Ratings are based on Vanguard and BlackRock holdings combined with price thresholds.
        </p>
        
        <div className="rating-grid">
          {ratingCriteria.map((rating) => (
            <div key={rating.rating} className="rating-card" style={{borderLeftColor: rating.color}}>
              <div className="rating-header">
                <span className="rating-label">{rating.label}</span>
                <span className="rating-number">Rating {rating.rating}</span>
              </div>
              
              <div className="rating-content">
                <div className="criteria-section">
                  <h4>Criteria:</h4>
                  <p>{rating.criteria}</p>
                </div>
                
                <div className="formula-section">
                  <h4>Formula:</h4>
                  <code>{rating.formula}</code>
                </div>
                
                <div className="description-section">
                  <h4>What it means:</h4>
                  <p>{rating.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Priority Tiers */}
      <section className="priority-section">
        <h2>📊 Priority Tier System</h2>
        <p className="section-description">
          Priority tiers categorize stocks based on overall institutional interest levels.
          Higher tiers indicate stronger institutional confidence.
        </p>
        
        <div className="priority-grid">
          {priorityTiers.map((tier) => (
            <div key={tier.tier} className="priority-card">
              <div className="priority-header">
                <span className="priority-label">{tier.label}</span>
                <span className="priority-tier">Tier {tier.tier}</span>
              </div>
              
              <div className="priority-content">
                <p className="priority-description">{tier.description}</p>
                <p className="priority-criteria">{tier.criteria}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Additional Information */}
      <section className="info-section">
        <h2>💡 Key Insights</h2>
        <div className="insights-grid">
          <div className="insight-card">
            <h3>🏛️ Institutional Holdings</h3>
            <p>
              Vanguard and BlackRock are two of the world's largest asset managers. 
              High holdings from these institutions often indicate strong fundamental confidence in a stock.
            </p>
          </div>
          
          <div className="insight-card">
            <h3>💰 Price Thresholds</h3>
            <p>
              Lower price points (under $1-$2) combined with high institutional backing 
              can indicate deep value opportunities with significant upside potential.
            </p>
          </div>
          
          <div className="insight-card">
            <h3>🎯 Combined Analysis</h3>
            <p>
              Our system combines institutional confidence (holdings) with value metrics (price) 
              to identify stocks with the best risk-adjusted return potential.
            </p>
          </div>
        </div>
      </section>

      {/* Legend */}
      <section className="legend-section">
        <h2>📝 Legend</h2>
        <div className="legend-content">
          <div className="legend-item">
            <strong>V:</strong> Vanguard Holdings Percentage
          </div>
          <div className="legend-item">
            <strong>B:</strong> BlackRock Holdings Percentage
          </div>
          <div className="legend-item">
            <strong>Price:</strong> Current stock price in USD
          </div>
        </div>
      </section>
    </div>
  );
};

export default Categories;