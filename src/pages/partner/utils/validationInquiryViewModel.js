/**
 * Maps GET /api/inquiries/:id (and related shapes) into a stable view model for Validation UI.
 * Handles snake_case, nested customers, and common alternates without dummy data.
 */

const formatDate = (value) => {
    if (value == null || value === '') return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().split('T')[0];
};

// inquiry_items has no "range" field — each row is one physical unit with its own
// serial_no. The breakdown table groups those units by extinguisher type, so the
// "range" has to be derived from the serial_no values within each group.
const formatSerialRange = (serialNos) => {
    const nums = serialNos
        .map((s) => (s == null ? null : Number(s)))
        .filter((n) => n != null && !Number.isNaN(n));

    if (nums.length === 0) return '—';
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return min === max ? String(min) : `${min}–${max}`;
};

const normalizeUtilizationRows = (inquiry) => {
    const items = inquiry.inquiry_items;
    if (!Array.isArray(items) || items.length === 0) return [];

    const groups = new Map();
    items.forEach((item) => {
        const type = item.type || item.system || item.system_type || 'Unknown';
        if (!groups.has(type)) groups.set(type, { count: 0, serialNos: [], statuses: new Set(), units: new Set(), items: [] });
        const group = groups.get(type);
        group.count += Number(item.quantity) || 1;
        if (item.serial_no != null) group.serialNos.push(item.serial_no);
        if (item.status) group.statuses.add(item.status);
        if (item.unit) group.units.add(item.unit);
        group.items.push(item);
    });

    return Array.from(groups.entries()).map(([type, group]) => ({
        type,
        count: group.count,
        unit: group.units.size === 1 ? [...group.units][0] : null,
        serialRange: formatSerialRange(group.serialNos),
        // Uniform status across every unit in the group shows as-is; a group that
        // mixes statuses (e.g. one refilled, one still new) is flagged rather than
        // silently picking one and hiding the disagreement.
        status: group.statuses.size === 1 ? [...group.statuses][0] : (group.statuses.size > 1 ? 'Mixed' : null),
        // The individual inquiry_items rows behind this group — the expanded detail
        // view needs every one of them, not just the first, once a type has >1 unit.
        items: group.items,
    }));
};

export const buildValidationInquiryViewModel = (inquiry) => {
    if (!inquiry || typeof inquiry !== 'object') {
        return {
            inquiryNo: '—',
            badgeLabel: 'Inquiry',
            clientName: '—',
            location: '—',
            createdDate: '—',
            agentName: '—',
            stickersUsed: 0,
            agentNotes: '',
            status: '—',
            utilizationRows: [],
            customerEmail: null,
            customerPhone: null,
            customerOwnerName: null,
            customerId: null,
            customerAddress: null,
            customerLocationLat: null,
            customerLocationLng: null,
        };
    }

    const customers = inquiry.customers || {};
    const clientName =
        customers.business_name ||
        inquiry.customer_name ||
        inquiry.client_name ||
        '—';

    const location =
        inquiry.location_address ||
        inquiry.address ||
        customers.address ||
        inquiry.location ||
        '—';

    const agentName =
        inquiry.agent_name ||
        inquiry.assigned_agent_name ||
        (inquiry.agents && (inquiry.agents.name || inquiry.agents.full_name)) ||
        inquiry.agent?.name ||
        '—';

    // Stickers actually consumed for this inquiry live in sticker_usage_history
    // (attached by the backend as `sticker_usage`), not on the inquiry row itself.
    const stickersRaw = inquiry.sticker_usage?.quantity ?? 0;

    const agentNotes =
        inquiry.agent_comments ||
        inquiry.agent_notes ||
        inquiry.notes ||
        inquiry.description ||
        '';

    const inquiryNo = inquiry.inquiry_no || inquiry.inquiryNo || String(inquiry.id || '—');

    const badgeLabel = inquiryNo.startsWith('INQ') || inquiryNo.startsWith('INQUIRY')
        ? inquiryNo
        : `Inquiry ${inquiryNo}`;

    return {
        inquiryNo,
        badgeLabel,
        clientName,
        location,
        createdDate: formatDate(inquiry.created_at || inquiry.createdAt),
        agentName,
        stickersUsed: Number(stickersRaw) || 0,
        agentNotes,
        status: inquiry.status || '—',
        utilizationRows: normalizeUtilizationRows(inquiry),
        customerEmail: customers.email || inquiry.customer_email || null,
        customerPhone: customers.phone || inquiry.customer_phone || null,
        customerOwnerName: customers.owner_name || inquiry.customer_owner_name || null,
        customerId: inquiry.customer_id || customers.id || null,
        customerAddress: customers.address || inquiry.customer_address || null,
        customerLocationLat: customers.location_lat ?? null,
        customerLocationLng: customers.location_lng ?? null,
    };
};
