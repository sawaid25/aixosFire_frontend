import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { buildProductPdfDefinition, productPdfFileName } from './productPdfDocument';

// pdfmake 0.3 registers fonts with addVirtualFileSystem (vfs_fonts exports the vfs object
// itself); older builds used pdfMake.vfs.
const pdfVfs = pdfFonts?.pdfMake?.vfs || pdfFonts?.vfs || pdfFonts;
if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem(pdfVfs);
} else if (!pdfMake.vfs) {
    pdfMake.vfs = pdfVfs;
}

/**
 * pdfmake only embeds PNG/JPEG data URLs, so the product photo (any format the browser
 * can show, e.g. .webp) is redrawn onto a canvas as JPEG. Resolves null — and the PDF is
 * simply made without a photo — if there's no image, it fails to load, or it's slow.
 */
const imageToDataUrl = (src, maxSide = 900) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const timer = setTimeout(() => resolve(null), 8000);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        clearTimeout(timer);
        try {
            const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
            resolve(null);
        }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
});

/**
 * Downloads a one-product datasheet PDF with everything the Partner's product page shows
 * (see buildProductPdfDefinition). The photo is included when it loads.
 */
export async function downloadProductPdf(product, { partnerName } = {}) {
    if (!product) return;
    const photo = await imageToDataUrl(product.image_url);
    const docDefinition = buildProductPdfDefinition(product, { partnerName, photo });
    // pdfmake 0.3's download() returns a promise.
    await pdfMake.createPdf(docDefinition).download(productPdfFileName(product));
}
