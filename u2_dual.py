#!/usr/bin/env python3
"""
Dual-Source Stock Scanner: Find stocks under $2 with BlackRock & Vanguard holdings
Uses Yahoo Finance + Nasdaq API for cross-validation
"""

import yfinance as yf
import pandas as pd
import logging
import time
import requests
from typing import List, Dict, Optional

# === Configuration ===
PRICE_THRESHOLD = 2.0
HOLD_THRESHOLD = 0.04  # 4% minimum holding (decimal format)
DELAY_BETWEEN_REQUESTS = 0.5  # Rate limiting
REQUIRE_BOTH_HOLDERS = False  # Require EITHER BlackRock OR Vanguard (changed from True)

# === Logging Setup ===
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s"
)

# === Ticker Configuration ===
TICKER_STRING = "BYND"  # Test with BYND
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

def get_nasdaq_institutional_data(ticker: str) -> Optional[Dict]:
    """Get institutional holdings data from Nasdaq API"""
    try:
        url = f"https://api.nasdaq.com/api/company/{ticker}/institutional-holdings"
        params = {
            'limit': 50,
            'type': 'TOTAL',
            'sortColumn': 'marketValue'
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status', {}).get('rCode') == 200:
                return data.get('data', {})
        
        return None
        
    except Exception as e:
        logging.debug(f"Nasdaq API error for {ticker}: {str(e)}")
        return None

def parse_nasdaq_holdings(nasdaq_data: Dict) -> tuple:
    """Parse Nasdaq institutional holdings data"""
    if not nasdaq_data:
        return 0, 0, None, None
    
    try:
        holdings_table = nasdaq_data.get('holdingsTransactions', {}).get('table', {})
        rows = holdings_table.get('rows', [])
        
        if not rows:
            return 0, 0, None, None
        
        # Get total shares outstanding for percentage calculation
        total_shares_str = nasdaq_data.get('ownershipSummary', {}).get('ShareoutstandingTotal', {}).get('value', '0')
        total_shares = float(total_shares_str.replace(',', '')) * 1_000_000  # Convert millions to actual shares
        
        blackrock_pct = 0
        vanguard_pct = 0
        blackrock_date = None
        vanguard_date = None
        
        print(f"📊 Nasdaq: Found {len(rows)} institutional holders")
        print(f"📊 Total shares outstanding: {total_shares:,.0f}")
        
        for row in rows:
            owner_name = row.get('ownerName', '').lower()
            shares_held_str = row.get('sharesHeld', '0')
            date = row.get('date', '')
            
            # Parse shares held
            shares_held = float(shares_held_str.replace(',', ''))
            percentage = shares_held / total_shares if total_shares > 0 else 0
            
            # Find BlackRock
            if 'blackrock' in owner_name and percentage > blackrock_pct:
                blackrock_pct = percentage
                blackrock_date = date
                print(f"🔸 Nasdaq BlackRock: {percentage*100:.1f}% ({shares_held:,.0f} shares, Date: {date})")
            
            # Find Vanguard
            elif 'vanguard' in owner_name and percentage > vanguard_pct:
                vanguard_pct = percentage
                vanguard_date = date
                print(f"🔸 Nasdaq Vanguard: {percentage*100:.1f}% ({shares_held:,.0f} shares, Date: {date})")
        
        return blackrock_pct, vanguard_pct, blackrock_date, vanguard_date
        
    except Exception as e:
        logging.debug(f"Error parsing Nasdaq holdings: {e}")
        return 0, 0, None, None

def parse_yahoo_institutional_holdings(holders_df: pd.DataFrame) -> tuple:
    """Extract BlackRock and Vanguard holdings from Yahoo Finance data"""
    if holders_df is None or holders_df.empty:
        return 0, 0, None, None
    
    try:
        # Clean column names
        holders_df.columns = [c.strip() for c in holders_df.columns]
        
        # Find percentage column
        percent_col = None
        for col in ["pctHeld", "% Out", "% Held", "Percent"]:
            if col in holders_df.columns:
                percent_col = col
                break
        
        # Find date column
        date_col = None
        for col in ["Date Reported", "Date", "Report Date", "Filing Date"]:
            if col in holders_df.columns:
                date_col = col
                break
        
        if not percent_col:
            return 0, 0, None, None
        
        blackrock_pct = 0
        vanguard_pct = 0
        blackrock_date = None
        vanguard_date = None
        
        print(f"📊 Yahoo: Found {len(holders_df)} institutional holders")
        
        for _, row in holders_df.iterrows():
            holder_name = str(row["Holder"]).lower()
            holding_pct = row[percent_col]
            
            # Get date if available
            report_date = None
            if date_col and date_col in row:
                try:
                    report_date = pd.to_datetime(row[date_col])
                    if pd.notna(report_date):
                        report_date = report_date.strftime('%Y-%m-%d')
                except:
                    report_date = str(row[date_col]) if row[date_col] else None
            
            # Convert string percentages to decimal
            if isinstance(holding_pct, str):
                holding_pct = float(holding_pct.replace('%', '').replace(',', '')) / 100
            
            # Find BlackRock holdings
            if "blackrock" in holder_name and holding_pct > blackrock_pct:
                blackrock_pct = holding_pct
                blackrock_date = report_date
                print(f"🔸 Yahoo BlackRock: {holding_pct*100:.1f}% (Date: {report_date})")
            
            # Find Vanguard holdings
            elif "vanguard" in holder_name and holding_pct > vanguard_pct:
                vanguard_pct = holding_pct
                vanguard_date = report_date
                print(f"🔸 Yahoo Vanguard: {holding_pct*100:.1f}% (Date: {report_date})")
        
        return blackrock_pct, vanguard_pct, blackrock_date, vanguard_date
        
    except Exception as e:
        logging.debug(f"Error parsing Yahoo holdings: {e}")
        return 0, 0, None, None

def compare_data_sources(ticker: str, yahoo_br: float, yahoo_vg: float, nasdaq_br: float, nasdaq_vg: float) -> Dict:
    """Compare Yahoo and Nasdaq data and detect discrepancies"""
    comparison = {
        'has_discrepancy': False,
        'blackrock_diff': 0,
        'vanguard_diff': 0,
        'data_quality': 'high'
    }
    
    # Calculate differences (in percentage points)
    if yahoo_br > 0 and nasdaq_br > 0:
        comparison['blackrock_diff'] = abs(yahoo_br - nasdaq_br) * 100
        if comparison['blackrock_diff'] > 1:  # More than 1% difference
            comparison['has_discrepancy'] = True
            print(f"⚠️ BlackRock discrepancy for {ticker}: Yahoo {yahoo_br*100:.1f}% vs Nasdaq {nasdaq_br*100:.1f}%")
    
    if yahoo_vg > 0 and nasdaq_vg > 0:
        comparison['vanguard_diff'] = abs(yahoo_vg - nasdaq_vg) * 100
        if comparison['vanguard_diff'] > 1:  # More than 1% difference
            comparison['has_discrepancy'] = True
            print(f"⚠️ Vanguard discrepancy for {ticker}: Yahoo {yahoo_vg*100:.1f}% vs Nasdaq {nasdaq_vg*100:.1f}%")
    
    # Assess data quality
    if comparison['has_discrepancy']:
        comparison['data_quality'] = 'medium'
    elif (yahoo_br > 0 or yahoo_vg > 0) and (nasdaq_br > 0 or nasdaq_vg > 0):
        comparison['data_quality'] = 'high'
        print(f"✅ Data validation passed for {ticker}")
    else:
        comparison['data_quality'] = 'low'
    
    return comparison

def process_ticker(ticker: str, show_details: bool = False) -> dict:
    """Process a single ticker and check criteria using both Yahoo Finance and Nasdaq"""
    try:
        stock = yf.Ticker(ticker)
        
        # Get price
        price = stock.info.get("currentPrice") or stock.fast_info.get("last_price")
        if not price or price > PRICE_THRESHOLD:
            if show_details and price:
                logging.info(f"{ticker}: ${price:.2f} - Above threshold")
            return None
        
        if show_details:
            print(f"\n🔍 Analyzing {ticker} institutional holdings:")
        
        # Get Yahoo Finance data
        institutional_holders = stock.get_institutional_holders()
        yahoo_br, yahoo_vg, yahoo_br_date, yahoo_vg_date = parse_yahoo_institutional_holdings(institutional_holders)
        
        # Get Nasdaq data
        nasdaq_data = get_nasdaq_institutional_data(ticker)
        nasdaq_br, nasdaq_vg, nasdaq_br_date, nasdaq_vg_date = parse_nasdaq_holdings(nasdaq_data)
        
        # Use the higher percentage from either source
        final_br = max(yahoo_br, nasdaq_br)
        final_vg = max(yahoo_vg, nasdaq_vg)
        
        # Compare data sources and detect discrepancies
        if show_details:
            comparison = compare_data_sources(ticker, yahoo_br, yahoo_vg, nasdaq_br, nasdaq_vg)
            data_quality = comparison['data_quality']
        else:
            data_quality = 'medium'
        
        # Check criteria
        if REQUIRE_BOTH_HOLDERS:
            meets_criteria = final_br >= HOLD_THRESHOLD and final_vg >= HOLD_THRESHOLD
        else:
            meets_criteria = final_br >= HOLD_THRESHOLD or final_vg >= HOLD_THRESHOLD
        
        if not meets_criteria:
            if show_details:
                logging.info(f"{ticker}: ${price:.2f} - BR:{final_br*100:.1f}% VG:{final_vg*100:.1f}% - Insufficient")
            return None
        
        if show_details:
            # Show which source provided the final data
            br_source = "Yahoo" if yahoo_br >= nasdaq_br else "Nasdaq"
            vg_source = "Yahoo" if yahoo_vg >= nasdaq_vg else "Nasdaq"
            br_date = yahoo_br_date if yahoo_br >= nasdaq_br else nasdaq_br_date
            vg_date = yahoo_vg_date if yahoo_vg >= nasdaq_vg else nasdaq_vg_date
            
            logging.info(f"✅ {ticker}: ${price:.2f} - BR:{final_br*100:.1f}% ({br_source}) VG:{final_vg*100:.1f}% ({vg_source}) - MATCH")
        
        return {
            'ticker': ticker,
            'price': price,
            'blackrock_pct': final_br,
            'vanguard_pct': final_vg,
            'blackrock_source': br_source if 'br_source' in locals() else 'Unknown',
            'vanguard_source': vg_source if 'vg_source' in locals() else 'Unknown',
            'data_quality': data_quality,
            'yahoo_data': {'br': yahoo_br, 'vg': yahoo_vg},
            'nasdaq_data': {'br': nasdaq_br, 'vg': nasdaq_vg}
        }
        
    except Exception as e:
        if show_details:
            logging.error(f"❌ {ticker}: Error - {str(e)}")
        return None

def main():
    """Main execution"""
    print("🎯 DUAL-SOURCE STOCK SCANNER: Yahoo Finance + Nasdaq API")
    print("=" * 60)
    
    tickers = load_tickers()
    if not tickers:
        print("❌ No tickers to process")
        return
    
    threshold_text = "BOTH" if REQUIRE_BOTH_HOLDERS else "EITHER"
    print(f"🔍 Scanning {len(tickers)} tickers for {threshold_text} BlackRock & Vanguard ≥ {HOLD_THRESHOLD*100}%")
    print(f"💰 Price filter: Under ${PRICE_THRESHOLD}")
    print(f"📊 Cross-validating data between Yahoo Finance and Nasdaq API")
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
    
    print("\n" + "=" * 60)
    print(f"🎯 RESULTS: {len(results)} matches found")
    print("=" * 60)
    
    if results:
        # Sort by price
        results.sort(key=lambda x: x['price'])
        
        # Categorize by price
        under_1 = [r for r in results if r['price'] < 1.0]
        between_1_2 = [r for r in results if 1.0 <= r['price'] < 2.0]
        
        if under_1:
            print(f"\n💎 UNDER $1.00 ({len(under_1)} stocks):")
            for r in under_1:
                br_source = r.get('blackrock_source', 'Unknown')
                vg_source = r.get('vanguard_source', 'Unknown')
                quality = r.get('data_quality', 'unknown')
                quality_icon = {"high": "🔥", "medium": "📊", "low": "⚠️"}.get(quality, "❓")
                print(f"   {r['ticker']}: ${r['price']:.2f} | BR:{r['blackrock_pct']*100:.1f}%({br_source}) VG:{r['vanguard_pct']*100:.1f}%({vg_source}) {quality_icon}")
            
            under_1_list = [r['ticker'] for r in under_1]
            print(f"\n📋 Under $1 list: {','.join(under_1_list)}")
        
        if between_1_2:
            print(f"\n🥈 $1.00-$2.00 ({len(between_1_2)} stocks):")
            for r in between_1_2:
                br_source = r.get('blackrock_source', 'Unknown')
                vg_source = r.get('vanguard_source', 'Unknown')
                quality = r.get('data_quality', 'unknown')
                quality_icon = {"high": "🔥", "medium": "📊", "low": "⚠️"}.get(quality, "❓")
                print(f"   {r['ticker']}: ${r['price']:.2f} | BR:{r['blackrock_pct']*100:.1f}%({br_source}) VG:{r['vanguard_pct']*100:.1f}%({vg_source}) {quality_icon}")
            
            between_1_2_list = [r['ticker'] for r in between_1_2]
            print(f"\n📋 $1-$2 list: {','.join(between_1_2_list)}")
        
        # All results
        all_tickers = [r['ticker'] for r in results]
        print(f"\n📋 ALL MATCHES: {','.join(all_tickers)}")
        
        # Data quality summary
        quality_counts = {}
        for result in results:
            quality = result.get('data_quality', 'unknown')
            quality_counts[quality] = quality_counts.get(quality, 0) + 1
        
        print(f"\n📊 DATA QUALITY SUMMARY:")
        print(f"🔥 High quality (validated): {quality_counts.get('high', 0)} stocks")
        print(f"📊 Medium quality (discrepancy): {quality_counts.get('medium', 0)} stocks") 
        print(f"⚠️ Low quality (single source): {quality_counts.get('low', 0)} stocks")
        
    else:
        print("❌ No matches found")
    
    print("=" * 60)

if __name__ == "__main__":
    main()