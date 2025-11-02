import axios from 'axios';
import { ScanResult, ScanStatus } from './types';

const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:9000';

export const api = {
  // Start a new scan
  startScan: async (): Promise<{ success: boolean; message: string }> => {
    const response = await axios.post(`${API_BASE}/api/scan/start`);
    return response.data;
  },

  // Start a daily scan
  startDailyScan: async (): Promise<{ success: boolean; message: string }> => {
    const response = await axios.post(`${API_BASE}/api/scan/daily`);
    return response.data;
  },

  // Get current scan status
  getScanStatus: async (): Promise<ScanStatus> => {
    const response = await axios.get(`${API_BASE}/api/scan/status`);
    return response.data;
  },

  // Get latest scan results
  getLatestResults: async (): Promise<ScanResult | null> => {
    const response = await axios.get(`${API_BASE}/api/scan/results`);
    return response.data;
  },

  // Ticker Management
  getTickers: async (): Promise<{ tickers: string[]; count: number }> => {
    const response = await axios.get(`${API_BASE}/api/tickers`);
    return response.data;
  },

  addTicker: async (ticker: string): Promise<{ success: boolean; message: string }> => {
    const response = await axios.post(`${API_BASE}/api/tickers`, { ticker });
    return response.data;
  },

  addTickers: async (tickers: string[]): Promise<{ success: boolean; added: number; tickers: string[] }> => {
    const response = await axios.post(`${API_BASE}/api/tickers`, { tickers });
    return response.data;
  },

  updateTickers: async (tickers: string[]): Promise<{ success: boolean; tickers: string[]; count: number }> => {
    const response = await axios.put(`${API_BASE}/api/tickers`, { tickers });
    return response.data;
  },

  removeTicker: async (ticker: string): Promise<{ success: boolean; message: string }> => {
    const response = await axios.delete(`${API_BASE}/api/tickers/${ticker}`);
    return response.data;
  },

  getStats: async (): Promise<{ totalTickers: number; lastScan: string | null; qualifyingStocks: number }> => {
    const response = await axios.get(`${API_BASE}/api/stats`);
    return response.data;
  },

  // Holdings Management
  getHoldings: async (): Promise<{ holdings: string[]; count: number }> => {
    const response = await axios.get(`${API_BASE}/api/holdings`);
    return response.data;
  },

  addHolding: async (ticker: string): Promise<{ success: boolean; message: string }> => {
    const response = await axios.post(`${API_BASE}/api/holdings/${ticker}`);
    return response.data;
  },

  removeHolding: async (ticker: string): Promise<{ success: boolean; message: string }> => {
    const response = await axios.delete(`${API_BASE}/api/holdings/${ticker}`);
    return response.data;
  },

  isHolding: async (ticker: string): Promise<{ ticker: string; isHolding: boolean }> => {
    const response = await axios.get(`${API_BASE}/api/holdings/${ticker}`);
    return response.data;
  },

  // Watchlist Management
  getWatchlists: async (): Promise<{ watchlists: any[]; count: number }> => {
    const response = await axios.get(`${API_BASE}/api/watchlists`);
    return response.data;
  },

  getWatchlist: async (id: string): Promise<any> => {
    const response = await axios.get(`${API_BASE}/api/watchlists/${id}`);
    return response.data;
  },

  createWatchlist: async (name: string, stocks: string[] = []): Promise<{ success: boolean; watchlist: any }> => {
    const response = await axios.post(`${API_BASE}/api/watchlists`, { name, stocks });
    return response.data;
  },

  updateWatchlist: async (id: string, updates: any): Promise<{ success: boolean; watchlist: any }> => {
    const response = await axios.put(`${API_BASE}/api/watchlists/${id}`, updates);
    return response.data;
  },

  deleteWatchlist: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await axios.delete(`${API_BASE}/api/watchlists/${id}`);
    return response.data;
  },

  addToWatchlist: async (id: string, stocks: string[]): Promise<{ success: boolean; added: number; total: number }> => {
    const response = await axios.post(`${API_BASE}/api/watchlists/${id}/stocks`, { stocks });
    return response.data;
  },

  removeFromWatchlist: async (id: string, stocks: string[]): Promise<{ success: boolean; removed: number; total: number }> => {
    const response = await axios.delete(`${API_BASE}/api/watchlists/${id}/stocks`, { data: { stocks } });
    return response.data;
  }
};

export default api;