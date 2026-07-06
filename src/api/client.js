import axios from 'axios';

/**
 * Normalizes the backend base URL to always include /api (project convention).
 * @param {string} url Raw value from VITE_API_URL (host or full URL, with or without /api)
 */
const normalizeApiUrl = (url) => {
    let normalized = url.trim();

    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');

    // Add protocol if missing
    if (!/^https?:\/\//i.test(normalized)) {
        if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
            normalized = `http://${normalized}`;
        } else {
            normalized = `https://${normalized}`;
        }
    }

    // Append /api if missing (backend structure for this project)
    if (!normalized.endsWith('/api')) {
        normalized = `${normalized}/api`;
    }

    return normalized;
};

const rawEnv = import.meta.env.VITE_API_URL?.trim();

/**
 * Production builds must set VITE_API_URL (e.g. in Vercel). Defaulting to localhost
 * breaks real devices / Safari with "TypeError: Load failed" because the phone cannot reach your PC.
 */
export const API_URL = rawEnv
    ? normalizeApiUrl(rawEnv)
    : import.meta.env.DEV
        ? 'http://localhost:5000/api'
        : '';

export const isApiUrlConfigured = Boolean(API_URL);

if (import.meta.env.PROD && !rawEnv) {
    console.error(
        '[VITE_API_URL] Missing. Add it under Vercel → Settings → Environment Variables, e.g. VITE_API_URL=https://your-api.example.com (host only is OK; /api is appended). Redeploy after saving.'
    );
}

const client = axios.create({
    baseURL: API_URL || undefined,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 120000,
});

client.interceptors.request.use(
    (config) => {
        if (!API_URL && !import.meta.env.DEV) {
            return Promise.reject(
                new Error(
                    'VITE_API_URL is not set. Configure it in your host (e.g. Vercel environment variables) and redeploy.'
                )
            );
        }
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.data?.code === 'IMPERSONATION_EXPIRED') {
            window.dispatchEvent(new CustomEvent('impersonation-expired'));
        }
        return Promise.reject(error);
    }
);

export default client;
