/**
 * Shared "which Partners are eligible" rule, used by both the Agent creation flow
 * (src/pages/agent/VisitForm.jsx) and the Admin manual-assignment flow
 * (src/pages/admin/InquiryDetail.jsx) so the definition of "eligible" only lives
 * in one place.
 *
 * A Partner is eligible for (productId, mode, subtype) only when:
 *   1. The Admin global switch (service_availability) allows this mode/subtype.
 *   2. Neither the Admin per-partner override (admin_enabled) nor the Partner's
 *      own preference (is_enabled) has it disabled — a missing row means enabled.
 *   3. The product is actually assigned to that Partner (partner_products).
 */

/** subtype for a given inquiry mode — Validation/Refill have real sub-types, everything else is 'default'. */
export function subtypeForMode(mode, validationMode) {
  return ['Validation', 'Refill'].includes(mode) ? (validationMode || 'new') : 'default';
}

export function isPartnerServiceEligible(partnerId, mode, subtype, { partnerAvailability, globalAvailability }) {
  const globallyDisabled = (globalAvailability || []).some((row) =>
    row.service_type === mode &&
    row.service_subtype === subtype &&
    row.is_enabled === false
  );
  if (globallyDisabled) return false;

  if (!partnerId) return true;

  const disabled = (partnerAvailability || []).some((row) =>
    row.partner_id === partnerId &&
    row.service_type === mode &&
    row.service_subtype === subtype &&
    (row.is_enabled === false || row.admin_enabled === false)
  );
  return !disabled;
}

/**
 * @param {Map<string, Set<string>>} partnerProductsMap product_id -> Set<partner_id>
 */
export function getEligiblePartnersForProduct(productId, mode, subtype, { partners, partnerProductsMap, partnerAvailability, globalAvailability }) {
  if (!productId) return [];
  const assigned = partnerProductsMap?.get(productId);
  if (!assigned || assigned.size === 0) return [];

  return (partners || []).filter((p) =>
    assigned.has(p.id) &&
    isPartnerServiceEligible(p.id, mode, subtype, { partnerAvailability, globalAvailability })
  );
}

/** Builds product_id -> Set<partner_id> from a full partner_products read (`select('partner_id, product_id')`). */
export function buildPartnerProductsMap(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (!map.has(row.product_id)) map.set(row.product_id, new Set());
    map.get(row.product_id).add(row.partner_id);
  });
  return map;
}
