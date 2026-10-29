import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, KeyRound, Mail, Phone, Building2, Clock, ShieldCheck, ShieldOff, Pencil, RotateCcw, UserPlus, Send, Ban } from 'lucide-react';
import PageLoader from '../../components/PageLoader';
import {
    getTeamMembers, approveTeamMember, rejectTeamMember, updateTeamMemberAccess, setTeamMemberStatus,
    getTeamInvitations, inviteTeamMember, resendTeamInvitation, revokeTeamInvitation,
} from '../../api/admin';
import { TEAM_MODULES, TEAM_ACTION_LABELS, TEAM_ACTION_HINTS, TEAM_STATUS } from '../../constants/teamPermissions';
import { formatKsaDateTime } from '../../utils/dateTime';

const TABS = [
    { value: TEAM_STATUS.PENDING, label: 'Pending' },
    { value: TEAM_STATUS.APPROVED, label: 'Active' },
    { value: TEAM_STATUS.DEACTIVATED, label: 'Deactivated' },
    { value: TEAM_STATUS.REJECTED, label: 'Rejected' },
];

const INVITATIONS_TAB = 'invitations';

const INVITE_BADGE = {
    pending: ['Invited', 'bg-amber-100 text-amber-700'],
    expired: ['Expired', 'bg-slate-200 text-slate-700'],
    used: ['Registered', 'bg-green-100 text-green-700'],
    revoked: ['Revoked', 'bg-red-100 text-red-700'],
};

const STATUS_BADGE = {
    [TEAM_STATUS.PENDING]: ['Pending', 'bg-amber-100 text-amber-700'],
    [TEAM_STATUS.APPROVED]: ['Active', 'bg-green-100 text-green-700'],
    [TEAM_STATUS.DEACTIVATED]: ['Deactivated', 'bg-slate-200 text-slate-700'],
    [TEAM_STATUS.REJECTED]: ['Rejected', 'bg-red-100 text-red-700'],
};

const errorText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;
const moduleLabel = (key) => TEAM_MODULES.find((m) => m.key === key)?.label || key;

const ModalShell = ({ title, subtitle, onClose, children }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                    {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl" aria-label="Close"><X size={18} /></button>
            </div>
            {children}
        </div>
    </div>
);

/** Designation + page/action matrix, used for approving and for editing access later. */
const AccessModal = ({ member, mode, onClose, onSaved }) => {
    const [designation, setDesignation] = useState(member.designation || '');
    const [permissions, setPermissions] = useState(() => ({ ...(member.permissions || {}) }));
    const [saving, setSaving] = useState(false);

    const has = (module, action) => (permissions[module] || []).includes(action);
    const toggle = (module, action) => {
        setPermissions((prev) => {
            const current = new Set(prev[module] || []);
            if (current.has(action)) {
                // Removing View removes the whole page.
                if (action === 'view') current.clear(); else current.delete(action);
            } else {
                current.add(action);
                current.add('view'); // any action needs the page itself
            }
            const next = { ...prev };
            if (current.size) next[module] = [...current]; else delete next[module];
            return next;
        });
    };

    const pageCount = Object.keys(permissions).length;

    const save = async () => {
        if (!designation.trim()) { toast.error('Enter a designation.'); return; }
        if (pageCount === 0) { toast.error('Grant access to at least one page.'); return; }
        setSaving(true);
        try {
            const access = { designation: designation.trim(), permissions };
            if (mode === 'approve') await approveTeamMember(member.id, access);
            else await updateTeamMemberAccess(member.id, access);
            toast.success(mode === 'approve' ? `${member.name} approved.` : `Access updated for ${member.name}.`);
            onSaved();
        } catch (err) {
            toast.error(errorText(err, 'Failed to save access.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell
            title={mode === 'approve' ? 'Approve access request' : 'Edit access'}
            subtitle={`${member.name} · ${member.email}`}
            onClose={onClose}
        >
            <div className="p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                    <input className="input-field" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Operations Coordinator" />
                </div>

                <div>
                    <div className="flex items-end justify-between mb-2">
                        <p className="text-sm font-medium text-slate-700">Page access</p>
                        <p className="text-xs text-slate-500">{pageCount} page{pageCount === 1 ? '' : 's'} selected</p>
                    </div>
                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100">
                        {TEAM_MODULES.map((m) => (
                            <div key={m.key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <m.icon size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900">{m.label}</p>
                                        <p className="text-xs text-slate-500">{m.description}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 sm:justify-end">
                                    {m.actions.map((a) => (
                                        <label
                                            key={a}
                                            title={TEAM_ACTION_HINTS[`${m.key}.${a}`] || ''}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-colors ${has(m.key, a) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                                        >
                                            <input type="checkbox" className="sr-only" checked={has(m.key, a)} onChange={() => toggle(m.key, a)} />
                                            {has(m.key, a) && <Check size={12} />}
                                            {TEAM_ACTION_LABELS[a]}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        View opens the page read-only. Edit (Agents) changes agent status; Assign (Inquiries) assigns an active agent to customer requests; Reply (Complaints) lets them answer complaints under their own name. Every permission is enforced by the server.
                    </p>
                </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-outline py-2.5">Cancel</button>
                <button type="button" onClick={save} disabled={saving} className="btn-primary py-2.5 disabled:opacity-60">
                    {saving ? 'Saving...' : mode === 'approve' ? 'Approve & grant access' : 'Save changes'}
                </button>
            </div>
        </ModalShell>
    );
};

const RejectModal = ({ member, onClose, onSaved }) => {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const reject = async () => {
        setSaving(true);
        try {
            await rejectTeamMember(member.id, reason);
            toast.success(`Request from ${member.name} rejected.`);
            onSaved();
        } catch (err) {
            toast.error(errorText(err, 'Failed to reject request.'));
        } finally {
            setSaving(false);
        }
    };
    return (
        <ModalShell title="Reject access request" subtitle={`${member.name} · ${member.email}`} onClose={onClose}>
            <div className="p-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason <span className="text-slate-400 font-normal">(optional, internal)</span></label>
                <textarea rows={3} className="input-field resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not part of the operations team" />
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-outline py-2.5">Cancel</button>
                <button type="button" onClick={reject} disabled={saving} className="btn-primary py-2.5 bg-red-600 hover:bg-red-700 shadow-none disabled:opacity-60">
                    {saving ? 'Rejecting...' : 'Reject request'}
                </button>
            </div>
        </ModalShell>
    );
};

/** Admin enters an email; the backend emails a one-time registration link. */
const InviteModal = ({ onClose, onSent }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    const send = async (e) => {
        e.preventDefault();
        const value = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError('Enter a valid email address.'); return; }
        setSending(true);
        setError('');
        try {
            await inviteTeamMember(value);
            toast.success(`Invitation sent to ${value}.`);
            onSent();
        } catch (err) {
            setError(errorText(err, 'Failed to send invitation.'));
        } finally {
            setSending(false);
        }
    };

    return (
        <ModalShell title="Invite team member" subtitle="They'll get an email with a link to register." onClose={onClose}>
            <form onSubmit={send}>
                <div className="p-6 space-y-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                    <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input type="email" autoFocus required className="input-field pl-11" placeholder="name@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
                    </div>
                    {error && <p className="text-sm text-red-700 font-medium">{error}</p>}
                    <p className="text-xs text-slate-500">The link works once and expires in 72 hours. After they register, approve them here and choose their pages.</p>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="btn-outline py-2.5">Cancel</button>
                    <button type="submit" disabled={sending} className="btn-primary py-2.5 disabled:opacity-60 inline-flex items-center gap-2">
                        <Send size={15} /> {sending ? 'Sending...' : 'Send Invitation'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};

const InvitationList = ({ invitations, onChanged }) => {
    const [busyId, setBusyId] = useState(null);

    const act = async (inv, action) => {
        if (action === 'revoke' && !window.confirm(`Revoke the invitation for ${inv.email}? The link will stop working.`)) return;
        setBusyId(inv.id);
        try {
            if (action === 'resend') {
                await resendTeamInvitation(inv.id);
                toast.success(`New invitation sent to ${inv.email}. The previous link no longer works.`);
            } else {
                await revokeTeamInvitation(inv.id);
                toast.success(`Invitation for ${inv.email} revoked.`);
            }
            onChanged();
        } catch (err) {
            toast.error(errorText(err, `Failed to ${action} invitation.`));
        } finally {
            setBusyId(null);
        }
    };

    if (invitations.length === 0) {
        return (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                <UserPlus size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-xl font-bold text-slate-900">No invitations yet</h3>
                <p className="text-slate-500">Use Invite Team Member to send someone a registration link.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl shadow-soft border border-slate-100 divide-y divide-slate-100">
            {invitations.map((inv) => {
                const [label, badge] = INVITE_BADGE[inv.status] || ['Unknown', 'bg-slate-100 text-slate-600'];
                const open = inv.status === 'pending' || inv.status === 'expired';
                return (
                    <div key={inv.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-slate-900 truncate">{inv.email}</p>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badge}`}>{label}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Sent {formatKsaDateTime(inv.sent_at)}{inv.send_count > 1 ? ` · ${inv.send_count} times` : ''}
                                {inv.status === 'pending' && ` · expires ${formatKsaDateTime(inv.expires_at)}`}
                                {inv.status === 'used' && inv.used_at && ` · registered ${formatKsaDateTime(inv.used_at)}`}
                                {inv.status === 'revoked' && inv.revoked_at && ` · revoked ${formatKsaDateTime(inv.revoked_at)}`}
                            </p>
                        </div>
                        {open && (
                            <div className="flex gap-2 flex-shrink-0">
                                <button type="button" disabled={busyId === inv.id} onClick={() => act(inv, 'resend')} className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm flex items-center gap-2 transition-all disabled:opacity-50">
                                    <RotateCcw size={15} /> Resend
                                </button>
                                <button type="button" disabled={busyId === inv.id} onClick={() => act(inv, 'revoke')} className="py-2 px-4 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl text-slate-600 font-medium text-sm flex items-center gap-2 transition-all disabled:opacity-50">
                                    <Ban size={15} /> Revoke
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const AccessRequests = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(TEAM_STATUS.PENDING);
    const [modal, setModal] = useState(null); // { type: 'approve' | 'edit' | 'reject', member } | { type: 'invite' }
    const [invitations, setInvitations] = useState([]);

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        try {
            const [memberRows, inviteRows] = await Promise.all([getTeamMembers(), getTeamInvitations()]);
            setMembers(memberRows);
            setInvitations(inviteRows);
        } catch (err) {
            toast.error(errorText(err, 'Failed to load access requests.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);

    const counts = useMemo(() => ({
        ...members.reduce((acc, m) => ({ ...acc, [m.status]: (acc[m.status] || 0) + 1 }), {}),
        [INVITATIONS_TAB]: invitations.filter((i) => i.status === 'pending').length,
    }), [members, invitations]);
    const visible = members.filter((m) => m.status === activeTab);

    const changeStatus = async (member, status) => {
        const verb = status === TEAM_STATUS.DEACTIVATED ? 'deactivate' : 'reactivate';
        if (!window.confirm(`Are you sure you want to ${verb} ${member.name}? ${status === TEAM_STATUS.DEACTIVATED ? 'They will lose access immediately.' : 'They will regain their assigned pages.'}`)) return;
        try {
            await setTeamMemberStatus(member.id, status);
            toast.success(`${member.name} ${status === TEAM_STATUS.DEACTIVATED ? 'deactivated' : 'reactivated'}.`);
            fetchMembers();
        } catch (err) {
            toast.error(errorText(err, 'Failed to update member.'));
        }
    };

    const closeAndRefresh = () => { setModal(null); fetchMembers(); };

    return (
        <div className="relative min-h-[400px] space-y-6">
            {loading && <PageLoader message="Loading access requests..." />}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admin · Management</p>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Access Requests</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Invite internal team members, approve them and choose which pages they can use.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button type="button" onClick={() => setModal({ type: 'invite' })} className="btn-primary py-2.5 px-5 text-sm inline-flex items-center justify-center gap-2">
                    <UserPlus size={16} /> Invite Team Member
                </button>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-1">
                    {[...TABS, { value: INVITATIONS_TAB, label: 'Invitations' }].map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.value ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            {tab.label}{counts[tab.value] ? ` (${counts[tab.value]})` : ''}
                        </button>
                    ))}
                </div>
                </div>
            </div>

            {activeTab === INVITATIONS_TAB ? (
                !loading && <InvitationList invitations={invitations} onChanged={fetchMembers} />
            ) : !loading && visible.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft">
                    <KeyRound size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-xl font-bold text-slate-900">No {TABS.find((t) => t.value === activeTab)?.label.toLowerCase()} members</h3>
                    <p className="text-slate-500">{activeTab === TEAM_STATUS.PENDING ? 'People you invite appear here after they complete registration.' : 'There is no one in this category.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {visible.map((m) => {
                        const [label, badge] = STATUS_BADGE[m.status] || ['Unknown', 'bg-slate-100 text-slate-600'];
                        const pages = Object.entries(m.permissions || {});
                        return (
                            <div key={m.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex flex-col md:flex-row gap-6">
                                <div className="flex-1 min-w-0 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-bold text-slate-900 truncate">{m.name}</h3>
                                            {m.designation && <p className="text-sm font-medium text-slate-600">{m.designation}</p>}
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${badge}`}>{label}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600">
                                        <span className="flex items-center gap-2 min-w-0"><Mail size={15} className="text-slate-400 flex-shrink-0" /><span className="truncate">{m.email}</span></span>
                                        <span className="flex items-center gap-2"><Phone size={15} className="text-slate-400" />{m.phone || 'N/A'}</span>
                                        <span className="flex items-center gap-2"><Building2 size={15} className="text-slate-400" />{m.department || 'No department given'}</span>
                                        <span className="flex items-center gap-2"><Clock size={15} className="text-slate-400" />Requested {formatKsaDateTime(m.created_at)}</span>
                                    </div>
                                    {m.request_note && (
                                        <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                            <span className="font-bold text-slate-900">Request: </span>{m.request_note}
                                        </p>
                                    )}
                                    {pages.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {pages.map(([key, actions]) => (
                                                <span key={key} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                    {moduleLabel(key)} · {actions.map((a) => TEAM_ACTION_LABELS[a] || a).join(', ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {m.status === TEAM_STATUS.REJECTED && m.rejection_reason && (
                                        <p className="text-sm text-red-700"><span className="font-bold">Reason: </span>{m.rejection_reason}</p>
                                    )}
                                    {(m.reviewed_at || m.last_login_at) && (
                                        <p className="text-xs text-slate-400">
                                            {m.reviewed_at && `Reviewed ${formatKsaDateTime(m.reviewed_at)}`}
                                            {m.reviewed_at && m.last_login_at && ' · '}
                                            {m.last_login_at && `Last sign-in ${formatKsaDateTime(m.last_login_at)}`}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-row flex-wrap md:flex-col gap-2 md:w-44">
                                    {(m.status === TEAM_STATUS.PENDING || m.status === TEAM_STATUS.REJECTED) && (
                                        <button type="button" onClick={() => setModal({ type: 'approve', member: m })} className="btn-primary py-2 px-4 shadow-none bg-green-600 hover:bg-green-700 text-sm flex items-center justify-center gap-2">
                                            <Check size={16} /> Approve
                                        </button>
                                    )}
                                    {m.status === TEAM_STATUS.PENDING && (
                                        <button type="button" onClick={() => setModal({ type: 'reject', member: m })} className="py-2 px-4 border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl text-slate-600 font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                            <X size={16} /> Reject
                                        </button>
                                    )}
                                    {(m.status === TEAM_STATUS.APPROVED || m.status === TEAM_STATUS.DEACTIVATED) && (
                                        <button type="button" onClick={() => setModal({ type: 'edit', member: m })} className="py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                            <Pencil size={15} /> Edit access
                                        </button>
                                    )}
                                    {m.status === TEAM_STATUS.APPROVED && (
                                        <button type="button" onClick={() => changeStatus(m, TEAM_STATUS.DEACTIVATED)} className="py-2 px-4 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                            <ShieldOff size={15} /> Deactivate
                                        </button>
                                    )}
                                    {m.status === TEAM_STATUS.DEACTIVATED && (
                                        <button type="button" onClick={() => changeStatus(m, TEAM_STATUS.APPROVED)} className="py-2 px-4 border border-green-200 bg-green-50 hover:bg-green-100 text-green-800 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all">
                                            <RotateCcw size={15} /> Reactivate
                                        </button>
                                    )}
                                    {m.status === TEAM_STATUS.APPROVED && (
                                        <span className="hidden md:flex items-center justify-center gap-1.5 text-xs text-green-700 font-bold pt-1"><ShieldCheck size={14} /> Can sign in</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal?.type === 'approve' && <AccessModal member={modal.member} mode="approve" onClose={() => setModal(null)} onSaved={closeAndRefresh} />}
            {modal?.type === 'edit' && <AccessModal member={modal.member} mode="edit" onClose={() => setModal(null)} onSaved={closeAndRefresh} />}
            {modal?.type === 'reject' && <RejectModal member={modal.member} onClose={() => setModal(null)} onSaved={closeAndRefresh} />}
            {modal?.type === 'invite' && <InviteModal onClose={() => setModal(null)} onSent={() => { setActiveTab(INVITATIONS_TAB); closeAndRefresh(); }} />}
        </div>
    );
};

export default AccessRequests;
