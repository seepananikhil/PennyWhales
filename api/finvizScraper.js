const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes stock data from Finviz screener
 * @param {string} url - Finviz screener URL
 * @returns {Promise<Array>} Array of stock objects
 */
async function scrapeFinvizScreener(url = 'https://finviz.com/screener.ashx?v=411&f=exch_nasd,sh_price_u3&o=-change') {
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
    
    // Look for tickers in the screener_tickers class
    const tickerContainer = $('.screener_tickers');
    console.log(`Found ${tickerContainer.length} screener_tickers containers`);
    
    if (tickerContainer.length > 0) {
      // Get all spans inside the screener_tickers container
      const tickerSpans = tickerContainer.find('span');
      console.log(`Found ${tickerSpans.length} ticker spans`);
      
      tickerSpans.each((index, span) => {
        const ticker = $(span).text().trim();
        
        // Validate ticker format (2-5 uppercase letters)
        if (ticker && ticker.match(/^[A-Z]{2,5}$/)) {
          stocks.push({
            ticker: ticker
          });
        }
      });
    } else {
      console.log('No screener_tickers container found');
    }
    
    // Remove duplicates
    const uniqueStocks = [];
    const seenTickers = new Set();
    
    for (const stock of stocks) {
      if (!seenTickers.has(stock.ticker)) {
        seenTickers.add(stock.ticker);
        uniqueStocks.push(stock);
      }
    }
    
    console.log(`Successfully scraped ${uniqueStocks.length} unique stocks from Finviz`);
    return uniqueStocks;
    
  } catch (error) {
    console.error('Error scraping Finviz:', error.message);
    throw error;
  }
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
  getFinvizPerformance
};