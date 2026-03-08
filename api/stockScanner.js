const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const dbService = require('./database');
const { getStockPriceData } = require('./priceUtils');
const { calculateFireLevel, calculateRecommendation } = require('./fireUtils');
const { getComprehensiveFinvizData } = require('./finvizScraper');
const { getCompanyDescription } = require('./llmAnalyzer');
const { shouldExcludeStock } = require('./exclusionUtils');

// HOLDING_THRESHOLD = 3.0; // 3% minimum holding
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

  // Get institutional holdings from Nasdaq using curl (node-fetch/axios blocked by Akamai)
  async getNasdaqHoldings(ticker) {
    try {
      const curlCmd = `curl -s "https://api.nasdaq.com/api/company/${ticker}/institutional-holdings" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"`;
      const output = execSync(curlCmd, { encoding: 'utf-8' });
      const data = JSON.parse(output);

      console.log(`✅ Nasdaq API returned data for ${ticker}`);
      return data;
    } catch (error) {
      console.log(`⚠️ Nasdaq API failed for ${ticker}: ${error.message.substring(0, 50)}`);
      return null;
    }
  }

  // Parse BlackRock and Vanguard holdings
  parseHoldings(data, marketCap) {
    if (!data?.data?.holdingsTransactions?.table?.rows) {
      console.log('⚠️ No holdings rows found:', JSON.stringify(data?.data?.holdingsTransactions?.table, null, 2));
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
        } else if (ownerName.includes('STATE STREET') || ownerName.includes('STATESTREET')) {
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
  async analyzeTicker(ticker, isMini = false) {
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

      // Get comprehensive ticker data from Finviz (all metrics including performance, valuation, profitability, etc.)
      const finvizData = await getComprehensiveFinvizData(ticker);

      // Extract data with fallbacks
      const performance = finvizData?.performance || { day: null, week: null, month: null, year: null };
      let employeeCount = finvizData?.company?.employees || null;
      const ipoDate = finvizData?.company?.ipoDate || null;
      const sector = finvizData?.company?.sector || null;
      const industry = finvizData?.company?.industry || null;
      const companyName = finvizData?.company?.name || null;
      const marketCap = finvizData?.valuation?.marketCap || null;
      const instOwn = finvizData?.ownership?.instOwn || null;
      const instTrans = finvizData?.ownership?.instTrans || null;
      const sma200 = finvizData?.technical?.sma200 || null;
      const avgVolume = finvizData?.trading?.avgVolume || null;

      // Reject stocks with market cap under 200M for full scans
      if (!isMini && marketCap !== null && marketCap < 200) {
        console.log(`🚫 ${ticker}: Market cap too low ($${marketCap}M < $200M) - skipping`);
        return { success: false, reason: 'market_cap_too_low', marketCap };
      }

      // Parse holdings and filter by market cap (do this early so we have holdings data for rejection responses)
      const holdings = this.parseHoldings(holdingsData, marketCap);
      if (!holdings) {
        return { success: false, reason: 'market_cap_too_low', marketCap };
      }

      const { blackrockMarketValue, vanguardMarketValue, statestreetMarketValue, blackrockPct, vanguardPct, statestreetPct } = holdings;

      // Check if stock should be excluded (therapeutics, lending, etc.) - skip for mini scans
      const tempStock = { industry, company_name: companyName, description: null };
      if (!isMini && shouldExcludeStock(tempStock)) {
        return {
          success: false,
          reason: 'excluded',
          data: {
            ticker,
            price: Math.round(priceData.price * 100) / 100,
            previous_close: Math.round(priceData.previousClose * 100) / 100,
            blackrock_pct: blackrockPct,
            vanguard_pct: vanguardPct,
            statestreet_pct: statestreetPct,
            blackrock_market_value: blackrockMarketValue,
            vanguard_market_value: vanguardMarketValue,
            statestreet_market_value: statestreetMarketValue,
            market_cap: marketCap,
            avg_volume: avgVolume,
            employee_count: employeeCount,
            ipo_date: ipoDate,
            sector: sector,
            industry: industry,
            company_name: companyName,
            inst_own: instOwn,
            inst_trans: instTrans,
            sma200: sma200,
            performance: performance,
            fire_level: -1
          }
        };
      }

      // Get company description only for stocks with fire level > 0
      let description = null;
      const existingStock = await dbService.getStockByTicker(ticker);

      // Calculate fire level to determine if we should fetch description
      const fireLevel = calculateFireLevel({
        blackrock_pct: blackrockPct,
        vanguard_pct: vanguardPct,
        blackrock_market_value: blackrockMarketValue,
        vanguard_market_value: vanguardMarketValue
      });

      if (fireLevel > 0) {
        if (!existingStock || !existingStock.description) {
          // Only fetch description if it's not already stored and stock has fire
          description = await getCompanyDescription(ticker, sector, industry, companyName);
          if (description) {
            console.log(`📝 Fetched description for ${ticker} (fire level ${fireLevel})`);
          }
        } else {
          description = existingStock.description;
        }
      }

      // Re-check exclusion with description now available (skip for mini scans)
      const stockWithDesc = { industry, company_name: companyName, description };
      if (!isMini && shouldExcludeStock(stockWithDesc)) {
        return {
          success: false,
          reason: 'excluded',
          data: {
            ticker,
            price: Math.round(priceData.price * 100) / 100,
            previous_close: Math.round(priceData.previousClose * 100) / 100,
            blackrock_pct: blackrockPct,
            vanguard_pct: vanguardPct,
            statestreet_pct: statestreetPct,
            blackrock_market_value: blackrockMarketValue,
            vanguard_market_value: vanguardMarketValue,
            statestreet_market_value: statestreetMarketValue,
            market_cap: marketCap,
            avg_volume: avgVolume,
            employee_count: employeeCount,
            ipo_date: ipoDate,
            sector: sector,
            industry: industry,
            company_name: companyName,
            description: description,
            inst_own: instOwn,
            inst_trans: instTrans,
            sma200: sma200,
            performance: performance,
            fire_level: -1
          }
        };
      }

      // Always return the stock data regardless of holding percentages
      // The fire level will be included in the data
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
          market_cap: marketCap, // Market cap in millions from Finviz
          avg_volume: avgVolume, // Average trading volume from Finviz
          employee_count: employeeCount, // Number of employees from Finviz
          ipo_date: ipoDate, // IPO date from Finviz
          sector: sector, // Sector from Finviz
          industry: industry, // Industry from Finviz
          company_name: companyName, // Company name from Finviz
          description: description, // Company description from Finviz
          inst_own: instOwn, // Institutional ownership % from Finviz
          inst_trans: instTrans, // Institutional transaction % from Finviz (positive = buying)
          sma200: sma200, // SMA200 percentage from Finviz (distance from 200-day moving average)
          performance: performance || { day: null, week: null, month: null, year: null },
          fire_level: fireLevel, // Include fire level in the data
          recommendation: calculateRecommendation({
            fire_level: fireLevel,
            price: priceData.price,
            market_cap: marketCap,
            inst_own: instOwn,
            inst_trans: instTrans,
            sma200: sma200,
            performance: performance || {}
          })
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
        // Full scan: only save stocks with fire_level > 0
        let qualifyingStocks = stocks.filter(s => s.fire_level > 0);

        // Only remove tickers with fire_level 0 (not -1 which indicates missing data issues)
        const nonQualifyingTickers = stocks.filter(s => s.fire_level === 0).map(s => s.ticker);

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

        // Remove only tickers with fire_level 0 (insufficient holdings, but data was fetchable)
        // Keep tickers with fire_level -1 or missing data (temporary issues)
        if (nonQualifyingTickers.length > 0) {
          for (const ticker of nonQualifyingTickers) {
            await dbService.removeTicker(ticker);
          }
          console.log(`🗑️ Removed ${nonQualifyingTickers.length} non-qualifying tickers (fire_level 0) from ticker list`);
        }

        console.log(`✅ Full scan saved: ${qualifyingStocks.length} qualifying stocks (filtered from ${stocks.length} scanned)`);
        return;
      }

      // Daily scan: merge with existing results and remove stocks that lost fire
      const currentResults = await dbService.getScanResults();

      if (!currentResults || !currentResults.stocks) {
        console.log('⚠️ No existing scan results found. Saving daily scan as new results.');
        let qualifyingStocks = stocks.filter(s => s.fire_level > 0);

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

      // Merge: Update scanned stocks, keep unscanned stocks
      let mergedStocks = currentResults.stocks
        .map(existingStock => {
          if (updatedStocksMap.has(existingStock.ticker)) {
            return updatedStocksMap.get(existingStock.ticker);
          }
          return existingStock;
        })
        .filter(stock => stock.fire_level > 0);

      // Add NEW stocks
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
        console.log(`✅ ${ticker} - $${stock.price.toFixed(2)} | BR:${stock.blackrock_pct.toFixed(1)}% VG:${stock.vanguard_pct.toFixed(1)}% | Fire:${stock.fire_level}🔥`);
      } else if (result.reason === 'excluded') {
        console.log(`⏭️  ${ticker} - Excluded (${result.industry || result.company_name})`);
      }
      // Silently skip failed stocks (most common: market cap too low)

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
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
        console.log(`✅ NEW ${ticker} - $${stock.price.toFixed(2)} | BR:${stock.blackrock_pct.toFixed(1)}% VG:${stock.vanguard_pct.toFixed(1)}% | Fire:${stock.fire_level}🔥`);
      } else if (result.reason === 'excluded') {
        console.log(`⏭️  NEW ${ticker} - Excluded (${result.industry || result.company_name})`);
      }
      // Silently skip failed stocks

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
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

// Make fetch available globally for Node.js (if still needed)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

module.exports = StockScanner;