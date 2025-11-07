/**
 * Fire Level Calculation Utilities
 * Centralized logic for calculating institutional investment fire levels
 */

/**
 * Calculate fire level for a stock with enhanced granular levels
 * @param {Object} stock - Stock object with blackrock_pct and vanguard_pct
 * @returns {number} Fire level (-1, 1-5, where -1 = zero/minimal presence)
 */
function calculateFireLevel(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  const combinedPct = blackrockPct + vanguardPct;
  
  // Fire Level -1 (Zero/Minimal Presence ❄️): Absent or below meaningful thresholds
  if (blackrockPct < 1.0 && vanguardPct < 1.0) {
    return -1;
  }
  
  // Fire Level 5 (Inferno 🔥🔥🔥🔥🔥): Extreme institutional confidence
  if ((blackrockPct >= 10 && vanguardPct >= 10) ||   // Both funds ≥10%
      blackrockPct >= 10 || vanguardPct >= 10 ||     // OR one fund ≥10%
      combinedPct >= 15) {                           // OR combined ≥15%
    return 5;
  }
  
  // Fire Level 4 (Blazing 🔥🔥🔥🔥): Very high confidence
  if ((blackrockPct >= 7 && vanguardPct >= 7) ||     // Both funds ≥7%
      blackrockPct >= 8 || vanguardPct >= 8 ||       // OR one fund ≥8%
      combinedPct >= 12) {                           // OR combined ≥12%
    return 4;
  }
  
  // Fire Level 3 (Hot 🔥🔥🔥): High confidence
  if ((blackrockPct >= 5 && vanguardPct >= 5) ||     // Both funds ≥5%
      blackrockPct >= 6 || vanguardPct >= 6 ||       // OR one fund ≥6%
      combinedPct >= 9) {                            // OR combined ≥9%
    return 3;
  }
  
  // Fire Level 2 (Strong 🔥🔥): Strong institutional interest
  if ((blackrockPct >= 3 && vanguardPct >= 3) ||     // Both funds ≥3%
      blackrockPct >= 4 || vanguardPct >= 4 ||       // OR one fund ≥4%
      combinedPct >= 6) {                            // OR combined ≥6%
    return 2;
  }
  
  // Fire Level 1 (Warm 🔥): Meaningful but moderate interest
  if ((blackrockPct >= 2 && vanguardPct >= 2) ||     // Both funds ≥2%
      blackrockPct >= 2 || vanguardPct >= 2 ||       // OR one fund ≥2%
      combinedPct >= 3) {                            // OR combined ≥3%
    return 1;
  }
  
  return -1; // Below Fire Level 1 thresholds - treat as minimal presence
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
  hasZeroPresence
};