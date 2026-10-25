// "Change my cookie choice": forgets the choice and returns to the site,
// where the banner asks again.
const button = document.getElementById("change");
let stored = null;
try {
  stored = localStorage.getItem("sr-consent");
} catch {}
if (stored) {
  button.hidden = false;
  button.textContent = `Change my cookie choice (now: ${stored === "granted" ? "accepted" : "declined"})`;
  button.addEventListener("click", () => {
    try {
      localStorage.removeItem("sr-consent");
    } catch {}
    location.href = "/";
  });
}
