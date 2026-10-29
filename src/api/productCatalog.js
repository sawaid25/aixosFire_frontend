import { supabase } from '../supabaseClient';
import client from './client';

/**
 * Data loaders for the shared catalog pages (pages/admin/Products.jsx,
 * CategoryProducts.jsx, AdminProductDetail.jsx), one per portal with the same shapes:
 *   loadCategories()                  -> { categories, productCounts }
 *   loadCategory(categoryId)          -> { category, products, assignedCounts }
 *   loadProduct(categoryId, productId) -> { category, product, partners }
 *
 * Admin reads Supabase directly, exactly as those pages always did. Internal Team reads
 * through /api/team/products/*, where the backend checks the member's Products
 * permission on every request. Pick one with useCatalogPortal().
 */

const countBy = (rows, key) => {
    const counts = {};
    (rows || []).forEach((row) => {
        if (!row[key]) return;
        counts[row[key]] = (counts[row[key]] || 0) + 1;
    });
    return counts;
};

export const adminCatalog = {
    async loadCategories() {
        const [{ data: cData, error: cErr }, { data: pData, error: pErr }] = await Promise.all([
            supabase.from('categories').select('*').order('created_at', { ascending: true }),
            supabase.from('products').select('id, category_id'),
        ]);
        if (cErr) throw cErr;
        if (pErr) console.error('[Products] product count query failed:', pErr);
        return { categories: cData || [], productCounts: countBy(pData, 'category_id') };
    },

    async loadCategory(categoryId) {
        const [{ data: catData, error: catErr }, { data: pData, error: pErr }] = await Promise.all([
            supabase.from('categories').select('*').eq('id', categoryId).maybeSingle(),
            supabase.from('products').select('*').eq('category_id', categoryId).order('created_at', { ascending: true }),
        ]);
        if (catErr) throw catErr;
        if (pErr) throw pErr;

        let assignedCounts = {};
        const ids = (pData || []).map((p) => p.id);
        if (ids.length) {
            const { data: apData, error: apErr } = await supabase
                .from('partner_products')
                .select('product_id')
                .in('product_id', ids);
            if (apErr) console.error('[CategoryProducts] partner_products count query failed:', apErr);
            else assignedCounts = countBy(apData, 'product_id');
        }
        return { category: catData, products: pData || [], assignedCounts };
    },

    async loadProduct(categoryId, productId) {
        const [{ data: catData }, { data: prodData, error: prodErr }] = await Promise.all([
            supabase.from('categories').select('*').eq('id', categoryId).maybeSingle(),
            supabase.from('products').select('*').eq('id', productId).maybeSingle(),
        ]);
        if (prodErr) throw prodErr;

        let partners = [];
        if (prodData) {
            const { data: assignedData, error: assignedErr } = await supabase
                .from('partner_products')
                .select('assigned_at, partners(id, business_name, owner_name)')
                .eq('product_id', prodData.id)
                .order('assigned_at', { ascending: false });
            if (assignedErr) console.error('[AdminProductDetail] assigned partners query failed:', assignedErr);
            else partners = (assignedData || []).filter((r) => r.partners);
        }
        return { category: catData, product: prodData, partners };
    },
};

const unwrap = (response) => response?.data?.data;

export const teamCatalog = {
    async loadCategories() {
        return unwrap(await client.get('/team/products/categories'));
    },
    async loadCategory(categoryId) {
        return unwrap(await client.get(`/team/products/categories/${categoryId}`));
    },
    // The backend resolves the category from the product itself.
    async loadProduct(_categoryId, productId) {
        return unwrap(await client.get(`/team/products/items/${productId}`));
    },
};
