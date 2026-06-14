// AI Workspace Local Configuration fallback
window.__CORTEX_AI_LOCAL_CONFIG__ = window.__CORTEX_AI_LOCAL_CONFIG__ || {};

// ─── Performance Mode: Auto-detect by device capability ──────────────────────
// The app defaults to reducedMotion=true on ALL mobile devices (UA check).
// iPhone/iPad have high-performance A-series GPUs that handle animations fine.
// Fix: before React initialises the state, write '0' to localStorage for iOS
// unless the OS prefers-reduced-motion is active OR the USER has explicitly
// toggled the Settings switch (tracked via cortex.reducedMotionUserChoice key).
// ─────────────────────────────────────────────────────────────────────────────
(function autoPerformanceMode() {
  'use strict';
  var ua = (navigator.userAgent || '').toLowerCase();
  var isIOS = /iphone|ipad|ipod/.test(ua);
  if (!isIOS) return; // only override for iOS — other mobiles keep the app default

  var prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (prefersReduced) return; // OS-level accessibility setting → let app honour it

  // Respect only EXPLICIT user choice made via the Settings toggle.
  // Ignore the value written by the app's own useEffect (which overwrites
  // 'cortex.reducedMotion' every render — that is NOT a user choice).
  var userChoice = null;
  try { userChoice = window.localStorage && window.localStorage.getItem('cortex.reducedMotionUserChoice'); } catch (e) {}
  if (userChoice !== null) return; // user explicitly toggled in Settings → respect it

  // iPhone/iPad: capable GPU, no explicit user choice → enable full animations
  try { window.localStorage && window.localStorage.setItem('cortex.reducedMotion', '0'); } catch (e) {}
})();

// ─── Source Atlas Viewer — Full Container Expansion Fix (v3) ─────────────────
(function patchSourceAtlasViewer() {
  'use strict';

  var CSS_RULES = [
    '.cortex-atlas-page-grid {',
    '  display: block !important;',
    '  max-height: none !important;',
    '  overflow: visible !important;',
    '}',
    '.cortex-atlas-page-grid .b1-card {',
    '  overflow: visible !important;',
    '  height: auto !important;',
    '  display: block !important;',
    '  margin-bottom: 10px !important;',
    '}',
    '.cortex-atlas-page-grid .b1-card > div:last-child {',
    '  overflow: visible !important;',
    '  height: auto !important;',
    '}',
    '.cortex-atlas-page-grid img {',
    '  display: block !important;',
    '  width: 100% !important;',
    '  height: auto !important;',
    '  max-width: 100% !important;',
    '}',
    'img[alt*="Source page"] {',
    '  display: block !important;',
    '  width: 100% !important;',
    '  height: auto !important;',
    '}',
  ].join('\n');

  function injectStyle() {
    if (!document.getElementById('cortex-atlas-patch-v3')) {
      var s = document.createElement('style');
      s.id = 'cortex-atlas-patch-v3';
      s.textContent = CSS_RULES;
      (document.head || document.documentElement).appendChild(s);
    }
  }

  function applyFix(img) {
    if (img.getAttribute('loading') === 'lazy') img.setAttribute('loading', 'eager');
    var card = img.closest ? img.closest('.b1-card') : null;
    var wrapper = img.parentElement;
    if (wrapper && wrapper !== card) {
      wrapper.style.setProperty('overflow', 'visible', 'important');
      wrapper.style.setProperty('height', 'auto', 'important');
      wrapper.style.setProperty('maxHeight', 'none', 'important');
    }
    if (card) {
      card.style.setProperty('overflow', 'visible', 'important');
      card.style.setProperty('height', 'auto', 'important');
      var grid = card.parentElement;
      if (grid) {
        grid.style.setProperty('display', 'block', 'important');
        grid.style.setProperty('maxHeight', 'none', 'important');
        grid.style.setProperty('overflow', 'visible', 'important');
        if (!grid.classList.contains('cortex-atlas-page-grid')) grid.classList.add('cortex-atlas-page-grid');
      }
    }
  }

  function applyFixOnLoad(img) {
    function afterLoad() {
      applyFix(img);
      var card = img.closest ? img.closest('.b1-card') : null;
      if (card) {
        card.offsetHeight; // eslint-disable-line no-unused-expressions
        card.style.setProperty('overflow', 'visible', 'important');
        card.style.setProperty('height', 'auto', 'important');
      }
    }
    if (img.complete && img.naturalHeight > 0) { afterLoad(); }
    else { img.addEventListener('load', afterLoad, { once: true }); }
  }

  function patchAll() {
    injectStyle();
    document.querySelectorAll('img[alt*="Source page"]').forEach(function (img) {
      applyFix(img); applyFixOnLoad(img);
    });
  }

  var rafPending = false;
  var mo = new MutationObserver(function () {
    if (!rafPending) { rafPending = true; requestAnimationFrame(function () { patchAll(); rafPending = false; }); }
  });

  function start() { mo.observe(document.body, { childList: true, subtree: true }); patchAll(); }
  if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start); }
  [200, 600, 1200, 2500, 5000].forEach(function (t) { setTimeout(patchAll, t); });
})();

// ─── AI Workspace Tab Scroll Fix ─────────────────────────────────────────────
// iOS Safari loses scroll-ability on containers after React re-renders swap
// content (tab switch). Fix: detect class change → repaint the scroll layer.
// ─────────────────────────────────────────────────────────────────────────────
(function patchAIWorkspaceTabScroll() {
  'use strict';
  var SELECTOR = '[data-screen-label="P20-AIWorkspace"] .cortex-page-scroll';
  var lastClass = '';
  var fixScheduled = false;

  function forceScrollReset(el) {
    if (!el) return;
    el.style.setProperty('overflow-y', 'hidden', 'important');
    el.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
    el.style.setProperty('touch-action', 'pan-y', 'important');
    requestAnimationFrame(function () {
      el.style.removeProperty('overflow-y');
      el.style.setProperty('overflow-y', 'auto', 'important');
      var prev = el.scrollTop; el.scrollTop = prev + 1; el.scrollTop = prev;
    });
  }

  function checkAndFix() {
    if (fixScheduled) return;
    fixScheduled = true;
    requestAnimationFrame(function () {
      fixScheduled = false;
      var el = document.querySelector(SELECTOR);
      if (!el) return;
      var cur = el.className || '';
      if (cur !== lastClass) { lastClass = cur; forceScrollReset(el); }
      if (!cur.includes('cortex-ai-chat-active')) {
        el.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
        el.style.setProperty('touch-action', 'pan-y', 'important');
      }
    });
  }

  function startScrollWatcher() {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t && t.closest && t.closest('[data-screen-label="P20-AIWorkspace"]')) { checkAndFix(); return; }
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    checkAndFix();
    [300, 800, 1500].forEach(function (t) { setTimeout(checkAndFix, t); });
  }

  if (document.body) { startScrollWatcher(); }
  else { document.addEventListener('DOMContentLoaded', startScrollWatcher); }
})();

// ─── Compact Topbar: JS belt-and-suspenders for inline style override ─────────
// CSS !important in index.html already overrides B1Topbar's inline style, but
// on some iOS WebKit builds the cascade doesn't fully apply env() in !important
// overrides. This JS patch uses element.style.setProperty('prop','val','important')
// which is always the strongest possible inline override.
// ─────────────────────────────────────────────────────────────────────────────
(function patchCompactTopbar() {
  'use strict';

  function isMobile() { return window.innerWidth <= 430; }

  function compactTopbars() {
    if (!isMobile()) return;

    // B1Topbar = first child of .cortex-page-shell
    document.querySelectorAll('.cortex-page-shell > div:first-child').forEach(function (tb) {
      if (tb.dataset.cortexTopbarCompact) return; // already patched this element
      tb.dataset.cortexTopbarCompact = '1';

      tb.style.setProperty('padding-top', 'env(safe-area-inset-top)', 'important');
      tb.style.setProperty('padding-bottom', '3px', 'important');
      tb.style.setProperty('min-height', '0', 'important');
      tb.style.setProperty('padding-left', '14px', 'important');
      tb.style.setProperty('padding-right', '14px', 'important');

      // Hide subtitle (second child of the centre div, which is second child of topbar)
      var centre = tb.children[1];
      if (centre && centre.children[1]) {
        centre.children[1].style.setProperty('display', 'none', 'important');
      }

      // Compact title text
      if (centre && centre.children[0]) {
        centre.children[0].style.setProperty('font-size', '13px', 'important');
        centre.children[0].style.setProperty('line-height', '1.1', 'important');
      }
    });

    // Library topbar: reduce excess padding
    document.querySelectorAll('.cortex-library-topbar').forEach(function (tb) {
      if (tb.dataset.cortexLibTopbarCompact) return;
      tb.dataset.cortexLibTopbarCompact = '1';
      tb.style.setProperty('padding-top', 'env(safe-area-inset-top)', 'important');
      tb.style.setProperty('padding-bottom', '6px', 'important');
      tb.style.setProperty('gap', '4px', 'important');
    });
  }

  // Run on every React render cycle (MutationObserver)
  var rafPending = false;
  var mo = new MutationObserver(function () {
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        compactTopbars();
        rafPending = false;
      });
    }
  });

  function start() {
    mo.observe(document.body, { childList: true, subtree: true });
    compactTopbars();
  }

  if (document.body) { start(); }
  else { document.addEventListener('DOMContentLoaded', start); }
  [100, 400, 1000, 2000].forEach(function (t) { setTimeout(compactTopbars, t); });
})();

// ─── Settings: Fix Reduced-Motion Toggle ─────────────────────────────────────
// PageSettings has its own LOCAL reducedMotion state (useState(false)) that is
// NOT connected to the global state or localStorage. So clicking the toggle has
// no effect on the actual animations.
//
// Fix: intercept clicks on the toggle div inside the Settings page, detect the
// new intended state from the thumb position, then immediately:
//   1. Write to localStorage ('cortex.reducedMotion')
//   2. Add/remove the 'cortex-reduced-motion' class on <html>
//
// Also: seed the toggle's VISUAL state to match localStorage on page open,
// by dispatching a synthetic click if the stored value doesn't match the
// toggle's default (false → no reduced motion).
// ─────────────────────────────────────────────────────────────────────────────
(function patchSettingsReducedMotionToggle() {
  'use strict';

  function getStoredReducedMotion() {
    try { return window.localStorage && window.localStorage.getItem('cortex.reducedMotion'); }
    catch (e) { return null; }
  }

  function applyReducedMotion(on) {
    try {
      window.localStorage && window.localStorage.setItem('cortex.reducedMotion', on ? '1' : '0');
      // Mark this as an explicit user choice so autoPerformanceMode respects it next load
      window.localStorage && window.localStorage.setItem('cortex.reducedMotionUserChoice', '1');
    } catch (e) {}
    if (on) { document.documentElement.classList.add('cortex-reduced-motion'); }
    else { document.documentElement.classList.remove('cortex-reduced-motion'); }
    // Call the global React setter so inline-style driven animations update immediately
    try { if (typeof window.__cortexSetReducedMotion === 'function') window.__cortexSetReducedMotion(on); } catch (e) {}
  }

  // Is the toggle thumb currently in the ON position?
  function isToggleOn(toggleOuterDiv) {
    var thumb = toggleOuterDiv && toggleOuterDiv.querySelector(':scope > div');
    if (!thumb) return false;
    var t = thumb.style.transform || '';
    return t.includes('20px') || t.includes('20 ');
  }

  var patchedSettings = false;

  function patchSettingsPage() {
    var page = document.querySelector('[data-screen-label="P7-Settings"]');
    if (!page) { patchedSettings = false; return; }
    if (patchedSettings) return;
    patchedSettings = true;

    // Find the Reduced Motion toggle by locating the card that contains that label text
    var found = false;
    var cards = page.querySelectorAll('.b1-card, .b1-toggle');
    cards.forEach(function (el) {
      if (found) return;
      if (!el.textContent.includes('Reduced Motion')) return;

      // Get the outer clickable div of the b1-toggle inside (or the toggle itself)
      var toggleOuter = el.querySelector('.b1-toggle > div') ||
        (el.classList.contains('b1-toggle') ? el.querySelector(':scope > div') : null);
      if (!toggleOuter || toggleOuter.dataset.patchedRm) return;
      toggleOuter.dataset.patchedRm = '1';
      found = true;

      // Seed the visual state: if localStorage says ON but toggle shows OFF, simulate click
      var stored = getStoredReducedMotion();
      var storedOn = stored === '1';
      var visualOn = isToggleOn(toggleOuter);
      if (storedOn !== visualOn) {
        // Dispatch a click to let React flip the visual; then we'll intercept the next click
        setTimeout(function () { toggleOuter.click(); }, 80);
      }

      // Intercept future clicks (capture phase — before React's synthetic event)
      toggleOuter.addEventListener('click', function () {
        var currentlyOn = isToggleOn(toggleOuter);
        var willBeOn = !currentlyOn; // React hasn't flipped yet
        setTimeout(function () { applyReducedMotion(willBeOn); }, 60);
      }, true);
    });
  }

  // Watch for Settings page to appear/disappear
  var mo = new MutationObserver(function () {
    var page = document.querySelector('[data-screen-label="P7-Settings"]');
    if (!page) patchedSettings = false;
    else patchSettingsPage();
  });

  function start() {
    mo.observe(document.body, { childList: true, subtree: true });
    patchSettingsPage();
    // Also keep the html class in sync with localStorage on every navigation
    [200, 600].forEach(function (t) {
      setTimeout(function () {
        var v = getStoredReducedMotion();
        if (v === '1') document.documentElement.classList.add('cortex-reduced-motion');
        else if (v === '0') document.documentElement.classList.remove('cortex-reduced-motion');
      }, t);
    });
  }

  if (document.body) { start(); }
  else { document.addEventListener('DOMContentLoaded', start); }
})();
