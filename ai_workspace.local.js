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
// NOT connected to the global state or localStorage. The previous click-intercept
// approach had a race condition: the seeding logic read localStorage BEFORE the
// 60ms timeout wrote the new value, so it fired a synthetic "correction" click
// that turned the toggle back OFF.
//
// New approach: watch the toggle THUMB's style attribute via MutationObserver.
// When React updates the thumb's transform (after user click), sync IMMEDIATELY
// to localStorage + html class + global React state. No timeouts, no synthetic
// clicks, no seeding — eliminates the race condition entirely.
// ─────────────────────────────────────────────────────────────────────────────
(function patchSettingsReducedMotionToggle() {
  'use strict';

  function applyReducedMotion(on) {
    try {
      window.localStorage && window.localStorage.setItem('cortex.reducedMotion', on ? '1' : '0');
      window.localStorage && window.localStorage.setItem('cortex.reducedMotionUserChoice', '1');
    } catch (e) {}
    if (on) { document.documentElement.classList.add('cortex-reduced-motion'); }
    else { document.documentElement.classList.remove('cortex-reduced-motion'); }
    try { if (typeof window.__cortexSetReducedMotion === 'function') window.__cortexSetReducedMotion(on); } catch (e) {}
  }

  var thumbObserver = null;
  var watchingThumb = null;
  var lastApplied = null; // debounce: prevent re-firing for same state

  function attachThumbObserver(thumb) {
    if (watchingThumb === thumb) return; // already watching this exact element
    if (thumbObserver) thumbObserver.disconnect();
    watchingThumb = thumb;
    lastApplied = null; // reset — next change will always apply

    thumbObserver = new MutationObserver(function () {
      var on = (thumb.style.transform || '').includes('20px');
      if (on === lastApplied) return; // same state — React re-applied same value, ignore
      lastApplied = on;
      applyReducedMotion(on);
    });
    thumbObserver.observe(thumb, { attributes: true, attributeFilter: ['style'] });
  }

  function findReducedMotionThumb(page) {
    var toggles = page.querySelectorAll('.b1-toggle');
    for (var i = 0; i < toggles.length; i++) {
      if (!toggles[i].textContent.includes('Reduced Motion')) continue;
      // .b1-toggle children: [optional span label, div track]
      // track children: [div thumb]
      var children = toggles[i].children;
      var track = children[children.length - 1]; // last child is always the track div
      var thumb = track && track.children[0];
      if (thumb) return thumb;
    }
    return null;
  }

  // Outer observer: watch for Settings page to appear / disappear / re-render
  var outerMO = new MutationObserver(function () {
    var page = document.querySelector('[data-screen-label="P7-Settings"]');
    if (!page) {
      // Settings gone — disconnect thumb observer, reset state
      if (thumbObserver) { thumbObserver.disconnect(); thumbObserver = null; }
      watchingThumb = null;
      lastApplied = null;
      return;
    }
    var thumb = findReducedMotionThumb(page);
    if (thumb && thumb !== watchingThumb) attachThumbObserver(thumb);
  });

  function start() {
    outerMO.observe(document.body, { childList: true, subtree: true });

    // Initial page check
    var page = document.querySelector('[data-screen-label="P7-Settings"]');
    if (page) {
      var thumb = findReducedMotionThumb(page);
      if (thumb) attachThumbObserver(thumb);
    }

    // Sync html class with localStorage on startup and navigation
    [0, 300, 800].forEach(function (t) {
      setTimeout(function () {
        try {
          var v = window.localStorage && window.localStorage.getItem('cortex.reducedMotion');
          if (v === '1') document.documentElement.classList.add('cortex-reduced-motion');
          else if (v === '0') document.documentElement.classList.remove('cortex-reduced-motion');
        } catch (e) {}
      }, t);
    });
  }

  if (document.body) { start(); }
  else { document.addEventListener('DOMContentLoaded', start); }
})();

// ─── Light themes: radically de-fog the sidebar rail ─────────────────────────
// The lecture rail uses a dark navy translucent background + heavy backdrop
// blur (inline in docked mode, CSS in drawer mode). On light themes that reads
// as a foggy dark-green haze. CSS overrides exist, but React rewrites the inline
// style on every render and can wipe them mid-frame. This patch forces a solid,
// opaque, bright panel directly on the DOM with setProperty('important') and
// re-applies on every mutation (including style changes) — the strongest path.
// ─────────────────────────────────────────────────────────────────────────────
(function patchLightSidebarDefog() {
  'use strict';
  var LIGHT = ['lumina', 'celadon', 'quartz'];

  function isLight() {
    try {
      var t = document.documentElement.dataset.cortexTheme || '';
      if (LIGHT.indexOf(t) >= 0) return true;
      var root = document.querySelector('.cortex-library-root');
      if (root && LIGHT.indexOf(root.getAttribute('data-theme-id')) >= 0) return true;
    } catch (e) {}
    return false;
  }

  function readVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function forceSolid(el, bg) {
    el.style.setProperty('background', bg, 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('backdrop-filter', 'none', 'important');
    el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
    el.style.setProperty('box-shadow', '0 18px 40px rgba(var(--cortex-ink-rgb,18,46,42),0.14)', 'important');
    el.dataset.cortexDefog = '1';
  }
  function clearSolid(el) {
    ['background', 'background-image', 'backdrop-filter', '-webkit-backdrop-filter', 'box-shadow'].forEach(function (p) {
      el.style.removeProperty(p);
    });
    delete el.dataset.cortexDefog;
  }

  function apply() {
    var light = isLight();
    var bg = readVar('--cortex-theme-bg', '#f6f1e9');
    document.querySelectorAll('.cortex-library-nav, .cortex-sidebar-drawer, .cortex-sidebar-shell').forEach(function (el) {
      if (light) forceSolid(el, bg);
      else if (el.dataset.cortexDefog) clearSolid(el);
    });
    var bd = document.querySelector('.cortex-sidebar-drawer-backdrop');
    if (bd) {
      if (light) {
        bd.style.setProperty('background', 'rgba(var(--cortex-ink-rgb,18,46,42),0.16)', 'important');
        bd.style.setProperty('backdrop-filter', 'blur(2px)', 'important');
        bd.style.setProperty('-webkit-backdrop-filter', 'blur(2px)', 'important');
        bd.dataset.cortexDefog = '1';
      } else if (bd.dataset.cortexDefog) {
        ['background', 'backdrop-filter', '-webkit-backdrop-filter'].forEach(function (p) { bd.style.removeProperty(p); });
        delete bd.dataset.cortexDefog;
      }
    }
  }

  var raf = false;
  var mo = new MutationObserver(function () {
    if (!raf) { raf = true; requestAnimationFrame(function () { apply(); raf = false; }); }
  });

  function start() {
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-theme-id', 'data-cortex-theme'] });
    apply();
    [150, 400, 900, 1800].forEach(function (t) { setTimeout(apply, t); });
  }

  if (document.body) { start(); }
  else { document.addEventListener('DOMContentLoaded', start); }
})();
