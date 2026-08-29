import React from 'react';
import {
    Flame, Droplet, Bell, Siren, Gauge, Waves, Cylinder, Package,
    Lightbulb, Volume2, Cable, ShowerHead, Beaker, Wind, Milestone,
} from 'lucide-react';

/**
 * Category-specific hero illustration shown when a product has no uploaded
 * image_url yet. Deliberately not a generic gray box — each category gets a
 * distinct gradient + layered icon composition so cards stay visually
 * identifiable at a glance. Replaced automatically once an admin uploads a
 * real photo (renders <img src={image_url}> instead when set).
 */
const CATEGORY_STYLES = {
    'Fire Alarm System': {
        gradient: 'from-amber-500 to-orange-600',
        Icon: Bell,
        Accent: Siren,
    },
    'Emergency Lighting & Central Monitoring': {
        gradient: 'from-yellow-500 to-amber-600',
        Icon: Lightbulb,
        Accent: Milestone,
    },
    'Voice Evacuation System': {
        gradient: 'from-purple-500 to-fuchsia-600',
        Icon: Volume2,
        Accent: Siren,
    },
    'Fire Resistant Cables': {
        gradient: 'from-slate-600 to-slate-800',
        Icon: Cable,
        Accent: null,
    },
    'Fire Pumps': {
        gradient: 'from-blue-500 to-indigo-600',
        Icon: Gauge,
        Accent: Waves,
    },
    'Automatic Sprinkler Head': {
        gradient: 'from-sky-500 to-blue-600',
        Icon: ShowerHead,
        Accent: Droplet,
    },
    'Portable Fire Extinguishers': {
        gradient: 'from-rose-500 to-red-600',
        Icon: Flame,
        Accent: Droplet,
    },
    'Special Suppression System': {
        gradient: 'from-cyan-600 to-teal-700',
        Icon: Wind,
        Accent: Cylinder,
    },
    'Foam System': {
        gradient: 'from-teal-500 to-emerald-600',
        Icon: Beaker,
        Accent: Droplet,
    },
    Valves: {
        gradient: 'from-orange-600 to-red-700',
        Icon: Gauge,
        Accent: Droplet,
    },
};

const DEFAULT_STYLE = { gradient: 'from-slate-500 to-slate-700', Icon: Package, Accent: null };

const ProductImageFallback = ({ category, className = '' }) => {
    const { gradient, Icon, Accent } = CATEGORY_STYLES[category] || DEFAULT_STYLE;

    return (
        <div className={`relative w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden ${className}`}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-white/10" />
            {Accent && <Accent size={40} className="absolute top-5 left-6 text-white/25" strokeWidth={1.5} />}
            <Icon size={64} className="text-white drop-shadow-md relative z-10" strokeWidth={1.75} />
        </div>
    );
};

export default ProductImageFallback;
