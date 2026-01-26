import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import QRCode from 'qrcode';
import {
    Plus, Trash, Save, ArrowLeft, Building, FireExtinguisher, FileText,
    Search, Check, AlertTriangle, ArrowRight, UserPlus, MapPin, Camera, Image, Mic, Square,
    EyeOff,
    Eye,
    Pencil
} from 'lucide-react';
import bcrypt from 'bcryptjs';
import { useRef } from 'react';

const VisitForm = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [voiceNoteSizeWarning, setVoiceNoteSizeWarning] = useState('');
    const [audioChunks, setAudioChunks] = useState([]);     // ← NEW: chunks store karenge
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [recordingIndex, setRecordingIndex] = useState(null);
    const [unitVoiceWarnings, setUnitVoiceWarnings] = useState({});
    const debounceTimers = useRef([]);

    // Component ke top pe add karo (useState se pehle)
const ADDON_PRICES = {
  firefightingSystem: {
    'Sprinklers': 250,                // per head/unit approx
    'Gate Valves': 500,
    'Pipes': 800,                     // per section rough
    'Zone Control Valves': 1800,
    'Hydrants': 3500,
    'Hose Reels': 1500,
    'Foam System': 5000,
    '': 0
  },
  fireAlarmSystem: {
    'Manual Pull Stations': 200,
    'Smoke Detectors': 150,
    'Heat Detectors': 220,
    'Notification Appliances (Horns/Strobes)': 400,
    'Control Panel': 5000,            // basic panel
    'Voice Evacuation System': 10000,
    'Beam Detectors': 6000,
    '': 0
  },
  pumpType: {
    'Electric Fire Pump': 25000,      // small/medium
    'Diesel Fire Pump': 40000,
    'Jockey Pump': 6000,
    'Centrifugal Pump': 15000,
    'Vertical Turbine Pump': 30000,
    'Booster Pump': 12000,
    '': 0
  }
};

const FIRE_SYSTEMS = {
  firefighting: [
    { name: 'Sprinklers', price: 250 },
    { name: 'Gate Valves', price: 500 },
    { name: 'Pipes', price: 800 },
    { name: 'Zone Control Valves', price: 1800 },
    { name: 'Hydrants', price: 3500 },
    { name: 'Hose Reels', price: 1500 },
    { name: 'Foam System', price: 5000 }
  ],
  fireAlarm: [
    { name: 'Manual Pull Stations', price: 200 },
    { name: 'Smoke Detectors', price: 150 },
    { name: 'Heat Detectors', price: 220 },
    { name: 'Notification Appliances (Horns/Strobes)', price: 400 },
    { name: 'Control Panel', price: 5000 },
    { name: 'Voice Evacuation System', price: 10000 },
    { name: 'Beam Detectors', price: 6000 }
  ],
  pumps: [
    { name: 'Electric Fire Pump', price: 25000 },
    { name: 'Diesel Fire Pump', price: 40000 },
    { name: 'Jockey Pump', price: 6000 },
    { name: 'Centrifugal Pump', price: 15000 },
    { name: 'Vertical Turbine Pump', price: 30000 },
    { name: 'Booster Pump', price: 12000 }
  ]
};
    // Form Data
    const [formData, setFormData] = useState({
        customerId: null,
        businessName: '', ownerName: '', phone: '', email: '', password: '',
        address: '', businessType: 'Retail Store - Grocery',
        customBusinessType: '',
        notes: '', riskAssessment: '', serviceRecommendations: '',
        followUpDate: '',
        customerPhoto: null,
        voiceNote: null,
    });

    const [qrPreview, setQrPreview] = useState(null);

    const [extinguishers, setExtinguishers] = useState([
        {
            mode: 'Validation', // Validation, Refill, New Unit
            type: 'ABC Dry Powder', customType: '', capacity: '6kg', quantity: 1,
            systemItem: '',
            brand: '', seller: '', partner: '', customPartner: '', refillStatus: 'Required',
            price: 180, expiryDate: '', condition: 'Good',
            firefightingSystem: '',
            fireAlarmSystem: '',
            pumpType: '',

            maintenanceVoiceNote: null,
            maintenanceNotes: '',
            maintenanceUnitPhoto: null,

            isLocked: false,
            hasChanges: false
        }
    ]);

    useEffect(() => {
    extinguishers.forEach((ext, index) => {
        if (ext.mode === 'Validation' && ext.hasChanges && !ext.isLocked) {
            if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
            debounceTimers.current[index] = setTimeout(() => {
                setExtinguishers(prev =>
                    prev.map((item, i) => i === index ? { ...item, isLocked: true, hasChanges: false } : item)
                );
                // Optional: Alert or console "Auto-saved and locked unit {index+1}"
            }, 2000); // 2 seconds debounce
        }
    });
    return () => debounceTimers.current.forEach(timer => clearTimeout(timer));
}, [extinguishers]);
    
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

    // VisitForm ke andar, handlers ke paas add kar do
const uploadCustomerPhoto = async (file) => {
  if (!file) return null;

  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Unique name: timestamp + random + original ext
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `customer-photos/${fileName}`;  // folder bana diya better organization ke liye

    const { error: uploadError } = await supabase.storage
      .from('customer-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,          // overwrite na ho
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      alert('Photo upload failed: ' + uploadError.message);
      return null;
    }

    // Public URL nikaal lo (bucket public hona zaroori)
    const { data: urlData } = supabase.storage
      .from('customer-images')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      console.warn('No public URL returned');
      return null;
    }

    console.log('Uploaded photo URL:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Photo upload exception:', err);
    alert('Unexpected error during photo upload');
    return null;
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

    

    const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        if (name === 'businessType' && value !== 'Other') {
            newData.customBusinessType = '';
        }
        return newData;
    });
};
    const handleExtinguisherChange = (index, field, value) => {
  setExtinguishers(prev =>
    prev.map((item, i) => {
      if (i !== index) return item;
      if (item.isLocked) return item;
      const updated = { ...item, [field]: value, hasChanges: true };

      if (field === 'type' && value !== 'Other') updated.customType = '';
      if (field === 'partner' && value !== 'Other') updated.customPartner = '';

      if (field === 'mode') {
        updated.price = 180; // default base
      }

      // Price calculation for BOTH New Unit AND Maintenance
      if (['New Unit', 'Maintenance'].includes(updated.mode) &&
          ['firefightingSystem', 'fireAlarmSystem', 'pumpType', 'mode'].includes(field)) {
        
        const base = 180;
        
        // Find price from the data object
        const ffItem = FIRE_SYSTEMS.firefighting.find(it => it.name === updated.firefightingSystem);
        const faItem  = FIRE_SYSTEMS.fireAlarm.find(it => it.name === updated.fireAlarmSystem);
        const pumpItem = FIRE_SYSTEMS.pumps.find(it => it.name === updated.pumpType);

        const ffPrice = ffItem ? ffItem.price : 0;
        const faPrice  = faItem  ? faItem.price  : 0;
        const pumpPrice = pumpItem ? pumpItem.price : 0;

        updated.price = base + ffPrice + faPrice + pumpPrice;
      }

      return updated;
    })
  );
};


    const addExtinguisher = () => {
        setExtinguishers([...extinguishers, {
            mode: 'Validation',
            type: 'ABC Dry Powder', customType:'', capacity: '6kg', quantity: 1,
            brand: '', seller: '', partner: '', customPartner: '', refillStatus: 'Required',
            price: 180, expiryDate: '', condition: 'Good',
            firefightingSystem: '',
            fireAlarmSystem: '',
            pumpType: '',
            maintenanceVoiceNote: null,       // ← Add yeh
            maintenanceNotes: '',             // ← Add yeh
            maintenanceUnitPhoto: null,
            isLocked: false,
            hasChanges: false
        }]);
    };

    const fetchLocation = async () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser. Please enter address manually.");
            return;
        }

        setIsFetchingLocation(true); // ← Loading start

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
                    );

                    if (!response.ok) {
                        throw new Error("Failed to fetch address");
                    }

                    const data = await response.json();

                    let readableAddress = data.display_name || 
                        `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;

                    setFormData(prev => ({ ...prev, address: readableAddress }));
                } catch (err) {
                    console.error("Reverse geocoding error:", err);
                    setFormData(prev => ({
                        ...prev,
                        address: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)} (couldn't get full address)`
                    }));
                    alert("Couldn't fetch readable address. Using coordinates instead.");
                } finally {
                    setIsFetchingLocation(false); // ← Loading end (success ya fail dono mein)
                }
            },
            (err) => {
                setIsFetchingLocation(false); // ← Loading end

                let errorMsg = "Failed to get location.";
                
                if (err.code === err.PERMISSION_DENIED) {
                    errorMsg = "Location access denied. Please enable location permission in browser settings and try again.";
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    errorMsg = "Location information is unavailable. Make sure GPS/location is turned ON on your device.";
                } else if (err.code === err.TIMEOUT) {
                    errorMsg = "Location request timed out. Please try again.";
                }

                alert(errorMsg);
                setFormData(prev => ({ ...prev, address: prev.address || "Enable location to auto-fill" }));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
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

    const MAX_VOICE_NOTE_SIZE = 256000; // bytes

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            let chunks = [];

            recorder.ondataavailable = (e) => {
                chunks.push(e.data);
                setAudioChunks([...chunks]);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const sizeInKB = (blob.size / 1024).toFixed(1);

                if (blob.size > MAX_VOICE_NOTE_SIZE) {
                    setVoiceNoteSizeWarning(
                        `Voice note too large (${sizeInKB} KB) — Max allowed: 250 KB. Please try a shorter recording.`
                    );
                    setFormData(prev => ({ ...prev, voiceNote: null }));
                } else {
                    setVoiceNoteSizeWarning('');
                    setFormData(prev => ({ ...prev, voiceNote: blob }));
                }

                chunks = [];
                setAudioChunks([]);
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            setVoiceNoteSizeWarning('');
        } catch (err) { alert("Mic access denied: " + err.message); }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const startUnitRecording = async (index) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    let chunks = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const sizeKB = (blob.size / 1024).toFixed(1);

      if (blob.size > MAX_VOICE_NOTE_SIZE) {
        setUnitVoiceWarnings(prev => ({
          ...prev,
          [index]: `Voice note too large (${sizeKB} KB) — max 250 KB`
        }));
      } else {
        setExtinguishers(prev => prev.map((item, i) =>
          i === index ? { ...item, maintenanceVoiceNote: blob } : item
        ));
        setUnitVoiceWarnings(prev => {
          const copy = { ...prev };
          delete copy[index];
          return copy;
        });
      }
      chunks = [];
    };

    recorder.start();
    setMediaRecorder(recorder);
    setRecordingIndex(index);           // ← important
    setIsRecording(true);
    setRecordingTime(0);
  } catch (err) {
    alert("Mic access denied: " + err.message);
  }
};

const stopUnitRecording = () => {
  if (mediaRecorder) {
    mediaRecorder.stop();
    setIsRecording(false);
    setRecordingIndex(null);
  }
};
    useEffect(() => {
        let interval;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
        return () => {
            clearInterval(interval);
            if (!isRecording) setRecordingTime(0);
        };
    }, [isRecording]);

    const removeExtinguisher = (index) => {
  setExtinguishers(prev =>
    prev.filter((_, i) => i !== index)
  );
};


const uploadMaintenanceVoice = async (blob, index) => {
  if (!blob) return null;
  try {
    const fileName = `voice-${Date.now()}-${index}.webm`;
    const filePath = `voices/${fileName}`;  // optional folder

    const { error: uploadError } = await supabase.storage
      .from('visit-voice-notes')           // ← yahan new bucket
      .upload(filePath, blob, {
        contentType: blob.type || 'audio/webm',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Voice upload error:', uploadError);
      alert('Voice upload fail: ' + uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('visit-voice-notes')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Voice upload failed:', err);
    return null;
  }
};

const uploadMaintenancePhoto = async (file, index) => {
  if (!file) return null;
  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `photo-${Date.now()}-${index}.${fileExt}`;
    const filePath = `photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('visit-unit-photos')           // ← yahan new bucket
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Photo upload error:', uploadError);
      alert('Photo upload fail: ' + uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('visit-unit-photos')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Photo upload failed:', err);
    return null;
  }
};

    const handleSubmit = async () => {
        setLoading(true);
        try {
            let finalCustId = formData.customerId;
            let finalQrUrl = null;

            
    let finalBusinessType = formData.businessType;

    if (formData.businessType === 'Other') {
        if (formData.customBusinessType.trim()) {
            finalBusinessType = formData.customBusinessType.trim();
        } else {
            finalBusinessType = 'Other';   // agar blank chhoda to sirf "Other" save ho
        }
    }
            // 1. Handle New Lead Customer
            if (!finalCustId) {
            let imageUrl = null;

            // Pehle photo upload try karo (agar file select ki hai)
            if (formData.customerPhoto) {
                imageUrl = await uploadCustomerPhoto(formData.customerPhoto);
            }

            let finalBusinessType = formData.businessType;

            if (formData.businessType === 'Other') {
                if (formData.customBusinessType.trim()) {
                finalBusinessType = formData.customBusinessType.trim();
                } else {
                finalBusinessType = 'Other';
                }
            }
                
            const hashedPassword = bcrypt.hashSync(formData.password, 8);


                const { data: leadData, error: leadError } = await supabase
                    .from('customers')
                    .insert([{
                        business_name: formData.businessName,
                        owner_name: formData.ownerName || null,
                        email: formData.email || `lead-${Date.now()}@temp.com`,
                        password: hashedPassword,
                        phone: formData.phone || null,
                        address: formData.address || null,
                        business_type: finalBusinessType,
                        status: 'Lead',
                        image_url: imageUrl,           // ← yahan URL save ho jayega
                    }])
                    .select();

                if (leadError) throw leadError;

                finalCustId = leadData[0].id;

                // QR Logic (same as before)
                try {
                    const qrContent = JSON.stringify({ id: finalCustId, type: 'customer', name: formData.businessName });
                    finalQrUrl = await QRCode.toDataURL(qrContent);
                    await supabase.from('customers').update({ qr_code_url: finalQrUrl }).eq('id', finalCustId);
                } catch (qrErr) {
                    console.error('QR generation/update failed:', qrErr);
                }
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
                    business_type: finalBusinessType,
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
                const inventoryRows = await Promise.all(
                extinguishers.map(async (item, idx) => {
                let voiceUrl = null;
                let photoUrl = null;

                if (item.mode === 'Maintenance') {
                    if (item.maintenanceVoiceNote) {
                    voiceUrl = await uploadMaintenanceVoice(item.maintenanceVoiceNote, idx);
                    }
                    if (item.maintenanceUnitPhoto) {
                    photoUrl = await uploadMaintenancePhoto(item.maintenanceUnitPhoto, idx);
                    }
                }

                return {
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
                    price: item.price,
                    firefighting_system: item.firefightingSystem || null,
                    fire_alarm_system: item.fireAlarmSystem || null,
                    pump_type: item.pumpType || null,

                    maintenance_notes: item.maintenanceNotes || null,
                    maintenance_voice_url: voiceUrl,
                    maintenance_unit_photo_url: photoUrl,
                };
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
                                <Input label="Phone Contact" name="phone" type='number' value={formData.phone} onChange={handleInputChange} required={isNewCustomer} />
                                <Input label="Email Address" name="email" type='email' value={formData.email} onChange={handleInputChange} />
                                <div className="relative w-full">
                                <Input label="Password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleInputChange} required={isNewCustomer} placeholder="Customer login password" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-[38px] text-gray-500"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                                </div>
                                <div className="md:col-span-1 relative">
    <Input 
        label="Site Address" 
        name="address" 
        value={formData.address} 
        onChange={handleInputChange} 
        placeholder={isFetchingLocation ? "Fetching location..." : "Enter site address or use button"}
        disabled={isFetchingLocation} 
    />
    <button 
        onClick={fetchLocation} 
        disabled={isFetchingLocation}
        className={`absolute right-2 top-8 p-2 rounded-lg transition-colors ${isFetchingLocation ? 'text-gray-400 cursor-wait' : 'text-primary-600 hover:bg-primary-50'}`}
        title="Get Current Location"
    >
        {isFetchingLocation ? (
            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
        ) : (
            <MapPin size={20} />
        )}
    </button>
</div>
                                <div className="md:col-span-2 space-y-4">
                                <div>
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
                                        <option>Other</option>   {/* ← yeh add kar diya */}
                                    </select>
                                </div>

                                {formData.businessType === 'Other' && (
                                    <div className="animate-fade-in pl-1">
                                        <label className="block text-sm font-medium text-slate-600 mb-1">
                                            Specify business type
                                        </label>
                                        <input
                                            type="text"
                                            name="customBusinessType"
                                            value={formData.customBusinessType}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Beauty Salon, Car Wash, Gym, etc."
                                            className="input-field"
                                            required   // agar chaaho to required rakh sakte ho
                                        />
                                    </div>
                                )}
                                </div>
                                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Customer Image (clear image of client office space/building)</label>
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
                                <div className="absolute -top-5 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                  {!ext.isLocked && (
            <button
                onClick={() => {
                    setExtinguishers(prev =>
                        prev.map((item, i) =>
                            i === index ? { ...item, isLocked: true, hasChanges: false } : item
                        )
                    );
                }}
                disabled={!ext.hasChanges}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm transition-all ${
                    ext.hasChanges
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title="Save and lock this unit"
            >
                <Save size={16} />
                Save
            </button>
        )}

        {/* Edit button – sirf jab locked ho */}
        {ext.isLocked && (
            <button
                onClick={() => setExtinguishers(prev => prev.map((item, i) => i === index ? { ...item, isLocked: false } : item))}
                className="p-2 bg-white text-blue-500 rounded-lg shadow-sm border border-slate-200 hover:text-blue-600"
                title="Edit / Unlock"
            >
                <Pencil size={16} />
            </button>
        )}
                                  <button onClick={() => removeExtinguisher(index)} className="p-2 bg-white text-red-500 rounded-lg shadow-sm border border-slate-200 hover:text-red-600">
                                      <Trash size={16} />
                                  </button>
                              </div>

                                <div className="grid grid-cols-4 gap-2  mb-4 pb-4 border-b border-slate-200/50">
                                        {['Validation', 'Refill', 'New Unit', 'Maintenance'].map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => !ext.isLocked && handleExtinguisherChange(index, 'mode', m)} // NEW: Disable if locked
                                                disabled={ext.isLocked && ext.mode !== m} // NEW: Disable others if locked
                                                className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                                                    ext.mode === m ? 'bg-primary-500 text-white shadow-md' : 
                                                    (ext.isLocked ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50')
                                                }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pb-4'>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Type</label>
                                        <select value={ext.type} onChange={(e) => handleExtinguisherChange(index, 'type', e.target.value)} disabled={ext.isLocked} className="input-field py-2 text-sm">
                                            <option>ABC Dry Powder</option>
                                            <option>CO2 - Carbon Dioxide</option>
                                            <option>Water Type</option>
                                            <option>Mechanical Foam</option>
                                            <option>Wet Chemical</option>
                                            <option>Other</option>           {/* ← yeh add karo */}
                                        </select>

                                {ext.type === 'Other' && (
                                    <div className="mt-3 animate-fade-in">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                            Specify Type
                                        </label>
                                        <input
                                            type="text"
                                            value={ext.customType || ''}
                                            onChange={(e) => handleExtinguisherChange(index, 'customType', e.target.value)}
                                            placeholder="e.g. Clean Agent, Dry Chemical Special, etc."
                                            className="input-field py-2 text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Capacity</label>
                                        <select value={ext.capacity} disabled={ext.isLocked} onChange={(e) => handleExtinguisherChange(index, 'capacity', e.target.value)} className="input-field py-2 text-sm">
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
  <div className="col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  {/* Fire Fighting System */}
  <div>
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
      Fire Fighting System
    </label>
    <select
    value={ext.firefightingSystem || ''}
    onChange={(e) => handleExtinguisherChange(index, 'firefightingSystem', e.target.value)}
    className="input-field py-2 text-sm"
    >
        <option value="">Select...</option>
        {FIRE_SYSTEMS.firefighting.map((item) => (
        <option key={item.name} value={item.name}>
        {item.name}
      </option>
      ))}
        <option value="Other">Other</option>
    </select>
    {ext.firefightingSystem === 'Other' && (
        <input
        type="text"
        placeholder="Specify Other"
        value={ext.customFirefighting || ''}
        onChange={(e) => handleExtinguisherChange(index, 'customFirefighting', e.target.value)}
        className="input-field py-2 mt-2 text-sm"
        />
    )}
    </div>

    {/* Fire Alarm System */}
    <div>
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
        Fire Alarm System
    </label>
    <select
        value={ext.fireAlarmSystem || ''}
        onChange={(e) => handleExtinguisherChange(index, 'fireAlarmSystem', e.target.value)}
        className="input-field py-2 text-sm"
    >
        <option value="">Select...</option>
        {FIRE_SYSTEMS.fireAlarm.map((item) => (
        <option key={item.name} value={item.name}>
        {item.name}
      </option>
      ))}
    <option value="Other">Other</option>
    </select>
    {ext.fireAlarmSystem === 'Other' && (
        <input
        type="text"
        placeholder="Specify Other"
        value={ext.customFireAlarm || ''}
        onChange={(e) => handleExtinguisherChange(index, 'customFireAlarm', e.target.value)}
        className="input-field py-2 mt-2 text-sm"
        />
    )}
    </div>

      {/* Pump Type */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          Pump Type
        </label>
        <select
          value={ext.pumpType || ''}
          onChange={(e) => handleExtinguisherChange(index, 'pumpType', e.target.value)}
          className="input-field py-2 text-sm"
        >
          <option value="">Select...</option>
          {FIRE_SYSTEMS.pumps.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
        {ext.pumpType === 'Other' && (
          <input
            type="text"
            placeholder="Specify Other"
            value={ext.customPump || ''}
            onChange={(e) => handleExtinguisherChange(index, 'customPump', e.target.value)}
            className="input-field py-2 mt-2 text-sm"
          />
        )}
      </div>
    </div>
    <div className='col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          Partner
        </label>
        <select
          value={ext.partner || ''}
          onChange={(e) => handleExtinguisherChange(index, 'partner', e.target.value)}
          className="input-field py-2 text-sm"
        >
          <option value="">Select Partner</option>
          <option>FireShield Services</option>
          <option>SafetyFirst Refilling</option>
          <option>Al-Faisal Fire Equipment</option>
          <option>Guardian Fire Solutions</option>
          <option>United Fire Protection</option>
          <option>Other</option>
        </select>

        {ext.partner === 'Other' && (
          <div className="mt-3 animate-fade-in">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
              Specify Partner Name
            </label>
            <input
              type="text"
              value={ext.customPartner || ''}
              onChange={(e) => handleExtinguisherChange(index, 'customPartner', e.target.value)}
              placeholder="e.g. ABC Fire Refilling Co."
              className="input-field py-2 text-sm"
            />
          </div>
        )}
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Seller</label>
        <input 
          value={ext.seller} 
          onChange={(e) => handleExtinguisherChange(index, 'seller', e.target.value)} 
          className="input-field py-2 text-sm" 
          placeholder="Seller Name" 
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Brand</label>
        <input 
          value={ext.brand} 
          onChange={(e) => handleExtinguisherChange(index, 'brand', e.target.value)} 
          className="input-field py-2 text-sm" 
          placeholder="Brand Name" 
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantity</label>
        <input 
          type="number" 
          value={ext.quantity} 
          onChange={(e) => handleExtinguisherChange(index, 'quantity', parseInt(e.target.value) || 1)} 
          className="input-field py-2 text-sm" 
        />
      </div>
    </div>

    

    {['Other', 'Other', 'Other'].includes(ext.firefightingSystem) || ['Other', 'Other', 'Other'].includes(ext.fireAlarmSystem) || ['Other', 'Other', 'Other'].includes(ext.pumpType) ? (
      <div className="col-span-4 mt-2 text-sm text-orange-700 font-medium">
       Note: Price and availability confirmed by the company
      </div>
    ) : null}

    <div className="col-span-4 mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-4">
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Base Price</label>
        <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
          SAR 180
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Fire Fighting MTP</label>
        <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
          SAR {ext.firefightingSystem !== 'Other' ? FIRE_SYSTEMS.firefighting.find(it => it.name === ext.firefightingSystem)?.price || 0 : 0}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Fire Alarm MTP</label>
        <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
          SAR {ext.fireAlarmSystem !== 'Other' ? FIRE_SYSTEMS.fireAlarm.find(it => it.name === ext.fireAlarmSystem)?.price || 0 : 0}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Pump MTP</label>
        <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
          SAR {ext.pumpType !== 'Other' ? FIRE_SYSTEMS.pumps.find(it => it.name === ext.pumpType)?.price || 0 : 0}
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
        <label className="text-xs font-bold text-green-800 uppercase tracking-wider mb-1 block">Final Price (SAR)</label>
        <div className="text-xl font-bold text-green-700">
          SAR {ext.price}
        </div>
      </div>
    </div>
  </>
)}


                                    {ext.mode === 'Refill' && (
    <>
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Partner</label>
            <select
                value={ext.partner}
                onChange={(e) => handleExtinguisherChange(index, 'partner', e.target.value)}
                className="input-field py-2 text-sm"
            >
                <option value="">Select Partner</option>
                <option>FireShield Services</option>
                <option>SafetyFirst Refilling</option>
                <option>Al-Faisal Fire Equipment</option>
                <option>Guardian Fire Solutions</option>
                <option>United Fire Protection</option>
                <option>Other</option>
            </select>

            {ext.partner === 'Other' && (
                <div className="mt-3 animate-fade-in">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                        Specify Partner Name
                    </label>
                    <input
                        type="text"
                        value={ext.customPartner || ''}
                        onChange={(e) => handleExtinguisherChange(index, 'customPartner', e.target.value)}
                        placeholder="e.g. ABC Fire Refilling Co."
                        className="input-field py-2 text-sm"
                    />
                </div>
            )}
        </div>

        {/* --- Quantity Input --- */}
        <div className="">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantity</label>
            <input
                type="number"
                value={ext.quantity}
                min={1}
                onChange={(e) => handleExtinguisherChange(index, 'quantity', parseInt(e.target.value) || 1)}
                className="input-field py-2 text-sm"
            />
        </div>
    </>
)}

                                    {ext.mode === 'Maintenance' && (
  <>
    <div className="col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Fire Fighting System */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          Fire Fighting System
        </label>
        <select
          value={ext.firefightingSystem || ''}
          onChange={(e) => handleExtinguisherChange(index, 'firefightingSystem', e.target.value)}
          className="input-field py-2 text-sm"
        >
          <option value="">Select...</option>
          {FIRE_SYSTEMS.firefighting.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
        {ext.firefightingSystem === 'Other' && (
          <input
            type="text"
            placeholder="Specify Other"
            value={ext.customFirefighting || ''}
            onChange={(e) => handleExtinguisherChange(index, 'customFirefighting', e.target.value)}
            className="input-field py-2 mt-2 text-sm"
          />
        )}
      </div>

      {/* Fire Alarm System */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          Fire Alarm System
        </label>
        <select
          value={ext.fireAlarmSystem || ''}
          onChange={(e) => handleExtinguisherChange(index, 'fireAlarmSystem', e.target.value)}
          className="input-field py-2 text-sm"
        >
          <option value="">Select...</option>
          {FIRE_SYSTEMS.fireAlarm.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
        {ext.fireAlarmSystem === 'Other' && (
          <input
            type="text"
            placeholder="Specify Other"
            value={ext.customFireAlarm || ''}
            onChange={(e) => handleExtinguisherChange(index, 'customFireAlarm', e.target.value)}
            className="input-field py-2 mt-2 text-sm"
          />
        )}
      </div>

      {/* Pump Type */}
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          Pump Type
        </label>
        <select
          value={ext.pumpType || ''}
          onChange={(e) => handleExtinguisherChange(index, 'pumpType', e.target.value)}
          className="input-field py-2 text-sm"
        >
          <option value="">Select...</option>
          {FIRE_SYSTEMS.pumps.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value="Other">Other</option>
        </select>
        {ext.pumpType === 'Other' && (
          <input
            type="text"
            placeholder="Specify Other"
            value={ext.customPump || ''}
            onChange={(e) => handleExtinguisherChange(index, 'customPump', e.target.value)}
            className="input-field py-2 mt-2 text-sm"
          />
        )}
      </div>
    </div>

    <div className="col-span-4 space-y-6">

      {/* Voice + Text in one row (flex/grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Voice Note */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-3">
            Unit Voice Note (max 250 KB)
          </label>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onMouseDown={() => startUnitRecording(index)}
              onMouseUp={stopUnitRecording}
              onTouchStart={() => startUnitRecording(index)}
              onTouchEnd={stopUnitRecording}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                recordingIndex === index && isRecording
                  ? 'bg-red-500 animate-pulse text-white scale-110 shadow-lg shadow-red-500/30'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {recordingIndex === index && isRecording ? <Square size={20} /> : <Mic size={20} />}
            </button>

            <div className="flex-1">
              <p className="font-medium text-slate-800 text-sm">
                {recordingIndex === index && isRecording
                  ? `Recording... ${recordingTime}s`
                  : ext.maintenanceVoiceNote
                  ? 'Voice note recorded'
                  : 'Hold to record'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Condition, issues, recommendations...
              </p>

              {unitVoiceWarnings[index] && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {unitVoiceWarnings[index]}
                </p>
              )}
            </div>

            {ext.maintenanceVoiceNote && recordingIndex !== index && (
              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                <audio
                  src={URL.createObjectURL(ext.maintenanceVoiceNote)}
                  controls
                  className="h-8 w-40"
                />
                <button
                  onClick={() => {
                    setExtinguishers(prev => prev.map((it, i) =>
                      i === index ? { ...it, maintenanceVoiceNote: null } : it
                    ));
                    setUnitVoiceWarnings(prev => {
                      const copy = { ...prev };
                      delete copy[index];
                      return copy;
                    });
                  }}
                  className="text-red-500 hover:text-red-600 text-xs"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Text Notes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-3">
            Maintenance Notes / Observations
          </label>
          <textarea
            value={ext.maintenanceNotes || ''}
            onChange={(e) => handleExtinguisherChange(index, 'maintenanceNotes', e.target.value)}
            className="w-full h-28 resize-none border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            placeholder="Condition, problems found, work done, recommendations for this unit..."
          />
        </div>
      </div>

      {/* Photo – neeche full width */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">
          Unit Picture <span className="text-xs text-slate-500 font-normal">(recommended)</span>
        </label>
        <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center hover:border-primary-500 transition-colors cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setExtinguishers(prev => prev.map((it, i) =>
                  i === index ? { ...it, maintenanceUnitPhoto: file } : it
                ));
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          {ext.maintenanceUnitPhoto ? (
            <div className="flex flex-col items-center">
              <img
                src={URL.createObjectURL(ext.maintenanceUnitPhoto)}
                alt="Unit preview"
                className="h-24 w-24 object-cover rounded-lg mb-3 border shadow-sm"
              />
              <p className="text-xs text-slate-600">Click to change</p>
            </div>
          ) : (
            <>
              <Camera size={32} className="text-slate-400 mb-3" />
              <p className="text-sm text-slate-500">Tap to upload unit photo</p>
            </>
          )}
        </div>
      </div>
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
                            <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">
                                Site Voice Note (max 250 KB)
                            </label>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <button
                                    onMouseDown={startRecording}
                                    onMouseUp={stopRecording}
                                    onTouchStart={startRecording}
                                    onTouchEnd={stopRecording}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isRecording ? 'bg-red-500 animate-pulse text-white scale-110 shadow-lg shadow-red-500/30' : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-primary-500 hover:text-primary-500'}`}
                                >
                                    {isRecording ? <Square size={24} /> : <Mic size={24} />}
                                </button>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-900">{isRecording ? `Recording... ${recordingTime}s` : formData.voiceNote ? 'Voice Note Captured' : 'Hold to Record'}</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Max allowed size: <strong>250 KB</strong> • Record shorter if warning appears
                                    </p>

                                    {voiceNoteSizeWarning && (
                                        <p className="text-sm text-red-600 mt-2 font-medium flex items-center gap-2">
                                            <AlertTriangle size={16} /> {voiceNoteSizeWarning}
                                        </p>
                                    )}
                                </div>
                                {formData.voiceNote && !isRecording && (
                                    <div className="flex items-center gap-3 mt-3 sm:mt-0">
                                        <audio
                                            src={URL.createObjectURL(formData.voiceNote)}
                                            controls
                                            className="h-8 w-48"
                                        />
                                        <button
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, voiceNote: null }));
                                                setVoiceNoteSizeWarning('');
                                            }}
                                            className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                                        >
                                            <Trash size={14} /> Remove
                                        </button>
                                    </div>
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

const Input = ({ label, name, value, onChange, placeholder, required = false, type = "text" }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} type={type}                className="input-field" />
    </div>
);

export default VisitForm;
