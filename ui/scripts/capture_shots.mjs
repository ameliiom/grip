const URL = process.env.AUDIT_URL || "http://127.0.0.1:4173";
const OUT_DIR = process.env.SHOT_DIR || ".";

export default async function capture(b) {
  await b.colorScheme("dark");
  await b.viewport(1280, 780, false);
  await b.goto(`${URL}/#buttons`);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v5-buttons-dark.png`);

  await b.eval("[...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'الأعلى')?.click()");
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v5-buttons-top-dark.png`);

  await b.colorScheme("light");
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v5-buttons-top-light.png`);

  await b.colorScheme("dark");
  await b.goto(`${URL}/#performance`);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v5-performance-dark.png`);

  await b.goto(`${URL}/#profiles`);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v5-profiles-dark.png`);

  await b.goto(`${URL}/#buttons`);
  await b.viewport(375, 900, true);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v5-mobile-dark.png`);

  await b.viewport(1280, 780, false);
  await b.goto(`${URL}/?desktop=1#buttons`);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-v6-desktop-dark.png`);

  await b.goto(`${URL}/?desktop=1#settings`);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const settingsOverflow = await b.eval("document.documentElement.scrollHeight - window.innerHeight");
  if (settingsOverflow > 2) {
    throw new Error(`Settings view overflowed 1280x780 vertically by ${settingsOverflow}px`);
  }
  await b.shot(`${OUT_DIR}/grip-v6-settings-dark.png`);

  await b.goto(`${URL}/?desktop=1#motion`);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  const motionOverflow = await b.eval("document.documentElement.scrollHeight - window.innerHeight");
  if (motionOverflow > 2) {
    throw new Error(`Motion view overflowed 1280x780 vertically by ${motionOverflow}px`);
  }
  await b.shot(`${OUT_DIR}/grip-v7-motion-dark.png`);

  const errs = b.errors();
  if (errs.length) {
    throw new Error("Page errors during screenshot capture: " + JSON.stringify(errs));
  }
  console.log("[PASS] Captured 8 full-size screenshots cleanly");
}
