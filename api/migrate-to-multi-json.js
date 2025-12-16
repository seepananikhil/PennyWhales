const fs = require('fs');
const path = require('path');

// Migration script to convert from single database.json to multiple JSON files

const OLD_DB_FILE = path.join(__dirname, 'database.json');
const DATA_DIR = path.join(__dirname, 'data');

async function migrate() {
  console.log('🔄 Starting migration from single JSON to multi-file structure...\n');

  // Check if old database exists
  if (!fs.existsSync(OLD_DB_FILE)) {
    console.log('❌ No database.json file found. Nothing to migrate.');
    console.log('✅ You can start fresh with the new multi-file structure.');
    return;
  }

  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory');
  }

  // Read old database
  const oldData = JSON.parse(fs.readFileSync(OLD_DB_FILE, 'utf8'));
  console.log('📖 Read existing database.json');

  // Split into separate files
  const files = [
    {
      name: 'tickers.json',
      data: {
        tickers: oldData.tickers || [],
        rejectedTickers: oldData.rejectedTickers || []
      }
    },
    {
      name: 'scanResults.json',
      data: oldData.scanResults || {
        stocks: [],
        summary: {},
        timestamp: null
      }
    },
    {
      name: 'watchlists.json',
      data: oldData.watchlists || []
    },
    {
      name: 'holdings.json',
      data: oldData.holdings || {
        stocks: [],
        last_updated: null
      }
    },
    {
      name: 'priceAlerts.json',
      data: oldData.priceAlerts || []
    },
    {
      name: 'settings.json',
      data: oldData.settings || {
        created: new Date().toISOString(),
        version: '1.0.0',
        telegramChatId: null,
        telegramBotToken: null
      }
    }
  ];

  // Write new files
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file.name);
    fs.writeFileSync(filePath, JSON.stringify(file.data, null, 2));
    console.log(`✅ Created ${file.name}`);
  }

  // Backup old file
  const backupFile = path.join(__dirname, `database.json.backup.${Date.now()}`);
  fs.copyFileSync(OLD_DB_FILE, backupFile);
  console.log(`\n💾 Backed up old database to: ${path.basename(backupFile)}`);

  console.log('\n✨ Migration completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Tickers: ${oldData.tickers?.length || 0}`);
  console.log(`   - Rejected Tickers: ${oldData.rejectedTickers?.length || 0}`);
  console.log(`   - Scan Results: ${oldData.scanResults?.stocks?.length || 0} stocks`);
  console.log(`   - Watchlists: ${oldData.watchlists?.length || 0}`);
  console.log(`   - Holdings: ${oldData.holdings?.stocks?.length || 0}`);
  console.log(`   - Price Alerts: ${oldData.priceAlerts?.length || 0}`);
  console.log('\n💡 You can safely delete database.json after verifying the migration.');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
