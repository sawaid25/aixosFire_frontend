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
  FireExtinguisher,
  Scale,
  Box,
  Activity,
  DollarSign,
} from 'lucide-react';

const CustomerDetails = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [queries, setQueries] = useState([]);
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
      // Fetch Customer Details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
      } else {
        setCustomer(customerData);

        // Fetch Customer Queries (from extinguishers table)
        const { data: queriesData, error: queriesError } = await supabase
          .from('extinguishers')
          .select('*')
          .eq('customer_id', id)
          .order('id', { ascending: false });

        if (queriesError) {
          console.error('Error fetching customer queries:', queriesError);
        } else {
          setQueries(queriesData || []);
        }
      }
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

      {/* Customer Queries / Extinguishers */}
      <Section title={`Customer Equipment & Queries (${queries.length})`}>
        {queries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queries.map((query) => (
              <div
                key={query.id}
                className="group relative bg-white p-5 rounded-xl border border-slate-200 hover:border-primary-300 hover:shadow-md transition-all duration-200"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-slate-50 text-primary-600 rounded-lg group-hover:bg-primary-50 transition-colors">
                      <FireExtinguisher size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">
                        {query.type || 'Unknown Type'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-mono">
                        ID: #{query.id}
                      </p>
                    </div>
                  </div>
                  <QueryStatusBadge status={query.status} />
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
                  {query.capacity && (
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Capacity</p>
                        <p className="text-sm font-semibold text-slate-700">{query.capacity}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Quantity</p>
                      <p className="text-sm font-semibold text-slate-700">{query.quantity || 1}</p>
                    </div>
                  </div>

                  {query.condition && (
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Condition</p>
                        <p className="text-sm font-semibold text-slate-700">{query.condition}</p>
                      </div>
                    </div>
                  )}

                  {query.price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Price</p>
                        <p className="text-sm font-bold text-green-700">SAR {query.price}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer / Dates */}
                {query.expiry_date && (
                  <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Expires:</span>
                    <span className={`font-medium ${new Date(query.expiry_date) < new Date() ? 'text-red-500' : 'text-slate-700'}`}>
                      {formatDate(query.expiry_date)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
              <FireExtinguisher size={24} />
            </div>
            <p className="text-slate-500 font-medium">No equipment or queries found.</p>
            <p className="text-xs text-slate-400 mt-1">Logged items will appear here.</p>
          </div>
        )}
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

const QueryStatusBadge = ({ status }) => {
  const colors = {
    Pending: 'bg-yellow-100 text-yellow-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    Resolved: 'bg-green-100 text-green-700',
    Closed: 'bg-slate-100 text-slate-600',
    Valid: 'bg-green-100 text-green-700',
    Expired: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`px-3 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'
        }`}
    >
      {status || 'Pending'}
    </span>
  );
};




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
