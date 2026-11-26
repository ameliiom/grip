const URL = process.env.AUDIT_URL || "http://127.0.0.1:4173";
const OUT_DIR = process.env.SHOT_DIR || ".";

export default async function capture(b) {
  await b.colorScheme("dark");
  await b.viewport(1366, 900, false);
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

  const errs = b.errors();
  if (errs.length) {
    throw new Error("Page errors during screenshot capture: " + JSON.stringify(errs));
  }
  console.log("[PASS] Captured 6 full-size v5 screenshots cleanly");
}
