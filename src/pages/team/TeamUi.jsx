import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

/** Page header matching the Admin pages: eyebrow, title, subtitle, optional actions. */
export const TeamPageHeader = ({ eyebrow, title, subtitle, back, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
            {back && (
                <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 mb-3">
                    <ArrowLeft size={15} /> Back
                </Link>
            )}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Internal Team · {eyebrow}</p>
            <h1 className="text-2xl font-display font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </div>
);

export const EmptyState = ({ icon: Icon, title, message }) => (
    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
        {Icon && <Icon size={48} className="mx-auto text-slate-200 mb-4" />}
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        {message && <p className="text-slate-500">{message}</p>}
    </div>
);

export const ErrorBanner = ({ message }) => (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
        <p className="text-sm text-red-700 font-medium">{message}</p>
    </div>
);

/** Segmented filter, same look as the Admin Agents page tabs. */
export const FilterTabs = ({ tabs, value, onChange }) => (
    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-1">
        {tabs.map((tab) => (
            <button
                key={tab.value}
                type="button"
                onClick={() => onChange(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${value === tab.value ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
            >
                {tab.label}
            </button>
        ))}
    </div>
);

/** Small label/value tile used on detail pages. */
export const InfoTile = ({ label, value }) => (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-semibold text-slate-900 break-words">{value ?? '—'}</p>
    </div>
);
