export interface Stock {
  ticker: string;
  price: number;
  previous_close?: number; // Previous closing price for change tracking
  blackrock_pct: number;
  vanguard_pct: number;
  blackrock_market_value?: number; // Market value in millions (numeric)
  vanguard_market_value?: number; // Market value in millions (numeric)
  market_cap?: number; // Market capitalization in millions
  blackrock_source: string;
  vanguard_source: string;
  data_quality: string;
  sources_count: number;
  discrepancy: boolean;
  notes: string;
  fire_level?: number; // 0-3, calculated by API
  is_new?: boolean; // True if this is a new fire stock
}

export interface ScanResult {
  stocks: Stock[];
  summary: {
    total_processed: number;
    qualifying_count: number;
    under_dollar: number;
    fire_level_3?: number;
    fire_level_2?: number;
    fire_level_1?: number;
    total_fire_stocks?: number;
  };
  timestamp: string;
  new_stocks_only: boolean;
}

export interface ScanStatus {
  scanning: boolean;
  progress: {
    current: number;
    total: number;
    percentage: number;
  } | null;
  error: string | null;
  last_scan: string | null;
}