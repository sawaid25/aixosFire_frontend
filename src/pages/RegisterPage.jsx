import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowLeft, Upload, FileText, CheckSquare } from 'lucide-react';

const RegisterPage = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const { register } = useAuth();

    // Form Data State
    const [formData, setFormData] = useState({
        name: '', email: '', password: '',
        phoneLocal: '', // 9 Digits
        cnic: '', territory: 'Retail',
        business_name: '', owner_name: '', address: '', business_type: 'Retail',
        terms_accepted: false
    });

    const [countryCode, setCountryCode] = useState('+92'); // Default fallback
    const [loadingIp, setLoadingIp] = useState(true);

    // Separate state for files
    const [files, setFiles] = useState({
        profile_photo: null,
        cnic_document: null
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Detect IP and Country Code
        fetch('https://ipwho.is/')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.calling_code) {
                    setCountryCode('+' + data.calling_code);
                }
            })
            .catch(err => console.error("IP Detect Error", err))
            .finally(() => setLoadingIp(false));
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked, files: fileInput } = e.target;

        if (type === 'file') {
            setFiles(prev => ({ ...prev, [name]: fileInput[0] }));
        } else if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (name === 'phoneLocal') {
            // Enforce 9 digits only
            const cleaned = value.replace(/\D/g, '').slice(0, 9);
            setFormData(prev => ({ ...prev, [name]: cleaned }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let dataToSend;

            // Combine Phone
            const fullPhone = `${countryCode}${formData.phoneLocal}`;

            // Construct Base Data
            const baseData = {
                ...formData,
                phone: fullPhone
            };

            delete baseData.phoneLocal; // Remove temp field

            const isAgent = role === 'agent';

            if (isAgent) {
                // Use FormData for Agent (File Uploads)
                const formDataObj = new FormData();
                Object.keys(baseData).forEach(key => {
                    formDataObj.append(key, baseData[key]);
                });
                if (files.profile_photo) formDataObj.append('profile_photo', files.profile_photo);
                if (files.cnic_document) formDataObj.append('cnic_document', files.cnic_document);

                dataToSend = formDataObj;
            } else {
                // Use JSON for Customer
                dataToSend = baseData;
            }

            const result = await register(role, dataToSend);
            if (result.success) {
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
                        <h1 className="text-5xl font-display font-bold mb-6">Join AiXOS Red</h1>
                        <p className="text-xl text-white/80 max-w-md">
                            {isAgent ? 'Start your journey as a certified safety partner. Upload your credentials to get approved.' : 'Secure your business with professional fire protection.'}
                        </p>
                    </div>
                    <div className="text-sm text-white/40">&copy; 2026 AiXOS Red.</div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-slate-50 py-12 overflow-y-auto">
                <div className="mx-auto w-full max-w-md">
                    <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Account</h2>
                        <p className="text-slate-500 mb-8">Enter your details and upload required docs.</p>

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            {error && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-6">
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}

                            {isAgent ? (
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
                                    <Input label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required />

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Phone Input Custom */}
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                            <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500">
                                                <div className="bg-slate-50 px-3 py-3 text-slate-500 border-r border-slate-200 font-medium select-none min-w-[3.5rem] flex items-center justify-center">
                                                    {loadingIp ? '...' : countryCode}
                                                </div>
                                                <input
                                                    name="phoneLocal"
                                                    value={formData.phoneLocal}
                                                    onChange={handleChange}
                                                    className="flex-1 px-4 py-3 outline-none min-w-0"
                                                    placeholder="3XX XXXXXXX"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <Input label="CNIC Number" name="cnic" value={formData.cnic} onChange={handleChange} required placeholder="XXXXX-XXXXXXX-X" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Upload CNIC (Front)</label>
                                        <div className="relative block w-full rounded-xl border-dashed border-2 border-slate-300 p-4 text-center hover:border-primary-500 hover:bg-primary-50/10 transition-all cursor-pointer">
                                            <input type="file" name="cnic_document" onChange={handleChange} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
                                            {files.cnic_document ? (
                                                <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                                                    <CheckSquare size={18} /> {files.cnic_document.name}
                                                </div>
                                            ) : (
                                                <div className="text-slate-500 flex flex-col items-center">
                                                    <FileText size={24} className="mb-2 text-slate-400" />
                                                    <span className="text-sm">Click to upload document</span>
                                                    <span className="text-xs text-slate-400 mt-1">JPG, PNG or PDF</span>
                                                </div>
                                            )}
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
                            ) : (
                                <>
                                    <Input label="Business Name" name="business_name" value={formData.business_name} onChange={handleChange} required />
                                    <Input label="Owner Name" name="owner_name" value={formData.owner_name} onChange={handleChange} />
                                    <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Optional for now" />
                                    <Input label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required />

                                    {/* Phone Input Custom Customer */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                        <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500">
                                            <div className="bg-slate-50 px-3 py-3 text-slate-500 border-r border-slate-200 font-medium select-none min-w-[3.5rem] flex items-center justify-center">
                                                {loadingIp ? '...' : countryCode}
                                            </div>
                                            <input
                                                name="phoneLocal"
                                                value={formData.phoneLocal}
                                                onChange={handleChange}
                                                className="flex-1 px-4 py-3 outline-none min-w-0"
                                                placeholder="3XX XXXXXXX"
                                                required
                                            />
                                        </div>
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
                                {loading ? 'Processing...' : (isAgent ? 'Submit Application' : 'Create Account')}
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

export default RegisterPage;
