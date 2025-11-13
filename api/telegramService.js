const axios = require('axios');

// Telegram Bot credentials - set these as environment variables
// Get your bot token from @BotFather on Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

class TelegramService {
  constructor() {
    this.baseUrl = TELEGRAM_BOT_TOKEN 
      ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` 
      : null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('⚠️ Telegram bot token not configured. Alerts will not work.');
      console.warn('Set TELEGRAM_BOT_TOKEN environment variable.');
      console.warn('Get your token from @BotFather on Telegram.');
      return;
    }

    this.initialized = true;
    console.log('✅ Telegram service initialized');
  }

  async sendPriceAlert(chatId, ticker, currentPrice, targetPrice, condition) {
    this.init();

    if (!this.baseUrl) {
      console.error('❌ Telegram service not initialized. Cannot send alert.');
      return { success: false, error: 'Service not configured' };
    }

    try {
      const emoji = condition === 'above' ? '⬆️' : '⬇️';
      const direction = condition === 'above' ? 'risen above' : 'dropped below';
      const message = `
🔔 *PennyWhales Price Alert*

${emoji} *${ticker}* has ${direction} your target!

💵 Current Price: $${currentPrice.toFixed(2)}
🎯 Target Price: $${targetPrice.toFixed(2)}

[View on TradingView](https://www.tradingview.com/chart/?symbol=${ticker})
      `.trim();

      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      console.log(`✅ Telegram alert sent to ${chatId}: ${response.data.result.message_id}`);
      return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
      console.error(`❌ Failed to send Telegram alert:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.description || error.message };
    }
  }

  // Generic send message function
  async sendMessage(chatId, message, parseMode = 'Markdown') {
    this.init();

    if (!this.baseUrl) {
      console.error('❌ Telegram service not initialized. Cannot send message.');
      return { success: false, error: 'Service not configured' };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true
      });

      console.log(`✅ Telegram message sent to ${chatId}: ${response.data.result.message_id}`);
      return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
      console.error(`❌ Failed to send Telegram message:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.description || error.message };
    }
  }

  async sendTestMessage(chatId) {
    this.init();

    if (!this.baseUrl) {
      return { success: false, error: 'Telegram service not configured' };
    }

    try {
      const message = `
🎉 *Test Message from PennyWhales*

Your price alerts are now configured!
You'll receive notifications when your stocks hit target prices.

This bot will send you alerts here automatically.
      `.trim();

      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      });

      console.log(`✅ Test message sent: ${response.data.result.message_id}`);
      return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
      console.error(`❌ Failed to send test message:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.description || error.message };
    }
  }

  // Get updates to find user's chat ID
  async getUpdates() {
    this.init();

    if (!this.baseUrl) {
      return { success: false, error: 'Telegram service not configured' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getUpdates`);
      return { success: true, updates: response.data.result };
    } catch (error) {
      console.error(`❌ Failed to get updates:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.description || error.message };
    }
  }

  // Get bot info
  async getBotInfo() {
    this.init();

    if (!this.baseUrl) {
      return { success: false, error: 'Telegram service not configured' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return { success: true, bot: response.data.result };
    } catch (error) {
      console.error(`❌ Failed to get bot info:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.description || error.message };
    }
  }
}

// Export singleton instance
const telegramService = new TelegramService();
module.exports = telegramService;
