// Sends an email to the site owner (ENQUIRY_TO, fixed in wrangler.jsonc):
// through Cloudflare Email (send_email binding MAILER; ENQUIRY_TO must be a
// verified destination in the domain's Email Routing), else through Resend
// if RESEND_API_KEY is set. Returns true once one of them accepted it.
//
// The recipient is never taken from a request, so nobody can use this to
// send mail anywhere else.

export async function sendMail(env, { subject, text, html, replyTo }) {
  if (!env.ENQUIRY_TO) return false;

  if (env.MAILER && env.MAIL_FROM) {
    try {
      const { EmailMessage } = await import("cloudflare:email");
      const raw = mime({ from: env.MAIL_FROM, to: env.ENQUIRY_TO, subject, text, html, replyTo });
      await env.MAILER.send(new EmailMessage(env.MAIL_FROM, env.ENQUIRY_TO, raw));
      return true;
    } catch (err) {
      console.error("Cloudflare Email refused the message:", err?.message || String(err));
    }
  }

  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.ENQUIRY_FROM || "Website <onboarding@resend.dev>",
          to: [env.ENQUIRY_TO],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          text,
          html,
        }),
      });
      if (res.ok) return true;
      console.error("Resend refused the message", res.status, await res.text());
    } catch (err) {
      console.error("Could not reach Resend", err);
    }
  }
  return false;
}

// A plain-text and HTML email as raw MIME. The subject and both bodies are
// base64-encoded, so nothing in them can break out into a header; Reply-To
// is only ever an address that has already been validated.
export function mime({ from, to, subject, text, html, replyTo }) {
  const b64 = (s) => {
    let bin = "";
    for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
    return btoa(bin).replace(/.{76}/g, "$&\r\n");
  };
  const boundary = `b${crypto.randomUUID().replace(/-/g, "")}`;
  const part = (type, body) =>
    `--${boundary}\r\nContent-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(body)}\r\n`;
  return (
    `From: Sundar Rajan Website <${from}>\r\n` +
    `To: ${to}\r\n` +
    (replyTo ? `Reply-To: ${replyTo}\r\n` : "") +
    // RFC 3834: an automatic notification, so mail systems never auto-reply to it.
    `Auto-Submitted: auto-generated\r\n` +
    `Subject: =?UTF-8?B?${b64(subject.replace(/\s+/g, " ")).replace(/\r\n/g, "")}?=\r\n` +
    `Date: ${new Date().toUTCString()}\r\n` +
    `Message-ID: <${crypto.randomUUID()}@${from.split("@")[1]}>\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n` +
    part("text/plain", text) +
    part("text/html", html) +
    `--${boundary}--\r\n`
  );
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
