// Runs before first paint.
//
// Text stays hidden until the serif loads (app.js removes the class), so the
// page never swaps fonts on screen. The font's stylesheet is added here rather
// than in the HTML so it does not block the first paint.
document.documentElement.classList.add("fonts-pending");
(() => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&display=swap";
  document.head.appendChild(link);
})();

// Can this browser show WebP? Decodes a 1x1 WebP; app.js waits for the answer
// (a few milliseconds) and otherwise uses the JPEG files.
window.__webp = new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img.width === 1);
  img.onerror = () => resolve(false);
  img.src = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  setTimeout(() => resolve(false), 400);
});
