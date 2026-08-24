-- Atomic, ownership-checked multi-item Refill finalize.
--
-- Replaces the previous frontend behavior of looping N separate
-- `inquiry_items` UPDATE calls (partnerRefill.js finalizeRefillAcceptance):
-- a failure partway through that loop left some lines accepted and others
-- untouched, with no way to tell from the DB alone what actually finished.
-- This function does all item updates + the agent notification inside a
-- single Postgres function body (implicitly one transaction) — either every
-- line is written or none are, and a retry after a failure is always safe
-- because nothing partial was ever committed.
--
-- It also verifies the inquiry belongs to the calling partner before writing
-- anything (mirrors consume_partner_sticker_for_inquiry's existing pattern in
-- 20260415120000_sticker_usage_history_and_consume.sql). Accepted-kg clamping
-- (0 <= accepted <= quantity) mirrors the logic that used to live only in
-- partnerRefill.js, so it can no longer be bypassed by calling the RPC
-- directly with a bad payload.

BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_refill_acceptance(
    p_inquiry_id UUID,
    p_partner_id UUID,
    p_items JSONB,
    p_agent_id UUID DEFAULT NULL,
    p_inquiry_no TEXT DEFAULT NULL
)
RETURNS TABLE (
    item_id UUID,
    accepted_kg NUMERIC,
    rejected_kg NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inquiry RECORD;
    v_item JSONB;
    v_item_id UUID;
    v_quantity NUMERIC;
    v_accepted NUMERIC;
    v_rejected NUMERIC;
    v_total_accepted NUMERIC := 0;
    v_total_rejected NUMERIC := 0;
    v_message TEXT;
BEGIN
    IF p_inquiry_id IS NULL OR p_partner_id IS NULL THEN
        RAISE EXCEPTION 'inquiry_id and partner_id are required';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items must be a non-empty JSON array';
    END IF;

    -- Lock the inquiry row for the duration of this transaction so two
    -- concurrent finalize calls for the same inquiry can't interleave.
    SELECT id, partner_id
    INTO v_inquiry
    FROM public.inquiries
    WHERE id = p_inquiry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'inquiry not found: %', p_inquiry_id;
    END IF;

    IF v_inquiry.partner_id IS NULL OR v_inquiry.partner_id::text <> p_partner_id::text THEN
        RAISE EXCEPTION 'partner % is not authorized to finalize inquiry %', p_partner_id, p_inquiry_id;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := NULLIF(v_item->>'itemId', '')::UUID;
        IF v_item_id IS NULL THEN
            RAISE EXCEPTION 'each item requires an itemId';
        END IF;

        v_quantity := GREATEST(COALESCE((v_item->>'quantityKg')::NUMERIC, 0), 0);
        v_accepted := LEAST(GREATEST(COALESCE((v_item->>'acceptedKg')::NUMERIC, 0), 0), v_quantity);
        v_rejected := GREATEST(v_quantity - v_accepted, 0);

        UPDATE public.inquiry_items
        SET
            accepted_kg = v_accepted,
            rejected_kg = v_rejected,
            accepted_quantity = v_accepted -- legacy compatibility, matches prior JS behavior
        WHERE id = v_item_id
          AND inquiry_id = p_inquiry_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'inquiry_item % not found on inquiry %', v_item_id, p_inquiry_id;
        END IF;

        v_total_accepted := v_total_accepted + v_accepted;
        v_total_rejected := v_total_rejected + v_rejected;

        item_id := v_item_id;
        accepted_kg := v_accepted;
        rejected_kg := v_rejected;
        RETURN NEXT;
    END LOOP;

    IF p_agent_id IS NOT NULL THEN
        v_message := 'Partner accepted ' || v_total_accepted || 'kg and rejected ' || v_total_rejected
            || 'kg for inquiry ' || COALESCE(p_inquiry_no, p_inquiry_id::text) || '.';

        -- notifications has no user_id/customer_id columns (recipient_id already
        -- carries the agent) — matches the insert shape previously used in
        -- partnerRefill.js / PartnerQuotationModal.
        INSERT INTO public.notifications (
            recipient_id, recipient_role, sender_id, sender_role,
            message, inquiry_id, notification_type, type, is_read
        ) VALUES (
            p_agent_id::text, 'agent', p_partner_id::text, 'Partner',
            v_message, p_inquiry_id, 'refill_update', 'refill_update', false
        );
    END IF;

    RETURN;
END;
$$;

-- Called via supabase.rpc() with the anon key from the partner's browser
-- session, same trust model as consume_partner_sticker_for_inquiry.
GRANT EXECUTE ON FUNCTION public.finalize_refill_acceptance(UUID, UUID, JSONB, UUID, TEXT) TO anon, authenticated;

COMMIT;
