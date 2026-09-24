/**
 * API Service for connecting the React frontend to the Django REST backend.
 */
import { AppState } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export interface HealthStatus {
  status: string;
  database: 'connected' | 'disconnected';
  db_engine?: string;
  db_name?: string;
  db_user?: string;
  db_host?: string;
  db_port?: string;
  error?: string | null;
}

export const api = {
  // Health & Database Connection status
  async checkHealth(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${API_BASE_URL}/health/`);
      return await res.json();
    } catch (err: any) {
      return {
        status: 'offline',
        database: 'disconnected',
        error: err.message || 'Cannot reach Django server',
      };
    }
  },

  // State synchronization
  async fetchAppState(): Promise<Partial<AppState>> {
    const res = await fetch(`${API_BASE_URL}/sync/`);
    if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
    return await res.json();
  },

  async syncAppState(state: Partial<AppState>): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/sync/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error(`Failed to sync state: ${res.statusText}`);
    return await res.json();
  },

  async clearBackendData(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/sync/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to clear backend data: ${res.statusText}`);
    return await res.json();
  },

  // Generic Resource CRUD Helper
  async get<T>(resource: string): Promise<T[]> {
    const res = await fetch(`${API_BASE_URL}/${resource}/`);
    if (!res.ok) throw new Error(`Failed to get ${resource}`);
    return await res.json();
  },

  async create<T>(resource: string, item: Partial<T>): Promise<T> {
    const res = await fetch(`${API_BASE_URL}/${resource}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to create item in ${resource}`);
    return await res.json();
  },

  async update<T>(resource: string, id: string, item: Partial<T>): Promise<T> {
    const res = await fetch(`${API_BASE_URL}/${resource}/${id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error(`Failed to update item ${id} in ${resource}`);
    return await res.json();
  },

  async remove(resource: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/${resource}/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete item ${id} in ${resource}`);
  },
};
