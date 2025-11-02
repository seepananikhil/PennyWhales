#!/usr/bin/env python3
"""
Enhanced Professional Stock Scanner with JSON Output & Tracking
BlackRock & Vanguard Holdings Analysis - Dashboard Integration
"""

import yfinance as yf
import pandas as pd
import logging
import time
import requests
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple

# === CONFIGURATION ===
PRICE_THRESHOLD = 2.0
HOLD_THRESHOLD = 4.0  # 3% minimum holding (as whole number to match parsed percentages)
DELAY_BETWEEN_REQUESTS = 0.5
REQUIRE_BOTH_HOLDERS = False  # True = BOTH BR+VG, False = EITHER BR OR VG

# === FILE PATHS ===
RESULTS_FILE = "scan_results.json"
PROCESSED_STOCKS_FILE = "processed_stocks.json"
TICKER_FILE = "tickers.txt"

# === LOGGING SETUP ===
logging.basicConfig(level=logging.WARNING)  # Reduce noise

def load_processed_stocks() -> set:
    """Load previously processed stocks"""
    try:
        if os.path.exists(PROCESSED_STOCKS_FILE):
            with open(PROCESSED_STOCKS_FILE, 'r') as f:
                data = json.load(f)
                return set(data.get('stocks', []))
    except Exception as e:
        print(f"Warning: Could not load processed stocks: {e}")
    return set()

def save_processed_stocks(stocks: set):
    """Save processed stocks to file"""
    try:
        data = {
            'stocks': list(stocks),
            'last_updated': datetime.now().isoformat()
        }
        with open(PROCESSED_STOCKS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save processed stocks: {e}")

def load_tickers() -> List[str]:
    """Load tickers from string or file"""
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
        print(f"❌ {TICKER_FILE} not found")
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
        nasdaq_data = get_nasdaq_data(ticker)
        if nasdaq_data:
            nasdaq_br, nasdaq_vg = parse_nasdaq_holdings(nasdaq_data)
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
        
        return {
            'ticker': ticker,
            'price': price,
            'blackrock_pct': final_br,
            'vanguard_pct': final_vg,
            'blackrock_source': "Nasdaq",
            'vanguard_source': "Nasdaq",
            'data_quality': "🔥 High",
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

def save_results_to_json(qualifying_stocks: List[Dict], total_processed: int, new_stocks_only: bool = False):
    """Save scan results to JSON file for dashboard"""
    try:
        # Add ranking scores
        for stock in qualifying_stocks:
            stock['rank_category'], stock['rank_score'] = calculate_ranking_score(stock)
        
        # Sort by category first, then by score within category
        qualifying_stocks.sort(key=lambda x: (x['rank_category'], x['rank_score']))
        
        # Calculate summary statistics
        high_tier = [s for s in qualifying_stocks if s['rank_category'] == 1]
        medium_tier = [s for s in qualifying_stocks if s['rank_category'] == 2]
        low_tier = [s for s in qualifying_stocks if s['rank_category'] == 3]
        under_dollar = [s for s in qualifying_stocks if s['price'] < 1.0]
        premium_stocks = [s for s in high_tier if s['blackrock_pct'] >= 5.0 and s['vanguard_pct'] >= 5.0 and s['price'] < 1.0]
        
        results = {
            'stocks': qualifying_stocks,
            'summary': {
                'total_processed': total_processed,
                'qualifying_count': len(qualifying_stocks),
                'high_tier': len(high_tier),
                'medium_tier': len(medium_tier),
                'low_tier': len(low_tier),
                'under_dollar': len(under_dollar),
                'premium_count': len(premium_stocks)
            },
            'timestamp': datetime.now().isoformat(),
            'new_stocks_only': new_stocks_only
        }
        
        with open(RESULTS_FILE, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"✅ Results saved to {RESULTS_FILE}")
        
    except Exception as e:
        print(f"❌ Error saving results: {e}")

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
        
        for stock in high_tier:
            combined = stock['blackrock_pct'] + stock['vanguard_pct']
            
            # Add multiple fires for premium stocks
            if stock['blackrock_pct'] >= 5.0 and stock['vanguard_pct'] >= 5.0 and stock['price'] < 1.0:
                indicator = "🔥🔥🔥🔥🔥"
            elif stock['blackrock_pct'] >= 5.0 and stock['vanguard_pct'] >= 5.0:
                indicator = "🔥🔥🔥"
            else:
                indicator = "🔥"
                
            print(f"  {stock['ticker']:6} ${stock['price']:5.2f} | BR:{stock['blackrock_pct']:4.1f}% + VG:{stock['vanguard_pct']:4.1f}% = {combined:5.1f}% {indicator}")
    
    if medium_tier:
        print(f"\n📊 MEDIUM PRIORITY - One 3%+ ({len(medium_tier)} stocks):")
        for stock in medium_tier:
            print(f"  {stock['ticker']:6} ${stock['price']:5.2f} | BR:{stock['blackrock_pct']:4.1f}% VG:{stock['vanguard_pct']:4.1f}%")
    
    if low_tier:
        print(f"\n⚠️ LOW PRIORITY - Other ({len(low_tier)} stocks):")
        for stock in low_tier:
            print(f"  {stock['ticker']:6} ${stock['price']:5.2f} | BR:{stock['blackrock_pct']:4.1f}% VG:{stock['vanguard_pct']:4.1f}%")
    
    print("=" * 60)

def main():
    """Main execution with JSON output and processed stocks tracking"""
    print("🎯 ENHANCED STOCK SCANNER")
    print("=" * 40)
    print(f"📊 Source: Nasdaq API")
    print(f"🔍 Minimum: 3% BR or VG holding")
    print(f"💰 Max Price: ${PRICE_THRESHOLD}")
    
    # Load tickers and processed stocks
    tickers = load_tickers()
    if not tickers:
        print("❌ No tickers to process")
        return
    
    processed_stocks = load_processed_stocks()
    print(f"📁 Previously processed: {len(processed_stocks)} stocks")
    
    # Filter out already processed stocks for new-only scanning
    new_tickers = [t for t in tickers if t not in processed_stocks]
    new_stocks_only = len(processed_stocks) > 0 and len(new_tickers) < len(tickers)
    
    if new_stocks_only:
        print(f"🆕 Scanning only new stocks: {len(new_tickers)} new out of {len(tickers)} total")
        tickers_to_scan = new_tickers
    else:
        print(f"📊 Full scan: {len(tickers)} stocks")
        tickers_to_scan = tickers
    
    if not tickers_to_scan:
        print("✅ No new stocks to scan!")
        # Save empty results but indicate new stocks only
        save_results_to_json([], len(tickers), new_stocks_only=True)
        return
    
    print(f"⏳ Processing {len(tickers_to_scan)} tickers...")
    print("-" * 40)
    
    results = []
    processed = 0
    
    for i, ticker in enumerate(tickers_to_scan, 1):
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
            print(f"⏳ Progress: {i:3d}/{len(tickers_to_scan)} | Found: {len(results):2d} matches")
        
        time.sleep(DELAY_BETWEEN_REQUESTS)
    
    # Update processed stocks
    all_processed_tickers = processed_stocks | set(tickers_to_scan)
    save_processed_stocks(all_processed_tickers)
    
    # Save results to JSON
    save_results_to_json(results, len(tickers), new_stocks_only)
    
    # Final summary
    print(f"\n📊 SCAN COMPLETE: {processed}/{len(tickers_to_scan)} processed, {len(results)} qualified")
    if new_stocks_only:
        print(f"🆕 New stocks only scan - {len(results)} new qualifying stocks found")
    
    display_results(results, len(tickers))

if __name__ == "__main__":
    main()