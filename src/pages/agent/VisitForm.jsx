import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'qrcode';
import {
    Plus, Trash, Save, ArrowLeft, Building, FireExtinguisher, FileText,
    Search, Check, AlertTriangle, ArrowRight, UserPlus, MapPin, Camera, Image, Mic, Square
} from 'lucide-react';

const VisitForm = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isNewCustomer, setIsNewCustomer] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        customerId: null,
        businessName: '', ownerName: '', phone: '', email: '',
        address: '', businessType: 'Retail Store - Grocery',
        notes: '', riskAssessment: '', serviceRecommendations: '',
        followUpDate: '',
        customerPhoto: null,
        voiceNote: null
    });

    const [qrPreview, setQrPreview] = useState(null);

    const [extinguishers, setExtinguishers] = useState([
        {
            mode: 'Validation', // Validation, Refill, New Unit
            type: 'ABC Dry Powder', capacity: '6kg', quantity: 1,
            brand: '', seller: '', partner: '', refillStatus: 'Required',
            price: 180, expiryDate: '', condition: 'Good'
        }
    ]);

    // Handlers
    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.length > 2) {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('id, business_name, owner_name, email, phone, address, business_type')
                    .or(`business_name.ilike.%${query}%,phone.ilike.%${query}%`)
                    .limit(10);

                if (error) throw error;
                setSearchResults(data);
            } catch (err) { console.error(err); }
        } else {
            setSearchResults([]);
        }
    };

    const selectCustomer = (cust) => {
        setFormData({
            ...formData,
            customerId: cust.id,
            businessName: cust.business_name,
            ownerName: cust.owner_name || '',
            phone: cust.phone || '',
            email: cust.email,
            address: cust.address || '',
            businessType: cust.business_type || 'Retail'
        });
        setSearchResults([]);
        setIsNewCustomer(false);
    };

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleExtinguisherChange = (index, field, value) => {
        const newExt = [...extinguishers];
        newExt[index][field] = value;
        // Default price for New Unit
        if (field === 'mode' && value === 'New Unit') {
            newExt[index].price = 180;
        }
        setExtinguishers(newExt);
    };

    const addExtinguisher = () => {
        setExtinguishers([...extinguishers, {
            mode: 'Validation',
            type: 'ABC Dry Powder', capacity: '6kg', quantity: 1,
            brand: '', seller: '', partner: '', refillStatus: 'Required',
            price: 180, expiryDate: '', condition: 'Good'
        }]);
    };

    const fetchLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                setFormData(prev => ({ ...prev, address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}` }));
            }, (err) => {
                alert("Failed to get location: " + err.message);
            });
        }
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, customerPhoto: file }));
        }
    };

    const generateQRPreview = async () => {
        if (!formData.businessName) {
            alert("Please enter business name first");
            return;
        }
        try {
            const previewId = formData.customerId || 'temp-id-' + Date.now();
            const qrContent = JSON.stringify({ id: previewId, type: 'customer', name: formData.businessName });
            const qrDataUrl = await QRCode.toDataURL(qrContent);
            setQrPreview(qrDataUrl);
        } catch (err) { console.error(err); }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            let chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/wav' });
                setFormData(prev => ({ ...prev, voiceNote: blob }));
            };
            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
        } catch (err) { alert("Mic access denied"); }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            let finalCustId = formData.customerId;
            let finalQrUrl = null;

            // 1. Handle New Lead Customer
            if (!finalCustId) {
                // ... logic to create customer and get ID
                const { data: leadData, error: leadError } = await supabase
                    .from('customers')
                    .insert([{
                        business_name: formData.businessName,
                        owner_name: formData.ownerName,
                        email: formData.email || `lead-${Date.now()}@temp.com`,
                        password: 'default-hashed-placeholder',
                        phone: formData.phone,
                        address: formData.address,
                        business_type: formData.businessType,
                        status: 'Lead'
                    }])
                    .select();

                if (leadError) throw leadError;
                finalCustId = leadData[0].id;

                // QR Logic
                try {
                    const qrContent = JSON.stringify({ id: finalCustId, type: 'customer', name: formData.businessName });
                    finalQrUrl = await QRCode.toDataURL(qrContent);
                    await supabase.from('customers').update({ qr_code_url: finalQrUrl }).eq('id', finalCustId);
                } catch (qrErr) { console.error(qrErr); }
            }

            // 2. Handle File Uploads (Photo & Voice Note)
            // For MVP, we'll log the blobs. In real app, upload to Supabase Storage.
            console.log("Customer Photo:", formData.customerPhoto);
            console.log("Voice Note:", formData.voiceNote);

            // 3. Insert Visit
            const taskTypes = extinguishers.map(e => e.mode).join(', '); // Maintenance, Refilling, etc.
            const { data: visitData, error: visitError } = await supabase
                .from('visits')
                .insert([{
                    agent_id: user.id,
                    customer_id: finalCustId,
                    customer_name: formData.businessName,
                    business_type: formData.businessType,
                    notes: formData.notes,
                    risk_assessment: formData.riskAssessment,
                    service_recommendations: formData.serviceRecommendations,
                    follow_up_date: formData.followUpDate,
                    status: 'Completed',
                    task_types: taskTypes // Maintenance, Refilling, New Queries
                }])
                .select();

            if (visitError) throw visitError;
            const visitId = visitData[0].id;

            // 4. Insert Inventory
            if (extinguishers.length > 0) {
                const inventoryRows = extinguishers.map(item => ({
                    customer_id: finalCustId,
                    visit_id: visitId,
                    type: item.type,
                    capacity: item.capacity,
                    quantity: item.quantity,
                    expiry_date: item.expiryDate || null,
                    condition: item.condition,
                    status: item.mode === 'New Unit' ? 'New' : (item.mode === 'Refill' ? 'Refilled' : 'Valid'),
                    brand: item.brand,
                    seller: item.seller,
                    partner: item.partner,
                    price: item.price
                }));

                const { error: invError } = await supabase.from('extinguishers').insert(inventoryRows);
                if (invError) throw invError;
            }

            navigate('/agent/dashboard');
        } catch (error) {
            console.error(error);
            alert('Failed to submit visit log: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header / Stepper */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-display font-bold text-slate-900">Log Visit</h1>
                        <p className="text-slate-500">Step {step} of 3</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full ${step >= i ? 'bg-primary-500' : 'bg-slate-200'}`}></div>
                    ))}
                </div>
            </div>

            {/* Step 1: Customer Identification */}
            {step === 1 && (
                <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100 animate-fade-in">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><UserPlus size={24} /></div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Customer Identification</h3>
                            <p className="text-sm text-slate-500">Search for an existing customer or register a new lead.</p>
                        </div>
                    </div>

                    {!isNewCustomer && !formData.customerId && (
                        <div className="mb-8 relative">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Search Customer Database</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all shadow-sm"
                                    placeholder="Search by Business Name or Phone..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white mt-2 rounded-xl shadow-xl border border-slate-100 z-10 max-h-60 overflow-y-auto">
                                    {searchResults.map(cust => (
                                        <div key={cust.id} onClick={() => selectCustomer(cust)} className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group">
                                            <div>
                                                <p className="font-bold text-slate-900">{cust.business_name}</p>
                                                <p className="text-sm text-slate-500">{cust.address}</p>
                                            </div>
                                            <ArrowRight size={18} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-6 text-center">
                                <span className="text-slate-500">Customer not found? </span>
                                <button onClick={() => { setIsNewCustomer(true); setFormData({ ...formData, customerId: null }); }} className="font-bold text-primary-600 hover:underline">
                                    Create New Lead
                                </button>
                            </div>
                        </div>
                    )}

                    {(isNewCustomer || formData.customerId) && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                                    <p className={`font-bold ${isNewCustomer ? 'text-green-600' : 'text-blue-600'}`}>
                                        {isNewCustomer ? 'Creating New Lead' : 'Existing Customer Selected'}
                                    </p>
                                </div>
                                {!isNewCustomer && (
                                    <button onClick={() => { setFormData({ ...formData, customerId: null }); setSearchQuery(''); }} className="text-sm font-medium text-red-500 hover:text-red-700">
                                        Change
                                    </button>
                                )}
                                {isNewCustomer && (
                                    <button onClick={() => { setIsNewCustomer(false); }} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                                        Cancel
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Business Name" name="businessName" value={formData.businessName} onChange={handleInputChange} required={isNewCustomer} />
                                <Input label="Owner Name" name="ownerName" value={formData.ownerName} onChange={handleInputChange} />
                                <Input label="Phone Contact" name="phone" value={formData.phone} onChange={handleInputChange} required={isNewCustomer} />
                                <Input label="Email Address" name="email" value={formData.email} onChange={handleInputChange} />
                                <div className="md:col-span-2 relative">
                                    <Input label="Site Address" name="address" value={formData.address} onChange={handleInputChange} />
                                    <button onClick={fetchLocation} className="absolute right-2 top-8 p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Get Current Location">
                                        <MapPin size={20} />
                                    </button>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Category</label>
                                    <select name="businessType" value={formData.businessType} onChange={handleInputChange} className="input-field">
                                        <optgroup label="Retail Store">
                                            <option>Retail Store - Grocery</option>
                                            <option>Retail Store - Clothing</option>
                                            <option>Retail Store - Electronics</option>
                                            <option>Retail Store - Pharmacy</option>
                                            <option>Retail Store - Other</option>
                                        </optgroup>
                                        <option>Corporate Office</option>
                                        <option>Restaurant / Cafe</option>
                                        <option>Industrial Factory</option>
                                        <option>Warehouse</option>
                                        <option>Educational Institute</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Customer Image</label>
                                        <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center hover:border-primary-500 hover:bg-primary-50/10 transition-all cursor-pointer">
                                            <input type="file" onChange={handlePhotoUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                                            {formData.customerPhoto ? (
                                                <img src={URL.createObjectURL(formData.customerPhoto)} className="h-16 w-16 object-cover rounded-lg" alt="Preview" />
                                            ) : (
                                                <Camera className="text-slate-400" size={24} />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Identity QR Code</label>
                                        <button onClick={generateQRPreview} className="w-full py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors mb-2">
                                            Generate Local QR
                                        </button>
                                        {qrPreview && (
                                            <img src={qrPreview} className="h-16 w-16 mx-auto border rounded-lg" alt="QR Preview" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-8">
                                <button onClick={() => setStep(2)} className="btn-primary flex items-center gap-2">
                                    Next: Inventory Builder <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Inventory Builder */}
            {step === 2 && (
                <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100 animate-fade-in">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg text-red-600"><FireExtinguisher size={24} /></div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Inventory Builder</h3>
                                <p className="text-sm text-slate-500">Total Units: {extinguishers.length}</p>
                            </div>
                        </div>
                        <button onClick={addExtinguisher} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20">
                            <Plus size={16} /> Add Unit
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        {extinguishers.map((ext, index) => (
                            <div key={index} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all relative group">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => removeExtinguisher(index)} className="p-2 bg-white text-red-500 rounded-lg shadow-sm border border-slate-200 hover:text-red-600">
                                        <Trash size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-slate-200/50">
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Task Mode</label>
                                        <div className="flex gap-2">
                                            {['Validation', 'Refill', 'New Unit'].map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => handleExtinguisherChange(index, 'mode', m)}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${ext.mode === m ? 'bg-primary-500 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Type</label>
                                        <select value={ext.type} onChange={(e) => handleExtinguisherChange(index, 'type', e.target.value)} className="input-field py-2 text-sm">
                                            <option>ABC Dry Powder</option>
                                            <option>CO2 - Carbon Dioxide</option>
                                            <option>Water Type</option>
                                            <option>Mechanical Foam</option>
                                            <option>Wet Chemical</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Capacity</label>
                                        <select value={ext.capacity} onChange={(e) => handleExtinguisherChange(index, 'capacity', e.target.value)} className="input-field py-2 text-sm">
                                            <option>1kg</option><option>2kg</option><option>4kg</option><option>6kg</option><option>9kg</option><option>25kg</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Flow-based Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                                    {ext.mode === 'Validation' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Condition</label>
                                                <select value={ext.condition} onChange={(e) => handleExtinguisherChange(index, 'condition', e.target.value)} className="input-field py-2 text-sm">
                                                    <option>Good</option><option>Fair</option><option>Poor</option><option>Expired</option><option>Damaged</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Expiry</label>
                                                <input type="date" value={ext.expiryDate} onChange={(e) => handleExtinguisherChange(index, 'expiryDate', e.target.value)} className="input-field py-2 text-sm" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Photo Reference</label>
                                                <div className="border border-dashed border-slate-300 rounded-lg h-[38px] flex items-center justify-center text-slate-400 text-xs hover:bg-white cursor-pointer"><Image size={14} className="mr-2" /> Upload Snapshot</div>
                                            </div>
                                        </>
                                    )}

                                    {ext.mode === 'New Unit' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Seller</label>
                                                <input value={ext.seller} onChange={(e) => handleExtinguisherChange(index, 'seller', e.target.value)} className="input-field py-2 text-sm" placeholder="Seller Name" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Brand</label>
                                                <input value={ext.brand} onChange={(e) => handleExtinguisherChange(index, 'brand', e.target.value)} className="input-field py-2 text-sm" placeholder="Brand Name" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantity</label>
                                                <input type="number" value={ext.quantity} onChange={(e) => handleExtinguisherChange(index, 'quantity', parseInt(e.target.value))} className="input-field py-2 text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Price (SAR)</label>
                                                <input type="number" value={ext.price} onChange={(e) => handleExtinguisherChange(index, 'price', parseInt(e.target.value))} className="input-field py-2 text-sm" />
                                            </div>
                                        </>
                                    )}

                                    {ext.mode === 'Refill' && (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Partner</label>
                                                <input value={ext.partner} onChange={(e) => handleExtinguisherChange(index, 'partner', e.target.value)} className="input-field py-2 text-sm" placeholder="Service Partner" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Brand</label>
                                                <input value={ext.brand} onChange={(e) => handleExtinguisherChange(index, 'brand', e.target.value)} className="input-field py-2 text-sm" placeholder="Brand" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Refill Status</label>
                                                <select value={ext.refillStatus} onChange={(e) => handleExtinguisherChange(index, 'refillStatus', e.target.value)} className="input-field py-2 text-sm">
                                                    <option>Required</option><option>In Process</option><option>Completed</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantity</label>
                                                <input type="number" value={ext.quantity} onChange={(e) => handleExtinguisherChange(index, 'quantity', parseInt(e.target.value))} className="input-field py-2 text-sm" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                        <button onClick={() => setStep(1)} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">Back</button>
                        <button onClick={() => setStep(3)} className="btn-primary flex items-center gap-2">
                            Next: Site Assessment <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Site Assessment */}
            {step === 3 && (
                <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100 animate-fade-in">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                        <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600"><AlertTriangle size={24} /></div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">Site Assessment</h3>
                            <p className="text-sm text-slate-500">Evaluate risks and make service recommendations.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Site Voice Note</label>
                            <div className="flex items-center gap-4">
                                <button
                                    onMouseDown={startRecording}
                                    onMouseUp={stopRecording}
                                    onTouchStart={startRecording}
                                    onTouchEnd={stopRecording}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse text-white scale-110 shadow-lg shadow-red-500/30' : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-primary-500 hover:text-primary-500'}`}
                                >
                                    {isRecording ? <Square size={24} /> : <Mic size={24} />}
                                </button>
                                <div>
                                    <p className="font-bold text-slate-900">{isRecording ? 'Recording...' : formData.voiceNote ? 'Voice Note Captured' : 'Hold to Record'}</p>
                                    <p className="text-sm text-slate-500">Tap and hold to record site assessment feedback.</p>
                                </div>
                                {formData.voiceNote && !isRecording && (
                                    <audio src={URL.createObjectURL(formData.voiceNote)} controls className="h-8 ml-auto" />
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Observations & Risk Assessment</label>
                            <textarea
                                name="riskAssessment"
                                value={formData.riskAssessment}
                                onChange={handleInputChange}
                                className="input-field h-32 resize-none"
                                placeholder="E.g. Loose wiring near kitchen, blocked emergency exits, expired equipment found..."
                            ></textarea>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Service Recommendations</label>
                            <textarea
                                name="serviceRecommendations"
                                value={formData.serviceRecommendations}
                                onChange={handleInputChange}
                                className="input-field h-24 resize-none"
                                placeholder="E.g. Install 2x 6kg CO2 near server room, Refill existing ABC cylinders..."
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
                                <input name="notes" value={formData.notes} onChange={handleInputChange} className="input-field" placeholder="Private notes for admin/agent..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Date</label>
                                <input type="date" name="followUpDate" value={formData.followUpDate} onChange={handleInputChange} className="input-field" />
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
                            <button onClick={() => setStep(2)} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">Back</button>
                            <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2 px-8 py-3 text-lg shadow-xl shadow-primary-500/20">
                                {loading ? 'Submitting...' : 'Finish & Save Log'} <Check size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Input = ({ label, name, value, onChange, placeholder, required = false }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} className="input-field" />
    </div>
);

export default VisitForm;
