const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class DatabaseService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      // Test connection
      await prisma.$connect();
      
      // Initialize default data if needed
      const tickersDoc = await prisma.tickers.findFirst();
      if (!tickersDoc) {
        await prisma.tickers.create({
          data: { tickers: [] }
        });
      }

      const rejectedTickersDoc = await prisma.rejectedTickers.findFirst();
      if (!rejectedTickersDoc) {
        await prisma.rejectedTickers.create({
          data: { tickers: [] }
        });
      }

      const scanDoc = await prisma.scanResults.findFirst();
      if (!scanDoc) {
        await prisma.scanResults.create({
          data: {
            stocks: [],
            summary: {
              total_processed: 0,
              qualifying_count: 0,
              total_scanned_stocks: 0
            },
            timestamp: null
          }
        });
      }

      const watchlistCount = await prisma.watchlist.count();
      if (watchlistCount === 0) {
        await prisma.watchlist.create({
          data: {
            listId: 'default',
            name: 'My Watchlist',
            stocks: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'],
            created: new Date(),
            updated: new Date()
          }
        });
      }

      const holdingsDoc = await prisma.holdings.findFirst();
      if (!holdingsDoc) {
        await prisma.holdings.create({
          data: {
            stocks: [],
            last_updated: null
          }
        });
      }

      const settingsDoc = await prisma.settings.findFirst();
      if (!settingsDoc) {
        await prisma.settings.create({
          data: {
            created: new Date(),
            version: '1.0.0'
          }
        });
      }

      this.initialized = true;
      console.log('📊 MongoDB Database initialized with Prisma');
    } catch (error) {
      console.error('❌ Database initialization error:', error.message);
      throw error;
    }
  }

  // Ticker Management
  async getTickers() {
    await this.init();
    const tickersDoc = await prisma.tickers.findFirst();
    return tickersDoc?.tickers || [];
  }

  async addTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    
    const tickersDoc = await prisma.tickers.findFirst();
    const currentTickers = tickersDoc?.tickers || [];
    
    if (!currentTickers.includes(normalizedTicker)) {
      await prisma.tickers.update({
        where: { id: tickersDoc.id },
        data: { tickers: [...currentTickers, normalizedTicker] }
      });
      console.log(`✅ Added ticker: ${normalizedTicker}`);
      return true;
    }
    return false;
  }

  async addTickers(tickers) {
    await this.init();
    const normalizedTickers = tickers.map(t => t.toUpperCase().trim());
    
    const tickersDoc = await prisma.tickers.findFirst();
    const currentTickers = tickersDoc?.tickers || [];
    const added = normalizedTickers.filter(t => !currentTickers.includes(t));
    
    if (added.length > 0) {
      await prisma.tickers.update({
        where: { id: tickersDoc.id },
        data: { tickers: [...currentTickers, ...added] }
      });
      console.log(`✅ Added ${added.length} new tickers`);
    }
    
    return added;
  }

  async removeTicker(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    
    const tickersDoc = await prisma.tickers.findFirst();
    const currentTickers = tickersDoc?.tickers || [];
    
    if (currentTickers.includes(normalizedTicker)) {
      const filteredTickers = currentTickers.filter(t => t !== normalizedTicker);
      await prisma.tickers.update({
        where: { id: tickersDoc.id },
        data: { tickers: filteredTickers }
      });
      console.log(`🗑️ Removed ticker: ${normalizedTicker}`);
      return true;
    }
    return false;
  }

  async updateTickers(tickers) {
    await this.init();
    const normalizedTickers = tickers.map(t => t.toUpperCase().trim());
    
    const tickersDoc = await prisma.tickers.findFirst();
    await prisma.tickers.update({
      where: { id: tickersDoc.id },
      data: { tickers: normalizedTickers }
    });
    
    console.log(`📝 Updated ticker list (${normalizedTickers.length} tickers)`);
    return normalizedTickers;
  }

  // Rejected Tickers Management
  async getRejectedTickers() {
    await this.init();
    const rejectedDoc = await prisma.rejectedTickers.findFirst();
    return rejectedDoc?.tickers || [];
  }

  async addRejectedTickers(tickers) {
    await this.init();
    const normalizedTickers = tickers.map(t => t.toUpperCase().trim());
    
    const rejectedDoc = await prisma.rejectedTickers.findFirst();
    const currentRejected = rejectedDoc?.tickers || [];
    const newRejected = normalizedTickers.filter(t => !currentRejected.includes(t));
    
    if (newRejected.length > 0) {
      await prisma.rejectedTickers.update({
        where: { id: rejectedDoc.id },
        data: { tickers: [...currentRejected, ...newRejected] }
      });
      console.log(`🚫 Added ${newRejected.length} rejected tickers`);
    }
    
    return newRejected;
  }

  async clearRejectedTickers() {
    await this.init();
    const rejectedDoc = await prisma.rejectedTickers.findFirst();
    if (rejectedDoc) {
      await prisma.rejectedTickers.update({
        where: { id: rejectedDoc.id },
        data: { tickers: [] }
      });
      console.log('🗑️ Cleared rejected tickers');
    }
  }

  // Holdings Management
  async getHoldings() {
    await this.init();
    const holdingsDoc = await prisma.holdings.findFirst();
    return holdingsDoc?.stocks || [];
  }

  async addHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    
    const holdingsDoc = await prisma.holdings.findFirst();
    const currentHoldings = holdingsDoc?.stocks || [];
    
    if (!currentHoldings.includes(normalizedTicker)) {
      await prisma.holdings.update({
        where: { id: holdingsDoc.id },
        data: {
          stocks: [...currentHoldings, normalizedTicker],
          last_updated: new Date()
        }
      });
      console.log(`⭐ Added to holdings: ${normalizedTicker}`);
      return true;
    }
    return false;
  }

  async removeHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    
    const holdingsDoc = await prisma.holdings.findFirst();
    const currentHoldings = holdingsDoc?.stocks || [];
    
    if (currentHoldings.includes(normalizedTicker)) {
      const filteredHoldings = currentHoldings.filter(t => t !== normalizedTicker);
      await prisma.holdings.update({
        where: { id: holdingsDoc.id },
        data: {
          stocks: filteredHoldings,
          last_updated: new Date()
        }
      });
      console.log(`🗑️ Removed from holdings: ${normalizedTicker}`);
      return true;
    }
    return false;
  }

  async isHolding(ticker) {
    await this.init();
    const normalizedTicker = ticker.toUpperCase().trim();
    const holdings = await this.getHoldings();
    return holdings.includes(normalizedTicker);
  }

  // Scan Results Management
  async getScanResults() {
    await this.init();
    const resultsDoc = await prisma.scanResults.findFirst();
    if (!resultsDoc) {
      return {
        stocks: [],
        summary: {
          total_processed: 0,
          qualifying_count: 0,
          total_scanned_stocks: 0
        },
        timestamp: null
      };
    }
    return {
      stocks: resultsDoc.stocks,
      summary: resultsDoc.summary,
      timestamp: resultsDoc.timestamp
    };
  }

  async saveScanResults(results) {
    await this.init();
    
    const stocks = results.stocks || [];
    const uniqueStocks = stocks.filter((stock, index, arr) => 
      arr.findIndex(s => s.ticker === stock.ticker) === index
    );
    
    const scanData = {
      stocks: uniqueStocks,
      summary: {
        ...results.summary,
        total_scanned_stocks: uniqueStocks.length
      },
      timestamp: new Date()
    };
    
    const existingDoc = await prisma.scanResults.findFirst();
    if (existingDoc) {
      await prisma.scanResults.update({
        where: { id: existingDoc.id },
        data: scanData
      });
    } else {
      await prisma.scanResults.create({ data: scanData });
    }
    
    console.log(`💾 Saved scan results (${uniqueStocks.length} stocks)`);
    return scanData;
  }

  async clearScanResults() {
    await this.init();
    
    const existingDoc = await prisma.scanResults.findFirst();
    if (existingDoc) {
      await prisma.scanResults.update({
        where: { id: existingDoc.id },
        data: {
          stocks: [],
          summary: {
            total_processed: 0,
            qualifying_count: 0,
            total_scanned_stocks: 0
          },
          timestamp: null
        }
      });
    }
    
    console.log('🗑️ Cleared scan results');
  }

  // Watchlist functions
  async getWatchlists() {
    await this.init();
    const watchlists = await prisma.watchlist.findMany();
    return watchlists.map(w => ({
      id: w.listId,
      name: w.name,
      stocks: w.stocks,
      created: w.created.toISOString(),
      updated: w.updated.toISOString()
    }));
  }

  async getWatchlist(id) {
    await this.init();
    const watchlist = await prisma.watchlist.findUnique({
      where: { listId: id }
    });
    if (!watchlist) return null;
    return {
      id: watchlist.listId,
      name: watchlist.name,
      stocks: watchlist.stocks,
      created: watchlist.created.toISOString(),
      updated: watchlist.updated.toISOString()
    };
  }

  async createWatchlist(name, stocks = []) {
    await this.init();
    const listId = `watchlist_${Date.now()}`;
    const watchlist = await prisma.watchlist.create({
      data: {
        listId,
        name,
        stocks: stocks.map(s => s.toUpperCase().trim()),
        created: new Date(),
        updated: new Date()
      }
    });
    console.log(`📋 Created watchlist: ${name}`);
    return {
      id: watchlist.listId,
      name: watchlist.name,
      stocks: watchlist.stocks,
      created: watchlist.created.toISOString(),
      updated: watchlist.updated.toISOString()
    };
  }

  async updateWatchlist(id, updates) {
    await this.init();
    const existing = await prisma.watchlist.findUnique({
      where: { listId: id }
    });
    
    if (!existing) {
      throw new Error('Watchlist not found');
    }

    const updateData = {
      ...updates,
      updated: new Date()
    };

    if (updates.stocks) {
      updateData.stocks = updates.stocks.map(s => s.toUpperCase().trim());
    }

    const watchlist = await prisma.watchlist.update({
      where: { listId: id },
      data: updateData
    });

    console.log(`📋 Updated watchlist: ${id}`);
    return {
      id: watchlist.listId,
      name: watchlist.name,
      stocks: watchlist.stocks,
      created: watchlist.created.toISOString(),
      updated: watchlist.updated.toISOString()
    };
  }

  async deleteWatchlist(id) {
    await this.init();
    const watchlist = await prisma.watchlist.findUnique({
      where: { listId: id }
    });
    
    if (!watchlist) {
      throw new Error('Watchlist not found');
    }

    await prisma.watchlist.delete({
      where: { listId: id }
    });
    
    console.log(`📋 Deleted watchlist: ${watchlist.name}`);
    return {
      id: watchlist.listId,
      name: watchlist.name,
      stocks: watchlist.stocks,
      created: watchlist.created.toISOString(),
      updated: watchlist.updated.toISOString()
    };
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
    
    const scanResults = await this.getScanResults();
    
    if (!scanResults || !scanResults.stocks) {
      console.log('No scan results to migrate');
      return { migrated: 0 };
    }

    const { calculateFireLevel } = require('./fireUtils');
    
    let migrated = 0;
    const stocks = scanResults.stocks;

    for (let stock of stocks) {
      if (stock.fire_level === undefined) {
        stock.fire_level = calculateFireLevel(stock);
        migrated++;
      }
    }

    if (migrated > 0) {
      const fireLevel3 = stocks.filter(s => s.fire_level === 3).length;
      const fireLevel2 = stocks.filter(s => s.fire_level === 2).length;
      const fireLevel1 = stocks.filter(s => s.fire_level === 1).length;
      
      scanResults.summary = {
        ...scanResults.summary,
        fire_level_3: fireLevel3,
        fire_level_2: fireLevel2,
        fire_level_1: fireLevel1,
        total_fire_stocks: fireLevel3 + fireLevel2 + fireLevel1
      };

      await this.saveScanResults(scanResults);
      console.log(`🔥 Migrated ${migrated} stocks with fire levels`);
    }

    return { migrated, total: stocks.length };
  }

  // Utility functions
  async getStats() {
    await this.init();
    const tickers = await this.getTickers();
    const scanResults = await this.getScanResults();
    
    return {
      totalTickers: tickers.length,
      lastScan: scanResults.timestamp || null,
      qualifyingStocks: scanResults.stocks?.length || 0
    };
  }

  async exportData() {
    await this.init();
    const tickers = await this.getTickers();
    const scanResults = await this.getScanResults();
    const watchlists = await this.getWatchlists();
    const holdings = await this.getHoldings();
    const settings = await prisma.settings.findFirst();
    
    return JSON.stringify({
      tickers,
      scanResults,
      watchlists,
      holdings: { stocks: holdings, last_updated: new Date().toISOString() },
      settings: settings ? {
        created: settings.created.toISOString(),
        version: settings.version
      } : null
    }, null, 2);
  }

  async importData(data) {
    await this.init();
    
    if (data.tickers) {
      await this.updateTickers(data.tickers);
    }
    if (data.scanResults) {
      await this.saveScanResults(data.scanResults);
    }
    if (data.watchlists) {
      // Clear existing and insert new
      const existing = await prisma.watchlist.findMany();
      for (const w of existing) {
        await prisma.watchlist.delete({ where: { listId: w.listId } });
      }
      for (const w of data.watchlists) {
        await prisma.watchlist.create({
          data: {
            listId: w.id,
            name: w.name,
            stocks: w.stocks,
            created: new Date(w.created),
            updated: new Date(w.updated)
          }
        });
      }
    }
    if (data.holdings && data.holdings.stocks) {
      const holdingsDoc = await prisma.holdings.findFirst();
      if (holdingsDoc) {
        await prisma.holdings.update({
          where: { id: holdingsDoc.id },
          data: {
            stocks: data.holdings.stocks,
            last_updated: new Date()
          }
        });
      }
    }
    
    console.log('📥 Imported data to database');
  }
}

// Export singleton instance
const dbService = new DatabaseService();
module.exports = dbService;