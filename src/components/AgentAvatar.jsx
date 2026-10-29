import React, { useState } from 'react';
import { User } from 'lucide-react';

/**
 * An agent's profile photo inside an avatar tile, falling back to the person icon when
 * there's no usable photo — the value can be empty, a leftover '{}' from a failed upload,
 * or a URL whose file no longer loads — instead of a broken image with alt text.
 */
const AgentAvatar = ({ src, alt = '', iconSize = 24 }) => {
    const [failedSrc, setFailedSrc] = useState(null);
    const usable = typeof src === 'string' && /^(https?:\/\/|\/|blob:|data:)/.test(src.trim());

    if (!usable || failedSrc === src) {
        return (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
                <User size={iconSize} />
            </div>
        );
    }
    return <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setFailedSrc(src)} />;
};

export default AgentAvatar;
