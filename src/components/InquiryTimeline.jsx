import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchInquiryEvents } from '../api/customerPortal';
import { describeInquiryEvent, formatEventDateTime } from '../constants/inquiryEvents';

/**
 * Inquiry activity timeline from the server-side event log (inquiry_events).
 * Loads when mounted — render it only where it's visible (e.g. an expanded card).
 *
 * - `fallbackEvents` ({ key, label, ts }[]) is used for older inquiries that have no
 *   logged events, or if the events request fails.
 * - Inquiries created before event logging started have no 'created' event; one is
 *   added from `createdAt` so the timeline still starts at creation.
 */
const InquiryTimeline = ({ inquiryId, createdAt, fallbackEvents = [] }) => {
    // Loaded result tagged with the inquiry it belongs to, so a changed inquiryId
    // shows the loading state until its own events arrive.
    const [loaded, setLoaded] = useState({ inquiryId: null, events: [], failed: false });

    useEffect(() => {
        if (!inquiryId) return undefined;
        let cancelled = false;
        fetchInquiryEvents(inquiryId)
            .then((rows) => {
                if (!cancelled) setLoaded({ inquiryId, events: Array.isArray(rows) ? rows : [], failed: false });
            })
            .catch(() => {
                if (!cancelled) setLoaded({ inquiryId, events: [], failed: true });
            });
        return () => {
            cancelled = true;
        };
    }, [inquiryId]);

    const { events, failed } = loaded;

    if (inquiryId && loaded.inquiryId !== inquiryId) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="animate-spin" size={16} /> Loading activity...
            </div>
        );
    }

    let entries;
    if (events.length === 0) {
        entries = fallbackEvents;
    } else {
        entries = events.map(describeInquiryEvent);
        if (!events.some((ev) => ev.event_type === 'created') && createdAt) {
            entries = [{ key: 'created', label: 'Inquiry created', detail: null, ts: createdAt }, ...entries];
        }
    }

    if (entries.length === 0) {
        return <p className="text-sm text-slate-500 italic">No activity yet.</p>;
    }

    return (
        <div className="space-y-2">
            {entries.map((ev, idx) => (
                <div key={ev.key || idx} className="flex items-start gap-3">
                    <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-primary-500 shrink-0" />
                    <div className="flex-1 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-800">{ev.label}</span>
                            {ev.detail && <p className="text-xs text-slate-500 mt-0.5">{ev.detail}</p>}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatEventDateTime(ev.ts)}</span>
                    </div>
                </div>
            ))}
            {failed && import.meta.env.DEV && (
                <p className="text-[10px] text-amber-600">Event log unavailable — showing derived timeline.</p>
            )}
        </div>
    );
};

export default InquiryTimeline;
