/**
 * Fire Level Calculation Utilities
 * Centralized logic for calculating institutional investment fire levels
 */

/**
 * Calculate fire level for a stock based solely on percentage holdings
 * Uses only percentage (pct) - ignoring market values
 * @param {Object} stock - Stock object with blackrock_pct, vanguard_pct
 * @returns {number} Fire level (0, 3-5)
 */
function calculateFireLevel(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  const combinedPct = blackrockPct + vanguardPct;
  
  // FIRE LEVEL 5 - Elite institutional confidence
  if (combinedPct >= 15 ||                      // Elite combined percentage (15%+)
      (blackrockPct >= 10 || vanguardPct >= 10)) { // Major fund strong conviction (10%+)
    return 5;
  }
  
  // FIRE LEVEL 4 - Very high institutional confidence  
  if (combinedPct >= 10 ||                      // High combined percentage (10%+)
      (blackrockPct >= 7 || vanguardPct >= 7)) { // Single fund strong commitment (7%+)
    return 4;
  }
  
  // FIRE LEVEL 3 - High institutional confidence
  if (combinedPct >= 7 ||                       // Good combined percentage (7%+)
      (blackrockPct >= 4 || vanguardPct >= 4)) { // Single fund good commitment (4%+)
    return 3;
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