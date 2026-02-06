import React from 'react';

const PageLoader = ({ message = "Loading data..." }) => (
    <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-3xl min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            <p className="text-sm font-medium text-slate-500">{message}</p>
        </div>
    </div>
);

export default PageLoader;
