const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const StockScanner = require('./stockScanner');
const dbService = require('./database');
const { getStockPriceData } = require('./priceUtils');

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

// API Routes

// Start scan
app.post('/api/scan/start', async (req, res) => {
  if (scanState.scanning) {
    return res.json({ success: false, message: 'Scan already in progress' });
  }

  try {
    scanState.scanning = true;
    scanState.error = null;
    scanState.progress = { current: 0, total: 0, percentage: 0 };

    // Create new scanner instance
    currentScanner = new StockScanner();
    
    // Set up progress callback
    currentScanner.onProgress = (progress) => {
      scanState.progress = progress;
      console.log(`Progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    };

    res.json({ success: true, message: 'Full scan started successfully' });

    // Run scan asynchronously
    try {
      const results = await currentScanner.scan();
      scanState.scanning = false;
      scanState.last_scan = new Date().toISOString();
      console.log('✅ Full scan completed successfully');
    } catch (error) {
      scanState.scanning = false;
      scanState.error = error.message;
      console.error('❌ Full scan failed:', error);
    }

  } catch (error) {
    scanState.scanning = false;
    scanState.error = error.message;
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start daily scan (fire stocks only)
app.post('/api/scan/daily', async (req, res) => {
  if (scanState.scanning) {
    return res.json({ success: false, message: 'Scan already in progress' });
  }

  try {
    scanState.scanning = true;
    scanState.error = null;
    scanState.progress = { current: 0, total: 0, percentage: 0 };

    // Get previous fire stocks
    const previousResults = await dbService.getScanResults();
    const previousFireStocks = previousResults?.stocks?.filter(s => s.fire_level && s.fire_level > 0) || [];
    
    if (previousFireStocks.length === 0) {
      scanState.scanning = false;
      return res.json({ success: false, message: 'No previous fire stocks found. Run a full scan first.' });
    }

    const fireStockTickers = previousFireStocks.map(s => s.ticker);
    console.log(`🔥 Starting daily scan for ${fireStockTickers.length} fire stocks: ${fireStockTickers.join(', ')}`);

    // Create new scanner instance with fire stocks only
    currentScanner = new StockScanner();
    
    // Set up progress callback
    currentScanner.onProgress = (progress) => {
      scanState.progress = progress;
      console.log(`Daily scan progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    };

    res.json({ success: true, message: `Daily scan started for ${fireStockTickers.length} fire stocks` });

    // Run daily scan asynchronously
    try {
      const results = await currentScanner.scanTickers(fireStockTickers, previousFireStocks);
      scanState.scanning = false;
      scanState.last_scan = new Date().toISOString();
      console.log('✅ Daily scan completed successfully');
    } catch (error) {
      scanState.scanning = false;
      scanState.error = error.message;
      console.error('❌ Daily scan failed:', error);
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
      // Add single ticker
      const added = await dbService.addTicker(ticker);
      if (added) {
        res.json({ success: true, message: `Added ticker: ${ticker.toUpperCase()}` });
      } else {
        res.status(400).json({ error: 'Ticker already exists' });
      }
    } else if (tickers && Array.isArray(tickers)) {
      // Add multiple tickers
      const added = await dbService.addTickers(tickers);
      res.json({ success: true, added: added.length, tickers: added });
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
    
    // Clear processed stocks to force full scan
    await dbService.resetProcessedStocks();
    
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
    
    const added = await dbService.addTickers(tickers);
    
    // Auto-trigger full scan after adding new tickers
    if (added.length > 0) {
      console.log(`🎯 ${added.length} new tickers added, triggering automatic full scan...`);
      
      // Clear processed stocks to force full scan
      await dbService.resetProcessedStocks();
      
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
    }
    
    res.json({ 
      success: true, 
      added: added.length, 
      tickers: added,
      message: added.length > 0 ? 'New tickers added and full scan triggered automatically' : 'No new tickers to add'
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

// Watchlist Management Endpoints
app.get('/api/watchlists', async (req, res) => {
  try {
    const watchlists = await dbService.getWatchlists();
    res.json({ watchlists, count: watchlists.length });
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
    
    res.json(watchlist);
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

// Database stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dbService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Automated Daily Scan Scheduling
const startAutomatedDailyScan = async () => {
  if (scanState.scanning) {
    console.log('⏭️ Skipping automated daily scan - scan already in progress');
    return;
  }

  try {
    console.log('🕐 Starting automated daily scan...');
    scanState.scanning = true;
    scanState.error = null;
    scanState.progress = { current: 0, total: 0, percentage: 0 };

    // Get previous fire stocks
    const previousResults = await dbService.getScanResults();
    const previousFireStocks = previousResults?.stocks?.filter(s => s.fire_level && s.fire_level > 0) || [];
    
    if (previousFireStocks.length === 0) {
      console.log('⚠️ No previous fire stocks found. Automated scan skipped. Run a full scan first.');
      scanState.scanning = false;
      return;
    }

    const fireStockTickers = previousFireStocks.map(s => s.ticker);
    console.log(`🔥 Automated daily scan for ${fireStockTickers.length} fire stocks: ${fireStockTickers.join(', ')}`);

    // Create new scanner instance with fire stocks only
    currentScanner = new StockScanner();
    
    // Set up progress callback
    currentScanner.onProgress = (progress) => {
      scanState.progress = progress;
      console.log(`Automated scan progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
    };

    // Run scan for fire stocks only
    const results = await currentScanner.scanTickers(fireStockTickers, previousFireStocks);
    
    scanState.scanning = false;
    scanState.last_scan = new Date().toISOString();
    scanState.progress = { current: results.length, total: fireStockTickers.length, percentage: 100 };
    
    console.log(`✅ Automated daily scan completed: ${results.length} fire stocks updated`);
    
  } catch (error) {
    console.error('❌ Automated daily scan failed:', error);
    scanState.scanning = false;
    scanState.error = error.message;
  }
};

// Schedule automated daily scans
// 8PM IST (2:30 PM UTC) on weekdays (Monday-Friday)
cron.schedule('30 14 * * 1-5', () => {
  console.log('🕒 Triggering automated daily scan at 8:00 PM IST');
  startAutomatedDailyScan();
}, {
  timezone: "UTC"
});

// 2AM IST (8:30 PM UTC previous day) on weekdays (Sunday-Thursday for IST Monday-Friday)
cron.schedule('30 20 * * 0-4', () => {
  console.log('🕐 Triggering automated daily scan at 2:00 AM IST');
  startAutomatedDailyScan();
}, {
  timezone: "UTC"
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stock Scanner API running on port ${PORT}`);
  console.log(`📊 Pure JavaScript implementation - no Python required!`);
  console.log(`📅 Using LowDB for data storage`);
  console.log(`🎯 Ticker management available at /api/tickers`);
  console.log(`⭐ Holdings management available at /api/holdings`);
  console.log(`⏰ Automated daily scans scheduled:`);
  console.log(`   📅 Weekdays at 7:00 PM IST (1:30 PM UTC)`);
  console.log(`   📅 Weekdays at 2:00 AM IST (8:30 PM UTC previous day)`);
  console.log(`🔄 Automated scans will update fire stocks only`);
});

module.exports = app;