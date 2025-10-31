#!/usr/bin/env python3
"""
Clean Stock Scanner: Find stocks under $2 with BlackRock & Vanguard holdings
Uses Yahoo Finance only - simple and reliable
"""

import yfinance as yf
import pandas as pd
import logging
import time
from typing import List

# === Configuration ===
PRICE_THRESHOLD = 2.0
HOLD_THRESHOLD = 0.04  # 4% minimum holding (decimal format)
DELAY_BETWEEN_REQUESTS = 0.5  # Rate limiting
REQUIRE_BOTH_HOLDERS = True  # Require BOTH BlackRock AND Vanguard

# === Logging Setup ===
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s"
)

# === Ticker Configuration ===
TICKER_STRING = ""  # Add comma-separated tickers here, or use file
TICKER_FILE = "tickers.txt"

def load_tickers() -> List[str]:
    """Load tickers from string or file"""
    # Try string first
    if TICKER_STRING.strip():
        tickers = [t.strip().upper() for t in TICKER_STRING.split(",") if t.strip()]
        logging.info(f"📊 Loaded {len(tickers)} tickers from string")
        return tickers
    
    # Try file
    try:
        with open(TICKER_FILE, 'r') as f:
            content = f.read().strip()
        tickers = [t.strip().upper() for t in content.split(",") if t.strip()]
        logging.info(f"📊 Loaded {len(tickers)} tickers from {TICKER_FILE}")
        return tickers
    except FileNotFoundError:
        logging.error(f"❌ {TICKER_FILE} not found and TICKER_STRING is empty")
        return []

def parse_institutional_holdings(holders_df: pd.DataFrame) -> tuple:
    """Extract BlackRock and Vanguard holdings from Yahoo Finance data"""
    if holders_df is None or holders_df.empty:
        return 0, 0
    
    try:
        # Clean column names
        holders_df.columns = [c.strip() for c in holders_df.columns]
        
        # Find percentage column
        percent_col = None
        for col in ["pctHeld", "% Out", "% Held", "Percent"]:
            if col in holders_df.columns:
                percent_col = col
                break
        
        if not percent_col:
            return 0, 0
        
        blackrock_pct = 0
        vanguard_pct = 0
        
        for _, row in holders_df.iterrows():
            holder_name = str(row["Holder"]).lower()
            holding_pct = row[percent_col]
            
            # Convert string percentages to decimal
            if isinstance(holding_pct, str):
                holding_pct = float(holding_pct.replace('%', '').replace(',', '')) / 100
            
            # Find BlackRock holdings
            if "blackrock" in holder_name and holding_pct > blackrock_pct:
                blackrock_pct = holding_pct
            
            # Find Vanguard holdings
            elif "vanguard" in holder_name and holding_pct > vanguard_pct:
                vanguard_pct = holding_pct
        
        return blackrock_pct, vanguard_pct
        
    except Exception as e:
        logging.debug(f"Error parsing holdings: {e}")
        return 0, 0

def process_ticker(ticker: str, show_details: bool = False) -> dict:
    """Process a single ticker and check criteria"""
    try:
        stock = yf.Ticker(ticker)
        
        # Get price
        price = stock.info.get("currentPrice") or stock.fast_info.get("last_price")
        if not price or price > PRICE_THRESHOLD:
            if show_details and price:
                logging.info(f"{ticker}: ${price:.2f} - Above threshold")
            return None
        
        # Get institutional holdings
        institutional_holders = stock.get_institutional_holders()
        blackrock_pct, vanguard_pct = parse_institutional_holdings(institutional_holders)
        
        # Check criteria
        if REQUIRE_BOTH_HOLDERS:
            meets_criteria = blackrock_pct >= HOLD_THRESHOLD and vanguard_pct >= HOLD_THRESHOLD
        else:
            meets_criteria = blackrock_pct >= HOLD_THRESHOLD or vanguard_pct >= HOLD_THRESHOLD
        
        if not meets_criteria:
            if show_details:
                logging.info(f"{ticker}: ${price:.2f} - BR:{blackrock_pct*100:.1f}% VG:{vanguard_pct*100:.1f}% - Insufficient")
            return None
        
        if show_details:
            logging.info(f"✅ {ticker}: ${price:.2f} - BR:{blackrock_pct*100:.1f}% VG:{vanguard_pct*100:.1f}% - MATCH")
        
        return {
            'ticker': ticker,
            'price': price,
            'blackrock_pct': blackrock_pct,
            'vanguard_pct': vanguard_pct
        }
        
    except Exception as e:
        if show_details:
            logging.error(f"❌ {ticker}: Error - {str(e)}")
        return None

def main():
    """Main execution"""
    print("🎯 STOCK SCANNER: BlackRock & Vanguard Holdings")
    print("=" * 50)
    
    tickers = load_tickers()
    if not tickers:
        print("❌ No tickers to process")
        return
    
    threshold_text = "BOTH" if REQUIRE_BOTH_HOLDERS else "EITHER"
    print(f"🔍 Scanning {len(tickers)} tickers for {threshold_text} BlackRock & Vanguard ≥ {HOLD_THRESHOLD*100}%")
    print(f"💰 Price filter: Under ${PRICE_THRESHOLD}")
    print()
    
    results = []
    
    for i, ticker in enumerate(tickers):
        result = process_ticker(ticker, show_details=True)
        if result:
            results.append(result)
        
        # Progress update
        if (i + 1) % 20 == 0:
            print(f"📈 Progress: {i+1}/{len(tickers)} ({len(results)} matches)")
        
        time.sleep(DELAY_BETWEEN_REQUESTS)
    
    print("\n" + "=" * 50)
    print(f"🎯 RESULTS: {len(results)} matches found")
    print("=" * 50)
    
    if results:
        # Sort by price
        results.sort(key=lambda x: x['price'])
        
        # Categorize by price
        under_1 = [r for r in results if r['price'] < 1.0]
        between_1_2 = [r for r in results if 1.0 <= r['price'] < 2.0]
        
        if under_1:
            print(f"\n💎 UNDER $1.00 ({len(under_1)} stocks):")
            for r in under_1:
                print(f"   {r['ticker']}: ${r['price']:.2f} | BR:{r['blackrock_pct']*100:.1f}% VG:{r['vanguard_pct']*100:.1f}%")
            
            under_1_list = [r['ticker'] for r in under_1]
            print(f"\n📋 Under $1 list: {','.join(under_1_list)}")
        
        if between_1_2:
            print(f"\n🥈 $1.00-$2.00 ({len(between_1_2)} stocks):")
            for r in between_1_2:
                print(f"   {r['ticker']}: ${r['price']:.2f} | BR:{r['blackrock_pct']*100:.1f}% VG:{r['vanguard_pct']*100:.1f}%")
            
            between_1_2_list = [r['ticker'] for r in between_1_2]
            print(f"\n📋 $1-$2 list: {','.join(between_1_2_list)}")
        
        # All results
        all_tickers = [r['ticker'] for r in results]
        print(f"\n📋 ALL MATCHES: {','.join(all_tickers)}")
        
    else:
        print("❌ No matches found")
    
    print("=" * 50)

if __name__ == "__main__":
    main()