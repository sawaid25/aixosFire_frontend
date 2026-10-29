// Same "Needs Agent" rule as the Admin InquiryList: an open inquiry with no Agent that a
// customer created, or one whose Agent is no longer active.
const CLOSED_STATUSES = ['completed', 'closed', 'rejected', 'cancelled'];
const isActiveAgent = (agent) => ['accepted', 'active'].includes(String(agent?.status || '').trim().toLowerCase());

export const needsAgent = (inq) => {
    if (CLOSED_STATUSES.includes(String(inq.status || '').toLowerCase())) return false;
    if (!inq.agent_id) return String(inq.performed_by || '').trim().toLowerCase() === 'customer';
    return !isActiveAgent(inq.agents);
};
