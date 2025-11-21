export interface Stock {
  ticker: string;
  price: number;
  previous_close?: number; // Previous closing price for change tracking
  blackrock_pct: number;
  vanguard_pct: number;
  statestreet_pct?: number; // State Street ownership percentage
  blackrock_change?: number; // Change in BlackRock percentage from previous scan
  vanguard_change?: number; // Change in Vanguard percentage from previous scan
  statestreet_change?: number; // Change in State Street percentage from previous scan
  blackrock_market_value?: number; // Market value in millions (numeric)
  vanguard_market_value?: number; // Market value in millions (numeric)
  statestreet_market_value?: number; // Market value in millions (numeric)
  market_cap?: number; // Market capitalization in millions
  blackrock_source: string;
  vanguard_source: string;
  data_quality: string;
  sources_count: number;
  discrepancy: boolean;
  notes: string;
  fire_level?: number; // 0-3, calculated by API
  previous_fire_level?: number; // Previous fire level from last scan
  is_new?: boolean; // True if this is a new fire stock
  performance?: {
    week: number;
    month: number;
    year: number;
  };
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