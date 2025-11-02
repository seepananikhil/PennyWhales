#!/usr/bin/env python3
"""
Professional Stock Scanner with Priority Ranking System
BlackRock & Vanguard Holdings Analysis - Nasdaq API Only
"""

import yfinance as yf
import pandas as pd
import logging
import time
import requests
from typing import List, Dict, Optional, Tuple

# === CONFIGURATION ===
PRICE_THRESHOLD = 2.0
HOLD_THRESHOLD = 4.0  # 3% minimum holding (as whole number to match parsed percentages)
DELAY_BETWEEN_REQUESTS = 0.5
REQUIRE_BOTH_HOLDERS = False  # True = BOTH BR+VG, False = EITHER BR OR VG

# === LOGGING SETUP ===
logging.basicConfig(level=logging.WARNING)  # Reduce noise

# === TICKER CONFIGURATION ===
TICKER_STRING = ""  # Set to empty to use tickers.txt file
TICKER_FILE = "tickers.txt"

def load_tickers() -> List[str]:
    """Load tickers from string or file"""
    if TICKER_STRING.strip():
        return [t.strip().upper() for t in TICKER_STRING.split(",") if t.strip()]
    
    try:
        with open(TICKER_FILE, 'r') as f:
            content = f.read().strip()
            # Handle both comma-separated and line-separated formats
            if ',' in content:
                # Comma-separated format
                return [t.strip().upper() for t in content.split(",") if t.strip()]
            else:
                # Line-separated format
                return [line.strip().upper() for line in content.split('\n') if line.strip()]
    except FileNotFoundError:
        print(f"❌ {TICKER_FILE} not found and TICKER_STRING is empty")
        return []

def get_nasdaq_data(ticker: str) -> Optional[Dict]:
    """Fetch institutional holdings from Nasdaq API"""
    try:
        url = f"https://api.nasdaq.com/api/company/{ticker}/institutional-holdings"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
            
    except Exception:
        return None

def parse_nasdaq_holdings(data: Dict) -> Tuple[float, float]:
    """Parse BlackRock and Vanguard holdings from Nasdaq data"""
    if not data or 'data' not in data:
        return 0.0, 0.0
    
    blackrock_pct = 0.0
    vanguard_pct = 0.0
    
    try:
        # Check holdingsTransactions first
        if 'holdingsTransactions' in data['data'] and 'table' in data['data']['holdingsTransactions']:
            holdings = data['data']['holdingsTransactions']['table'].get('rows', [])
        else:
            return 0.0, 0.0
        
        # Get total shares outstanding to calculate percentages
        total_shares = 0
        if 'ownershipSummary' in data['data']:
            total_shares_str = data['data']['ownershipSummary'].get('ShareoutstandingTotal', {}).get('value', '0')
            # Extract number from string like "37" (already in millions)
            import re
            total_match = re.search(r'[\d,\.]+', total_shares_str.replace(',', ''))
            if total_match:
                total_shares = float(total_match.group()) * 1000000  # Convert to actual shares
        
        for holding in holdings:
            if 'ownerName' not in holding:
                continue
                
            owner_name = holding['ownerName'].upper()
            shares_held_str = holding.get('sharesHeld', '0')
            
            # Extract shares number from string like "1,663,558"
            shares_held_clean = shares_held_str.replace(',', '')
            try:
                shares_held = float(shares_held_clean)
            except:
                continue
            
            # Calculate percentage if we have total shares
            if total_shares > 0:
                pct_held = (shares_held / total_shares) * 100
            else:
                pct_held = 0.0
            
            if 'BLACKROCK' in owner_name or 'BLACK ROCK' in owner_name:
                blackrock_pct = max(blackrock_pct, pct_held)
            elif 'VANGUARD' in owner_name:
                vanguard_pct = max(vanguard_pct, pct_held)
    
    except Exception as e:
        print(f"🔍 DEBUG: Parsing error: {e}")
        pass
    
    return blackrock_pct, vanguard_pct

def parse_yahoo_holdings(df: pd.DataFrame) -> Tuple[float, float]:
    """Parse BlackRock and Vanguard holdings from Yahoo data"""
    if df is None or df.empty:
        return 0.0, 0.0
    
    blackrock_pct = 0.0
    vanguard_pct = 0.0
    
    try:
        # Look for holder names
        if 'Holder' in df.columns:
            holders = df['Holder'].astype(str).str.upper()
            
            # BlackRock
            br_mask = holders.str.contains('BLACKROCK|BLACK ROCK', na=False)
            if br_mask.any():
                br_rows = df[br_mask]
                if '% Out' in br_rows.columns:
                    pcts = br_rows['% Out'].astype(str).str.replace('%', '').str.replace(',', '')
                    for pct in pcts:
                        try:
                            blackrock_pct = max(blackrock_pct, float(pct))
                        except:
                            pass
            
            # Vanguard
            vg_mask = holders.str.contains('VANGUARD', na=False)
            if vg_mask.any():
                vg_rows = df[vg_mask]
                if '% Out' in vg_rows.columns:
                    pcts = vg_rows['% Out'].astype(str).str.replace('%', '').str.replace(',', '')
                    for pct in pcts:
                        try:
                            vanguard_pct = max(vanguard_pct, float(pct))
                        except:
                            pass
    
    except Exception:
        pass
    
    return blackrock_pct, vanguard_pct

def analyze_ticker(ticker: str, verbose: bool = True) -> Optional[Dict]:
    """Analyze a single ticker using Nasdaq data only"""
    try:
        # Get basic stock info
        stock = yf.Ticker(ticker)
        info = stock.info
        
        if 'currentPrice' not in info:
            if verbose:
                print(f"❌ {ticker}: No price data available")
            return None
            
        price = info['currentPrice']
        
        if price >= PRICE_THRESHOLD:
            if verbose:
                print(f"❌ {ticker}: Price ${price:.2f} above threshold ${PRICE_THRESHOLD}")
            return None
        
        # Get Nasdaq data only
        nasdaq_br, nasdaq_vg = 0.0, 0.0
        nasdaq_data_available = False
        
        nasdaq_data = get_nasdaq_data(ticker)
        if nasdaq_data:
            nasdaq_br, nasdaq_vg = parse_nasdaq_holdings(nasdaq_data)
            nasdaq_data_available = True
            if verbose:
                print(f"📊 {ticker}: Nasdaq data - BR:{nasdaq_br:.1f}% VG:{nasdaq_vg:.1f}%")
        else:
            if verbose:
                print(f"❌ {ticker}: No Nasdaq data available")
            return None
        
        # Use Nasdaq data
        final_br = nasdaq_br
        final_vg = nasdaq_vg
        
        # Check if meets criteria - must be at least 3% for either BR or VG
        meets_criteria = False
        if REQUIRE_BOTH_HOLDERS:
            meets_criteria = final_br >= HOLD_THRESHOLD and final_vg >= HOLD_THRESHOLD
        else:
            meets_criteria = final_br >= HOLD_THRESHOLD or final_vg >= HOLD_THRESHOLD
        
        if not meets_criteria:
            if verbose:
                print(f"❌ {ticker}: Holdings don't meet 3% criteria - BR:{final_br:.1f}% VG:{final_vg:.1f}%")
            return None
        
        # Data quality assessment (High since using single reliable source)
        quality = "🔥 High"
        
        return {
            'ticker': ticker,
            'price': price,
            'blackrock_pct': final_br,
            'vanguard_pct': final_vg,
            'blackrock_source': "Nasdaq",
            'vanguard_source': "Nasdaq",
            'data_quality': quality,
            'sources_count': 1,
            'discrepancy': False,
            'notes': ""
        }
        
    except Exception as e:
        if verbose:
            print(f"❌ Error analyzing {ticker}: {e}")
        return None

def calculate_ranking_score(stock: Dict) -> Tuple[int, float]:
    """Calculate ranking category and score for sorting - simplified to 3 tiers"""
    br_pct = stock['blackrock_pct']
    vg_pct = stock['vanguard_pct']
    price = stock['price']
    
    # Check if both holders exist (>0%)
    has_both = br_pct > 0 and vg_pct > 0
    has_br_4plus = br_pct >= 4.0
    has_vg_4plus = vg_pct >= 4.0
    has_br_3plus = br_pct >= 3.0
    has_vg_3plus = vg_pct >= 3.0
    
    # Simplified Ranking Categories (lower number = higher priority)
    if has_both and has_br_4plus and has_vg_4plus:
        category = 1  # HIGH: Both 4%+ holdings
        # Sort by highest combined holdings (negative for descending), then lowest price
        combined_holdings = br_pct + vg_pct
        score = (-combined_holdings, price)  # Negative for descending holdings, positive for ascending price
    elif (has_br_3plus and vg_pct > 0) or (has_vg_3plus and br_pct > 0):
        category = 2  # MEDIUM: At least one 3%+ and other exists
        score = price
    else:
        category = 3  # LOW: Below criteria or single holder
        score = price
    
    return category, score

def display_results(qualifying_stocks: List[Dict], total_processed: int):
    """Display simplified results with clean formatting"""
    if not qualifying_stocks:
        print("\n❌ No stocks found matching criteria")
        return
    
    # Add ranking scores and sort by priority
    for stock in qualifying_stocks:
        stock['rank_category'], stock['rank_score'] = calculate_ranking_score(stock)
    
    # Sort by category first, then by score (price) within category
    qualifying_stocks.sort(key=lambda x: (x['rank_category'], x['rank_score']))
    
    print(f"\n🎯 FOUND {len(qualifying_stocks)} QUALIFYING STOCKS")
    print("=" * 60)
    
    # Group by tier
    high_tier = [s for s in qualifying_stocks if s['rank_category'] == 1]
    medium_tier = [s for s in qualifying_stocks if s['rank_category'] == 2]
    low_tier = [s for s in qualifying_stocks if s['rank_category'] == 3]
    
    # Display each tier
    if high_tier:
        print(f"\n🔥 HIGH PRIORITY - Both BR+VG 4%+ ({len(high_tier)} stocks):")
        print("   Sorted by highest combined holdings, then lowest price")
        
        # Separate premium stocks (both 5%+ and under $1)
        premium_stocks = [s for s in high_tier if s['blackrock_pct'] >= 5.0 and s['vanguard_pct'] >= 5.0 and s['price'] < 1.0]
        
        for stock in high_tier:
            combined = stock['blackrock_pct'] + stock['vanguard_pct']
            
            # Add multiple fires for premium stocks
            if stock['blackrock_pct'] >= 5.0 and stock['vanguard_pct'] >= 5.0 and stock['price'] < 1.0:
                indicator = "🔥🔥🔥🔥🔥"  # 5 fires for both 5%+ under $1
            elif stock['blackrock_pct'] >= 5.0 and stock['vanguard_pct'] >= 5.0:
                indicator = "🔥🔥🔥"  # 3 fires for both 5%+
            else:
                indicator = "🔥"  # 1 fire for regular high priority
                
            print(f"  {stock['ticker']:6} ${stock['price']:5.2f} | BR:{stock['blackrock_pct']:4.1f}% + VG:{stock['vanguard_pct']:4.1f}% = {combined:5.1f}% {indicator}")
        
        # Show premium stock summary
        if premium_stocks:
            print(f"\n🌟 PREMIUM DEALS: {len(premium_stocks)} stocks with both BR+VG ≥5% under $1 🔥🔥🔥🔥🔥")
            premium_tickers = ",".join([s['ticker'] for s in premium_stocks])
            print(f"   {premium_tickers}")
    
    if medium_tier:
        print(f"\n📊 MEDIUM PRIORITY - One 3%+ ({len(medium_tier)} stocks):")
        for stock in medium_tier:
            print(f"  {stock['ticker']:6} ${stock['price']:5.2f} | BR:{stock['blackrock_pct']:4.1f}% VG:{stock['vanguard_pct']:4.1f}%")
    
    if low_tier:
        print(f"\n⚠️ LOW PRIORITY - Other ({len(low_tier)} stocks):")
        for stock in low_tier:
            print(f"  {stock['ticker']:6} ${stock['price']:5.2f} | BR:{stock['blackrock_pct']:4.1f}% VG:{stock['vanguard_pct']:4.1f}%")
    
    # Simplified ticker lists
    print(f"\n📋 TICKER LISTS:")
    print("-" * 30)
    
    if high_tier:
        high_tickers = ",".join([s['ticker'] for s in high_tier])
        print(f"� HIGH:   {high_tickers}")
    
    if medium_tier:
        medium_tickers = ",".join([s['ticker'] for s in medium_tier])
        print(f"� MEDIUM: {medium_tickers}")
    
    # Price-based lists
    under_1 = [s for s in qualifying_stocks if s['price'] < 1.0]
    if under_1:
        under_1_tickers = ",".join([s['ticker'] for s in under_1])
        print(f"� <$1.00: {under_1_tickers}")
    
    all_tickers = ",".join([s['ticker'] for s in qualifying_stocks])
    print(f"� ALL:    {all_tickers}")
    
    print("=" * 60)

def main():
    """Main execution with clean output and proper logging"""
    print("🎯 STOCK SCANNER - SIMPLIFIED")
    print("=" * 40)
    print(f"📊 Source: Nasdaq API")
    print(f"🔍 Minimum: 3% BR or VG holding")
    print(f"💰 Max Price: ${PRICE_THRESHOLD}")
    
    tickers = load_tickers()
    if not tickers:
        print("❌ No tickers to process")
        return
    
    print(f" Processing {len(tickers)} tickers...")
    print("-" * 40)
    
    results = []
    processed = 0
    
    for i, ticker in enumerate(tickers, 1):
        processed += 1
        result = analyze_ticker(ticker, verbose=False)
        
        if result:
            results.append(result)
            # Show qualifying stocks immediately
            br = result['blackrock_pct']
            vg = result['vanguard_pct']
            price = result['price']
            
            # Determine tier quickly
            if br >= 4.0 and vg >= 4.0:
                tier = "🔥"
            elif (br >= 3.0 and vg > 0) or (vg >= 3.0 and br > 0):
                tier = "📊"
            else:
                tier = "⚠️"
            
            print(f"✅ {ticker:6} ${price:5.2f} | BR:{br:4.1f}% VG:{vg:4.1f}% {tier}")
        
        # Progress updates every 20 tickers
        if i % 20 == 0:
            print(f"� Progress: {i:3d}/{len(tickers)} | Found: {len(results):2d} matches")
        
        time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Final summary
    print(f"\n📊 SCAN COMPLETE: {processed}/{len(tickers)} processed, {len(results)} qualified")
    display_results(results, len(tickers))

if __name__ == "__main__":
    main()