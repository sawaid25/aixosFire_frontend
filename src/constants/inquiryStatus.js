/**
 * Inquiry lifecycle statuses as written by the backend (inquiryService /
 * maintenanceService) and the Partner UI. Stored values are lowercase with
 * underscores; older rows may carry spaces or different casing, so always
 * compare through normalizeInquiryStatus().
 */

export const normalizeInquiryStatus = (status) =>
    String(status || '').trim().toLowerCase().replace(/\s+/g, '_');

/**
 * Statuses that mean the inquiry is still open. 'active' is a legacy value
 * (still counted as open by backend partnerService's dashboard stats).
 */
export const OPEN_INQUIRY_STATUSES = ['pending', 'accepted', 'in_progress', 'quoted', 'active'];

export const isOpenInquiryStatus = (status) =>
    OPEN_INQUIRY_STATUSES.includes(normalizeInquiryStatus(status));

/** Human label + badge colours per status. */
export const INQUIRY_STATUS_META = {
    pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    accepted: { label: 'Accepted', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    in_progress: { label: 'In Progress', className: 'bg-orange-50 text-orange-700 border-orange-200' },
    quoted: { label: 'Quoted', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
    active: { label: 'Active', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const FALLBACK_CLASS = 'bg-slate-100 text-slate-700 border-slate-200';

export const inquiryStatusMeta = (status) => {
    const key = normalizeInquiryStatus(status);
    if (INQUIRY_STATUS_META[key]) return INQUIRY_STATUS_META[key];
    if (!key) return { label: '—', className: FALLBACK_CLASS };
    // Unknown value — title-case it rather than showing the raw string.
    const label = key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { label, className: FALLBACK_CLASS };
};
