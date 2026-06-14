// AI Workspace Local Configuration fallback
window.__CORTEX_AI_LOCAL_CONFIG__ = window.__CORTEX_AI_LOCAL_CONFIG__ || {};

// ─── Source Atlas Viewer — Container Expansion Fix ───────────────────────────
// Problem: B1Card has overflow:hidden (inline style + CSS class). The outer
// grid container has maxHeight:480px;overflow:auto. Images inside use
// loading="lazy" inside an overflow:auto container, so the browser may not
// trigger lazy-load or compute intrinsic height before the card collapses.
// Result: cards only show ~60px (header height) and clip the actual image.
//
// Fix strategy:
//   1. CSS !important to override overflow on cards that contain source-page imgs
//   2. JS MutationObserver to remove maxHeight from the grid wrapper and switch
//      lazy → eager on source-page images after every React render
// ─────────────────────────────────────────────────────────────────────────────
(function patchSourceAtlasViewer() {
  'use strict';

  // ── 1. Inject persistent CSS overrides ──────────────────────────────────
  // !important in author stylesheet beats regular inline styles (no !important).
  var style = document.createElement('style');
  style.id = 'cortex-atlas-patch-v2';
  style.textContent = [
    /* Grid wrapper: let it grow as tall as its content */
    '.cortex-atlas-page-grid { max-height: none !important; overflow: visible !important; }',

    /* B1Card containing a source-page image: allow full expansion */
    '.b1-card:has(img[alt*="Source page"]) {',
    '  overflow: visible !important;',
    '  height: auto !important;',
    '}',

    /* Inner image wrapper div (direct child of B1Card, after header) */
    '.b1-card:has(img[alt*="Source page"]) > div:last-child {',
    '  overflow: visible !important;',
    '  height: auto !important;',
    '}',

    /* The images themselves */
    'img[alt*="Source page"] {',
    '  display: block !important;',
    '  width: 100% !important;',
    '  height: auto !important;',
    '  min-height: 0 !important;',
    '}',
  ].join('\n');

  function injectStyle() {
    if (!document.getElementById('cortex-atlas-patch-v2')) {
      (document.head || document.documentElement).appendChild(style);
    }
  }
  injectStyle();

  // ── 2. JS fixes: maxHeight removal + lazy→eager ──────────────────────────
  function patchContainers() {
    var imgs = document.querySelectorAll('img[alt*="Source page"]');
    if (!imgs.length) return;

    imgs.forEach(function (img) {
      // Switch lazy → eager so browser loads image and knows intrinsic size
      if (img.getAttribute('loading') === 'lazy') {
        img.setAttribute('loading', 'eager');
      }

      // Ensure the card containing this image has no overflow/height constraint
      var card = img.closest ? img.closest('.b1-card') : null;
      if (card) {
        card.style.overflow = 'visible';
        card.style.height = 'auto';
      }

      // Ensure the inner image-wrapper div (parent of img) also expands
      var wrapper = img.parentElement;
      if (wrapper && wrapper !== card) {
        wrapper.style.overflow = 'visible';
        wrapper.style.height = 'auto';
      }

      // Remove maxHeight from the grid container (parent of .b1-card)
      if (card && card.parentElement) {
        var grid = card.parentElement;
        if (grid.style.maxHeight && grid.style.maxHeight !== 'none') {
          grid.style.maxHeight = 'none';
          grid.style.overflow = 'visible';
          // Mark it so we can re-identify it cheaply
          grid.classList.add('cortex-atlas-page-grid');
        }
      }
    });
  }

  // ── 3. MutationObserver: reapply after every React render ────────────────
  var ticking = false;
  function schedulePatc() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        injectStyle();
        patchContainers();
        ticking = false;
      });
    }
  }

  var mo = new MutationObserver(schedulePatc);

  function start() {
    mo.observe(document.body, { childList: true, subtree: true, attributes: false });
    patchContainers();
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }

  // Also run at key moments after initial load
  [300, 800, 1500, 3000].forEach(function (t) {
    setTimeout(patchContainers, t);
  });
})();
