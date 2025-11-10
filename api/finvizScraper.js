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
          
          // Extract Perf Month from data-boxover attribute
          let perfMonth = null;
          if (dataBoxover) {
            const perfMatch = dataBoxover.match(/Perf Month:\s*([-+]?\d+\.?\d*)%/);
            if (perfMatch) {
              perfMonth = parseFloat(perfMatch[1]);
            }
          }
          
          stocks.push({
            ticker: tickerSymbol,
            perfMonth: perfMonth
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
 * Scrape multiple pages from Finviz screener
 * @param {string} baseUrl - Base Finviz screener URL
 * @param {number} maxPages - Maximum number of pages to scrape
 * @returns {Promise<Array>} Array of stock objects from all pages
 */
async function scrapeFinvizMultiplePages(baseUrl, maxPages = 5) {
  const allStocks = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const offset = (page - 1) * 20; // Finviz shows 20 results per page
    const url = `${baseUrl}&r=${offset + 1}`;
    
    console.log(`Scraping page ${page}...`);
    
    try {
      const stocks = await scrapeFinvizScreener(url);
      
      if (stocks.length === 0) {
        console.log(`No more results found at page ${page}`);
        break;
      }
      
      allStocks.push(...stocks);
      
      // Add delay to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error.message);
      break;
    }
  }
  
  return allStocks;
}

// Export functions
module.exports = {
  scrapeFinvizScreener,
  getFinvizTickers,
  scrapeFinvizMultiplePages
};

// CLI usage
if (require.main === module) {
  const url = process.argv[2] || 'https://finviz.com/screener.ashx?v=431&f=exch_nasd,sh_instown_o10,sh_price_u3&o=-perf4w';
  
  scrapeFinvizScreener(url)
    .then(stocks => {
      console.log('\n=== Finviz Screener Results ===\n');
      console.log(JSON.stringify(stocks, null, 2));
      console.log(`\nTotal stocks: ${stocks.length}`);
      console.log('\nTickers:', stocks.map(s => s.ticker).join(', '));
      
      // Show stats
      const withPerfData = stocks.filter(s => s.perfMonth !== null).length;
      console.log(`\nStocks with Perf Month data: ${withPerfData}`);
      
      if (withPerfData > 0) {
        const avgPerf = stocks
          .filter(s => s.perfMonth !== null)
          .reduce((sum, s) => sum + s.perfMonth, 0) / withPerfData;
        console.log(`Average Perf Month: ${avgPerf.toFixed(2)}%`);
      }
    })
    .catch(err => {
      console.error('Failed to scrape Finviz:', err);
      process.exit(1);
    });
}
