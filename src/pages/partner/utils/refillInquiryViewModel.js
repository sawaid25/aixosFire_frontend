/**
 * Maps inquiry + service_pricing rows for Refill / Refilled inquiries.
 * Per-kg pricing: total_refill = accepted_kg × price_per_kg (per line).
 */

import { resolvePricePerKg } from '../../../api/partnerRefill';

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const parseCapacityKg = (capacityValue) => {
  if (capacityValue == null) return 0;
  const raw = String(capacityValue).trim();
  if (!raw) return 0;
  const numeric = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const sumItemQuantities = (items) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((acc, item) => acc + num(item.quantity, 0), 0);
};

/**
 * Build per-line refill rows with service name from type or system.
 */
export const buildRefillLines = (inquiry, pricingRows = []) => {
  if (!inquiry || typeof inquiry !== 'object') return [];
  const items = inquiry.inquiry_items || [];
  
  const deliveryMode = inquiry.delivery_mode || null;
  const deliveryDeduction = deliveryMode === 'agent' ? num(inquiry.delivery_charge_per_kg, 2) : 0;

  return items.map((item) => {
    const rawType = item.type != null && String(item.type).trim() ? String(item.type).trim() : '';
    const rawSystem = item.system != null && String(item.system).trim() ? String(item.system).trim() : '';
    /** Pricing key must match service_pricing.service_name exactly; prefer type, else system. */
    const pricingKey = rawType || rawSystem;
    const serviceName = rawType || rawSystem || '—';
    const unitCount = Math.max(0, num(item.quantity, 0));
    const capacityKg = Math.max(0, parseCapacityKg(item.capacity));
    // Refill "Accept KG" should be based on actual kg capacity, not just unit count.
    // Example: quantity=1 and capacity=6kg => total line kg = 6.
    const quantityKg = capacityKg > 0
      ? Math.max(0, unitCount || 1) * capacityKg
      : unitCount;

    const { pricePerKg: basePricePerKg, matched, source: priceSource } = resolvePricePerKg(pricingKey, pricingRows);

    const pricePerKg = matched ? Math.max(0, basePricePerKg - deliveryDeduction) : null;
    
    // Prefer explicit refill acceptance columns, then legacy accepted_quantity.
    const storedAccepted =
      item.accepted_kg != null && item.accepted_kg !== ''
        ? num(item.accepted_kg, quantityKg)
        : (
      item.accepted_quantity != null && item.accepted_quantity !== ''
        ? num(item.accepted_quantity, quantityKg)
        : quantityKg
          );
    const acceptedKg = Math.min(Math.max(0, storedAccepted), quantityKg);
    const rejectedKg = Math.max(0, quantityKg - acceptedKg);
    const hasPersistedAcceptance = item.accepted_kg != null || item.accepted_quantity != null;

    return {
      itemId: item.id,
      serviceName,
      quantityKg,
      pricePerKg,
      basePricePerKg: matched ? basePricePerKg : null,
      deliveryDeduction: matched ? deliveryDeduction : 0,
      hasPrice: matched,
      priceSource,
      acceptedKg,
      rejectedKg,
      acceptedLocked: hasPersistedAcceptance,
      quantity: num(item.quantity, 1),
      capacity: item.capacity || null,
      type: item.type || item.system || '—',
    };
  });
};

export const buildRefillInquiryViewModel = (inquiry, pricingRows = []) => {
  if (!inquiry || typeof inquiry !== 'object') {
    return {
      inquiryNo: '—',
      customerName: '—',
      totalCylinders: 0,
      fillingChargePerUnit: 0,
      transportChargePerUnit: 0,
      pickupTypeLabel: '—',
      pickupStrategyDescription: '',
      isTransportChargeable: false,
      requirementNote: '',
      customerEmail: null,
      inquiryId: null,
      agentId: null,
      refillLines: [],
      transportFlatSar: 0,
    };
  }

  const customers = inquiry.customers || {};
  const customerName =
    customers.business_name || inquiry.customer_name || inquiry.client_name || '—';

  const inquiryNo = inquiry.inquiry_no || inquiry.inquiryNo || String(inquiry.id ?? '—');
  const inquiryId = inquiry.id ?? null;
  const agentId = inquiry.agent_id ?? null;

  const totalCylinders = num(
    inquiry.refill_total_quantity ??
      inquiry.total_cylinders ??
      inquiry.total_quantity ??
      inquiry.cylinder_count,
    sumItemQuantities(inquiry.inquiry_items)
  );

  const pricing = inquiry.refill_pricing || inquiry.pricing || inquiry.price_breakdown || {};
  const transportChargePerUnit = num(
    pricing.transport_charge ??
      pricing.transport_charges ??
      pricing.transport_charge_per_unit ??
      inquiry.transport_charge_per_unit ??
      inquiry.unit_transport_charge,
    0
  );

  const isTransportChargeable =
    typeof inquiry.is_transport_chargeable === 'boolean'
      ? inquiry.is_transport_chargeable
      : typeof inquiry.transport_chargeable === 'boolean'
        ? inquiry.transport_chargeable
        : transportChargePerUnit > 0;

  const pickupRaw =
    inquiry.pickup_type || inquiry.pickup_strategy || inquiry.delivery_method || inquiry.pickup || '';

  const pickupTypeLabel =
    typeof pickupRaw === 'string' && pickupRaw.trim() ? pickupRaw.replace(/_/g, ' ') : '—';

  const pickupStrategyDescription =
    inquiry.pickup_strategy_description || inquiry.pickup_description || inquiry.refill_pickup_notes || '';

  const refillLines = buildRefillLines(inquiry, pricingRows);

  /** One transport fee per order when chargeable (replaces old per-cylinder unit logic). */
  const transportFlatSar = isTransportChargeable ? transportChargePerUnit : 0;

  const requirementNote =
    inquiry.refill_requirement_note ||
    inquiry.partner_requirement_note ||
    (totalCylinders > 0
      ? `Total refill quantity for this inquiry: ${totalCylinders} kg (sum of lines). Adjust accepted kg per service below if you cannot fulfill the full amount.`
      : '');

  return {
    inquiryNo,
    customerName,
    totalCylinders: Math.max(0, Math.round(totalCylinders)),
    /** @deprecated UI uses per-kg lines; kept for compatibility */
    fillingChargePerUnit: 0,
    transportChargePerUnit,
    pickupTypeLabel,
    pickupStrategyDescription,
    isTransportChargeable,
    requirementNote,
    customerEmail: customers.email || inquiry.customer_email || null,
    customerPhone: customers.phone || inquiry.customer_phone || null,
    customerOwnerName: customers.owner_name || inquiry.customer_owner_name || null,
    customerId: inquiry.customer_id || customers.id || null,
    customerAddress: customers.address || inquiry.customer_address || null,
    customerLocationLat: customers.location_lat ?? null,
    customerLocationLng: customers.location_lng ?? null,
    inquiryId,
    agentId,
    refillLines,
    transportFlatSar,
    deliveryMode: inquiry.delivery_mode || null,
    deliveryStatus: inquiry.delivery_status || 'pending',
    pickupDate: inquiry.pickup_date || null,
    deliveryDate: inquiry.delivery_date || null,
    deliveryDeductionPerKg: (inquiry.delivery_mode || null) === 'agent' ? num(inquiry.delivery_charge_per_kg, 2) : 0,
    status: inquiry.status || 'pending',
    delivery_status: inquiry.delivery_status || 'pending',
  };
};
