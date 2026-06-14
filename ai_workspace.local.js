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

// ─── AI Workspace Tab Scroll Fix ─────────────────────────────────────────────
// Root cause: iOS Safari sometimes loses scroll-ability on a container after
// React re-renders swap its content (tab switch: assistant → visual → audio).
// The container keeps overflow:auto but iOS treats it as non-scrollable because
// the compositing layer is stale.
//
// Fix: When the AI workspace scroll container changes (tab switch detected via
// MutationObserver watching class changes), force a repaint cycle that makes
// iOS re-composite the scroll layer:
//   1. Temporarily remove overflowY so iOS drops the scroll layer.
//   2. One rAF later, restore overflowY:'auto' with !important and call
//      scrollTop = scrollTop to force a scroll-context rebuild.
//   3. Also ensure -webkit-overflow-scrolling and touch-action are set.
// ─────────────────────────────────────────────────────────────────────────────
(function patchAIWorkspaceTabScroll() {
  'use strict';

  var WORKSPACE_SELECTOR = '[data-screen-label="P20-AIWorkspace"] .cortex-page-scroll';
  var lastClassName = '';
  var fixScheduled = false;

  function forceScrollReset(el) {
    if (!el) return;
    // Step 1: remove overflow so iOS releases the stale scroll layer
    el.style.setProperty('overflow-y', 'hidden', 'important');
    el.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    el.style.setProperty('touch-action', 'pan-y', 'important');

    requestAnimationFrame(function () {
      // Step 2: restore scrollability in the next paint frame
      el.style.removeProperty('overflow-y');
      el.style.setProperty('overflow-y', 'auto', 'important');
      // Step 3: nudge scrollTop to force iOS scroll-context rebuild
      var prev = el.scrollTop;
      el.scrollTop = prev + 1;
      el.scrollTop = prev;
    });
  }

  function checkAndFix() {
    if (fixScheduled) return;
    fixScheduled = true;
    requestAnimationFrame(function () {
      fixScheduled = false;
      var el = document.querySelector(WORKSPACE_SELECTOR);
      if (!el) return;

      var currentClass = el.className || '';
      if (currentClass !== lastClassName) {
        // Class changed → tab switched → repair scroll
        lastClassName = currentClass;
        forceScrollReset(el);
      }

      // Always ensure touch scrolling attributes on non-chat surfaces
      // (chat surface manages its own layout with overflow:hidden)
      if (!currentClass.includes('cortex-ai-chat-active')) {
        el.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
        el.style.setProperty('touch-action', 'pan-y', 'important');
        // Ensure overflowY is auto if it was hidden (e.g. from chat surface CSS)
        var computed = window.getComputedStyle(el);
        if (computed.overflowY === 'hidden' && !el.classList.contains('cortex-ai-chat-active')) {
          el.style.setProperty('overflow-y', 'auto', 'important');
        }
      }
    });
  }

  function startScrollWatcher() {
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var t = mutations[i].target;
        if (t && t.matches && t.matches(WORKSPACE_SELECTOR)) {
          checkAndFix();
          return;
        }
        // Also trigger on any child mutations inside the workspace screen
        if (t && t.closest && t.closest('[data-screen-label="P20-AIWorkspace"]')) {
          checkAndFix();
          return;
        }
      }
    });

    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Run immediately and at startup intervals
    checkAndFix();
    [300, 800, 1500].forEach(function (t) { setTimeout(checkAndFix, t); });
  }

  if (document.body) {
    startScrollWatcher();
  } else {
    document.addEventListener('DOMContentLoaded', startScrollWatcher);
  }
})();
