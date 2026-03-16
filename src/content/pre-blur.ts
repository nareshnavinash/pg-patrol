/**
 * Early content script (document_start) that injects CSS to blur all
 * unprocessed images/videos and hide body text until the main content
 * script completes its initial scan.
 *
 * Injected unconditionally — the main content script removes this
 * stylesheet if image filtering is disabled or after scan completes.
 * On adult domains, the stylesheet is NEVER removed (main script sets this).
 *
 * No module imports — keeps this script lightweight for document_start injection.
 */

const style = document.createElement('style');
style.id = 'pg-patrol-pre-blur';

style.textContent = `
  body { visibility: hidden; }
  img:not([data-pg-patrol-img-processed]) {
    filter: blur(20px) !important;
    transition: filter 0.3s ease;
  }
`;
(document.head || document.documentElement).appendChild(style);
