// WCAG contrast check for the fiberMAP palette.
// Reads the real tokens out of src/theme.css so it cannot drift from them.
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "src", "theme.css"), "utf8");

function tokensFor(selector) {
  const block = css.slice(css.indexOf(selector));
  const body = block.slice(block.indexOf("{") + 1, block.indexOf("}"));
  const tokens = {};
  for (const line of body.split("\n")) {
    const m = line.match(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/);
    if (m) tokens[m[1]] = m[2];
  }
  return tokens;
}

const light = tokensFor(":root");
const dark = tokensFor('[data-theme="dark"]');

// Button text colour differs per theme: white on the light accent, near-black
// on the dark accent. Read it from the CSS rather than assuming.
function buttonText(theme) {
  const isDark = theme === "dark";
  const match = css.match(
    isDark
      ? /\[data-theme="dark"\]\s*\.btn\.primary\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,8})/
      : /\.btn\.primary\s*\{[^}]*color:\s*(#[0-9a-fA-F]{3,8})/,
  );
  return match ? match[1] : "#ffffff";
}

const hex = (h) => {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const checks = [
  ["ink on paper", "ink", "paper", 4.5],
  ["ink on surface", "ink", "surface", 4.5],
  ["ink-soft on surface", "ink-soft", "surface", 4.5],
  ["muted on paper", "muted", "paper", 4.5],
  ["muted on surface", "muted", "surface", 4.5],
  ["muted on surface-variant", "muted", "surface-variant", 4.5],
  ["muted on surface-sunken", "muted", "surface-sunken", 4.5],
  ["jacket on surface", "jacket", "surface", 4.5],
  ["white on jacket (btn)", "#ffffff", "jacket", 4.5],
  ["white on cut (btn)", "#ffffff", "cut", 4.5],
  ["cut on cut-soft", "cut", "cut-soft", 4.5],
  ["repaired on repaired-soft", "repaired", "repaired-soft", 4.5],
  ["planned on planned-soft", "planned", "planned-soft", 4.5],
  ["jacket on jacket-soft", "jacket", "jacket-soft", 4.5],
  ["focus ring on paper", "focus", "paper", 3],
];

let fails = 0;
for (const [theme, t] of [["light", light], ["dark", dark]]) {
  const btnText = buttonText(theme);
  for (const [name, fg, bg, min] of checks) {
    let f = fg.startsWith("#") ? fg : t[fg];
    let b = bg.startsWith("#") ? bg : t[bg];
    if (name.includes("(btn)")) f = btnText;
    if (!f || !b) {
      console.log(`SKIP  ${theme} ${name} (missing token ${!f ? fg : bg})`);
      continue;
    }
    const r = ratio(f, b);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${theme.padEnd(6)} ${name.padEnd(26)} ${r.toFixed(2)}:1  (need ${min})`,
    );
  }
}

console.log(`\n${fails} failing pair(s)`);
process.exit(fails ? 1 : 0);
