const fs = require('fs');
const path = require('path');
const dbService = require('./database');

// Configuration
const HOLD_THRESHOLD = 3.0; // 3% minimum holding
const DELAY_BETWEEN_REQUESTS = 500; // ms
const REQUIRE_BOTH_HOLDERS = false;

class StockScanner {
  constructor() {
    this.results = [];
    this.processed = 0;
    this.total = 0;
    this.onProgress = null;
  }

    // Calculate fire level for a stock (same logic as database service)
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

  // Load processed stocks
  async loadProcessedStocks() {
    try {
      const processedStocks = await dbService.getProcessedStocks();
      return new Set(processedStocks || []);
    } catch (error) {
      console.error('Error loading processed stocks:', error);
    }
    return new Set();
  }

  // Save processed stocks
  async saveProcessedStocks(stocks) {
    try {
      await dbService.addProcessedStocks(Array.from(stocks));
    } catch (error) {
      console.error('Error saving processed stocks:', error);
    }
  }

  // Get stock price from Yahoo Finance API
  async getStockPrice(ticker) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      
      if (result?.meta?.regularMarketPrice) {
        return result.meta.regularMarketPrice;
      }
      
      return null;
    } catch (error) {
      return null;
    }
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
      const price = await this.getStockPrice(ticker);
      if (!price) {
        return null;
      }

      // Get holdings data
      const holdingsData = await this.getNasdaqHoldings(ticker);
      if (!holdingsData) {
        return null;
      }

      const { blackrock, vanguard } = this.parseHoldings(holdingsData);

      // Check if meets criteria - based purely on shareholding, not price
      const meetsCriteria = REQUIRE_BOTH_HOLDERS 
        ? (blackrock >= HOLD_THRESHOLD && vanguard >= HOLD_THRESHOLD)
        : (blackrock >= HOLD_THRESHOLD || vanguard >= HOLD_THRESHOLD);

      if (!meetsCriteria) {
        return null;
      }

      return {
        ticker,
        price,
        blackrock_pct: blackrock,
        vanguard_pct: vanguard,
        blackrock_source: 'Nasdaq',
        vanguard_source: 'Nasdaq',
        data_quality: '🔥 High',
        sources_count: 1,
        discrepancy: false,
        notes: ''
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

  // Save results to JSON
  async saveResults(stocks, totalProcessed, newStocksOnly = false) {
    try {
      // Add rankings
      stocks.forEach(stock => {
        const ranking = this.calculateRanking(stock);
        stock.rank_category = ranking.category;
        stock.rank_score = ranking.score;
      });

      // Sort stocks
      stocks.sort((a, b) => {
        if (a.rank_category !== b.rank_category) {
          return a.rank_category - b.rank_category;
        }
        return a.rank_score - b.rank_score;
      });

      // Calculate summary
      const highTier = stocks.filter(s => s.rank_category === 1);
      const mediumTier = stocks.filter(s => s.rank_category === 2);
      const lowTier = stocks.filter(s => s.rank_category === 3);
      const underDollar = stocks.filter(s => s.price < 1.0);
      const premium = highTier.filter(s => 
        s.blackrock_pct >= 5.0 && s.vanguard_pct >= 5.0 && s.price < 1.0
      );

      const results = {
        stocks,
        summary: {
          total_processed: totalProcessed,
          qualifying_count: stocks.length,
          high_tier: highTier.length,
          medium_tier: mediumTier.length,
          low_tier: lowTier.length,
          under_dollar: underDollar.length,
          premium_count: premium.length
        },
        timestamp: new Date().toISOString(),
        new_stocks_only: newStocksOnly
      };

      await dbService.saveScanResults(results);
      console.log('✅ Results saved to database');
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

    const processedStocks = await this.loadProcessedStocks();
    const newTickers = allTickers.filter(t => !processedStocks.has(t));
    const newStocksOnly = processedStocks.size > 0 && newTickers.length < allTickers.length;
    
    const tickersToScan = newStocksOnly ? newTickers : allTickers;
    
    if (tickersToScan.length === 0) {
      console.log('✅ No new stocks to scan! Loading previous results...');
      
      // Load previous results to show existing stocks
      const previousResults = await this.loadPreviousResults();
      if (previousResults && previousResults.stocks && previousResults.stocks.length > 0) {
        // Update timestamp and mark as new stocks only
        const updatedResults = {
          ...previousResults,
          timestamp: new Date().toISOString(),
          new_stocks_only: true
        };
        
        // Save the updated results
        await this.saveResults(previousResults.stocks, allTickers.length, true);
        
        console.log(`📊 Showing ${previousResults.stocks.length} previously found stocks`);
        return {
          stocks: previousResults.stocks,
          newStocksOnly: true,
          summary: previousResults.summary
        };
      } else {
        // No previous results either
        await this.saveResults([], allTickers.length, true);
        return { stocks: [], newStocksOnly: true };
      }
    }

    console.log(`📊 Scanning ${tickersToScan.length} ${newStocksOnly ? 'new' : 'total'} tickers...`);
    
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
        this.results.push(result);
        console.log(`✅ ${ticker} - $${result.price.toFixed(2)} | BR:${result.blackrock_pct.toFixed(1)}% VG:${result.vanguard_pct.toFixed(1)}%`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Update processed stocks
    const allProcessed = new Set([...processedStocks, ...tickersToScan]);
    await this.saveProcessedStocks(allProcessed);

    // Save results
    await this.saveResults(this.results, allTickers.length, newStocksOnly);

    console.log(`🎯 Scan complete: ${this.results.length} qualifying stocks found`);
    
    return {
      stocks: this.results,
      newStocksOnly,
      summary: {
        total_processed: allTickers.length,
        qualifying_count: this.results.length
      }
    };
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
        result.fire_level = this.calculateFireLevel(result);
        
        const previousStock = previousStockMap.get(ticker);
        
        // Add change tracking
        if (previousStock) {
          result.previous_fire_level = previousStock.fire_level;
          result.fire_level_changed = result.fire_level !== previousStock.fire_level;
          result.price_change = result.price - previousStock.price;
          result.is_new = false;
        } else {
          result.is_new = true;
          result.fire_level_changed = false;
        }

        this.results.push(result);
        
        // Log changes
        if (result.fire_level_changed) {
          const changeDirection = result.fire_level > result.previous_fire_level ? '📈' : '📉';
          console.log(`${changeDirection} ${ticker} fire level changed: ${result.previous_fire_level}🔥 → ${result.fire_level}🔥`);
        }
        if (result.price_change && Math.abs(result.price_change) > 0.01) {
          const priceDirection = result.price_change > 0 ? '📈' : '📉';
          console.log(`${priceDirection} ${ticker} price changed: $${(result.price - result.price_change).toFixed(2)} → $${result.price.toFixed(2)} (${result.price_change > 0 ? '+' : ''}${result.price_change.toFixed(2)})`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }

    // Save results
    await this.saveResults(this.results, tickers.length, false);

    const changeCount = this.results.filter(s => s.fire_level_changed).length;
    const newCount = this.results.filter(s => s.is_new).length;
    
    console.log(`🔥 Daily scan complete: ${this.results.length} fire stocks scanned, ${changeCount} changed, ${newCount} new`);
    
    return {
      stocks: this.results,
      newStocksOnly: false,
      summary: {
        total_processed: tickers.length,
        qualifying_count: this.results.length,
        changed_count: changeCount,
        new_count: newCount
      }
    };
  }
}

// Make fetch available globally for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

module.exports = StockScanner;