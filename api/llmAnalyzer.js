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
 * Get company description using LLM
 */
async function getCompanyDescription(ticker, sector, industry, companyName = null) {
  if (!groq) return null;
  
  try {
    const nameInfo = companyName ? `Company: ${companyName}, ` : '';
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a financial research assistant. Provide concise company descriptions (2-3 sentences) about what the company does, their main products/services, and market focus.'
        },
        {
          role: 'user',
          content: `What does ${ticker} (${nameInfo}Sector: ${sector || 'Unknown'}, Industry: ${industry || 'Unknown'}) do? Keep it brief (2-3 sentences).`
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 150
    });
    
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Error fetching description for ${ticker}:`, error.message);
    return null;
  }
}

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
    return { prompt: generateBasicPrompt(stock) };
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

Provide RISK ANALYSIS in this exact format (no extra text before or after):

**Risk Score: X/10**

**Risk Level:** HIGH RISK

**Key Factors:**
- First key risk factor (one sentence)
- Second key risk factor (one sentence)  
- Third key risk factor (one sentence)

Guidelines:
- Finance/Lending = HIGH RISK (8-10)
- Therapeutics/Biotech = HIGH RISK (8-10)
- Technology/Established = MEDIUM RISK (4-7)
- Utilities/Staples = LOW RISK (1-3)
- Keep each factor concise and specific
- Focus on: profitability, debt, sector risks, volatility
- Consider: profitability, debt, institutional backing, volatility, sector risks
- Keep each factor brief and actionable`;

  return { prompt };
}

/**
 * Analyze stock using Groq (Llama 3.3 70B) with enhanced data
 */
async function analyzeWithGroq(stock, useEnhanced = true) {
  if (!groq) {
    throw new Error('GROQ_API_KEY not set in environment variables');
  }

  let prompt;
  
  if (useEnhanced) {
    const result = await generateEnhancedPrompt(stock);
    prompt = result.prompt;
  } else {
    prompt = generateBasicPrompt(stock);
  }
  
  const startTime = Date.now();
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a risk assessment specialist for penny stocks. Provide clear, structured risk analysis with specific factors. Finance/Lending and Therapeutics/Biotech are HIGH RISK (8-10). Use the exact format provided. Be concise and specific.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 200 // Reduced for focused risk assessment
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
  batchAnalyze,
  getCompanyDescription
};
