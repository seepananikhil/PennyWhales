/**
 * Fire Level Calculation Utilities
 * Centralized logic for calculating institutional investment fire levels
 */

/**
 * Calculate fire level for a stock with enhanced granular levels
 * Uses both percentage holdings AND market values for stable weightage
 * @param {Object} stock - Stock object with blackrock_pct, vanguard_pct, blackrock_market_value, vanguard_market_value
 * @returns {number} Fire level (-1, 1-5, where -1 = zero/minimal presence)
 */
function calculateFireLevel(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  const combinedPct = blackrockPct + vanguardPct;
  
  // Market values in millions (converted from API thousands)
  const blackrockValue = stock.blackrock_market_value || 0;
  const vanguardValue = stock.vanguard_market_value || 0;
  const combinedValue = blackrockValue + vanguardValue;
  
  // Simple tiered approach - check elite conditions first, then fall through
  
  // FIRE LEVEL 5 - Elite institutional confidence
  if (combinedValue >= 50 ||                    // Massive investment ($50M+)
      combinedPct >= 15 ||                      // Elite percentage (15%+)
      (blackrockPct >= 10 || vanguardPct >= 10)) { // Major fund strong conviction
    return 5;
  }
  
  // FIRE LEVEL 4 - Very high institutional confidence  
  if (combinedValue >= 30 ||                    // Large investment ($30M+)
      combinedPct >= 10 ||                      // High percentage (10%+)
      (blackrockPct >= 7 || vanguardPct >= 7)) {    // Single fund strong commitment
    return 4;
  }
  
  // FIRE LEVEL 3 - High institutional confidence
  if (combinedValue >= 15 ||                    // Substantial investment ($15M+)
      combinedPct >= 7 ||                       // Good percentage (7%+)
      (blackrockPct >= 5 || vanguardPct >= 5)) {    // Single fund good commitment
    return 3;
  }
  
  // FIRE LEVEL 2 - Good institutional interest
  if (combinedValue >= 5 ||                     // Decent investment ($5M+)
      combinedPct >= 4 ||                       // Fair percentage (4%+)
      (blackrockPct >= 3 || vanguardPct >= 3)) {    // Single fund fair commitment
    return 2;
  }
  
  // FIRE LEVEL 1 - Minimal but meaningful presence
  if (combinedValue >= 1 ||                     // Some investment ($1M+)
      combinedPct >= 2 ||                       // Basic percentage (2%+)
      (blackrockPct >= 1.5 || vanguardPct >= 1.5)) { // Single fund basic commitment
    return 1;
  }
  
  return 0; // Below meaningful thresholds
}/**
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
  hasZeroPresence
};