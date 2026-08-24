import client from './client';
import { createInquiryViaSupabase } from './inquirySupabase';
import { isInquiryApiNetworkFailure } from './submitErrors';

const extractApiData = (response, fallback = null) => {
    const payload = response?.data;
    if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload.success ? (payload.data ?? fallback) : fallback;
    }
    return payload ?? fallback;
};

export const getPartnerDashboard = async () => {
    try {
        const response = await client.get('/partners/dashboard');
        return extractApiData(response, {});
    } catch (error) {
        console.error('Error fetching partner dashboard:', error);
        throw error;
    }
};

export const getPartnerStats = async () => {
    try {
        const response = await client.get('/partners/stats');
        return extractApiData(response, {});
    } catch (error) {
        console.error('Error fetching partner stats:', error);
        throw error;
    }
};

export const getInquiries = async (params = {}) => {
    try {
        const response = await client.get('/inquiries', { params });
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error fetching inquiries:', error);
        throw error;
    }
};

export const getInquiryById = async (id) => {
    try {
        const response = await client.get(`/inquiries/${id}`);
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error fetching inquiry details:', error);
        throw error;
    }
};

export const updateInquiryStatus = async (id, status) => {
    try {
        const response = await client.patch(`/inquiries/${id}`, { status });
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error updating inquiry status:', error);
        throw error;
    }
};

export const updateInquiryItem = async (id, updates) => {
    try {
        const response = await client.patch(`/inquiry-items/${id}`, updates);
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error updating inquiry item:', error);
        throw error;
    }
};

export const addInquiryItems = async (inquiryId, items) => {
    try {
        const response = await client.post(`/inquiries/${inquiryId}/items`, { items });
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error adding inquiry items:', error);
        throw error;
    }
};

export const addItemServices = async (itemId, services) => {
    try {
        const response = await client.post(`/inquiry-items/${itemId}/services`, { services });
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error adding item services:', error);
        throw error;
    }
};

export const uploadInquiryDocument = async (formData) => {
    try {
        const response = await client.post('/inquiry-documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error uploading document:', error);
        throw error;
    }
};

export const submitQuotation = async (data) => {
    try {
        const response = await client.post('/partners/quotations', data);
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error submitting quotation:', error);
        throw error;
    }
};

export const submitSiteVisit = async (formData) => {
    try {
        // Use multipart/form-data for file uploads
        const response = await client.post('/partners/site-visits', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error submitting site visit:', error);
        throw error;
    }
};
export const getMyProducts = async () => {
    try {
        const response = await client.get('/partners/products');
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error fetching assigned products:', error);
        throw error;
    }
};

export const getAllPartners = async () => {
    try {
        const response = await client.get('/partners');
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error fetching partners:', error);
        throw error;
    }
};

export const createInquiry = async (inquiryData, items) => {
    const inquiryType = String(inquiryData?.type || '').trim().toLowerCase();
    const requiresPartner = inquiryType === 'validation' || inquiryType === 'refill' || inquiryType === 'refilled';
    if (requiresPartner && !inquiryData?.partner_id) {
        const err = new Error('Partner is required for this inquiry type');
        err.status = 400;
        throw err;
    }

    // Validation inquiries are auto-completed — bypass REST API entirely.
    // The REST API backend ignores the status field and always saves 'pending'.
    // createInquiryViaSupabase correctly saves status='completed' for validation.
    if (inquiryType === 'validation') {
        return await createInquiryViaSupabase({ ...inquiryData, status: 'completed' }, items);
    }

    try {
        const response = await client.post('/inquiries', { inquiryData, items });
        return extractApiData(response, null);
    } catch (error) {
        if (isInquiryApiNetworkFailure(error)) {
            console.warn(
                '[createInquiry] REST API unreachable (network/CORS/SSL). Saving via Supabase fallback.'
            );
            try {
                return await createInquiryViaSupabase(inquiryData, items);
            } catch (supabaseErr) {
                console.error('createInquiry Supabase fallback failed:', supabaseErr);
                throw supabaseErr;
            }
        }
        console.error('Error creating inquiry:', error);
        throw error;
    }
};
