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