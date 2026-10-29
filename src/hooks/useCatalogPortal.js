import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminCatalog, teamCatalog } from '../api/productCatalog';

/**
 * Which portal the shared catalog pages (pages/admin/Products.jsx, CategoryProducts.jsx,
 * AdminProductDetail.jsx) are rendering in.
 *
 * Internal Team is always read-only here: every catalog write on these pages (activate,
 * edit, add, assign partners, bulk import) goes straight to Supabase from the browser,
 * with no backend route that could check a team permission — so the Products module
 * only offers View (backend/services/teamPermissions.js). Granting writes later needs
 * backend endpoints first, then `canManage` can follow that permission.
 */
export default function useCatalogPortal() {
    const { user } = useAuth();
    const isTeam = user?.role === 'internal_team';
    return useMemo(() => (isTeam
        ? { basePath: '/team/products', portalLabel: 'Internal Team', canManage: false, catalog: teamCatalog }
        : { basePath: '/admin/products', portalLabel: 'Admin', canManage: true, catalog: adminCatalog }
    ), [isTeam]);
}
