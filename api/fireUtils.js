/**
 * Fire Level Calculation Utilities
 * Centralized logic for calculating institutional investment fire levels
 */

/**
 * Calculate fire level for a stock based on percentage holdings and market values
 * Considers both percentage ownership and absolute dollar values
 * @param {Object} stock - Stock object with blackrock_pct, vanguard_pct, blackrock_market_value, vanguard_market_value
 * @returns {number} Fire level (0, 3-5)
 */
function calculateFireLevel(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  const blackrockValue = stock.blackrock_market_value || 0;
  const vanguardValue = stock.vanguard_market_value || 0;
  
  const combinedPct = blackrockPct + vanguardPct;
  const combinedValue = blackrockValue + vanguardValue;
  
  // FIRE LEVEL 5 - Elite institutional confidence
  if (combinedValue >= 50 ||                    // Massive investment ($50M+)
      combinedPct >= 15 ||                      // Elite percentage (15%+)
      (blackrockPct >= 10 || vanguardPct >= 10)) { // Major fund strong conviction
    return 5;
  }
  
  // FIRE LEVEL 4 - Very high institutional confidence  
  if (combinedValue >= 30 ||                    // Large investment ($30M+)
      combinedPct >= 10 ||                      // High percentage (10%+)
      (blackrockPct >= 7 || vanguardPct >= 7)) { // Single fund strong commitment
    return 4;
  }
  
  // FIRE LEVEL 3 - High institutional confidence
  if (combinedValue >= 15 ||                    // Substantial investment ($15M+)
      combinedPct >= 7 ||                       // Good percentage (7%+)
      (blackrockPct >= 4 || vanguardPct >= 4)) { // Single fund good commitment
    return 3;
  }
  
  return 0; // Below meaningful thresholds
}

/**
 * Calculate recommendation level for a stock
 * @param {Object} stock - Stock object with fire_level, price, blackrock_pct, vanguard_pct, market_cap, ipo_date
 * @returns {string|null} Recommendation level or null
 */
function calculateRecommendation(stock) {
  const fireLevel = stock.fire_level || 0;
  const price = stock.price || 0;
  const marketCap = stock.market_cap || 0;
  
  // Must have fire level 4 or 5
  if (fireLevel < 4) return null;
  
  // Must have decent market cap (min 300M)
  if (marketCap < 300) return null;
  
  // Categorize by price and fire level
  if (fireLevel === 5) {
    if (price < 3) return 'STRONG_BUY';
    if (price < 5) return 'BUY';
    if (price < 10) return 'WATCH';
  } else if (fireLevel === 4) {
    if (price < 2) return 'STRONG_BUY';
    if (price < 4) return 'BUY';
    if (price < 8) return 'WATCH';
  }
  
  return null;
}

/**
 * Get fire level description
 * @param {number} fireLevel - Fire level (-1, 1-5)
 * @returns {string} Human readable description
 */
function getFireLevelDescription(fireLevel) {
  switch (fireLevel) {
    case 5:
      return 'Inferno 🔥🔥🔥🔥🔥 - Extreme institutional confidence';
    case 4:
      return 'Blazing 🔥🔥🔥🔥 - Very high confidence';
    case 3:
      return 'Hot 🔥🔥🔥 - High confidence';
    case 2:
      return 'Strong 🔥🔥 - Strong institutional interest';
    case 1:
      return 'Warm 🔥 - Meaningful but moderate interest';
    case -1:
    default:
      return 'Minimal Presence ❄️ - Below meaningful institutional thresholds';
  }
}

/**
 * Get fire level emoji
 * @param {number} fireLevel - Fire level (-1, 1-5)
 * @returns {string} Emoji representation
 */
function getFireLevelEmoji(fireLevel) {
  switch (fireLevel) {
    case 5:
      return '🔥🔥🔥🔥🔥';
    case 4:
      return '🔥🔥🔥🔥';
    case 3:
      return '🔥🔥🔥';
    case 2:
      return '🔥🔥';
    case 1:
      return '🔥';
    case -1:
    default:
      return '❄️';
  }
}

/**
 * Check if stock has zero or minimal institutional presence
 * @param {Object} stock - Stock object with blackrock_pct and vanguard_pct
 * @returns {boolean} True if absent or below meaningful thresholds
 */
function hasZeroPresence(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  return blackrockPct < 1.0 && vanguardPct < 1.0;
}

module.exports = {
  calculateFireLevel,
  getFireLevelDescription,
  getFireLevelEmoji,
  hasZeroPresence,
  calculateRecommendation
};