import { User, Users, Handshake, Package, ClipboardList, MessageSquare } from 'lucide-react';

/**
 * Internal Team page permissions — mirrors backend/services/teamPermissions.js
 * (TEAM_PERMISSION_CATALOG). The backend is the authority: it re-checks every request
 * and ignores anything not in its catalog; this copy only drives labels, the Admin
 * permission picker and the team sidebar. Keep the two in sync when adding a page.
 */
export const TEAM_MODULES = [
    { key: 'agents',     label: 'Agents',     icon: User,          to: '/team/agents',     actions: ['view', 'edit'],   description: 'Agent list, profiles and activity.' },
    { key: 'customers',  label: 'Customers',  icon: Users,         to: '/team/customers',  actions: ['view'],           description: 'Customer accounts and their inquiry history.' },
    { key: 'partners',   label: 'Partners',   icon: Handshake,     to: '/team/partners',   actions: ['view'],           description: 'Service partners and their workload.' },
    { key: 'products',   label: 'Products',   icon: Package,       to: '/team/products',   actions: ['view'],           description: 'Product catalog by category.' },
    { key: 'inquiries',  label: 'Inquiries',  icon: ClipboardList, to: '/team/inquiries',  actions: ['view', 'assign'], description: 'All inquiries, items and timelines.' },
    { key: 'complaints', label: 'Complaints', icon: MessageSquare, to: '/team/complaints', actions: ['view', 'reply'],  description: 'Complaint conversations and analysis.' },
];

export const TEAM_ACTION_LABELS = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    assign: 'Assign',
    reply: 'Reply',
    delete: 'Delete',
};

/** What each non-view action actually lets the member do, shown in the Admin picker. */
export const TEAM_ACTION_HINTS = {
    'agents.edit': 'Change agent status (accept, reject, hold)',
    'inquiries.assign': 'Assign an active agent to customer requests',
    'complaints.reply': 'Reply in complaint conversations under their own name',
};

export const TEAM_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DEACTIVATED: 'deactivated',
};

export const hasTeamPermission = (user, module, action = 'view') =>
    Array.isArray(user?.permissions?.[module]) && user.permissions[module].includes(action);

export const permittedTeamModules = (user) => TEAM_MODULES.filter((m) => hasTeamPermission(user, m.key));
