// Google Analytics 4 with Google Consent Mode v2 and a cookie banner.
//
// - Runs only when the Worker has put the measurement ID in the page
//   (<meta name="ga-id">), so nothing happens until Analytics is set up.
// - Every kind of storage starts "denied": no cookies, nothing for ads. The
//   tag then sends only cookieless, anonymous pings (Consent Mode "advanced").
// - Accept turns on analytics cookies only; ads stay denied. Decline keeps
//   everything off. The choice is remembered in this browser; the privacy
//   page (and srConsent.reset()) asks again.
(() => {
  const id = document.querySelector('meta[name="ga-id"]')?.content;
  if (!id) return;
  const KEY = "sr-consent";
  const read = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  const write = (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: read() === "granted" ? "granted" : "denied",
    wait_for_update: 500,
  });
  gtag("set", "ads_data_redaction", true);
  gtag("js", new Date());
  gtag("config", id);
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(tag);

  const choose = (value) => {
    write(value);
    gtag("consent", "update", { analytics_storage: value });
    hide();
  };

  // The banner: small, at the bottom; Decline is as easy as Accept.
  let banner = null;
  const hide = () => banner && (banner.hidden = true);
  const show = () => {
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "consent";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Cookies");
      banner.innerHTML =
        '<p>May I count visits with Google Analytics? It uses cookies, only with your OK, and nothing is used for advertising. <a href="/privacy">Privacy</a></p>' +
        '<div class="consent-actions"><button type="button" data-v="denied">Decline</button><button type="button" data-v="granted">Accept</button></div>';
      banner.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-v]");
        if (b) choose(b.dataset.v);
      });
      document.body.appendChild(banner);
    }
    banner.hidden = false;
  };

  window.srConsent = { reset: show, value: read };
  const start = () => {
    if (!read()) show();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
