import { formatKsaDate, formatKsaDateTime } from '../../../utils/dateTime';

const BRAND = '#ef4444';
const MUTED = '#64748b';

const specValue = (value) => {
    if (value == null || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

const slug = (text) => String(text || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const infoTable = (rows) => ({
    table: {
        widths: [140, '*'],
        body: rows.map(([label, value]) => [
            { text: label, style: 'cellLabel' },
            { text: value, style: 'cellValue' },
        ]),
    },
    layout: {
        fillColor: (rowIndex) => (rowIndex % 2 === 0 ? '#f8fafc' : null),
        hLineColor: () => '#e2e8f0',
        vLineColor: () => '#e2e8f0',
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 6,
        paddingBottom: () => 6,
    },
});

/** File name for a product's datasheet, e.g. "AIR-0032-i-o-module.pdf". */
export const productPdfFileName = (product) => `${product?.cat_no ? `${product.cat_no}-` : ''}${slug(product?.name)}.pdf`;

/**
 * pdfmake document for a one-product datasheet: photo (JPEG/PNG data URL, optional),
 * name, category, CAT No, Product# (model number), status, description, the Partner's
 * assignment and all technical specifications. Pure — no browser APIs — so it can be
 * rendered and checked outside the browser too.
 */
export function buildProductPdfDefinition(product, { partnerName = null, photo = null, generatedAt = new Date() } = {}) {
    const generatedLabel = formatKsaDateTime(generatedAt);
    const specEntries = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications)
        : [];
    const assignedOn = product.assigned_at
        ? formatKsaDate(product.assigned_at, { year: 'numeric', month: 'short', day: 'numeric' }, 'en-US')
        : '—';

    const summary = {
        stack: [
            { text: (product.category || 'Uncategorized').toUpperCase(), style: 'category' },
            { text: product.name || 'Product', style: 'title' },
            {
                text: [
                    product.cat_no ? { text: `CAT No ${product.cat_no}`, bold: true, color: BRAND } : '',
                    product.cat_no && product.model_number ? '   ·   ' : '',
                    product.model_number ? `Product# ${product.model_number}` : '',
                ],
                style: 'codes',
            },
            {
                text: product.is_active ? 'Active — available' : 'Inactive — not available for new usage',
                color: product.is_active ? '#059669' : MUTED,
                bold: true,
                margin: [0, 6, 0, 0],
            },
        ],
    };

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 50, 40, 60],
        info: { title: `${product.name || 'Product'} — Product Datasheet`, author: 'AiXOS Red' },
        content: [
            {
                columns: [
                    { text: [{ text: 'AiXOS ', bold: true }, { text: 'Red', bold: true, color: BRAND }], fontSize: 18 },
                    { text: 'PRODUCT DATASHEET', alignment: 'right', color: MUTED, bold: true, fontSize: 9, margin: [0, 6, 0, 0] },
                ],
            },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: BRAND }], margin: [0, 8, 0, 18] },

            photo
                ? { columns: [{ image: photo, fit: [190, 170], width: 200 }, { ...summary, width: '*', margin: [16, 0, 0, 0] }], columnGap: 0 }
                : summary,

            { text: 'Description', style: 'section' },
            { text: product.description || 'No description provided.', style: 'body' },

            { text: 'Product Information', style: 'section' },
            infoTable([
                ['Product Name', product.name || '—'],
                ['Category', product.category || 'Uncategorized'],
                ['CAT No', product.cat_no || '—'],
                ['Model Number (Product#)', product.model_number || 'Not specified'],
                ['Status', product.is_active ? 'Active — available' : 'Inactive — not available for new usage'],
                ['Availability', 'Assigned to your organization by Admin'],
                ['Assigned On', assignedOn],
            ]),

            { text: 'Technical Specifications', style: 'section' },
            specEntries.length > 0
                ? infoTable(specEntries.map(([key, value]) => [key, specValue(value)]))
                : { text: 'No specifications recorded for this product.', style: 'body', italics: true, color: MUTED },
        ],
        footer: (currentPage, pageCount) => ({
            margin: [40, 20, 40, 0],
            columns: [
                {
                    text: `${partnerName ? `${partnerName} · ` : ''}Generated ${generatedLabel}`,
                    fontSize: 8,
                    color: MUTED,
                },
                { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 8, color: MUTED },
            ],
        }),
        styles: {
            category: { fontSize: 9, bold: true, color: BRAND, characterSpacing: 0.5 },
            title: { fontSize: 20, bold: true, color: '#0f172a', margin: [0, 4, 0, 6] },
            codes: { fontSize: 10, color: MUTED },
            section: { fontSize: 12, bold: true, color: '#0f172a', margin: [0, 20, 0, 8] },
            body: { fontSize: 10, color: '#334155', lineHeight: 1.3 },
            cellLabel: { fontSize: 9, bold: true, color: MUTED },
            cellValue: { fontSize: 10, color: '#0f172a' },
        },
        defaultStyle: { fontSize: 10 },
    };

    return docDefinition;
}
