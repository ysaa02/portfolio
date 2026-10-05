// Theme toggle, remembered across visits.
document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  if (next === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// Project carousel counter follows the scroll position.
const track = document.querySelector("[data-carousel] .track");
const count = document.querySelector("[data-count]");
track.addEventListener("scroll", () => {
  const step = track.firstElementChild.getBoundingClientRect().width + 16;
  count.textContent = String(Math.round(track.scrollLeft / step) + 1).padStart(2, "0");
});

document.querySelector("[data-year]").textContent = new Date().getFullYear();
