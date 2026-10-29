import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

const AccessDenied = () => (
    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-soft max-w-xl mx-auto mt-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-5">
            <Lock size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access denied</h2>
        <p className="text-slate-500 mb-6">You don't have access to this page. Ask an Admin if you need it.</p>
        <Link to="/team/dashboard" className="btn-secondary inline-block">Go to Dashboard</Link>
    </div>
);

export default AccessDenied;
