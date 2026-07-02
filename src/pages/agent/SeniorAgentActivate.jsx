import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API_URL } from '../../api/client';
import { Shield, Star, CheckCircle, AlertTriangle, Eye, EyeOff, Lock } from 'lucide-react';

const SeniorAgentActivate = () => {
    const [searchParams]        = useSearchParams();
    const token                  = searchParams.get('token');

    const [step, setStep]        = useState('verifying'); // verifying | form | success | error
    const [agentName, setAgentName] = useState('');
    const [errorMsg, setErrorMsg]  = useState('');
    const [pin, setPin]            = useState(['', '', '', '', '', '']);
    const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
    const [showPin, setShowPin]    = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [validationError, setValidationError] = useState('');
    const pinRefs                  = useRef([]);
    const confirmRefs              = useRef([]);

    // Step 1: verify token on mount
    useEffect(() => {
        if (!token) { setStep('error'); setErrorMsg('No activation token found in URL.'); return; }

        const verify = async () => {
            try {
                const res  = await fetch(`${API_URL}/auth/verify-senior-agent-token?token=${encodeURIComponent(token)}`);
                const data = await res.json();
                if (!res.ok) { setStep('error'); setErrorMsg(data.error || 'Invalid or expired link.'); return; }
                if (data.alreadyActivated) { setStep('error'); setErrorMsg('This account is already activated. Please log in normally.'); return; }
                setAgentName(data.agentName);
                setStep('form');
            } catch {
                setStep('error');
                setErrorMsg('Network error. Please try again later.');
            }
        };
        verify();
    }, [token]);

    const handlePinInput = (value, idx, refs, setter) => {
        if (!/^\d*$/.test(value)) return;
        setter(prev => {
            const next = [...prev];
            next[idx] = value.slice(-1);
            return next;
        });
        if (value && idx < 5) refs.current[idx + 1]?.focus();
    };

    const handlePinKeyDown = (e, idx, refs, setter) => {
        if (e.key === 'Backspace') {
            setter(prev => {
                const next = [...prev];
                if (next[idx]) { next[idx] = ''; return next; }
                if (idx > 0) { refs.current[idx - 1]?.focus(); next[idx - 1] = ''; return next; }
                return next;
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');
        const pinStr     = pin.join('');
        const confirmStr = confirmPin.join('');
        if (pinStr.length !== 6)     { setValidationError('Please enter all 6 digits.'); return; }
        if (pinStr !== confirmStr)   { setValidationError('PINs do not match.'); return; }

        setSubmitting(true);
        try {
            const res  = await fetch(`${API_URL}/auth/set-senior-agent-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, pin: pinStr }),
            });
            const data = await res.json();
            if (!res.ok) { setValidationError(data.error || 'Failed to set PIN.'); return; }
            setStep('success');
        } catch {
            setValidationError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const PinBoxes = ({ value, onChange, onKeyDown, refs, label }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div className="flex gap-3 justify-center">
                {value.map((digit, i) => (
                    <input
                        key={i}
                        ref={el => refs.current[i] = el}
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => onChange(e.target.value, i)}
                        onKeyDown={e => onKeyDown(e, i)}
                        className="w-12 h-12 text-center text-xl font-black border-2 rounded-2xl outline-none transition-all bg-slate-50 focus:bg-white focus:border-primary-500 text-slate-900"
                    />
                ))}
            </div>
        </div>
    );

    // ── Verifying
    if (step === 'verifying') return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="text-center space-y-3">
                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-500 text-sm font-medium">Verifying your activation link…</p>
            </div>
        </div>
    );

    // ── Error
    if (step === 'error') return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-xl p-8 max-w-sm w-full text-center space-y-4">
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                    <AlertTriangle size={24} className="text-red-500" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Activation Failed</h2>
                <p className="text-slate-500 text-sm">{errorMsg}</p>
                <Link to="/login/agent" className="inline-block mt-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl text-sm hover:bg-slate-700 transition-colors">
                    Back to Login
                </Link>
            </div>
        </div>
    );

    // ── Success
    if (step === 'success') return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-xl p-8 max-w-sm w-full text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle size={28} className="text-green-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900">You're All Set!</h2>
                    <p className="text-amber-600 font-bold text-sm mt-1">Senior Agent Account Activated</p>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">
                    Your 6-digit PIN has been saved securely. Log in to your agent account and visit <strong>Team Activity</strong> to manage your team.
                </p>
                <Link to="/login/agent" className="block mt-4 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl text-sm shadow-lg shadow-primary-500/30 transition-colors">
                    Go to Login
                </Link>
            </div>
        </div>
    );

    // ── PIN creation form
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Branding */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="p-2 bg-primary-500 rounded-xl shadow-lg shadow-primary-500/30">
                            <Shield size={22} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">AiXOS Red<span className="text-primary-500">.</span></h1>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-amber-400">
                        <Star size={14} className="fill-amber-400" />
                        <span className="text-sm font-bold">Senior Agent Activation</span>
                        <Star size={14} className="fill-amber-400" />
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden">
                    <div className="p-8 pb-4">
                        <h2 className="text-2xl font-black text-slate-900">
                            Welcome, <span className="text-primary-500">{agentName || 'Agent'}</span>!
                        </h2>
                        <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
                            Create a secure 6-digit PIN to protect your Team Activity dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
                        <PinBoxes
                            label="Create PIN"
                            value={pin}
                            onChange={(val, idx) => handlePinInput(val, idx, pinRefs, setPin)}
                            onKeyDown={(e, idx) => handlePinKeyDown(e, idx, pinRefs, setPin)}
                            refs={pinRefs}
                        />
                        <PinBoxes
                            label="Confirm PIN"
                            value={confirmPin}
                            onChange={(val, idx) => handlePinInput(val, idx, confirmRefs, setConfirmPin)}
                            onKeyDown={(e, idx) => handlePinKeyDown(e, idx, confirmRefs, setConfirmPin)}
                            refs={confirmRefs}
                        />

                        <button
                            type="button"
                            onClick={() => setShowPin(p => !p)}
                            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors mx-auto"
                        >
                            {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                            {showPin ? 'Hide digits' : 'Show digits'}
                        </button>

                        {validationError && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                                <p className="text-red-600 text-xs font-semibold">{validationError}</p>
                            </div>
                        )}

                        <div className="p-3 bg-amber-50 rounded-xl flex gap-2">
                            <Lock size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                Your PIN is hashed and stored securely. You will enter it each time you access Team Activity.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl shadow-lg shadow-primary-500/30 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {submitting
                                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <><CheckCircle size={18} /> Activate Senior Agent Account</>
                            }
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SeniorAgentActivate;
