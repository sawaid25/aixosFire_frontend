import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
  Phone,
  MapPin,
  User,
  Mail,
  Building2,
  Calendar,
} from 'lucide-react';

const CustomerDetails = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatLatLng = (value, type) => {
    if (value === null || value === undefined) return 'N/A';
    const rounded = Number(value).toFixed(5);
    if (type === 'lat') return `${rounded}° ${value >= 0 ? 'N' : 'S'}`;
    if (type === 'lng') return `${rounded}° ${value >= 0 ? 'E' : 'W'}`;
    return rounded;
  };

  useEffect(() => {
    const fetchCustomer = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (!error) setCustomer(data);
      setLoading(false);
    };

    fetchCustomer();
  }, [id]);

  if (loading) return <PageMessage text="Loading customer details..." />;
  if (!customer) return <PageMessage text="Customer not found" />;

  const sequenceNo = customer?.id;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border">
        <div className="flex items-center gap-5">
         {customer.image_url && (
          <img
            src={customer.image_url}
            alt="Profile"
            className="w-20 h-20 rounded-full border object-cover"
          />
        )}

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {customer.business_name || 'Business'}
            </h1>

            <p className="text-sm text-slate-500">
              Sequence No: <span className="font-semibold text-slate-700">{sequenceNo}</span>
            </p>

            <p className="text-xs text-slate-400 mt-1">Customer Profile</p>
          </div>
        </div>

        <StatusBadge status={customer.status} />
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <Grid>
          <Info icon={<User />} label="Owner Name" value={customer.owner_name} />
          <Info icon={<Building2 />} label="Business Type" value={customer.business_type} />
          <Info icon={<Phone />} label="Phone" value={customer.phone} />
          <Info icon={<Mail />} label="Email" value={customer.email} />
          <Info icon={<MapPin />} label="Address" value={customer.address} />
          <Info
            icon={<Calendar />}
            label="Created At"
            value={formatDate(customer.created_at)}
          />
        </Grid>
      </Section>

      {/* Location */}
      <Section title="Location">
        <Grid>
          <Info label="Latitude" value={formatLatLng(customer.location_lat, 'lat')} />
          <Info label="Longitude" value={formatLatLng(customer.location_lng, 'lng')} />
        </Grid>
      </Section>

      {/* QR Code */}
      {customer.qr_code_url && (
        <Section title="QR Code">
          <div className="flex items-center gap-6">
            <img
              src={customer.qr_code_url}
              alt="QR Code"
              className="w-32 h-32 border rounded-xl"
            />
            <p className="text-sm text-slate-500">
              Scan this QR code to identify the customer quickly.
            </p>
          </div>
        </Section>
      )}
    </div>
  );
};

/* ---------- Reusable Components ---------- */

const Section = ({ title, children }) => (
  <div className="bg-white rounded-2xl border p-6 space-y-4">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    {children}
  </div>
);

const Grid = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
);

const Info = ({ label, value, icon }) => (
  <div className="flex gap-3">
    {icon && <div className="text-slate-400 mt-1">{icon}</div>}
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value || 'N/A'}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const colors = {
    Lead: 'bg-blue-100 text-blue-700',
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`px-4 py-1 rounded-full text-sm font-bold ${colors[status] || colors.Lead}`}>
      {status || 'Lead'}
    </span>
  );
};

const PageMessage = ({ text }) => (
  <div className="p-10 text-center text-slate-500">{text}</div>
);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : 'N/A';

export default CustomerDetails;
