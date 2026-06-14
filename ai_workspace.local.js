// AI Workspace Local Configuration fallback
window.__CORTEX_AI_LOCAL_CONFIG__ = window.__CORTEX_AI_LOCAL_CONFIG__ || {};

// ─── Source Atlas Viewer — Full Container Expansion Fix (v3) ─────────────────
// Root causes identified:
//   1. CSS Grid outer container: grid-row heights get "frozen" at ~60px before
//      images load; grid rows do NOT auto-expand after lazy images finish loading.
//   2. B1Card inline style: overflow:hidden clips the expanded image.
//   3. Inner image-wrapper div: overflow:hidden clips further.
//   4. loading="lazy" inside overflow:auto container: browser may not resolve
//      intrinsic height before grid freezes row size.
//
// Fix strategy:
//   a. Switch grid container from display:grid → display:block (eliminates
//      frozen-row-height problem; block stacking always follows content height).
//   b. CSS !important to override overflow on B1Cards that contain atlas images.
//   c. JS: add class to grid, switch eager loading, reapply on image load event.
//   d. MutationObserver to re-patch after every React re-render.
// ─────────────────────────────────────────────────────────────────────────────
(function patchSourceAtlasViewer() {
  'use strict';

  // ── CSS overrides ─────────────────────────────────────────────────────────
  var CSS_RULES = [
    /* Grid wrapper → block layout (no more frozen grid-row heights) */
    '.cortex-atlas-page-grid {',
    '  display: block !important;',
    '  max-height: none !important;',
    '  overflow: visible !important;',
    '}',

    /* Cards in atlas: allow full content height */
    '.cortex-atlas-page-grid .b1-card {',
    '  overflow: visible !important;',
    '  height: auto !important;',
    '  display: block !important;',
    '  margin-bottom: 10px !important;',
    '}',

    /* Inner image-wrapper div: do not clip */
    '.cortex-atlas-page-grid .b1-card > div:last-child {',
    '  overflow: visible !important;',
    '  height: auto !important;',
    '}',

    /* Images: responsive — fill card width, auto height */
    '.cortex-atlas-page-grid img {',
    '  display: block !important;',
    '  width: 100% !important;',
    '  height: auto !important;',
    '  max-width: 100% !important;',
    '}',

    /* Fallback for browsers without :has() — target via alt attribute directly */
    'img[alt*="Source page"] {',
    '  display: block !important;',
    '  width: 100% !important;',
    '  height: auto !important;',
    '}',
  ].join('\n');

  var styleEl = null;

  function injectStyle() {
    if (!document.getElementById('cortex-atlas-patch-v3')) {
      styleEl = document.createElement('style');
      styleEl.id = 'cortex-atlas-patch-v3';
      styleEl.textContent = CSS_RULES;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  // ── DOM patcher ───────────────────────────────────────────────────────────
  function applyFix(img) {
    // Switch lazy → eager so browser resolves intrinsic size immediately
    if (img.getAttribute('loading') === 'lazy') {
      img.setAttribute('loading', 'eager');
    }

    var card = img.closest ? img.closest('.b1-card') : null;

    // Fix image-wrapper div (direct parent of img, inside B1Card)
    var wrapper = img.parentElement;
    if (wrapper && wrapper !== card) {
      wrapper.style.setProperty('overflow', 'visible', 'important');
      wrapper.style.setProperty('height', 'auto', 'important');
      wrapper.style.setProperty('maxHeight', 'none', 'important');
    }

    // Fix B1Card
    if (card) {
      card.style.setProperty('overflow', 'visible', 'important');
      card.style.setProperty('height', 'auto', 'important');

      // Fix outer grid container (parent of B1Card)
      var grid = card.parentElement;
      if (grid) {
        grid.style.setProperty('display', 'block', 'important');
        grid.style.setProperty('maxHeight', 'none', 'important');
        grid.style.setProperty('overflow', 'visible', 'important');
        if (!grid.classList.contains('cortex-atlas-page-grid')) {
          grid.classList.add('cortex-atlas-page-grid');
        }
      }
    }
  }

  function applyFixOnLoad(img) {
    // Also reapply fix after image load (in case reflow re-collapses containers)
    function afterLoad() {
      applyFix(img);
      // Force reflow on the card
      var card = img.closest ? img.closest('.b1-card') : null;
      if (card) {
        // Reading offsetHeight forces synchronous layout
        // eslint-disable-next-line no-unused-expressions
        card.offsetHeight;
        card.style.setProperty('overflow', 'visible', 'important');
        card.style.setProperty('height', 'auto', 'important');
      }
    }

    if (img.complete && img.naturalHeight > 0) {
      afterLoad();
    } else {
      img.addEventListener('load', afterLoad, { once: true });
    }
  }

  function patchAll() {
    injectStyle();
    var imgs = document.querySelectorAll('img[alt*="Source page"]');
    imgs.forEach(function (img) {
      applyFix(img);
      applyFixOnLoad(img);
    });
  }

  // ── MutationObserver: re-patch after every React render ──────────────────
  var rafPending = false;
  var mo = new MutationObserver(function () {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        patchAll();
        rafPending = false;
      });
    }
  });

  function start() {
    mo.observe(document.body, { childList: true, subtree: true });
    patchAll();
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }

  // Safety timeouts: run at staggered intervals to catch any deferred renders
  [200, 600, 1200, 2500, 5000].forEach(function (t) {
    setTimeout(patchAll, t);
  });
})();
