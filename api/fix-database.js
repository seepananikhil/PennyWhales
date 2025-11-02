const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

async function fixDatabase() {
  console.log('🔧 Fixing database structure...');
  
  // Initialize database
  const dbPath = path.join(__dirname, 'database.json');
  const adapter = new JSONFile(dbPath);
  const db = new Low(adapter, { tickers: [], scanResults: {}, processedStocks: {}, settings: {} });
  
  // Read current database
  await db.read();
  
  console.log('📊 Current database structure:');
  console.log('- tickers:', Array.isArray(db.data.tickers) ? db.data.tickers.length : 'missing');
  console.log('- scanResults:', typeof db.data.scanResults);
  console.log('- processedStocks:', typeof db.data.processedStocks);
  console.log('- settings:', typeof db.data.settings);
  
  // Fix processedStocks if missing or incomplete
  if (!db.data.processedStocks || typeof db.data.processedStocks !== 'object') {
    db.data.processedStocks = {
      stocks: [],
      last_updated: new Date().toISOString()
    };
    console.log('✅ Fixed processedStocks structure');
  } else if (!db.data.processedStocks.stocks) {
    db.data.processedStocks.stocks = [];
    db.data.processedStocks.last_updated = new Date().toISOString();
    console.log('✅ Added stocks array to processedStocks');
  }
  
  // Fix scanResults if missing
  if (!db.data.scanResults || typeof db.data.scanResults !== 'object') {
    db.data.scanResults = {};
    console.log('✅ Fixed scanResults structure');
  }
  
  // Fix settings if missing
  if (!db.data.settings || typeof db.data.settings !== 'object') {
    db.data.settings = {};
    console.log('✅ Fixed settings structure');
  }
  
  // Save the fixed database
  await db.write();
  
  console.log('📊 Final database structure:');
  console.log('- tickers:', Array.isArray(db.data.tickers) ? db.data.tickers.length : 'missing');
  console.log('- scanResults:', typeof db.data.scanResults);
  console.log('- processedStocks:', typeof db.data.processedStocks);
  console.log('- processedStocks.stocks:', Array.isArray(db.data.processedStocks.stocks) ? db.data.processedStocks.stocks.length : 'missing');
  console.log('- settings:', typeof db.data.settings);
  
  console.log('🎉 Database structure fixed successfully!');
}

fixDatabase().catch(console.error);