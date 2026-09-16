import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Package, Wrench, CheckCircle2, SlidersHorizontal, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import PageLoader from '../../components/PageLoader';
import { supabase } from '../../supabaseClient';
import { getGlobalServiceAvailability, updateGlobalServiceAvailability } from '../../api/admin';

/**
 * Admin-level master switch per (service_type, service_subtype) — ANDed with each
 * Partner's own setting (src/pages/partner/ManageServices.jsx) wherever availability
 * is checked. Deliberately mirrors that page's structure/behavior (same service list,
 * same toggle-row UI, same immediate-save-with-toast flow, no confirmation dialog —
 * this admin panel doesn't use those for enable/disable actions anywhere else, see
 * Products.jsx's category/product toggle) since it's the same underlying concept at
 * a different scope.
 */
const SERVICE_GROUPS = [
  {
    type: 'Validation',
    icon: ShieldCheck,
    title: 'Validation',
    description: 'Control which Validation services are available system-wide.',
    items: [
      { subtype: 'new', label: 'New Validation', description: "Create a brand-new validation record for a customer's fire safety equipment." },
      { subtype: 'followup', label: 'Follow-up', description: 'Re-check equipment that was already validated on a previous visit.' },
      { subtype: 'license-renewal', label: 'License Renewal', description: 'Handle renewal of an expiring fire safety license or certificate.' },
    ],
  },
  {
    type: 'Refill',
    icon: RefreshCw,
    title: 'Refill',
    description: 'Control which Refill services are available system-wide.',
    items: [
      { subtype: 'new', label: 'New Refill', description: 'Refill fire extinguishers or cylinders for a customer.' },
      { subtype: 'followup', label: 'Follow-up', description: 'Follow up on a previous refill request.' },
      { subtype: 'license-renewal', label: 'License Renewal', description: 'Handle license renewal requests logged under Refill.' },
    ],
  },
  {
    type: 'New Unit',
    icon: Package,
    title: 'New Unit',
    description: 'Control the New Unit installation service system-wide.',
    items: [
      { subtype: 'default', label: 'New Unit Services', description: 'Install new fire safety equipment for a customer.' },
    ],
  },
  {
    type: 'Maintenance',
    icon: Wrench,
    title: 'Maintenance',
    description: 'Control the Maintenance service system-wide.',
    items: [
      { subtype: 'default', label: 'Maintenance Services', description: 'Perform maintenance and inspection visits on existing equipment.' },
    ],
  },
];

const keyFor = (type, subtype) => `${type}::${subtype}`;

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-emerald-500' : 'bg-slate-300'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
        }`}
    />
  </button>
);

const ServiceRow = ({ label, description, enabled, saving, onToggle, offeringCount }) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-50 last:border-b-0">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-bold text-slate-900 text-sm">{label}</p>
        {enabled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
            <CheckCircle2 size={12} /> Enabled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500">
            <span className="w-2 h-2 rounded-full border border-red-400" /> Disabled
          </span>
        )}
        {offeringCount != null && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Users size={11} /> {offeringCount} partner{offeringCount === 1 ? '' : 's'} offering
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    {saving ? (
      <Loader2 size={18} className="animate-spin text-slate-400 shrink-0" />
    ) : (
      <ToggleSwitch checked={enabled} onChange={onToggle} disabled={saving} />
    )}
  </div>
);

const ServiceManage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Map of `${type}::${subtype}` -> boolean. All 6 combos are seeded by migration, so
  // in practice every key is always present — the `true` fallback below is defensive.
  const [availability, setAvailability] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  // "Partners offering" count per service: total active partners minus however many
  // explicitly disabled that combo — a missing partner_service_availability row means
  // "offering" (same default used everywhere else this table is read), so this is
  // read-only informational context, not a write path.
  const [totalPartners, setTotalPartners] = useState(0);
  const [disabledCounts, setDisabledCounts] = useState({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, partnerCountRes, disabledRes] = await Promise.all([
        getGlobalServiceAvailability(),
        supabase.from('partners').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('partner_service_availability').select('service_type, service_subtype').eq('is_enabled', false),
      ]);

      const map = {};
      (rows || []).forEach((row) => {
        map[keyFor(row.service_type, row.service_subtype)] = row.is_enabled;
      });
      setAvailability(map);

      setTotalPartners(partnerCountRes?.count || 0);
      const counts = {};
      (disabledRes?.data || []).forEach((row) => {
        const key = keyFor(row.service_type, row.service_subtype);
        counts[key] = (counts[key] || 0) + 1;
      });
      setDisabledCounts(counts);
    } catch (err) {
      console.error('[ServiceManage] load error:', err);
      setError('Could not load service settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isEnabled = useMemo(() => (type, subtype) => {
    const key = keyFor(type, subtype);
    return key in availability ? availability[key] : true;
  }, [availability]);

  const offeringCount = useMemo(() => (type, subtype) => {
    const key = keyFor(type, subtype);
    return Math.max(0, totalPartners - (disabledCounts[key] || 0));
  }, [totalPartners, disabledCounts]);

  const handleToggle = async (type, subtype, label, nextValue) => {
    const key = keyFor(type, subtype);
    const prev = availability[key];
    setSavingKey(key);
    setAvailability((prevMap) => ({ ...prevMap, [key]: nextValue }));
    try {
      await updateGlobalServiceAvailability([{ service_type: type, service_subtype: subtype, is_enabled: nextValue }]);
      toast.success(`${label} ${nextValue ? 'enabled' : 'disabled'} system-wide.`);
    } catch (err) {
      console.error('[ServiceManage] save error:', err);
      setAvailability((prevMap) => ({ ...prevMap, [key]: prev }));
      toast.error(err?.response?.data?.error || err.message || `Failed to update ${label}.`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="relative min-h-[400px] space-y-8 pb-10">
      {loading && <PageLoader message="Loading service settings..." />}

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-600">
          <SlidersHorizontal size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Service Manage</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Enable or disable services system-wide. A service must be enabled here AND by the
            Partner for it to appear during inquiry creation.
          </p>
        </div>
      </div>

      {!loading && error ? (
        <div className="bg-white rounded-3xl border border-red-100 shadow-soft p-8 text-center">
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button
            type="button"
            onClick={load}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : !loading ? (
        <div className="space-y-6">
          {SERVICE_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.type} className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-50 flex items-center gap-3">
                  <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-600 shrink-0">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{group.title}</h2>
                    <p className="text-xs text-slate-500">{group.description}</p>
                  </div>
                </div>
                <div className="px-6 md:px-8">
                  {group.items.map((item) => (
                    <ServiceRow
                      key={item.subtype}
                      label={item.label}
                      description={item.description}
                      enabled={isEnabled(group.type, item.subtype)}
                      saving={savingKey === keyFor(group.type, item.subtype)}
                      onToggle={(next) => handleToggle(group.type, item.subtype, item.label, next)}
                      offeringCount={offeringCount(group.type, item.subtype)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default ServiceManage;
