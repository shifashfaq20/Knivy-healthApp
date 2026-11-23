import axios from 'axios';

/** Knivy backend (phase 2). Empty in phase 1, which makes every backend feature report "unavailable". */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';
export const backendConfigured = API_BASE_URL.length > 0;

export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 30000,
});
