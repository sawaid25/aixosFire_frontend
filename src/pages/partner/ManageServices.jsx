import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, RefreshCw, Package, Wrench, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getMyServiceAvailability, updateMyServiceAvailability } from '../../api/partners';

const SERVICE_GROUPS = [
  {
    type: 'Validation',
    icon: ShieldCheck,
    title: 'Validation',
    description: 'Configure which Validation services you provide.',
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
    description: 'Configure which Refill services you provide.',
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
    description: 'Configure your New Unit installation service.',
    items: [
      { subtype: 'default', label: 'New Unit Services', description: 'Install new fire safety equipment for a customer.' },
    ],
  },
  {
    type: 'Maintenance',
    icon: Wrench,
    title: 'Maintenance',
    description: 'Configure your Maintenance service.',
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

const ServiceRow = ({ label, description, enabled, saving, onToggle }) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-50 last:border-b-0">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-bold text-slate-900 text-sm">{label}</p>
        {enabled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
            <CheckCircle2 size={12} /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="w-2 h-2 rounded-full border border-slate-300" /> Not Offered
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

const ManageServices = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Map of `${type}::${subtype}` -> boolean, only for combos with an explicit row.
  // A missing key means enabled — same default used by the Agent form / DB trigger.
  const [availability, setAvailability] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await getMyServiceAvailability();
      const map = {};
      (rows || []).forEach((row) => {
        map[keyFor(row.service_type, row.service_subtype)] = row.is_enabled;
      });
      setAvailability(map);
    } catch (err) {
      console.error('[ManageServices] load error:', err);
      setError('Could not load your service settings. Please try again.');
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

  const handleToggle = async (type, subtype, label, nextValue) => {
    const key = keyFor(type, subtype);
    const prev = availability[key];
    setSavingKey(key);
    setAvailability((prevMap) => ({ ...prevMap, [key]: nextValue }));
    try {
      await updateMyServiceAvailability([{ service_type: type, service_subtype: subtype, is_enabled: nextValue }]);
      toast.success(`${label} service availability updated.`);
    } catch (err) {
      console.error('[ManageServices] save error:', err);
      setAvailability((prevMap) => ({ ...prevMap, [key]: prev }));
      toast.error(err?.response?.data?.error || err.message || `Failed to update ${label}.`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/partner/dashboard"
          className="p-2 rounded-xl hover:bg-slate-200/80 text-slate-600 transition-colors inline-flex"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-500/10 rounded-xl text-primary-600">
            <Wrench size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Manage Services</h1>
            <p className="text-sm font-medium text-slate-500">
              Choose the inquiry services your organization currently offers.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-soft p-12 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      ) : error ? (
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
      ) : (
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
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ManageServices;
