#!/usr/bin/env node

/**
 * Standalone Mini Scan Alert Script
 * Scans mini screener ($3 and under) for fire stocks under $1
 * Sends Telegram notification when found
 * 
 * Config: Reads chatId from /api/data/settings.json
 * Bot token: Use TELEGRAM_BOT_TOKEN environment variable
 * Usage: node miniScanAlert.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ============= CONFIG =============
// On GitHub: Uses TELEGRAM_BOT_TOKEN secret
// Locally: Uses hardcoded token as fallback
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8436443776:AAHnLjR19aNTQ9U4wQcOvpd6giT3dwAabJ4';
const FINVIZ_MINI_URL = 'https://finviz.com/screener.ashx?v=411&f=cap_smallover%2Csh_instown_o20%2Csh_price_u3&o=-change';

// Load chat ID from settings.json
let TELEGRAM_CHAT_ID = null;
try {
  const settingsPath = path.join(__dirname, 'data', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    TELEGRAM_CHAT_ID = settings.telegramChatId;
  }
} catch (error) {
  // Silently continue - will fail gracefully when trying to send
}

// ============= HELPER FUNCTIONS =============

async function scrapeFinvizMini() {
  try {
    console.log('📊 Fetching mini screener tickers...');
    
    const response = await axios.get(FINVIZ_MINI_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const tickers = [];
    const seenTickers = new Set();
    
    const tickerContainer = $('.screener_tickers');
    if (tickerContainer.length > 0) {
      tickerContainer.find('span').each((index, span) => {
        const ticker = $(span).text().trim();
        if (ticker && ticker.match(/^[A-Z]{2,5}$/) && !seenTickers.has(ticker)) {
          seenTickers.add(ticker);
          tickers.push(ticker);
        }
      });
    }
    
    console.log(`✅ Found ${tickers.length} tickers from mini screener`);
    return tickers;
  } catch (error) {
    console.error('❌ Failed to scrape Finviz:', error.message);
    return [];
  }
}

async function getStockPrice(ticker) {
  try {
    // Make fetch available globally (same as main project)
    if (typeof fetch === 'undefined') {
      global.fetch = require('node-fetch');
    }

    // Use exact same method as priceUtils.js - Yahoo Finance API
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
    
    if (result?.meta?.regularMarketPrice) {
      return result.meta.regularMarketPrice;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function getNasdaqHoldings(ticker) {
  try {
    const curlCmd = `curl -s "https://api.nasdaq.com/api/company/${ticker}/institutional-holdings" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`;
    const output = execSync(curlCmd, { encoding: 'utf-8', timeout: 5000 });
    const data = JSON.parse(output);
    
    // Validate data exists
    if (data && data.data && data.data.holdingsTransactions) {
      return data;
    }
    return null;
  } catch (error) {
    console.log(`   ⚠️ Holdings fetch failed`);
    return null;
  }
}

function parseHoldings(data, marketCap) {
  if (!data?.data?.holdingsTransactions?.table?.rows) {
    return { 
      blackrockPct: 0, 
      vanguardPct: 0, 
      statestreetPct: 0,
      blackrockValue: 0,
      vanguardValue: 0,
      statestreetValue: 0 
    };
  }

  let blackrockValue = 0;
  let vanguardValue = 0;
  let statestreetValue = 0;

  try {
    const holdings = data.data.holdingsTransactions.table.rows;
    if (!Array.isArray(holdings) || holdings.length === 0) {
      return { 
        blackrockPct: 0, 
        vanguardPct: 0, 
        statestreetPct: 0,
        blackrockValue: 0,
        vanguardValue: 0,
        statestreetValue: 0 
      };
    }

    for (const holding of holdings) {
      if (!holding.ownerName) continue;

      const ownerName = holding.ownerName.toUpperCase();
      const valueStr = (holding.marketValue || '0').replace(/[$,\s]/g, '');
      const valueMillions = (parseFloat(valueStr) || 0) / 1000; // Convert from thousands to millions

      if (ownerName.includes('BLACKROCK')) {
        blackrockValue = Math.max(blackrockValue, valueMillions);
      } else if (ownerName.includes('VANGUARD')) {
        vanguardValue = Math.max(vanguardValue, valueMillions);
      } else if (ownerName.includes('STATE STREET') || ownerName.includes('STATESTREET')) {
        statestreetValue = Math.max(statestreetValue, valueMillions);
      }
    }
  } catch (error) {
    // Silently continue
  }

  let blackrockPct = 0;
  let vanguardPct = 0;
  let statestreetPct = 0;
  
  if (marketCap && marketCap > 0) {
    blackrockPct = Math.round(((blackrockValue / marketCap) * 100) * 100) / 100;
    vanguardPct = Math.round(((vanguardValue / marketCap) * 100) * 100) / 100;
    statestreetPct = Math.round(((statestreetValue / marketCap) * 100) * 100) / 100;
  }

  return { 
    blackrockPct, 
    vanguardPct, 
    statestreetPct,
    blackrockValue,
    vanguardValue,
    statestreetValue
  };
}

function calculateFireLevel(stock) {
  // Handle both object and individual parameter formats
  let blackrockPct = 0;
  let vanguardPct = 0;
  let blackrockValue = 0;
  let vanguardValue = 0;
  
  if (typeof stock === 'object' && stock !== null) {
    blackrockPct = stock.blackrockPct || stock.blackrock_pct || 0;
    vanguardPct = stock.vanguardPct || stock.vanguard_pct || 0;
    blackrockValue = stock.blackrockValue || stock.blackrock_market_value || 0;
    vanguardValue = stock.vanguardValue || stock.vanguard_market_value || 0;
  } else {
    // Legacy format: calculateFireLevel(blackrockPct, vanguardPct)
    blackrockPct = stock || 0;
    vanguardPct = arguments[1] || 0;
  }
  
  const combinedPct = blackrockPct + vanguardPct;
  const combinedValue = blackrockValue + vanguardValue;
  
  // FIRE LEVEL 5 - Elite institutional confidence
  if (combinedValue >= 50 || combinedPct >= 15 || blackrockPct >= 10 || vanguardPct >= 10) {
    return 5;
  }
  
  // FIRE LEVEL 4 - Very high institutional confidence
  if (combinedValue >= 30 || combinedPct >= 10 || blackrockPct >= 7 || vanguardPct >= 7) {
    return 4;
  }
  
  // FIRE LEVEL 3 - High institutional confidence
  if (combinedValue >= 15 || combinedPct >= 7 || blackrockPct >= 4 || vanguardPct >= 4) {
    return 3;
  }
  
  return 0;
}

async function sendTelegramMessage(message) {
  try {
    // Check if Telegram chatId is configured
    if (!TELEGRAM_CHAT_ID) {
      console.error('❌ Telegram chat ID not found in settings.json');
      return false;
    }
    
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    
    // Log request for debugging
    console.log(`📡 Sending to Telegram (Chat: ${TELEGRAM_CHAT_ID})...`);
    
    const response = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
      // Plain text format - no parse_mode to avoid formatting issues
    });
    
    console.log('✅ Telegram message sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Telegram:', error.response?.data || error.message);
    return false;
  }
}

// ============= MAIN EXECUTION =============

async function runMiniScanAlert() {
  console.log('\n🚀 Starting Mini Scan Alert...');
  console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);
  
  // Step 1: Get mini tickers
  const tickers = await scrapeFinvizMini();
  if (tickers.length === 0) {
    console.log('⚠️ No tickers found');
    return;
  }

  // Step 2: Analyze each ticker
  const fireStocksUnder1 = [];
  const analyzed = [];
  
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    process.stdout.write(`[${i + 1}/${tickers.length}] ${ticker}...`);

    try {
      // Get price
      const price = await getStockPrice(ticker);
      if (!price) {
        console.log(' (no price)');
        continue;
      }

      // Skip if price >= $1
      if (price >= 1.0) {
        console.log(` ($${price.toFixed(2)}) ≥ $1`);
        continue;
      }

      // Get holdings
      const holdingsData = await getNasdaqHoldings(ticker);
      if (!holdingsData) {
        console.log(' (no holdings)');
        continue;
      }

      // Extract market cap from holdings data
      let marketCap = null;
      try {
        // Try different possible locations for market cap in Nasdaq API response
        marketCap = holdingsData.data?.marketCap || 
                   holdingsData.data?.company?.marketCap || 
                   holdingsData.marketCap;
        
        if (marketCap && typeof marketCap === 'string') {
          // Remove $ and commas, handle B/M suffixes
          const cleanCap = marketCap.replace(/\$|,/g, '');
          if (cleanCap.endsWith('B')) {
            marketCap = parseFloat(cleanCap) * 1000; // B = billions, convert to millions
          } else if (cleanCap.endsWith('M')) {
            marketCap = parseFloat(cleanCap);
          } else {
            marketCap = parseFloat(cleanCap) / 1000000; // Assume it's in dollars
          }
        } else if (typeof marketCap === 'number') {
          marketCap = marketCap / 1000000; // Convert to millions if needed
        }
      } catch (e) {
        marketCap = null;
      }

      // Parse holdings to extract percentages and market values
      const { blackrockPct, vanguardPct, statestreetPct, blackrockValue, vanguardValue } = parseHoldings(holdingsData, marketCap);
      
      // Calculate fire level with both percentages and market values
      const fireLevel = calculateFireLevel({
        blackrockPct,
        vanguardPct,
        blackrockValue,
        vanguardValue
      });

      if (fireLevel > 0) {
        console.log(` 🔥 FIRE ${fireLevel} | $${price.toFixed(2)} | BR=${blackrockPct}% VG=${vanguardPct}%`);
        fireStocksUnder1.push({
          ticker,
          price: parseFloat(price.toFixed(2)),
          fireLevel,
          blackrockPct: parseFloat(blackrockPct.toFixed(2)),
          vanguardPct: parseFloat(vanguardPct.toFixed(2)),
          blackrockValue: parseFloat(blackrockValue.toFixed(2)),
          vanguardValue: parseFloat(vanguardValue.toFixed(2))
        });
      } else {
        console.log(` $${price.toFixed(2)} (no fire)`);
      }
      
      analyzed.push(ticker);
    } catch (error) {
      console.log(` (error)`);
    }

    // Rate limit: 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Step 3: Send notification if found
  console.log(`\n📊 Analyzed: ${analyzed.length} stocks`);
  
  if (fireStocksUnder1.length > 0) {
    console.log(`🔥 Found ${fireStocksUnder1.length} fire stocks under $1!\n`);
    
    // Sort by fire level (highest first), then by price (lowest first)
    fireStocksUnder1.sort((a, b) => {
      if (b.fireLevel !== a.fireLevel) return b.fireLevel - a.fireLevel;
      return a.price - b.price;
    });

    let message = `🔥 MINI SCAN ALERT - FIRE STOCKS UNDER $1\n\n`;
    message += `⏰ ${new Date().toLocaleString()}\n`;
    message += `📊 Found ${fireStocksUnder1.length} stock(s):\n`;
    message += `${'='.repeat(50)}\n\n`;

    fireStocksUnder1.forEach(stock => {
      const fireEmoji = stock.fireLevel === 5 ? '🔴' : stock.fireLevel === 4 ? '🟠' : '🟡';
      message += `${fireEmoji} ${stock.ticker} - Fire Level ${stock.fireLevel}\n`;
      message += `   💵 Price: $${stock.price.toFixed(2)}\n`;
      
      // Show market values (most important) and percentages (if available)
      const brDisplay = stock.blackrockValue > 0 ? `$${stock.blackrockValue}M` : `${stock.blackrockPct}%`;
      const vgDisplay = stock.vanguardValue > 0 ? `$${stock.vanguardValue}M` : `${stock.vanguardPct}%`;
      
      message += `   📈 BR: ${brDisplay}`;
      message += ` | VG: ${vgDisplay}\n\n`;
    });
    
    message += `${'='.repeat(50)}\n✅ Mini Scan Complete`;

    await sendTelegramMessage(message);
  } else {
    console.log('ℹ️ No fire stocks under $1 found');
  }

  console.log('\n✅ Mini scan alert complete\n');
}

// Run the script
runMiniScanAlert().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
