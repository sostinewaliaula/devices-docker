/**
 * Shared, themed HTML e-mail building blocks (light + dark).
 *
 * Company palette (flat solid colours only):
 *   Blue tint #152F52 | Red #D90429 | White #FFFFFF
 *   Golden brown #F7E7C6 | Orange #E59730 | Green #D9E021
 *
 * How theming works
 * -----------------
 * Every element is emitted with its LIGHT colours inline (so clients that strip
 * <style> still render correctly) AND with an `em-*` class. The <style> block
 * from emailStyles() then overrides those classes with `!important` inside
 * `@media (prefers-color-scheme: dark)`. Inline styles can only be beaten by
 * `!important` rules, which is why every dark override is marked !important.
 *
 * Client support (be honest):
 *  - Apple Mail / iOS Mail, Outlook.com + Outlook apps (partly, via the
 *    [data-ogsc]/[data-ogsb] selectors), Thunderbird, Samsung Mail: honour
 *    prefers-color-scheme, so the designed dark theme is used.
 *  - Gmail (web, Android, iOS) ignores prefers-color-scheme and applies its own
 *    colour inversion in dark mode. The light theme is therefore built to
 *    survive that: every coloured block carries an explicit bgcolor attribute
 *    and background-color, and no text is white on a transparent background.
 *  - Outlook desktop (Word engine) ignores media queries and shows the light theme.
 */

export const PALETTE = Object.freeze({
  navy: '#152F52',
  red: '#D90429',
  white: '#FFFFFF',
  gold: '#F7E7C6',
  orange: '#E59730',
  green: '#D9E021',
});

export const LIGHT = Object.freeze({
  page: '#F6F8FB',
  card: '#FFFFFF',
  header: '#152F52',
  headerText: '#FFFFFF',
  headerBorder: '#152F52',
  text: '#22344F',
  muted: '#63758F',
  border: '#DCE3ED',
  heading: '#152F52',
  link: '#152F52',
  btnBg: '#D90429',
  btnText: '#FFFFFF',
  calloutBg: '#F7E7C6',
  calloutText: '#152F52',
  panelBg: '#F6F8FB',
  footerBg: '#F6F8FB',
});

export const DARK = Object.freeze({
  page: '#0B1626',
  card: '#122238',
  header: '#0B1626',
  headerText: '#F7E7C6',
  headerBorder: '#D90429',
  text: '#DCE3ED',
  muted: '#8C9BB2',
  border: '#2E3F5A',
  heading: '#F7E7C6',
  link: '#F7E7C6',
  btnBg: '#F7E7C6',
  btnText: '#152F52',
  calloutBg: '#1B2E4A',
  calloutText: '#F7E7C6',
  panelBg: '#1B2E4A',
  footerBg: '#0B1626',
});

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const MONO = `'Courier New', Courier, monospace`;
const L = LIGHT;

// Status colours are identical in light and dark (they always sit on their own
// solid fill and always use NAVY text on green/orange, WHITE text on red).
const BADGES = {
  success: { bg: PALETTE.green, fg: PALETTE.navy },
  warning: { bg: PALETTE.orange, fg: PALETTE.navy },
  danger: { bg: PALETTE.red, fg: PALETTE.white },
  info: { bg: PALETTE.navy, fg: PALETTE.white }, // flips in dark, see rules below
};

/**
 * One row per class: [selector, {bg, color, border}] for the dark theme.
 * Used to generate both the prefers-color-scheme block and Outlook.com's
 * [data-ogsb] (backgrounds) / [data-ogsc] (text) overrides.
 */
const DARK_RULES = [
  ['.em-page', { bg: DARK.page }],
  ['.em-card', { bg: DARK.card, border: DARK.border }],
  ['.em-header', { bg: DARK.header, color: DARK.headerText, borderTop: DARK.headerBorder }],
  ['.em-title', { color: DARK.headerText }],
  ['.em-subtitle', { color: DARK.headerText }],
  ['.em-body', { bg: DARK.card, color: DARK.text }],
  ['.em-text', { color: DARK.text }],
  ['.em-muted', { color: DARK.muted }],
  ['.em-h', { color: DARK.heading }],
  ['.em-link', { color: DARK.link }],
  ['.em-border', { border: DARK.border }],
  ['.em-panel', { bg: DARK.panelBg, color: DARK.text, border: DARK.border }],
  ['.em-th', { bg: DARK.panelBg, color: DARK.muted, border: DARK.border }],
  ['.em-callout', { bg: DARK.calloutBg, color: DARK.calloutText }],
  ['.em-btn-td', { bg: DARK.btnBg }],
  ['.em-btn', { bg: DARK.btnBg, color: DARK.btnText }],
  ['.em-badge-info', { bg: PALETTE.gold, color: PALETTE.navy }],
  ['.em-code', { bg: DARK.calloutBg, color: DARK.calloutText, border: DARK.heading }],
  ['.em-footer', { bg: DARK.footerBg, color: DARK.muted, border: DARK.border }],
];

function decl({ bg, color, border, borderTop }) {
  const d = [];
  if (bg) d.push(`background-color: ${bg} !important;`);
  if (color) d.push(`color: ${color} !important;`);
  if (border) d.push(`border-color: ${border} !important;`);
  if (borderTop) d.push(`border-top-color: ${borderTop} !important;`);
  return d.join(' ');
}

/** CSS only (no <style> tags): light defaults + dark overrides. */
export function emailStyles() {
  const light = `
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, p, a, h1, h2, h3 { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }
    .em-page { background-color: ${L.page}; }
    .em-card { background-color: ${L.card}; border-color: ${L.border}; }
    .em-header { background-color: ${L.header}; color: ${L.headerText}; border-top-color: ${L.headerBorder}; }
    .em-title { color: ${L.headerText}; }
    .em-subtitle { color: ${L.headerText}; }
    .em-body { background-color: ${L.card}; color: ${L.text}; }
    .em-text { color: ${L.text}; }
    .em-muted { color: ${L.muted}; }
    .em-h { color: ${L.heading}; }
    .em-link { color: ${L.link}; }
    .em-border { border-color: ${L.border}; }
    .em-panel { background-color: ${L.panelBg}; color: ${L.text}; border-color: ${L.border}; }
    .em-th { background-color: ${L.panelBg}; color: ${L.muted}; border-color: ${L.border}; }
    .em-callout { background-color: ${L.calloutBg}; color: ${L.calloutText}; }
    .em-btn-td { background-color: ${L.btnBg}; }
    .em-btn { background-color: ${L.btnBg}; color: ${L.btnText}; }
    .em-badge-success { background-color: ${BADGES.success.bg}; color: ${BADGES.success.fg}; }
    .em-badge-warning { background-color: ${BADGES.warning.bg}; color: ${BADGES.warning.fg}; }
    .em-badge-danger { background-color: ${BADGES.danger.bg}; color: ${BADGES.danger.fg}; }
    .em-badge-info { background-color: ${BADGES.info.bg}; color: ${BADGES.info.fg}; }
    .em-code { background-color: ${L.panelBg}; color: ${L.heading}; border-color: ${L.border}; }
    .em-footer { background-color: ${L.footerBg}; color: ${L.muted}; border-color: ${L.border}; }
    @media only screen and (max-width: 620px) {
      .em-card { width: 100% !important; }
      .em-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .em-stack { display: block !important; width: 100% !important; }
    }`;

  const darkBlock = DARK_RULES.map(([sel, v]) => `      ${sel} { ${decl(v)} }`).join('\n');
  const darkAnchors = `      .em-btn, .em-btn-td { border-color: ${DARK.btnBg} !important; }
      .em-callout a, .em-code a { color: ${DARK.calloutText} !important; }`;

  // Outlook.com / Outlook apps: they rewrite colours and expose the originals
  // via attributes; [data-ogsb] = background, [data-ogsc] = text colour.
  const outlook = DARK_RULES.map(([sel, v]) => {
    const out = [];
    if (v.bg) out.push(`[data-ogsb] ${sel} { background-color: ${v.bg} !important; }`);
    if (v.color) out.push(`[data-ogsc] ${sel} { color: ${v.color} !important; }`);
    return out.join(' ');
  }).filter(Boolean).map((l) => `    ${l}`).join('\n');

  return `${light}
    @media (prefers-color-scheme: dark) {
${darkBlock}
${darkAnchors}
    }
${outlook}
  `;
}

/** <meta> color-scheme tags + the <style> block. Drop this inside <head>. */
export function emailHead() {
  return `<meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style type="text/css">${emailStyles()}</style>`;
}

// ---------------------------------------------------------------------------
// Content helpers. All emit class + inline LIGHT style.
// ---------------------------------------------------------------------------

/** Body paragraph. */
export function paragraph(html, { margin = '0 0 14px' } = {}) {
  return `<p class="em-text" style="margin:${margin};font-size:15px;line-height:1.6;color:${L.text};">${html}</p>`;
}

/** Muted small text. */
export function muted(html, { margin = '0 0 8px' } = {}) {
  return `<p class="em-muted" style="margin:${margin};font-size:13px;line-height:1.5;color:${L.muted};">${html}</p>`;
}

/** Heading inside the body (h2 by default). */
export function heading(text, level = 2) {
  const size = level === 1 ? 22 : level === 2 ? 18 : 15;
  return `<h${level} class="em-h" style="margin:22px 0 10px;font-size:${size}px;line-height:1.3;font-weight:700;color:${L.heading};">${text}</h${level}>`;
}

/** Inline link. */
export function link(url, text) {
  return `<a class="em-link" href="${url}" target="_blank" rel="noopener" style="color:${L.link};text-decoration:underline;word-break:break-all;">${text}</a>`;
}

/** Bulletproof, solid-colour CTA button (red in light, golden brown in dark). */
export function button(text, url, { align = 'left' } = {}) {
  const a = align === 'center' ? 'center' : 'left';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${a}" style="margin:16px ${a === 'center' ? 'auto' : '0'};">
  <tr><td class="em-btn-td" align="center" bgcolor="${L.btnBg}" style="background-color:${L.btnBg};border-radius:6px;">
    <a class="em-btn" href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1.2;color:${L.btnText};background-color:${L.btnBg};text-decoration:none;border-radius:6px;">${text}</a>
  </td></tr>
</table>`;
}

/** Pill badge. kind: success | warning | danger | info. */
export function badge(text, kind = 'info') {
  const k = BADGES[kind] ? kind : 'info';
  const { bg, fg } = BADGES[k];
  return `<span class="em-badge em-badge-${k}" style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;line-height:1.4;letter-spacing:0.3px;background-color:${bg};color:${fg};">${text}</span>`;
}

/** One label/value row (use inside detailTable, or on its own inside a table). */
export function detailRow(label, value) {
  return `<tr>
    <td class="em-muted em-border" valign="top" style="padding:10px 12px 10px 0;width:38%;font-size:14px;font-weight:600;color:${L.muted};border-bottom:1px solid ${L.border};">${label}</td>
    <td class="em-text em-border" valign="top" style="padding:10px 0;font-size:14px;color:${L.text};border-bottom:1px solid ${L.border};">${value}</td>
  </tr>`;
}

/** Table of label/value pairs. Falsy entries are skipped (for conditional rows). */
export function detailTable(rows) {
  const body = rows.filter(Boolean).map(([label, value]) => detailRow(label, value)).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;">${body}</table>`;
}

/** Neutral bordered panel (page-tint fill in light, raised navy in dark). */
export function panel(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
  <tr><td class="em-panel" bgcolor="${L.panelBg}" style="padding:16px 18px;background-color:${L.panelBg};color:${L.text};border:1px solid ${L.border};border-radius:8px;font-size:15px;line-height:1.6;">${html}</td></tr>
</table>`;
}

/** Soft golden-brown callout(navy text; dark theme flips to navy panel + golden text). */
export function callout(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 16px;">
  <tr><td class="em-callout" bgcolor="${L.calloutBg}" style="padding:14px 16px;background-color:${L.calloutBg};color:${L.calloutText};border-left:4px solid ${PALETTE.orange};border-radius:4px;font-size:15px;line-height:1.6;">${html}</td></tr>
</table>`;
}

/** Monospace verification-code box. */
export function codeBox(code) {
  return `<div class="em-code" style="display:inline-block;margin:8px 0 14px;padding:14px 20px;font-family:${MONO};font-size:32px;font-weight:800;letter-spacing:8px;background-color:${L.panelBg};color:${L.heading};border:2px solid ${L.border};border-radius:10px;">${code}</div>`;
}

/** Section title with underline rule. */
export function sectionTitle(text) {
  return `<h2 class="em-h em-border" style="margin:32px 0 12px;padding-bottom:8px;font-size:18px;font-weight:700;color:${L.heading};border-bottom:2px solid ${L.border};">${text}</h2>`;
}

/** Table header cell. */
export function th(text) {
  return `<th class="em-th" align="left" bgcolor="${L.panelBg}" style="padding:10px 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:left;background-color:${L.panelBg};color:${L.muted};border-bottom:1px solid ${L.border};">${text}</th>`;
}

/** Table body cell. */
export function td(html, { muted: isMuted = false, colspan, center = false } = {}) {
  const color = isMuted ? L.muted : L.text;
  return `<td class="${isMuted ? 'em-muted' : 'em-text'} em-border"${colspan ? ` colspan="${colspan}"` : ''} valign="top" style="padding:12px;font-size:${isMuted ? 13 : 14}px;color:${color};border-bottom:1px solid ${L.border};${center ? 'text-align:center;' : ''}">${html}</td>`;
}

/** Full-width data table. headers: string[]; rowsHtml: pre-rendered <tr> strings. */
export function dataTable(headers, rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;">
  <thead><tr>${headers.map(th).join('')}</tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>`;
}

/** Side-by-side stat tiles. cards: [{label, value, note}] */
export function statCards(cards) {
  const w = Math.floor(100 / cards.length);
  const cells = cards.map((c, i) => `<td class="em-panel em-stack" width="${w}%" valign="top" bgcolor="${L.panelBg}" style="padding:16px;background-color:${L.panelBg};color:${L.text};border:1px solid ${L.border};border-left:4px solid ${PALETTE.orange};">
      <div class="em-muted" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${L.muted};">${c.label}</div>
      <div class="em-h" style="margin:8px 0;font-size:34px;font-weight:800;line-height:1.1;color:${L.heading};">${c.value}</div>
      ${c.note ? `<div class="em-muted" style="font-size:13px;line-height:1.5;color:${L.muted};">${c.note}</div>` : ''}
    </td>${i < cards.length - 1 ? '<td width="12" class="em-stack" style="font-size:0;line-height:0;">&nbsp;</td>' : ''}`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr>${cells}</tr></table>`;
}

const DEFAULT_FOOTER = `<p style="margin:0 0 6px;">This is an automated notification from the Asset Management System.</p>
      <p style="margin:0;">Please do not reply to this email.</p>`;

/**
 * Complete themed HTML document.
 * @param {object} o
 * @param {string} o.title       Header title (also <title>).
 * @param {string} [o.subtitle]  Small line under the title in the header.
 * @param {string} [o.preheader] Hidden inbox preview text.
 * @param {string} o.bodyHtml    Inner body content (use the helpers above).
 * @param {string} [o.footerHtml] Footer content (defaults to the standard automated-notification lines).
 * @param {string} [o.logoSrc]   Optional logo image URL / cid: shown above the title.
 * @param {string} [o.brandName] Optional brand text shown above the title.
 */
export function wrapEmail({ title = '', subtitle = '', preheader = '', bodyHtml = '', footerHtml, logoSrc, brandName } = {}) {
  const footer = footerHtml === undefined ? DEFAULT_FOOTER : footerHtml;
  const pre = preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>`
    : '';
  const logo = logoSrc
    ? `<img src="${logoSrc}" alt="${brandName || ''}" height="36" style="display:block;height:36px;margin:0 0 12px;border:0;">`
    : '';
  const brand = brandName
    ? `<div class="em-subtitle" style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${L.headerText};">${brandName}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  ${emailHead()}
</head>
<body class="em-page" bgcolor="${L.page}" style="margin:0;padding:0;background-color:${L.page};font-family:${FONT};">
${pre}
<table role="presentation" class="em-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.page}" style="background-color:${L.page};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="em-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${L.card}" style="width:100%;max-width:600px;background-color:${L.card};border:1px solid ${L.border};border-radius:10px;">
    <tr><td class="em-header em-pad" bgcolor="${L.header}" style="padding:26px 32px;background-color:${L.header};color:${L.headerText};border-top:3px solid ${L.headerBorder};border-radius:10px 10px 0 0;font-family:${FONT};">
      ${logo}${brand}
      <h1 class="em-title" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${L.headerText};">${title}</h1>
      ${subtitle ? `<div class="em-subtitle" style="margin:6px 0 0;font-size:14px;line-height:1.4;color:${L.headerText};">${subtitle}</div>` : ''}
    </td></tr>
    <tr><td class="em-body em-pad" bgcolor="${L.card}" style="padding:28px 32px;background-color:${L.card};color:${L.text};font-family:${FONT};font-size:15px;line-height:1.6;">
${bodyHtml}
    </td></tr>
    ${footer ? `<tr><td class="em-footer em-pad" bgcolor="${L.footerBg}" align="center" style="padding:20px 32px;background-color:${L.footerBg};color:${L.muted};border-top:1px solid ${L.border};border-radius:0 0 10px 10px;font-family:${FONT};font-size:12px;line-height:1.5;text-align:center;">
      ${footer}
    </td></tr>` : ''}
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Backup notification e-mail (shared by scheduled, manual SQL and JSON backups).
 * rows: [label, value, {mono, small}] entries; notes: HTML strings rendered as callouts.
 */
export function backupEmail({ title, systemName, rows = [], notes = [] }) {
  const detailRows = rows.filter(Boolean).map(([label, value, o = {}]) => [
    label,
    o.mono
      ? `<span style="font-family:${MONO};${o.small ? 'font-size:12px;' : ''}">${value}</span>`
      : value,
  ]);
  const bodyHtml = detailTable(detailRows) + notes.map((n) => callout(n)).join('');
  return wrapEmail({
    title,
    preheader: title,
    bodyHtml,
    footerHtml: `<p style="margin:0;">This is an automated backup notification from ${systemName}</p>`,
  });
}

/** Round initial avatar (navy/white in light; golden/navy in dark). */
export function avatar(letter) {
  return `<span class="em-badge-info" style="display:inline-block;width:44px;height:44px;line-height:44px;border-radius:50%;text-align:center;font-size:18px;font-weight:700;background-color:${PALETTE.navy};color:${PALETTE.white};">${letter}</span>`;
}

/** Map a free-form label to a badge kind. */
export function kindFor(label = '') {
  const v = String(label).toLowerCase();
  if (['approved', 'fulfilled', 'success', 'low', 'resolved', 'completed'].includes(v)) return 'success';
  if (['pending', 'warning', 'high', 'in_progress', 'in progress'].includes(v)) return 'warning';
  if (['rejected', 'error', 'danger', 'critical', 'urgent', 'open', 'failed'].includes(v)) return 'danger';
  return 'info';
}

export default {
  PALETTE, LIGHT, DARK,
  emailHead, emailStyles, wrapEmail,
  paragraph, muted, heading, link, button, badge, detailRow, detailTable,
  callout, panel, codeBox, sectionTitle, th, td, dataTable, statCards, backupEmail, avatar, kindFor,
};
