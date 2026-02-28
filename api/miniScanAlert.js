#!/usr/bin/env node

/**
 * Standalone Mini Scan Alert Script
 * Scans mini screener ($3 and under) for fire stocks under $1
 * Sends Telegram notification when found
 * No dependencies on main project - completely standalone
 * 
 * Usage: node miniScanAlert.js
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

// ============= HARDCODED CONFIG =============
const TELEGRAM_BOT_TOKEN = '8436443776:AAHnLjR19aNTQ9U4wQcOvpd6giT3dwAabJ4';
const TELEGRAM_CHAT_ID = '-1002404699099'; // Replace with your chat ID
const FINVIZ_MINI_URL = 'https://finviz.com/screener.ashx?v=411&f=cap_smallover%2Csh_instown_o20%2Csh_price_u3&o=-change';

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
    // Use curl to fetch directly (same method that works in main project)
    const curlCmd = `curl -s "https://finviz.com/quote.ashx?t=${ticker}" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`;
    const html = execSync(curlCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 8000 });

    // Extract price using regex - look for patterns like $123.45
    const priceMatch = html.match(/Current Price[^$]*\$?([\d.]+)/i) || 
                      html.match(/strongbox text-xl[^>]*>([^<]*\d+\.\d+)/i) ||
                      html.match(/>([0-9]+\.[0-9]{2})</i);
    
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price > 0) return price;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function getNasdaqHoldings(ticker) {
  try {
    const curlCmd = `curl -s "https://api.nasdaq.com/api/company/${ticker}/institutional-holdings" -H "User-Agent: Mozilla/5.0"`;
    const output = execSync(curlCmd, { encoding: 'utf-8', timeout: 5000 });
    return JSON.parse(output);
  } catch (error) {
    return null;
  }
}

function parseHoldings(data, marketCap) {
  if (!data?.data?.holdingsTransactions?.table?.rows) {
    return { blackrockPct: 0, vanguardPct: 0 };
  }

  let blackrockValue = 0;
  let vanguardValue = 0;

  try {
    const holdings = data.data.holdingsTransactions.table.rows;
    for (const holding of holdings) {
      if (!holding.ownerName) continue;

      const ownerName = holding.ownerName.toUpperCase();
      const valueStr = (holding.marketValue || '0').replace(/[$,\s]/g, '');
      const valueMillions = (parseFloat(valueStr) || 0) / 1000;

      if (ownerName.includes('BLACKROCK')) {
        blackrockValue = Math.max(blackrockValue, valueMillions);
      } else if (ownerName.includes('VANGUARD')) {
        vanguardValue = Math.max(vanguardValue, valueMillions);
      }
    }
  } catch (error) {
    // Silently continue
  }

  let blackrockPct = 0;
  let vanguardPct = 0;
  
  if (marketCap && marketCap > 0) {
    blackrockPct = Math.round(((blackrockValue / marketCap) * 100) * 100) / 100;
    vanguardPct = Math.round(((vanguardValue / marketCap) * 100) * 100) / 100;
  }

  return { blackrockPct, vanguardPct };
}

function calculateFireLevel(blackrockPct, vanguardPct) {
  if (blackrockPct > 10 || vanguardPct > 10) return 5;
  if (blackrockPct > 5 || vanguardPct > 5) return 4;
  if (blackrockPct > 3 || vanguardPct > 3) return 3;
  if (blackrockPct > 1 || vanguardPct > 1) return 2;
  if (blackrockPct > 0.5 || vanguardPct > 0.5) return 1;
  return 0;
}

async function sendTelegramMessage(message) {
  try {
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log('📤 Telegram message sent');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Telegram:', error.message);
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

      // Parse holdings (market cap extraction from holdings)
      let marketCap = null;
      try {
        const marketCapRaw = holdingsData.data?.marketCap;
        if (marketCapRaw) {
          marketCap = parseInt(marketCapRaw.replace(/[^0-9]/g, '')) || null;
        }
      } catch (e) {
        // Continue without market cap
      }

      // Parse holdings
      const { blackrockPct, vanguardPct } = parseHoldings(holdingsData, marketCap);
      
      // Calculate fire level
      const fireLevel = calculateFireLevel(blackrockPct, vanguardPct);

      if (fireLevel > 0) {
        console.log(` 🔥 FIRE ${fireLevel} | $${price.toFixed(2)} | BR=${blackrockPct}% VG=${vanguardPct}%`);
        fireStocksUnder1.push({
          ticker,
          price: parseFloat(price.toFixed(2)),
          fireLevel,
          blackrockPct: parseFloat(blackrockPct.toFixed(2)),
          vanguardPct: parseFloat(vanguardPct.toFixed(2))
        });
      } else {
        console.log(` $${price.toFixed(2)})`);
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

    let message = `🔥 *Mini Scan Alert - Fire Stocks Under $1*\n\n`;
    message += `⏰ ${new Date().toLocaleString()}\n`;
    message += `📊 Found ${fireStocksUnder1.length} stock(s):\n\n`;

    fireStocksUnder1.forEach(stock => {
      const fireEmoji = stock.fireLevel === 5 ? '🔴' : stock.fireLevel === 4 ? '🟠' : '🟡';
      message += `${fireEmoji} *${stock.ticker}* - Fire ${stock.fireLevel}\n`;
      message += `   💵 Price: $${stock.price.toFixed(2)}\n`;
      message += `   📈 BR: ${stock.blackrockPct}% | VG: ${stock.vanguardPct}%\n\n`;
    });

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
