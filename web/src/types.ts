export interface Stock {
  ticker: string;
  price: number;
  blackrock_pct: number;
  vanguard_pct: number;
  blackrock_source: string;
  vanguard_source: string;
  data_quality: string;
  sources_count: number;
  discrepancy: boolean;
  notes: string;
  rank_category: number;
  rank_score: number | [number, number];
  fire_level?: number; // 0-3, calculated by API
  previous_fire_level?: number; // Previous fire level for change tracking
  fire_level_changed?: boolean; // True if fire level changed from previous scan
  is_new?: boolean; // True if this is a new fire stock
}

export interface ScanResult {
  stocks: Stock[];
  summary: {
    total_processed: number;
    qualifying_count: number;
    high_tier: number;
    medium_tier: number;
    low_tier: number;
    under_dollar: number;
    premium_count: number;
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