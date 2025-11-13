const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

class DatabaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const adapter = new JSONFile(DB_FILE);
    this.db = new Low(adapter, {});

    await this.db.read();

    // Initialize default data structure
    this.db.data = this.db.data || {
      tickers: [],
      rejectedTickers: [],
      scanResults: {
        stocks: [],
        summary: {
          total_processed: 0,
          qualifying_count: 0,
          high_tier: 0,
          medium_tier: 0,
          low_tier: 0,
          under_dollar: 0,
          premium_count: 0
        },
        timestamp: null,
        new_stocks_only: false
      },
      watchlists: [],
      holdings: {
        stocks: [], // Array of ticker symbols user is holding
        last_updated: null
      },
      priceAlerts: [], // Price alerts for stocks
      settings: {
        created: new Date().toISOString(),
        version: '1.0.0',
        telegramChatId: null, // User's Telegram chat ID for alerts
        telegramBotToken: null // Optional: Store bot token (or use env var)
      }
    };

    // Ensure holdings section exists for existing databases
    if (!this.db.data.holdings) {
      this.db.data.holdings = {
        stocks: [], // Array of ticker symbols user is holding
        last_updated: null
      };
    }

    // Ensure rejectedTickers section exists for existing databases
    if (!this.db.data.rejectedTickers) {
      this.db.data.rejectedTickers = [];
    }

    // Ensure priceAlerts section exists for existing databases
    if (!this.db.data.priceAlerts) {
      this.db.data.priceAlerts = [];
    }

    await this.db.write();
    this.initialized = true;
    console.log('📊 Database initialized');
  }

  // Ticker Management
  async getTickers() {
    await this.init();
    return this.db.data.tickers;
  }

  async addTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    
    if (!this.db.data.tickers.includes(normalizedTicker)) {
      this.db.data.tickers.push(normalizedTicker);
      await this.db.write();
      console.log(`✅ Added ticker: ${normalizedTicker}`);
      return true;
    }
    return false; // Already exists
  }

  async addTickers(tickers) {
    await this.init();
    const added = [];
    
    for (const ticker of tickers) {
      const normalizedTicker = ticker.toUpperCase().trim();
      if (!this.db.data.tickers.includes(normalizedTicker)) {
        this.db.data.tickers.push(normalizedTicker);
        added.push(normalizedTicker);
      }
    }
    
    if (added.length > 0) {
      await this.db.write();
      console.log(`✅ Added ${added.length} new tickers`);
    }
    
    return added;
  }

  async removeTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    const index = this.db.data.tickers.indexOf(normalizedTicker);
    
    if (index > -1) {
      this.db.data.tickers.splice(index, 1);
      await this.db.write();
      console.log(`🗑️ Removed ticker: ${normalizedTicker}`);
      return true;
    }
    return false; // Not found
  }

  async updateTickers(tickers) {
    await this.init();
    this.db.data.tickers = tickers.map(t => t.toUpperCase().trim());
    await this.db.write();
    console.log(`📝 Updated ticker list (${this.db.data.tickers.length} tickers)`);
    return this.db.data.tickers;
  }

  // Rejected Tickers Management (for stocks with fire_level <= 0)
  async getRejectedTickers() {
    await this.init();
    return this.db.data.rejectedTickers || [];
  }

  async addRejectedTickers(tickers) {
    await this.init();
    const added = [];
    
    for (const ticker of tickers) {
      const normalizedTicker = ticker.toUpperCase().trim();
      if (!this.db.data.rejectedTickers.includes(normalizedTicker)) {
        this.db.data.rejectedTickers.push(normalizedTicker);
        added.push(normalizedTicker);
      }
    }
    
    if (added.length > 0) {
      await this.db.write();
      console.log(`🚫 Added ${added.length} rejected tickers`);
    }
    
    return added;
  }

  async clearRejectedTickers() {
    await this.init();
    this.db.data.rejectedTickers = [];
    await this.db.write();
    console.log('🗑️ Cleared rejected tickers');
  }

  // Holdings Management
  async getHoldings() {
    await this.init();
    return this.db.data.holdings.stocks || [];
  }

  async addHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    
    if (!this.db.data.holdings.stocks.includes(normalizedTicker)) {
      this.db.data.holdings.stocks.push(normalizedTicker);
      this.db.data.holdings.last_updated = new Date().toISOString();
      await this.db.write();
      console.log(`⭐ Added to holdings: ${normalizedTicker}`);
      return true;
    }
    return false; // Already exists
  }

  async removeHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    const index = this.db.data.holdings.stocks.indexOf(normalizedTicker);
    
    if (index > -1) {
      this.db.data.holdings.stocks.splice(index, 1);
      this.db.data.holdings.last_updated = new Date().toISOString();
      await this.db.write();
      console.log(`🗑️ Removed from holdings: ${normalizedTicker}`);
      return true;
    }
    return false; // Not found
  }

  async isHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    return this.db.data.holdings.stocks.includes(normalizedTicker);
  }

  // Scan Results Management
  async getScanResults() {
    await this.init();
    
    // Retry logic for read operations in case of temporary file system issues
    let retries = 3;
    while (retries > 0) {
      try {
        await this.db.read();
        return this.db.data.scanResults;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to read scan results after retries:', error.message);
          // Return cached data if available
          return this.db.data.scanResults || { stocks: [], summary: {}, timestamp: null };
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async saveScanResults(results) {
    await this.init();
    
    // Get previous scan results to calculate changes
    const previousResults = this.db.data.scanResults?.stocks || [];
    const previousStocksMap = new Map(previousResults.map(s => [s.ticker, s]));
    
    // Use the stocks and summary as they come from the scanner
    const stocks = results.stocks || [];
    
    // Remove duplicates by ticker, keeping the last occurrence (defensive coding)
    const uniqueStocks = stocks.filter((stock, index, arr) => 
      arr.findIndex(s => s.ticker === stock.ticker) === index
    );
    
    // Add change tracking for institutional holdings
    const stocksWithChanges = uniqueStocks.map(stock => {
      const previousStock = previousStocksMap.get(stock.ticker);
      
      if (previousStock) {
        // Calculate actual changes from previous scan
        const blackrockChange = stock.blackrock_pct - previousStock.blackrock_pct;
        const vanguardChange = stock.vanguard_pct - previousStock.vanguard_pct;
        
        // Only update change if there's an actual difference (not zero/very small)
        // Otherwise, keep the previous change value
        const threshold = 0.01; // Consider changes less than 0.01% as unchanged
        
        return {
          ...stock,
          blackrock_change: Math.abs(blackrockChange) > threshold 
            ? blackrockChange 
            : (previousStock.blackrock_change || 0),
          vanguard_change: Math.abs(vanguardChange) > threshold 
            ? vanguardChange 
            : (previousStock.vanguard_change || 0),
          previous_fire_level: previousStock.fire_level
        };
      } else {
        // New stock - set changes to 0
        return {
          ...stock,
          blackrock_change: 0,
          vanguard_change: 0,
          previous_fire_level: null
        };
      }
    });
    
    // Save results with minimal processing
    this.db.data.scanResults = {
      ...results,
      stocks: stocksWithChanges,
      summary: {
        ...results.summary,
        total_scanned_stocks: stocksWithChanges.length
      },
      timestamp: new Date().toISOString()
    };
    
    // Retry logic for write operations
    let retries = 3;
    while (retries > 0) {
      try {
        await this.db.write();
        console.log(`💾 Saved scan results (${stocksWithChanges.length} stocks)`);
        return this.db.data.scanResults;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to save scan results after retries:', error.message);
          throw error;
        }
        console.warn(`Write failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  async clearScanResults() {
    await this.init();
    
    // Clear scan results with minimal structure
    this.db.data.scanResults = {
      stocks: [],
      summary: {
        total_processed: 0,
        qualifying_count: 0,
        total_scanned_stocks: 0
      },
      timestamp: null
    };
    
    await this.db.write();
    console.log('🗑️ Cleared scan results');
  }

  // Watchlist functions
  async getWatchlists() {
    await this.init();
    return this.db.data.watchlists || [];
  }

  async getWatchlist(id) {
    await this.init();
    return this.db.data.watchlists?.find(watchlist => watchlist.id === id) || null;
  }

  async createWatchlist(name, stocks = []) {
    await this.init();
    const id = `watchlist_${Date.now()}`;
    const watchlist = {
      id,
      name,
      stocks: stocks.map(s => s.toUpperCase().trim()),
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    if (!this.db.data.watchlists) {
      this.db.data.watchlists = [];
    }

    this.db.data.watchlists.push(watchlist);
    await this.db.write();
    console.log(`📋 Created watchlist: ${name}`);
    return watchlist;
  }

  async updateWatchlist(id, updates) {
    await this.init();
    const watchlistIndex = this.db.data.watchlists?.findIndex(w => w.id === id);
    
    if (watchlistIndex === -1) {
      throw new Error('Watchlist not found');
    }

    this.db.data.watchlists[watchlistIndex] = {
      ...this.db.data.watchlists[watchlistIndex],
      ...updates,
      updated: new Date().toISOString()
    };

    if (updates.stocks) {
      this.db.data.watchlists[watchlistIndex].stocks = updates.stocks.map(s => s.toUpperCase().trim());
    }

    await this.db.write();
    console.log(`📋 Updated watchlist: ${id}`);
    return this.db.data.watchlists[watchlistIndex];
  }

  async deleteWatchlist(id) {
    await this.init();
    const watchlistIndex = this.db.data.watchlists?.findIndex(w => w.id === id);
    
    if (watchlistIndex === -1) {
      throw new Error('Watchlist not found');
    }

    const deleted = this.db.data.watchlists.splice(watchlistIndex, 1)[0];
    await this.db.write();
    console.log(`📋 Deleted watchlist: ${deleted.name}`);
    return deleted;
  }

  async addToWatchlist(id, stocks) {
    await this.init();
    const watchlist = await this.getWatchlist(id);
    
    if (!watchlist) {
      throw new Error('Watchlist not found');
    }

    const normalizedStocks = stocks.map(s => s.toUpperCase().trim());
    const newStocks = normalizedStocks.filter(stock => !watchlist.stocks.includes(stock));
    
    if (newStocks.length > 0) {
      watchlist.stocks.push(...newStocks);
      await this.updateWatchlist(id, { stocks: watchlist.stocks });
    }

    return { added: newStocks.length, total: watchlist.stocks.length };
  }

  async removeFromWatchlist(id, stocks) {
    await this.init();
    const watchlist = await this.getWatchlist(id);
    
    if (!watchlist) {
      throw new Error('Watchlist not found');
    }

    const normalizedStocks = stocks.map(s => s.toUpperCase().trim());
    const filteredStocks = watchlist.stocks.filter(stock => !normalizedStocks.includes(stock));
    
    await this.updateWatchlist(id, { stocks: filteredStocks });
    return { removed: watchlist.stocks.length - filteredStocks.length, total: filteredStocks.length };
  }

  // Migration: Add fire levels to existing data (legacy function)
  async migrateAddFireLevels() {
    await this.init();
    
    if (!this.db.data.scanResults || !this.db.data.scanResults.stocks) {
      console.log('No scan results to migrate');
      return { migrated: 0 };
    }

    // Import calculateFireLevel only for this legacy migration
    const { calculateFireLevel } = require('./fireUtils');
    
    let migrated = 0;
    const stocks = this.db.data.scanResults.stocks;

    for (let stock of stocks) {
      if (stock.fire_level === undefined) {
        stock.fire_level = calculateFireLevel(stock);
        migrated++;
      }
    }

    if (migrated > 0) {
      // Update summary with fire level counts
      const fireLevel3 = stocks.filter(s => s.fire_level === 3).length;
      const fireLevel2 = stocks.filter(s => s.fire_level === 2).length;
      const fireLevel1 = stocks.filter(s => s.fire_level === 1).length;
      
      this.db.data.scanResults.summary = {
        ...this.db.data.scanResults.summary,
        fire_level_3: fireLevel3,
        fire_level_2: fireLevel2,
        fire_level_1: fireLevel1,
        total_fire_stocks: fireLevel3 + fireLevel2 + fireLevel1
      };

      await this.db.write();
      console.log(`🔥 Migrated ${migrated} stocks with fire levels`);
    }

    return { migrated, total: stocks.length };
  }

  // Utility functions
  async getStats() {
    await this.init();
    return {
      totalTickers: this.db.data.tickers?.length || 0,
      lastScan: this.db.data.scanResults?.timestamp || null,
      qualifyingStocks: this.db.data.scanResults?.stocks?.length || 0
    };
  }

  async exportData() {
    await this.init();
    return JSON.stringify(this.db.data, null, 2);
  }

  async importData(data) {
    await this.init();
    this.db.data = data;
    await this.db.write();
    console.log('📥 Imported data to database');
  }

  // Price Alerts Management
  async getPriceAlerts() {
    await this.init();
    return this.db.data.priceAlerts || [];
  }

  async addPriceAlert(alert) {
    await this.init();
    const newAlert = {
      id: `alert_${Date.now()}`,
      ticker: alert.ticker.toUpperCase().trim(),
      targetPrice: alert.targetPrice,
      condition: alert.condition, // 'above' or 'below'
      active: true,
      triggered: false,
      created: new Date().toISOString(),
      triggeredAt: null
    };

    this.db.data.priceAlerts.push(newAlert);
    await this.db.write();
    console.log(`🔔 Added price alert: ${newAlert.ticker} ${newAlert.condition} $${newAlert.targetPrice}`);
    return newAlert;
  }

  async removePriceAlert(alertId) {
    await this.init();
    const index = this.db.data.priceAlerts.findIndex(a => a.id === alertId);
    
    if (index > -1) {
      const removed = this.db.data.priceAlerts.splice(index, 1)[0];
      await this.db.write();
      console.log(`🗑️ Removed price alert: ${alertId}`);
      return removed;
    }
    return null;
  }

  async updatePriceAlert(alertId, updates) {
    await this.init();
    const alertIndex = this.db.data.priceAlerts.findIndex(a => a.id === alertId);
    
    if (alertIndex === -1) {
      throw new Error('Alert not found');
    }

    this.db.data.priceAlerts[alertIndex] = {
      ...this.db.data.priceAlerts[alertIndex],
      ...updates,
      updated: new Date().toISOString()
    };

    await this.db.write();
    console.log(`🔔 Updated price alert: ${alertId}`);
    return this.db.data.priceAlerts[alertIndex];
  }

  async getActivePriceAlerts() {
    await this.init();
    return this.db.data.priceAlerts.filter(a => a.active && !a.triggered);
  }

  async getAlertsByTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    return this.db.data.priceAlerts.filter(a => a.ticker === normalizedTicker);
  }

  // Settings Management
  async getSettings() {
    await this.init();
    return this.db.data.settings;
  }

  async updateSettings(updates) {
    await this.init();
    this.db.data.settings = {
      ...this.db.data.settings,
      ...updates
    };
    await this.db.write();
    console.log('⚙️ Updated settings');
    return this.db.data.settings;
  }
}

// Export singleton instance
const dbService = new DatabaseService();
module.exports = dbService;