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
 * @returns {{ pricePerKg: number | null, matched: boolean }}
 */
export function resolvePricePerKg(serviceLabel, pricingRows) {
  if (!serviceLabel || !Array.isArray(pricingRows)) {
    return { pricePerKg: null, matched: false };
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
      return { pricePerKg: Number.isFinite(n) ? n : null, matched: true };
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
      return { pricePerKg: Number.isFinite(n) ? n : null, matched: true };
    }
  }

  // 3) Built-in default fallback when service_pricing is empty/missing.
  //    Keeps refill pricing usable even before DB defaults are seeded.
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
      return { pricePerKg: hit.pricePerKg, matched: true };
    }
  }

  return { pricePerKg: null, matched: false };
}

/** @deprecated use resolvePricePerKg; returns 0 when unmatched */
export function matchPricePerKg(serviceLabel, pricingRows) {
  const { pricePerKg } = resolvePricePerKg(serviceLabel, pricingRows);
  return pricePerKg != null ? pricePerKg : 0;
}

/**
 * Persist accepted quantities (kg or same unit as inquiry_items.quantity) and notify agent if partial.
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
  let assignedSum = 0;
  let acceptedSum = 0;

  for (const line of list) {
    const assigned = Number(line.quantityKg) || 0;
    const accepted = Math.min(
      Math.max(0, Number(line.acceptedKg) || 0),
      assigned
    );
    const rejected = Math.max(0, assigned - accepted);
    assignedSum += assigned;
    acceptedSum += accepted;

    const { error: upErr } = await supabase
      .from('inquiry_items')
      .update({
        accepted_quantity: accepted, // legacy compatibility
        accepted_kg: accepted,
        rejected_kg: rejected,
      })
      .eq('id', line.itemId)
      .eq('inquiry_id', inquiryId);

    if (upErr) {
      console.error('[finalizeRefillAcceptance] item update', upErr);
      throw upErr;
    }
  }

  const remaining = Math.max(0, assignedSum - acceptedSum);
  const acceptedKg = acceptedSum;
  const rejectedKg = remaining;

  if (agentId) {
    const msg = `Partner accepted ${acceptedKg}kg and rejected ${rejectedKg}kg for inquiry ${inquiryNo || inquiryId}.`;
    // notifications has no user_id/customer_id columns (recipient_id already
    // carries the agent) — matches the insert shape used elsewhere, e.g.
    // PartnerQuotationModal's notification insert.
    const row = {
      recipient_id: agentId,
      recipient_role: 'agent',
      sender_id: partnerId || null,
      sender_role: 'Partner',
      message: msg,
      inquiry_id: inquiryId,
      notification_type: 'refill_update',
      type: 'refill_update',
      is_read: false,
    };
    const { error: nErr } = await supabase.from('notifications').insert([row]);
    if (nErr) {
      console.error('[finalizeRefillAcceptance] notification', nErr);
      throw nErr;
    }
  }

  return { assignedSum, acceptedSum, remaining, acceptedKg, rejectedKg, transportFlatSar };
}
