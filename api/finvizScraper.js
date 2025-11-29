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
  const pattern = new RegExp(`>${label}</td>[\\s\\S]*?<span[^>]*>([-+]?\\d+\\.?\\d*)%</span>`);
  const match = html.match(pattern);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Helper function to extract numeric values from HTML
 */
function extractValue(html, label, occurrence = 1) {
  try {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`>${escapedLabel}<\\/td><td[^>]*class="snapshot-td2[^"]*"[^>]*>(?:<b>)?([^<]+)(?:<\\/b>)?<\\/td>`, 'g');
    
    let match;
    let count = 0;
    while ((match = pattern.exec(html)) !== null) {
      count++;
      if (count === occurrence) {
        const value = match[1].trim();
        if (value === '-' || value === '') return null;
        
        // Parse numeric values with suffixes (M, B, T)
        const numMatch = value.match(/([-+]?\d+\.?\d*)\s*([MBT])?/);
        if (numMatch) {
          let num = parseFloat(numMatch[1]);
          const suffix = numMatch[2];
          
          if (suffix === 'M') return num;
          if (suffix === 'B') return num * 1000;
          if (suffix === 'T') return num * 1000000;
          
          return num;
        }
        
        return value;
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
    const pattern = new RegExp(`>${escapedLabel}<\\/td><td[^>]*class="snapshot-td2[^"]*"[^>]*>(?:<b>)?([^<]+)(?:<\\/b>)?<\\/td>`, 'g');
    
    let match;
    let count = 0;
    while ((match = pattern.exec(html)) !== null) {
      count++;
      if (count === occurrence) {
        const value = match[1].trim();
        if (value === '-' || value === '') return null;
        
        // Extract percentage from the value (look for pattern like "+24.62%" or "-5.23%")
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
    const pattern = new RegExp(`>${escapedLabel}<\\/td><td[^>]*class="snapshot-td2[^"]*"[^>]*>(?:<b>)?([^<]+)(?:<\\/b>)?<\\/td>`);
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
 * Get ticker data from Finviz (performance, employee count, IPO date, sector, industry)
 * and company description from Yahoo Finance
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Ticker data including performance, employee_count, ipo_date, sector, industry, and description
 */
async function getFinvizTickerData(ticker) {
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
    
    // Parse performance data from HTML using the tested helper function
    const performance = {
      week: extractPerformance(html, 'Perf Week'),
      month: extractPerformance(html, 'Perf Month'),
      year: extractPerformance(html, 'Perf Year')
    };

    // Parse employee count from HTML
    let employeeCount = null;
    const employeeMatch = html.match(/>Employees<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<b>([^<]+)<\/b>/);
    if (employeeMatch) {
      const empStr = employeeMatch[1].trim();
      if (empStr && empStr !== '-') {
        employeeCount = parseInt(empStr.replace(/,/g, ''));
      }
    }

    // Parse IPO date from HTML
    let ipoDate = null;
    // Match pattern: <td>IPO</td><td...><b>Mar 13, 1986</b></td>
    const ipoMatch = html.match(/>IPO<\/td>[\s\S]*?<b>([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})<\/b>/);
    if (ipoMatch) {
      const dateStr = ipoMatch[1].trim();
      if (dateStr && dateStr !== '-') {
        ipoDate = dateStr;
      }
    }

    // Parse Sector and Industry from HTML
    let sector = null;
    let industry = null;
    // Match pattern: <a href="screener.ashx?...f=sec_technology" class="tab-link">Technology</a>
    const sectorMatch = html.match(/<a[^>]*href="[^"]*f=sec_[^"]*"[^>]*class="tab-link"[^>]*>([^<]+)<\/a>/);
    if (sectorMatch) {
      sector = sectorMatch[1].trim();
    }
    // Match pattern: <a href="screener.ashx?...f=ind_consumerelectronics" class="tab-link"...>Consumer Electronics</a>
    const industryMatch = html.match(/<a[^>]*href="[^"]*f=ind_[^"]*"[^>]*class="tab-link[^"]*"[^>]*>([^<]+)<\/a>/);
    if (industryMatch) {
      industry = industryMatch[1].trim();
    }

    // Parse Market Cap from HTML
    let marketCap = null;
    const marketCapMatch = html.match(/>Market Cap<\/td>[\s\S]*?<b>([^<]+)<\/b>/);
    if (marketCapMatch) {
      const capStr = marketCapMatch[1].trim();
      // Parse market cap: e.g., "877.36M" or "3.45B" or "1.23T"
      const capValue = parseFloat(capStr);
      if (!isNaN(capValue)) {
        if (capStr.includes('T')) {
          marketCap = capValue * 1000000; // Convert trillions to millions
        } else if (capStr.includes('B')) {
          marketCap = capValue * 1000; // Convert billions to millions
        } else if (capStr.includes('M')) {
          marketCap = capValue; // Already in millions
        }
      }
    }

    // Get company description from Finviz fullview-profile
    let description = null;
    const descMatch = html.match(/<td[^>]*class="fullview-profile"[^>]*>(.*?)<\/td>/s);
    if (descMatch) {
      description = descMatch[1]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      // Limit to reasonable length
      if (description.length > 400) {
        description = description.substring(0, 400) + '...';
      }
    }

    // Parse institutional ownership and transactions
    const instOwn = extractPercent(html, 'Inst Own');
    const instTrans = extractPercent(html, 'Inst Trans');

    return {
      performance,
      employee_count: employeeCount,
      ipo_date: ipoDate,
      sector: sector,
      industry: industry,
      market_cap: marketCap,
      description: description,
      inst_own: instOwn,
      inst_trans: instTrans
    };
  } catch (error) {
    console.error(`Error fetching Finviz data for ${ticker}:`, error.message);
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
        marketCap: extractValue(html, 'Market Cap'),
        enterpriseValue: extractValue(html, 'Enterprise Value'),
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
        income: extractValue(html, 'Income'),
        sales: extractValue(html, 'Sales'),
        roa: extractPercent(html, 'ROA'),
        roe: extractPercent(html, 'ROE'),
        roic: extractPercent(html, 'ROIC'),
        grossMargin: extractPercent(html, 'Gross Margin'),
        operMargin: extractPercent(html, 'Oper. Margin'),
        profitMargin: extractPercent(html, 'Profit Margin')
      },
      
      // EPS Metrics
      eps: {
        ttm: extractValue(html, 'EPS \\(ttm\\)'),
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
        sharesOutstanding: extractValue(html, 'Shs Outstand'),
        sharesFloat: extractValue(html, 'Shs Float'),
        shortFloat: extractPercent(html, 'Short Float'),
        shortRatio: extractValue(html, 'Short Ratio'),
        shortInterest: extractValue(html, 'Short Interest')
      },
      
      // Technical Indicators
      technical: {
        beta: extractValue(html, 'Beta'),
        atr: extractValue(html, 'ATR'),
        rsi: extractValue(html, 'RSI'),
        sma20: extractPercent(html, 'SMA20'),
        sma50: extractPercent(html, 'SMA50'),
        sma200: extractPercent(html, 'SMA200'),
        week52High: extractValue(html, '52W High'),
        week52Low: extractValue(html, '52W Low'),
        volatility: extractVolatility(html)
      },
      
      // Performance
      performance: {
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
        employees: extractValue(html, 'Employees'),
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
        avgVolume: extractValue(html, 'Avg Volume'),
        volume: extractValue(html, 'Volume'),
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
  getFinvizTickerData,
  getComprehensiveFinvizData
};