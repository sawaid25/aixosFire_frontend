import React from 'react';
import { inquiryStatusMeta } from '../constants/inquiryStatus';

const InquiryStatusBadge = ({ status, className = '' }) => {
    const { label, className: colors } = inquiryStatusMeta(status);
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold whitespace-nowrap ${colors} ${className}`}>
            {label}
        </span>
    );
};

export default InquiryStatusBadge;
