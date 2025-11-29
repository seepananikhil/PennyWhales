/**
 * LLM-based Stock Analysis
 * Uses Groq (Llama 3.3 70B) for AI-powered stock analysis
 */

require('dotenv').config();
const Groq = require('groq-sdk');
const { getComprehensiveFinvizData } = require('./finvizScraper');

// Initialize Groq client
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

/**
 * Generate enhanced analysis prompt with comprehensive Finviz data
 */
async function generateEnhancedPrompt(stock) {
  const combined = (stock.blackrock_pct || 0) + (stock.vanguard_pct || 0) + (stock.statestreet_pct || 0);
  
  // Fetch comprehensive data from Finviz
  console.log(`📊 Fetching comprehensive data for ${stock.ticker}...`);
  const finvizData = await getComprehensiveFinvizData(stock.ticker);
  
  if (!finvizData) {
    console.log('⚠️ Falling back to basic prompt');
    return generateBasicPrompt(stock);
  }
  
  let prompt = `Analyze this penny stock with ALL available data:

TICKER: ${stock.ticker}
SECTOR: ${finvizData.company?.sector || stock.sector || 'Unknown'}
INDUSTRY: ${finvizData.company?.industry || 'Unknown'}
FIRE LEVEL: ${stock.fire_level || 0}/5

VALUATION:
- Price: $${stock.price || 0} | Market Cap: $${finvizData.valuation?.marketCap || stock.market_cap}M
- P/E: ${finvizData.valuation?.pe || 'N/A'} | P/S: ${finvizData.valuation?.ps || 'N/A'} | P/B: ${finvizData.valuation?.pb || 'N/A'}
- EV/EBITDA: ${finvizData.valuation?.evEbitda || 'N/A'}

PROFITABILITY:
- Revenue: $${finvizData.profitability?.sales || 'N/A'}M | Income: $${finvizData.profitability?.income || 'N/A'}M
- Gross Margin: ${finvizData.profitability?.grossMargin || 'N/A'}% | Profit Margin: ${finvizData.profitability?.profitMargin || 'N/A'}%
- ROE: ${finvizData.profitability?.roe || 'N/A'}% | ROIC: ${finvizData.profitability?.roic || 'N/A'}%

GROWTH:
- EPS YoY: ${finvizData.eps?.yoyTTM || 'N/A'}% | Revenue YoY: ${finvizData.salesGrowth?.yoyTTM || 'N/A'}%
- EPS Q/Q: ${finvizData.eps?.qoq || 'N/A'}% | Revenue Q/Q: ${finvizData.salesGrowth?.qoq || 'N/A'}%

INSTITUTIONAL:
- Big 3: ${combined.toFixed(1)}% (VG: ${stock.vanguard_pct || 0}%, BR: ${stock.blackrock_pct || 0}%, SS: ${stock.statestreet_pct || 0}%)
- Total Inst: ${finvizData.ownership?.instOwn || 'N/A'}% | Inst Trans: ${finvizData.ownership?.instTrans || 'N/A'}%
- Insider Own: ${finvizData.ownership?.insiderOwn || 'N/A'}% | Insider Trans: ${finvizData.ownership?.insiderTrans || 'N/A'}%

SHORT INTEREST:
- Short Float: ${finvizData.ownership?.shortFloat || 'N/A'}% | Short Ratio: ${finvizData.ownership?.shortRatio || 'N/A'} days

FINANCIAL HEALTH:
- Current Ratio: ${finvizData.balanceSheet?.currentRatio || 'N/A'} | Debt/Eq: ${finvizData.balanceSheet?.debtToEquity || 'N/A'}
- Cash/Share: $${finvizData.balanceSheet?.cashPerShare || 'N/A'} | Book/Share: $${finvizData.balanceSheet?.bookPerShare || 'N/A'}

PERFORMANCE:
- Week: ${finvizData.performance?.week || 'N/A'}% | Month: ${finvizData.performance?.month || 'N/A'}%
- Quarter: ${finvizData.performance?.quarter || 'N/A'}% | YTD: ${finvizData.performance?.ytd || 'N/A'}%

TECHNICALS:
- RSI: ${finvizData.technical?.rsi || 'N/A'} | Beta: ${finvizData.technical?.beta || 'N/A'}
- SMA20: ${finvizData.technical?.sma20 || 'N/A'}% | SMA50: ${finvizData.technical?.sma50 || 'N/A'}% | SMA200: ${finvizData.technical?.sma200 || 'N/A'}%
- Volatility: ${finvizData.technical?.volatility?.week || 'N/A'}%/${finvizData.technical?.volatility?.month || 'N/A'}%

ANALYST:
- Recommendation: ${finvizData.analyst?.recommendation || 'N/A'} (1=Strong Buy, 5=Sell)
- Target: $${finvizData.analyst?.targetPrice || 'N/A'}

COMPANY:
- Employees: ${finvizData.company?.employees || stock.employee_count || 'N/A'}
- IPO: ${finvizData.company?.ipoDate || stock.ipo_date || 'N/A'}

Provide COMPREHENSIVE analysis:
1. Risk Score (1-10, higher=riskier)
2. Value Score (1-10, higher=better value)
3. Growth Potential (Low/Medium/High)
4. Key Insights (2-3 critical observations)
5. Investment Verdict (STRONG BUY/BUY/HOLD/SELL/STRONG SELL)

Use ALL data points. Be thorough but concise.`;

  return prompt;
}

/**
 * Generate basic prompt (fallback)
 */
function generateBasicPrompt(stock) {
  const combined = (stock.blackrock_pct || 0) + (stock.vanguard_pct || 0) + (stock.statestreet_pct || 0);
  
  return `Analyze this penny stock:

TICKER: ${stock.ticker}
SECTOR: ${stock.sector || 'Unknown'}
FIRE LEVEL: ${stock.fire_level || 0}/5

FUNDAMENTALS:
- Price: $${stock.price || 0} | Market Cap: $${stock.market_cap || 0}M
- Employees: ${stock.employee_count || 'N/A'} | IPO: ${stock.ipo_date || 'N/A'}

INSTITUTIONAL:
- VG: ${stock.vanguard_pct || 0}% | BR: ${stock.blackrock_pct || 0}% | SS: ${stock.statestreet_pct || 0}%
- Total: ${combined.toFixed(1)}%

PERFORMANCE:
- Week: ${stock.performance?.week || 'N/A'}% | Month: ${stock.performance?.month || 'N/A'}%

Provide:
1. Risk Score (1-10)
2. Value Score (1-10)
3. Growth Potential
4. Key Insight
5. Verdict (BUY/HOLD/SELL)`;
}

/**
 * Analyze stock using Groq (Llama 3.3 70B) with enhanced data
 */
async function analyzeWithGroq(stock, useEnhanced = true) {
  if (!groq) {
    throw new Error('GROQ_API_KEY not set in environment variables');
  }

  const prompt = useEnhanced ? await generateEnhancedPrompt(stock) : generateBasicPrompt(stock);
  
  const startTime = Date.now();
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are an expert stock analyst specializing in penny stocks, value investing, and institutional investment patterns. Analyze ALL provided data comprehensively - fundamentals, valuation, growth, technicals, and institutional backing. Provide detailed, data-driven insights.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 500 // Increased for comprehensive analysis
  });
  
  const responseTime = Date.now() - startTime;
  
  return {
    provider: 'Groq (Llama 3.1 70B)',
    analysis: completion.choices[0].message.content,
    responseTime: `${responseTime}ms`,
    tokensUsed: completion.usage
  };
}

/**
 * Analyze a single stock with Groq
 */
async function analyzeStock(stock) {
  return analyzeWithGroq(stock);
}

/**
 * Batch analyze multiple stocks
 */
async function batchAnalyze(stocks) {
  const results = [];
  
  for (const stock of stocks) {
    try {
      const result = await analyzeWithGroq(stock);
      results.push({
        ticker: stock.ticker,
        ...result
      });
      
      // Rate limiting - small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error analyzing ${stock.ticker}:`, error.message);
      results.push({
        ticker: stock.ticker,
        error: error.message
      });
    }
  }
  
  return results;
}

module.exports = {
  analyzeStock,
  analyzeWithGroq,
  batchAnalyze
};
