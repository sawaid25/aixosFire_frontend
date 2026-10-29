import { AGENT_STATUS } from '../../constants/agentApprovalStatus';

// Same normalization as the Admin Agents page (legacy 'active' / 'suspended').
export const normalizeAgentStatus = (raw) => {
    const s = (raw || '').toLowerCase();
    if (s === 'active') return AGENT_STATUS.ACCEPTED;
    if (s === 'suspended') return AGENT_STATUS.REJECTED;
    return Object.values(AGENT_STATUS).includes(s) ? s : AGENT_STATUS.PENDING;
};

/** status -> [label, badge classes] */
export const AGENT_BADGE = {
    [AGENT_STATUS.ACCEPTED]: ['Accepted', 'bg-green-100 text-green-700'],
    [AGENT_STATUS.REJECTED]: ['Rejected', 'bg-red-100 text-red-700'],
    [AGENT_STATUS.HOLD]: ['Hold', 'bg-yellow-100 text-yellow-800'],
    [AGENT_STATUS.PENDING]: ['Pending', 'bg-slate-100 text-slate-600'],
};
