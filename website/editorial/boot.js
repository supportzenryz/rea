// Runs before first paint: hide text until the serif loads (app.js removes
// the class), so the page never swaps fonts on screen.
document.documentElement.classList.add("fonts-pending");
