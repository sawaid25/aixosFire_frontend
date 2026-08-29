import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import PageLoader from '../../components/PageLoader';
import QRCode from 'qrcode';
import { createInquiryViaSupabase } from '../../api/inquirySupabase';
import { getVisitSubmitErrorMessage } from '../../api/submitErrors';
import {
  Plus, Trash, Save, ArrowLeft, Building, FireExtinguisher, FileText,
  Search, Check, AlertTriangle, ArrowRight, UserPlus, MapPin, Camera, Image, Mic, Square,
  Pencil, History, Calendar, ScanLine, CheckCircle2, XCircle,
  X, RefreshCw, Smartphone
} from 'lucide-react';
import client from '../../api/client';
import { useRef } from 'react';
import imageCompression from 'browser-image-compression';
import CameraCapture from '../../components/CameraCapture';
import CustomerHistoryModal from '../../components/CustomerHistoryModal';
import VisitQrScanner from '../../components/VisitQrScanner';

const EXPECTED_VISIT_QR = 'TM-EPKSA-A2026';

/** Visit images (customer, validation ref, maintenance unit): max size after compression (45KB) */
const MAX_VISIT_IMAGE_BYTES = 45 * 1024;

async function compressVisitImageFile(file) {
  if (!file?.type?.startsWith('image/')) {
    toast.error('Please choose an image file');
    return null;
  }
  console.log('Original size:', (file.size / 1024).toFixed(2), 'KB');
  try {
    const options = {
      maxSizeMB: MAX_VISIT_IMAGE_BYTES / (1024 * 1024),
      maxWidthOrHeight: 800,
      useWebWorker: true,
    };
    const compressedFile = await imageCompression(file, options);
    console.log('Compressed size:', (compressedFile.size / 1024).toFixed(2), 'KB');
    if (compressedFile.size > MAX_VISIT_IMAGE_BYTES) {
      toast.error('Image must be less than 45KB after compression. Try a simpler photo or lower resolution.');
      return null;
    }
    return compressedFile;
  } catch (err) {
    console.error('Image compression failed:', err);
    toast.error('Could not process image. Try another photo.');
    return null;
  }
}

/** Shared UI for site QR verification; `slotKey` picks which camera instance is active. */
const QrScanFieldGroup = ({
  slotKey,
  qrScannerSlot,
  onQrScannerSlotChange,
  readerId,
  qrCodeValue,
  needsQrScan,
  isQrValid,
  onDecoded,
  hint,
}) => {
  const active = qrScannerSlot === slotKey;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-5 space-y-4 mt-4 md:col-span-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary-100 rounded-xl text-primary-600 shrink-0">
          <ScanLine size={22} />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-800">
            Scan QR Code <span className="font-normal text-slate-400">(Optional)</span>
          </label>
          <p className="text-xs text-slate-500 mt-1">{hint}</p>
          <p className="text-xs text-slate-400 mt-0.5">You can skip this step if QR is not available.</p>
        </div>
      </div>

      {!active ? (
        <button
          type="button"
          onClick={() => onQrScannerSlotChange(slotKey)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors"
        >
          <ScanLine size={18} /> Start camera scan
        </button>
      ) : (
        <div className="space-y-3">
          <VisitQrScanner
            readerId={readerId}
            active={active}
            onDecoded={onDecoded}
          />
          <button
            type="button"
            onClick={() => onQrScannerSlotChange(null)}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-white transition-colors"
          >
            Close camera
          </button>
        </div>
      )}



      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {qrCodeValue === EXPECTED_VISIT_QR ? (
          <span className="flex items-center gap-1.5 text-green-700">
            <CheckCircle2 size={18} aria-hidden /> Verified
          </span>
        ) : null}
        {qrCodeValue && qrCodeValue !== EXPECTED_VISIT_QR ? (
          <span className="flex items-center gap-1.5 text-red-600">
            <XCircle size={18} aria-hidden /> Invalid
          </span>
        ) : null}
      </div>
    </div>
  );
};

const getDefaultUnit = (material) => {
  if (['Pipes', 'Hose Reels', 'Hydrants'].includes(material)) return 'Meter';
  return 'Pieces';
};

const VisitForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);     // ← NEW: chunks store karenge
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationModal, setLocationModal] = useState({ open: false, type: null });
  const [recordingIndex, setRecordingIndex] = useState(null);
  const [unitVoiceWarnings, setUnitVoiceWarnings] = useState({});
  const [partners, setPartners] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  // Per-partner assigned-product cache, keyed by partner id — fetched once per
  // partner the agent selects, not on every render.
  const [partnerProductsCache, setPartnerProductsCache] = useState({});
  const [loadingPartnerProducts, setLoadingPartnerProducts] = useState({});
  const debounceTimers = useRef([]);
  const searchDebounceRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null); // 'customer' or 'unit'
  const [activeUnitIndex, setActiveUnitIndex] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    const fetchPartners = async () => {
      setLoadingPartners(true);
      try {
        const { data, error } = await supabase
          .from('partners')
          .select('id, business_name')
          .eq('status', 'Active');
        if (error) throw error;
        setPartners(data || []);
      } catch (err) {
        console.error('Error fetching partners:', err);
      } finally {
        setLoadingPartners(false);
      }
    };
    fetchPartners();
  }, []);

  const fetchPartnerProducts = async (partnerId) => {
    if (!partnerId || partnerId === 'Other' || partnerProductsCache[partnerId]) return;
    setLoadingPartnerProducts(prev => ({ ...prev, [partnerId]: true }));
    try {
      const { data, error } = await supabase
        .from('partner_products')
        .select('product_id, products!inner(id, name, model_number, description, image_url, is_active, categories(name))')
        .eq('partner_id', partnerId)
        .eq('products.is_active', true);
      if (error) throw error;
      const products = (data || [])
        .map(row => row.products)
        .filter(Boolean)
        .map(p => ({ ...p, category: p.categories?.name || 'Other' }));
      setPartnerProductsCache(prev => ({ ...prev, [partnerId]: products }));
    } catch (err) {
      console.error('Error fetching partner products:', err);
      setPartnerProductsCache(prev => ({ ...prev, [partnerId]: [] }));
    } finally {
      setLoadingPartnerProducts(prev => ({ ...prev, [partnerId]: false }));
    }
  };

  const handlePartnerSelect = (index, partnerId) => {
    handleExtinguisherChange(index, 'partner', partnerId);
    fetchPartnerProducts(partnerId);
  };

  /** Product picker shown once a real (non-"Other") Partner is selected — only that Partner's active assigned products appear. */
  const renderProductPicker = (ext, index) => {
    if (!ext.partner || ext.partner === 'Other') return null;
    const isLoading = Boolean(loadingPartnerProducts[ext.partner]);
    const products = partnerProductsCache[ext.partner] || [];
    const selected = products.find(p => p.id === ext.productId);

    // Group by category so the Agent picks within the right family of
    // equipment instead of scanning one long flat list.
    const grouped = products.reduce((acc, p) => {
      const key = p.category || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    return (
      <div className="md:col-span-4">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          Assigned Product <span className="normal-case text-slate-400">(optional)</span>
        </label>
        {isLoading ? (
          <div className="input-field py-2 text-sm text-slate-400">Loading assigned products…</div>
        ) : products.length === 0 ? (
          <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            This partner has no active products assigned yet. Continue with the fields above, or ask Admin to assign products to this partner.
          </div>
        ) : (
          <>
            <select
              value={ext.productId || ''}
              onChange={(e) => handleExtinguisherChange(index, 'productId', e.target.value)}
              className="input-field py-2 text-sm"
            >
              <option value="">No specific product</option>
              {Object.entries(grouped).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.model_number ? `${p.model_number} — ${p.name}` : p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selected?.description && (
              <p className="text-xs text-slate-400 mt-1.5">{selected.description}</p>
            )}
          </>
        )}
      </div>
    );
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


  const FIRE_FIGHTING_CATEGORIES = {
    "Fire Fighting System": [
      "Sprinklers",
      "Pipes",
      "Gate Valves",
      "Zone Control Valves",
      "Hydrants",
      "Hose Reels",
      "Foam System"
    ],
    "Fire Alarm System": [
      "Manual Pull Stations",
      "Smoke Detectors",
      "Heat Detectors",
      "Notification Appliances",
      "Control Panel",
      "Voice Evacuation System",
      "Beam Detectors"
    ],
    "Fire Pumps": [
      "Electric Fire Pump",
      "Diesel Fire Pump",
      "Jockey Pump",
      "Centrifugal Pump",
      "Vertical Turbine Pump",
      "Booster Pump"
    ],
    "Tanks": [
      "Water Storage Tank",
      "Foam Tank",
      "Pressure Tank"
    ]
  };

  const MAX_VOICE_DURATION = 40;

  // Form Data
  const [formData, setFormData] = useState({
    customerId: null,
    businessName: '', ownerName: '', phone: '', email: '',
    address: '', businessType: 'Retail Store - Grocery',
    customBusinessType: '',
    notes: '', riskAssessment: '', serviceRecommendations: '',
    followUpDate: '',
    followUpHistory: [],
    customerPhoto: null,
    voiceNote: null,
    performedBy: 'Agent',
  });

  const [qrPreview, setQrPreview] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSelectedCustomerImageLoading, setIsSelectedCustomerImageLoading] = useState(false);
  const [selectedCustomerImageError, setSelectedCustomerImageError] = useState(false);

  const [extinguishers, setExtinguishers] = useState([
    {
      mode: 'Validation',
      type: 'ABC Dry Powder',
      customType: '',
      capacity: '6kg',
      quantity: 1,
      brand: '',
      seller: '',
      partner: '',
      customPartner: '',
      productId: '',
      refillStatus: 'Required',
      price: 180,
      expiryDate: '',
      firefightingSystem: '',
      maintenanceVoiceNote: null,
      maintenanceNotes: '',
      maintenanceUnitPhoto: null,
      isLocked: false,
      hasChanges: false,
      newUnits: [],
      customMaterial: '',
      validationPhoto: null,
      validation_mode: 'new',
      validationFollowUpDate: '',
      qrCodeValue: '',
    }
  ]);

  /** Which inline scanner is open, e.g. `v-0` (Validation) or `r-1` (Refill); only one camera at a time */
  const [qrScannerSlot, setQrScannerSlot] = useState(null);
  // keyed by extinguisher index to debounce duplicate invalid-QR toasts
  const lastQrToastRef = useRef({});

  const needsQrScan = useMemo(
    () =>
      extinguishers.some(
        (ext) =>
          ext.mode === 'Refill' ||
          (ext.mode === 'Validation' && (ext.validation_mode || 'new') === 'new')
      ),
    [extinguishers]
  );

  /** True when any unit has a scanned QR that doesn't match the expected code */
  const hasAnyInvalidQr = extinguishers.some(
    (ext) => ext.qrCodeValue && ext.qrCodeValue !== EXPECTED_VISIT_QR
  );

  useEffect(() => {
    if (selectedCustomer) {
      console.log('selectedCustomer:', selectedCustomer);
    }
  }, [selectedCustomer]);

  const customerInitial = (customer) => {
    const label = customer?.business_name || customer?.owner_name || formData.businessName || '';
    return String(label).trim().charAt(0).toUpperCase() || 'C';
  };

  const inquiryTypeNeedsPartner = (typeValue) => {
    const t = String(typeValue || '').trim().toLowerCase();
    return t === 'validation' || t === 'refill' || t === 'refilled';
  };

  const handleQrDecoded = (text, extIndex) => {
    const qrValue = (text || '').trim();
    handleExtinguisherChange(extIndex, 'qrCodeValue', qrValue);
    if (qrValue === EXPECTED_VISIT_QR) {
      toast.success('QR Code Verified');
      setQrScannerSlot(null);
      delete lastQrToastRef.current[extIndex];
      return;
    }
    if (lastQrToastRef.current[extIndex] !== qrValue) {
      toast.error('Invalid QR Code');
      lastQrToastRef.current[extIndex] = qrValue;
    }
  };

  const handleNewUnitChange = (unitIndex, field, value) => {
    setExtinguishers(prev =>
      prev.map((item, i) => {
        if (i !== unitIndex) return item;
        if (item.isLocked) return item;

        const updated = { ...item, [field]: value, hasChanges: true };

        // Auto-set unit type based on material (if it's a pipe)
        if (field === 'material') {
          const isPipe = ['Pipes'].includes(value); // Add more pipe-related names if needed
          updated.unit = isPipe ? 'Meter' : 'Pieces';
        }

        // Recalculate price if needed (you can expand this later)
        if (['firefightingSystem', 'material', 'unit', 'quantity'].includes(field)) {
          // Your existing price logic or keep base 180
          updated.price = 180; // Placeholder – you can customize per material later
        }

        return updated;
      })
    );
  };

  const addNewUnit = (extIndex) => {
    setExtinguishers(prev =>
      prev.map((item, i) => {
        if (i !== extIndex) return item;

        // Agar required fields empty hain to kuch mat add kar
        if (!item.firefightingSystem || !item.material || (item.quantity || 0) < 1) {
          alert("Please select Fire Fighting System, Material and Quantity before adding.");
          return item;
        }

        // Check for 'Other' validation
        if (item.firefightingSystem === 'Other' && (!item.customFirefightingSystem || !item.customFirefightingSystem.trim())) {
          alert("Please specify the System name.");
          return item;
        }

        if (item.material === 'Other' && (!item.customMaterial || !item.customMaterial.trim())) {
          alert("Please specify the Material name.");
          return item;
        }

        const newSubUnit = {
          firefightingSystem: item.firefightingSystem === 'Other' ? item.customFirefightingSystem : item.firefightingSystem,
          material: item.material === 'Other' ? item.customMaterial : item.material,
          unit: item.unit || 'Pieces',
          quantity: item.quantity || 1,
          catalog_no: `CAT-${Math.floor(1000 + Math.random() * 9000)}`
        };

        return {
          ...item,
          newUnits: [...(item.newUnits || []), newSubUnit],
          firefightingSystem: '',   // reset
          material: '',
          unit: 'Pieces',
          quantity: 1
        };
      })
    );
  };
  useEffect(() => {
    extinguishers.forEach((ext, index) => {
      if (ext.mode === 'Validation' && ext.hasChanges && !ext.isLocked) {
        if (debounceTimers.current[index]) clearTimeout(debounceTimers.current[index]);
        debounceTimers.current[index] = setTimeout(() => {
          setExtinguishers(prev =>
            prev.map((item, i) =>
              (i === index && item.mode === 'Validation' && item.hasChanges)
                ? { ...item, isLocked: true, hasChanges: false }
                : item
            )
          );
        }, 8000); // 8 seconds debounce — gives the agent time to fill Type/Capacity/Partner/Photo before auto-lock
      }
    });
    return () => debounceTimers.current.forEach(timer => clearTimeout(timer));
  }, [extinguishers]);

  // Handlers
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (query.trim().length > 0) {
      setIsSearching(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          // Search by name, phone, or ID (if numeric)
          let searchFilter = `business_name.ilike.%${query}%,phone.ilike.%${query}%`;
          if (/^\d+$/.test(query)) {
            searchFilter += `,id.eq.${query}`;
          }

          const { data, error } = await supabase
            .from('customers')
            .select('id, business_name, owner_name, email, phone, address, business_type, image_url, qr_code_url')
            .or(searchFilter)
            .limit(10);

          if (error) throw error;
          setSearchResults(data);
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
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
    setFormData((prev) => ({
      ...prev,
      customerId: cust.id,
      businessName: cust.business_name || '',
      ownerName: cust.owner_name || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      businessType: cust.business_type || 'Retail Store - Grocery',
      customerPhoto: null,
    }));
    setSelectedCustomer(cust || null);
    setSelectedCustomerImageError(false);
    setIsSelectedCustomerImageLoading(Boolean(cust?.image_url));
    setSearchResults([]);
    setSearchQuery(''); // Clear search query immediately
    setIsNewCustomer(false);
    setIsEditingCustomer(false); // Reset edit mode on selection
  };



  const handleUpdateCustomer = async () => {
    if (!formData.customerId) return;
    setLoading(true);
    try {
      const custId = formData.customerId;
      let finalBusinessType = formData.businessType;
      if (formData.businessType === 'Other' && formData.customBusinessType.trim()) {
        finalBusinessType = formData.customBusinessType.trim();
      }

      // 1. Persist updated customer info
      // location_lat/lng only included when the agent fetched them via the
      // location icon this session — a plain manual address edit leaves
      // whatever coordinates (if any) already saved on the customer untouched.
      const { error: updateErr } = await supabase
        .from('customers')
        .update({
          business_name: formData.businessName,
          owner_name: formData.ownerName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          business_type: finalBusinessType,
          last_updated: new Date().toISOString(),
          ...(formData.lat != null && formData.lng != null
            ? { location_lat: formData.lat, location_lng: formData.lng }
            : {}),
        })
        .eq('id', custId);

      if (updateErr) throw updateErr;

      // 2. Regenerate QR code
      let qrDataUrl = null;
      let qrUrl = null;
      try {
        qrUrl = `${window.location.origin}/agent/customer/${custId}`;
        qrDataUrl = await QRCode.toDataURL(qrUrl, {
          errorCorrectionLevel: 'M',
          width: 256,
          margin: 2,
        });
        const { error: qrUpdateErr } = await supabase
          .from('customers')
          .update({ qr_code_url: qrDataUrl, last_updated: new Date().toISOString() })
          .eq('id', custId);
        if (qrUpdateErr) throw qrUpdateErr;
        setQrPreview(qrDataUrl);
      } catch (qrErr) {
        toast.error('QR regeneration failed: ' + (qrErr?.message || qrErr));
        console.error('[QR] Regeneration failed:', qrErr);
      }

      // 3. Insert QR history record (only if QR was generated successfully)
      if (qrDataUrl && qrUrl) {
        try {
          const { count, error: countErr } = await supabase
            .from('customer_qr_history')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', custId);
          if (countErr) throw countErr;

          const payload = {
            customer_id: custId,
            business_name: formData.businessName,
            owner_name: formData.ownerName || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            business_type: finalBusinessType || null,
          };

          const { error: histErr } = await supabase
            .from('customer_qr_history')
            .insert({
              customer_id: custId,
              version: (count || 0) + 1,
              qr_data_url: qrDataUrl,
              qr_url_value: qrUrl,
              qr_payload: payload,
              generated_by: user?.name || user?.email || 'Agent',
              reason: 'Customer Information Updated',
            });

          if (histErr) {
            // If qr_payload column missing, retry without it
            if (histErr.code === '42703' && histErr.message?.includes('qr_payload')) {
              const { error: retryErr } = await supabase
                .from('customer_qr_history')
                .insert({
                  customer_id: custId,
                  version: (count || 0) + 1,
                  qr_data_url: qrDataUrl,
                  qr_url_value: qrUrl,
                  generated_by: user?.name || user?.email || 'Agent',
                  reason: 'Customer Information Updated',
                });
              if (retryErr) throw retryErr;
              toast('QR history saved (run migration to enable data snapshots)', { icon: '⚠️' });
            } else {
              throw histErr;
            }
          } else {
            toast.success('QR code updated & history saved');
          }
        } catch (histErr) {
          toast.error('QR history insert failed: ' + (histErr?.message || histErr));
          console.error('[QR History] Insert failed:', histErr);
        }
      }

      setIsEditingCustomer(false);
      toast.success('Customer updated successfully');
    } catch (err) {
      console.error("Update failed:", err);
      toast.error("Failed to update customer: " + err.message);
    } finally {
      setLoading(false);
    }
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

        // Mode change should ALWAYS be allowed and should unlock/reset validation
        if (field === 'mode') {
          return { ...item, mode: value, isLocked: false, hasChanges: false, price: 180 };
        }

        // Photo uploads are always allowed regardless of lock state — each unit owns its photo independently
        if (field === 'validationPhoto') {
          return { ...item, validationPhoto: value };
        }

        // Other fields blocked if locked
        if (item.isLocked) return item;

        const updated = { ...item, [field]: value, hasChanges: true };


        if (field === 'type' && value !== 'Other') updated.customType = '';
        if (field === 'partner') {
          updated.customPartner = value !== 'Other' ? '' : updated.customPartner;
          // A product picked for the previous partner may not belong to the
          // new one — the partner_products DB trigger would reject it anyway,
          // so clear it here rather than let the agent submit a stale pick.
          updated.productId = '';
        }
        if (field === 'material' && value !== 'Other') updated.customMaterial = '';
        if (field === 'firefightingSystem' && value !== 'Other') updated.customFirefightingSystem = '';

        if (field === 'mode') {
          updated.price = 180; // default base
          updated.validation_mode = 'new';
        }

        // Price calculation for BOTH New Unit AND Maintenance
        if (['New Unit', 'Maintenance'].includes(updated.mode) &&
          ['firefightingSystem', 'mode'].includes(field)) {

          const base = 180;

          // Find price from the data object
          const ffItem = FIRE_SYSTEMS.firefighting.find(it => it.name === updated.firefightingSystem);
          const ffPrice = ffItem ? ffItem.price : 0;
          updated.price = base + ffPrice;
        }

        return updated;
      })
    );
  };


  const addExtinguisher = () => {
    setExtinguishers([...extinguishers, {
      mode: 'Validation',
      type: 'ABC Dry Powder', customType: '', capacity: '6kg', quantity: 1,
      brand: '', seller: '', partner: '', customPartner: '', refillStatus: 'Required',
      price: 180, expiryDate: '',
      firefightingSystem: '',
      maintenanceVoiceNote: null,       // ← Add yeh
      maintenanceNotes: '',             // ← Add yeh
      maintenanceUnitPhoto: null,
      isLocked: false,
      hasChanges: false,
      newUnits: [],
      customMaterial: '',
      customFirefightingSystem: '',
      validationPhoto: null,
      validation_mode: 'new',
      validationFollowUpDate: '',
      qrCodeValue: '',
    }]);
  };

  // Directly calls getCurrentPosition — use only when permission is known to be
  // "granted" or "prompt" (the latter triggers the native browser popup).
  // `highAccuracy` is retried automatically once if the first (network-based)
  // attempt times out — desktop Chrome's network location provider can be
  // slow/unreachable, while GPS/OS-level location often still works.
  const doFetchLocation = (highAccuracy = false) => {
    setLocationModal({ open: false, type: null });
    setIsFetchingLocation(true);
    console.log('[Location] calling getCurrentPosition… highAccuracy:', highAccuracy);

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log('[Location] success:', latitude, longitude);
          // Store rounded coords immediately (used in QR payload)
          setFormData(prev => ({
            ...prev,
            lat: parseFloat(latitude.toFixed(5)),
            lng: parseFloat(longitude.toFixed(5)),
          }));
          try {
            const controller = new AbortController();
            const geocodeTimeout = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              { signal: controller.signal }
            );
            clearTimeout(geocodeTimeout);
            if (!response.ok) throw new Error('Failed to fetch address');
            const data = await response.json();
            const readableAddress = data.display_name ||
              `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
            setFormData(prev => ({ ...prev, address: readableAddress }));
          } catch (err) {
            console.error('[Location] reverse geocoding error:', err);
            setFormData(prev => ({
              ...prev,
              address: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`
            }));
            toast('Address lookup failed — coordinates saved instead.', { icon: '📍' });
          } finally {
            setIsFetchingLocation(false);
          }
        },
        (err) => {
          console.warn('[Location] error:', err.code, err.message, 'highAccuracy:', highAccuracy);

          // First attempt (network-based) timed out or had no fix — retry once
          // with high accuracy (GPS/OS location) before giving up.
          if (!highAccuracy && (err.code === 2 || err.code === 3)) {
            doFetchLocation(true);
            return;
          }

          setIsFetchingLocation(false);
          setFormData(prev => ({ ...prev, address: prev.address || '' }));

          if (err.code === 1 /* PERMISSION_DENIED */) {
            setLocationModal({ open: true, type: 'denied' });
          } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
            setLocationModal({ open: true, type: 'unavailable' });
          } else {
            setLocationModal({ open: true, type: 'timeout' });
          }
        },
        {
          // Retry (highAccuracy=true) taps GPS/OS location instead of WiFi/cell/IP —
          // slower to acquire but works in more environments (e.g. desktop dev
          // machines where the network location provider is unreachable).
          enableHighAccuracy: highAccuracy,
          // 15 s gives real GPS fixes room to complete; network-based is usually instant anyway
          timeout: highAccuracy ? 20000 : 15000,
          // accept a cached position up to 30 s old to avoid redundant fetches
          maximumAge: 30000,
        }
      );
    } catch (e) {
      // synchronous throw from getCurrentPosition (rare but possible in some browsers)
      console.error('[Location] getCurrentPosition threw:', e);
      setIsFetchingLocation(false);
      setLocationModal({ open: true, type: 'unavailable' });
    }
  };

  // Entry point — checks permission state first, then decides what to show.
  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      setLocationModal({ open: true, type: 'unsupported' });
      return;
    }

    // navigator.permissions is not available on iOS Safari < 16 — guard it
    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[Location] permission state:', status.state);

        if (status.state === 'granted') {
          // Already allowed — fetch directly, no modal needed
          doFetchLocation();
          return;
        }

        if (status.state === 'denied') {
          // Permanently blocked — show settings instructions, never call getCurrentPosition
          setLocationModal({ open: true, type: 'denied' });
          return;
        }

        // state === 'prompt' — show our custom modal first.
        // When the user taps "Enable Location", doFetchLocation() is called
        // which triggers the real browser permission popup.
        setLocationModal({ open: true, type: 'prompt' });
        return;
      } catch (err) {
        console.warn('[Location] permissions API error (falling back):', err);
        // Fall through to direct call below
      }
    }

    // Fallback for browsers without permissions API (iOS Safari < 16, Firefox)
    // getCurrentPosition itself will trigger the native prompt if needed.
    doFetchLocation();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = '';
      const compressed = await compressVisitImageFile(file);
      if (compressed) {
        // Existing customer: update profile image immediately.
        if (!isNewCustomer && formData.customerId) {
          setLoading(true);
          try {
            const newImageUrl = await uploadCustomerPhoto(compressed);
            if (!newImageUrl) {
              toast.error('Could not upload customer image');
              return;
            }
            const { error: updateErr } = await supabase
              .from('customers')
              .update({
                image_url: newImageUrl,
                last_updated: new Date().toISOString(),
              })
              .eq('id', formData.customerId);
            if (updateErr) throw updateErr;
            setSelectedCustomer((prev) => (
              prev ? { ...prev, image_url: newImageUrl } : { id: formData.customerId, image_url: newImageUrl }
            ));
            setSelectedCustomerImageError(false);
            setIsSelectedCustomerImageLoading(false);
            setFormData(prev => ({ ...prev, customerPhoto: null }));
            toast.success('Customer image updated');
          } catch (err) {
            console.error('Existing customer image update failed:', err);
            toast.error('Failed to update customer image');
          } finally {
            setLoading(false);
          }
          return;
        }

        setFormData(prev => ({ ...prev, customerPhoto: compressed }));
      }
    }
  };

  const handleValidationPhotoUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const compressed = await compressVisitImageFile(file);
    if (compressed) {
      handleExtinguisherChange(index, 'validationPhoto', compressed);
    }
  };

  const handleMaintenanceUnitPhotoUpload = async (index, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const compressed = await compressVisitImageFile(file);
    if (compressed) {
      handleExtinguisherChange(index, 'maintenanceUnitPhoto', compressed);
    }
  };

  console.log(formData)
  /* ── save one QR history record (non-blocking, never throws) ── */
  const saveQrHistory = async (custId, qrDataUrl, qrUrl, reason, payload) => {
    try {
      const { count } = await supabase
        .from('customer_qr_history')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', custId);

      await supabase.from('customer_qr_history').insert({
        customer_id: custId,
        version: (count || 0) + 1,
        qr_data_url: qrDataUrl,
        qr_url_value: qrUrl,
        qr_payload: payload,
        generated_by: user?.name || user?.email || 'Agent',
        reason,
      });
    } catch (err) {
      console.warn('[QR] History save failed:', err);
    }
  };

  const generateQRPreview = async () => {
    if (!formData.businessName) {
      alert("Please enter business name first");
      return;
    }
    setLoading(true);
    try {
      // Track whether this is an existing customer BEFORE any DB insert
      const isExistingCustomer = !isNewCustomer && !!formData.customerId;
      let custId = formData.customerId;

      // New customer: save to DB first to get a real ID
      if (!custId) {
        let finalBusinessType = formData.businessType;
        if (formData.businessType === 'Other' && formData.customBusinessType.trim()) {
          finalBusinessType = formData.customBusinessType.trim();
        }
        const { data: newCust, error: insertErr } = await supabase
          .from('customers')
          .insert([{
            business_name: formData.businessName,
            owner_name: formData.ownerName || null,
            email: formData.email || `lead-${Date.now()}@temp.com`,
            password: '$2a$08$unusable.placeholder.hash.xxxxxxxxxxxxxxxxxxxxxx',
            phone: formData.phone || null,
            address: formData.address || null,
            business_type: finalBusinessType,
            status: 'Lead',
            // Only set when fetched via the location icon — a manually typed
            // address leaves these null (filled later when the customer logs in).
            location_lat: formData.lat ?? null,
            location_lng: formData.lng ?? null,
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        custId = newCust.id;
        setFormData(prev => ({ ...prev, customerId: custId }));
        console.log('[QR] New customer created for QR, id:', custId);

        // Send setup email if real email provided (non-blocking)
        if (formData.email && !formData.email.includes('@temp.com')) {
          client.post('/auth/send-setup-email', {
            customerId: custId,
            email: formData.email,
            businessName: formData.businessName,
          }).catch(err => console.warn('[QR] Setup email failed:', err));
        }
      }

      const url = `${window.location.origin}/agent/customer/${custId}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        width: 256,
        margin: 2,
      });

      // Persist QR URL on the customer record
      await supabase.from('customers').update({
        qr_code_url: qrDataUrl,
        last_updated: new Date().toISOString(),
      }).eq('id', custId);

      // Save QR history record (non-blocking)
      const bType = formData.businessType === 'Other' ? formData.customBusinessType.trim() : formData.businessType;
      saveQrHistory(
        custId,
        qrDataUrl,
        url,
        isExistingCustomer ? 'Customer Information Updated' : 'Initial Customer Creation',
        {
          customer_id: custId,
          business_name: formData.businessName,
          owner_name: formData.ownerName || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          business_type: bType || null,
        }
      );

      setQrPreview(qrDataUrl);
    } catch (err) {
      console.error('[QR] generateQRPreview error:', err);
      alert('Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const MAX_VOICE_NOTE_SIZE = 256000; // bytes

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let localChunks = [];  // ← local variable, state se hataya

      recorder.ondataavailable = (e) => {
        localChunks.push(e.data);
      };

      recorder.onstop = () => {
        if (localChunks.length === 0) {
          console.warn("No chunks captured – recording might be empty");
          return;
        }
        const blob = new Blob(localChunks, { type: 'audio/webm' });
        setFormData(prev => ({ ...prev, voiceNote: blob }));
        localChunks = [];
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingIndex(null);

      return () => stream.getTracks().forEach(track => track.stop());
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
      let localChunks = [];

      recorder.ondataavailable = (e) => {
        localChunks.push(e.data);
      };

      recorder.onstop = () => {
        if (localChunks.length === 0) {
          console.warn(`No chunks for unit ${index} – recording empty`);
          return;
        }
        const blob = new Blob(localChunks, { type: 'audio/webm' });

        setExtinguishers(prev => prev.map((item, i) =>
          i === index ? { ...item, maintenanceVoiceNote: blob } : item
        ));
        setUnitVoiceWarnings(prev => {
          const copy = { ...prev };
          delete copy[index];
          return copy;
        });
        localChunks = [];
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecordingIndex(index);
      setIsRecording(true);
      setRecordingTime(0);
      return () => stream.getTracks().forEach(track => track.stop());
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
        setRecordingTime(prev => {
          const next = prev + 1;
          if (next >= MAX_VOICE_DURATION) {
            if (recordingIndex !== null) {
              stopUnitRecording();
            } else {
              stopRecording();
            }
            clearInterval(interval);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingIndex]);

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

  const uploadPhotoReference = async (file, index) => {
    if (!file) return null;
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `ref-${Date.now()}-${index}.${fileExt}`;
      const filePath = `references/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photo-references')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Photo reference upload error:', uploadError);
        // Fallback to existing bucket if new one isn't ready
        const { error: fallbackError } = await supabase.storage
          .from('visit-unit-photos')
          .upload(filePath, file);

        if (fallbackError) {
          alert('Photo reference upload failed: ' + uploadError.message);
          return null;
        }

        const { data: fallbackUrl } = supabase.storage
          .from('visit-unit-photos')
          .getPublicUrl(filePath);
        return fallbackUrl?.publicUrl || null;
      }

      const { data: urlData } = supabase.storage
        .from('photo-references')
        .getPublicUrl(filePath);

      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('Reference photo upload failed:', err);
      return null;
    }
  };

  const uploadSiteVoice = async (blob, visitId) => {
    if (!blob) return null;

    try {
      const fileName = `site-${visitId}-${Date.now()}.webm`;
      const filePath = `site-voices/${fileName}`;

      const { error } = await supabase.storage
        .from('visit-site-voice-notes')
        .upload(filePath, blob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Site voice upload error:', error);
        return null;
      }

      const { data } = supabase.storage
        .from('visit-site-voice-notes')
        .getPublicUrl(filePath);

      return data?.publicUrl || null;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleSubmit = async () => {
    // Follow-up validation items carry an optional partner (may be left blank),
    // unlike other modes where a partner is mandatory — included here so a
    // partner picked on a follow-up item still counts toward the "same
    // partner across items" check below, but a blank one is simply ignored.
    const partnerValues = extinguishers
      .map(ext => {
        if (ext.partner === 'Other') {
          return ext.customPartner?.trim() ? `custom:${ext.customPartner.trim().toLowerCase()}` : null;
        }
        return ext.partner || null;
      }).filter(p => p !== null);

    const uniquePartners = [...new Set(partnerValues)];

    if (uniquePartners.length > 1) {
      alert("👉 All items must be assigned to the same partner");
      return;
    }

    const invalidQrIndex = extinguishers.findIndex(
      (ext) => ext.qrCodeValue && ext.qrCodeValue !== EXPECTED_VISIT_QR
    );
    if (invalidQrIndex !== -1) {
      toast.error(`Invalid QR Code on unit ${invalidQrIndex + 1}. Scan the correct QR or skip it to proceed.`);
      return;
    }

    if (formData.customerPhoto && formData.customerPhoto.size > MAX_VISIT_IMAGE_BYTES) {
      toast.error('Customer image must be less than 45KB');
      return;
    }

    for (let i = 0; i < extinguishers.length; i++) {
      const item = extinguishers[i];
      if (item.validationPhoto && item.validationPhoto.size > MAX_VISIT_IMAGE_BYTES) {
        toast.error(`Validation photo reference (unit ${i + 1}) must be less than 45KB`);
        return;
      }
      if (item.maintenanceUnitPhoto && item.maintenanceUnitPhoto.size > MAX_VISIT_IMAGE_BYTES) {
        toast.error(`Maintenance unit photo (unit ${i + 1}) must be less than 45KB`);
        return;
      }
    }

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
      // 1. Handle New Lead Customer or Editing Existing
      if (!finalCustId) {
        let imageUrl = null;

        if (formData.customerPhoto) {
          imageUrl = await uploadCustomerPhoto(formData.customerPhoto);
        }

        const { data: leadData, error: leadError } = await supabase
          .from('customers')
          .insert([{
            business_name: formData.businessName,
            owner_name: formData.ownerName || null,
            email: formData.email || `lead-${Date.now()}@temp.com`,
            password: '$2a$08$unusable.placeholder.hash.xxxxxxxxxxxxxxxxxxxxxx',
            phone: formData.phone || null,
            address: formData.address || null,
            business_type: finalBusinessType,
            status: 'Lead',
            image_url: imageUrl,
            // Only set when fetched via the location icon — a manually typed
            // address leaves these null (filled later when the customer logs in).
            location_lat: formData.lat ?? null,
            location_lng: formData.lng ?? null,
          }])
          .select();

        if (leadError) throw leadError;

        finalCustId = leadData[0].id;
        console.log("New Lead Created with ID:", finalCustId);

        // Send setup email if real email provided (non-blocking)
        if (formData.email && !formData.email.includes('@temp.com')) {
          client.post('/auth/send-setup-email', {
            customerId: finalCustId,
            email: formData.email,
            businessName: formData.businessName,
          }).catch(err => console.warn('[Submit] Setup email failed:', err));
        }

        try {
          const qrUrl = `${window.location.origin}/agent/customer/${finalCustId}`;
          finalQrUrl = await QRCode.toDataURL(qrUrl, {
            errorCorrectionLevel: 'M',
            width: 256,
            margin: 2,
          });
          await supabase.from('customers').update({
            qr_code_url: finalQrUrl,
            last_updated: new Date().toISOString()
          }).eq('id', finalCustId);

          // Save QR history record (non-blocking)
          saveQrHistory(
            finalCustId,
            finalQrUrl,
            qrUrl,
            'Initial Customer Creation',
            {
              customer_id: finalCustId,
              business_name: formData.businessName,
              owner_name: formData.ownerName || null,
              phone: formData.phone || null,
              email: formData.email || null,
              address: formData.address || null,
              business_type: finalBusinessType || null,
            }
          );
        } catch (qrErr) {
          console.error('QR generation/update failed:', qrErr);
        }
      }
      // If customer was pre-created during QR generation, sync latest form data to DB
      if (finalCustId && isNewCustomer) {
        let imageUrl = null;
        if (formData.customerPhoto) {
          imageUrl = await uploadCustomerPhoto(formData.customerPhoto);
        }
        await supabase.from('customers').update({
          business_name: formData.businessName,
          owner_name: formData.ownerName || null,
          phone: formData.phone || null,
          address: formData.address || null,
          business_type: finalBusinessType,
          ...(imageUrl && { image_url: imageUrl }),
          last_updated: new Date().toISOString(),
          ...(formData.lat != null && formData.lng != null
            ? { location_lat: formData.lat, location_lng: formData.lng }
            : {}),
        }).eq('id', finalCustId);
      }

      // Note: Existing customer updates are now handled immediately in Step 1 by handleUpdateCustomer

      // SAFEGUARD: Ensure we have a valid Customer ID before proceeding
      if (!finalCustId) {
        throw new Error("Critical Error: No Customer ID linked. Cannot submit visit.");
      }
      console.log("Submitting Visit/Inventory for Customer ID:", finalCustId);

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
          follow_up_date: formData.followUpDate || null,
          status: 'Completed',
          task_types: taskTypes // Maintenance, Refilling, New Queries
        }])
        .select();

      if (visitError) throw visitError;
      const visitId = visitData[0].id;

      // --- SITE ASSESSMENT VOICE ---
      if (formData.voiceNote) {
        const siteVoiceUrl = await uploadSiteVoice(formData.voiceNote, visitId);

        if (siteVoiceUrl) {
          await supabase
            .from('visits')
            .update({ voice_note_url: siteVoiceUrl })
            .eq('id', visitId);
        }
      }


      // 4. Create Inquiry Metadata
      const inquiryNo = `INQ-${Math.floor(100000 + Math.random() * 900000)}`;
      const inquiryType = extinguishers[0]?.mode || 'General';
      const selectedPartnerId = uniquePartners[0] || null;

      // Follow-up validation items don't require a partner — only enforce the
      // requirement if at least one item actually needs one (e.g. a new
      // validation or a refill).
      const hasItemRequiringPartner = extinguishers.some(ext =>
        !(ext.mode === 'Validation' && ext.validation_mode === 'followup') &&
        inquiryTypeNeedsPartner(ext.mode)
      );

      if (hasItemRequiringPartner && !selectedPartnerId) {
        toast.error('Please select a partner before creating inquiry');
        setLoading(false);
        return;
      }

      // 5. Build Unified Data
      if (extinguishers.length > 0) {
        // Collect ALL items from all blocks
        let globalSerialNo = 1;
        const allItemsPayload = [];

        for (let i = 0; i < extinguishers.length; i++) {
          const item = extinguishers[i];
          const idx = i;

          let voiceUrl = null;
          let photoUrl = null;
          let refPhotoUrl = null;

          if (item.mode === 'Maintenance') {
            if (item.maintenanceVoiceNote) {
              voiceUrl = await uploadMaintenanceVoice(item.maintenanceVoiceNote, idx);
            }
            if (item.maintenanceUnitPhoto) {
              photoUrl = await uploadMaintenancePhoto(item.maintenanceUnitPhoto, idx);
            }
          }

          if (item.mode === 'Validation' && item.validationPhoto) {
            refPhotoUrl = await uploadPhotoReference(item.validationPhoto, idx);
          }

          // 1. Map the Main Unit of this block
          if (item.mode !== 'New Unit' && (item.material || item.firefightingSystem || item.type)) {
            allItemsPayload.push({
              serial_no: globalSerialNo++,
              type: item.type || null,
              system_type: item.material || null,
              capacity: item.capacity || null,
              quantity: item.quantity || 1,
              price: item.price || 180,
              unit: item.unit || 'Pieces',
              system: item.firefightingSystem || null,
              status: item.mode === 'New Unit' ? 'New' : (item.mode === 'Refill' ? 'Refilled' : (item.mode === 'Validation' ? 'Valid' : 'Maintained')),
              catalog_no: item.catalog_no || null,
              product_id: item.productId || null,
              maintenance_notes: item.maintenanceNotes || null,
              maintenance_voice_url: voiceUrl,
              maintenance_unit_photo_url: photoUrl,
              extinguisher_photo: refPhotoUrl,
              expiry_date: item.expiryDate || null,
              performed_by: formData.performedBy || 'Agent',
              is_sub_unit: false,
              validation_mode: item.mode === 'Validation' ? (item.validation_mode || 'new') : 'new',
              follow_up_date: formData.followUpDate || null,
              follow_up_date_validation: (item.mode === 'Validation' && item.validation_mode === 'followup')
                ? (item.validationFollowUpDate || null)
                : null
            });
          }

          // 2. Map Sub-units of this block
          if (item.newUnits?.length > 0) {
            item.newUnits.forEach((sub) => {
              let subPrice = 180;
              const ffItem = FIRE_SYSTEMS.firefighting.find(it => it.name === sub.firefightingSystem);
              if (ffItem) subPrice += ffItem.price;

              allItemsPayload.push({
                serial_no: globalSerialNo++,
                type: item.type || null,
                system_type: sub.material || null,
                capacity: item.capacity || null,
                quantity: sub.quantity || 1,
                price: subPrice,
                unit: sub.unit || 'Pieces',
                system: sub.firefightingSystem || null,
                status: 'New',
                catalog_no: sub.catalog_no || null,
                maintenance_notes: item.maintenanceNotes || null,
                maintenance_voice_url: voiceUrl,
                maintenance_unit_photo_url: photoUrl,
                extinguisher_photo: refPhotoUrl,
                expiry_date: item.expiryDate || null,
                performed_by: formData.performedBy || 'Agent',
                is_sub_unit: true,
                validation_mode: item.mode === 'Validation' ? (item.validation_mode || 'new') : 'new',
                follow_up_date: formData.followUpDate || null,
                follow_up_date_validation: (item.mode === 'Validation' && item.validation_mode === 'followup')
                  ? (item.validationFollowUpDate || null)
                  : null
              });
            });
          }
        }

        // C. Call Backend API to create the full inquiry in one shot
        const inquiryData = {
          inquiry_no: inquiryNo,
          customer_id: finalCustId,
          partner_id: selectedPartnerId, // Only one partner is allowed per visit
          agent_id: user.id,
          visit_id: visitId,
          type: inquiryType,
          priority: 'Medium',
          performed_by: formData.performedBy || 'Agent',
          follow_up_date: formData.followUpDate || null,
          qr_code_value: needsQrScan
            ? (extinguishers.find((e) => e.qrCodeValue === EXPECTED_VISIT_QR)?.qrCodeValue ?? null)
            : null
        };

        // DEBUG LOGS (Updated)
        console.log("Step 3 History:", formData.followUpHistory);
        console.log("Current Input Date:", formData.followUpDate);
        console.log("Final Inquiry Payload:", inquiryData);

        if (allItemsPayload.length > 0) {
          // If no partner was selected (e.g. only follow-up validations), 
          // we still need inquiry metadata but partner_id can be null or lead to separate logic
          await createInquiryViaSupabase(inquiryData, allItemsPayload);
        }
      }
      navigate('/agent/dashboard');
    } catch (error) {
      console.error(error);
      toast.error(getVisitSubmitErrorMessage(error, true), { duration: 10000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[500px] max-w-4xl mx-auto p-2 md:p-8">
      <Toaster position="top-center" />

      {/* Location Permission Modal */}
      {locationModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">

            {/* Icon */}
            <div className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${locationModal.type === 'prompt' ? 'bg-primary-100' :
              locationModal.type === 'denied' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
              {locationModal.type === 'denied'
                ? <Smartphone size={26} className="text-red-500" />
                : <MapPin size={26} className={locationModal.type === 'prompt' ? 'text-primary-600' : 'text-amber-500'} />
              }
            </div>

            {/* Close */}
            <button
              onClick={() => setLocationModal({ open: false, type: null })}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X size={18} />
            </button>

            {/* ── PROMPT: permission not yet asked ── */}
            {locationModal.type === 'prompt' && (
              <>
                <h3 className="text-center text-lg font-bold text-slate-800 mb-1">
                  Enable Location Access
                </h3>
                <p className="text-center text-sm text-slate-500 mb-5">
                  Tap <strong>Enable Location</strong> below. Your browser will ask you to allow access — tap <strong>Allow</strong> in that popup.
                </p>
              </>
            )}

            {/* ── DENIED: blocked in settings ── */}
            {locationModal.type === 'denied' && (
              <>
                <h3 className="text-center text-lg font-bold text-slate-800 mb-1">
                  Location Permission Denied
                </h3>
                <p className="text-center text-sm text-slate-500 mb-4">
                  Your browser is blocking location access. Follow these steps:
                </p>
                <ol className="text-sm text-slate-600 space-y-2 mb-5 list-none">
                  {[
                    <>Open your phone <strong>Settings</strong></>,
                    <>Go to <strong>Privacy → Location Services</strong></>,
                    <>Find your <strong>browser</strong> (Safari / Chrome) → set to <strong>While Using</strong></>,
                    <>Return here and tap <strong>Try Again</strong></>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {/* ── UNAVAILABLE ── */}
            {locationModal.type === 'unavailable' && (
              <>
                <h3 className="text-center text-lg font-bold text-slate-800 mb-1">
                  Location Unavailable
                </h3>
                <p className="text-center text-sm text-slate-500 mb-5">
                  Your device could not determine its location. Make sure GPS / Location Services are turned <strong>ON</strong> and try again.
                </p>
              </>
            )}

            {/* ── TIMEOUT ── */}
            {locationModal.type === 'timeout' && (
              <>
                <h3 className="text-center text-lg font-bold text-slate-800 mb-1">
                  Location Timed Out
                </h3>
                <p className="text-center text-sm text-slate-500 mb-5">
                  The location request took too long. Move to an open area and try again.
                </p>
              </>
            )}

            {/* ── UNSUPPORTED ── */}
            {locationModal.type === 'unsupported' && (
              <>
                <h3 className="text-center text-lg font-bold text-slate-800 mb-1">
                  Not Supported
                </h3>
                <p className="text-center text-sm text-slate-500 mb-5">
                  Your browser does not support location access. Please type your address manually.
                </p>
              </>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {/* "prompt" → call doFetchLocation() directly to trigger browser popup */}
              {locationModal.type === 'prompt' && (
                <button
                  onClick={doFetchLocation}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm transition-colors"
                >
                  <MapPin size={16} /> Enable Location
                </button>
              )}

              {/* "denied" → re-check permission (user may have changed settings) */}
              {locationModal.type === 'denied' && (
                <button
                  onClick={fetchLocation}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm transition-colors"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}

              {/* GPS/timeout errors → retry the actual fetch */}
              {(locationModal.type === 'unavailable' || locationModal.type === 'timeout') && (
                <button
                  onClick={doFetchLocation}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm transition-colors"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}

              <button
                onClick={() => setLocationModal({ open: false, type: null })}
                className="w-full py-3 rounded-2xl border border-slate-200 text-slate-500 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Enter Address Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <PageLoader message="Processing your visit log..." />}
      {/* Header / Stepper */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {step === 1 && (
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
              <ArrowLeft size={24} />
            </button>
          )}
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
        <div className="bg-white p-5 md:p-8 rounded-3xl shadow-soft border border-slate-100 animate-fade-in">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Customer Identification</h3>
              <p className="text-sm text-slate-500">
                {isNewCustomer ? 'Registering a new lead.' : 'Search for an existing customer or toggle to new lead.'}
              </p>
            </div>
          </div>

          {/* Toggle Buttons - Fixed for mobile */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setIsNewCustomer(false);
                setFormData((prev) => ({ ...prev, customerId: null }));
                setSelectedCustomer(null);
                setSelectedCustomerImageError(false);
                setIsSelectedCustomerImageLoading(false);
              }}
              className={`py-3.5 px-4 rounded-2xl text-sm font-bold transition-all border-2 
          ${!isNewCustomer
                  ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
            >
              Find Existing Customer
            </button>

            <button
              onClick={() => {
                setIsNewCustomer(true);
                setFormData((prev) => ({ ...prev, customerId: null }));
                setSearchQuery('');
                setSelectedCustomer(null);
                setSelectedCustomerImageError(false);
                setIsSelectedCustomerImageLoading(false);
              }}
              className={`py-3.5 px-4 rounded-2xl text-sm font-bold transition-all border-2 
          ${isNewCustomer
                  ? 'bg-green-50 border-green-500 text-green-700 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
            >
              Create New Lead
            </button>
          </div>

          {/* Search Section */}
          {!isNewCustomer && !formData.customerId && (
            <div className="mb-8 relative">
              <label className="block text-sm font-medium text-slate-700 mb-2">Search Customer Database</label>
              <div className="relative">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isSearching ? 'text-primary-500 animate-pulse' : 'text-slate-400'}`} size={20} />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  placeholder="Search by ID, Business Name or Phone..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white mt-2 rounded-2xl shadow-xl border border-slate-100 z-50 max-h-64 overflow-y-auto">
                  {searchResults.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => selectCustomer(cust)}
                      className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                          {cust.image_url ? (
                            <img
                              src={cust.image_url}
                              alt={cust.business_name || 'Customer'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-slate-500">{customerInitial(cust)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 truncate">{cust.business_name}</p>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono shrink-0">ID: {cust.id}</span>
                        </div>
                        <p className="text-sm text-slate-500 truncate">{cust.address}</p>
                      </div>
                      <ArrowRight size={18} className="text-slate-300 group-hover:text-primary-500 transition-colors ml-3" />
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim().length > 0 && !isSearching && searchResults.length === 0 && (
                <div className="mt-2 p-4 bg-white rounded-2xl border border-slate-100 text-center text-slate-500 text-sm">
                  No matches found for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Form Fields - When customer is selected or new lead */}
          {(isNewCustomer || formData.customerId) && (
            <div className="space-y-6">
              {/* Status Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                  <p className={`font-bold mt-1 ${isNewCustomer ? 'text-green-600' : 'text-blue-600'}`}>
                    {isNewCustomer ? 'Creating New Lead' : 'Existing Customer Selected'}
                  </p>
                </div>

                {!isNewCustomer && formData.customerId && (
                  <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-3 py-2">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                      {selectedCustomer?.image_url && !selectedCustomerImageError ? (
                        <>
                          {isSelectedCustomerImageLoading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                              <div className="h-5 w-5 animate-spin border-2 border-primary-500 border-t-transparent rounded-full" />
                            </div>
                          )}
                          <img
                            src={selectedCustomer.image_url}
                            alt="Customer"
                            className="w-16 h-16 object-cover"
                            onLoad={() => setIsSelectedCustomerImageLoading(false)}
                            onError={() => {
                              setIsSelectedCustomerImageLoading(false);
                              setSelectedCustomerImageError(true);
                            }}
                          />
                        </>
                      ) : (
                        <span className="text-lg font-bold text-slate-500">{customerInitial(selectedCustomer)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Customer</p>
                      <p className="text-sm font-bold text-slate-800 truncate max-w-[180px]">
                        {selectedCustomer?.business_name || formData.businessName || 'Selected customer'}
                      </p>
                    </div>
                  </div>
                )}

                {!isNewCustomer && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => isEditingCustomer ? handleUpdateCustomer() : setIsEditingCustomer(true)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5
                  ${isEditingCustomer
                          ? 'bg-green-600 text-white'
                          : 'bg-white border border-primary-200 text-primary-600 hover:bg-primary-50'
                        }`}
                    >
                      {isEditingCustomer ? (
                        loading ? 'Saving...' : <>Save Changes</>
                      ) : (
                        <>Edit Customer</>
                      )}
                    </button>

                    <button
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/10"
                    >
                      <History size={14} />
                      View History
                    </button>

                    <button
                      onClick={() => {
                        if (isEditingCustomer) {
                          setIsEditingCustomer(false);
                        } else {
                          setFormData((prev) => ({ ...prev, customerId: null }));
                          setSearchQuery('');
                          setSelectedCustomer(null);
                          setSelectedCustomerImageError(false);
                          setIsSelectedCustomerImageLoading(false);
                        }
                      }}
                      className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      {isEditingCustomer ? 'Cancel' : 'Clear'}
                    </button>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <Input
                  label="Business Name"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  required={isNewCustomer}
                  disabled={!isNewCustomer && !isEditingCustomer}
                />
                <Input
                  label="Owner Name"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  disabled={!isNewCustomer && !isEditingCustomer}
                />
                <Input
                  label="Phone Contact"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required={isNewCustomer}
                  disabled={!isNewCustomer && !isEditingCustomer}
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isNewCustomer && !isEditingCustomer}
                />

                {/* Address with Location Button */}
                <div className="md:col-span-2 relative">
                  <Input
                    label="Site Address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder={isFetchingLocation ? "Fetching location..." : "Enter site address"}
                    disabled={isFetchingLocation || (!isNewCustomer && !isEditingCustomer)}
                  />
                  {(isNewCustomer || isEditingCustomer) && (
                    <button
                      onClick={fetchLocation}
                      disabled={isFetchingLocation}
                      className="absolute right-3 top-9 p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                    >
                      {isFetchingLocation ? (
                        <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                      ) : (
                        <MapPin size={22} />
                      )}
                    </button>
                  )}
                </div>

                {/* Business Category */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Business Category</label>
                  <select
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleInputChange}
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                    disabled={!isNewCustomer && !isEditingCustomer}
                  >
                    {/* Your options here */}
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
                    <option>Other</option>
                  </select>
                </div>

                {/* File Upload + Camera - Fixed mobile layout */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Customer Image (office / building)
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      id="customer-photo-upload"
                      className="hidden"
                    />
                    <label
                      htmlFor="customer-photo-upload"
                      className="flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed rounded-2xl transition-all bg-white border-slate-300 hover:border-primary-500 hover:bg-primary-50/10 cursor-pointer"
                    >
                      {formData.customerPhoto ? (
                        <div className="relative w-full p-4 flex flex-col items-center animate-fade-in">
                          <img
                            src={URL.createObjectURL(formData.customerPhoto)}
                            className="h-28 w-28 object-cover rounded-xl shadow-md border-2 border-white mb-3"
                            alt="Preview"
                          />
                          <div className="flex items-center gap-2 text-sm font-bold text-primary-600 uppercase tracking-wider">
                            <Camera size={16} />
                            Change Image
                          </div>
                          <p className="text-xs text-slate-500 mt-2 font-medium">
                            Final size: {(formData.customerPhoto.size / 1024).toFixed(2)} KB (max 45 KB)
                          </p>
                        </div>
                      ) : (!isNewCustomer && selectedCustomer?.image_url && !selectedCustomerImageError) ? (
                        <div className="relative w-full p-4 flex flex-col items-center animate-fade-in">
                          <div className="relative">
                            {isSelectedCustomerImageLoading && (
                              <div className="absolute inset-0 rounded-xl bg-white/80 flex items-center justify-center">
                                <div className="h-5 w-5 animate-spin border-2 border-primary-500 border-t-transparent rounded-full" />
                              </div>
                            )}
                            <img
                              src={selectedCustomer.image_url}
                              className="h-28 w-28 object-cover rounded-xl shadow-md border-2 border-white mb-3"
                              alt="Customer"
                              onLoad={() => setIsSelectedCustomerImageLoading(false)}
                              onError={() => {
                                setIsSelectedCustomerImageLoading(false);
                                setSelectedCustomerImageError(true);
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-600 uppercase tracking-wider">
                            Existing Photo (Change Image)
                          </div>
                          <p className="text-xs text-slate-500 mt-2 font-medium">
                            Upload a new image only if you want to replace this one.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center p-6 text-center animate-fade-in">
                          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Camera size={28} className="text-slate-400 group-hover:text-primary-500" />
                          </div>
                          <p className="text-base font-bold text-slate-700 mb-1">Add Customer Photo</p>
                          <p className="text-sm text-slate-500">Take a photo or upload from gallery</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Identity QR Code</label>

                  {!isNewCustomer && selectedCustomer?.qr_code_url ? (
                    /* Existing customer already has a QR — display it */
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={selectedCustomer.qr_code_url}
                        className="h-24 w-24 border rounded-2xl object-contain"
                        alt="Customer QR Code"
                      />
                      <p className="text-xs text-slate-500 font-medium">Existing QR Code</p>
                    </div>
                  ) : (
                    /* New customer, or existing customer with no QR yet */
                    <>
                      <button
                        onClick={generateQRPreview}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold transition-colors"
                      >
                        Generate QR Code
                      </button>
                      {qrPreview && (
                        <div className="mt-4 flex justify-center">
                          <img src={qrPreview} className="h-20 w-20 border rounded-2xl" alt="QR Preview" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary flex items-center gap-2 px-8 py-3.5"
                >
                  Next: Inventory Builder
                  <ArrowRight size={18} />
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
                {/* Action Buttons - Always visible on mobile, hover on desktop */}
                <div className="absolute -top-3 right-4 z-20 flex items-center gap-2">

                  {/* Save Button - only when unlocked */}
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
                      className={`px-4 py-2 rounded-2xl text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all ${ext.hasChanges
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      title="Save changes and lock this unit"
                    >
                      <Save size={15} />
                      Save
                    </button>
                  )}

                  {/* Edit / Unlock Button - only when locked */}
                  {ext.isLocked && (
                    <button
                      onClick={() => setExtinguishers(prev => prev.map((item, i) =>
                        i === index ? { ...item, isLocked: false } : item
                      ))}
                      className="p-3 bg-white text-blue-600 rounded-2xl shadow-sm border border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all"
                      title="Edit / Unlock this unit"
                    >
                      <Pencil size={18} />
                    </button>
                  )}

                  {/* Delete Button - always visible */}
                  <button
                    onClick={() => removeExtinguisher(index)}
                    className="p-3 bg-white text-red-600 rounded-2xl shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-700 transition-all"
                    title="Remove this unit"
                  >
                    <Trash size={18} />
                  </button>
                </div>

                {/* Mode Selection Buttons - Fully Responsive */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 pb-5 border-b border-slate-200">
                  {['Validation', 'Refill', 'New Unit', 'Maintenance'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={ext.isLocked}
                      onClick={() => handleExtinguisherChange(index, 'mode', m)}
                      className={`py-3.5 px-3 rounded-2xl text-xs font-bold transition-all border ${ext.mode === m
                        ? 'bg-primary-500 text-white shadow-md border-primary-500'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        } ${ext.isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Type & Capacity Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6">
                  {ext.mode !== 'Maintenance' && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Type</label>
                        <select
                          value={ext.type}
                          onChange={(e) => handleExtinguisherChange(index, 'type', e.target.value)}
                          disabled={ext.isLocked}
                          className="w-full p-3.5 rounded-2xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none text-sm"
                        >
                          <option>ABC Dry Powder</option>
                          <option>CO2 - Carbon Dioxide</option>
                          <option>Water Type</option>
                          <option>Mechanical Foam</option>
                          <option>Wet Chemical</option>
                          <option>Other</option>
                        </select>

                        {ext.type === 'Other' && (
                          <div className="mt-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Specify Type</label>
                            <input
                              type="text"
                              value={ext.customType || ''}
                              onChange={(e) => handleExtinguisherChange(index, 'customType', e.target.value)}
                              placeholder="e.g. Clean Agent, Dry Chemical Special..."
                              className="w-full p-3.5 rounded-2xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none text-sm"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Capacity</label>
                        <select
                          value={ext.capacity}
                          disabled={ext.isLocked}
                          onChange={(e) => handleExtinguisherChange(index, 'capacity', e.target.value)}
                          className="w-full p-3.5 rounded-2xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none text-sm"
                        >
                          <option>1kg</option>
                          <option>2kg</option>
                          <option>4kg</option>
                          <option>6kg</option>
                          <option>9kg</option>
                          <option>25kg</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Flow-based Fields */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                  {ext.mode === 'Validation' && (
                    <>
                      <div className="md:col-span-4 mb-4">
                        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                          {['new', 'followup'].map((mode) => (
                            <button
                              key={mode}
                              onClick={() => handleExtinguisherChange(index, 'validation_mode', mode)}
                              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${ext.validation_mode === mode
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                              {mode === 'new' ? 'New Validation' : 'Follow-up'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {ext.validation_mode === 'new' ? (
                        <>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Partner</label>
                            <select
                              value={ext.partner || ''}
                              onChange={(e) => handlePartnerSelect(index, e.target.value)}
                              className="input-field py-2 text-sm"
                              required
                            >
                              <option value="">{loadingPartners ? 'Loading...' : 'Select Partner'}</option>
                              {partners.map(p => (
                                <option key={p.id} value={p.id}>{p.business_name}</option>
                              ))}
                            </select>
                          </div>

                          {renderProductPicker(ext, index)}

                          <div className="md:col-span-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Photo Reference</label>
                            <div className="relative flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed rounded-2xl transition-all bg-white border-slate-300 hover:border-primary-500 hover:bg-primary-50/10 cursor-pointer overflow-hidden">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleValidationPhotoUpload(index, e)}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              />
                              {ext.validationPhoto ? (
                                <div className="relative w-full p-2 flex flex-col items-center animate-fade-in pointer-events-none">
                                  <img
                                    src={URL.createObjectURL(ext.validationPhoto)}
                                    className="h-24 w-24 object-cover rounded-xl shadow-md border-2 border-white mb-2"
                                    alt="Preview"
                                  />
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary-600 uppercase tracking-wider">
                                    <Camera size={14} />
                                    Change Photo
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1.5 font-medium">
                                    Final size: {(ext.validationPhoto.size / 1024).toFixed(2)} KB (max 45 KB)
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center p-6 text-center animate-fade-in pointer-events-none">
                                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 hover:scale-110 transition-transform">
                                    <Camera size={24} className="text-slate-400" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-700 mb-1">Add Photo Reference</p>
                                  <p className="text-xs text-slate-500">Take a photo or upload from gallery</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <QrScanFieldGroup
                            slotKey={`v-${index}`}
                            qrScannerSlot={qrScannerSlot}
                            onQrScannerSlotChange={setQrScannerSlot}
                            readerId={`visit-qr-v-${index}`}
                            qrCodeValue={ext.qrCodeValue || ''}
                            needsQrScan={needsQrScan}
                            isQrValid={(ext.qrCodeValue || '') === EXPECTED_VISIT_QR}
                            onDecoded={(text) => handleQrDecoded(text, index)}
                            hint="Scan the site verification QR after the photo reference (optional)."
                          />
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                              Partner <span className="normal-case text-slate-400">(optional)</span>
                            </label>
                            <select
                              value={ext.partner || ''}
                              onChange={(e) => handlePartnerSelect(index, e.target.value)}
                              className="input-field py-2 text-sm"
                            >
                              <option value="">{loadingPartners ? 'Loading...' : 'No Partner'}</option>
                              {partners.map(p => (
                                <option key={p.id} value={p.id}>{p.business_name}</option>
                              ))}
                            </select>
                          </div>

                          {renderProductPicker(ext, index)}

                          <div className="md:col-span-3">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Follow-up Date</label>
                            <input
                              type="date"
                              required
                              value={ext.validationFollowUpDate || ''}
                              onChange={(e) => handleExtinguisherChange(index, 'validationFollowUpDate', e.target.value)}
                              className="input-field py-3 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {ext.mode === 'New Unit' && (
                    <div className="col-span-4 space-y-6 animate-fade-in">

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-end gap-4">
                        {/* Fire Fighting System Category */}
                        <div>
                          <label
                            htmlFor={`ff-system-${index}`}
                            className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                          >
                            System Category
                          </label>
                          <select
                            id={`ff-system-${index}`}
                            value={ext.firefightingSystem || ''}
                            onChange={(e) => handleExtinguisherChange(index, 'firefightingSystem', e.target.value)}
                            disabled={ext.isLocked}
                            className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}`}
                          >
                            <option value="">Select...</option>
                            {Object.keys(FIRE_FIGHTING_CATEGORIES).map(sys => (
                              <option key={sys} value={sys}>{sys}</option>
                            ))}
                            <option>Other</option>
                          </select>
                          {ext.firefightingSystem === 'Other' && (
                            <div className="mt-3 animate-fade-in">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Specify System
                              </label>
                              <input
                                type="text"
                                value={ext.customFirefightingSystem || ''}
                                onChange={(e) => handleExtinguisherChange(index, 'customFirefightingSystem', e.target.value)}
                                disabled={ext.isLocked}
                                placeholder="e.g. Clean Agent System, etc."
                                className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                                required
                              />
                            </div>
                          )}
                        </div>

                        {/* Material */}
                        <div>
                          <label
                            htmlFor={`material-${index}`}
                            className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                          >
                            Material
                          </label>
                          <select
                            id={`material-${index}`}
                            value={ext.material || ''}
                            onChange={(e) => {
                              const mat = e.target.value;
                              handleExtinguisherChange(index, 'material', mat);
                              handleExtinguisherChange(index, 'unit', getDefaultUnit(mat));
                            }}
                            disabled={ext.isLocked || !ext.firefightingSystem}
                            className={`input-field py-2 text-sm ${ext.isLocked || !ext.firefightingSystem ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}`}
                          >
                            <option value="">Select Material</option>
                            {ext.firefightingSystem &&
                              FIRE_FIGHTING_CATEGORIES[ext.firefightingSystem]?.map(mat => (
                                <option key={mat} value={mat}>{mat}</option>
                              ))}
                            <option>Other</option>
                          </select>
                          {ext.material === 'Other' && (
                            <div className="mt-3 animate-fade-in">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Specify Material
                              </label>
                              <input
                                type="text"
                                value={ext.customMaterial || ''}
                                onChange={(e) => handleExtinguisherChange(index, 'customMaterial', e.target.value)}
                                disabled={ext.isLocked}
                                placeholder="e.g. Fire Blanket, Fire Curtain, etc."
                                className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                                required
                              />
                            </div>
                          )}
                        </div>

                        {/* Unit (Meter / Pieces) */}
                        <div>
                          <label
                            htmlFor={`unit-${index}`}
                            className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                          >
                            Unit
                          </label>
                          <select
                            id={`unit-${index}`}
                            value={ext.unit || 'Pieces'}
                            onChange={(e) => handleExtinguisherChange(index, 'unit', e.target.value)}
                            disabled={ext.isLocked}
                            className="input-field py-2 text-sm"
                          >
                            <option value="Meter">Meter</option>
                            <option value="Pieces">Pieces</option>
                          </select>
                        </div>

                        {/* Quantity */}
                        <div>
                          <label
                            htmlFor={`qty-${index}`}
                            className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                          >
                            Quantity
                          </label>
                          <input
                            id={`qty-${index}`}
                            type="number"
                            min="1"
                            value={ext.quantity || 1}
                            onChange={(e) => handleExtinguisherChange(index, 'quantity', Number(e.target.value) || 1)}
                            disabled={ext.isLocked}
                            className="input-field py-2 text-sm"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => addNewUnit(index)}
                          disabled={
                            !ext.firefightingSystem ||
                            !ext.material ||
                            (ext.quantity || 0) < 1 ||
                            ext.isLocked
                          }
                          className={`w-full text-xs !h-[50px] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${(!ext.firefightingSystem || !ext.material || (ext.quantity || 0) < 1)
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : 'bg-primary-600 hover:bg-primary-700 text-white'
                            }`}
                        >
                          <Plus size={18} /> Add This Item
                        </button>
                      </div>

                      <div className='col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4'>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                            Partner
                          </label>
                          <select
                            value={ext.partner || ''}
                            onChange={(e) => handleExtinguisherChange(index, 'partner', e.target.value)}
                            className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                            disabled={loadingPartners || ext.isLocked}
                          >
                            <option value="">{loadingPartners ? 'Loading Partners...' : 'Select Partner'}</option>
                            {partners.map(p => (
                              <option key={p.id} value={p.id}>{p.business_name}</option>
                            ))}
                            <option value="Other">Other (Custom Partner)</option>
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
                                disabled={ext.isLocked}
                                placeholder="e.g. ABC Fire Refilling Co."
                                className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Expiry Date</label>
                          <input
                            type="date"
                            value={ext.expiryDate}
                            onChange={(e) => handleExtinguisherChange(index, 'expiryDate', e.target.value)}
                            disabled={ext.isLocked}
                            className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                          />
                        </div>
                      </div>

                      {ext.newUnits?.length > 0 && (
                        <div className="mt-6 space-y-4">
                          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                            Added Sub-Units
                          </h4>

                          {/* Table-like container */}
                          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Header Row */}
                            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] bg-slate-50 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              <div>Fire Fighting System</div>
                              <div>Material</div>
                              <div>Unit</div>
                              <div>Quantity</div>
                              <div className="text-right">Action</div>
                            </div>

                            {/* Rows */}
                            {ext.newUnits.map((subUnit, subIndex) => (
                              <div
                                key={subIndex}
                                className={`grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-center px-4 py-3.5 text-sm border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors ${subIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                                  }`}
                              >
                                <div className="font-medium text-slate-800">
                                  {subUnit.firefightingSystem || <span className="text-slate-400">N/A</span>}
                                </div>
                                <div className="text-slate-700">
                                  {subUnit.material || <span className="text-slate-400">N/A</span>}
                                </div>
                                <div className="text-slate-600">
                                  {subUnit.unit || 'Pieces'}
                                </div>
                                <div className="font-medium text-slate-800">
                                  {subUnit.quantity || 1}
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => {
                                      setExtinguishers(prev =>
                                        prev.map((item, i) =>
                                          i === index
                                            ? { ...item, newUnits: item.newUnits.filter((_, si) => si !== subIndex) }
                                            : item
                                        )
                                      );
                                    }}
                                    className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                                    title="Remove this sub-unit"
                                  >
                                    <Trash size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ─── Price / Note Logic ─── */}
                      <div className="col-span-4 mt-6 pt-4 border-t border-slate-200">
                        {ext.firefightingSystem === 'Other' || ext.material === 'Other' ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
                            <p className="text-sm text-amber-800 font-medium">
                              Price confirmation is currently not available for this material. Our team will confirm the price separately.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Base Price</label>
                              <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
                                SAR 180
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Fire Fighting MTP</label>
                              <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
                                SAR {FIRE_SYSTEMS.firefighting.find(it => it.name === ext.firefightingSystem)?.price || 0}
                              </div>
                            </div>


                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center transition-all">
                              <label className="text-xs font-bold text-green-800 uppercase tracking-wider mb-1 block">Final Price (SAR)</label>
                              <div className="text-xl font-bold text-green-700">
                                SAR {ext.price}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}


                  {ext.mode === 'Refill' && (
                    <>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Partner</label>
                        <select
                          value={ext.partner}
                          onChange={(e) => handlePartnerSelect(index, e.target.value)}
                          className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                          disabled={loadingPartners || ext.isLocked}
                        >
                          <option value="">{loadingPartners ? 'Loading Partners...' : 'Select Partner'}</option>
                          {partners.map(p => (
                            <option key={p.id} value={p.id}>{p.business_name}</option>
                          ))}
                          <option value="Other">Other (Custom Partner)</option>
                        </select>

                        {renderProductPicker(ext, index)}

                        {ext.partner === 'Other' && (
                          <div className="mt-3 animate-fade-in">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                              Specify Partner Name
                            </label>
                            <input
                              type="text"
                              value={ext.customPartner || ''}
                              onChange={(e) => handleExtinguisherChange(index, 'customPartner', e.target.value)}
                              disabled={ext.isLocked}
                              placeholder="e.g. ABC Fire Refilling Co."
                              className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                            />
                          </div>
                        )}
                      </div>

                      <div className="">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantity</label>
                        <input
                          type="number"
                          value={ext.quantity}
                          min={1}
                          onChange={(e) => handleExtinguisherChange(index, 'quantity', parseInt(e.target.value) || 1)}
                          disabled={ext.isLocked}
                          className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Expiry Date</label>
                        <input
                          type="date"
                          value={ext.expiryDate}
                          onChange={(e) => handleExtinguisherChange(index, 'expiryDate', e.target.value)}
                          disabled={ext.isLocked}
                          className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                        />
                      </div>

                      <QrScanFieldGroup
                        slotKey={`r-${index}`}
                        qrScannerSlot={qrScannerSlot}
                        onQrScannerSlotChange={setQrScannerSlot}
                        readerId={`visit-qr-r-${index}`}
                        qrCodeValue={ext.qrCodeValue || ''}
                        needsQrScan={needsQrScan}
                        isQrValid={(ext.qrCodeValue || '') === EXPECTED_VISIT_QR}
                        onDecoded={(text) => handleQrDecoded(text, index)}
                        hint="Scan the site verification QR after entering the expiry date (optional)."
                      />
                    </>
                  )}

                  {ext.mode === 'Maintenance' && (
                    <>
                      <div className="col-span-4 space-y-6 animate-fade-in">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-end gap-4">
                          {/* Fire Fighting System Category */}
                          <div>
                            <label
                              htmlFor={`ff-system-maint-${index}`}
                              className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                            >
                              System Category
                            </label>
                            <select
                              id={`ff-system-maint-${index}`}
                              value={ext.firefightingSystem || ''}
                              onChange={(e) => handleExtinguisherChange(index, 'firefightingSystem', e.target.value)}
                              disabled={ext.isLocked}
                              className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}`}
                            >
                              <option value="">Select Category...</option>
                              {Object.keys(FIRE_FIGHTING_CATEGORIES).map(sys => (
                                <option key={sys} value={sys}>{sys}</option>
                              ))}
                              <option>Other</option>
                            </select>
                            {ext.firefightingSystem === 'Other' && (
                              <div className="mt-3 animate-fade-in">
                                <label
                                  htmlFor={`custom-system-maint-${index}`}
                                  className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                                >
                                  Specify System
                                </label>
                                <input
                                  id={`custom-system-maint-${index}`}
                                  type="text"
                                  value={ext.customFirefightingSystem || ''}
                                  onChange={(e) => handleExtinguisherChange(index, 'customFirefightingSystem', e.target.value)}
                                  disabled={ext.isLocked}
                                  placeholder="e.g. Clean Agent System, etc."
                                  className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                                  required
                                />
                              </div>
                            )}
                          </div>
                          {/* Material */}
                          <div>
                            <label
                              htmlFor={`material-maint-${index}`}
                              className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                            >
                              Material
                            </label>
                            <select
                              id={`material-maint-${index}`}
                              value={ext.material || ''}
                              onChange={(e) => {
                                const mat = e.target.value;
                                handleExtinguisherChange(index, 'material', mat);
                                handleExtinguisherChange(index, 'unit', getDefaultUnit(mat));
                              }}
                              disabled={ext.isLocked || !ext.firefightingSystem}
                              className={`input-field py-2 text-sm ${ext.isLocked || !ext.firefightingSystem ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}`}
                            >
                              <option value="">Select Material...</option>
                              {ext.firefightingSystem &&
                                FIRE_FIGHTING_CATEGORIES[ext.firefightingSystem]?.map(mat => (
                                  <option key={mat} value={mat}>{mat}</option>
                                ))}
                              <option>Other</option>
                            </select>
                            {ext.material === 'Other' && (
                              <div className="mt-3 animate-fade-in">
                                <label
                                  htmlFor={`custom-material-maint-${index}`}
                                  className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                                >
                                  Specify Material
                                </label>
                                <input
                                  id={`custom-material-maint-${index}`}
                                  type="text"
                                  value={ext.customMaterial || ''}
                                  onChange={(e) => handleExtinguisherChange(index, 'customMaterial', e.target.value)}
                                  disabled={ext.isLocked}
                                  placeholder="e.g. Fire Blanket, Fire Curtain, etc."
                                  className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                                  required
                                />
                              </div>
                            )}
                          </div>
                          {/* Unit */}
                          <div>
                            <label
                              htmlFor={`unit-maint-${index}`}
                              className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                            >
                              Unit
                            </label>
                            <select
                              id={`unit-maint-${index}`}
                              value={ext.unit || 'Pieces'}
                              onChange={(e) => handleExtinguisherChange(index, 'unit', e.target.value)}
                              disabled={ext.isLocked}
                              className="input-field py-2 text-sm"
                            >
                              <option value="Meter">Meter</option>
                              <option value="Pieces">Pieces</option>
                            </select>
                          </div>
                          {/* Quantity */}
                          <div>
                            <label
                              htmlFor={`qty-maint-${index}`}
                              className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block"
                            >
                              Quantity
                            </label>
                            <input
                              id={`qty-maint-${index}`}
                              type="number"
                              min="1"
                              value={ext.quantity || 1}
                              onChange={(e) => handleExtinguisherChange(index, 'quantity', Number(e.target.value) || 1)}
                              disabled={ext.isLocked}
                              className="input-field py-2 text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => addNewUnit(index)}
                            disabled={!ext.firefightingSystem || !ext.material || (ext.quantity || 0) < 1 || ext.isLocked}
                            className={`w-full text-xs !h-[50px] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${(!ext.firefightingSystem || !ext.material || (ext.quantity || 0) < 1)
                              ? 'bg-gray-400 cursor-not-allowed text-white'
                              : 'bg-primary-600 hover:bg-primary-700 text-white'
                              }`}
                          // className={`w-full text-xs max-w-[100px] py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${(!ext.firefightingSystem || !ext.material || (ext.quantity || 0) < 1)
                          //   ? 'bg-gray-400 cursor-not-allowed text-white'
                          //   : 'bg-primary-600 hover:bg-primary-700 text-white'
                          //   }`}
                          >
                            <Plus size={18} /> Add
                          </button>
                        </div>
                        {/* Partner (same as New Unit) */}
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                            Partner
                          </label>
                          <select
                            value={ext.partner || ''}
                            onChange={(e) => handleExtinguisherChange(index, 'partner', e.target.value)}
                            className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                            disabled={loadingPartners || ext.isLocked}
                          >
                            <option value="">{loadingPartners ? 'Loading Partners...' : 'Select Partner'}</option>
                            {partners.map(p => (
                              <option key={p.id} value={p.id}>{p.business_name}</option>
                            ))}
                            <option value="Other">Other (Custom Partner)</option>
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
                                disabled={ext.isLocked}
                                placeholder="e.g. ABC Fire Refilling Co."
                                className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Expiry Date</label>
                          <input
                            type="date"
                            value={ext.expiryDate}
                            onChange={(e) => handleExtinguisherChange(index, 'expiryDate', e.target.value)}
                            disabled={ext.isLocked}
                            className={`input-field py-2 text-sm ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed opacity-60' : ''}`}
                          />
                        </div>
                        {ext.newUnits?.length > 0 && (
                          <div className="mt-6 space-y-4">
                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                              Added Sub-Units
                            </h4>

                            {/* Table-like container */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                              {/* Header Row */}
                              <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] bg-slate-50 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                <div>Fire Fighting System</div>
                                <div>Material</div>
                                <div>Unit</div>
                                <div>Quantity</div>
                                <div className="text-right">Action</div>
                              </div>

                              {/* Rows */}
                              {ext.newUnits.map((subUnit, subIndex) => (
                                <div
                                  key={subIndex}
                                  className={`grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-center px-4 py-3.5 text-sm border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors ${subIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                                    }`}
                                >
                                  <div className="font-medium text-slate-800">
                                    {subUnit.firefightingSystem || <span className="text-slate-400">N/A</span>}
                                  </div>
                                  <div className="text-slate-700">
                                    {subUnit.material || <span className="text-slate-400">N/A</span>}
                                  </div>
                                  <div className="text-slate-600">
                                    {subUnit.unit || 'Pieces'}
                                  </div>
                                  <div className="font-medium text-slate-800">
                                    {subUnit.quantity || 1}
                                  </div>
                                  <div className="flex justify-end">
                                    <button
                                      onClick={() => {
                                        setExtinguishers(prev =>
                                          prev.map((item, i) =>
                                            i === index
                                              ? { ...item, newUnits: item.newUnits.filter((_, si) => si !== subIndex) }
                                              : item
                                          )
                                        );
                                      }}
                                      disabled={ext.isLocked}
                                      className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-2 ${ext.isLocked ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 focus:ring-red-300'}`}
                                      title={ext.isLocked ? "Unit is locked" : "Remove this sub-unit"}
                                    >
                                      <Trash size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="col-span-4 space-y-6">

                        {/* Voice + Text in one row (flex/grid) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                          {/* Left: Voice Note */}
                          <div className="bg-white p-5 rounded-xl border border-slate-200">
                            <label className="block text-sm font-bold text-slate-700 mb-3">
                              Unit Voice Note (Max 40 seconds)
                            </label>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                              <button
                                type="button"
                                onMouseDown={() => !ext.isLocked && startUnitRecording(index)}
                                onMouseUp={stopUnitRecording}
                                onTouchStart={() => !ext.isLocked && startUnitRecording(index)}
                                onTouchEnd={stopUnitRecording}
                                disabled={ext.isLocked}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${recordingIndex === index && isRecording
                                  ? 'bg-red-500 animate-pulse text-white scale-110 shadow-lg shadow-red-500/30'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  } ${ext.isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                              >
                                {recordingIndex === index && isRecording ? <Square size={20} /> : <Mic size={20} />}
                              </button>

                              <div className="flex-1">
                                <p className="font-medium text-slate-800 text-sm">
                                  {recordingIndex === index && isRecording
                                    ? `Recording... ${recordingTime}s / 40s`
                                    : ext.maintenanceVoiceNote
                                      ? 'Voice note recorded'
                                      : 'Hold to record (Max 40s)'}
                                </p>
                                {recordingIndex === index && isRecording && recordingTime >= 35 && (
                                  <p className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1">
                                    <AlertTriangle size={14} />
                                    Recording will stop at 40 seconds
                                  </p>
                                )}
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
                                    disabled={ext.isLocked}
                                    className={`text-xs ${ext.isLocked ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:text-red-600'}`}
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
                              disabled={ext.isLocked}
                              className={`w-full h-28 resize-none border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${ext.isLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                              placeholder="Condition, problems found, work done, recommendations for this unit..."
                            />
                          </div>
                        </div>

                        {/* Photo – neeche full width */}
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Unit Picture <span className="text-xs text-slate-500 font-normal">(recommended)</span>
                          </label>
                          <div className={`relative border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center transition-colors ${ext.isLocked ? 'bg-slate-50 cursor-not-allowed border-slate-200' : 'hover:border-primary-500 cursor-pointer'}`}>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={ext.isLocked}
                              onChange={(e) => handleMaintenanceUnitPhotoUpload(index, e)}
                              className={`absolute inset-0 opacity-0 ${ext.isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            />
                            {ext.maintenanceUnitPhoto ? (
                              <div className="flex flex-col items-center">
                                <img
                                  src={URL.createObjectURL(ext.maintenanceUnitPhoto)}
                                  alt="Unit preview"
                                  className={`h-24 w-24 object-cover rounded-lg mb-3 border shadow-sm ${ext.isLocked ? 'opacity-50' : ''}`}
                                />
                                <p className="text-xs text-slate-600">{ext.isLocked ? 'Photo Locked' : 'Click to change'}</p>
                                <p className="text-xs text-slate-500 mt-1.5 font-medium">
                                  Final size: {(ext.maintenanceUnitPhoto.size / 1024).toFixed(2)} KB (max 45 KB)
                                </p>
                              </div>
                            ) : (
                              <>
                                <Camera size={32} className={`mb-3 ${ext.isLocked ? 'text-slate-300' : 'text-slate-400'}`} />
                                <p className={`text-sm ${ext.isLocked ? 'text-slate-400' : 'text-slate-500'}`}>{ext.isLocked ? 'Upload Locked' : 'Tap to upload unit photo'}</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* ─── Price / Note Logic for Maintenance ─── */}
                        <div className="col-span-4 mt-6 pt-4 border-t border-slate-200">
                          {ext.firefightingSystem === 'Other' || ext.material === 'Other' ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                              <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
                              <p className="text-sm text-amber-800 font-medium">
                                Price confirmation is currently not available for this material. Our team will confirm the price separately.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Base Price</label>
                                <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
                                  SAR 180
                                </div>
                              </div>

                              <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Fire Fighting MTP</label>
                                <div className="text-sm font-medium text-slate-700 bg-white border rounded-xl p-3 border-[#e2e8f0] text-center">
                                  SAR {FIRE_SYSTEMS.firefighting.find(it => it.name === ext.firefightingSystem)?.price || 0}
                                </div>
                              </div>


                              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center transition-all">
                                <label className="text-xs font-bold text-green-800 uppercase tracking-wider mb-1 block">Final Price (SAR)</label>
                                <div className="text-xl font-bold text-green-700">
                                  SAR {ext.price}
                                </div>
                              </div>
                            </div>
                          )}
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
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={hasAnyInvalidQr}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              Next: Site Assessment <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Site Assessment */}
      {step === 3 && (
        <div className="bg-white p-4 md:p-8 rounded-3xl shadow-soft border border-slate-100 animate-fade-in">
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
                Site Voice Note <span className="text-slate-400">(Max 40 seconds)</span>
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
                  <p className="font-bold text-slate-900">{isRecording ? `Recording... ${recordingTime}s / 40s` : formData.voiceNote ? 'Voice Note Captured' : 'Hold to Record (Max 40s)'}
                  </p>
                  {isRecording && recordingTime >= 35 && (
                    <p className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1">
                      <AlertTriangle size={14} />
                      Recording will stop at 40 seconds
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
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Follow-up Schedule</label>

                {/* Date History List */}
                {formData.followUpHistory.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formData.followUpHistory.map((date, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl animate-fade-in group">
                        <div className="flex items-center gap-3 text-slate-700">
                          <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                            <Calendar size={14} />
                          </div>
                          <span className="font-medium">{new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">Locked</span>
                        </div>
                        <button
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            followUpHistory: prev.followUpHistory.filter((_, i) => i !== idx)
                          }))}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Entry Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      name="followUpDate"
                      value={formData.followUpDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="input-field pr-10"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.followUpDate) return;
                      if (formData.followUpHistory.includes(formData.followUpDate)) {
                        alert("This date is already in the schedule.");
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        followUpHistory: [...prev.followUpHistory, prev.followUpDate],
                        followUpDate: '' // Clear input for next entry
                      }));
                    }}
                    disabled={!formData.followUpDate}
                    className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-xs whitespace-nowrap shadow-lg shadow-primary-500/10"
                  >
                    <Plus size={16} /> Add Date
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 font-medium italic">
                  Note: The latest date added will be set as the primary follow-up.
                </p>
              </div>
              {/* <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Performed By</label>
                <select
                  name="performedBy"
                  value={formData.performedBy}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  {extinguishers[0]?.mode === 'Validation' ? (
                    <option value="Agent">Agent</option>
                  ) : (
                    <>
                      <option value="Assigned Partner">Assigned Partner</option>
                      <option value="Agent">Agent</option>
                      <option value="Customer">Customer</option>
                    </>
                  )}
                </select>
              </div> */}
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">Back</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || hasAnyInvalidQr}
                className="btn-primary flex items-center gap-2 px-8 py-3 text-lg shadow-xl shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                {loading ? 'Submitting...' : 'Finish & Save Log'} <Check size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={async (file) => {
          if (cameraTarget === 'customer') {
            const compressed = await compressVisitImageFile(file);
            if (compressed) {
              setFormData(prev => ({ ...prev, customerPhoto: compressed }));
            }
          } else if (cameraTarget === 'unit' && activeUnitIndex !== null) {
            const compressed = await compressVisitImageFile(file);
            if (compressed) {
              handleExtinguisherChange(activeUnitIndex, 'maintenanceUnitPhoto', compressed);
            }
          } else if (cameraTarget === 'validation' && activeUnitIndex !== null) {
            const compressed = await compressVisitImageFile(file);
            if (compressed) {
              handleExtinguisherChange(activeUnitIndex, 'validationPhoto', compressed);
            }
          }
        }}
      />
      {/* Customer History Modal */}
      <CustomerHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        customerId={formData.customerId}
        customerName={formData.businessName}
      />
    </div>
  );
};

const Input = ({ label, name, value, onChange, placeholder, required = false, type = "text", disabled = false }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <input
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
      className={`input-field transition-all ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-slate-100' : 'bg-white'}`}
    />
  </div>
);

export default VisitForm;
