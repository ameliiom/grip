const URL = process.env.AUDIT_URL || "http://127.0.0.1:4173";
const OUT_DIR = process.env.SHOT_DIR || ".";

export default async function capture(b) {
  await b.colorScheme("dark");
  await b.viewport(1366, 900, false);
  await b.goto(URL);
  await b.waitFor('[data-primary-content="true"]', 15000);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-desktop-dark-rtl.png`);

  await b.colorScheme("light");
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-desktop-light-rtl.png`);

  await b.colorScheme("dark");
  await b.viewport(375, 900, true);
  await b.eval("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await b.shot(`${OUT_DIR}/grip-mobile-dark-rtl.png`);

  const errs = b.errors();
  if (errs.length) {
    throw new Error("Page errors during screenshot capture: " + JSON.stringify(errs));
  }
  console.log("[PASS] Captured 3 full-size screenshots cleanly");
}
