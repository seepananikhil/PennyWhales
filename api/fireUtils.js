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
 * Calculate recommendation level for a stock - focuses on identifying oversold opportunities
 * @param {Object} stock - Stock object with fire_level, price, market_cap, inst_trans, inst_own, sma200, performance
 * @returns {string|null} Recommendation level or null
 */
function calculateRecommendation(stock) {
  const fireLevel = stock.fire_level || 0;
  const price = stock.price || 0;
  const marketCap = stock.market_cap || 0;
  const instTrans = stock.inst_trans || 0;
  const instOwn = stock.inst_own || 0;
  const sma200 = stock.sma200 || 0;
  const performance = stock.performance || {};
  
  // Must have fire level 4 or 5 (strong institutional backing)
  if (fireLevel < 4) return null;
  
  // Must have decent market cap (min 300M for stability)
  if (marketCap < 300) return null;
  
  // Calculate valuation score (0-100) - OVERSOLD FOCUSED
  let valuationScore = 0;
  
  // 1. Price Score (25 points) - Lower price = better value for penny stocks
  if (price < 2) valuationScore += 25;
  else if (price < 3) valuationScore += 20;
  else if (price < 5) valuationScore += 15;
  else if (price < 8) valuationScore += 10;
  else if (price < 10) valuationScore += 5;
  
  // 2. Institutional Activity Score (25 points) - Recent buying while price is down = VALUE
  if (instTrans > 10) valuationScore += 25;      // Very strong buying (smart money accumulating)
  else if (instTrans > 5) valuationScore += 20;  // Strong buying
  else if (instTrans > 0) valuationScore += 15;  // Moderate buying
  else if (instTrans > -5) valuationScore += 5;  // Neutral to slight selling
  // Below -5 gets 0 points (net selling - avoid)
  
  // 3. Institutional Ownership Score (20 points) - High ownership = they still believe
  if (instOwn >= 80) valuationScore += 20;
  else if (instOwn >= 70) valuationScore += 17;
  else if (instOwn >= 60) valuationScore += 14;
  else if (instOwn >= 50) valuationScore += 10;
  else if (instOwn >= 40) valuationScore += 5;
  
  // 4. OVERSOLD Technical Score (20 points) - Below 200MA = oversold opportunity
  if (sma200 >= -50 && sma200 < -30) valuationScore += 20;     // Deeply oversold but not crashed
  else if (sma200 >= -30 && sma200 < -20) valuationScore += 18; // Very oversold
  else if (sma200 >= -20 && sma200 < -10) valuationScore += 15; // Oversold
  else if (sma200 >= -10 && sma200 < -5) valuationScore += 10;  // Moderately oversold
  else if (sma200 >= -5 && sma200 < 0) valuationScore += 5;     // Slightly oversold
  // Above 200MA gets fewer points (not oversold)
  else if (sma200 >= 0 && sma200 < 5) valuationScore += 3;
  
  // 5. OVERSOLD Momentum Score (10 points) - Recent weakness = buying opportunity
  const monthPerf = performance.month || 0;
  const weekPerf = performance.week || 0;
  const quarterPerf = performance.quarter || 0;
  
  // Best: Down significantly but showing signs of bottoming/recovering
  if (monthPerf < -15 && weekPerf > 0) valuationScore += 10;       // Bottoming pattern (oversold + recovery)
  else if (monthPerf < -20 && weekPerf > -5) valuationScore += 9;  // Deep oversold, stabilizing
  else if (monthPerf < -10 && weekPerf >= -2) valuationScore += 7; // Moderate oversold, stabilizing
  else if (quarterPerf < -30 && monthPerf > quarterPerf/3) valuationScore += 8; // Long-term oversold, improving
  else if (monthPerf < -5) valuationScore += 5;                    // Minor weakness
  else if (monthPerf >= 0 && monthPerf < 10) valuationScore += 3;  // Stable/slight gains (less value)
  // Strong recent gains get 0 points (not oversold)
  
  // Determine recommendation based on valuation score
  // STRONG_BUY: Score >= 70 (deeply oversold + strong institutional backing + accumulation)
  // BUY: Score >= 55 (oversold + institutional support)
  // WATCH: Score >= 40 (moderately oversold or recovering)
  
  if (valuationScore >= 70) {
    return 'STRONG_BUY';
  } else if (valuationScore >= 55) {
    return 'BUY';
  } else if (valuationScore >= 40) {
    return 'WATCH';
  }
  
  return null; // Not oversold or insufficient quality
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