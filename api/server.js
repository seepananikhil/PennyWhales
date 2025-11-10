const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const StockScanner = require('./stockScanner');
const dbService = require('./database');
const { getStockPriceData } = require('./priceUtils');
const { scrapeFinvizScreener } = require('./finvizScraper');

// Make fetch available for Node.js if not available
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json());

// Global scan state
let scanState = {
  scanning: false,
  progress: null,
  error: null,
  last_scan: null
};

let currentScanner = null;

// Auto-populate watchlist with hot picks (fire 3-5, price <= $1.20)
async function autoPopulateHotPicks() {
  try {
    console.log('🔥 Auto-populating Hot Picks watchlist...');
    
    const scanResults = await dbService.getScanResults();
    if (!scanResults || !scanResults.stocks) {
      console.log('⚠️ No scan results found for auto-population');
      return;
    }

    // Filter for fire stocks (3-5) with price <= $1.20
    const hotPicks = scanResults.stocks.filter(stock => 
      stock.fire_level >= 3 && 
      stock.fire_level <= 5 && 
      stock.price <= 1.20
    );

    if (hotPicks.length === 0) {
      console.log('📊 No stocks match hot picks criteria (fire 3-5, price <= $1.20)');
      return;
    }

    const hotPickTickers = hotPicks.map(s => s.ticker);
    console.log(`🎯 Found ${hotPickTickers.length} hot picks: ${hotPickTickers.join(', ')}`);

    // Check if "Hot Picks" watchlist exists
    const watchlists = await dbService.getWatchlists();
    let hotPicksWatchlist = watchlists.find(w => w.name === 'Hot Picks');

    if (!hotPicksWatchlist) {
      // Create new Hot Picks watchlist
      hotPicksWatchlist = await dbService.createWatchlist('Hot Picks', hotPickTickers);
      console.log(`✅ Created Hot Picks watchlist with ${hotPickTickers.length} stocks`);
    } else {
      // Update existing Hot Picks watchlist
      await dbService.updateWatchlist(hotPicksWatchlist.id, { stocks: hotPickTickers });
      console.log(`✅ Updated Hot Picks watchlist with ${hotPickTickers.length} stocks`);
    }

    return { success: true, count: hotPickTickers.length };
  } catch (error) {
    console.error('❌ Error auto-populating Hot Picks:', error);
    return { success: false, error: error.message };
  }
}

// Run daily scan at 6am IST
async function runDailyScan() {
  if (scanState.scanning) {
    console.log('⏭️ Scan already in progress, skipping scheduled scan');
    return;
  }

  try {
    console.log('⏰ Starting scheduled daily scan at 6am IST...');
    
    // Step 1: Fetch Finviz data
    console.log('📊 Fetching top performers from Finviz...');
    const finvizStocks = await scrapeFinvizScreener();
    
    if (finvizStocks && finvizStocks.length > 0) {
      const finvizTickers = finvizStocks.map(s => s.ticker);
      console.log(`✅ Fetched ${finvizTickers.length} tickers from Finviz`);
      
      // Step 2: Add tickers to the list (only qualifying ones will be added)
      console.log(`🎯 Adding ${finvizTickers.length} tickers to scan list...`);
      const added = await dbService.addTickers(finvizTickers);
      console.log(`✅ Added ${added.length} new tickers to the list`);
    } else {
      console.log('⚠️ No data fetched from Finviz, proceeding with existing tickers');
    }
    
    // Step 3: Start the scan
    scanState.scanning = true;
    scanState.error = null;
    scanState.progress = { current: 0, total: 0, percentage: 0 };

    // Create new scanner instance
    currentScanner = new StockScanner();
    
    // Set up progress callback
    currentScanner.onProgress = (progress) => {
      scanState.progress = progress;
      console.log(`Daily scan progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    };

    // Get previous fire stocks and run scan on them
    const previousResults = await dbService.getScanResults();
    const previousFireStocks = previousResults?.stocks?.filter(s => s.fire_level && s.fire_level > 0) || [];
    
    if (previousFireStocks.length === 0) {
      console.log('⚠️ No previous fire stocks found. Running full scan instead...');
      await currentScanner.scan();
    } else {
      const fireStockTickers = previousFireStocks.map(s => s.ticker);
      console.log(`🔥 Scanning ${fireStockTickers.length} fire stocks`);
      await currentScanner.scanTickers(fireStockTickers, previousFireStocks);
    }

    scanState.scanning = false;
    scanState.last_scan = new Date().toISOString();
    
    // Auto-populate Hot Picks watchlist after scan completes
    await autoPopulateHotPicks();
    
    console.log('✅ Scheduled daily scan completed successfully');
  } catch (error) {
    scanState.scanning = false;
    scanState.error = error.message;
    console.error('❌ Scheduled daily scan failed:', error);
  }
}

// Schedule daily scan at 6:00 AM IST (which is 0:30 UTC)
// IST is UTC+5:30, so 6:00 AM IST = 0:30 AM UTC
cron.schedule('30 0 * * *', () => {
  console.log('⏰ Cron triggered: Running scheduled daily scan at 6:00 AM IST');
  runDailyScan();
}, {
  timezone: "UTC"
});

console.log('⏰ Scheduled daily scan at 6:00 AM IST (0:30 AM UTC)');

// API Routes

// Start scan
app.post('/api/scan/start', async (req, res) => {
  if (scanState.scanning) {
    return res.json({ success: false, message: 'Scan already in progress' });
  }

  try {
    const { fireStocksOnly = false } = req.body;
    
    scanState.scanning = true;
    scanState.error = null;
    scanState.progress = { current: 0, total: 0, percentage: 0 };

    // Create new scanner instance
    currentScanner = new StockScanner();
    
    // Set up progress callback
    currentScanner.onProgress = (progress) => {
      scanState.progress = progress;
      const scanType = fireStocksOnly ? 'Fire stocks' : 'Full scan';
      console.log(`${scanType} progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    };

    if (fireStocksOnly) {
      // Fire stocks only scan
      const previousResults = await dbService.getScanResults();
      const previousFireStocks = previousResults?.stocks?.filter(s => s.fire_level && s.fire_level > 0) || [];
      
      if (previousFireStocks.length === 0) {
        scanState.scanning = false;
        return res.json({ success: false, message: 'No previous fire stocks found. Run a full scan first.' });
      }

      const fireStockTickers = previousFireStocks.map(s => s.ticker);
      console.log(`🔥 Starting fire stocks scan for ${fireStockTickers.length} fire stocks: ${fireStockTickers.join(', ')}`);

      res.json({ success: true, message: `Fire stocks scan started for ${fireStockTickers.length} fire stocks` });

      // Run fire stocks scan asynchronously
      try {
        const results = await currentScanner.scanTickers(fireStockTickers, previousFireStocks);
        scanState.scanning = false;
        scanState.last_scan = new Date().toISOString();
        
        // Auto-populate Hot Picks watchlist after scan completes
        await autoPopulateHotPicks();
        
        console.log('✅ Fire stocks scan completed successfully');
      } catch (error) {
        scanState.scanning = false;
        scanState.error = error.message;
        console.error('❌ Fire stocks scan failed:', error);
      }
    } else {
      // Full scan
      res.json({ success: true, message: 'Full scan started successfully' });

      // Run full scan asynchronously
      try {
        const results = await currentScanner.scan();
        scanState.scanning = false;
        scanState.last_scan = new Date().toISOString();
        
        // Auto-populate Hot Picks watchlist after scan completes
        await autoPopulateHotPicks();
        
        console.log('✅ Full scan completed successfully');
      } catch (error) {
        scanState.scanning = false;
        scanState.error = error.message;
        console.error('❌ Full scan failed:', error);
      }
    }

  } catch (error) {
    scanState.scanning = false;
    scanState.error = error.message;
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get scan status
app.get('/api/scan/status', (req, res) => {
  res.json(scanState);
});

// Get latest results
app.get('/api/scan/results', async (req, res) => {
  try {
    const results = await dbService.getScanResults();
    res.json(results);
  } catch (error) {
    console.error('Error getting scan results:', error);
    res.status(500).json({ error: 'Failed to get scan results' });
  }
});

// Clear scan results
app.post('/api/scan/clear', async (req, res) => {
  try {
    await dbService.clearScanResults();
    res.json({ success: true, message: 'Scan results cleared successfully' });
  } catch (error) {
    console.error('Error clearing scan results:', error);
    res.status(500).json({ error: 'Failed to clear scan results' });
  }
});

// Scan single stock
app.post('/api/scan', async (req, res) => {
  try {
    const { ticker, tickers } = req.body;
    
    // Support both single ticker and multiple tickers
    let tickersToScan = [];
    
    if (ticker && typeof ticker === 'string') {
      tickersToScan = [ticker];
    } else if (tickers && Array.isArray(tickers)) {
      tickersToScan = tickers;
    } else {
      return res.status(400).json({ error: 'Ticker or tickers array is required' });
    }

    console.log(`🔍 Scanning ${tickersToScan.length} stock(s): ${tickersToScan.join(', ')}`);

    const scanner = new StockScanner();
    const { calculateFireLevel } = require('./fireUtils');
    
    const results = [];
    const errors = [];

    for (const tick of tickersToScan) {
      try {
        const result = await scanner.analyzeTicker(tick.toUpperCase().trim());
        
        if (result) {
          result.fire_level = calculateFireLevel(result);
          results.push(result);
        } else {
          errors.push({
            ticker: tick.toUpperCase().trim(),
            error: 'Could not fetch data for this ticker'
          });
        }
      } catch (error) {
        errors.push({
          ticker: tick.toUpperCase().trim(),
          error: error.message || 'Failed to scan stock'
        });
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Could not fetch data for any of the tickers',
        errors
      });
    }

    res.json({
      success: true,
      stocks: results,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error scanning stock(s):', error);
    res.status(500).json({ error: 'Failed to scan stock(s)' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Live price proxy endpoint
app.get('/api/price/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    
    const priceData = await getStockPriceData(ticker);
    
    if (priceData) {
      const response = {
        ticker: ticker.toUpperCase(),
        price: priceData.price,
        previousClose: priceData.previousClose,
        priceChange: priceData.priceChange,
        timestamp: new Date().toISOString()
      };
      
      res.json(response);
    } else {
      res.status(404).json({ error: 'Price data not available' });
    }
  } catch (error) {
    console.error(`Error fetching price for ${req.params.ticker}:`, error);
    res.status(500).json({ error: 'Failed to fetch price data' });
  }
});

app.get('/api/movers/all', async (req, res) => {
  try {
    const { limit = 10, minPrice, maxPrice } = req.query;
    const results = await dbService.getScanResults();
    
    if (!results || !results.stocks) {
      return res.json({ gainers: [], losers: [], count: 0 });
    }
    
    // Filter stocks with valid price data and only fire stocks (fire_level > 0)
    let stocks = results.stocks.filter(stock => 
      stock.price && 
      stock.previous_close && 
      stock.previous_close > 0 &&
      stock.fire_level && 
      stock.fire_level > 0
    );
    
    // Apply price filters if provided
    if (minPrice) {
      stocks = stocks.filter(stock => stock.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      stocks = stocks.filter(stock => stock.price <= parseFloat(maxPrice));
    }
    
    // Calculate price change percentage
    const stocksWithChange = stocks.map(stock => {
      const priceChange = stock.price - stock.previous_close;
      const priceChangePercent = (priceChange / stock.previous_close) * 100;
      return {
        ticker: stock.ticker,
        price: stock.price,
        previousClose: stock.previous_close,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        fireLevel: stock.fire_level || 0,
        blackrockPct: stock.blackrock_pct || 0,
        vanguardPct: stock.vanguard_pct || 0
      };
    });
    
    // Get top gainers - sorted by highest percentage gain
    const gainers = stocksWithChange
      .filter(stock => stock.priceChangePercent > 0)
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent) // Highest gains first
      .slice(0, parseInt(limit));
    
    // Get top losers - sorted by biggest percentage loss
    const losers = stocksWithChange
      .filter(stock => stock.priceChangePercent < 0)
      .sort((a, b) => a.priceChangePercent - b.priceChangePercent) // Most negative first
      .slice(0, parseInt(limit));
    
    res.json({ 
      gainers, 
      losers,
      gainersCount: gainers.length,
      losersCount: losers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting movers:', error);
    res.status(500).json({ error: 'Failed to get movers' });
  }
});

// Ticker Management Endpoints
app.get('/api/tickers', async (req, res) => {
  try {
    const tickers = await dbService.getTickers();
    res.json({ tickers, count: tickers.length });
  } catch (error) {
    console.error('Error getting tickers:', error);
    res.status(500).json({ error: 'Failed to get tickers' });
  }
});

app.post('/api/tickers', async (req, res) => {
  try {
    const { ticker, tickers } = req.body;
    
    if (ticker) {
      // Add single ticker - scan first to check if it qualifies
      console.log(`🎯 Scanning ${ticker} to check if it qualifies...`);
      const scanner = new StockScanner();
      const scanResult = await scanner.scanNewTickers([ticker]);
      
      if (scanResult.stocks.length > 0) {
        const added = await dbService.addTicker(ticker);
        if (added) {
          res.json({ 
            success: true, 
            message: `Added qualifying ticker: ${ticker.toUpperCase()}`,
            fire_level: scanResult.stocks[0].fire_level
          });
        } else {
          res.status(400).json({ error: 'Ticker already exists' });
        }
      } else {
        res.status(400).json({ 
          error: `Ticker ${ticker.toUpperCase()} does not qualify (fire_level === 0)`,
          rejected: true
        });
      }
    } else if (tickers && Array.isArray(tickers)) {
      // Add multiple tickers - scan first to check which qualify
      console.log(`🎯 Scanning ${tickers.length} tickers to check which qualify...`);
      const scanner = new StockScanner();
      const scanResult = await scanner.scanNewTickers(tickers);
      
      const qualifiedTickers = scanResult.stocks.map(s => s.ticker);
      const added = await dbService.addTickers(qualifiedTickers);
      
      res.json({ 
        success: true, 
        added: added.length,
        rejected: tickers.length - added.length,
        tickers: added,
        message: `${added.length} qualifying tickers added (${tickers.length - added.length} rejected)`
      });
    } else {
      res.status(400).json({ error: 'Invalid request. Provide ticker or tickers array' });
    }
  } catch (error) {
    console.error('Error adding ticker(s):', error);
    res.status(500).json({ error: 'Failed to add ticker(s)' });
  }
});

app.put('/api/tickers', async (req, res) => {
  try {
    const { tickers } = req.body;
    
    if (!Array.isArray(tickers)) {
      return res.status(400).json({ error: 'tickers must be an array' });
    }
    
    const updatedTickers = await dbService.updateTickers(tickers);
    
    // Auto-trigger full scan after ticker list update
    console.log('🎯 Ticker list updated, triggering automatic full scan...');
    
    // Start scan in background
    setTimeout(async () => {
      try {
        const scanner = new StockScanner();
        await scanner.scan();
        console.log('✅ Auto-triggered full scan completed');
      } catch (error) {
        console.error('❌ Auto-triggered full scan failed:', error);
      }
    }, 1000);
    
    res.json({ 
      success: true, 
      tickers: updatedTickers, 
      count: updatedTickers.length,
      message: 'Tickers updated and full scan triggered automatically'
    });
  } catch (error) {
    console.error('Error updating tickers:', error);
    res.status(500).json({ error: 'Failed to update tickers' });
  }
});

app.patch('/api/tickers', async (req, res) => {
  try {
    const { tickers } = req.body;
    
    if (!Array.isArray(tickers)) {
      return res.status(400).json({ error: 'tickers must be an array' });
    }
    
    // Scan tickers FIRST before adding them to the list
    console.log(`🎯 Scanning ${tickers.length} new tickers to check if they qualify...`);
    
    const scanner = new StockScanner();
    const scanResult = await scanner.scanNewTickers(tickers);
    
    // Only add tickers that qualified (have fire_level > 0) to the tickers list
    const qualifiedTickers = scanResult.stocks.map(s => s.ticker);
    const added = await dbService.addTickers(qualifiedTickers);
    
    if (added.length > 0) {
      console.log(`✅ Added ${added.length} qualifying tickers to ticker list (${tickers.length - added.length} rejected)`);
      
      // Auto-populate Hot Picks watchlist after new tickers are added
      await autoPopulateHotPicks();
    } else {
      console.log(`⚠️ No qualifying tickers found (all ${tickers.length} tickers had fire_level === 0)`);
    }
    
    res.json({ 
      success: true, 
      added: added.length,
      rejected: tickers.length - added.length,
      tickers: added,
      message: added.length > 0 
        ? `${added.length} qualifying tickers added (${tickers.length - added.length} rejected for no fire)` 
        : 'No qualifying tickers found'
    });
  } catch (error) {
    console.error('Error adding tickers:', error);
    res.status(500).json({ error: 'Failed to add tickers' });
  }
});

app.delete('/api/tickers/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const removed = await dbService.removeTicker(ticker);
    
    if (removed) {
      res.json({ success: true, message: `Removed ticker: ${ticker.toUpperCase()}` });
    } else {
      res.status(404).json({ error: 'Ticker not found' });
    }
  } catch (error) {
    console.error('Error removing ticker:', error);
    res.status(500).json({ error: 'Failed to remove ticker' });
  }
});

// Holdings Management Endpoints
app.get('/api/holdings', async (req, res) => {
  try {
    const holdings = await dbService.getHoldings();
    res.json({ holdings, count: holdings.length });
  } catch (error) {
    console.error('Error getting holdings:', error);
    res.status(500).json({ error: 'Failed to get holdings' });
  }
});

app.post('/api/holdings/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const success = await dbService.addHolding(ticker);
    
    if (success) {
      res.json({ success: true, message: `Added ${ticker} to holdings` });
    } else {
      res.json({ success: false, message: `${ticker} already in holdings` });
    }
  } catch (error) {
    console.error('Error adding holding:', error);
    res.status(500).json({ error: 'Failed to add holding' });
  }
});

app.delete('/api/holdings/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const success = await dbService.removeHolding(ticker);
    
    if (success) {
      res.json({ success: true, message: `Removed ${ticker} from holdings` });
    } else {
      res.status(404).json({ success: false, message: `${ticker} not found in holdings` });
    }
  } catch (error) {
    console.error('Error removing holding:', error);
    res.status(500).json({ error: 'Failed to remove holding' });
  }
});

app.get('/api/holdings/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const isHolding = await dbService.isHolding(ticker);
    res.json({ ticker, isHolding });
  } catch (error) {
    console.error('Error checking holding:', error);
    res.status(500).json({ error: 'Failed to check holding status' });
  }
});

// Hot Picks auto-population endpoint
app.post('/api/watchlists/hot-picks/populate', async (req, res) => {
  try {
    const result = await autoPopulateHotPicks();
    res.json(result);
  } catch (error) {
    console.error('Error populating Hot Picks:', error);
    res.status(500).json({ success: false, error: 'Failed to populate Hot Picks' });
  }
});

// Watchlist Management Endpoints
app.get('/api/watchlists', async (req, res) => {
  try {
    const watchlists = await dbService.getWatchlists();
    const scanResults = await dbService.getScanResults();
    const stockData = new Map();
    
    // Create a map of stock data for quick lookup
    if (scanResults && scanResults.stocks) {
      scanResults.stocks.forEach(stock => {
        stockData.set(stock.ticker, stock);
      });
    }
    
    // Add stock data to each watchlist
    const watchlistsWithStockData = watchlists.map(watchlist => {
      const stocksWithFullData = watchlist.stocks.map(ticker => {
        const stock = stockData.get(ticker);
        return stock || { ticker };
      });
      
      return {
        ...watchlist,
        stockData: stocksWithFullData
      };
    });
    
    res.json({ watchlists: watchlistsWithStockData, count: watchlistsWithStockData.length });
  } catch (error) {
    console.error('Error getting watchlists:', error);
    res.status(500).json({ error: 'Failed to get watchlists' });
  }
});

app.get('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const watchlist = await dbService.getWatchlist(id);
    
    if (!watchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }
    
    // Add stock data to the watchlist
    const scanResults = await dbService.getScanResults();
    const stockData = new Map();
    
    if (scanResults && scanResults.stocks) {
      scanResults.stocks.forEach(stock => {
        stockData.set(stock.ticker, stock);
      });
    }

    const stocksWithFullData = watchlist.stocks.map(ticker => {
      const stock = stockData.get(ticker);
      return stock || { ticker };
    });

    const watchlistWithStockData = {
      ...watchlist,
      stockData: stocksWithFullData
    };
    
    res.json(watchlistWithStockData);
  } catch (error) {
    console.error('Error getting watchlist:', error);
    res.status(500).json({ error: 'Failed to get watchlist' });
  }
});

app.post('/api/watchlists', async (req, res) => {
  try {
    const { name, stocks = [] } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Watchlist name is required' });
    }
    
    const watchlist = await dbService.createWatchlist(name.trim(), stocks);
    res.json({ success: true, watchlist });
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ error: 'Failed to create watchlist' });
  }
});

app.put('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const watchlist = await dbService.updateWatchlist(id, updates);
    res.json({ success: true, watchlist });
  } catch (error) {
    console.error('Error updating watchlist:', error);
    if (error.message === 'Watchlist not found') {
      res.status(404).json({ error: 'Watchlist not found' });
    } else {
      res.status(500).json({ error: 'Failed to update watchlist' });
    }
  }
});

app.delete('/api/watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteWatchlist(id);
    res.json({ success: true, message: `Deleted watchlist: ${deleted.name}` });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    if (error.message === 'Watchlist not found') {
      res.status(404).json({ error: 'Watchlist not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete watchlist' });
    }
  }
});

app.post('/api/watchlists/:id/stocks', async (req, res) => {
  try {
    const { id } = req.params;
    const { stocks } = req.body;
    
    if (!stocks || !Array.isArray(stocks)) {
      return res.status(400).json({ error: 'Stocks array is required' });
    }
    
    const result = await dbService.addToWatchlist(id, stocks);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    if (error.message === 'Watchlist not found') {
      res.status(404).json({ error: 'Watchlist not found' });
    } else {
      res.status(500).json({ error: 'Failed to add stocks to watchlist' });
    }
  }
});

app.delete('/api/watchlists/:id/stocks', async (req, res) => {
  try {
    const { id } = req.params;
    const { stocks } = req.body;
    
    if (!stocks || !Array.isArray(stocks)) {
      return res.status(400).json({ error: 'Stocks array is required' });
    }
    
    const result = await dbService.removeFromWatchlist(id, stocks);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    if (error.message === 'Watchlist not found') {
      res.status(404).json({ error: 'Watchlist not found' });
    } else {
      res.status(500).json({ error: 'Failed to remove stocks from watchlist' });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stock Scanner API running on port ${PORT}`);
  console.log(`📊 Pure JavaScript implementation - no Python required!`);
  console.log(`📅 Using LowDB for data storage`);
  console.log(`🎯 Ticker management available at /api/tickers`);
  console.log(`⭐ Holdings management available at /api/holdings`);
});

module.exports = app;