-- Request details the Customer "New inquiry" form collects (src/pages/customer/Booking.jsx):
-- the customer's internal reference / PO number, free-text notes, and a preferred date.
--
-- Why: Booking has always sent these, and the Customer dashboard / inquiry detail page
-- display them, but the inquiries table never had the columns, so they were silently
-- dropped (audit task I4). Additive and nullable only — no existing row or flow changes.
--
-- The backend (inquiryService.createCustomerInquiry) retries the insert without these
-- columns if this migration hasn't been applied yet, so applying it is safe at any time.

BEGIN;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS internal_reference_number TEXT;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS preferred_date DATE;

COMMIT;
