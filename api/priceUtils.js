// Utility functions for fetching stock prices
// Make fetch available globally for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

/**
 * Get stock price data directly from Yahoo Finance API
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<{price: number, previousClose: number, priceChange: number} | null>}
 */
async function getStockPriceData(ticker) {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (result?.meta?.regularMarketPrice && result?.meta?.previousClose) {
      const currentPrice = result.meta.regularMarketPrice;
      const previousClose = result.meta.previousClose;
      const priceChangePercent = ((currentPrice - previousClose) / previousClose) * 100;
      
      return {
        price: currentPrice,
        previousClose: previousClose,
        priceChange: priceChangePercent
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error);
    return null;
  }
}

module.exports = {
  getStockPriceData
};