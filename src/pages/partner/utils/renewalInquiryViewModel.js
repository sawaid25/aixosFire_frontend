/**
 * Maps GET /api/inquiries/:id into a stable view model for the Renewal UI.
 * A "Renewal inquiry" is a Validation or Refill inquiry made up entirely of
 * license-renewal items — detected by isRenewalOnlyInquiry() before this is
 * ever called. Mirrors validationInquiryViewModel.js's conventions.
 */

const formatDate = (value) => {
    if (value == null || value === '') return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().split('T')[0];
};

/** True iff every inquiry_items row is a license-renewal item (and there's at least one). */
export const isRenewalOnlyInquiry = (inquiry) => {
    const items = inquiry?.inquiry_items;
    if (!Array.isArray(items) || items.length === 0) return false;
    return items.every((item) => item?.validation_mode === 'license-renewal');
};

/** One row per license-renewal item — usually just one, but a visit can log more than one. */
const buildRenewalItems = (inquiry) => {
    const items = inquiry.inquiry_items;
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
        itemId: item.id,
        licenseNumber: item.license_number || null,
        licenseAuthority: item.license_authority || null,
        renewalDate: item.license_renewal_date || null,
        notes: item.license_notes || null,
        documentUrl: item.license_document_url || null,
    }));
};

/**
 * Lightweight, derived timeline — built purely from timestamps/fields already
 * on the inquiry row. There's no event-log table anywhere in the app to draw
 * from, so this deliberately doesn't claim to be a full audit trail; it's
 * "what we can tell happened" from the data that exists. The quotation leg
 * (sent/approved) is filled in by RenewalInquiryDetail once it has fetched
 * the quotation row, via the `quotation` param.
 */
const buildTimeline = (inquiry, quotation) => {
    const events = [];
    const statusKey = String(inquiry.status || '').trim().toLowerCase();

    if (inquiry.created_at) {
        events.push({ label: 'Renewal request created', date: inquiry.created_at, done: true });
    }
    if (inquiry.partner_id) {
        events.push({ label: 'Partner assigned', date: inquiry.created_at, done: true });
    }
    if (statusKey === 'accepted' || statusKey === 'quoted' || statusKey === 'completed') {
        events.push({ label: 'Renewal accepted', date: inquiry.updated_at, done: true });
    } else if (statusKey === 'rejected') {
        events.push({ label: 'Renewal rejected', date: inquiry.updated_at, done: true });
    }
    if (quotation) {
        events.push({ label: 'Quotation sent', date: quotation.created_at, done: true });
        if (quotation.status === 'approved') {
            events.push({ label: 'Customer accepted quotation', date: quotation.updated_at, done: true });
        }
    }
    if (statusKey === 'completed') {
        events.push({ label: 'Renewal completed', date: inquiry.updated_at, done: true });
    }
    return events;
};

export const buildRenewalInquiryViewModel = (inquiry, quotation = null) => {
    if (!inquiry || typeof inquiry !== 'object') {
        return {
            inquiryId: null,
            inquiryNo: '—',
            badgeLabel: 'Inquiry',
            clientName: '—',
            location: '—',
            createdDate: '—',
            agentName: '—',
            agentId: null,
            agentNotes: '',
            status: '—',
            rejectionReason: null,
            renewalItems: [],
            timeline: [],
            customerEmail: null,
            customerPhone: null,
            customerOwnerName: null,
            customerId: null,
            customerAddress: null,
            customerLocationLat: null,
            customerLocationLng: null,
            partnerId: null,
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
        inquiryId: inquiry.id ?? null,
        inquiryNo,
        badgeLabel,
        clientName,
        location,
        createdDate: formatDate(inquiry.created_at || inquiry.createdAt),
        agentName,
        agentId: inquiry.agent_id || inquiry.agents?.id || null,
        agentNotes,
        status: inquiry.status || '—',
        rejectionReason: inquiry.rejection_reason || null,
        renewalItems: buildRenewalItems(inquiry),
        timeline: buildTimeline(inquiry, quotation),
        customerEmail: customers.email || inquiry.customer_email || null,
        customerPhone: customers.phone || inquiry.customer_phone || null,
        customerOwnerName: customers.owner_name || inquiry.customer_owner_name || null,
        customerId: inquiry.customer_id || customers.id || null,
        customerAddress: customers.address || inquiry.customer_address || null,
        customerLocationLat: customers.location_lat ?? null,
        customerLocationLng: customers.location_lng ?? null,
        partnerId: inquiry.partner_id || null,
    };
};
