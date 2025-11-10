const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes stock data from Finviz screener
 * @param {string} url - Finviz screener URL
 * @returns {Promise<Array>} Array of stock objects
 */
async function scrapeFinvizScreener(url = 'https://finviz.com/screener.ashx?v=431&f=exch_nasd,sh_instown_o10,sh_price_u3&o=-perf4w') {
  try {
    console.log('Fetching Finviz screener data...');
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      }
    });

    const $ = cheerio.load(response.data);
    const stocks = [];
    
    // Finviz uses a specific nested table structure
    const selector = '#screener-table > td > table > tbody > tr > td > table > tbody > tr > td';
    const cells = $(selector);
    
    console.log(`Found ${cells.length} cells with data`);
    
    if (cells.length === 0) {
      console.log('No data found. The page might have no results or the structure changed.');
      return stocks;
    }
    
    // The tickers are in span elements with onclick attributes
    const tickerCell = cells.first();
    const tickerSpans = tickerCell.find('span[onclick*="quote.ashx"]');
    
    console.log(`Found ${tickerSpans.length} ticker spans`);
    
    tickerSpans.each((index, span) => {
      try {
        const ticker = $(span).text().trim();
        const onclick = $(span).attr('onclick');
        const dataBoxover = $(span).attr('data-boxover');
        
        if (ticker && onclick) {
          // Extract ticker from onclick attribute
          const match = onclick.match(/t=([A-Z]+)/);
          const tickerSymbol = match ? match[1] : ticker;
          
          stocks.push({
            ticker: tickerSymbol
          });
        }
      } catch (err) {
        console.error(`Error parsing ticker ${index}:`, err.message);
      }
    });
    
    console.log(`Successfully scraped ${stocks.length} stocks from Finviz`);
    return stocks;
    
  } catch (error) {
    console.error('Error scraping Finviz:', error.message);
    throw error;
  }
}

/**
 * Get just the tickers from Finviz screener
 * @param {string} url - Finviz screener URL
 * @returns {Promise<Array<string>>} Array of ticker symbols
 */
async function getFinvizTickers(url) {
  const stocks = await scrapeFinvizScreener(url);
  return stocks.map(stock => stock.ticker);
}

/**
 * Get performance data for a ticker from Finviz
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} Performance data (week, month, year)
 */
async function getFinvizPerformance(ticker) {
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

    // Find performance table rows - updated regex to match new HTML structure
    // The percentage is in a <span> tag within the next <td> after the label
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

    return performance;
  } catch (error) {
    console.error(`Error fetching Finviz performance for ${ticker}:`, error.message);
    return null;
  }
}

// Export functions
module.exports = {
  scrapeFinvizScreener,
  getFinvizTickers,
  getFinvizPerformance
};