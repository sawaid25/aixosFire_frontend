import client from './client';

const extractApiData = (response, fallback = null) => {
    const payload = response?.data;
    if (payload && typeof payload === 'object' && 'success' in payload) {
        return payload.success ? (payload.data ?? fallback) : fallback;
    }
    return payload ?? fallback;
};

/** Admin-level global service availability — the master switch each partner's own
 * setting (src/api/partners.js's getMyServiceAvailability) is ANDed against. */
export const getGlobalServiceAvailability = async () => {
    try {
        const response = await client.get('/admin/service-availability');
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error fetching global service availability:', error);
        throw error;
    }
};

/** @param {{service_type: string, service_subtype?: string, is_enabled: boolean}[]} updates */
export const updateGlobalServiceAvailability = async (updates) => {
    try {
        const response = await client.put('/admin/service-availability', { updates });
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error updating global service availability:', error);
        throw error;
    }
};

/** Partner Chat Management — per-Partner, per-service Chat-with-Agent / Chat-with-Customer switches. */
export const getPartnerChatSettings = async (partnerId) => {
    try {
        const response = await client.get(`/admin/partners/${partnerId}/chat-settings`);
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error fetching partner chat settings:', error);
        throw error;
    }
};

/** @param {{service: string, chat_with_agent?: boolean, chat_with_customer?: boolean}[]} updates */
export const updatePartnerChatSettings = async (partnerId, updates) => {
    try {
        const response = await client.put(`/admin/partners/${partnerId}/chat-settings`, { updates });
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error updating partner chat settings:', error);
        throw error;
    }
};
