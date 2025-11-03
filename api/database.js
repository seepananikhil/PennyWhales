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
      watchlists: [
        {
          id: 'default',
          name: 'My Watchlist',
          stocks: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'],
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        }
      ],
      holdings: {
        stocks: [], // Array of ticker symbols user is holding
        last_updated: null
      },
      settings: {
        created: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    // Ensure holdings section exists for existing databases
    if (!this.db.data.holdings) {
      this.db.data.holdings = {
        stocks: [], // Array of ticker symbols user is holding
        last_updated: null
      };
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

  // Calculate fire level for a stock - based purely on shareholding
  calculateFireLevel(stock) {
    const hasBlackrock = stock.blackrock_pct >= 5;
    const hasVanguard = stock.vanguard_pct >= 5;
    const hasBothFunds = hasBlackrock && hasVanguard;
    
    if (hasBothFunds) {
      return 3; // Excellent: Both funds ≥5%
    } else if (hasBlackrock || hasVanguard) {
      return 2; // Strong: One fund ≥5%
    } else if (stock.blackrock_pct >= 3 || stock.vanguard_pct >= 3) {
      return 1; // Moderate: One fund ≥3%
    }
    
    return 0; // No fire rating
  }

  // Scan Results Management
  async getScanResults() {
    await this.init();
    return this.db.data.scanResults;
  }

  async saveScanResults(results) {
    await this.init();
    
    // Add fire level to each stock and remove duplicates by ticker
    const stocksWithFireLevel = results.stocks?.map(stock => ({
      ...stock,
      fire_level: this.calculateFireLevel(stock)
    })) || [];
    
    // Remove duplicates by ticker, keeping the last occurrence
    const uniqueStocks = stocksWithFireLevel.filter((stock, index, arr) => 
      arr.findIndex(s => s.ticker === stock.ticker) === index
    );
    
    // Update summary with fire level counts
    const fireLevel3 = uniqueStocks.filter(s => s.fire_level === 3).length;
    const fireLevel2 = uniqueStocks.filter(s => s.fire_level === 2).length;
    const fireLevel1 = uniqueStocks.filter(s => s.fire_level === 1).length;
    const fireLevel0 = uniqueStocks.filter(s => s.fire_level === 0).length;
    
    this.db.data.scanResults = {
      ...results,
      stocks: uniqueStocks,
      summary: {
        ...results.summary,
        fire_level_3: fireLevel3,
        fire_level_2: fireLevel2,
        fire_level_1: fireLevel1,
        fire_level_0: fireLevel0,
        total_fire_stocks: fireLevel3 + fireLevel2 + fireLevel1,
        total_scanned_stocks: uniqueStocks.length
      },
      timestamp: new Date().toISOString()
    };
    
    await this.db.write();
    console.log(`💾 Saved scan results (${stocksWithFireLevel.length} stocks, ${fireLevel3 + fireLevel2 + fireLevel1} fire stocks)`);
    return this.db.data.scanResults;
  }

  async clearScanResults() {
    await this.init();
    
    // Clear scan results
    this.db.data.scanResults = {
      stocks: [],
      summary: {
        total_processed: 0,
        qualifying_count: 0,
        high_tier: 0,
        medium_tier: 0,
        low_tier: 0,
        under_dollar: 0,
        premium_count: 0,
        fire_level_3: 0,
        fire_level_2: 0,
        fire_level_1: 0,
        total_fire_stocks: 0
      },
      timestamp: null,
      new_stocks_only: false
    };
    
    await this.db.write();
    console.log('🗑️ Cleared scan results (tickers, holdings, and watchlists preserved)');
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

  // Migration: Add fire levels to existing data
  async migrateAddFireLevels() {
    await this.init();
    
    if (!this.db.data.scanResults || !this.db.data.scanResults.stocks) {
      console.log('No scan results to migrate');
      return { migrated: 0 };
    }

    let migrated = 0;
    const stocks = this.db.data.scanResults.stocks;

    for (let stock of stocks) {
      if (stock.fire_level === undefined) {
        stock.fire_level = this.calculateFireLevel(stock);
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
}

// Export singleton instance
const dbService = new DatabaseService();
module.exports = dbService;