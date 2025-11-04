/**
 * Fire Level Calculation Utilities
 * Centralized logic for calculating institutional investment fire levels
 */

// Minimum percentage to be considered meaningful (below this is treated as zero)
const MIN_MEANINGFUL_PERCENTAGE = 1.0;

/**
 * Calculate fire level for a stock with improved nuanced thresholds
 * @param {Object} stock - Stock object with blackrock_pct and vanguard_pct
 * @returns {number} Fire level (-1 to 3, where -1 = zero presence)
 */
function calculateFireLevel(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  const combinedPct = blackrockPct + vanguardPct;
  
  // Treat negligible amounts (< 1%) as zero
  const meaningfulBlackrock = blackrockPct >= MIN_MEANINGFUL_PERCENTAGE ? blackrockPct : 0;
  const meaningfulVanguard = vanguardPct >= MIN_MEANINGFUL_PERCENTAGE ? vanguardPct : 0;
  const meaningfulCombined = meaningfulBlackrock + meaningfulVanguard;
  
  // Fire Level -1 (Zero Presence ❄️): Completely absent from institutional radar
  if (meaningfulBlackrock === 0 && meaningfulVanguard === 0) {
    return -1;
  }
  
  // Fire Level 3 (Blazing 🔥🔥🔥): Highest confidence
  if ((meaningfulBlackrock >= 4 && meaningfulVanguard >= 4) || // Both funds ≥4%
      meaningfulBlackrock >= 7 || meaningfulVanguard >= 7) {   // OR one fund ≥7%
    return 3;
  }
  
  // Fire Level 2 (Strong 🔥🔥): Strong institutional interest
  if (meaningfulBlackrock >= 4 || meaningfulVanguard >= 4 ||     // One fund ≥4%
      (meaningfulBlackrock >= 2 && meaningfulVanguard >= 2) ||   // Both funds ≥2%
      meaningfulCombined >= 6) {                                 // Combined ≥6%
    return 2;
  }
  
  // Fire Level 1 (Warm 🔥): Meaningful but moderate interest
  if (meaningfulBlackrock >= 2 || meaningfulVanguard >= 2 ||     // One fund ≥2%
      (meaningfulBlackrock >= 1 && meaningfulVanguard >= 1) ||   // Both funds ≥1%
      meaningfulCombined >= 3) {                                 // Combined ≥3%
    return 1;
  }
  
  return 0; // Minimal fire rating (some presence but below thresholds)
}

/**
 * Get fire level description
 * @param {number} fireLevel - Fire level (-1 to 3)
 * @returns {string} Human readable description
 */
function getFireLevelDescription(fireLevel) {
  switch (fireLevel) {
    case 3:
      return 'Blazing 🔥🔥🔥 - Highest confidence';
    case 2:
      return 'Strong 🔥🔥 - Strong institutional interest';
    case 1:
      return 'Warm 🔥 - Meaningful but moderate interest';
    case 0:
      return 'Minimal 🌡️ - Some presence but below thresholds';
    case -1:
    default:
      return 'Zero Presence ❄️ - Completely absent from institutional radar';
  }
}

/**
 * Get fire level emoji
 * @param {number} fireLevel - Fire level (-1 to 3)
 * @returns {string} Emoji representation
 */
function getFireLevelEmoji(fireLevel) {
  switch (fireLevel) {
    case 3:
      return '🔥🔥🔥';
    case 2:
      return '🔥🔥';
    case 1:
      return '🔥';
    case 0:
      return '🌡️';
    case -1:
    default:
      return '❄️';
  }
}

/**
 * Check if stock has zero institutional presence (including negligible amounts)
 * @param {Object} stock - Stock object with blackrock_pct and vanguard_pct
 * @returns {boolean} True if completely absent or negligible from both funds
 */
function hasZeroPresence(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  return blackrockPct < MIN_MEANINGFUL_PERCENTAGE && vanguardPct < MIN_MEANINGFUL_PERCENTAGE;
}

/**
 * Check if stock has minimal presence (some but below fire thresholds)
 * @param {Object} stock - Stock object with blackrock_pct and vanguard_pct
 * @returns {boolean} True if has some presence but below fire level 1
 */
function hasMinimalPresence(stock) {
  return calculateFireLevel(stock) === 0;
}

module.exports = {
  calculateFireLevel,
  getFireLevelDescription,
  getFireLevelEmoji,
  hasZeroPresence,
  hasMinimalPresence,
  MIN_MEANINGFUL_PERCENTAGE
};