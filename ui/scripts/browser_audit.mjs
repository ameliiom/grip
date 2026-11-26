/**
 * Reusable multi-width real-browser audit scenario for `edge_cdp.mjs`.
 * Usage: `AUDIT_URL=http://localhost:3000 node C:\Users\LATIF\Documents\KC-Tools\edge_cdp.mjs browser_audit.mjs`
 * Checks: overflow, Latin digits, fluid width, named controls, field width, tiny text, mobile touch targets,
 * App Shell landmarks, sibling height parity, uneven gaps, control overlaps, clipped labels, WCAG AA contrast,
 * broken/oversized images, competing primary CTAs, and real mouse wheel `wheelToEnd`.
 */
const WIDTHS = (process.env.AUDIT_WIDTHS || "320,375,768,1024,1366,1536,1920")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const THEMES = (process.env.AUDIT_THEMES || "light,dark").split(",").map((s) => s.trim()).filter(Boolean);
const URL = process.env.AUDIT_URL || "http://localhost:3000";
const LAST_SEL = process.env.AUDIT_LAST_SELECTOR || "footer, main > :last-child, tbody tr:last-child";

export default async function audit(b) {
  const failures = [];

  // Load page ONCE (avoid 10 redundant cold navigations), then resize viewport & switch theme in-place
  await b.colorScheme(THEMES[0] || "light");
  await b.viewport(WIDTHS[0] || 1366, 900, (WIDTHS[0] || 1366) <= 480);
  await b.goto(URL);

  for (const theme of THEMES) {
    await b.colorScheme(theme);
    const widthsForTheme = theme === THEMES[0] ? WIDTHS : [375, 1366];
    for (const w of widthsForTheme) {
      await b.viewport(w, 900, w <= 480);
      await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");

      const report = await b.eval(`(() => {
      const issues = [];
      const docW = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > docW + 2) {
        issues.push('horizontal-overflow:' + document.documentElement.scrollWidth + '>' + docW);
      }
      if (/[\\u0660-\\u0669]/.test(document.body.innerText || '')) {
        issues.push('arabic-indic-digits-rendered');
      }
      const pageTxt = document.body.innerText || '';
      const techLeaks = ['Rust', 'Tauri', 'محاكاة'];
      for (const tok of techLeaks) {
        if (pageTxt.includes(tok)) {
          issues.push('technical-jargon-on-ui:' + tok);
          break;
        }
      }
      if (/0x[0-9a-f]{4}|\bPID[:\s]+[0-9a-f]{4}|localhost:\d+|\.exe\b|\b(?:tap|turbo|slot):\S/i.test(pageTxt)) {
        issues.push('technical-jargon-pattern-on-ui');
      }
      const main = document.querySelector('main') || document.body;
      const mainRect = main.getBoundingClientRect();
      const aside = document.querySelector('aside');
      const asideW = aside ? aside.getBoundingClientRect().width : 0;
      const usedRatio = (mainRect.width + asideW) / docW;
      if (${w} >= 768 && usedRatio < 0.85) {
        issues.push('under-width:' + Math.round(usedRatio * 100) + '%');
      }

      const visibleControls = [];
      for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"], [role="switch"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        visibleControls.push({ el, r });
        const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
        if (!label) issues.push('unnamed-control:' + el.tagName);
        if ((el.tagName === 'INPUT' || el.tagName === 'SELECT') && r.width < 120 && el.type !== 'checkbox' && el.type !== 'radio') {
          issues.push('narrow-field:' + Math.round(r.width) + 'px');
        }
        if (${w} <= 480 && el.tagName !== 'A' && el.type !== 'checkbox' && el.type !== 'radio') {
          const ph = el.tagName === 'INPUT' && el.parentElement ? el.parentElement.getBoundingClientRect().height : 0;
          const effH = ph > r.height && ph <= r.height + 8 ? ph : r.height;
          if (effH < 44) issues.push('small-touch-target:' + el.tagName + ':' + Math.round(effH) + 'px');
        }
      }

      // Control overlap check (non-nested visible controls intersecting by > 4px, plus header text crushing)
      for (let i = 0; i < visibleControls.length; i++) {
        for (let j = i + 1; j < visibleControls.length; j++) {
          const a = visibleControls[i], c = visibleControls[j];
          if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
          const ox = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left);
          const oy = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
          if (ox > 4 && oy > 4) {
            issues.push('control-overlap:' + a.el.tagName + '/' + c.el.tagName);
            break;
          }
        }
      }
      const hdr = document.querySelector('header');
      if (hdr) {
        for (const t of hdr.querySelectorAll('span, h1, [data-metric]')) {
          if (t.closest('button, a')) continue;
          const tr = t.getBoundingClientRect();
          if (tr.width === 0 || tr.height === 0) continue;
          for (const c of visibleControls) {
            if (!hdr.contains(c.el) || c.el.contains(t) || t.contains(c.el)) continue;
            const ox = Math.min(tr.right, c.r.right) - Math.max(tr.left, c.r.left);
            const oy = Math.min(tr.bottom, c.r.bottom) - Math.max(tr.top, c.r.top);
            if (ox > 2 && oy > 2) {
              issues.push('header-text-crushed-by-' + c.el.tagName);
              break;
            }
          }
        }
      }

      if (${w} >= 1024 && (!document.querySelector('header, nav, aside') || !document.querySelector('main'))) {
        issues.push('missing-app-shell-landmarks');
      }

      // Competing Primary CTAs & brand-color overload check (strictly <= 2 brand-filled controls/badges)
      const brandProbe = document.createElement('span');
      brandProbe.style.cssText = 'position:fixed;left:-9999px;background-color:var(--brand)';
      document.body.appendChild(brandProbe);
      const brandRgb = getComputedStyle(brandProbe).backgroundColor;
      brandProbe.remove();
      const brandFills = [...document.querySelectorAll('button, a[href], [role="button"], [role="switch"], [data-badge]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).backgroundColor === brandRgb;
      });
      if (brandFills.length > 2) {
        issues.push('brand-overload:' + brandFills.length);
      }

      const normRep = (s) => (s || '').trim().toLowerCase().replace(/^ال|\s+ال/g, ' ').replace(/لل/g, 'ل').replace(/\s+/g, ' ').trim();
      for (const tile of document.querySelectorAll('[data-multiline-tile]')) {
        const tr = tile.getBoundingClientRect();
        if (tr.width === 0 || tr.height === 0) continue;
        const kids = [...tile.children].map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (kids.length >= 2) {
          const a = normRep(kids[0]), b = normRep(kids[1]);
          const tailNum = kids[0].match(/(?:^|\s)(\d+)$/)?.[1];
          if ((a && a === b) || (tailNum && kids[1].trim() === tailNum)) {
            issues.push('self-repeating-tile:' + kids[0] + '|' + kids[1]);
            break;
          }
        }
      }

      const seenTelemetry = new Map();
      for (const el of document.querySelectorAll('[data-badge], [data-metric]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 28) continue;
        if (/^(?:\d+(?:\.\d+)?\s*(?:%|dpi|hz|ms)|متصل|غير متصل|connected|disconnected)$/i.test(t)) {
          const k = t.toLowerCase();
          seenTelemetry.set(k, (seenTelemetry.get(k) || 0) + 1);
          if (seenTelemetry.get(k) >= 2) {
            issues.push('duplicate-chrome-metric:' + t);
            break;
          }
        }
      }

      const primaryCtas = [...document.querySelectorAll('[data-variant="primary"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight;
      });
      if (primaryCtas.length > 1) {
        issues.push('multiple-primary-ctas:' + primaryCtas.length);
      }

      // Stacked row actions inside table/grid/list cells (HTML tables AND virtualized ARIA grids)
      for (const cell of document.querySelectorAll('tbody td, [role="gridcell"], [role="cell"]')) {
        const acts = [...cell.querySelectorAll('button, a[href], [role="button"]')]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0);
        if (acts.length >= 2) {
          const tops = acts.map((r) => r.top);
          if (Math.max(...tops) - Math.min(...tops) > 16) {
            issues.push('stacked-row-actions:' + acts.length);
            break;
          }
        }
      }

      // Wrapped short pills/badges/buttons (e.g. 2-line status badge) via true Range line-box Y-spread
      for (const el of document.querySelectorAll('[data-badge], .badge, .pill, [role="status"], button:not([data-multiline-tile])')) {
        const txt = (el.innerText || '').trim();
        if (!txt || txt.length > 22 || el.querySelector('br')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize) || 14;
        const range = document.createRange();
        range.selectNodeContents(el);
        const boxes = [...range.getClientRects()].filter((b) => b.width > 2 && b.height > 2);
        if (boxes.length >= 2) {
          const tops = boxes.map((b) => b.top);
          if (Math.max(...tops) - Math.min(...tops) > fs * 0.7) {
            issues.push('wrapped-pill-or-button:' + txt.slice(0, 18));
            break;
          }
        }
      }

      // Chrome budget: no double-deck stacked tab bars & primary data starts above the fold on desktop
      const tablists = [...document.querySelectorAll('[role="tablist"]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (tablists.length >= 2) {
        const sortedT = tablists.map((el) => el.getBoundingClientRect()).sort((a, b) => a.top - b.top);
        if (sortedT[1].top - sortedT[0].bottom >= -2 && sortedT[1].top - sortedT[0].bottom < 48) {
          issues.push('double-deck-tabs');
        }
      }
      if (${w} >= 1024) {
        const firstData = main.querySelector('table, [role="grid"], [role="table"], [data-primary-content]');
        if (firstData) {
          const fr = firstData.getBoundingClientRect();
          if (fr.height > 0 && fr.top > window.innerHeight * 0.45) {
            issues.push('chrome-bloat:data-starts-at-' + Math.round(fr.top) + 'px');
          }
        }
      }

      // Single-Border & Single-Surface Ownership: catch nested bordered inputs/focus rings AND tight box-in-box containers
      const hasBorder = (el) => {
        const cs = getComputedStyle(el);
        const bw = parseFloat(cs.borderTopWidth) || parseFloat(cs.borderBottomWidth) || 0;
        return bw > 0 && cs.borderTopStyle !== 'none' && cs.borderTopColor !== 'rgba(0, 0, 0, 0)' && cs.borderTopColor !== 'transparent';
      };
      for (const inp of document.querySelectorAll('input, select, textarea')) {
        const r = inp.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || inp.type === 'checkbox' || inp.type === 'radio') continue;
        const p = inp.parentElement;
        if (!p) continue;
        const parentBordered = hasBorder(p) || (p.parentElement && hasBorder(p.parentElement) && Math.abs(p.parentElement.getBoundingClientRect().height - r.height) <= 16);
        if (parentBordered) {
          if (hasBorder(inp)) {
            issues.push('nested-input-border:' + (inp.placeholder || inp.name || inp.tagName).slice(0, 20));
            break;
          }
          inp.focus({ preventScroll: true });
          const fcs = getComputedStyle(inp);
          const hasFocusOutline = fcs.outlineStyle !== 'none' && (parseFloat(fcs.outlineWidth) || 0) > 0;
          inp.blur();
          if (hasFocusOutline) {
            issues.push('nested-input-focus-outline:' + (inp.placeholder || inp.name || inp.tagName).slice(0, 20));
            break;
          }
        }
      }
      for (const box of document.querySelectorAll('main section, main article, main [data-card], [role="dialog"] section')) {
        const r = box.getBoundingClientRect();
        if (r.width < 120 || r.height < 60 || !hasBorder(box)) continue;
        const p = box.parentElement;
        if (p && hasBorder(p) && p.tagName !== 'BODY') {
          const pr = p.getBoundingClientRect();
          if (Math.abs(r.left - pr.left) <= 24 && Math.abs(pr.right - r.right) <= 24) {
            issues.push('nested-bordered-surface:' + box.tagName);
            break;
          }
        }
      }

      // Native unstyled OS-popup controls (break theme, brand accent, and locale)
      for (const el of document.querySelectorAll('select, input[type="date"], input[type="datetime-local"], input[type="time"], input[type="month"], input[type="week"], input[type="color"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          issues.push('native-os-control:' + (el.tagName === 'SELECT' ? 'select' : el.type));
          break;
        }
      }

      // Clipped dialogs / modals overflowing the viewport vertically
      for (const dlg of document.querySelectorAll('[role="dialog"], dialog[open]')) {
        const r = dlg.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.top < -2 || r.bottom > window.innerHeight + 2)) {
          issues.push('clipped-dialog:' + Math.round(r.height) + 'px-in-' + window.innerHeight + 'px');
          break;
        }
      }

      // Locale consistency: catch unlocalized pure-Latin placeholders/date masks inside RTL pages
      if (getComputedStyle(document.documentElement).direction === 'rtl') {
        for (const inp of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
          if (['email', 'url', 'tel', 'password'].includes(inp.type)) continue;
          const ph = (inp.placeholder || '').trim();
          if (ph && /^[A-Za-z0-9\s/.,:_-]{3,}$/.test(ph) && /[A-Za-z]{2,}/.test(ph)) {
            issues.push('unlocalized-placeholder-in-rtl:' + ph.slice(0, 20));
            break;
          }
        }
      }

      // Broken or oversized images
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (img.complete && img.naturalWidth === 0) issues.push('broken-image:' + (img.alt || img.src.slice(0, 40)));
        else if (r.width > 0 && img.naturalWidth > r.width * 2.5 && img.naturalWidth > 600) {
          issues.push('oversized-image:' + img.naturalWidth + 'px-in-' + Math.round(r.width) + 'px');
        }
      }

      // Tiny text, clipped labels & WCAG AA contrast check
      const parseRgb = (s) => {
        const m = s && s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgFor = (el) => {
        for (let cur = el; cur; cur = cur.parentElement) {
          const c = parseRgb(getComputedStyle(cur).backgroundColor);
          if (c && c.a > 0.85) return c;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };

      let reportedTiny = false, reportedClip = false, reportedContrast = false;
      for (const el of document.querySelectorAll('h1, h2, h3, h4, p, span, a, button, label, td, th')) {
        const txt = (el.innerText || '').trim();
        if (!txt) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        if (!reportedTiny && fs > 0 && fs < 12) {
          issues.push('tiny-text:' + fs + 'px');
          reportedTiny = true;
        }
        if (!reportedClip && cs.overflow === 'hidden' && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 4) {
          issues.push('clipped-text:' + txt.slice(0, 20));
          reportedClip = true;
        }
        if (!reportedContrast && el.children.length === 0) {
          const fg = parseRgb(cs.color);
          const bg = bgFor(el);
          if (fg && fg.a > 0.85) {
            const l1 = Math.max(lum(fg), lum(bg)), l2 = Math.min(lum(fg), lum(bg));
            const ratio = (l1 + 0.05) / (l2 + 0.05);
            const minRatio = fs >= 18 || (fs >= 14 && parseInt(cs.fontWeight, 10) >= 700) ? 3.0 : 4.5;
            if (ratio < minRatio) {
              issues.push('low-contrast:' + ratio.toFixed(2) + '<' + minRatio);
              reportedContrast = true;
            }
          }
        }
      }

      // Sibling Height Parity & Parent-Owned Spacing on horizontal bars/toolbars/footers
      for (const bar of document.querySelectorAll('header, nav, [role="toolbar"], [role="menubar"], footer, [data-toolbar]')) {
        const controls = [...bar.querySelectorAll('button, input, select, [role="button"], [role="switch"]')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height <= 56 && !el.querySelector('img') && !el.closest('[data-brand]');
        });
        if (controls.length >= 2) {
          const rows = [];
          for (const c of controls) {
            const r = c.getBoundingClientRect();
            const cy = r.top + r.height / 2;
            const row = rows.find((g) => Math.abs(g.cy - cy) <= 8);
            if (row) row.heights.push(Math.round(r.height));
            else rows.push({ cy, heights: [Math.round(r.height)] });
          }
          for (const row of rows) {
            if (row.heights.length >= 2) {
              const diff = Math.max(...row.heights) - Math.min(...row.heights);
              if (diff > 2) issues.push('sibling-height-mismatch:' + Math.min(...row.heights) + 'px..' + Math.max(...row.heights) + 'px');
            }
          }
        }
        const barStyle = getComputedStyle(bar);
        if (barStyle.display.includes('flex') && !barStyle.justifyContent.includes('space-')) {
          const kids = [...bar.children]
            .map((ch) => ch.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0)
            .sort((a, b) => a.left - b.left);
          const localGaps = [];
          for (let i = 0; i < kids.length - 1; i++) {
            const g = Math.round(kids[i + 1].left - kids[i].right);
            if (g >= 0 && g <= 48) localGaps.push(g);
          }
          if (localGaps.length >= 2 && Math.max(...localGaps) - Math.min(...localGaps) > 3) {
            issues.push('uneven-sibling-gaps:' + localGaps.join(',') + 'px');
          }
        }
      }
      return issues;
    })()`);

      if (Array.isArray(report) && report.length) {
        failures.push({ theme, width: w, issues: report });
      }
    }
  }

  // Real mouse-wheel scroll test at desktop width (reuses loaded page at scrollY=0, zero redundant goto)
  await b.colorScheme(THEMES[0] || "light");
  await b.viewport(1366, 768, false);
  await b.eval("window.scrollTo(0, 0); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const reached = await b.wheelToEnd(680, 400, LAST_SEL);
  if (reached !== true && reached !== "no " + LAST_SEL) {
    failures.push({ wheelToEnd: reached });
  }

  const errs = b.errors();
  if (errs.length) failures.push({ consoleOrPageErrors: errs });

  if (failures.length) {
    throw new Error("Browser audit failed: " + JSON.stringify(failures, null, 2));
  }
  console.log("[PASS] Multi-width browser audit clean across", WIDTHS.join(", "), "themes:", THEMES.join(","));
}
