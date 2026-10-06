import client from './client';

const extractApiData = (response, fallback = null) => {
    const payload = response?.data;
    if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload.success ? (payload.data ?? fallback) : fallback;
    }
    return payload ?? fallback;
};

/**
 * Customer-scoped inquiries (backend should filter by JWT customer role).
 */
export const fetchCustomerInquiries = async () => {
    try {
        const response = await client.get('/inquiries');
        return extractApiData(response, []);
    } catch (e) {
        console.error('fetchCustomerInquiries:', e);
        throw e;
    }
};

/**
 * Quotations visible to the logged-in customer.
 */
export const fetchCustomerQuotations = async () => {
    try {
        const response = await client.get('/quotations');
        return extractApiData(response, []);
    } catch (e) {
        console.error('fetchCustomerQuotations:', e);
        throw e;
    }
};

/**
 * Equipment (inquiry_items) belonging to the logged-in customer.
 */
export const fetchCustomerItems = async () => {
    try {
        const response = await client.get('/customers/me/items');
        return extractApiData(response, []);
    } catch (e) {
        console.error('fetchCustomerItems:', e);
        throw e;
    }
};

/**
 * Reference data for the inquiry-create form: active partners, service availability
 * (global + per partner), active catalog products and product↔partner assignments.
 */
export const fetchInquiryFormOptions = async () => {
    const response = await client.get('/inquiries/form-options');
    return extractApiData(response, null);
};

/**
 * Find active catalog products by CAT# (catalog number on one of the customer's own
 * items) or Product# (model number). Resolves to [{ product, matched_by, catalog_no }].
 */
export const lookupProductByCode = async (code) => {
    const response = await client.get('/inquiries/product-lookup', { params: { code } });
    return extractApiData(response, []);
};

/** Upload a License Renewal document; resolves to its public URL. */
export const uploadInquiryLicenseDocument = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post('/inquiries/license-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return extractApiData(response, null)?.url || null;
};

/** Optional PDF attached to a Validation request; returns { url, name }. */
export const uploadInquiryCustomerDocument = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await client.post('/inquiries/customer-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return extractApiData(response, null);
};

/**
 * Create an inquiry as the logged-in customer (POST /inquiries — the backend takes the
 * customer identity from the JWT and applies the customer request rules).
 */
export const createCustomerInquiry = async (inquiryData, items) => {
    const response = await client.post('/inquiries', { inquiryData, items });
    return extractApiData(response, null);
};

/**
 * Event timeline (inquiry_events) for one of the customer's inquiries, oldest first.
 */
export const fetchInquiryEvents = async (inquiryId) => {
    try {
        const response = await client.get(`/inquiries/${inquiryId}/events`);
        return extractApiData(response, []);
    } catch (e) {
        console.error('fetchInquiryEvents:', e);
        throw e;
    }
};

export const rejectQuotation = async (quotationId) => {
    const response = await client.patch(`/quotations/${quotationId}`, { status: 'rejected' });
    return extractApiData(response, null);
};

export const approveQuotation = async (quotationId) => {
    try {
        const response = await client.patch(`/quotations/${quotationId}`, { status: 'approved' });
        return extractApiData(response, null);
    } catch (e) {
        console.error('approveQuotation:', e);
        throw e;
    }
};
