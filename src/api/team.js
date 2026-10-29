import client from './client';

// Internal Team API (backend/routes/team.js). Every call is permission-checked
// server-side; a 403 here means the member's access changed, not a UI bug.
const unwrap = (response) => {
    const payload = response?.data;
    if (payload && typeof payload === 'object' && 'success' in payload) return payload.data;
    return payload;
};

export const getTeamMe = async () => unwrap(await client.get('/team/me'));
export const getTeamSummary = async () => unwrap(await client.get('/team/summary'));

export const getTeamAgents = async (status) => unwrap(await client.get('/team/agents', { params: status ? { status } : {} }));
export const getTeamAgent = async (id) => unwrap(await client.get(`/team/agents/${id}`));
export const updateTeamAgentStatus = async (id, status) => unwrap(await client.patch(`/team/agents/${id}/status`, { status }));

export const getTeamCustomers = async () => unwrap(await client.get('/team/customers'));
export const getTeamCustomer = async (id) => unwrap(await client.get(`/team/customers/${id}`));

export const getTeamPartners = async () => unwrap(await client.get('/team/partners'));

export const getTeamInquiries = async (params = {}) => unwrap(await client.get('/team/inquiries', { params }));
export const getTeamInquiry = async (id) => unwrap(await client.get(`/team/inquiries/${id}`));
export const assignTeamInquiryAgent = async (id, agentId) => unwrap(await client.put(`/team/inquiries/${id}/assign-agent`, { agent_id: agentId }));

export const getTeamComplaints = async () => unwrap(await client.get('/team/complaints'));
export const getTeamComplaintThread = async (role, userId) => unwrap(await client.get(`/team/complaints/${role}/${userId}`));
export const sendTeamComplaintReply = async (role, userId, message) => unwrap(await client.post(`/team/complaints/${role}/${userId}/replies`, { message }));

/** Backend error message from an axios error, for toasts. */
export const teamErrorMessage = (err, fallback = 'Something went wrong.') =>
    err?.response?.data?.error || err?.message || fallback;
