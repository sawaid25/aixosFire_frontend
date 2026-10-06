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

/** Admin Per-Partner Service Control — a more granular override on top of the global switch
 * above, scoped to one Partner. Only ever writes admin_enabled; never touches the Partner's
 * own is_enabled preference.
 * @param {{service_type: string, service_subtype?: string, admin_enabled: boolean}[]} updates */
export const updatePartnerServiceAvailability = async (partnerId, updates) => {
    try {
        const response = await client.put(`/admin/partners/${partnerId}/service-availability`, { updates });
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error updating partner service availability:', error);
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

/** General Inquiry routing — which Admin account(s) get notified when an Agent creates
 * a General Inquiry (no Partner offers the selected product/service). */
export const getGeneralInquiryAdmins = async () => {
    try {
        const response = await client.get('/admin/general-inquiry-admins');
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error fetching General Inquiry admins:', error);
        throw error;
    }
};

/** @param {{admin_id: number, receives_general_inquiries: boolean}[]} updates */
export const updateGeneralInquiryAdmins = async (updates) => {
    try {
        const response = await client.put('/admin/general-inquiry-admins', { updates });
        return extractApiData(response, []);
    } catch (error) {
        console.error('Error updating General Inquiry admins:', error);
        throw error;
    }
};

/** Admin changes an Agent's status; an Agent becoming inactive routes their open inquiries to Admin. */
export const updateAgentStatus = async (agentId, status) => {
    const response = await client.patch(`/admin/agents/${agentId}/status`, { status });
    return extractApiData(response, null);
};

/** Admin assigns an Agent to an unassigned customer request (self-created customer). */
export const assignInquiryAgent = async (inquiryId, agentId) => {
    const response = await client.put(`/admin/inquiries/${inquiryId}/assign-agent`, { agent_id: agentId });
    return extractApiData(response, null);
};

/** Admin manually routing a General Inquiry (or any unassigned inquiry) to an eligible Partner. */
export const assignInquiryPartner = async (inquiryId, partnerId) => {
    try {
        const response = await client.put(`/admin/inquiries/${inquiryId}/assign-partner`, { partner_id: partnerId });
        return extractApiData(response, null);
    } catch (error) {
        console.error('Error assigning partner to inquiry:', error);
        throw error;
    }
};


// followup, license renewal, refill in sab ki inquiry ma bhi general inquiry banane ka option ayga 
// partner dashboard pr top pr partner ka naam ayega 
// agenr inquiry create kr time product detail ka option ayega aur Type aur kg ki input remove hogi
