import { useCallback, useEffect, useState } from 'react';
import { getMyProducts } from '../api/partners';
import { useAuth } from '../context/AuthContext';

/**
 * Single source of truth for the products the Admin has assigned to the
 * logged-in Partner.
 *
 * Security: the data comes from `GET /api/partners/products`, which derives the
 * partner id from the verified JWT server-side (backend/controllers/
 * partnerController.getMyProducts). The client never sends a partner id and
 * cannot request another partner's list. The category / product-detail pages
 * filter THIS already-authorized array in memory — they never query the
 * `products` table directly (which has permissive RLS).
 *
 * A short module-level cache means the Manage Products page, a category page and
 * a product-detail page opened back-to-back share one network round-trip. The
 * cache is scoped to a user id so a logout → different-login in the same SPA
 * session can never show the previous partner's list.
 */

const TTL_MS = 60_000;
let cache = { data: null, ts: 0, userId: null };
let inflight = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn());

async function fetchProducts(userId, force = false) {
    const sameUser = cache.userId === userId;
    const fresh = sameUser && cache.data && Date.now() - cache.ts < TTL_MS;
    if (!force && fresh) return cache.data;
    if (inflight && sameUser) return inflight;

    inflight = (async () => {
        try {
            const data = await getMyProducts();
            cache = { data: Array.isArray(data) ? data : [], ts: Date.now(), userId };
            notify();
            return cache.data;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

/** Drop the cache — call after an assignment notification arrives, or on logout. */
export function invalidatePartnerProducts() {
    cache = { data: null, ts: 0, userId: null };
    notify();
}

export default function usePartnerProducts() {
    const { user } = useAuth();
    const userId = user?.id || null;
    const [products, setProducts] = useState(cache.userId === userId ? cache.data || [] : []);
    const [loading, setLoading] = useState(cache.userId !== userId || !cache.data);
    const [error, setError] = useState(null);

    const run = useCallback(async (force) => {
        if (!userId) { setProducts([]); setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchProducts(userId, force);
            setProducts(data);
        } catch (err) {
            console.error('[usePartnerProducts] load failed:', err);
            setError('Unable to load products. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        run(false);
        const onChange = () => setProducts(cache.userId === userId ? cache.data || [] : []);
        listeners.add(onChange);
        return () => listeners.delete(onChange);
    }, [run, userId]);

    return {
        products,
        loading,
        error,
        reload: () => run(true),
    };
}
