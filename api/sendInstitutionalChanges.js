require('dotenv').config();

const fs = require('fs');
const path = require('path');
const telegramService = require('./telegramService');
const dbService = require('./database');

async function sendInstitutionalChanges() {
  try {
    // Read scan results
    const scanResultsPath = path.join(__dirname, 'data', 'scanResults.json');
    const scanResultsData = JSON.parse(fs.readFileSync(scanResultsPath, 'utf8'));
    const scanResults = scanResultsData.stocks || [];

    // Read settings for chat ID
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const chatId = settings.telegramChatId;

    if (!chatId) {
      console.error('❌ No Telegram chat ID configured in settings.json');
      return;
    }

    // Filter stocks with significant institutional changes (>= 1% or <= -1%)
    const stocksWithChanges = scanResults.filter(stock => {
      const blackrockChange = stock.blackrock_change || 0;
      const vanguardChange = stock.vanguard_change || 0;
      const statestreetChange = stock.statestreet_change || 0;
      
      return Math.abs(blackrockChange) >= 1 || 
             Math.abs(vanguardChange) >= 1 || 
             Math.abs(statestreetChange) >= 1;
    });

    // Calculate total change for each stock (sum of all three)
    const stocksWithTotalChange = stocksWithChanges.map(stock => ({
      ...stock,
      totalChange: (stock.blackrock_change || 0) + 
                   (stock.vanguard_change || 0) + 
                   (stock.statestreet_change || 0)
    }));

    // Separate into additions (positive) and sells (negative)
    const additions = stocksWithTotalChange
      .filter(s => s.totalChange > 0)
      .sort((a, b) => b.totalChange - a.totalChange)
      .slice(0, 5);

    const sells = stocksWithTotalChange
      .filter(s => s.totalChange < 0)
      .sort((a, b) => a.totalChange - b.totalChange)
      .slice(0, 5);

    // Format message - Additions
    let message = '';
    
    if (additions.length > 0) {
      const additionsList = additions
        .map((stock) => {
          const changes = [];
          if (stock.blackrock_change && Math.abs(stock.blackrock_change) >= 1) {
            changes.push(`BlackRock: +${stock.blackrock_change.toFixed(2)}%`);
          }
          if (stock.vanguard_change && Math.abs(stock.vanguard_change) >= 1) {
            changes.push(`Vanguard: +${stock.vanguard_change.toFixed(2)}%`);
          }
          if (stock.statestreet_change && Math.abs(stock.statestreet_change) >= 1) {
            changes.push(`State Street: +${stock.statestreet_change.toFixed(2)}%`);
          }
          
          return (
            `• ${stock.ticker}: $${stock.price.toFixed(2)} ${'🔥'.repeat(stock.fire_level || 0)}\n` +
            `   ${changes.join(' | ')}\n` +
            `   📊 [View Chart](https://www.tradingview.com/chart/?symbol=${stock.ticker})`
          );
        })
        .join("\n\n");

      message += `📈 INSTITUTIONAL ADDITIONS (TOP 5) 📈\n\n${additionsList}`;
    }

    // Format message - Sells
    if (sells.length > 0) {
      const sellsList = sells
        .map((stock) => {
          const changes = [];
          if (stock.blackrock_change && Math.abs(stock.blackrock_change) >= 1) {
            changes.push(`BlackRock: ${stock.blackrock_change.toFixed(2)}%`);
          }
          if (stock.vanguard_change && Math.abs(stock.vanguard_change) >= 1) {
            changes.push(`Vanguard: ${stock.vanguard_change.toFixed(2)}%`);
          }
          if (stock.statestreet_change && Math.abs(stock.statestreet_change) >= 1) {
            changes.push(`State Street: ${stock.statestreet_change.toFixed(2)}%`);
          }
          
          return (
            `• ${stock.ticker}: $${stock.price.toFixed(2)} ${'🔥'.repeat(stock.fire_level || 0)}\n` +
            `   ${changes.join(' | ')}\n` +
            `   📊 [View Chart](https://www.tradingview.com/chart/?symbol=${stock.ticker})`
          );
        })
        .join("\n\n");

      if (message.length > 0) {
        message += `\n\n━━━━━━━━━━━━━━━\n\n`;
      }
      message += `📉 INSTITUTIONAL SELLS (TOP 5) 📉\n\n${sellsList}`;
    }

    if (message.length === 0) {
      message = `ℹ️ No significant institutional changes detected (minimum 1% threshold)`;
    }

    // Send via Telegram
    const result = await telegramService.sendMessage(chatId, message);

    if (result.success) {
      console.log('✅ Institutional changes report sent successfully!');
      console.log(`📊 Found ${additions.length} significant additions and ${sells.length} significant sells`);
      
      // Save to database for historical tracking
      if (additions.length > 0 || sells.length > 0) {
        await dbService.saveInstitutionalChanges(additions, sells);
      }
    } else {
      console.error('❌ Failed to send report:', result.error);
    }

  } catch (error) {
    console.error('❌ Error sending institutional changes:', error);
  }
}

// Run if called directly
if (require.main === module) {
  sendInstitutionalChanges();
}

module.exports = sendInstitutionalChanges;
