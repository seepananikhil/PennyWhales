const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

// Separate JSON files for different data domains
const DB_FILES = {
  tickers: path.join(__dirname, 'data', 'tickers.json'),
  scanResults: path.join(__dirname, 'data', 'scanResults.json'),
  watchlists: path.join(__dirname, 'data', 'watchlists.json'),
  holdings: path.join(__dirname, 'data', 'holdings.json'),
  priceAlerts: path.join(__dirname, 'data', 'priceAlerts.json'),
  settings: path.join(__dirname, 'data', 'settings.json'),
  institutionalChanges: path.join(__dirname, 'data', 'institutionalChanges.json')
};

class DatabaseService {
  constructor() {
    this.dbs = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Create data directory if it doesn't exist
    const fs = require('fs');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize tickers database
    const tickersAdapter = new JSONFile(DB_FILES.tickers);
    this.dbs.tickers = new Low(tickersAdapter, {});
    await this.dbs.tickers.read();
    this.dbs.tickers.data = this.dbs.tickers.data || {
      tickers: [],
      rejectedTickers: []
    };
    await this.dbs.tickers.write();

    // Initialize scan results database
    const scanResultsAdapter = new JSONFile(DB_FILES.scanResults);
    this.dbs.scanResults = new Low(scanResultsAdapter, {});
    await this.dbs.scanResults.read();
    this.dbs.scanResults.data = this.dbs.scanResults.data || {
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
    };
    await this.dbs.scanResults.write();

    // Initialize watchlists database
    const watchlistsAdapter = new JSONFile(DB_FILES.watchlists);
    this.dbs.watchlists = new Low(watchlistsAdapter, {});
    await this.dbs.watchlists.read();
    this.dbs.watchlists.data = this.dbs.watchlists.data || [];
    await this.dbs.watchlists.write();

    // Initialize holdings database
    const holdingsAdapter = new JSONFile(DB_FILES.holdings);
    this.dbs.holdings = new Low(holdingsAdapter, {});
    await this.dbs.holdings.read();
    this.dbs.holdings.data = this.dbs.holdings.data || {
      stocks: [],
      last_updated: null
    };
    await this.dbs.holdings.write();

    // Initialize price alerts database
    const priceAlertsAdapter = new JSONFile(DB_FILES.priceAlerts);
    this.dbs.priceAlerts = new Low(priceAlertsAdapter, {});
    await this.dbs.priceAlerts.read();
    this.dbs.priceAlerts.data = this.dbs.priceAlerts.data || [];
    await this.dbs.priceAlerts.write();

    // Initialize settings database
    const settingsAdapter = new JSONFile(DB_FILES.settings);
    this.dbs.settings = new Low(settingsAdapter, {});
    await this.dbs.settings.read();
    this.dbs.settings.data = this.dbs.settings.data || {
      created: new Date().toISOString(),
      version: '1.0.0',
      telegramChatId: null,
      telegramBotToken: null
    };
    await this.dbs.settings.write();

    // Initialize institutional changes database
    const institutionalChangesAdapter = new JSONFile(DB_FILES.institutionalChanges);
    this.dbs.institutionalChanges = new Low(institutionalChangesAdapter, {});
    await this.dbs.institutionalChanges.read();
    this.dbs.institutionalChanges.data = this.dbs.institutionalChanges.data || {
      additions: [],
      sells: []
    };
    await this.dbs.institutionalChanges.write();

    this.initialized = true;
    console.log('📊 Database initialized (multi-file mode)');
  }

  // Ticker Management
  async getTickers() {
    await this.init();
    return this.dbs.tickers.data.tickers;
  }

  async addTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();

    if (!this.dbs.tickers.data.tickers.includes(normalizedTicker)) {
      this.dbs.tickers.data.tickers.push(normalizedTicker);
      await this.dbs.tickers.write();
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
      if (!this.dbs.tickers.data.tickers.includes(normalizedTicker)) {
        this.dbs.tickers.data.tickers.push(normalizedTicker);
        added.push(normalizedTicker);
      }
    }

    if (added.length > 0) {
      await this.dbs.tickers.write();
      console.log(`✅ Added ${added.length} new tickers`);
    }

    return added;
  }

  async removeTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    const index = this.dbs.tickers.data.tickers.indexOf(normalizedTicker);

    if (index > -1) {
      this.dbs.tickers.data.tickers.splice(index, 1);

      // Add to rejected tickers list
      if (!this.dbs.tickers.data.rejectedTickers.includes(normalizedTicker)) {
        this.dbs.tickers.data.rejectedTickers.push(normalizedTicker);
        console.log(`🚫 Added ${normalizedTicker} to rejected tickers`);
      }

      await this.dbs.tickers.write();
      console.log(`🗑️ Removed ticker: ${normalizedTicker}`);
      return true;
    }
    return false; // Not found
  }

  async updateTickers(tickers) {
    await this.init();
    this.dbs.tickers.data.tickers = tickers.map(t => t.toUpperCase().trim());
    await this.dbs.tickers.write();
    console.log(`📝 Updated ticker list (${this.dbs.tickers.data.tickers.length} tickers)`);
    return this.dbs.tickers.data.tickers;
  }

  // Rejected Tickers Management (30-day auto-expiry)
  async getRejectedTickers() {
    await this.init();
    const EXPIRY_DAYS = 30;
    const now = Date.now();
    const raw = this.dbs.tickers.data.rejectedTickers || [];

    // Migrate old plain-string format to object format
    const normalized = raw.map(entry =>
      typeof entry === 'string'
        ? { ticker: entry, rejectedAt: new Date(0).toISOString() } // treat old entries as expired
        : entry
    );

    // Filter out entries older than 30 days
    const valid = normalized.filter(entry => {
      const age = (now - new Date(entry.rejectedAt).getTime()) / (1000 * 60 * 60 * 24);
      return age < EXPIRY_DAYS;
    });

    // Persist if we cleaned anything up
    if (valid.length !== raw.length) {
      this.dbs.tickers.data.rejectedTickers = valid;
      await this.dbs.tickers.write();
      console.log(`🧹 Expired ${raw.length - valid.length} rejected tickers (>30 days old)`);
    }

    return valid.map(entry => entry.ticker);
  }

  async addRejectedTickers(tickers) {
    await this.init();
    const added = [];
    // Get current valid (non-expired) ticker strings to check duplicates
    const existingTickers = await this.getRejectedTickers();
    const existingSet = new Set(existingTickers);
    const now = new Date().toISOString();

    for (const ticker of tickers) {
      const normalizedTicker = ticker.toUpperCase().trim();
      if (!existingSet.has(normalizedTicker)) {
        this.dbs.tickers.data.rejectedTickers.push({ ticker: normalizedTicker, rejectedAt: now });
        added.push(normalizedTicker);
      } else {
        // Refresh the timestamp for already-rejected tickers so the 30-day window resets
        const idx = this.dbs.tickers.data.rejectedTickers.findIndex(
          e => (typeof e === 'string' ? e : e.ticker) === normalizedTicker
        );
        if (idx > -1) {
          this.dbs.tickers.data.rejectedTickers[idx] = { ticker: normalizedTicker, rejectedAt: now };
        }
      }
    }

    if (added.length > 0 || tickers.length > 0) {
      await this.dbs.tickers.write();
      if (added.length > 0) console.log(`🚫 Added ${added.length} rejected tickers (expire in 30 days)`);
    }

    return added;
  }

  async clearRejectedTickers() {
    await this.init();
    this.dbs.tickers.data.rejectedTickers = [];
    await this.dbs.tickers.write();
    console.log('🗑️ Cleared rejected tickers');
  }

  // Holdings Management
  async getHoldings() {
    await this.init();
    return this.dbs.holdings.data.stocks || [];
  }

  async addHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();

    if (!this.dbs.holdings.data.stocks.includes(normalizedTicker)) {
      this.dbs.holdings.data.stocks.push(normalizedTicker);
      this.dbs.holdings.data.last_updated = new Date().toISOString();
      await this.dbs.holdings.write();
      console.log(`⭐ Added to holdings: ${normalizedTicker}`);
      return true;
    }
    return false; // Already exists
  }

  async removeHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    const index = this.dbs.holdings.data.stocks.indexOf(normalizedTicker);

    if (index > -1) {
      this.dbs.holdings.data.stocks.splice(index, 1);
      this.dbs.holdings.data.last_updated = new Date().toISOString();
      await this.dbs.holdings.write();
      console.log(`🗑️ Removed from holdings: ${normalizedTicker}`);
      return true;
    }
    return false; // Not found
  }

  async isHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    return this.dbs.holdings.data.stocks.includes(normalizedTicker);
  }

  // Scan Results Management
  async getScanResults() {
    await this.init();

    // Retry logic for read operations in case of temporary file system issues
    let retries = 3;
    while (retries > 0) {
      try {
        await this.dbs.scanResults.read();
        return this.dbs.scanResults.data;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to read scan results after retries:', error.message);
          // Return cached data if available
          return this.dbs.scanResults.data || { stocks: [], summary: {}, timestamp: null };
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async getStockByTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    const scanResults = await this.getScanResults();
    return scanResults.stocks?.find(s => s.ticker === normalizedTicker) || null;
  }

  async saveScanResults(results) {
    await this.init();

    // Get previous scan results to calculate changes
    const previousResults = this.dbs.scanResults.data?.stocks || [];
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
        // Calculate changes based on PERCENTAGE POINT DIFFERENCE
        // This tracks real ownership changes (shares bought/sold)
        const blackrockPctChange = (stock.blackrock_pct || 0) - (previousStock.blackrock_pct || 0);
        const vanguardPctChange = (stock.vanguard_pct || 0) - (previousStock.vanguard_pct || 0);

        // Only update change if there's a significant percentage point difference
        // Threshold: 0.05 percentage points (0.05% of shares outstanding)
        const threshold = 0.05;

        // Round changes to 2 decimal places
        const roundedBlackrockChange = Math.round(blackrockPctChange * 100) / 100;
        const roundedVanguardChange = Math.round(vanguardPctChange * 100) / 100;

        return {
          ...stock,
          blackrock_change: Math.abs(blackrockPctChange) > threshold
            ? roundedBlackrockChange
            : (previousStock.blackrock_change || 0),
          vanguard_change: Math.abs(vanguardPctChange) > threshold
            ? roundedVanguardChange
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
    this.dbs.scanResults.data = {
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
        await this.dbs.scanResults.write();
        console.log(`💾 Saved scan results (${stocksWithChanges.length} stocks)`);
        return this.dbs.scanResults.data;
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
    this.dbs.scanResults.data = {
      stocks: [],
      summary: {
        total_processed: 0,
        qualifying_count: 0,
        total_scanned_stocks: 0
      },
      timestamp: null
    };

    await this.dbs.scanResults.write();
    console.log('🗑️ Cleared scan results');
  }

  // Watchlist functions
  async getWatchlists() {
    await this.init();
    return this.dbs.watchlists.data || [];
  }

  async getWatchlist(id) {
    await this.init();
    return this.dbs.watchlists.data?.find(watchlist => watchlist.id === id) || null;
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

    if (!Array.isArray(this.dbs.watchlists.data)) {
      this.dbs.watchlists.data = [];
    }

    this.dbs.watchlists.data.push(watchlist);
    await this.dbs.watchlists.write();
    console.log(`📋 Created watchlist: ${name}`);
    return watchlist;
  }

  async updateWatchlist(id, updates) {
    await this.init();
    const watchlistIndex = this.dbs.watchlists.data?.findIndex(w => w.id === id);

    if (watchlistIndex === -1) {
      throw new Error('Watchlist not found');
    }

    // Process stocks if provided
    let updatedStocks = null;
    if (updates.stocks) {
      updatedStocks = updates.stocks.map(s => s.toUpperCase().trim());
    }

    // Create a copy of updates without stocks
    const { stocks, ...otherUpdates } = updates;

    this.dbs.watchlists.data[watchlistIndex] = {
      ...this.dbs.watchlists.data[watchlistIndex],
      ...otherUpdates,
      updated: new Date().toISOString()
    };

    // Apply updated stocks if we have them
    if (updatedStocks) {
      this.dbs.watchlists.data[watchlistIndex].stocks = updatedStocks;
    }

    await this.dbs.watchlists.write();
    console.log(`📋 Updated watchlist: ${id}`);
    return this.dbs.watchlists.data[watchlistIndex];
  }

  async deleteWatchlist(id) {
    await this.init();
    const watchlistIndex = this.dbs.watchlists.data?.findIndex(w => w.id === id);

    if (watchlistIndex === -1) {
      throw new Error('Watchlist not found');
    }

    const deleted = this.dbs.watchlists.data.splice(watchlistIndex, 1)[0];
    await this.dbs.watchlists.write();
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

    if (!this.dbs.scanResults.data || !this.dbs.scanResults.data.stocks) {
      console.log('No scan results to migrate');
      return { migrated: 0 };
    }

    // Import calculateFireLevel only for this legacy migration
    const { calculateFireLevel } = require('./fireUtils');

    let migrated = 0;
    const stocks = this.dbs.scanResults.data.stocks;

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

      this.dbs.scanResults.data.summary = {
        ...this.dbs.scanResults.data.summary,
        fire_level_3: fireLevel3,
        fire_level_2: fireLevel2,
        fire_level_1: fireLevel1,
        total_fire_stocks: fireLevel3 + fireLevel2 + fireLevel1
      };

      await this.dbs.scanResults.write();
      console.log(`🔥 Migrated ${migrated} stocks with fire levels`);
    }

    return { migrated, total: stocks.length };
  }

  // Utility functions
  async getStats() {
    await this.init();
    return {
      totalTickers: this.dbs.tickers.data.tickers?.length || 0,
      lastScan: this.dbs.scanResults.data?.timestamp || null,
      qualifyingStocks: this.dbs.scanResults.data?.stocks?.length || 0
    };
  }

  async exportData() {
    await this.init();
    const allData = {
      tickers: this.dbs.tickers.data,
      scanResults: this.dbs.scanResults.data,
      watchlists: this.dbs.watchlists.data,
      holdings: this.dbs.holdings.data,
      priceAlerts: this.dbs.priceAlerts.data,
      settings: this.dbs.settings.data
    };
    return JSON.stringify(allData, null, 2);
  }

  async importData(data) {
    await this.init();
    if (data.tickers) {
      this.dbs.tickers.data = data.tickers;
      await this.dbs.tickers.write();
    }
    if (data.scanResults) {
      this.dbs.scanResults.data = data.scanResults;
      await this.dbs.scanResults.write();
    }
    if (data.watchlists) {
      this.dbs.watchlists.data = data.watchlists;
      await this.dbs.watchlists.write();
    }
    if (data.holdings) {
      this.dbs.holdings.data = data.holdings;
      await this.dbs.holdings.write();
    }
    if (data.priceAlerts) {
      this.dbs.priceAlerts.data = data.priceAlerts;
      await this.dbs.priceAlerts.write();
    }
    if (data.settings) {
      this.dbs.settings.data = data.settings;
      await this.dbs.settings.write();
    }
    console.log('📥 Imported data to database');
  }

  // Price Alerts Management
  async getPriceAlerts() {
    await this.init();
    return this.dbs.priceAlerts.data || [];
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

    if (!Array.isArray(this.dbs.priceAlerts.data)) {
      this.dbs.priceAlerts.data = [];
    }

    this.dbs.priceAlerts.data.push(newAlert);
    await this.dbs.priceAlerts.write();
    console.log(`🔔 Added price alert: ${newAlert.ticker} ${newAlert.condition} $${newAlert.targetPrice}`);
    return newAlert;
  }

  async removePriceAlert(alertId) {
    await this.init();
    const index = this.dbs.priceAlerts.data.findIndex(a => a.id === alertId);

    if (index > -1) {
      const removed = this.dbs.priceAlerts.data.splice(index, 1)[0];
      await this.dbs.priceAlerts.write();
      console.log(`🗑️ Removed price alert: ${alertId}`);
      return removed;
    }
    return null;
  }

  async updatePriceAlert(alertId, updates) {
    await this.init();
    const alertIndex = this.dbs.priceAlerts.data.findIndex(a => a.id === alertId);

    if (alertIndex === -1) {
      throw new Error('Alert not found');
    }

    this.dbs.priceAlerts.data[alertIndex] = {
      ...this.dbs.priceAlerts.data[alertIndex],
      ...updates,
      updated: new Date().toISOString()
    };

    await this.dbs.priceAlerts.write();
    console.log(`🔔 Updated price alert: ${alertId}`);
    return this.dbs.priceAlerts.data[alertIndex];
  }

  async getActivePriceAlerts() {
    await this.init();
    return this.dbs.priceAlerts.data.filter(a => a.active && !a.triggered);
  }

  async getAlertsByTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    return this.dbs.priceAlerts.data.filter(a => a.ticker === normalizedTicker);
  }

  // Settings Management
  async getSettings() {
    await this.init();
    return this.dbs.settings.data;
  }

  async updateSettings(updates) {
    await this.init();
    this.dbs.settings.data = {
      ...this.dbs.settings.data,
      ...updates
    };
    await this.dbs.settings.write();
    console.log('⚙️ Updated settings');
    return this.dbs.settings.data;
  }

  // Institutional Changes Management
  async getInstitutionalChanges() {
    await this.init();
    return this.dbs.institutionalChanges.data;
  }

  async saveInstitutionalChanges(additions, sells) {
    await this.init();
    const timestamp = new Date().toISOString();
    const now = new Date();
    const AGGREGATION_WINDOW_DAYS = 30; // Aggregate changes within 30 days

    // Ensure data structure exists
    if (!this.dbs.institutionalChanges.data.additions) {
      this.dbs.institutionalChanges.data.additions = [];
    }
    if (!this.dbs.institutionalChanges.data.sells) {
      this.dbs.institutionalChanges.data.sells = [];
    }

    // Helper function to aggregate institutional changes
    const aggregateChanges = (newStocks, existingStocks) => {
      const result = [];
      const processedTickers = new Set();

      for (const newStock of newStocks) {
        if (processedTickers.has(newStock.ticker)) continue;

        // Find existing entry for this ticker within aggregation window
        const existingIndex = existingStocks.findIndex(existing => {
          if (existing.ticker !== newStock.ticker) return false;
          const existingDate = new Date(existing.detected_at);
          const daysDiff = (now - existingDate) / (1000 * 60 * 60 * 24);
          return daysDiff <= AGGREGATION_WINDOW_DAYS;
        });

        if (existingIndex >= 0) {
          // Check if ownership has actually changed
          const existing = existingStocks[existingIndex];

          // Compare current ownership percentages
          const brSame = Math.abs((existing.blackrock_pct || 0) - (newStock.blackrock_pct || 0)) < 0.01;
          const vgSame = Math.abs((existing.vanguard_pct || 0) - (newStock.vanguard_pct || 0)) < 0.01;
          const ssSame = Math.abs((existing.statestreet_pct || 0) - (newStock.statestreet_pct || 0)) < 0.01;

          if (brSame && vgSame && ssSame) {
            // No actual change - keep existing entry with updated timestamp
            result.push({
              ...existing,
              detected_at: timestamp,
              price: newStock.price // Update current price
            });
            processedTickers.add(newStock.ticker);
            existingStocks.splice(existingIndex, 1);
          } else {
            // Actual change detected - calculate delta from baseline
            const baseBlackrock = existing.initial_blackrock_pct !== undefined ? existing.initial_blackrock_pct : (existing.blackrock_pct || 0) - (existing.blackrock_change || 0);
            const baseVanguard = existing.initial_vanguard_pct !== undefined ? existing.initial_vanguard_pct : (existing.vanguard_pct || 0) - (existing.vanguard_change || 0);
            const baseStatestreet = existing.initial_statestreet_pct !== undefined ? existing.initial_statestreet_pct : (existing.statestreet_pct || 0) - (existing.statestreet_change || 0);

            const newBrChange = (newStock.blackrock_pct || 0) - baseBlackrock;
            const newVgChange = (newStock.vanguard_pct || 0) - baseVanguard;
            const newSsChange = (newStock.statestreet_pct || 0) - baseStatestreet;

            const aggregated = {
              ...newStock,
              blackrock_change: newBrChange,
              vanguard_change: newVgChange,
              statestreet_change: newSsChange,
              totalChange: newBrChange + newVgChange + newSsChange,
              initial_blackrock_pct: baseBlackrock,
              initial_vanguard_pct: baseVanguard,
              initial_statestreet_pct: baseStatestreet,
              detected_at: timestamp,
              first_detected_at: existing.first_detected_at || existing.detected_at,
              aggregation_count: (existing.aggregation_count || 1) + 1
            };
            result.push(aggregated);
            processedTickers.add(newStock.ticker);
            existingStocks.splice(existingIndex, 1);
          }
        } else {
          // New entry - calculate baseline
          const baseBlackrock = (newStock.blackrock_pct || 0) - (newStock.blackrock_change || 0);
          const baseVanguard = (newStock.vanguard_pct || 0) - (newStock.vanguard_change || 0);
          const baseStatestreet = (newStock.statestreet_pct || 0) - (newStock.statestreet_change || 0);

          result.push({
            ...newStock,
            initial_blackrock_pct: baseBlackrock,
            initial_vanguard_pct: baseVanguard,
            initial_statestreet_pct: baseStatestreet,
            detected_at: timestamp,
            first_detected_at: timestamp,
            aggregation_count: 1
          });
          processedTickers.add(newStock.ticker);
        }
      }

      // Add remaining existing stocks that weren't aggregated
      return [...result, ...existingStocks];
    };

    // Aggregate additions and sells
    const aggregatedAdditions = aggregateChanges(additions, [...this.dbs.institutionalChanges.data.additions]);
    const aggregatedSells = aggregateChanges(sells, [...this.dbs.institutionalChanges.data.sells]);

    // Keep only last 100 entries for each
    this.dbs.institutionalChanges.data.additions = aggregatedAdditions.slice(0, 100);
    this.dbs.institutionalChanges.data.sells = aggregatedSells.slice(0, 100);

    await this.dbs.institutionalChanges.write();
    console.log(`💾 Saved ${additions.length} additions and ${sells.length} sells to institutional changes history (smart aggregation within ${AGGREGATION_WINDOW_DAYS} days)`);
    return this.dbs.institutionalChanges.data;
  }

  async clearInstitutionalChanges() {
    await this.init();
    this.dbs.institutionalChanges.data = {
      additions: [],
      sells: []
    };
    await this.dbs.institutionalChanges.write();
    console.log('🗑️ Cleared institutional changes history');
    return this.dbs.institutionalChanges.data;
  }
}

// Export singleton instance
const dbService = new DatabaseService();
module.exports = dbService;