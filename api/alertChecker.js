const dbService = require('./database');
const { getStockPriceData } = require('./priceUtils');
const telegramService = require('./telegramService');

class AlertChecker {
  constructor() {
    this.checking = false;
    this.checkInterval = null;
  }

  async checkAlerts() {
    if (this.checking) {
      console.log('⏭️ Alert check already in progress, skipping...');
      return;
    }

    this.checking = true;
    console.log('🔍 Checking price alerts...');

    try {
      const activeAlerts = await dbService.getActivePriceAlerts();
      
      if (activeAlerts.length === 0) {
        console.log('📭 No active alerts to check');
        this.checking = false;
        return;
      }

      console.log(`📋 Checking ${activeAlerts.length} active alerts`);

      const settings = await dbService.getSettings();
      const telegramChatId = settings.telegramChatId;

      if (!telegramChatId) {
        console.warn('⚠️ No Telegram chat ID configured. Alerts will be checked but not sent.');
      }

      for (const alert of activeAlerts) {
        try {
          // Get current price
          const priceData = await getStockPriceData(alert.ticker);
          
          if (!priceData || !priceData.price) {
            console.log(`⚠️ Could not fetch price for ${alert.ticker}`);
            continue;
          }

          const currentPrice = priceData.price;
          let triggered = false;

          // Check if alert condition is met
          if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
            triggered = true;
          } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
            triggered = true;
          }

          if (triggered) {
            console.log(`🔔 ALERT TRIGGERED: ${alert.ticker} is ${alert.condition} $${alert.targetPrice} (current: $${currentPrice})`);

            // Send Telegram notification
            if (telegramChatId) {
              const result = await telegramService.sendPriceAlert(
                telegramChatId,
                alert.ticker,
                currentPrice,
                alert.targetPrice,
                alert.condition
              );

              if (result.success) {
                console.log(`✅ Telegram alert sent for ${alert.ticker}`);
              } else {
                console.error(`❌ Failed to send Telegram alert: ${result.error}`);
              }
            }

            // Mark alert as triggered
            await dbService.updatePriceAlert(alert.id, {
              triggered: true,
              triggeredAt: new Date().toISOString(),
              triggeredPrice: currentPrice,
              active: false // Deactivate after triggering
            });
          }

          // Rate limiting between checks
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Error checking alert for ${alert.ticker}:`, error.message);
        }
      }

      console.log('✅ Alert check complete');
    } catch (error) {
      console.error('❌ Error in alert checker:', error);
    } finally {
      this.checking = false;
    }
  }

  // Start periodic checking (every 60 minutes)
  startPeriodicCheck(intervalMinutes = 60) {
    if (this.checkInterval) {
      console.log('⚠️ Alert checker already running');
      return;
    }

    console.log(`🔔 Starting alert checker (every ${intervalMinutes} minutes)`);
    
    // Run immediately
    this.checkAlerts();

    // Then run periodically
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop periodic checking
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 Alert checker stopped');
    }
  }
}

// Export singleton instance
const alertChecker = new AlertChecker();
module.exports = alertChecker;
