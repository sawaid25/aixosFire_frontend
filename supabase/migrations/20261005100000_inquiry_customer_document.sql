-- Optional PDF a customer attaches to a Validation Book Inquiry (their own inquiry /
-- approval document), next to the internal reference number (src/pages/customer/Booking.jsx).
--
-- The file is uploaded to storage first (POST /api/inquiries/customer-document, bucket
-- photo-references, path customer-documents/customer-<id>-<ts>.pdf); these columns hold
-- its public URL and original file name. Additive and nullable only — no existing row
-- or flow changes.
--
-- The backend (inquiryService.createCustomerInquiry) retries the insert without these
-- columns if this migration hasn't been applied yet, so applying it is safe at any time.

BEGIN;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS customer_document_url TEXT;

ALTER TABLE public.inquiries
    ADD COLUMN IF NOT EXISTS customer_document_name TEXT;

COMMIT;
