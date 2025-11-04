const fs = require('fs');
const path = require('path');
const dbService = require('./database');
const { getStockPriceData } = require('./priceUtils');
const { calculateFireLevel } = require('./fireUtils');

// C  // Parse BlackRock and Vanguard holdingsOLD_THRESHOLD = 3.0; // 3% minimum holding
const DELAY_BETWEEN_REQUESTS = 500; // ms
const REQUIRE_BOTH_HOLDERS = false;

class StockScanner {
  constructor() {
    this.results = [];
    this.processed = 0;
    this.total = 0;
    this.onProgress = null;
  }

  // Load tickers from file
  async loadTickers() {
    try {
      return await dbService.getTickers();
    } catch (error) {
      console.error('Error loading tickers:', error);
      return [];
    }
  }

  // Load previous results
  async loadPreviousResults() {
    try {
      return await dbService.getScanResults();
    } catch (error) {
      console.error('Error loading previous results:', error);
    }
    return null;
  }

  // Get stock price using shared utility
  async getStockPrice(ticker) {
    return await getStockPriceData(ticker);
  }

  // Get institutional holdings from Nasdaq
  async getNasdaqHoldings(ticker) {
    try {
      const response = await fetch(
        `https://api.nasdaq.com/api/company/${ticker}/institutional-holdings`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  // Parse BlackRock and Vanguard holdings
  parseHoldings(data) {
    if (!data?.data?.holdingsTransactions?.table?.rows) {
      return { blackrock: 0, vanguard: 0 };
    }

    let blackrockPct = 0;
    let vanguardPct = 0;

    try {
      const holdings = data.data.holdingsTransactions.table.rows;
      
      // Get total shares for percentage calculation
      let totalShares = 0;
      if (data.data.ownershipSummary?.ShareoutstandingTotal?.value) {
        const sharesStr = data.data.ownershipSummary.ShareoutstandingTotal.value.replace(/[,\s]/g, '');
        const match = sharesStr.match(/[\d\.]+/);
        if (match) {
          totalShares = parseFloat(match[0]) * 1000000; // Convert millions to actual shares
        }
      }

      for (const holding of holdings) {
        if (!holding.ownerName) continue;

        const ownerName = holding.ownerName.toUpperCase();
        const sharesHeldStr = holding.sharesHeld?.replace(/[,\s]/g, '') || '0';
        const sharesHeld = parseFloat(sharesHeldStr) || 0;

        if (totalShares > 0) {
          const pctHeld = (sharesHeld / totalShares) * 100;

          if (ownerName.includes('BLACKROCK') || ownerName.includes('BLACK ROCK')) {
            blackrockPct = Math.max(blackrockPct, pctHeld);
          } else if (ownerName.includes('VANGUARD')) {
            vanguardPct = Math.max(vanguardPct, pctHeld);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing holdings:', error);
    }

    return { blackrock: blackrockPct, vanguard: vanguardPct };
  }

  // Analyze a single ticker
  async analyzeTicker(ticker) {
    try {
      // Get stock price
      const priceData = await this.getStockPrice(ticker);
      if (!priceData) {
        return null;
      }

      // Get holdings data
      const holdingsData = await this.getNasdaqHoldings(ticker);
      if (!holdingsData) {
        return null;
      }

      const { blackrock, vanguard } = this.parseHoldings(holdingsData);

      // Always return the stock data regardless of holding percentages
      // The fire level calculation will handle the rating (including 0 for no fire)
      return {
        ticker,
        price: Math.round(priceData.price * 100) / 100, // Round to 2 decimals
        previous_close: Math.round(priceData.previousClose * 100) / 100, // Round to 2 decimals
        blackrock_pct: blackrock,
        vanguard_pct: vanguard
      };
    } catch (error) {
      console.error(`Error analyzing ${ticker}:`, error);
      return null;
    }
  }

  // Calculate ranking
  calculateRanking(stock) {
    const { blackrock_pct, vanguard_pct, price } = stock;
    
    const hasBoth = blackrock_pct > 0 && vanguard_pct > 0;
    const hasBr4Plus = blackrock_pct >= 4.0;
    const hasVg4Plus = vanguard_pct >= 4.0;
    const hasBr3Plus = blackrock_pct >= 3.0;
    const hasVg3Plus = vanguard_pct >= 3.0;

    if (hasBoth && hasBr4Plus && hasVg4Plus) {
      return { category: 1, score: -(blackrock_pct + vanguard_pct) + price * 0.01 };
    } else if ((hasBr3Plus && vanguard_pct > 0) || (hasVg3Plus && blackrock_pct > 0)) {
      return { category: 2, score: price };
    } else {
      return { category: 3, score: price };
    }
  }

  // Save results - handles both full scan and daily scan
  async saveResults(stocks, totalProcessed, isDailyScan = false) {
    try {
      if (!isDailyScan) {
        // Full scan: just save all results directly
        const ranking = stocks.map(stock => ({
          ...stock
        }));

        ranking.sort((a, b) => {
          if (a.fire_level !== b.fire_level) return b.fire_level - a.fire_level; // Higher fire first
          return a.price - b.price; // Lower price first within same fire level
        });

        const results = {
          stocks: ranking,
          summary: {
            total_processed: totalProcessed,
            qualifying_count: ranking.length,
            under_dollar: ranking.filter(s => s.price < 1.0).length,
            fire_level_3: ranking.filter(s => s.fire_level === 3).length,
            fire_level_2: ranking.filter(s => s.fire_level === 2).length,
            fire_level_1: ranking.filter(s => s.fire_level === 1).length,
            total_fire_stocks: ranking.filter(s => s.fire_level > 0).length
          },
          timestamp: new Date().toISOString()
        };

        await dbService.saveScanResults(results);
        console.log(`✅ Full scan saved: ${ranking.length} stocks`);
        return;
      }

      // Daily scan: merge with existing results
      const currentResults = await dbService.getScanResults();
      
      if (!currentResults || !currentResults.stocks) {
        console.log('⚠️ No existing scan results found. Saving daily scan as new results.');
        // Just save the fire stocks if no existing data
        await dbService.saveScanResults({
          stocks: stocks,
          summary: { total_processed: totalProcessed, qualifying_count: stocks.length },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Create a map of updated fire stocks by ticker
      const updatedStocksMap = new Map();
      stocks.forEach(stock => {
        updatedStocksMap.set(stock.ticker, stock);
      });

      // Merge: Update existing fire stocks, keep everything else unchanged
      const mergedStocks = currentResults.stocks.map(existingStock => {
        if (updatedStocksMap.has(existingStock.ticker)) {
          return updatedStocksMap.get(existingStock.ticker); // Replace with updated data
        }
        return existingStock; // Keep unchanged
      });

      // Sort and save merged results
      mergedStocks.sort((a, b) => {
        if (a.fire_level !== b.fire_level) return b.fire_level - a.fire_level; // Higher fire first
        return a.price - b.price; // Lower price first within same fire level
      });

      const results = {
        stocks: mergedStocks,
        summary: {
          ...currentResults.summary, // Keep original summary
          qualifying_count: mergedStocks.length
        },
        timestamp: new Date().toISOString()
      };

      await dbService.saveScanResults(results);
      console.log(`✅ Daily scan merged: Updated ${stocks.length} fire stocks, total ${mergedStocks.length} stocks`);
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }

  // Main scan function
  async scan() {
    console.log('🎯 Starting JavaScript Stock Scanner...');
    
    const allTickers = await this.loadTickers();
    if (allTickers.length === 0) {
      throw new Error('No tickers found');
    }

    // For full scan, always process ALL tickers (no processed stocks filtering)
    const tickersToScan = allTickers;
    
    console.log(`📊 Full scan: Processing ALL ${tickersToScan.length} tickers...`);
    
    this.total = tickersToScan.length;
    this.processed = 0;
    this.results = [];

    for (const ticker of tickersToScan) {
      this.processed++;
      
      if (this.onProgress) {
        this.onProgress({
          current: this.processed,
          total: this.total,
          percentage: Math.round((this.processed / this.total) * 100)
        });
      }

      const result = await this.analyzeTicker(ticker);
      if (result) {
        // Calculate fire level for consistency with daily scan
        result.fire_level = calculateFireLevel(result);
        
        // Add change tracking fields for consistency with daily scan
        result.previous_fire_level = result.fire_level; // Same as current since it's a fresh scan
        result.fire_level_changed = false; // No change in full scan
        
        this.results.push(result);
        console.log(`✅ ${ticker} - $${result.price.toFixed(2)} | BR:${result.blackrock_pct.toFixed(1)}% VG:${result.vanguard_pct.toFixed(1)}% | Fire:${result.fire_level}🔥`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Save results
    await this.saveResults(this.results, allTickers.length);

    console.log(`🎯 Scan complete: ${this.results.length} qualifying stocks found`);
    
    return {
      stocks: this.results,
      summary: {
        total_processed: allTickers.length,
        qualifying_count: this.results.length
      }
    };
  }

  // Scan new tickers and simply add them to existing results
  async scanNewTickers(newTickers) {
    console.log(`🆕 Starting scan for ${newTickers.length} new tickers...`);
    
    if (newTickers.length === 0) {
      throw new Error('No new tickers provided for scanning');
    }

    this.results = [];
    this.processed = 0;
    this.total = newTickers.length;

    for (const ticker of newTickers) {
      this.processed++;
      
      if (this.onProgress) {
        this.onProgress({
          current: this.processed,
          total: this.total,
          percentage: Math.round((this.processed / this.total) * 100)
        });
      }

      const result = await this.analyzeTicker(ticker);
      if (result) {
        // Calculate fire level for the new ticker
        result.fire_level = calculateFireLevel(result);
        
        // For new tickers, no previous fire level
        result.previous_fire_level = 0;
        result.fire_level_changed = result.fire_level > 0; // New ticker with fire is a "change"
        
        this.results.push(result);
        console.log(`✅ NEW ${ticker} - $${result.price.toFixed(2)} | BR:${result.blackrock_pct.toFixed(1)}% VG:${result.vanguard_pct.toFixed(1)}% | Fire:${result.fire_level}🔥`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Add new results to existing scan results
    await this.addToExistingResults(this.results);

    console.log(`🆕 New ticker scan complete: ${this.results.length} new stocks added`);
    
    return {
      stocks: this.results,
      summary: {
        total_processed: newTickers.length,
        qualifying_count: this.results.length,
        new_tickers: this.results.length
      }
    };
  }

  // Add new stock results to existing scan results
  async addToExistingResults(newStocks) {
    try {
      // Get current scan results
      const currentResults = await dbService.getScanResults();
      
      if (!currentResults || !currentResults.stocks) {
        console.log('⚠️ No existing scan results found. Saving new ticker results as initial data.');
        // Create new results with just the new stocks
        await dbService.saveScanResults({
          stocks: newStocks,
          summary: { 
            total_processed: newStocks.length, 
            qualifying_count: newStocks.length,
            new_tickers_added: newStocks.length
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Simply append new stocks to existing stocks
      const allStocks = [...currentResults.stocks, ...newStocks];

      // Sort by fire level (descending) then by price (ascending)
      allStocks.sort((a, b) => {
        if (a.fire_level !== b.fire_level) return b.fire_level - a.fire_level; // Higher fire first
        return a.price - b.price; // Lower price first within same fire level
      });

      // Update summary stats
      const updatedSummary = {
        ...currentResults.summary,
        qualifying_count: allStocks.length,
        new_tickers_added: newStocks.length,
        last_new_ticker_scan: new Date().toISOString()
      };

      const results = {
        stocks: allStocks,
        summary: updatedSummary,
        timestamp: new Date().toISOString()
      };

      await dbService.saveScanResults(results);
      console.log(`✅ Added ${newStocks.length} new stocks to existing ${currentResults.stocks.length} stocks, total now ${allStocks.length}`);
    } catch (error) {
      console.error('Error adding new stocks to existing results:', error);
    }
  }

  // Daily scan function for specific tickers with change tracking
  async scanTickers(tickers, previousStocks = []) {
    console.log(`🔥 Starting daily scan for ${tickers.length} fire stocks...`);
    
    if (tickers.length === 0) {
      throw new Error('No tickers provided for daily scan');
    }

    // Create a map of previous stock data for comparison
    const previousStockMap = new Map();
    previousStocks.forEach(stock => {
      previousStockMap.set(stock.ticker, stock);
    });

    this.results = [];
    this.processed = 0;
    this.total = tickers.length;

    for (const ticker of tickers) {
      this.processed++;
      
      if (this.onProgress) {
        this.onProgress({
          current: this.processed,
          total: this.total,
          percentage: Math.round((this.processed / this.total) * 100)
        });
      }

      const result = await this.analyzeTicker(ticker);
      if (result) {
        // Calculate fire level using the same logic as database service
        result.fire_level = calculateFireLevel(result);
        
        const previousStock = previousStockMap.get(ticker);
        
        // Add change tracking
        if (previousStock) {
          result.previous_fire_level = previousStock.fire_level;
          result.fire_level_changed = result.fire_level !== previousStock.fire_level;
        } else {
          result.fire_level_changed = false;
        }

        this.results.push(result);
        
        // Log detailed analysis for each ticker (like in full scan)
        console.log(`✅ ${ticker} - $${result.price.toFixed(2)} | BR:${result.blackrock_pct.toFixed(1)}% VG:${result.vanguard_pct.toFixed(1)}% | Fire:${result.fire_level}🔥`);
        
        // Log changes
        if (result.fire_level_changed) {
          const changeDirection = result.fire_level > result.previous_fire_level ? '📈' : '📉';
          console.log(`${changeDirection} ${ticker} fire level changed: ${result.previous_fire_level}🔥 → ${result.fire_level}🔥`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Save results using daily scan merge logic
    await this.saveResults(this.results, tickers.length, true);

    const changeCount = this.results.filter(s => s.fire_level_changed).length;
    
    console.log(`🔥 Daily scan complete: ${this.results.length} fire stocks scanned, ${changeCount} changed`);
    
    return {
      stocks: this.results,
      summary: {
        total_processed: tickers.length,
        qualifying_count: this.results.length,
        changed_count: changeCount
      }
    };
  }
}

// Make fetch available globally for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

module.exports = StockScanner;