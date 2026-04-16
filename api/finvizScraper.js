const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes stock data from Finviz screener with pagination support
 * @param {string} url - Finviz screener URL
 * @returns {Promise<Array>} Array of stock objects
 */
async function scrapeFinvizScreener(url = process.env.FINVIZ_SCREENER_URL || 'https://finviz.com/screener.ashx?v=411&f=cap_microover,exch_nasd,sh_instown_o10,sh_price_u3&ft=3&o=-marketcap') {
  try {
    console.log('Fetching Finviz screener data with pagination...');
    
    const allStocks = [];
    const seenTickers = new Set();
    let pageNumber = 1;
    let hasMorePages = true;
    
    while (hasMorePages) {
      // Calculate offset for pagination (Finviz uses r parameter, increments by 20)
      const offset = (pageNumber - 1) * 20;
      const pageUrl = offset > 0 ? `${url}&r=${offset + 1}` : url;
      
      console.log(`Fetching page ${pageNumber} (offset ${offset})...`);
      
      const response = await axios.get(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
        }
      });

      const $ = cheerio.load(response.data);
      const pageStocks = [];
      
      // Look for tickers in the screener_tickers class
      const tickerContainer = $('.screener_tickers');
      
      if (tickerContainer.length > 0) {
        // Get all spans inside the screener_tickers container
        const tickerSpans = tickerContainer.find('span');
        
        tickerSpans.each((index, span) => {
          const ticker = $(span).text().trim();
          
          // Validate ticker format (2-5 uppercase letters)
          if (ticker && ticker.match(/^[A-Z]{2,5}$/) && !seenTickers.has(ticker)) {
            seenTickers.add(ticker);
            pageStocks.push({
              ticker: ticker
            });
          }
        });
      }
      
      console.log(`Page ${pageNumber}: Found ${pageStocks.length} new unique tickers`);
      allStocks.push(...pageStocks);
      
      // Check if there are more pages by looking for "next" button or checking if we got results
      // Finviz shows max 1000 results at 20 per page = 50 pages
      // But all tickers are in the HTML, so we should get them all on first page
      // If we got fewer than expected or hit 1000, check for pagination
      const totalText = $('body').text();
      const totalMatch = totalText.match(/(\d+)\s*Total/);
      const totalStocks = totalMatch ? parseInt(totalMatch[1]) : 0;
      
      console.log(`Total stocks in screener: ${totalStocks}, Collected so far: ${allStocks.length}`);
      
      // Stop if we have all stocks or no new stocks found or reached reasonable limit
      if (pageStocks.length === 0 || allStocks.length >= totalStocks || pageNumber >= 100) {
        hasMorePages = false;
      } else {
        pageNumber++;
        // Add delay between pages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully scraped ${allStocks.length} unique stocks from Finviz across ${pageNumber} page(s)`);
    return allStocks;
    
  } catch (error) {
    console.error('Error scraping Finviz:', error.message);
    throw error;
  }
}

/**
 * Helper function to extract performance percentage from Finviz HTML
 * @param {string} html - HTML content
 * @param {string} label - Performance label (e.g., "Perf Week", "Perf Month")
 * @returns {number|null} Performance percentage as float or null
 */
function extractPerformance(html, label) {
  // New structure: <div class="snapshot-td-label">Perf Week</div></td><td...><div class="snapshot-td-content"><b><span class="color-text...">1.87%</span></b></div>
  const pattern = new RegExp(`<div[^>]*>\\s*${label}\\s*</div></td><td[^>]*><div class="snapshot-td-content"><b>(?:<span[^>]*>)?\\s*([-+]?\\d+\\.?\\d*)%`);
  const match = html.match(pattern);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Helper function to extract numeric values from HTML
 * @param {boolean} inMillions - If true, returns values in millions (for market cap), otherwise actual numbers
 */
function extractValue(html, label, occurrence = 1, inMillions = false) {
  try {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // New structure: <div class="snapshot-td-label">Label</div></td><td...><div class="snapshot-td-content"><b>Value</b></div>
    const pattern = new RegExp(`<div[^>]*>\\s*${escapedLabel}\\s*</div></td><td[^>]*><div class="snapshot-td-content"><b>(?:<span[^>]*>)?\\s*([^<]+?)(?:</span>)?\\s*</b></div>`, 'g');
    
    let match;
    let count = 0;
    while ((match = pattern.exec(html)) !== null) {
      count++;
      if (count === occurrence) {
        let value = match[1].trim();
        if (value === '-' || value === '') return null;
        
        // Remove any remaining HTML tags
        value = value.replace(/<[^>]*>/g, '');
        
        // Parse: "612.79M" or "1.50M" or "4017.54B"
        const numMatch = value.match(/([\-+]?\d+\.?\d*)([KMBT])?/);
        if (!numMatch) return value; // Return text if no number found
        
        const num = parseFloat(numMatch[1]);
        const suffix = numMatch[2];
        
        if (!suffix) return num; // No suffix, return as-is
        
        // Multipliers based on whether we want millions or actual numbers
        const multipliers = inMillions 
          ? { K: 0.001, M: 1, B: 1000, T: 1000000 } // Store in millions
          : { K: 1000, M: 1000000, B: 1000000000, T: 1000000000000 }; // Store actual
        
        return num * (multipliers[suffix] || 1);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to extract percentage values
 */
function extractPercent(html, label, occurrence = 1) {
  try {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // New structure: <div class="snapshot-td-label">Label</div></td><td...><div class="snapshot-td-content"><b><span...>Value%</span></b></div>
    const pattern = new RegExp(`<div[^>]*>\\s*${escapedLabel}\\s*</div></td><td[^>]*><div class="snapshot-td-content"><b>(?:<span[^>]*>)?\\s*([^<]+?)(?:</span>)?\\s*</b></div>`, 'g');
    
    let match;
    let count = 0;
    while ((match = pattern.exec(html)) !== null) {
      count++;
      if (count === occurrence) {
        const value = match[1].trim();
        if (value === '-' || value === '') return null;
        
        // Extract percentage from the value
        const percentMatch = value.match(/([-+]?\d+\.?\d*)%/);
        if (percentMatch) {
          return parseFloat(percentMatch[1]);
        }
        
        return null;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to extract text values
 */
function extractText(html, label) {
  try {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // New structure: <div class="snapshot-td-label">Label</div></td><td...><div class="snapshot-td-content"><b>Text</b></div>
    const pattern = new RegExp(`<div[^>]*>\\s*${escapedLabel}\\s*</div></td><td[^>]*><div class="snapshot-td-content"><b>(?:<span[^>]*>)?\\s*([^<]+?)(?:</span>)?\\s*</b></div>`);
    const match = html.match(pattern);
    
    if (match) {
      const text = match[1].trim();
      return text === '-' ? null : text;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract company name from HTML
 */
function extractCompanyName(html, ticker) {
  try {
    // Extract from page title - format: "AAPL - Apple Inc Stock Price and Quote"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1];
      // Format: "TICKER - Company Name Stock Price and Quote"
      const nameMatch = title.match(/[A-Z]+\s*-\s*(.+?)\s+Stock\s+Price/i);
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract sector from HTML
 */
function extractSector(html) {
  try {
    const match = html.match(/<a[^>]*href="[^"]*f=sec_[^"]*"[^>]*class="tab-link"[^>]*>([^<]+)<\/a>/);
    return match ? match[1].trim() : null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract industry from HTML
 */
function extractIndustry(html) {
  try {
    const match = html.match(/<a[^>]*href="[^"]*f=ind_[^"]*"[^>]*class="tab-link[^"]*"[^>]*>([^<]+)<\/a>/);
    return match ? match[1].trim() : null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract volatility (weekly, monthly)
 */
function extractVolatility(html) {
  try {
    const match = html.match(/>Volatility<\/td>[\s\S]*?<b>([\d.]+)%\s+([\d.]+)%<\/b>/);
    if (match) {
      return {
        week: parseFloat(match[1]),
        month: parseFloat(match[2])
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract comprehensive fundamental and technical data from Finviz
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Comprehensive stock data
 */
async function getComprehensiveFinvizData(ticker) {
  try {
    const response = await axios.get(
      `https://finviz.com/quote.ashx?t=${ticker}&p=d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (response.status !== 200) return null;
    const html = response.data;
    
    const data = {
      // Valuation Metrics
      valuation: {
        marketCap: extractValue(html, 'Market Cap', 1, true),
        enterpriseValue: extractValue(html, 'Enterprise Value', 1, true),
        pe: extractValue(html, 'P/E'),
        forwardPE: extractValue(html, 'Forward P/E'),
        peg: extractValue(html, 'PEG'),
        ps: extractValue(html, 'P/S'),
        pb: extractValue(html, 'P/B'),
        pc: extractValue(html, 'P/C'),
        pFcf: extractValue(html, 'P/FCF'),
        evEbitda: extractValue(html, 'EV/EBITDA'),
        evSales: extractValue(html, 'EV/Sales')
      },
      
      // Profitability Metrics
      profitability: {
        income: extractValue(html, 'Income', 1, true),
        sales: extractValue(html, 'Sales', 1, true),
        roa: extractPercent(html, 'ROA'),
        roe: extractPercent(html, 'ROE'),
        roic: extractPercent(html, 'ROIC'),
        grossMargin: extractPercent(html, 'Gross Margin'),
        operMargin: extractPercent(html, 'Oper. Margin'),
        profitMargin: extractPercent(html, 'Profit Margin')
      },
      
      // EPS Metrics
      eps: {
        ttm: extractValue(html, 'EPS (ttm)'),
        nextY: extractValue(html, 'EPS next Y'),
        nextQ: extractValue(html, 'EPS next Q'),
        thisYGrowth: extractPercent(html, 'EPS this Y'),
        nextYGrowth: extractPercent(html, 'EPS next Y', 2), // 2nd occurrence
        next5Y: extractPercent(html, 'EPS next 5Y'),
        past5Y: extractPercent(html, 'EPS past 5Y'),
        yoyTTM: extractPercent(html, 'EPS Y/Y TTM'),
        qoq: extractPercent(html, 'EPS Q/Q')
      },
      
      // Sales Growth
      salesGrowth: {
        past5Y: extractPercent(html, 'Sales past 5Y'),
        yoyTTM: extractPercent(html, 'Sales Y/Y TTM'),
        qoq: extractPercent(html, 'Sales Q/Q')
      },
      
      // Ownership & Float
      ownership: {
        insiderOwn: extractPercent(html, 'Insider Own'),
        insiderTrans: extractPercent(html, 'Insider Trans'),
        instOwn: extractPercent(html, 'Inst Own'),
        instTrans: extractPercent(html, 'Inst Trans'),
        sharesOutstanding: extractValue(html, 'Shs Outstand', 1, true), // in millions
        sharesFloat: extractValue(html, 'Shs Float', 1, true), // in millions
        shortFloat: extractPercent(html, 'Short Float'),
        shortRatio: extractValue(html, 'Short Ratio'),
        shortInterest: extractValue(html, 'Short Interest', 1, true) // in millions
      },
      
      // Technical Indicators
      technical: {
        beta: extractValue(html, 'Beta'),
        atr: extractValue(html, 'ATR'),
        rsi: extractValue(html, 'RSI (14)'),
        sma20: extractPercent(html, 'SMA20'),
        sma50: extractPercent(html, 'SMA50'),
        sma200: extractPercent(html, 'SMA200'),
        week52High: extractValue(html, '52W High'),
        week52Low: extractValue(html, '52W Low'),
        volatility: extractVolatility(html)
      },
      
      // Performance
      performance: {
        day: extractPercent(html, 'Change'),
        week: extractPerformance(html, 'Perf Week'),
        month: extractPerformance(html, 'Perf Month'),
        quarter: extractPerformance(html, 'Perf Quarter'),
        halfYear: extractPerformance(html, 'Perf Half Y'),
        ytd: extractPerformance(html, 'Perf YTD'),
        year: extractPerformance(html, 'Perf Year'),
        threeYear: extractPerformance(html, 'Perf 3Y'),
        fiveYear: extractPerformance(html, 'Perf 5Y')
      },
      
      // Balance Sheet
      balanceSheet: {
        bookPerShare: extractValue(html, 'Book/sh'),
        cashPerShare: extractValue(html, 'Cash/sh'),
        quickRatio: extractValue(html, 'Quick Ratio'),
        currentRatio: extractValue(html, 'Current Ratio'),
        debtToEquity: extractValue(html, 'Debt/Eq'),
        ltDebtToEquity: extractValue(html, 'LT Debt/Eq')
      },
      
      // Company Info
      company: {
        name: extractCompanyName(html, ticker),
        employees: extractValue(html, 'Employees'), // actual number
        ipoDate: extractText(html, 'IPO'),
        sector: extractSector(html),
        industry: extractIndustry(html)
      },
      
      // Analyst Info
      analyst: {
        recommendation: extractValue(html, 'Recom'),
        targetPrice: extractValue(html, 'Target Price')
      },
      
      // Volume & Price
      trading: {
        avgVolume: extractValue(html, 'Avg Volume'), // actual number
        volume: extractValue(html, 'Volume'), // actual number
        relVolume: extractValue(html, 'Rel Volume'),
        price: extractValue(html, 'Price'),
        change: extractPercent(html, 'Change'),
        prevClose: extractValue(html, 'Prev Close')
      }
    };
    
    return data;
    
  } catch (error) {
    console.error(`Error fetching comprehensive Finviz data for ${ticker}:`, error.message);
    return null;
  }
}

// Export functions
module.exports = {
  scrapeFinvizScreener,
  getComprehensiveFinvizData
};