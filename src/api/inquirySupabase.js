import { supabase } from '../supabaseClient';

function throwReadableDbError(err, context) {
  const detail = err?.message || err?.details || err?.hint || err?.code || 'Unknown database error';
  const wrapped = new Error(`${context}: ${detail}`);
  wrapped.original = err;
  throw wrapped;
}

/** PostgREST / Postgres: unknown or missing column on insert */
function isLikelyMissingColumnError(err) {
  const text = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`;
  return /column|schema cache|does not exist|PGRST204/i.test(text);
}

function isMissingRpcFunctionError(err) {
  const text = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''}`;
  return /PGRST202|Could not find the function|schema cache/i.test(text);
}

function isLegacyStickerCodeConstraintError(err) {
  const text = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''}`;
  return /23502|sticker_code|violates not-null constraint/i.test(text);
}

const CORE_INQUIRY_KEYS = new Set([
  'inquiry_no',
  'customer_id',
  'type',
  'priority',
  'status',
  'partner_id',
  'agent_id',
  'visit_id',
  'performed_by',
  'follow_up_date',
  'qr_code_value',
]);

function normalizeStickerUsedFor(typeValue) {
  const t = String(typeValue || '').trim().toLowerCase();
  if (t === 'validation') return 'validation';
  if (t === 'refilled' || t === 'refill') return 'refilled';
  return null;
}

/**
 * Insert inquiry + items directly into Supabase when the REST API is unreachable.
 * Keeps agent visit flow working on Vercel when VITE_API_URL / CORS / backend SSL fails.
 */
export async function createInquiryViaSupabase(inquiryData, items) {
  if (!inquiryData?.customer_id || !inquiryData?.inquiry_no || !inquiryData?.type) {
    throw new Error('createInquiryViaSupabase: missing inquiry_no, customer_id, or type');
  }

  const normalizedType = normalizeStickerUsedFor(inquiryData?.type);

  // A validation inquiry made up entirely of follow-up items doesn't consume
  // a partner sticker (it's a re-check of an already-validated unit, not a
  // fresh validation), so a partner isn't mandatory for it — unlike a new
  // validation or a refill, which always requires one.
  const itemsArr = Array.isArray(items) ? items : [];
  const isFollowupOnlyValidation =
    normalizedType === 'validation' &&
    itemsArr.length > 0 &&
    itemsArr.every((it) => (it.validation_mode ?? 'new') === 'followup');

  if (normalizedType && !inquiryData?.partner_id && !isFollowupOnlyValidation) {
    const err = new Error('Partner is required for this inquiry type');
    err.status = 400;
    throw err;
  }

  const { data: existingInquiry, error: existingInquiryErr } = await supabase
    .from('inquiries')
    .select('id')
    .eq('inquiry_no', inquiryData.inquiry_no)
    .limit(1)
    .maybeSingle();

  if (existingInquiryErr) {
    throwReadableDbError(existingInquiryErr, 'Could not validate duplicate inquiry');
  }

  if (existingInquiry?.id) {
    throw new Error('Duplicate inquiry request detected');
  }

  const inquiryRow = {
    inquiry_no: inquiryData.inquiry_no,
    customer_id: inquiryData.customer_id,
    type: inquiryData.type,
    priority: inquiryData.priority || 'Medium',
    status: inquiryData.status || ((inquiryData.type || '').toLowerCase() === 'validation' ? 'completed' : 'pending'),
  };

  const optionalInquiryKeys = [
    'partner_id',
    'agent_id',
    'visit_id',
    'performed_by',
    'follow_up_date',
    'qr_code_value',
    'internal_reference_number',
    'notes',
    'preferred_date',
  ];

  optionalInquiryKeys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(inquiryData, k)) {
      const v = inquiryData[k];
      if (v !== undefined && v !== null && v !== '') {
        inquiryRow[k] = v;
      }
    }
  });

  let inqRes = await supabase
    .from('inquiries')
    .insert([inquiryRow])
    .select('id')
    .single();

  if (inqRes.error && isLikelyMissingColumnError(inqRes.error)) {
    console.warn('[createInquiryViaSupabase] retrying inquiry insert without optional columns');
    const slim = {};
    Object.keys(inquiryRow).forEach((k) => {
      if (CORE_INQUIRY_KEYS.has(k)) slim[k] = inquiryRow[k];
    });
    inqRes = await supabase.from('inquiries').insert([slim]).select('id').single();
  }

  const { data: inq, error: inqErr } = inqRes;

  if (inqErr) {
    console.error('[createInquiryViaSupabase] inquiries insert', inqErr);
    throwReadableDbError(inqErr, 'Could not save inquiry');
  }

  const inquiryId = inq.id;
  const customerId = inquiryData.customer_id;
  const itemList = Array.isArray(items) ? items : [];
  const shouldConsumeSticker = Boolean(inquiryData?.partner_id && normalizedType);

  if (shouldConsumeSticker) {
    const { data: partnerRow, error: partnerErr } = await supabase
      .from('partners')
      .select('id, stickers_total')
      .eq('id', inquiryData.partner_id)
      .maybeSingle();

    if (partnerErr) {
      throwReadableDbError(partnerErr, 'Could not validate partner sticker balance');
    }

    if (!partnerRow?.id) {
      throw new Error('Partner not found for sticker validation');
    }

    const current = Number(partnerRow.stickers_total ?? 0);
    if (current <= 0) {
      throw new Error('No stickers available');
    }
  }

  const itemRows = itemList.map((it) => {
    const row = {
      inquiry_id: inquiryId,
      customer_id: customerId,
      serial_no: it.serial_no ?? 1,
      type: it.type ?? null,
      system_type: it.system_type ?? null,
      capacity: it.capacity ?? null,
      quantity: it.quantity ?? 1,
      price: it.price ?? 0,
      unit: it.unit ?? 'Pieces',
      system: it.system ?? null,
      status: it.status ?? null,
      catalog_no: it.catalog_no ?? null,
      product_id: it.product_id ?? null,
      maintenance_notes: it.maintenance_notes ?? null,
      maintenance_voice_url: it.maintenance_voice_url ?? null,
      maintenance_unit_photo_url: it.maintenance_unit_photo_url ?? null,
      extinguisher_photo: it.extinguisher_photo ?? null,
      expiry_date: it.expiry_date ?? null,
      performed_by: it.performed_by ?? null,
      is_sub_unit: it.is_sub_unit ?? false,
      validation_mode: it.validation_mode ?? 'new',
      follow_up_date: it.follow_up_date ?? null,
      follow_up_date_validation: it.follow_up_date_validation ?? null,
    };
    if (it.condition != null) row.condition = it.condition;
    return row;
  });

  if (itemRows.length > 0) {
    const { error: itemsErr } = await supabase.from('inquiry_items').insert(itemRows);
    if (itemsErr) {
      console.error('[createInquiryViaSupabase] inquiry_items insert', itemsErr);
      throwReadableDbError(itemsErr, 'Could not save inquiry line items');
    }
  }

  if (shouldConsumeSticker) {
    const applyStickerFallback = async () => {
      const usedFor = normalizedType;

      const { data: existingHistory, error: historyCheckErr } = await supabase
        .from('sticker_usage_history')
        .select('id')
        .eq('inquiry_id', inquiryId)
        .limit(1)
        .maybeSingle();

      if (historyCheckErr) {
        throwReadableDbError(historyCheckErr, 'Could not validate sticker usage history');
      }

      if (existingHistory?.id) {
        console.log('[sticker-usage:fallback]', {
          partner_id: inquiryData.partner_id,
          inquiry_id: inquiryId,
          skipped_duplicate: true,
        });
        return;
      }

      const { data: partnerBefore, error: partnerBeforeErr } = await supabase
        .from('partners')
        .select('id, stickers_total')
        .eq('id', inquiryData.partner_id)
        .maybeSingle();

      if (partnerBeforeErr) {
        throwReadableDbError(partnerBeforeErr, 'Could not read partner stickers');
      }
      if (!partnerBefore?.id) {
        throw new Error('Partner not found for sticker validation');
      }

      const before = Number(partnerBefore.stickers_total ?? 0);
      if (before <= 0) {
        throw new Error('No stickers available');
      }

      const next = before - 1;
      const { data: partnerAfter, error: partnerUpdateErr } = await supabase
        .from('partners')
        .update({ stickers_total: next })
        .eq('id', inquiryData.partner_id)
        .eq('stickers_total', before)
        .select('stickers_total')
        .maybeSingle();

      if (partnerUpdateErr) {
        throwReadableDbError(partnerUpdateErr, 'Could not deduct sticker');
      }

      if (!partnerAfter) {
        throw new Error('Sticker balance changed, please retry');
      }

      const { error: historyInsertErr } = await supabase
        .from('sticker_usage_history')
        .insert([
          {
            partner_id: inquiryData.partner_id,
            inquiry_id: inquiryId,
            used_for: usedFor,
            quantity: 1,
          },
        ]);

      let finalHistoryInsertErr = historyInsertErr;

      // Legacy DB compatibility: some environments still require sticker_code NOT NULL.
      if (finalHistoryInsertErr && isLegacyStickerCodeConstraintError(finalHistoryInsertErr)) {
        const fallbackCode = `AUTO-${String(inquiryId).slice(0, 8).toUpperCase()}`;
        const retryWithLegacyCode = await supabase
          .from('sticker_usage_history')
          .insert([
            {
              partner_id: inquiryData.partner_id,
              inquiry_id: inquiryId,
              used_for: usedFor,
              quantity: 1,
              sticker_code: fallbackCode,
            },
          ]);

        // If sticker_code column does not exist, retry once without it.
        if (retryWithLegacyCode.error && isLikelyMissingColumnError(retryWithLegacyCode.error)) {
          const retryWithoutLegacyCode = await supabase
            .from('sticker_usage_history')
            .insert([
              {
                partner_id: inquiryData.partner_id,
                inquiry_id: inquiryId,
                used_for: usedFor,
                quantity: 1,
              },
            ]);
          finalHistoryInsertErr = retryWithoutLegacyCode.error || null;
        } else {
          finalHistoryInsertErr = retryWithLegacyCode.error || null;
        }
      }

      if (finalHistoryInsertErr) {
        // Best effort compensation to keep counts balanced.
        await supabase
          .from('partners')
          .update({ stickers_total: before })
          .eq('id', inquiryData.partner_id)
          .eq('stickers_total', next);
        throwReadableDbError(finalHistoryInsertErr, 'Could not save sticker usage history');
      }

      console.log('[sticker-usage:fallback]', {
        partner_id: inquiryData.partner_id,
        inquiry_id: inquiryId,
        sticker_before: before,
        sticker_after: next,
        skipped_duplicate: false,
      });
    };

    const { data: consumeResult, error: consumeErr } = await supabase.rpc(
      'consume_partner_sticker_for_inquiry',
      {
        p_partner_id: inquiryData.partner_id,
        p_inquiry_id: inquiryId,
        p_used_for: normalizedType,
      }
    );

    if (consumeErr) {
      if (isMissingRpcFunctionError(consumeErr) || isLegacyStickerCodeConstraintError(consumeErr)) {
        console.warn('[createInquiryViaSupabase] RPC missing, using fallback sticker flow');
        try {
          await applyStickerFallback();
          return { id: inquiryId, via: 'supabase' };
        } catch (fallbackErr) {
          console.error('[createInquiryViaSupabase] fallback sticker consume failed', fallbackErr);
          await supabase.from('inquiry_items').delete().eq('inquiry_id', inquiryId);
          await supabase.from('inquiries').delete().eq('id', inquiryId);
          throw fallbackErr;
        }
      }

      console.error('[createInquiryViaSupabase] sticker consume failed', consumeErr);
      await supabase.from('inquiry_items').delete().eq('inquiry_id', inquiryId);
      await supabase.from('inquiries').delete().eq('id', inquiryId);
      throwReadableDbError(consumeErr, 'Could not deduct sticker');
    }

    const consumeRow = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;
    console.log('[sticker-usage]', {
      partner_id: inquiryData.partner_id,
      inquiry_id: inquiryId,
      sticker_before: consumeRow?.stickers_before ?? null,
      sticker_after: consumeRow?.stickers_after ?? null,
      skipped_duplicate: Boolean(consumeRow?.skipped_duplicate),
    });
  }

  return { id: inquiryId, via: 'supabase' };
}

/**
 * One-time repair: update any Validation inquiry still saved as 'pending' to 'completed'.
 * Safe to call on every dashboard load — only touches rows that need fixing.
 */
export async function repairValidationInquiryStatuses() {
  try {
    const { error } = await supabase
      .from('inquiries')
      .update({ status: 'completed' })
      .eq('type', 'Validation')
      .eq('status', 'pending');

    if (error) {
      console.warn('[repairValidationInquiryStatuses] update failed:', error.message);
    }
  } catch (err) {
    console.warn('[repairValidationInquiryStatuses] unexpected error:', err);
  }
}
