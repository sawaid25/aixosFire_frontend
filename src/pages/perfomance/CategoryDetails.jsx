import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import PageLoader from "../../components/PageLoader";

const CategoryDetails = () => {
  const { category } = useParams();
  const { user } = useAuth();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const formattedCategory =
    category.charAt(0).toUpperCase() + category.slice(1);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: fetchedData, error } = await supabase
        .from("extinguishers")
        .select(`
          id,
          type,
          capacity,
          quantity,
          price,
          install_date,
          last_refill_date,
          expiry_date,
          condition,
          status,
          brand,
          seller,
          partner,
          query_status,
          firefighting_system,
          fire_alarm_system,
          pump_type,
          maintenance_notes,
          maintenance_voice_url,
          maintenance_unit_photo_url,
          is_sub_unit,
          unit,
          created_at,
          certificate_photo,
          extinguisher_photo,
          visits (
            visit_date,
            agent_id
          )
        `)
        .eq("status", formattedCategory)
        .eq("visits.agent_id", user.id);

      if (!error) setData(fetchedData);
      setLoading(false);
    };

    fetchData();
  }, [formattedCategory, user]);

  const handleCloseQuery = async (id) => {
    if (!window.confirm("Are you sure you want to close this query?")) return;

    try {
      const { error } = await supabase
        .from("extinguishers")
        .update({ query_status: "Closed" })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setData(prev => prev.map(item =>
        item.id === id ? { ...item, query_status: "Closed" } : item
      ));

      alert("Query closed successfully!");
    } catch (err) {
      console.error("Error closing query:", err);
      alert("Failed to close query");
    }
  };

  const formatDate = (dateStr) => (dateStr ? dateStr.split("T")[0] : "NA");

  return (
    <div className="relative min-h-[400px] space-y-6">
      {/* Back Link + Title */}
      <div className="flex items-center gap-3">
        <Link
          to="/agent/performance"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-bold">{formattedCategory} Requests</h1>
      </div>

      {/* Loading / Empty State */}
      {loading && <PageLoader />}
      {!loading && data.length === 0 ? (
        <p className="text-center py-10">No records found</p>
      ) : !loading && (
        <div className="overflow-x-auto bg-white rounded-2xl shadow-soft border">
          <table className="min-w-full text-sm divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-slate-600 uppercase text-xs tracking-wide">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Capacity</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-left">Sub?</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Condition</th>
                <th className="px-4 py-3 text-left">Brand</th>
                <th className="px-4 py-3 text-left">Seller</th>
                <th className="px-4 py-3 text-left">Partner</th>
                <th className="px-4 py-3 text-left">System</th>
                <th className="px-4 py-3 text-left">Fire Alarm</th>
                <th className="px-4 py-3 text-left">Pump</th>
                <th className="px-4 py-3 text-left">Install Date</th>
                <th className="px-4 py-3 text-left">Last Refill</th>
                <th className="px-4 py-3 text-left">Expiry Date</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-center">Media</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-100">
              {data.map((item, i) => (
                <tr
                  key={item.id}
                  className={`transition hover:bg-blue-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"
                    }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{item.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.visits?.visit_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {item.type || item.firefighting_system || item.fire_alarm_system || item.pump_type || "NA"}
                  </td>
                  <td className="px-4 py-3">{item.capacity || item.firefighting_system ? "System" : "NA"}</td>
                  <td className="px-4 py-3">{item.quantity ?? "NA"}</td>
                  <td className="px-4 py-3">{item.unit || "Pieces"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_sub_unit ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.is_sub_unit ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-green-700">
                    {item.price !== null ? `SAR ${item.price}` : "NA"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'Valid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {item.status || "NA"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.condition === 'Good' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {item.condition || "NA"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.brand || "NA"}</td>
                  <td className="px-4 py-3">{item.seller || "NA"}</td>
                  <td className="px-4 py-3">{item.partner || "NA"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.firefighting_system || "NA"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.fire_alarm_system || "NA"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.pump_type || "NA"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.install_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.last_refill_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.expiry_date)}</td>
                  <td className="px-4 py-3 max-w-[150px] truncate" title={item.maintenance_notes}>
                    {item.maintenance_notes || "--"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {item.extinguisher_photo && (
                        <a href={item.extinguisher_photo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title="Extinguisher Photo">🖼️</a>
                      )}
                      {item.maintenance_unit_photo_url && (
                        <a href={item.maintenance_unit_photo_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800" title="Maintenance Photo">🛠️</a>
                      )}
                      {item.maintenance_voice_url && (
                        <a href={item.maintenance_voice_url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800" title="Voice Note">🎤</a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.query_status === 'Active' ? (
                      <button
                        onClick={() => handleCloseQuery(item.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium text-xs whitespace-nowrap"
                      >
                        Close Query
                      </button>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CategoryDetails;
