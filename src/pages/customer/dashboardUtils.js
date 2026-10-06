/**
 * Normalize inquiry / service / equipment rows for unified Customer service history table.
 */

import { inquiryTypeLabel } from '../../utils/productPartnerEligibility';

export const formatDateSafe = (v) => {
    if (v == null || v === '') return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const agentNameOf = (inquiry) =>
    inquiry?.agents?.name ||
    inquiry?.agent?.name ||
    inquiry?.agent_name ||
    null;

const partnerNameOf = (inquiry) =>
    inquiry?.partners?.business_name ||
    inquiry?.partner?.business_name ||
    inquiry?.partner_name ||
    null;

// Never renders raw ids — falls back to the role label when the name is unknown.
export const performedByLabel = (inquiry) => {
    const agent = agentNameOf(inquiry);
    const partner = partnerNameOf(inquiry);

    // New logic based on the explicit performed_by column
    const pb = (inquiry?.performed_by || '').toString().trim();
    if (pb === 'Agent') return agent ? `Agent: ${agent}` : 'Agent';
    if (pb === 'Assigned Partner') return partner ? `Partner: ${partner}` : 'Partner';
    if (pb === 'Customer') return 'Customer';

    // Legacy fallback logic
    if (agent && partner) return `${agent} / ${partner}`;
    if (agent) return `Agent: ${agent}`;
    if (partner) return `Partner: ${partner}`;
    return '—';
};

/**
 * "Validation - License Renewal" style label. The sub-type lives on the items, so an
 * inquiry with no items (older rows) shows its plain type rather than guessing one.
 */
export const inquiryTypeDisplay = (inquiry) => {
    const type = (inquiry?.type || inquiry?.inquiry_type || '').toString().trim();
    if (!type) return '—';
    const items = Array.isArray(inquiry?.inquiry_items) ? inquiry.inquiry_items : [];
    return items.length > 0 ? inquiryTypeLabel(type, items[0]?.validation_mode) : type;
};

/**
 * Product summary of an inquiry's first catalog-linked item, e.g.
 * { name: 'Smoke Alarm', productNo: '205 DC', catNo: 'CAT-1042', more: 1 } — null when
 * no item references a product or a CAT#.
 */
export const inquiryProductSummary = (inquiry) => {
    const items = Array.isArray(inquiry?.inquiry_items) ? inquiry.inquiry_items : [];
    const withProduct = items.filter((it) => it?.products || it?.catalog_no);
    if (withProduct.length === 0) return null;
    const first = withProduct[0];
    return {
        name: first.products?.name || first.system_type || null,
        productNo: first.products?.model_number || null,
        catNo: first.catalog_no || null,
        more: withProduct.length - 1
    };
};

/**
 * Assigned Partner for display: { name, phone, email } when assigned, otherwise a
 * status message ({ pendingLabel }) — General Inquiries wait on Admin assignment.
 */
export const assignedPartnerInfo = (inquiry) => {
    const name = partnerNameOf(inquiry);
    if (inquiry?.partner_id && name) {
        const p = inquiry.partners || inquiry.partner || {};
        return { name, phone: p.phone || null, email: p.email || null };
    }
    if (inquiry?.partner_id) return { name: 'Assigned Partner', phone: null, email: null };
    return { pendingLabel: inquiry?.is_general_inquiry ? 'Pending admin assignment' : 'Not assigned yet' };
};

export const inquiryExpiry = (inquiry) =>
    inquiry?.next_inspection_date ||
    inquiry?.expiry_date ||
    inquiry?.service_expiry ||
    null;

const toArray = (v) => {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
};

const mergePreferDefined = (target, source) => {
    if (!source || typeof source !== 'object') return target;
    Object.keys(source).forEach((k) => {
        const v = source[k];
        if (v === undefined) return;
        if (v === null || v === '') return;
        if (target[k] === undefined || target[k] === null || target[k] === '') {
            target[k] = v;
        }
    });
    return target;
};

/**
 * Customer inquiries may come back as:
 * - One row per inquiry with nested child arrays (ideal)
 * - Multiple rows duplicated at inquiry level due to joins with child/extension tables
 *
 * This normalizer groups duplicates and merges known child collections so the UI can
 * show one “main inquiry” with a nested activity section.
 */
export const normalizeCustomerInquiries = (raw) => {
    const list = Array.isArray(raw) ? raw : [];
    const map = new Map();

    const childKeys = [
        'inquiry_items',
        'inquiry_item_services',
        'extensions',
        'inquiry_extensions',
        'site_assessments',
        'inspection_reports',
        'quotations'
    ];

    for (const row of list) {
        const key = row?.id || row?.inquiry_id || row?.inquiry_no;
        if (!key) continue;

        if (!map.has(key)) {
            const base = { ...row };
            // normalize child keys to arrays
            childKeys.forEach((k) => {
                if (k in base) base[k] = toArray(base[k]);
            });
            map.set(key, base);
            continue;
        }

        const base = map.get(key);
        mergePreferDefined(base, row);
        childKeys.forEach((k) => {
            if (!(k in row)) return;
            const incoming = toArray(row[k]);
            const existing = toArray(base[k]);
            const merged = [...existing];
            incoming.forEach((x) => {
                if (!x) return;
                const id = x.id ?? x.uuid ?? null;
                if (id == null) {
                    merged.push(x);
                    return;
                }
                if (!merged.some((m) => (m?.id ?? m?.uuid) === id)) merged.push(x);
            });
            base[k] = merged;
        });

        // if API returns a flattened “child” row (common join pattern), attach it under `extensions`
        if (row?.extension_id || row?.extension_type || row?.action_type) {
            const existing = toArray(base.extensions);
            const extId = row.extension_id || row.id;
            if (!existing.some((x) => (x?.id ?? x?.extension_id) === extId)) {
                base.extensions = [...existing, row];
            }
        }
    }

    const normalized = Array.from(map.values());
    normalized.sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    return normalized;
};

export const buildHistoryRowsFromInquiry = (inquiry) => ({
    id: `inq-${inquiry.id}`,
    inquiryId: inquiry.id,
    source: 'inquiry',
    serviceType: inquiryTypeDisplay(inquiry),
    serviceDate: inquiry.created_at || inquiry.updated_at,
    expiryDate: inquiryExpiry(inquiry),
    performedBy: performedByLabel(inquiry),
    status: inquiry.status || '—',
    inquiryNo: inquiry.inquiry_no || '—',
    internalRef: inquiry.internal_reference_number || inquiry.internal_ref || '—',
    childCount:
        (Array.isArray(inquiry?.inquiry_extensions) ? inquiry.inquiry_extensions.length : 0) +
        (Array.isArray(inquiry?.extensions) ? inquiry.extensions.length : 0) +
        (Array.isArray(inquiry?.inspection_reports) ? inquiry.inspection_reports.length : 0) +
        (Array.isArray(inquiry?.site_assessments) ? inquiry.site_assessments.length : 0)
});

export const buildHistoryRowsFromService = (s) => ({
    id: `svc-${s.id}`,
    source: 'service',
    serviceType: s.service_type || 'Service',
    serviceDate: s.scheduled_date || s.created_at,
    expiryDate: s.completed_date || null,
    performedBy: s.performed_by || s.technician || '—',
    status: s.status || '—',
    inquiryNo: '—',
    internalRef: '—'
});

export const buildHistoryRowsFromExtinguisher = (e) => ({
    id: `ext-${e.id}`,
    source: 'equipment',
    serviceType: e.type ? `${e.type} (equipment)` : 'Equipment',
    serviceDate: e.install_date || e.created_at,
    expiryDate: e.expiry_date,
    performedBy: e.last_serviced_by || '—',
    status: e.condition || e.status || '—',
    inquiryNo: '—',
    internalRef: '—'
});

export const buildHistoryRowsFromInquiryItem = (item) => ({
    id: `item-${item.id}`,
    source: 'equipment',
    serviceType: item.type ? `${item.type} (equipment)` : 'Equipment',
    serviceDate: item.install_date || item.created_at || item.updated_at,
    expiryDate: item.expiry_date,
    performedBy: '—',
    status: item.condition || item.status || '—',
    inquiryNo: item.inquiry_no || '—',
    internalRef: '—'
});

const statusCanonical = (s) => (s || '').toString().trim().toLowerCase();

/**
 * Build a meaningful inquiry timeline from:
 * - inquiry header
 * - quotations list (joined by inquiry_id or inquiry_no)
 * - services list (best-effort join if inquiry_id/inquiry_no exists)
 * - inquiry extensions if present
 */
export const buildInquiryTimeline = ({ inquiry, quotations = [], services = [] }) => {
    const events = [];
    const inqId = inquiry?.id;
    const inqNo = inquiry?.inquiry_no;

    // Inquiry created
    events.push({
        key: 'created',
        label: 'Inquiry Created',
        ts: inquiry?.created_at || inquiry?.updated_at || null
    });

    // Extensions if present (try to map common fields)
    const ext = Array.isArray(inquiry?.inquiry_extensions)
        ? inquiry.inquiry_extensions
        : Array.isArray(inquiry?.extensions)
          ? inquiry.extensions
          : [];
    ext.forEach((e, idx) => {
        const raw = e?.action_type || e?.extension_type || e?.status || e?.event || 'Update';
        events.push({
            key: `ext-${e?.id ?? e?.extension_id ?? idx}`,
            label: raw,
            ts: e?.updated_at || e?.created_at || null
        });
    });

    // Site assessment (one per inquiry) and inspection reports
    toArray(inquiry?.site_assessments).forEach((sa, idx) => {
        events.push({
            key: `sa-${sa?.inquiry_id ?? idx}`,
            label: 'Site Assessment Submitted',
            ts: sa?.created_at || sa?.updated_at || null
        });
    });
    toArray(inquiry?.inspection_reports).forEach((r, idx) => {
        events.push({
            key: `ir-${r?.id ?? idx}`,
            label: r?.report_title ? `Inspection Report: ${r.report_title}` : 'Inspection Report Uploaded',
            ts: r?.created_at || r?.inspection_date || null
        });
    });

    // Quotation submitted
    const relatedQuotes = (Array.isArray(quotations) ? quotations : []).filter((q) => {
        return (inqId && q.inquiry_id === inqId) || (inqNo && (q.inquiry_no === inqNo || q.inquiry_no === inquiry?.inquiry_no));
    });
    relatedQuotes.forEach((q) => {
        events.push({
            key: `quote-${q.id}`,
            label: 'Quotation Submitted',
            ts: q.created_at || q.updated_at || null
        });
        const st = statusCanonical(q.status);
        if (st === 'approved') {
            events.push({
                key: `quote-approved-${q.id}`,
                label: 'Approved',
                ts: q.approved_at || q.updated_at || null
            });
        } else if (st === 'rejected') {
            events.push({
                key: `quote-rejected-${q.id}`,
                label: 'Rejected',
                ts: q.rejected_at || q.updated_at || null
            });
        }
    });

    // Service completed (best-effort join)
    const relatedServices = (Array.isArray(services) ? services : []).filter((s) => {
        return (inqId && s.inquiry_id === inqId) || (inqNo && s.inquiry_no === inqNo);
    });
    relatedServices.forEach((s) => {
        const st = statusCanonical(s.status);
        if (st === 'completed') {
            events.push({
                key: `svc-${s.id}`,
                label: 'Service Completed',
                ts: s.completed_date || s.updated_at || s.scheduled_date || s.created_at || null
            });
        }
    });

    // Normalize / sort
    const withTs = events.filter((e) => e.ts);
    const withoutTs = events.filter((e) => !e.ts);
    withTs.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    return [...withTs, ...withoutTs];
};
