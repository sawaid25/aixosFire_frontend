import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../api/client';
import { AlertCircle, ArrowLeft, Upload, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

// Headline per invitation problem; the backend's message is shown under it.
const INVITE_TITLES = {
    INVITE_MISSING: 'Invitation required',
    INVITE_INVALID: 'Invalid invitation link',
    INVITE_EXPIRED: 'Invitation expired',
    INVITE_USED: 'Invitation already used',
    INVITE_REVOKED: 'Invitation cancelled',
};

const RegisterPage = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const { register } = useAuth();
    // Internal Team registration is invitation-only: the emailed link carries ?token=.
    const [searchParams] = useSearchParams();
    const inviteToken = role === 'internal_team' ? (searchParams.get('token') || '') : '';
    const [invite, setInvite] = useState({ state: 'loading' });

    useEffect(() => {
        if (!inviteToken) return undefined;
        let active = true;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/auth/team-invitations/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: inviteToken }),
                });
                const body = await res.json().catch(() => ({}));
                if (!active) return;
                if (res.ok) setInvite({ state: 'valid', email: body.email });
                else setInvite({ state: 'error', code: body.code || 'INVITE_INVALID', error: body.error || 'This invitation link is not valid.' });
            } catch {
                if (active) setInvite({ state: 'error', code: 'INVITE_INVALID', error: 'Could not check your invitation. Please try again.' });
            }
        })();
        return () => { active = false; };
    }, [inviteToken]);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        territory: 'North Zone',
        business_name: '',
        owner_name: '',
        address: '',
        business_type: 'Retail',
        department: '',
        request_note: '',
        terms_accepted: false
    });

    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [files, setFiles] = useState({
        profile_photo: null,
        residential_letter: null,
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked, files: fileInput } = e.target;

        if (type === 'file') {
            setFiles(prev => ({ ...prev, [name]: fileInput[0] }));
        } else if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const fullPhone = phone.startsWith('+') ? phone : `+${phone}`;

            const baseData = {
                ...formData,
                phone: fullPhone
            };

            const isAgent = role === 'agent';
            let dataToSend;

            if (isTeam) {
                // The backend takes the email from the invitation itself; phone is optional.
                dataToSend = {
                    token: inviteToken,
                    name: formData.name,
                    password: formData.password,
                    phone: phone ? fullPhone : '',
                    department: formData.department,
                    request_note: formData.request_note,
                };
            } else if (isAgent) {
                const formDataObj = new FormData();
                Object.keys(baseData).forEach(key => {
                    formDataObj.append(key, baseData[key]);
                });

                if (files.profile_photo) formDataObj.append('profile_photo', files.profile_photo);
                if (files.residential_letter) formDataObj.append('residential_letter', files.residential_letter);

                dataToSend = formDataObj;
            } else {
                dataToSend = baseData;
            }

            const result = await register(role, dataToSend);
            if (result.success && isTeam) {
                navigate(`/login/${role}`, {
                    state: { notice: 'Registration complete. You can sign in once an Admin approves your account.' },
                });
            } else if (result.success) {
                navigate(`/login/${role}`);
            } else {
                setError(result.error);
                setLoading(false);
            }
        } catch (err) {
            console.error("Registration error:", err);
            setError("Unexpected error occurred.");
            setLoading(false);
        }
    };

    const isAgent = role === 'agent';
    const isTeam = role === 'internal_team';
    // No token, or one the backend rejected -> show why instead of the form.
    const inviteProblem = isTeam && (!inviteToken
        ? { code: 'INVITE_MISSING', error: 'Internal Team accounts are created by invitation only. Ask an Admin to send you an invitation.' }
        : invite.state === 'error' ? invite : null);
    const inviteLoading = isTeam && !inviteProblem && invite.state === 'loading';

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side */}
            <div className={`hidden lg:flex lg:w-1/2 relative overflow-hidden ${isAgent ? 'bg-red-600' : 'bg-slate-900'}`}>
                <div className="absolute inset-0 bg-hero-pattern opacity-10"></div>
                <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
                    <div>
                        <Link to="/" className="flex items-center text-white/80 hover:text-white transition-colors">
                            <ArrowLeft size={20} className="mr-2" /> Back to Home
                        </Link>
                    </div>
                    <div>
                        <h1 className="text-5xl font-display font-bold mb-6">{isTeam ? 'Internal Team' : 'Join AiXOS Red'}</h1>
                        <p className="text-xl text-white/80 max-w-md">
                            {isTeam
                                ? 'You have been invited to the Internal Team. Complete your profile and set a password — an Admin then reviews your account and assigns your pages.'
                                : isAgent ? 'Start your journey as a certified safety partner. Upload your credentials to get approved.' : 'Secure your business with professional fire protection.'}
                        </p>
                    </div>
                    <div className="text-sm text-white/40">&copy; 2026 AiXOS Red.</div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-slate-50 py-12 overflow-y-auto">
                <div className="mx-auto w-full max-w-md">
                    {inviteProblem ? (
                        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-5">
                                <Lock size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">{INVITE_TITLES[inviteProblem.code] || INVITE_TITLES.INVITE_INVALID}</h2>
                            <p className="text-slate-500 mb-6">{inviteProblem.error}</p>
                            <Link to={`/login/${role}`} className="btn-secondary inline-block">Go to Team Login</Link>
                        </div>
                    ) : inviteLoading ? (
                        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100 flex items-center justify-center gap-3 text-slate-500">
                            <Loader2 size={18} className="animate-spin" /> Checking your invitation...
                        </div>
                    ) : (
                    <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{isTeam ? 'Complete Registration' : 'Create Account'}</h2>
                        <p className="text-slate-500 mb-8">{isTeam ? 'You can sign in after an Admin approves your account.' : 'Enter your details and upload required docs.'}</p>

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-6">
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}

                            {isTeam ? (
                                <>
                                    <Input label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Work Email</label>
                                        <input type="email" value={invite.email || ''} readOnly aria-readonly="true" className="input-field bg-slate-50 text-slate-500 cursor-not-allowed" />
                                        <p className="text-xs text-slate-500 mt-1">This is the email your invitation was sent to.</p>
                                    </div>
                                    <PasswordInput label="Set Password" name="password" value={formData.password} onChange={handleChange} showPassword={showPassword} onToggle={() => setShowPassword(p => !p)} required minLength={8} />

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-slate-400 font-normal">(optional)</span></label>
                                        <PhoneInput
                                            country={'sa'}
                                            enableSearch
                                            value={phone}
                                            onChange={setPhone}
                                            inputClass="!w-full !h-[46px] !rounded-xl !border-slate-200 !pl-14 !text-sm !font-medium focus:!border-primary-500 focus:!ring-2 focus:!ring-primary-500/20"
                                            buttonClass="!rounded-l-xl !border-slate-200 !bg-slate-50 !h-[46px]"
                                            containerClass="!w-full"
                                            searchClass="!rounded-lg !border-slate-200"
                                            dropdownClass="!rounded-xl !border-slate-200 !shadow-lg"
                                        />
                                    </div>

                                    <Input label="Department / Team" name="department" value={formData.department} onChange={handleChange} placeholder="e.g. Operations, Support" />
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">What do you need access to?</label>
                                        <textarea
                                            name="request_note"
                                            rows={3}
                                            value={formData.request_note}
                                            onChange={handleChange}
                                            className="input-field resize-none"
                                            placeholder="e.g. Complaints, to follow up with customers"
                                        />
                                    </div>
                                </>
                            ) : isAgent ? (
                                <>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <Input label="Full Name" name="name" value={formData.name} onChange={handleChange} required />
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
                                            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors h-[46px] flex items-center justify-center cursor-pointer group">
                                                <input type="file" name="profile_photo" onChange={handleChange} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" required />
                                                {files.profile_photo ? (
                                                    <img src={URL.createObjectURL(files.profile_photo)} alt="Preview" className="h-full w-full object-cover" />
                                                ) : (
                                                    <Upload size={18} className="text-slate-400 group-hover:text-primary-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Optional (for login)" />
                                    <PasswordInput label="Password" name="password" value={formData.password} onChange={handleChange} showPassword={showPassword} onToggle={() => setShowPassword(p => !p)} required />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                            <PhoneInput
                                                country={'sa'}
                                                enableSearch
                                                value={phone}
                                                onChange={setPhone}
                                                inputClass="!w-full !h-[46px] !rounded-xl !border-slate-200 !pl-14 !text-sm !font-medium focus:!border-primary-500 focus:!ring-2 focus:!ring-primary-500/20"
                                                buttonClass="!rounded-l-xl !border-slate-200 !bg-slate-50 !h-[46px]"
                                                containerClass="!w-full"
                                                searchClass="!rounded-lg !border-slate-200"
                                                dropdownClass="!rounded-xl !border-slate-200 !shadow-lg"
                                                inputProps={{ required: true }}
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Residential Letter</label>
                                            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors h-[46px] flex items-center justify-center cursor-pointer group">
                                                <input
                                                    type="file"
                                                    name="residential_letter"
                                                    onChange={handleChange}
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    required
                                                />
                                                {files.residential_letter ? (
                                                    <img src={URL.createObjectURL(files.residential_letter)} alt="Preview" className="h-full w-full object-cover" />
                                                ) : (
                                                    <Upload size={18} className="text-slate-400 group-hover:text-primary-500" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Territory Preference</label>
                                        <select name="territory" value={formData.territory} onChange={handleChange} className="input-field">
                                            <option>North Zone</option>
                                            <option>South Zone</option>
                                            <option>East Zone</option>
                                            <option>West Zone</option>
                                            <option>Central Business District</option>
                                            <option>Industrial Area</option>
                                        </select>
                                    </div>

                                    <div className="flex items-start gap-3 mt-4">
                                        <div className="flex items-center h-5">
                                            <input
                                                id="terms"
                                                name="terms_accepted"
                                                type="checkbox"
                                                checked={formData.terms_accepted}
                                                onChange={handleChange}
                                                required
                                                className="w-5 h-5 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                            />
                                        </div>
                                        <div className="ml-1 text-sm">
                                            <label htmlFor="terms" className="font-medium text-slate-700">I agree to the Terms and Conditions</label>
                                            <p className="text-slate-500">I confirm that all provided information is accurate and I agree to the agent code of conduct.</p>
                                        </div>
                                    </div>
                                </>
                            ) : role === 'partner' ? (
                                <>
                                    <Input label="Business Name" name="business_name" value={formData.business_name} onChange={handleChange} required />
                                    <Input label="Owner Name" name="owner_name" value={formData.owner_name} onChange={handleChange} />
                                    <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                                    <PasswordInput label="Password" name="password" value={formData.password} onChange={handleChange} showPassword={showPassword} onToggle={() => setShowPassword(p => !p)} required />

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                        <PhoneInput
                                            country={'sa'}
                                            enableSearch
                                            value={phone}
                                            onChange={setPhone}
                                            inputClass="!w-full !h-[46px] !rounded-xl !border-slate-200 !pl-14 !text-sm !font-medium focus:!border-primary-500 focus:!ring-2 focus:!ring-primary-500/20"
                                            buttonClass="!rounded-l-xl !border-slate-200 !bg-slate-50 !h-[46px]"
                                            containerClass="!w-full"
                                            searchClass="!rounded-lg !border-slate-200"
                                            dropdownClass="!rounded-xl !border-slate-200 !shadow-lg"
                                            inputProps={{ required: true }}
                                        />
                                    </div>

                                    <Input label="Address" name="address" value={formData.address} onChange={handleChange} />
                                </>
                            ) : (
                                <>
                                    <Input label="Business Name" name="business_name" value={formData.business_name} onChange={handleChange} required />
                                    <Input label="Owner Name" name="owner_name" value={formData.owner_name} onChange={handleChange} />
                                    <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Optional for now" />
                                    <PasswordInput label="Password" name="password" value={formData.password} onChange={handleChange} showPassword={showPassword} onToggle={() => setShowPassword(p => !p)} required />

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                        <PhoneInput
                                            country={'sa'}
                                            enableSearch
                                            value={phone}
                                            onChange={setPhone}
                                            inputClass="!w-full !h-[46px] !rounded-xl !border-slate-200 !pl-14 !text-sm !font-medium focus:!border-primary-500 focus:!ring-2 focus:!ring-primary-500/20"
                                            buttonClass="!rounded-l-xl !border-slate-200 !bg-slate-50 !h-[46px]"
                                            containerClass="!w-full"
                                            searchClass="!rounded-lg !border-slate-200"
                                            dropdownClass="!rounded-xl !border-slate-200 !shadow-lg"
                                            inputProps={{ required: true }}
                                        />
                                    </div>

                                    <Input label="Address" name="address" value={formData.address} onChange={handleChange} />
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Business Type</label>
                                        <select name="business_type" value={formData.business_type} onChange={handleChange} className="input-field">
                                            <option>Retail</option>
                                            <option>Office</option>
                                            <option>Restaurant</option>
                                            <option>Factory</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <button type="submit" disabled={loading} className="w-full btn-primary mt-6">
                                {loading ? 'Processing...' : (isTeam ? 'Complete Registration' : isAgent ? 'Submit Application' : 'Create Account')}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-sm text-slate-500">
                                Already have an account?{' '}
                                <Link to={`/login/${role}`} className="font-semibold text-primary-600 hover:text-primary-700">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Input = ({ label, name, type = "text", value, onChange, placeholder, required = false }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input name={name} type={type} required={required} value={value} onChange={onChange} className="input-field" placeholder={placeholder || `Enter ${label}`} />
    </div>
);

const PasswordInput = ({ label, name, value, onChange, showPassword, onToggle, required = false, minLength }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <div className="relative">
            <input
                name={name}
                type={showPassword ? 'text' : 'password'}
                required={required}
                minLength={minLength}
                value={value}
                onChange={onChange}
                className="input-field pr-11"
                placeholder="••••••••"
            />
            <button
                type="button"
                onClick={onToggle}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
            >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
        </div>
    </div>
);

export default RegisterPage;
