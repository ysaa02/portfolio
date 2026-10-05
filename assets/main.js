// Theme toggle, remembered across visits. Until the visitor picks one, the theme follows the system setting.
// The button names the theme it switches to.
const root = document.documentElement;
const toggle = document.querySelector("[data-theme-toggle]");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const setTheme = (theme) => {
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  const other = theme === "dark" ? "light" : "dark";
  toggle.textContent = `[ ${other} ]`;
  toggle.setAttribute("aria-label", `Switch to ${other} theme`);
};
setTheme(root.dataset.theme === "dark" ? "dark" : "light");
toggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  setTheme(next);
  try { localStorage.setItem("theme", next); } catch (e) {}
});
systemDark.addEventListener("change", (e) => {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (err) {}
  if (!saved) setTheme(e.matches ? "dark" : "light");
});

// Project carousel counter follows the scroll position.
const track = document.querySelector("[data-carousel] .track");
const count = document.querySelector("[data-count]");
track.addEventListener("scroll", () => {
  const step = track.firstElementChild.getBoundingClientRect().width + 16;
  count.textContent = String(Math.round(track.scrollLeft / step) + 1).padStart(2, "0");
});

document.querySelector("[data-year]").textContent = new Date().getFullYear();

// Boot screen: types "booting", fills the bar while the page loads, then swaps to "ready" and fades out.
const loader = document.querySelector("[data-loader]");
if (loader && document.documentElement.classList.contains("loading")) {
  const word = loader.querySelector("[data-loader-word]");
  const fill = loader.querySelector("[data-loader-fill]");
  const pct = loader.querySelector("[data-loader-pct]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduce ? 400 : 3500; // the shortest the boot runs
  const MAX = 10000; // on a slow connection, open the site anyway after this
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // The bar can't pass 90% until the fonts and the whole page have loaded.
  let loaded = false;
  const pageLoad = document.readyState === "complete" ? null : new Promise((r) => addEventListener("load", r, { once: true }));
  Promise.all([document.fonts?.ready, pageLoad]).then(() => { loaded = true; });

  // Letters go in at 115ms and come out at 55ms; the caret holds still while typing and blinks between.
  const type = async (text) => {
    if (reduce) { word.textContent = text; return; }
    word.parentNode.classList.add("typing");
    for (let i = 1; i <= text.length; i++) { word.textContent = text.slice(0, i); await wait(115); }
    word.parentNode.classList.remove("typing");
  };
  const erase = async () => {
    if (reduce) return;
    word.parentNode.classList.add("typing");
    while (word.textContent) { word.textContent = word.textContent.slice(0, -1); await wait(55); }
  };
  const typed = wait(reduce ? 0 : 250).then(() => type("booting"));

  const finish = async () => {
    await typed;
    await erase();
    await type("ready");
    await wait(reduce ? 60 : 350);
    loader.classList.add("done");
    loader.addEventListener("transitionend", () => {
      document.documentElement.classList.remove("loading");
      loader.remove();
    }, { once: true });
  };

  let start = null;
  const tick = (now) => {
    start ??= now;
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - t) ** 2;
    const share = loaded || now - start >= MAX ? eased : Math.min(eased, 0.9);
    pct.textContent = Math.round(share * 100);
    fill.style.transform = `scaleX(${share})`;
    if (share < 1) requestAnimationFrame(tick);
    else finish();
  };
  requestAnimationFrame(tick);
}
