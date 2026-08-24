import { supabase } from '../supabaseClient';

/**
 * Active service pricing rows for refill per-kg calculations.
 */
export async function fetchServicePricing() {
  const { data, error } = await supabase
    .from('service_pricing')
    .select('id, service_name, price_per_kg, created_at')
    .order('service_name', { ascending: true });

  if (error) {
    console.error('[fetchServicePricing]', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Candidate strings to match against service_pricing.service_name (exact, trim).
 * Handles labels like "CO2 - Carbon Dioxide" where the DB row is "CO2".
 */
export function pricingLookupKeys(serviceLabel) {
  const s = String(serviceLabel ?? '').trim();
  if (!s) return [];
  const keys = [];
  const seen = new Set();
  const push = (k) => {
    const t = String(k).trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      keys.push(t);
    }
  };
  push(s);
  // Split on hyphen / en dash / em dash (e.g. "CO2 - Carbon Dioxide" → "CO2")
  const parts = s.split(/\s*(?:-|–|—)\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    push(parts[0]);
  }
  return keys;
}

/**
 * Match inquiry_items.type (or system) to service_pricing.service_name.
 * Tries full label first, then first segment before " - …" so "CO2" matches "CO2 - Carbon Dioxide".
 * `source` tells callers whether the price came from a real service_pricing row
 * ('db'), the hardcoded keyword safety net below ('fallback'), or nothing matched
 * at all ('none') — callers must not treat 'fallback' as if it were 'db'.
 * @returns {{ pricePerKg: number | null, matched: boolean, source: 'db' | 'fallback' | 'none' }}
 */
export function resolvePricePerKg(serviceLabel, pricingRows) {
  if (!serviceLabel || !Array.isArray(pricingRows)) {
    return { pricePerKg: null, matched: false, source: 'none' };
  }

  const normalize = (v) => String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keys = pricingLookupKeys(serviceLabel);

  // 1) Exact (trim + case-insensitive)
  for (const key of keys) {
    const keyNorm = normalize(key);
    const hit = pricingRows.find((r) => normalize(r.service_name) === keyNorm);
    if (hit) {
      const n = Number(hit.price_per_kg);
      return { pricePerKg: Number.isFinite(n) ? n : null, matched: true, source: 'db' };
    }
  }

  // 2) Partial contains fallback:
  //    "ABC Dry Powder" should match "Dry Powder".
  for (const key of keys) {
    const keyNorm = normalize(key);
    if (!keyNorm) continue;
    const hit = pricingRows.find((r) => {
      const svcNorm = normalize(r.service_name);
      return svcNorm && (keyNorm.includes(svcNorm) || svcNorm.includes(keyNorm));
    });
    if (hit) {
      const n = Number(hit.price_per_kg);
      return { pricePerKg: Number.isFinite(n) ? n : null, matched: true, source: 'db' };
    }
  }

  // 3) Built-in default fallback when service_pricing is empty/missing.
  //    Keeps refill pricing usable even before DB defaults are seeded — but this
  //    is NOT configured pricing, so callers must label it as such (source: 'fallback').
  const defaultPricingByKeyword = [
    { keyword: 'dry powder', pricePerKg: 8 },
    { keyword: 'co2', pricePerKg: 10 },
    { keyword: 'foam', pricePerKg: 9 },
    { keyword: 'water', pricePerKg: 6 },
    { keyword: 'clean agent', pricePerKg: 12 },
  ];

  for (const key of keys) {
    const keyNorm = normalize(key);
    const hit = defaultPricingByKeyword.find((d) => keyNorm.includes(d.keyword));
    if (hit) {
      return { pricePerKg: hit.pricePerKg, matched: true, source: 'fallback' };
    }
  }

  return { pricePerKg: null, matched: false, source: 'none' };
}

/** @deprecated use resolvePricePerKg; returns 0 when unmatched */
export function matchPricePerKg(serviceLabel, pricingRows) {
  const { pricePerKg } = resolvePricePerKg(serviceLabel, pricingRows);
  return pricePerKg != null ? pricePerKg : 0;
}

/**
 * Persist accepted quantities (kg or same unit as inquiry_items.quantity) and notify agent if partial.
 *
 * Calls the `finalize_refill_acceptance` Postgres function (see
 * supabase/migrations/20260816120000_finalize_refill_acceptance_rpc.sql)
 * instead of looping per-line UPDATEs from the client — all item writes +
 * the agent notification happen atomically in one transaction, and the RPC
 * verifies the inquiry actually belongs to `partnerId` before writing anything.
 */
export async function finalizeRefillAcceptance({
  inquiryId,
  inquiryNo,
  agentId,
  customerId,
  partnerId,
  lines,
  transportFlatSar = 0,
}) {
  const list = Array.isArray(lines) ? lines : [];
  const items = list.map((line) => ({
    itemId: line.itemId,
    quantityKg: Number(line.quantityKg) || 0,
    acceptedKg: Math.max(0, Number(line.acceptedKg) || 0),
  }));

  const { data, error } = await supabase.rpc('finalize_refill_acceptance', {
    p_inquiry_id: inquiryId,
    p_partner_id: partnerId,
    p_items: items,
    p_agent_id: agentId || null,
    p_inquiry_no: inquiryNo || null,
  });

  if (error) {
    console.error('[finalizeRefillAcceptance] rpc error', error);
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  const assignedSum = items.reduce((acc, i) => acc + i.quantityKg, 0);
  const acceptedSum = rows.reduce((acc, r) => acc + (Number(r.accepted_kg) || 0), 0);
  const remaining = Math.max(0, assignedSum - acceptedSum);

  return { assignedSum, acceptedSum, remaining, acceptedKg: acceptedSum, rejectedKg: remaining, transportFlatSar };
}
