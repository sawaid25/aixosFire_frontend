/**
 * Every time shown in the app is Saudi Arabia time (Asia/Riyadh, UTC+3, no daylight
 * saving), labelled "AST" — regardless of the viewer's computer timezone, so Admin,
 * Agent, Partner and Customer all see the same time for the same event.
 *
 * Browsers print this zone as "GMT+3", so the label is added here instead.
 * Mirrored on the backend in backend/services/dateTime.js for server-written messages.
 */
export const KSA_TIME_ZONE = 'Asia/Riyadh';
export const KSA_TIME_LABEL = 'AST';

const toDate = (value) => {
    if (value == null || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Date + time in Saudi time, e.g. "Oct 8, 2026, 3:45 PM AST". `options` / `locale` are
 * the usual toLocaleString ones. Returns '' for an empty or invalid value.
 */
export const formatKsaDateTime = (value, options = { dateStyle: 'medium', timeStyle: 'short' }, locale) => {
    const d = toDate(value);
    return d ? `${d.toLocaleString(locale, { ...options, timeZone: KSA_TIME_ZONE })} ${KSA_TIME_LABEL}` : '';
};

/** Time only in Saudi time, e.g. "03:45 PM AST". Returns '' for an empty or invalid value. */
export const formatKsaTime = (value, options = { hour: '2-digit', minute: '2-digit' }, locale) => {
    const d = toDate(value);
    return d ? `${d.toLocaleTimeString(locale, { ...options, timeZone: KSA_TIME_ZONE })} ${KSA_TIME_LABEL}` : '';
};

/**
 * A <input type="datetime-local"> value ("2026-10-08T15:45") read as Saudi time and
 * returned as a UTC ISO string — so a time typed into an "(AST)" field means AST even
 * when the browser's own timezone is different. Saudi Arabia has no daylight saving, so
 * the fixed +03:00 offset is exact. Returns null for an empty value.
 */
export const ksaInputToIso = (localValue) => {
    if (!localValue) return null;
    const withSeconds = localValue.length === 16 ? `${localValue}:00` : localValue;
    const d = new Date(`${withSeconds}+03:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Date only, on the Saudi calendar day (no label) — for a date shown beside a separate
 * formatKsaTime, so both always describe the same moment. Returns '' when empty/invalid.
 */
export const formatKsaDate = (value, options, locale) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString(locale, { ...(options || {}), timeZone: KSA_TIME_ZONE }) : '';
};
