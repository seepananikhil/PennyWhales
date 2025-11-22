const fs = require('fs');
const path = require('path');
const dbService = require('./database');
const { getStockPriceData } = require('./priceUtils');
const { calculateFireLevel } = require('./fireUtils');
const { getFinvizPerformance } = require('./finvizScraper');

// HOLDING_THRESHOLD = 3.0; // 3% minimum holding
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

  // Get market cap and average volume from Nasdaq summary
  async getMarketCap(ticker) {
    try {
      const response = await fetch(
        `https://api.nasdaq.com/api/quote/${ticker}/summary?assetclass=stocks`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      if (!response.ok) return { marketCap: null, avgVolume: null };
      const data = await response.json();
      
      // Extract market cap from summary data
      const marketCapValue = data?.data?.summaryData?.MarketCap?.value;
      let marketCap = null;
      
      if (marketCapValue) {
        // Parse market cap - API returns raw dollar amounts as strings with commas
        // Remove commas, convert to millions and round to 1 decimal for storage
        const cleanValue = String(marketCapValue).replace(/,/g, '');
        const marketCapDollars = parseFloat(cleanValue);
        marketCap = Math.round(marketCapDollars / 100000) / 10; // Round to 1 decimal
      }
      
      // Extract average volume from summary data
      const avgVolumeValue = data?.data?.summaryData?.AverageVolume?.value;
      let avgVolume = null;
      
      if (avgVolumeValue) {
        // Parse average volume - remove commas and convert to number
        avgVolume = parseInt(String(avgVolumeValue).replace(/,/g, '')) || null;
      }
      
      return { marketCap, avgVolume };
    } catch (error) {
      console.error(`Error fetching market cap and volume for ${ticker}:`, error);
      return { marketCap: null, avgVolume: null };
    }
  }

  // Parse BlackRock and Vanguard holdings
  parseHoldings(data, marketCap) {
    if (!data?.data?.holdingsTransactions?.table?.rows) {
      return { 
        blackrockMarketValue: 0,
        vanguardMarketValue: 0,
        statestreetMarketValue: 0,
        blackrockPct: 0,
        vanguardPct: 0,
        statestreetPct: 0
      };
    }

    let blackrockMarketValue = 0;
    let vanguardMarketValue = 0;
    let statestreetMarketValue = 0;
    let maxBlackrockValue = 0;
    let maxVanguardValue = 0;
    let maxStatestreetValue = 0;

    try {
      const holdings = data.data.holdingsTransactions.table.rows;

      for (const holding of holdings) {
        if (!holding.ownerName) continue;

        const ownerName = holding.ownerName.toUpperCase();
        
        // Parse market value (remove $ and commas, convert to number)
        // Note: marketValue from API is in thousands of dollars
        // Convert to millions for easier filtering and display
        const marketValueStr = holding.marketValue?.replace(/[$,\s]/g, '') || '0';
        const marketValueThousands = parseFloat(marketValueStr) || 0;
        const marketValue = marketValueThousands / 1000; // Convert thousands to millions

        if (ownerName.includes('BLACKROCK') || ownerName.includes('BLACK ROCK')) {
          if (marketValue > maxBlackrockValue) {
            maxBlackrockValue = marketValue;
            blackrockMarketValue = marketValue;
          }
        } else if (ownerName.includes('VANGUARD')) {
          if (marketValue > maxVanguardValue) {
            maxVanguardValue = marketValue;
            vanguardMarketValue = marketValue;
          }
        } else if (ownerName.includes('STATE STREET')) {
          if (marketValue > maxStatestreetValue) {
            maxStatestreetValue = marketValue;
            statestreetMarketValue = marketValue;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing holdings:', error);
    }

    // Calculate percentages based on market cap and holding values
    // Round to 2 decimal places
    let blackrockPct = 0;
    let vanguardPct = 0;
    let statestreetPct = 0;
    
    if (marketCap && marketCap > 0) {
      blackrockPct = Math.round(((blackrockMarketValue / marketCap) * 100) * 100) / 100;
      vanguardPct = Math.round(((vanguardMarketValue / marketCap) * 100) * 100) / 100;
      statestreetPct = Math.round(((statestreetMarketValue / marketCap) * 100) * 100) / 100;
    }

    return { 
      blackrockMarketValue: blackrockMarketValue,
      vanguardMarketValue: vanguardMarketValue,
      statestreetMarketValue: statestreetMarketValue,
      blackrockPct: blackrockPct,
      vanguardPct: vanguardPct,
      statestreetPct: statestreetPct
    };
  }

  // Analyze a single ticker
  async analyzeTicker(ticker) {
    try {
      // Get stock price
      const priceData = await this.getStockPrice(ticker);
      if (!priceData) {
        return { success: false, reason: 'no_price_data' };
      }

      // Get holdings data
      const holdingsData = await this.getNasdaqHoldings(ticker);
      if (!holdingsData) {
        return { success: false, reason: 'no_holdings_data' };
      }

      // Get market cap and average volume
      const { marketCap, avgVolume } = await this.getMarketCap(ticker);

      // Parse holdings and filter by market cap
      const holdings = this.parseHoldings(holdingsData, marketCap);
      if (!holdings) {
        return { success: false, reason: 'market_cap_too_low', marketCap };
      }

      const { blackrockMarketValue, vanguardMarketValue, statestreetMarketValue, blackrockPct, vanguardPct, statestreetPct } = holdings;

      // Get performance data from Finviz
      const performance = await getFinvizPerformance(ticker);

      // Always return the stock data regardless of holding percentages
      // The fire level calculation will handle the rating (including 0 for no fire)
      return {
        success: true,
        data: {
          ticker,
          price: Math.round(priceData.price * 100) / 100, // Round to 2 decimals
          previous_close: Math.round(priceData.previousClose * 100) / 100, // Round to 2 decimals
          blackrock_pct: blackrockPct, // Calculated from market cap and holding value
          vanguard_pct: vanguardPct,   // Calculated from market cap and holding value
          statestreet_pct: statestreetPct, // Calculated from market cap and holding value
          blackrock_market_value: blackrockMarketValue, // Store as number (in millions)
          vanguard_market_value: vanguardMarketValue,     // Store as number (in millions)
          statestreet_market_value: statestreetMarketValue, // Store as number (in millions)
          market_cap: marketCap, // Market cap in millions
          avg_volume: avgVolume, // Average volume
          performance: performance || { week: null, month: null, year: null }
        }
      };
    } catch (error) {
      console.error(`Error analyzing ${ticker}:`, error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  // Save results - handles both full scan and daily scan
  async saveResults(stocks, totalProcessed, isDailyScan = false) {
    try {
      if (!isDailyScan) {
        // Full scan: only save stocks with fire_level > 0 (qualifying stocks)
        const qualifyingStocks = stocks.filter(s => s.fire_level > 0);
        const nonQualifyingTickers = stocks.filter(s => s.fire_level <= 0).map(s => s.ticker); // Remove fire_level -1, 0
        
        const results = {
          stocks: qualifyingStocks,
          summary: {
            total_processed: totalProcessed,
            qualifying_count: qualifyingStocks.length,
            under_dollar: qualifyingStocks.filter(s => s.price < 1.0).length,
            fire_level_3: qualifyingStocks.filter(s => s.fire_level === 3).length,
            fire_level_2: qualifyingStocks.filter(s => s.fire_level === 2).length,
            fire_level_1: qualifyingStocks.filter(s => s.fire_level === 1).length,
            total_fire_stocks: qualifyingStocks.length
          },
          timestamp: new Date().toISOString()
        };

        await dbService.saveScanResults(results);
        
        // Remove non-qualifying tickers from the tickers list (fire_level -1 or 0)
        if (nonQualifyingTickers.length > 0) {
          for (const ticker of nonQualifyingTickers) {
            await dbService.removeTicker(ticker);
          }
          console.log(`🗑️ Removed ${nonQualifyingTickers.length} non-qualifying tickers (fire_level <= 0) from ticker list`);
        }
        
        console.log(`✅ Full scan saved: ${qualifyingStocks.length} qualifying stocks (filtered from ${stocks.length} scanned)`);
        return;
      }

      // Daily scan: merge with existing results and remove stocks that lost fire
      const currentResults = await dbService.getScanResults();
      
      if (!currentResults || !currentResults.stocks) {
        console.log('⚠️ No existing scan results found. Saving daily scan as new results.');
        // Only save stocks with fire_level > 0
        const qualifyingStocks = stocks.filter(s => s.fire_level > 0);
        await dbService.saveScanResults({
          stocks: qualifyingStocks,
          summary: { total_processed: totalProcessed, qualifying_count: qualifyingStocks.length },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Create a map of updated fire stocks by ticker
      const updatedStocksMap = new Map();
      stocks.forEach(stock => {
        updatedStocksMap.set(stock.ticker, stock);
      });

      // Merge: Update scanned stocks, keep unscanned stocks, remove stocks that lost fire (fire_level <= 0)
      const mergedStocks = currentResults.stocks
        .map(existingStock => {
          if (updatedStocksMap.has(existingStock.ticker)) {
            return updatedStocksMap.get(existingStock.ticker); // Replace with updated data
          }
          return existingStock; // Keep unchanged (wasn't scanned today)
        })
        .filter(stock => stock.fire_level > 0); // Remove stocks with fire_level -1 or 0

      // Add NEW stocks that aren't in the existing results but have fire_level > 0
      stocks.forEach(newStock => {
        const existsInCurrent = currentResults.stocks.some(s => s.ticker === newStock.ticker);
        if (!existsInCurrent && newStock.fire_level > 0) {
          mergedStocks.push(newStock);
          console.log(`🆕 Added new qualifying stock: ${newStock.ticker} (Fire:${newStock.fire_level})`);
        }
      });

      // Identify tickers that lost fire and need to be removed (fire_level -1 or 0)
      const removedTickers = currentResults.stocks
        .filter(stock => updatedStocksMap.has(stock.ticker) && updatedStocksMap.get(stock.ticker).fire_level <= 0)
        .map(stock => stock.ticker);
      
      const removedCount = currentResults.stocks.length - mergedStocks.length;
      
      const results = {
        stocks: mergedStocks,
        summary: {
          ...currentResults.summary, // Keep original summary
          qualifying_count: mergedStocks.length
        },
        timestamp: new Date().toISOString()
      };

      await dbService.saveScanResults(results);
      
      // Remove non-qualifying tickers from the tickers list
      if (removedTickers.length > 0) {
        for (const ticker of removedTickers) {
          await dbService.removeTicker(ticker);
        }
        console.log(`🗑️ Removed ${removedTickers.length} non-qualifying tickers from ticker list: ${removedTickers.join(', ')}`);
      }
      
      console.log(`✅ Daily scan merged: Updated ${stocks.length} fire stocks, removed ${removedCount} non-qualifying, total ${mergedStocks.length} stocks`);
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
      if (result.success) {
        const stock = result.data;
        // Calculate fire level for consistency with daily scan
        stock.fire_level = calculateFireLevel(stock);
        
        this.results.push(stock);
        const volStr = stock.avg_volume ? ` | Vol:${(stock.avg_volume / 1000000).toFixed(1)}M` : '';
        console.log(`✅ ${ticker} - $${stock.price.toFixed(2)} | BR:${stock.blackrock_pct.toFixed(1)}% VG:${stock.vanguard_pct.toFixed(1)}%${volStr} | Fire:${stock.fire_level}🔥`);
      }
      // Silently skip failed stocks (most common: market cap too low)

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
      if (result.success) {
        const stock = result.data;
        // Calculate fire level for the new ticker
        stock.fire_level = calculateFireLevel(stock);
        
        this.results.push(stock);
        const volStr = stock.avg_volume ? ` | Vol:${(stock.avg_volume / 1000000).toFixed(1)}M` : '';
        console.log(`✅ NEW ${ticker} - $${stock.price.toFixed(2)} | BR:${stock.blackrock_pct.toFixed(1)}% VG:${stock.vanguard_pct.toFixed(1)}%${volStr} | Fire:${stock.fire_level}🔥`);
      }
      // Silently skip failed stocks

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Save results using daily scan logic (merge with existing results)
    await this.saveResults(this.results, newTickers.length, true);
    
    console.log(`🆕 New ticker scan complete: ${this.results.length} stocks scanned`);
    
    return {
      stocks: this.results, // Return all scanned stocks (including non-qualifying for reporting)
      summary: {
        total_processed: newTickers.length,
        qualifying_count: this.results.filter(s => s.fire_level > 0).length,
        rejected_count: this.results.filter(s => s.fire_level === 0).length,
        new_tickers: this.results.filter(s => s.fire_level > 0).length
      }
    };
  }
}

// Make fetch available globally for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

module.exports = StockScanner;