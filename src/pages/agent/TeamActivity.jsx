import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { API_URL } from '../../api/client';
import {
    Users, Star, Eye, EyeOff, AlertTriangle, CheckCircle,
    Lock, Activity, Clock, Mail, User
} from 'lucide-react';

/* ─── Date helpers ─────────────────────────────── */
const startOfDay   = (d = new Date()) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const startOfWeek  = (d = new Date()) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

const getBadgeClass = (s) => {
    const v = (s || '').toLowerCase();
    if (['completed','accepted','closed'].includes(v)) return 'bg-green-100 text-green-700';
    if (['rejected','cancelled'].includes(v))          return 'bg-red-100 text-red-700';
    if (['in progress','scheduled'].includes(v))       return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700';
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;

/* ══════════════════════════════════════════════════
   NOT-ACTIVATED SCREEN
══════════════════════════════════════════════════ */
const NotActivatedScreen = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-8 max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
                <Mail size={22} className="text-amber-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Account Not Activated</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
                Your Senior Agent account has not been activated yet. Please check your email
                and click the activation link to create your 6-digit PIN.
            </p>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-700 font-medium">
                    If you did not receive the email, contact your admin to resend the activation link.
                </p>
            </div>
        </div>
    </div>
);

/* ══════════════════════════════════════════════════
   PIN GATE
══════════════════════════════════════════════════ */
const PinGate = ({ onSuccess }) => {
    const [pin, setPin]           = useState(['', '', '', '', '', '']);
    const [error, setError]       = useState('');
    const [attempts, setAttempts] = useState(() => {
        const s = sessionStorage.getItem('sa_pin_attempts');
        return s ? parseInt(s, 10) : 0;
    });
    const [lockedUntil, setLockedUntil] = useState(() => {
        const s = sessionStorage.getItem('sa_pin_locked_until');
        return s ? parseInt(s, 10) : 0;
    });
    const [checking, setChecking] = useState(false);
    const [showPin, setShowPin]   = useState(false);
    const [forgotState, setForgotState] = useState('idle'); // idle | sending | sent | error
    const [forgotError, setForgotError] = useState('');
    const refs                    = useRef([]);

    const isLocked  = Date.now() < lockedUntil;
    const remaining = Math.ceil((lockedUntil - Date.now()) / 60000);

    const handleForgotPin = async () => {
        if (forgotState === 'sending') return;
        setForgotState('sending');
        setForgotError('');
        try {
            const res  = await fetch(`${API_URL}/auth/forgot-senior-agent-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            const data = await res.json();
            if (!res.ok) {
                setForgotState('error');
                setForgotError(data.error || 'Failed to send reset email.');
                return;
            }
            setForgotState('sent');
        } catch {
            setForgotState('error');
            setForgotError('Network error. Please try again.');
        }
    };

    const handleInput = (val, idx) => {
        if (!/^\d*$/.test(val)) return;
        setPin(prev => { const next = [...prev]; next[idx] = val.slice(-1); return next; });
        if (val && idx < 5) refs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === 'Backspace') {
            setPin(prev => {
                const next = [...prev];
                if (next[idx]) { next[idx] = ''; return next; }
                if (idx > 0) { refs.current[idx - 1]?.focus(); next[idx - 1] = ''; return next; }
                return next;
            });
        }
    };

    const handleVerify = async () => {
        if (isLocked || checking) return;
        const pinStr = pin.join('');
        if (pinStr.length !== 6) { setError('Please enter all 6 digits.'); return; }

        setChecking(true);
        setError('');
        try {
            const res  = await fetch(`${API_URL}/auth/verify-senior-agent-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ pin: pinStr }),
            });
            const data = await res.json();

            if (data.success) {
                sessionStorage.setItem('sa_pin_verified', 'true');
                sessionStorage.removeItem('sa_pin_attempts');
                sessionStorage.removeItem('sa_pin_locked_until');
                onSuccess();
                return;
            }

            // Don't count "not activated" or "PIN not set" as a wrong-PIN attempt
            const isAccountError = res.status === 403;
            if (isAccountError) {
                setError(data.error || 'Account not fully activated.');
                return;
            }

            const newAttempts = attempts + 1;
            sessionStorage.setItem('sa_pin_attempts', String(newAttempts));
            setAttempts(newAttempts);

            if (newAttempts >= MAX_ATTEMPTS) {
                const until = Date.now() + LOCKOUT_MS;
                sessionStorage.setItem('sa_pin_locked_until', String(until));
                setLockedUntil(until);
                setError('Too many failed attempts. Try again in 15 minutes.');
            } else {
                setError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
            }
            setPin(['', '', '', '', '', '']);
            setTimeout(() => refs.current[0]?.focus(), 50);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    if (forgotState === 'sent') return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-8 max-w-sm w-full text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                    <Mail size={22} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Check Your Email</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                    We've sent a PIN reset link to your registered email. Click it to set a new 6-digit PIN,
                    then come back here to unlock Team Activity.
                </p>
                <button
                    onClick={() => setForgotState('idle')}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                    ← Back to PIN entry
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 p-8 max-w-sm w-full">
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Lock size={22} className="text-amber-600" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Enter Your PIN</h2>
                    <p className="text-sm text-slate-500 mt-1">Enter your 6-digit Senior Agent PIN to continue.</p>
                </div>

                {isLocked ? (
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                        <AlertTriangle size={18} className="text-red-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-red-700">Account temporarily locked</p>
                        <p className="text-xs text-red-500 mt-1">Try again in {remaining} minute{remaining !== 1 ? 's' : ''}</p>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-2.5 justify-center mb-4">
                            {pin.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => refs.current[i] = el}
                                    type={showPin ? 'text' : 'password'}
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleInput(e.target.value, i)}
                                    onKeyDown={e => handleKeyDown(e, i)}
                                    autoFocus={i === 0}
                                    className="w-11 h-12 text-center text-xl font-black border-2 rounded-xl outline-none transition-all bg-slate-50 focus:bg-white focus:border-primary-500 text-slate-900"
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowPin(p => !p)}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mx-auto mb-4 transition-colors"
                        >
                            {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
                            {showPin ? 'Hide' : 'Show'} digits
                        </button>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl mb-4">
                                <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                                <p className="text-xs text-red-600 font-semibold">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={checking || pin.join('').length !== 6}
                            className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl shadow-lg shadow-primary-500/30 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {checking
                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <><CheckCircle size={16} /> Unlock Team Activity</>
                            }
                        </button>

                        {forgotError && (
                            <p className="text-xs text-red-500 font-semibold text-center mt-3">{forgotError}</p>
                        )}
                        <button
                            type="button"
                            onClick={handleForgotPin}
                            disabled={forgotState === 'sending'}
                            className="w-full text-center text-xs font-bold text-slate-400 hover:text-primary-600 mt-4 transition-colors disabled:opacity-60"
                        >
                            {forgotState === 'sending' ? 'Sending reset link…' : 'Forgot PIN?'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════
   PERIOD FILTER
══════════════════════════════════════════════════ */
const PERIODS = [
    { key: 'all',   label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
];

const getPeriodBounds = (key) => {
    const now = new Date();
    if (key === 'today') return { start: startOfDay(now),   end: now };
    if (key === 'week')  return { start: startOfWeek(now),  end: now };
    if (key === 'month') return { start: startOfMonth(now), end: now };
    return null;
};

/* ══════════════════════════════════════════════════
   TEAM ACTIVITY (main page)
══════════════════════════════════════════════════ */
const TeamActivity = () => {
    const { user } = useAuth();

    // Activation & verification state
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isActivated, setIsActivated]       = useState(false);
    const [verified, setVerified]             = useState(() => sessionStorage.getItem('sa_pin_verified') === 'true');

    // Team data
    const [team, setTeam]           = useState([]);
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading]     = useState(false);
    const [period, setPeriod]       = useState('all');

    // Step 1: Always check activation status first (even if PIN was previously verified)
    useEffect(() => {
        if (!user?.id) return;
        const checkActivation = async () => {
            setCheckingStatus(true);
            const { data } = await supabase
                .from('senior_agents')
                .select('id, is_activated')
                .eq('agent_id', user.id)
                .maybeSingle();

            const activated = !!(data?.is_activated);
            setIsActivated(activated);

            // If somehow session says verified but DB says not activated, clear it
            if (!activated) {
                sessionStorage.removeItem('sa_pin_verified');
                setVerified(false);
            }
            setCheckingStatus(false);
        };
        checkActivation();
    }, [user?.id]);

    // Step 2: Load team once PIN is verified
    useEffect(() => {
        if (!verified || !isActivated) return;
        loadTeam();
    }, [verified, isActivated, user?.id]);

    const loadTeam = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const { data: saRow } = await supabase
                .from('senior_agents')
                .select('id')
                .eq('agent_id', user.id)
                .eq('is_activated', true)
                .maybeSingle();

            if (!saRow) { setTeam([]); setLoading(false); return; }

            const { data: members } = await supabase
                .from('senior_agent_teams')
                .select('agents(id, name, email, status, profile_photo, territory)')
                .eq('senior_agent_id', saRow.id);

            const agents = (members || []).map(m => m.agents).filter(Boolean);
            setTeam(agents);

            if (agents.length > 0) {
                const ids = agents.map(a => a.id);
                const { data: inqData } = await supabase
                    .from('inquiries')
                    .select('id, agent_id, status, created_at, updated_at')
                    .in('agent_id', ids)
                    .order('created_at', { ascending: false });
                setInquiries(inqData || []);
            }
        } finally {
            setLoading(false);
        }
    };

    // Compute per-agent stats
    const agentStats = useMemo(() => {
        const now        = new Date();
        const todayStart = startOfDay(now);
        const weekStart  = startOfWeek(now);
        const monthStart = startOfMonth(now);
        const bounds     = getPeriodBounds(period);

        const map = {};
        team.forEach(a => { map[a.id] = { total: 0, today: 0, week: 0, month: 0, lastActive: null, periodCount: 0 }; });

        inquiries.forEach(inq => {
            const s = map[inq.agent_id];
            if (!s) return;
            const d = new Date(inq.created_at);
            s.total++;
            if (d >= todayStart)  s.today++;
            if (d >= weekStart)   s.week++;
            if (d >= monthStart)  s.month++;
            if (bounds && d >= bounds.start && d <= bounds.end) s.periodCount++;
            const upd = new Date(inq.updated_at || inq.created_at);
            if (!s.lastActive || upd > s.lastActive) s.lastActive = upd;
        });

        return map;
    }, [team, inquiries, period]);

    const teamTotals = useMemo(() => {
        const vals = Object.values(agentStats);
        return {
            total: vals.reduce((s, v) => s + v.total, 0),
            today: vals.reduce((s, v) => s + v.today, 0),
            week:  vals.reduce((s, v) => s + v.week,  0),
            month: vals.reduce((s, v) => s + v.month, 0),
        };
    }, [agentStats]);

    // ── Checking activation status
    if (checkingStatus) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // ── Not activated yet
    if (!isActivated) return <NotActivatedScreen />;

    // ── PIN gate
    if (!verified) return <PinGate onSuccess={() => setVerified(true)} />;

    // ── Loading team data
    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-amber-100 rounded-lg"><Star size={16} className="text-amber-600" /></div>
                        <h2 className="text-2xl font-black text-slate-900">Team Activity</h2>
                    </div>
                    <p className="text-slate-500 text-sm">{team.length} assigned agent{team.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                    onClick={() => { sessionStorage.removeItem('sa_pin_verified'); setVerified(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-slate-200"
                >
                    <Lock size={13} /> Lock
                </button>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'All Time',   value: teamTotals.total, key: 'all',   accent: 'slate' },
                    { label: 'Today',      value: teamTotals.today, key: 'today', accent: 'blue' },
                    { label: 'This Week',  value: teamTotals.week,  key: 'week',  accent: 'violet' },
                    { label: 'This Month', value: teamTotals.month, key: 'month', accent: 'emerald' },
                ].map(({ label, value, key, accent }) => {
                    const active = period === key;
                    const colors = {
                        slate:   { border: active ? 'border-slate-800'   : 'border-slate-100', text: 'text-slate-900',   sub: 'text-slate-400'   },
                        blue:    { border: active ? 'border-blue-500'    : 'border-slate-100', text: 'text-blue-700',    sub: 'text-blue-400'    },
                        violet:  { border: active ? 'border-violet-500'  : 'border-slate-100', text: 'text-violet-700',  sub: 'text-violet-400'  },
                        emerald: { border: active ? 'border-emerald-500' : 'border-slate-100', text: 'text-emerald-700', sub: 'text-emerald-400' },
                    }[accent];
                    return (
                        <button key={key} onClick={() => setPeriod(key)}
                            className={`bg-white rounded-2xl border-2 p-4 text-left shadow-soft hover:shadow-md transition-all ${colors.border}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${colors.sub}`}>{label}</p>
                            <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{value}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Team Inquiries</p>
                        </button>
                    );
                })}
            </div>

            {/* Period filter tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
                {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${period === p.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Team grid */}
            {team.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-12 text-center">
                    <Users size={36} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">No team members assigned yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Contact your admin to assign agents to your team.</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {team.map(agent => {
                        const stats  = agentStats[agent.id] || {};
                        const lastAt = stats.lastActive;
                        return (
                            <div key={agent.id} className="bg-white rounded-3xl border border-slate-100 shadow-soft hover:shadow-md transition-shadow overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-11 h-11 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                                            {agent.profile_photo
                                                ? <img src={agent.profile_photo} alt={agent.name} className="w-full h-full object-cover" />
                                                : <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={18} /></div>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{agent.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{agent.email}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${getBadgeClass(agent.status)}`}>
                                            {agent.status || 'Active'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                        {[
                                            { label: 'Total', value: stats.total || 0, accent: 'text-slate-800' },
                                            { label: 'Today', value: stats.today || 0, accent: 'text-blue-600' },
                                            { label: 'Week',  value: stats.week  || 0, accent: 'text-violet-600' },
                                            { label: 'Month', value: stats.month || 0, accent: 'text-emerald-600' },
                                        ].map(({ label, value, accent }) => (
                                            <div key={label} className="bg-slate-50 rounded-xl p-2 text-center">
                                                <p className={`text-base font-black ${accent}`}>{value}</p>
                                                <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                                        <Clock size={11} />
                                        <span>
                                            {lastAt ? `Last active ${lastAt.toLocaleString()}` : 'No recent activity'}
                                        </span>
                                    </div>

                                    <Link
                                        to={`/agent/team/${agent.id}`}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-2xl transition-colors"
                                    >
                                        <Activity size={13} /> View Activity
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TeamActivity;
