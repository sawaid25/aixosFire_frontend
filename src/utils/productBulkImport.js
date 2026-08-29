/**
 * Bulk product import — pure helpers (no network, no React).
 *
 * The Admin page (BulkImportProducts.jsx) uses these to turn an uploaded CSV
 * into a validated, previewable set of create/update operations. Nothing here
 * touches the database; the page calls the `bulk_import_products` RPC only
 * after `validateRows` reports zero errors.
 *
 * Catalogue shape:  Category  →  Product (name + model + specs + image)
 * Categories are NEVER created here — a row whose category doesn't already
 * exist is a hard error.
 */

// Column order used for the template and expected on upload. `id` is optional
// (present only when re-importing a system export); everything else is matched
// by header name, so column order in the uploaded file doesn't matter.
export const CSV_COLUMNS = [
    'id',
    'category',
    'product_name',
    'model_number',
    'description',
    'image_url',
    'specifications',
    'is_active',
];

export const REQUIRED_COLUMNS = ['category', 'product_name'];

export const LIMITS = {
    maxBytes: 1024 * 1024,   // 1 MB
    maxRows: 500,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRUE_TOKENS = new Set(['true', 't', 'yes', 'y', '1', 'active']);
const FALSE_TOKENS = new Set(['false', 'f', 'no', 'n', '0', 'inactive']);

const norm = (s) => (s || '').trim();
const lc = (s) => norm(s).toLowerCase();

/** Parse the `is_active` cell. Returns { ok, value } — value is boolean|null (null = "not provided"). */
export function parseStatus(raw) {
    const v = lc(raw);
    if (v === '') return { ok: true, value: null };
    if (TRUE_TOKENS.has(v)) return { ok: true, value: true };
    if (FALSE_TOKENS.has(v)) return { ok: true, value: false };
    return { ok: false, value: null };
}

/**
 * Parse the `specifications` cell into a plain object.
 * Accepts either:
 *   - a JSON object string:  {"Max Pressure":"175 PSI","Weight":"9 kg"}
 *   - semicolon-separated pairs:  Max Pressure: 175 PSI; Weight: 9 kg
 * Returns { ok, value } where value is an object|null (null = "not provided").
 */
export function parseSpecifications(raw) {
    const v = norm(raw);
    if (v === '') return { ok: true, value: null };

    if (v.startsWith('{')) {
        try {
            const parsed = JSON.parse(v);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return { ok: false, value: null };
            }
            const out = {};
            for (const [k, val] of Object.entries(parsed)) {
                if (norm(k)) out[norm(k)] = String(val).trim();
            }
            return { ok: true, value: Object.keys(out).length ? out : null };
        } catch {
            return { ok: false, value: null };
        }
    }

    const out = {};
    for (const pair of v.split(';')) {
        if (!norm(pair)) continue;
        const idx = pair.indexOf(':');
        if (idx === -1) return { ok: false, value: null }; // pair without a colon
        const key = norm(pair.slice(0, idx));
        const val = pair.slice(idx + 1).trim();
        if (!key) return { ok: false, value: null };
        out[key] = val;
    }
    return { ok: true, value: Object.keys(out).length ? out : null };
}

/** Serialize a specifications object back to the "k: v; k: v" cell form (for the template / export). */
export function specificationsToCell(specs) {
    if (!specs || typeof specs !== 'object') return '';
    return Object.entries(specs)
        .map(([k, v]) => `${k}: ${String(v).replace(/;/g, ',')}`)
        .join('; ');
}

export function isValidImageRef(raw) {
    const v = norm(raw);
    if (v === '') return true; // optional
    return /^https?:\/\/.+/i.test(v) || v.startsWith('/');
}

/**
 * Validate + resolve every CSV row against the live catalogue.
 *
 * @param {Array<Record<string,string>>} rows      parsed CSV rows
 * @param {string[]} headers                        parsed CSV header names
 * @param {Array<{id,name}>} categories             all categories in the DB
 * @param {Array<{id,name,model_number,category_id}>} products  all products in the DB
 * @returns {{
 *   headerErrors: string[],
 *   items: Array<{
 *     rowNumber, action:'create'|'update'|'error', errors:string[],
 *     categoryName, productName, modelNumber,
 *     payload: null | { op, id, category_id, name, model_number, description, image_url, specifications, is_active }
 *   }>,
 *   summary: { total, create, update, error }
 * }}
 */
export function validateRows(rows, headers, categories, products) {
    const headerSet = new Set((headers || []).map((h) => h.toLowerCase()));
    const headerErrors = [];
    for (const col of REQUIRED_COLUMNS) {
        if (!headerSet.has(col)) headerErrors.push(`Missing required column "${col}"`);
    }
    const unknown = (headers || []).filter((h) => h && !CSV_COLUMNS.includes(h.toLowerCase()));

    // Lookup maps.
    const catByName = new Map();
    (categories || []).forEach((c) => catByName.set(lc(c.name), c));

    const productById = new Map();
    const productByCatModel = new Map(); // `${category_id}::${model_lc}`
    const productByCatName = new Map();  // `${category_id}::${name_lc}`
    (products || []).forEach((p) => {
        productById.set(p.id, p);
        if (p.model_number) productByCatModel.set(`${p.category_id}::${lc(p.model_number)}`, p);
        productByCatName.set(`${p.category_id}::${lc(p.name)}`, p);
    });

    // Track duplicates *within the uploaded file*.
    const seenTargets = new Map(); // targetKey -> first rowNumber

    const items = (rows || []).map((row, idx) => {
        const rowNumber = idx + 2; // +1 for header line, +1 for 1-based
        const errors = [];

        const categoryName = norm(row.category);
        const productName = norm(row.product_name);
        const modelNumber = norm(row.model_number);
        const idCell = norm(row.id);

        // --- required presence ---
        if (!categoryName) errors.push('Category is missing');
        if (!productName) errors.push('Product name is missing');

        // --- category must already exist ---
        let category = null;
        if (categoryName) {
            category = catByName.get(lc(categoryName)) || null;
            if (!category) errors.push(`Category "${categoryName}" does not exist`);
        }

        // --- id (optional) must be a real product ---
        let byId = null;
        if (idCell) {
            if (!UUID_RE.test(idCell)) {
                errors.push(`Invalid id "${idCell}" (must be a product UUID or left blank)`);
            } else {
                byId = productById.get(idCell) || null;
                if (!byId) errors.push(`No existing product has id "${idCell}"`);
            }
        }

        // --- status ---
        const status = parseStatus(row.is_active);
        if (!status.ok) errors.push(`Invalid status "${norm(row.is_active)}" (use active/inactive)`);

        // --- specifications ---
        const specs = parseSpecifications(row.specifications);
        if (!specs.ok) {
            errors.push('Invalid specifications — use "Key: Value; Key: Value" or a JSON object');
        }

        // --- image ---
        if (!isValidImageRef(row.image_url)) {
            errors.push(`Invalid image_url "${norm(row.image_url)}" — must start with http(s):// or /`);
        }

        // --- resolve target (create vs update) ---
        let existing = null;
        if (byId) {
            existing = byId;
        } else if (category && modelNumber) {
            existing = productByCatModel.get(`${category.id}::${lc(modelNumber)}`) || null;
        } else if (category && productName) {
            existing = productByCatName.get(`${category.id}::${lc(productName)}`) || null;
        }

        // --- in-file duplicate detection ---
        let targetKey = null;
        if (byId) targetKey = `id:${byId.id}`;
        else if (category && modelNumber) targetKey = `cm:${category.id}:${lc(modelNumber)}`;
        else if (category && productName) targetKey = `cn:${category.id}:${lc(productName)}`;
        if (targetKey) {
            if (seenTargets.has(targetKey)) {
                errors.push(`Duplicate of row ${seenTargets.get(targetKey)} (same product in the same category)`);
            } else {
                seenTargets.set(targetKey, rowNumber);
            }
        }

        const action = errors.length ? 'error' : existing ? 'update' : 'create';

        let payload = null;
        if (!errors.length) {
            payload = {
                op: existing ? 'update' : 'create',
                id: existing ? existing.id : null,
                category_id: category.id,
                name: productName,
                model_number: modelNumber || null,
                description: norm(row.description) || null,
                image_url: norm(row.image_url) || null,
                specifications: specs.value, // object | null
                is_active: status.value,     // boolean | null (null handled server-side)
            };
        }

        return { rowNumber, action, errors, categoryName, productName, modelNumber, payload };
    });

    const summary = {
        total: items.length,
        create: items.filter((i) => i.action === 'create').length,
        update: items.filter((i) => i.action === 'update').length,
        error: items.filter((i) => i.action === 'error').length,
    };

    return { headerErrors, unknownColumns: unknown, items, summary };
}

/**
 * Build the downloadable template text. Includes the header row plus example
 * rows generated from the caller's real categories/products so the Admin sees
 * the actual Category → Product structure (one "update existing" example and
 * one "new product" example), never invented category names.
 */
export function buildTemplateCsv(toCsv, categories, sampleProducts) {
    const rows = [];
    const cat = (categories || [])[0];
    const sample = (sampleProducts || [])[0];

    if (sample && cat) {
        rows.push({
            id: '', // leave blank — matched by category + model_number
            category: (categories.find((c) => c.id === sample.category_id) || cat).name,
            product_name: sample.name,
            model_number: sample.model_number || '',
            description: sample.description || '',
            image_url: sample.image_url || '',
            specifications: specificationsToCell(sample.specifications),
            is_active: sample.is_active === false ? 'inactive' : 'active',
        });
    }
    if (cat) {
        rows.push({
            id: '',
            category: cat.name,
            product_name: 'Example New Product',
            model_number: 'EX-001',
            description: 'Replace this row with a real product, or delete it.',
            image_url: 'https://example.com/product.jpg',
            specifications: 'Max Working Pressure: 175 PSI; Weight: 9 kg',
            is_active: 'active',
        });
    }
    return toCsv(CSV_COLUMNS, rows);
}
