// Working product name; change here and in backend/src/seo.js when the final name is chosen.
export const BRAND = 'NotaryPrepPro';

export function setTitle(title) {
  document.title = title ? `${title} | ${BRAND}` : `${BRAND} | Free Notary Practice Tests`;
}
