/**
 * Stat-card icon tile: a light tint of the card colour behind the icon in a darker shade
 * of it. Written out in full (not built as `${color}/10`) so Tailwind generates the
 * classes — v4 dropped the old `bg-opacity-*` utility, which left these tiles solid
 * colour with an invisible same-colour icon.
 */
const ICON_TONES = {
    'bg-blue-500': 'bg-blue-50 text-blue-600',
    'bg-green-500': 'bg-green-50 text-green-600',
    'bg-emerald-500': 'bg-emerald-50 text-emerald-600',
    'bg-orange-500': 'bg-orange-50 text-orange-600',
    'bg-amber-500': 'bg-amber-50 text-amber-700',
    'bg-red-500': 'bg-red-50 text-red-600',
    'bg-primary-500': 'bg-primary-50 text-primary-600',
    'bg-purple-500': 'bg-purple-50 text-purple-600',
    'bg-indigo-500': 'bg-indigo-50 text-indigo-600',
};

export const iconTone = (color) => ICON_TONES[color] || 'bg-slate-100 text-slate-600';
