import React, { useState } from 'react';
import ProductImageFallback from './ProductImageFallback';

/**
 * Renders a product's real photo (`image_url`) with a graceful fallback:
 * if there is no URL, or the image fails to load (bad path, deleted file,
 * offline), it shows the category illustration instead of a broken <img>.
 *
 * Used everywhere a product is shown so cards, detail pages and modals stay
 * visually consistent.
 */
const ProductImage = ({ src, alt, category, className = 'w-full h-full object-cover' }) => {
    // Store which src failed rather than a bare boolean, so that when `src`
    // changes (list slot reused for another product) the fallback clears on
    // its own — no effect needed.
    const [failedSrc, setFailedSrc] = useState(null);

    if (!src || failedSrc === src) {
        return <ProductImageFallback category={category} />;
    }

    return (
        <img
            src={src}
            alt={alt || ''}
            className={className}
            loading="lazy"
            onError={() => setFailedSrc(src)}
        />
    );
};

export default ProductImage;
