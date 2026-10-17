// Draws each generated plate as inline SVG. Every plate is 1000 units wide;
// its height follows the plate's aspect ratio (r = width / height).

(() => {
  const W = 1000;
  const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
  const SERIF = "'Cormorant Garamond', Georgia, serif";

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // Small deterministic generator so the same plate always draws the same bytes.
  const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const frame = (p, H, body) =>
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    `<rect width="${W}" height="${H}" fill="${p.pal.bg}"/>${body}</svg>`;

  const label = (p, H, text) =>
    text
      ? `<text x="70" y="${H - 64}" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${p.pal.fg}" opacity=".55">${esc(text.toUpperCase())}</text>`
      : "";

  const code = (p, H) => {
    const lines = p.lines;
    const longest = Math.max(...lines.map((l) => l.length), 1);
    const fs = Math.min(30, (W - 160) / (longest * 0.6), (H - 240) / (lines.length * 1.6));
    const lh = fs * 1.6;
    const top = (H - lines.length * lh) / 2 + fs;
    const rows = lines
      .map((l, i) => {
        const y = (top + i * lh).toFixed(1);
        const m = l.match(/^(0x[0-9a-f]+:)(.*)$/i);
        if (m)
          return `<text x="80" y="${y}" xml:space="preserve"><tspan fill="${p.pal.acc}">${esc(m[1])}</tspan>${esc(m[2])}</text>`;
        const muted = /^\s*(\/\/|#)/.test(l);
        return `<text x="80" y="${y}" xml:space="preserve"${muted ? ' opacity=".5"' : ""}>${esc(l)}</text>`;
      })
      .join("");
    return frame(
      p,
      H,
      `<g font-family="${MONO}" font-size="${fs.toFixed(1)}" fill="${p.pal.fg}">${rows}</g>` +
        `<text x="80" y="92" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${p.pal.fg}" opacity=".55">${esc((p.label || "").toUpperCase())}</text>`,
    );
  };

  const hex = (p, H) => {
    const next = rng(p.seed || 1);
    const rows = Math.floor((H - 220) / 44);
    const total = rows * 16;
    const bytes = Array.from({ length: total }, (_, i) =>
      i < (p.bytes || []).length ? p.bytes[i] : Math.floor(next() * (next() < 0.3 ? 16 : 256)),
    );
    const mark = new Set(p.mark || []);
    const fs = 21;
    const top = (H - rows * 44) / 2 + 20;
    let out = "";
    for (let r = 0; r < rows; r++) {
      const y = top + r * 44;
      const off = ((p.base || 0) + r * 16).toString(16).padStart(8, "0");
      out += `<text x="64" y="${y}" opacity=".45">${off}</text>`;
      for (let c = 0; c < 16; c++) {
        const i = r * 16 + c;
        const x = 210 + c * 41 + (c >= 8 ? 14 : 0);
        if (mark.has(i)) out += `<rect x="${x - 4}" y="${y - 22}" width="34" height="30" fill="${p.pal.acc}"/>`;
        out += `<text x="${x}" y="${y}"${mark.has(i) ? ` fill="${p.pal.bg}"` : ""}>${bytes[i].toString(16).padStart(2, "0")}</text>`;
      }
    }
    return frame(
      p,
      H,
      `<g font-family="${MONO}" font-size="${fs}" fill="${p.pal.fg}">${out}</g>` +
        `<text x="64" y="92" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${p.pal.fg}" opacity=".55">${esc((p.label || "").toUpperCase())}</text>`,
    );
  };

  const ring = (p, H) => {
    const cx = W / 2;
    const cy = H / 2 - 20;
    const R = Math.min(W, H) * 0.3;
    const n = p.count || 16;
    const step = 256 / n;
    let out = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.pal.fg}" stroke-opacity=".25"/>`;
    for (let u = 0; u < 256; u += 8) {
      const a = (u / 256) * Math.PI * 2;
      const r1 = R + (u % 32 === 0 ? 26 : 14);
      out += `<line x1="${cx + Math.cos(a) * (R + 6)}" y1="${cy + Math.sin(a) * (R + 6)}" x2="${cx + Math.cos(a) * r1}" y2="${cy + Math.sin(a) * r1}" stroke="${p.pal.fg}" stroke-opacity=".35"/>`;
    }
    for (let i = 0; i < n; i++) {
      const a = (((i * step + (p.offset || 0)) % 256) / 256) * Math.PI * 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      out += `<line x1="${cx + Math.cos(a) * R * 0.18}" y1="${cy + Math.sin(a) * R * 0.18}" x2="${x}" y2="${y}" stroke="${p.pal.fg}" stroke-opacity=".18"/>`;
      out += `<circle cx="${x}" cy="${y}" r="${i === 0 ? 17 : 12}" fill="${i === 0 ? p.pal.acc : p.pal.fg}"/>`;
    }
    if (p.offset) {
      const a = (p.offset / 256) * Math.PI * 2;
      const d = R * 1.55;
      out += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * d}" y2="${cy + Math.sin(a) * d}" stroke="${p.pal.acc}" stroke-dasharray="6 8" stroke-width="2"/>`;
      out += `<rect x="${cx + Math.cos(a) * d - 13}" y="${cy + Math.sin(a) * d - 13}" width="26" height="26" fill="none" stroke="${p.pal.acc}" stroke-width="3" transform="rotate(45 ${cx + Math.cos(a) * d} ${cy + Math.sin(a) * d})"/>`;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="7" fill="${p.pal.fg}"/>`;
    return frame(p, H, out + label(p, H, p.label));
  };

  const curve = (p, H) => {
    const x0 = 130, x1 = W - 90, y0 = H - 150, y1 = 120;
    const sx = (x) => x0 + (x / 640) * (x1 - x0);
    const sy = (v) => y0 - ((v + 500) / 1000) * (y0 - y1);
    let out = "";
    for (let v = -500; v <= 500; v += 250)
      out += `<line x1="${x0}" x2="${x1}" y1="${sy(v)}" y2="${sy(v)}" stroke="${p.pal.fg}" stroke-opacity="${v === 0 ? 0.45 : 0.15}"/>` +
        `<text x="${x0 - 18}" y="${sy(v) + 6}" text-anchor="end">${v}</text>`;
    for (let x = 0; x <= 640; x += 160)
      out += `<text x="${sx(x)}" y="${y0 + 42}" text-anchor="middle">${x}</text>`;
    out += `<line x1="${sx(0)}" y1="${sy(-500)}" x2="${sx(640)}" y2="${sy(500)}" stroke="${p.pal.acc}" stroke-width="4"/>`;
    for (let x = 0; x <= 640; x += 40)
      out += `<circle cx="${sx(x)}" cy="${sy(x * 1.5625 - 500)}" r="6" fill="${p.pal.fg}"/>`;
    out += `<text x="${x1}" y="${y0 + 82}" text-anchor="end" opacity=".55" letter-spacing="2">BALL X →</text>`;
    out += `<text x="${x0 - 18}" y="${y1 - 38}" text-anchor="end" opacity=".55" letter-spacing="2">PAN</text>`;
    return frame(p, H, `<g font-family="${MONO}" font-size="17" fill="${p.pal.fg}">${out}</g>` + `<text x="${x0}" y="${y1 - 38}" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${p.pal.fg}" opacity=".55">${esc(p.label.toUpperCase())}</text>`);
  };

  const otp = (p, H) => {
    const cx = W / 2, cy = H * 0.4, R = 300;
    const frac = 0.62;
    const a = frac * Math.PI * 2 - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    let out = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.pal.fg}" stroke-opacity=".2" stroke-width="2"/>`;
    out += `<path d="M ${cx} ${cy - R} A ${R} ${R} 0 ${large} 1 ${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R}" fill="none" stroke="${p.pal.acc}" stroke-width="10" stroke-linecap="round"/>`;
    for (let i = 0; i < 30; i++) {
      const t = (i / 30) * Math.PI * 2 - Math.PI / 2;
      out += `<line x1="${cx + Math.cos(t) * (R - 26)}" y1="${cy + Math.sin(t) * (R - 26)}" x2="${cx + Math.cos(t) * (R - (i % 5 ? 36 : 50))}" y2="${cy + Math.sin(t) * (R - (i % 5 ? 36 : 50))}" stroke="${p.pal.fg}" stroke-opacity=".4"/>`;
    }
    out += `<text x="${cx}" y="${cy + 34}" text-anchor="middle" font-family="${MONO}" font-size="104" fill="${p.pal.fg}" letter-spacing="4">${esc(p.code)}</text>`;
    out += `<text x="${cx}" y="${cy + R + 130}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="44" fill="${p.pal.fg}">19 seconds remaining</text>`;
    return frame(p, H, out + label(p, H, p.label));
  };

  const graph = (p, H) => {
    const n = p.nodes.length;
    const gap = (H - 300) / n;
    const bw = 620, bh = Math.min(84, gap * 0.62);
    const x = (W - bw) / 2;
    let out = "";
    p.nodes.forEach((t, i) => {
      const y = 150 + i * gap;
      out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${i === n - 1 ? p.pal.acc : "none"}" stroke="${p.pal.fg}" stroke-width="2"/>`;
      out += `<text x="${W / 2}" y="${y + bh / 2 + 9}" text-anchor="middle" fill="${i === n - 1 ? p.pal.bg : p.pal.fg}">${esc(t)}</text>`;
      out += `<text x="${x - 24}" y="${y + bh / 2 + 7}" text-anchor="end" opacity=".45" font-size="17">${String(i + 1).padStart(2, "0")}</text>`;
      if (i < n - 1) {
        const ay = y + bh, by = 150 + (i + 1) * gap;
        out += `<line x1="${W / 2}" y1="${ay}" x2="${W / 2}" y2="${by - 10}" stroke="${p.pal.fg}" stroke-width="2"/>` +
          `<path d="M ${W / 2 - 9} ${by - 16} L ${W / 2} ${by - 2} L ${W / 2 + 9} ${by - 16}" fill="none" stroke="${p.pal.fg}" stroke-width="2"/>`;
      }
    });
    return frame(p, H, `<g font-family="${MONO}" font-size="25" fill="${p.pal.fg}">${out}</g>` + label(p, H, p.label));
  };

  const mask = (p, H) => {
    const next = rng(p.seed || 3);
    const cols = 36, rows = 26;
    const cell = Math.min((W - 160) / cols, (H - 260) / rows);
    const ox = (W - cell * cols) / 2, oy = (H - cell * rows) / 2 - 20;
    let out = "";
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const on = next() < 0.42;
        const x = ox + c * cell + 2, y = oy + r * cell + 2, s = cell - 4;
        if (on) out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${c < 6 || c === 35 ? p.pal.acc : p.pal.fg}"/>`;
        else out += `<rect x="${x + s / 2 - 1.5}" y="${y + s / 2 - 1.5}" width="3" height="3" fill="${p.pal.fg}" opacity=".35"/>`;
      }
    const flag = "DUCTF{".split("");
    flag.forEach((ch, i) => {
      out += `<text x="${ox + i * cell + cell / 2}" y="${oy - 18}" text-anchor="middle" font-family="${MONO}" font-size="${cell * 0.8}" fill="${p.pal.acc}">${ch}</text>`;
    });
    out += `<text x="${ox + 35 * cell + cell / 2}" y="${oy - 18}" text-anchor="middle" font-family="${MONO}" font-size="${cell * 0.8}" fill="${p.pal.acc}">}</text>`;
    return frame(p, H, out + label(p, H, p.label));
  };

  const type = (p, H) => {
    const words = p.text.split(" ");
    const maxChars = p.mono ? 14 : 16;
    const lines = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > maxChars && cur) {
        lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    const longest = Math.max(...lines.map((l) => l.length));
    const fs = Math.min(150, (W - 180) / (longest * (p.mono ? 0.62 : 0.46)), (H - 260) / (lines.length * 1.1));
    const top = H / 2 - ((lines.length - 1) * fs * 1.08) / 2 + fs * 0.3;
    const text = lines
      .map((l, i) => `<text x="${W / 2}" y="${top + i * fs * 1.08}" text-anchor="middle">${esc(l)}</text>`)
      .join("");
    const font = p.mono ? `font-family="${MONO}"` : `font-family="${SERIF}" font-style="italic" font-weight="300"`;
    return frame(
      p,
      H,
      `<g ${font} font-size="${fs.toFixed(1)}" fill="${p.pal.fg}">${text}</g>` +
        `<text x="${W / 2}" y="${H - 64}" text-anchor="middle" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${p.pal.fg}" opacity=".55">${esc((p.caption || "").toUpperCase())}</text>`,
    );
  };

  const draw = { code, hex, ring, curve, otp, graph, mask, type };

  // Returns the inner markup for a plate; image plates become <img> elements.
  window.renderPlate = (p) => {
    if (p.type === "img")
      return `<img src="${esc(p.src)}" alt="${esc(p.alt || "")}" loading="lazy" decoding="async" class="${p.fill ? "fill" : ""}"/>`;
    const H = Math.round(W / p.r);
    return draw[p.type](p, H);
  };
})();
