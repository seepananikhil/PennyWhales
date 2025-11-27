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
    
    // Parse performance data from HTML
    const performance = {
      week: null,
      month: null,
      year: null
    };

    // Find performance table rows - the percentage is in a <span> tag within the next <td> after the label
    const perfWeekMatch = html.match(/Perf Week<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([-+]?\d+\.?\d*%)<\/span>/);
    const perfMonthMatch = html.match(/Perf Month<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([-+]?\d+\.?\d*%)<\/span>/);
    const perfYearMatch = html.match(/Perf Year<\/td>[\s\S]*?<td[^>]*>[\s\S]*?<span[^>]*>([-+]?\d+\.?\d*%)<\/span>/);

    if (perfWeekMatch) {
      performance.week = parseFloat(perfWeekMatch[1].replace('%', ''));
    }
    if (perfMonthMatch) {
      performance.month = parseFloat(perfMonthMatch[1].replace('%', ''));
    }
    if (perfYearMatch) {
      performance.year = parseFloat(perfYearMatch[1].replace('%', ''));
    }

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

    return {
      performance,
      employee_count: employeeCount,
      ipo_date: ipoDate,
      sector: sector,
      industry: industry,
      market_cap: marketCap,
      description: description
    };
  } catch (error) {
    console.error(`Error fetching Finviz data for ${ticker}:`, error.message);
    return null;
  }
}

// Export functions
module.exports = {
  scrapeFinvizScreener,
  getFinvizTickerData,
};