/**
 * Fire Level Calculation Utilities
 * Centralized logic for calculating institutional investment fire levels
 */

/**
 * Calculate fire level for a stock with improved nuanced thresholds
 * @param {Object} stock - Stock object with blackrock_pct and vanguard_pct
 * @returns {number} Fire level (0-3)
 */
function calculateFireLevel(stock) {
  const blackrockPct = stock.blackrock_pct || 0;
  const vanguardPct = stock.vanguard_pct || 0;
  const combinedPct = blackrockPct + vanguardPct;
  
  // Fire Level 3 (Blazing 🔥🔥🔥): Highest confidence
  if ((blackrockPct >= 4 && vanguardPct >= 4) || // Both funds ≥4%
      blackrockPct >= 7 || vanguardPct >= 7) {   // OR one fund ≥7%
    return 3;
  }
  
  // Fire Level 2 (Strong 🔥🔥): Strong institutional interest
  if (blackrockPct >= 4 || vanguardPct >= 4 ||     // One fund ≥4%
      (blackrockPct >= 2 && vanguardPct >= 2) ||   // Both funds ≥2%
      combinedPct >= 6) {                          // Combined ≥6%
    return 2;
  }
  
  // Fire Level 1 (Warm 🔥): Meaningful but moderate interest
  if (blackrockPct >= 2 || vanguardPct >= 2 ||     // One fund ≥2%
      (blackrockPct >= 1 && vanguardPct >= 1) ||   // Both funds ≥1%
      combinedPct >= 3) {                          // Combined ≥3%
    return 1;
  }
  
  return 0; // No fire rating
}

/**
 * Get fire level description
 * @param {number} fireLevel - Fire level (0-3)
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
    default:
      return 'No Fire - Below institutional interest thresholds';
  }
}

/**
 * Get fire level emoji
 * @param {number} fireLevel - Fire level (0-3)
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
    default:
      return '';
  }
}

module.exports = {
  calculateFireLevel,
  getFireLevelDescription,
  getFireLevelEmoji
};