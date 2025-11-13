require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const StockScanner = require("./stockScanner");
const dbService = require("./database");
const { getStockPriceData } = require("./priceUtils");
const { scrapeFinvizScreener } = require("./finvizScraper");
const alertChecker = require("./alertChecker");
const telegramService = require("./telegramService");

// Make fetch available for Node.js if not available
if (typeof fetch === "undefined") {
  global.fetch = require("node-fetch");
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
  last_scan: null,
};

let currentScanner = null;

// Auto-populate watchlist with hot picks (fire 3-5, price <= $1.20)
async function autoPopulateHotPicks() {
  try {
    console.log("🔥 Auto-populating Hot Picks watchlist...");

    const scanResults = await dbService.getScanResults();
    if (!scanResults || !scanResults.stocks) {
      console.log("⚠️ No scan results found for auto-population");
      return;
    }

    // Filter for fire stocks (3-5) with price <= $1.20
    const hotPicks = scanResults.stocks.filter(
      (stock) =>
        stock.fire_level >= 3 && stock.fire_level <= 5 && stock.price <= 1.2
    );

    if (hotPicks.length === 0) {
      console.log(
        "📊 No stocks match hot picks criteria (fire 3-5, price <= $1.20)"
      );
      return;
    }

    const hotPickTickers = hotPicks.map((s) => s.ticker);
    console.log(
      `🎯 Found ${hotPickTickers.length} hot picks: ${hotPickTickers.join(
        ", "
      )}`
    );

    // Check for stocks under $0.70 and send notification
    const stocksUnder070 = hotPicks.filter((stock) => stock.price < 0.7);
    if (stocksUnder070.length > 0) {
      console.log(
        `🔥 Found ${stocksUnder070.length} hot picks under $0.70!`
      );

      // Get settings to check if Telegram is enabled
      const settings = await dbService.getSettings();
      if (settings.telegramChatId) {
        const stockList = stocksUnder070
          .map(
            (stock) =>
              `• ${stock.ticker}: $${stock.price.toFixed(
                2
              )} (Fire Level ${stock.fire_level})`
          )
          .join("\n");

        const message = `🔥 HOT PICKS UNDER $0.70 DETECTED! 🔥\n\n${stockList}\n\nTotal: ${stocksUnder070.length} stocks found`;

        try {
          await telegramService.sendMessage(settings.telegramChatId, message);
          console.log("✅ Telegram notification sent for stocks under $0.70");
        } catch (error) {
          console.error(
            "❌ Failed to send Telegram notification:",
            error.message
          );
        }
      } else {
        console.log(
          "⚠️ Telegram chat ID not configured in settings"
        );
      }
    }

    // Check if "Hot Picks" watchlist exists
    const watchlists = await dbService.getWatchlists();
    let hotPicksWatchlist = watchlists.find((w) => w.name === "Hot Picks");

    if (!hotPicksWatchlist) {
      // Create new Hot Picks watchlist
      hotPicksWatchlist = await dbService.createWatchlist(
        "Hot Picks",
        hotPickTickers
      );
      console.log(
        `✅ Created Hot Picks watchlist with ${hotPickTickers.length} stocks`
      );
    } else {
      // Update existing Hot Picks watchlist
      await dbService.updateWatchlist(hotPicksWatchlist.id, {
        stocks: hotPickTickers,
      });
      console.log(
        `✅ Updated Hot Picks watchlist with ${hotPickTickers.length} stocks`
      );
    }

    return { success: true, count: hotPickTickers.length };
  } catch (error) {
    console.error("❌ Error auto-populating Hot Picks:", error);
    return { success: false, error: error.message };
  }
}

// API Routes

// Start scan
app.post("/api/scan/start", async (req, res) => {
  if (scanState.scanning) {
    return res.json({ success: false, message: "Scan already in progress" });
  }

  try {
    scanState.scanning = true;
    scanState.error = null;
    scanState.progress = { current: 0, total: 0, percentage: 0 };

    res.json({ success: true, message: "Scan started successfully" });

    // Run scan asynchronously
    (async () => {
      try {
        // Step 1: Fetch Finviz data
        console.log("📊 Fetching top performers from Finviz...");
        const finvizStocks = await scrapeFinvizScreener();

        let tickersToScan = [];

        if (finvizStocks && finvizStocks.length > 0) {
          const finvizTickers = finvizStocks.map((s) =>
            s.ticker.toUpperCase().trim()
          );
          console.log(`✅ Fetched ${finvizTickers.length} tickers from Finviz`);

          // Get rejected tickers to filter them out
          const rejectedTickers = await dbService.getRejectedTickers();
          console.log(
            `🚫 Found ${rejectedTickers.length} rejected tickers to skip`
          );

          // Filter out rejected tickers
          tickersToScan = finvizTickers.filter(
            (ticker) => !rejectedTickers.includes(ticker)
          );
          console.log(
            `🎯 Will scan ${tickersToScan.length} tickers (${
              finvizTickers.length - tickersToScan.length
            } rejected tickers skipped)`
          );
        } else {
          console.log("⚠️ No data fetched from Finviz, using existing tickers");
          const allTickers = await dbService.getTickers();
          const rejectedTickers = await dbService.getRejectedTickers();
          tickersToScan = allTickers.filter(
            (ticker) => !rejectedTickers.includes(ticker)
          );
        }

        if (tickersToScan.length === 0) {
          console.log("⚠️ No tickers to scan");
          scanState.scanning = false;
          return;
        }

        // Step 2: Scan the tickers
        console.log(`� Starting scan for ${tickersToScan.length} tickers...`);

        const scanner = new StockScanner();
        const { calculateFireLevel } = require("./fireUtils");

        scanState.progress = {
          current: 0,
          total: tickersToScan.length,
          percentage: 0,
        };

        const qualifyingStocks = [];
        const rejectedTickersToAdd = [];

        for (let i = 0; i < tickersToScan.length; i++) {
          const ticker = tickersToScan[i];

          try {
            const result = await scanner.analyzeTicker(ticker);

            if (result) {
              result.fire_level = calculateFireLevel(result);

              if (result.fire_level > 0) {
                qualifyingStocks.push(result);
                console.log(`✅ ${ticker}: fire_level=${result.fire_level}`);
              } else {
                rejectedTickersToAdd.push(ticker);
                console.log(`🚫 ${ticker}: fire_level=0 (rejected)`);
              }
            }
          } catch (error) {
            console.error(`❌ Error scanning ${ticker}:`, error.message);
          }

          // Update progress
          scanState.progress = {
            current: i + 1,
            total: tickersToScan.length,
            percentage: Math.round(((i + 1) / tickersToScan.length) * 100),
          };
        }

        // Step 3: Add rejected tickers to rejected collection
        if (rejectedTickersToAdd.length > 0) {
          await dbService.addRejectedTickers(rejectedTickersToAdd);
          console.log(
            `🚫 Added ${rejectedTickersToAdd.length} tickers to rejected list`
          );
        }

        // Step 4: Add qualifying tickers to tickers list
        if (qualifyingStocks.length > 0) {
          const qualifyingTickers = qualifyingStocks.map((s) => s.ticker);
          await dbService.addTickers(qualifyingTickers);
          console.log(
            `✅ Added ${qualifyingTickers.length} qualifying tickers`
          );
        }

        // Step 5: Save scan results
        const scanResults = {
          stocks: qualifyingStocks,
          summary: {
            total_processed: tickersToScan.length,
            qualifying_count: qualifyingStocks.length,
            rejected_count: rejectedTickersToAdd.length,
            fire_level_3: qualifyingStocks.filter((s) => s.fire_level === 3)
              .length,
            fire_level_2: qualifyingStocks.filter((s) => s.fire_level === 2)
              .length,
            fire_level_1: qualifyingStocks.filter((s) => s.fire_level === 1)
              .length,
            total_fire_stocks: qualifyingStocks.length,
          },
        };

        await dbService.saveScanResults(scanResults);

        // Auto-populate Hot Picks watchlist after scan completes
        await autoPopulateHotPicks();

        scanState.scanning = false;
        scanState.last_scan = new Date().toISOString();

        console.log("✅ Scan completed successfully");
        console.log(
          `📊 Results: ${qualifyingStocks.length} qualifying, ${rejectedTickersToAdd.length} rejected`
        );
      } catch (error) {
        scanState.scanning = false;
        scanState.error = error.message;
        console.error("❌ Scan failed:", error);
      }
    })();
  } catch (error) {
    scanState.scanning = false;
    scanState.error = error.message;
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get scan status
app.get("/api/scan/status", (req, res) => {
  res.json(scanState);
});

// Get latest results
app.get("/api/scan/results", async (req, res) => {
  try {
    const results = await dbService.getScanResults();
    
    // Filter stocks to only include those with price below $2
    if (results && results.stocks) {
      results.stocks = results.stocks.filter(stock => stock.price && stock.price < 2.0);
      
      // Update summary counts
      if (results.summary) {
        results.summary.qualifying_count = results.stocks.length;
        results.summary.fire_level_5 = results.stocks.filter((s) => s.fire_level === 5).length;
        results.summary.fire_level_4 = results.stocks.filter((s) => s.fire_level === 4).length;
        results.summary.fire_level_3 = results.stocks.filter((s) => s.fire_level === 3).length;
        results.summary.fire_level_2 = results.stocks.filter((s) => s.fire_level === 2).length;
        results.summary.fire_level_1 = results.stocks.filter((s) => s.fire_level === 1).length;
        results.summary.total_fire_stocks = results.stocks.length;
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error("Error getting scan results:", error);
    res.status(500).json({ error: "Failed to get scan results" });
  }
});

// Clear scan results
app.post("/api/scan/clear", async (req, res) => {
  try {
    await dbService.clearScanResults();
    res.json({ success: true, message: "Scan results cleared successfully" });
  } catch (error) {
    console.error("Error clearing scan results:", error);
    res.status(500).json({ error: "Failed to clear scan results" });
  }
});

// Scan single stock
app.post("/api/scan", async (req, res) => {
  try {
    const { ticker, tickers } = req.body;

    // Support both single ticker and multiple tickers
    let tickersToScan = [];

    if (ticker && typeof ticker === "string") {
      tickersToScan = [ticker];
    } else if (tickers && Array.isArray(tickers)) {
      tickersToScan = tickers;
    } else {
      return res
        .status(400)
        .json({ error: "Ticker or tickers array is required" });
    }

    console.log(
      `🔍 Scanning ${tickersToScan.length} stock(s): ${tickersToScan.join(
        ", "
      )}`
    );

    const scanner = new StockScanner();
    const { calculateFireLevel } = require("./fireUtils");

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
            error: "Could not fetch data for this ticker",
          });
        }
      } catch (error) {
        errors.push({
          ticker: tick.toUpperCase().trim(),
          error: error.message || "Failed to scan stock",
        });
      }
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Could not fetch data for any of the tickers",
        errors,
      });
    }

    res.json({
      success: true,
      stocks: results,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error scanning stock(s):", error);
    res.status(500).json({ error: "Failed to scan stock(s)" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Live price proxy endpoint
app.get("/api/price/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;

    const priceData = await getStockPriceData(ticker);

    if (priceData) {
      const response = {
        ticker: ticker.toUpperCase(),
        price: priceData.price,
        previousClose: priceData.previousClose,
        priceChange: priceData.priceChange,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } else {
      res.status(404).json({ error: "Price data not available" });
    }
  } catch (error) {
    console.error(`Error fetching price for ${req.params.ticker}:`, error);
    res.status(500).json({ error: "Failed to fetch price data" });
  }
});

app.get("/api/movers/all", async (req, res) => {
  try {
    const { limit = 10, minPrice, maxPrice } = req.query;
    const results = await dbService.getScanResults();

    if (!results || !results.stocks) {
      return res.json({ gainers: [], losers: [], count: 0 });
    }

    // Filter stocks with valid price data and only fire stocks (fire_level > 0)
    let stocks = results.stocks.filter(
      (stock) =>
        stock.price &&
        stock.previous_close &&
        stock.previous_close > 0 &&
        stock.fire_level &&
        stock.fire_level > 0
    );

    // Apply price filters if provided
    if (minPrice) {
      stocks = stocks.filter((stock) => stock.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      stocks = stocks.filter((stock) => stock.price <= parseFloat(maxPrice));
    }

    // Calculate price change percentage
    const stocksWithChange = stocks.map((stock) => {
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
        vanguardPct: stock.vanguard_pct || 0,
      };
    });

    // Get top gainers - sorted by highest percentage gain
    const gainers = stocksWithChange
      .filter((stock) => stock.priceChangePercent > 0)
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent) // Highest gains first
      .slice(0, parseInt(limit));

    // Get top losers - sorted by biggest percentage loss
    const losers = stocksWithChange
      .filter((stock) => stock.priceChangePercent < 0)
      .sort((a, b) => a.priceChangePercent - b.priceChangePercent) // Most negative first
      .slice(0, parseInt(limit));

    res.json({
      gainers,
      losers,
      gainersCount: gainers.length,
      losersCount: losers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting movers:", error);
    res.status(500).json({ error: "Failed to get movers" });
  }
});

// Ticker Management Endpoints
app.get("/api/tickers", async (req, res) => {
  try {
    const tickers = await dbService.getTickers();
    res.json({ tickers, count: tickers.length });
  } catch (error) {
    console.error("Error getting tickers:", error);
    res.status(500).json({ error: "Failed to get tickers" });
  }
});

// Rejected Tickers Endpoints
app.get("/api/rejected-tickers", async (req, res) => {
  try {
    const rejectedTickers = await dbService.getRejectedTickers();
    res.json({ rejectedTickers, count: rejectedTickers.length });
  } catch (error) {
    console.error("Error getting rejected tickers:", error);
    res.status(500).json({ error: "Failed to get rejected tickers" });
  }
});

app.delete("/api/rejected-tickers", async (req, res) => {
  try {
    await dbService.clearRejectedTickers();
    res.json({
      success: true,
      message: "Rejected tickers cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing rejected tickers:", error);
    res.status(500).json({ error: "Failed to clear rejected tickers" });
  }
});

app.put("/api/tickers", async (req, res) => {
  try {
    const { tickers } = req.body;

    if (!Array.isArray(tickers)) {
      return res.status(400).json({ error: "tickers must be an array" });
    }

    const updatedTickers = await dbService.updateTickers(tickers);

    // Auto-trigger full scan after ticker list update
    console.log("🎯 Ticker list updated, triggering automatic full scan...");

    // Start scan in background
    setTimeout(async () => {
      try {
        const scanner = new StockScanner();
        await scanner.scan();
        console.log("✅ Auto-triggered full scan completed");
      } catch (error) {
        console.error("❌ Auto-triggered full scan failed:", error);
      }
    }, 1000);

    res.json({
      success: true,
      tickers: updatedTickers,
      count: updatedTickers.length,
      message: "Tickers updated and full scan triggered automatically",
    });
  } catch (error) {
    console.error("Error updating tickers:", error);
    res.status(500).json({ error: "Failed to update tickers" });
  }
});

app.patch("/api/tickers", async (req, res) => {
  try {
    const { tickers } = req.body;

    if (!Array.isArray(tickers)) {
      return res.status(400).json({ error: "tickers must be an array" });
    }

    // Scan tickers FIRST before adding them to the list
    console.log(
      `🎯 Scanning ${tickers.length} new tickers to check if they qualify...`
    );

    const scanner = new StockScanner();
    const scanResult = await scanner.scanNewTickers(tickers);

    // Only add tickers that qualified (have fire_level > 0) to the tickers list
    const qualifiedTickers = scanResult.stocks
      .filter((s) => s.fire_level > 0)
      .map((s) => s.ticker);
    const added = await dbService.addTickers(qualifiedTickers);

    if (added.length > 0) {
      console.log(
        `✅ Added ${added.length} qualifying tickers to ticker list (${
          tickers.length - added.length
        } rejected)`
      );

      // Auto-populate Hot Picks watchlist after new tickers are added
      await autoPopulateHotPicks();
    } else {
      console.log(
        `⚠️ No qualifying tickers found (all ${tickers.length} tickers had fire_level === 0)`
      );
    }

    res.json({
      success: true,
      added: added.length,
      rejected: tickers.length - added.length,
      tickers: added,
      message:
        added.length > 0
          ? `${added.length} qualifying tickers added (${
              tickers.length - added.length
            } rejected for no fire)`
          : "No qualifying tickers found",
    });
  } catch (error) {
    console.error("Error adding tickers:", error);
    res.status(500).json({ error: "Failed to add tickers" });
  }
});

app.delete("/api/tickers/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const removed = await dbService.removeTicker(ticker);

    if (removed) {
      res.json({
        success: true,
        message: `Removed ticker: ${ticker.toUpperCase()}`,
      });
    } else {
      res.status(404).json({ error: "Ticker not found" });
    }
  } catch (error) {
    console.error("Error removing ticker:", error);
    res.status(500).json({ error: "Failed to remove ticker" });
  }
});

// Holdings Management Endpoints
app.get("/api/holdings", async (req, res) => {
  try {
    const holdings = await dbService.getHoldings();
    res.json({ holdings, count: holdings.length });
  } catch (error) {
    console.error("Error getting holdings:", error);
    res.status(500).json({ error: "Failed to get holdings" });
  }
});

app.post("/api/holdings/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const success = await dbService.addHolding(ticker);

    if (success) {
      res.json({ success: true, message: `Added ${ticker} to holdings` });
    } else {
      res.json({ success: false, message: `${ticker} already in holdings` });
    }
  } catch (error) {
    console.error("Error adding holding:", error);
    res.status(500).json({ error: "Failed to add holding" });
  }
});

app.delete("/api/holdings/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const success = await dbService.removeHolding(ticker);

    if (success) {
      res.json({ success: true, message: `Removed ${ticker} from holdings` });
    } else {
      res
        .status(404)
        .json({ success: false, message: `${ticker} not found in holdings` });
    }
  } catch (error) {
    console.error("Error removing holding:", error);
    res.status(500).json({ error: "Failed to remove holding" });
  }
});

app.get("/api/holdings/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const isHolding = await dbService.isHolding(ticker);
    res.json({ ticker, isHolding });
  } catch (error) {
    console.error("Error checking holding:", error);
    res.status(500).json({ error: "Failed to check holding status" });
  }
});

// Hot Picks auto-population endpoint
app.post("/api/watchlists/hot-picks/populate", async (req, res) => {
  try {
    const result = await autoPopulateHotPicks();
    res.json(result);
  } catch (error) {
    console.error("Error populating Hot Picks:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to populate Hot Picks" });
  }
});

// Watchlist Management Endpoints
app.get("/api/watchlists", async (req, res) => {
  try {
    const watchlists = await dbService.getWatchlists();
    const scanResults = await dbService.getScanResults();
    const stockData = new Map();

    // Create a map of stock data for quick lookup
    if (scanResults && scanResults.stocks) {
      scanResults.stocks.forEach((stock) => {
        stockData.set(stock.ticker, stock);
      });
    }

    // Add stock data to each watchlist
    const watchlistsWithStockData = watchlists.map((watchlist) => {
      const stocksWithFullData = watchlist.stocks.map((ticker) => {
        const stock = stockData.get(ticker);
        return stock || { ticker };
      });

      return {
        ...watchlist,
        stockData: stocksWithFullData,
      };
    });

    res.json({
      watchlists: watchlistsWithStockData,
      count: watchlistsWithStockData.length,
    });
  } catch (error) {
    console.error("Error getting watchlists:", error);
    res.status(500).json({ error: "Failed to get watchlists" });
  }
});

app.get("/api/watchlists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const watchlist = await dbService.getWatchlist(id);

    if (!watchlist) {
      return res.status(404).json({ error: "Watchlist not found" });
    }

    // Add stock data to the watchlist
    const scanResults = await dbService.getScanResults();
    const stockData = new Map();

    if (scanResults && scanResults.stocks) {
      scanResults.stocks.forEach((stock) => {
        stockData.set(stock.ticker, stock);
      });
    }

    const stocksWithFullData = watchlist.stocks.map((ticker) => {
      const stock = stockData.get(ticker);
      return stock || { ticker };
    });

    const watchlistWithStockData = {
      ...watchlist,
      stockData: stocksWithFullData,
    };

    res.json(watchlistWithStockData);
  } catch (error) {
    console.error("Error getting watchlist:", error);
    res.status(500).json({ error: "Failed to get watchlist" });
  }
});

app.post("/api/watchlists", async (req, res) => {
  try {
    const { name, stocks = [] } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Watchlist name is required" });
    }

    const watchlist = await dbService.createWatchlist(name.trim(), stocks);
    res.json({ success: true, watchlist });
  } catch (error) {
    console.error("Error creating watchlist:", error);
    res.status(500).json({ error: "Failed to create watchlist" });
  }
});

app.put("/api/watchlists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const watchlist = await dbService.updateWatchlist(id, updates);
    res.json({ success: true, watchlist });
  } catch (error) {
    console.error("Error updating watchlist:", error);
    if (error.message === "Watchlist not found") {
      res.status(404).json({ error: "Watchlist not found" });
    } else {
      res.status(500).json({ error: "Failed to update watchlist" });
    }
  }
});

app.delete("/api/watchlists/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteWatchlist(id);
    res.json({ success: true, message: `Deleted watchlist: ${deleted.name}` });
  } catch (error) {
    console.error("Error deleting watchlist:", error);
    if (error.message === "Watchlist not found") {
      res.status(404).json({ error: "Watchlist not found" });
    } else {
      res.status(500).json({ error: "Failed to delete watchlist" });
    }
  }
});

app.post("/api/watchlists/:id/stocks", async (req, res) => {
  try {
    const { id } = req.params;
    const { stocks } = req.body;

    if (!stocks || !Array.isArray(stocks)) {
      return res.status(400).json({ error: "Stocks array is required" });
    }

    const result = await dbService.addToWatchlist(id, stocks);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    if (error.message === "Watchlist not found") {
      res.status(404).json({ error: "Watchlist not found" });
    } else {
      res.status(500).json({ error: "Failed to add stocks to watchlist" });
    }
  }
});

app.delete("/api/watchlists/:id/stocks", async (req, res) => {
  try {
    const { id } = req.params;
    const { stocks } = req.body;

    if (!stocks || !Array.isArray(stocks)) {
      return res.status(400).json({ error: "Stocks array is required" });
    }

    const result = await dbService.removeFromWatchlist(id, stocks);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    if (error.message === "Watchlist not found") {
      res.status(404).json({ error: "Watchlist not found" });
    } else {
      res.status(500).json({ error: "Failed to remove stocks from watchlist" });
    }
  }
});

// Price Alerts Endpoints
app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await dbService.getPriceAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error("Error getting alerts:", error);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

app.get("/api/alerts/ticker/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const alerts = await dbService.getAlertsByTicker(ticker);
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error("Error getting alerts for ticker:", error);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

app.post("/api/alerts", async (req, res) => {
  try {
    const { ticker, targetPrice, condition } = req.body;

    if (!ticker || !targetPrice || !condition) {
      return res
        .status(400)
        .json({ error: "ticker, targetPrice, and condition are required" });
    }

    if (!["above", "below"].includes(condition)) {
      return res
        .status(400)
        .json({ error: 'condition must be "above" or "below"' });
    }

    const alert = await dbService.addPriceAlert({
      ticker,
      targetPrice,
      condition,
    });
    res.json({ success: true, alert });
  } catch (error) {
    console.error("Error creating alert:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

app.delete("/api/alerts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await dbService.removePriceAlert(id);

    if (removed) {
      res.json({ success: true, message: `Removed alert: ${id}` });
    } else {
      res.status(404).json({ error: "Alert not found" });
    }
  } catch (error) {
    console.error("Error removing alert:", error);
    res.status(500).json({ error: "Failed to remove alert" });
  }
});

app.put("/api/alerts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const alert = await dbService.updatePriceAlert(id, updates);
    res.json({ success: true, alert });
  } catch (error) {
    console.error("Error updating alert:", error);
    if (error.message === "Alert not found") {
      res.status(404).json({ error: "Alert not found" });
    } else {
      res.status(500).json({ error: "Failed to update alert" });
    }
  }
});

// Get recently triggered alerts (for UI notifications)
app.get("/api/alerts/triggered/recent", async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 5;
    const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const alerts = await dbService.getPriceAlerts();
    const recentlyTriggered = alerts.filter(
      (alert) =>
        alert.triggered && alert.triggeredAt && alert.triggeredAt > cutoff
    );

    res.json({ alerts: recentlyTriggered });
  } catch (error) {
    console.error("Error getting recent triggered alerts:", error);
    res.status(500).json({ error: "Failed to get triggered alerts" });
  }
});

// Settings Endpoints
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await dbService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error getting settings:", error);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const updates = req.body;
    const settings = await dbService.updateSettings(updates);
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Test Telegram notification
app.post("/api/test-telegram", async (req, res) => {
  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    const result = await telegramService.sendTestMessage(chatId);
    res.json(result);
  } catch (error) {
    console.error("Error sending test message:", error);
    res.status(500).json({ error: "Failed to send test message" });
  }
});

// Get Telegram bot info
app.get("/api/telegram/bot-info", async (req, res) => {
  try {
    const result = await telegramService.getBotInfo();
    res.json(result);
  } catch (error) {
    console.error("Error getting bot info:", error);
    res.status(500).json({ error: "Failed to get bot info" });
  }
});

// Get Telegram updates (to find chat ID)
app.get("/api/telegram/updates", async (req, res) => {
  try {
    const result = await telegramService.getUpdates();
    res.json(result);
  } catch (error) {
    console.error("Error getting updates:", error);
    res.status(500).json({ error: "Failed to get updates" });
  }
});

// Manually trigger alert check
app.post("/api/alerts/check", async (req, res) => {
  try {
    // Run check in background
    alertChecker.checkAlerts();
    res.json({ success: true, message: "Alert check triggered" });
  } catch (error) {
    console.error("Error triggering alert check:", error);
    res.status(500).json({ error: "Failed to trigger alert check" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stock Scanner API running on port ${PORT}`);
  console.log(`📊 Pure JavaScript implementation - no Python required!`);
  console.log(`🗄️ Using MongoDB with Prisma ORM for data storage`);
  console.log(`🎯 Ticker management available at /api/tickers`);
  console.log(`⭐ Holdings management available at /api/holdings`);
  console.log(`🔔 Price alerts available at /api/alerts`);

  // Setup hourly alert checking between 8 PM - 3 AM IST
  console.log(`🔔 Alert checks scheduled every hour from 8 PM to 3 AM IST`);
  
  // Check alerts at 8 PM, 9 PM, 10 PM, 11 PM, 12 AM, 1 AM, 2 AM, and 3 AM IST
  cron.schedule(
    "0 20,21,22,23,0,1,2,3 * * *",
    async () => {
      const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false });
      console.log(`⏰ Running hourly alert check at ${hour}:00 IST...`);
      await alertChecker.checkAlerts();
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );

  // Setup cron job for scans at 8:15 PM and 3:15 AM IST
  console.log(`⏰ Scheduled scans set for 8:15 PM IST and 3:15 AM IST (runs daily)`);
  
  // Evening scan at 8:15 PM IST
  cron.schedule(
    "15 20 * * *",
    async () => {
      console.log("⏰ Running scheduled scan at 8:15 PM IST...");

      if (scanState.scanning) {
        console.log("⚠️ Scan already in progress, skipping scheduled scan");
        return;
      }

      try {
        // Call the scan start endpoint logic
        const response = await fetch(
          `http://localhost:${PORT}/api/scan/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        const result = await response.json();
        console.log("✅ Scheduled scan triggered:", result.message);
      } catch (error) {
        console.error("❌ Error triggering scheduled scan:", error.message);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );

  // Night scan at 3:15 AM IST
  cron.schedule(
    "15 3 * * *",
    async () => {
      console.log("⏰ Running scheduled scan at 3:15 AM IST...");

      if (scanState.scanning) {
        console.log("⚠️ Scan already in progress, skipping scheduled scan");
        return;
      }

      try {
        // Call the scan start endpoint logic
        const response = await fetch(
          `http://localhost:${PORT}/api/scan/start`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        const result = await response.json();
        console.log("✅ Scheduled scan triggered:", result.message);
      } catch (error) {
        console.error("❌ Error triggering scheduled scan:", error.message);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );
});

module.exports = app;
