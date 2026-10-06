import { inquiryStatusMeta } from './inquiryStatus';

/**
 * Human-readable timeline entries for inquiry_events rows (see
 * backend/services/inquiryEvents.js for the event types the backend writes; the
 * 'created' event comes from the DB trigger on inquiries insert).
 */

const STATUS_CHANGE_LABELS = {
    accepted: 'Accepted by partner',
    rejected: 'Rejected',
    in_progress: 'Work in progress',
    completed: 'Completed',
    quoted: 'Quoted',
    pending: 'Moved back to pending',
};

const EVENT_LABELS = {
    created: 'Inquiry created',
    routed_to_admin: 'Sent to Admin for review',
    agent_assigned: 'Agent assigned',
    partner_assigned: 'Partner assigned',
    delivery_proposed: 'Pickup / delivery dates proposed',
    delivery_assigned_to_agent: 'Delivery arranged via agent',
    items_accepted: 'Items accepted by partner',
    delivery_confirmed: 'Delivery schedule confirmed',
    delivery_rejected: 'Delivery schedule rejected',
    visit_scheduled: 'Visit scheduled',
    visit_approved: 'Visit approved',
    visit_rejected: 'Visit rejected',
    quotation_sent: 'Quotation sent',
    quotation_approved: 'Quotation approved',
    quotation_rejected: 'Quotation rejected',
    quotation_updated: 'Quotation updated',
};

export const formatEventDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? '—'
        : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const statusKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_');

/** @returns {{ key: string, label: string, detail: string|null, ts: string|null }} */
export const describeInquiryEvent = (ev) => {
    const meta = ev?.metadata || {};
    const type = ev?.event_type || '';
    let label = EVENT_LABELS[type];
    const details = [];

    if (type === 'status_changed') {
        const to = statusKey(ev.to_status);
        label = STATUS_CHANGE_LABELS[to] || `Status changed to ${inquiryStatusMeta(to).label}`;
        if (meta.rejection_reason) details.push(`Reason: ${meta.rejection_reason}`);
    } else if (type === 'routed_to_admin' && meta.reason === 'agent_inactive') {
        label = 'Sent to Admin for reassignment';
        details.push('Assigned agent is no longer active');
    } else if (type === 'agent_assigned') {
        if (meta.source === 'admin_reassign_inactive') {
            label = 'Agent reassigned';
            details.push('Previous agent is no longer active');
        }
    } else if (type === 'partner_assigned') {
        if (meta.source === 'switch_partner') label = 'Partner changed';
        if (meta.reason) details.push(`Reason: ${meta.reason}`);
    } else if (type === 'visit_scheduled' || type === 'visit_approved' || type === 'visit_rejected') {
        if (meta.scheduled_date) details.push(`Visit: ${formatEventDateTime(meta.scheduled_date)}`);
    } else if (type === 'delivery_proposed' || type === 'delivery_confirmed' || type === 'delivery_rejected') {
        if (meta.pickup_date) details.push(`Pickup: ${formatEventDateTime(meta.pickup_date)}`);
        if (meta.delivery_date) details.push(`Delivery: ${formatEventDateTime(meta.delivery_date)}`);
    }

    // An action that also moved the inquiry to completed (e.g. renewal quotation approval).
    if (type !== 'status_changed' && type !== 'created' && statusKey(ev.to_status) === 'completed'
        && statusKey(ev.from_status) !== 'completed') {
        details.push('Inquiry completed');
    }

    if (!label) {
        label = type ? type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Update';
    }

    return {
        key: ev?.id || `${type}-${ev?.created_at}`,
        label,
        detail: details.length ? details.join(' · ') : null,
        ts: ev?.created_at || null,
    };
};
