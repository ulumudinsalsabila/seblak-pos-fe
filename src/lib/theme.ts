/**
 * Tenant brand colour → CSS custom properties.
 *
 * Only brand-driven tokens are derived here. Surfaces and financial semantics
 * (success / warning / destructive) are fixed in globals.css so a tenant
 * colour can never change what "loss" or "error" looks like.
 */

export const DEFAULT_PRIMARY = "#C2410C";
export const THEME_STORAGE_KEY = "seblak-theme";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DARK_TEXT = "#1C1917";
const WHITE = "#FFFFFF";

export function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && HEX_COLOR.test(value));
}

function rgb(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hex([red, green, blue]: number[]) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/** Mix `color` with `target`; `amount` 0 keeps `color`, 1 gives `target`. */
function mix(color: string, target: string, amount: number) {
  const from = rgb(color);
  const to = rgb(target);
  return hex(from.map((channel, index) => channel + (to[index] - channel) * amount));
}

function relativeLuminance(color: string) {
  const [red, green, blue] = rgb(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

/** WCAG contrast ratio between two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

/** White or dark text, whichever has the higher contrast on `color`. */
export function readableForeground(color: string) {
  return contrastRatio(color, WHITE) >= contrastRatio(color, DARK_TEXT)
    ? WHITE
    : DARK_TEXT;
}

/** Darken `color` towards the dark text colour until it reaches `ratio` on `surface`. */
function readableOn(color: string, surface: string, ratio = 4.5) {
  for (let step = 0; step <= 10; step += 1) {
    const candidate = mix(color, DARK_TEXT, step / 10);
    if (contrastRatio(candidate, surface) >= ratio) return candidate;
  }
  return DARK_TEXT;
}

export function brandVars(primaryColor: string): Record<string, string> {
  const primary = isHexColor(primaryColor)
    ? primaryColor.toUpperCase()
    : DEFAULT_PRIMARY;
  const foreground = readableForeground(primary);
  // Light brand colours get darker on hover; dark ones get lighter.
  const shiftTo = foreground === WHITE ? "#000000" : WHITE;
  const hover = mix(primary, shiftTo, 0.12);
  const active = mix(primary, shiftTo, 0.22);
  const accent = mix(primary, WHITE, 0.9);
  const [red, green, blue] = rgb(primary);
  return {
    "--primary": primary,
    "--primary-foreground": foreground,
    "--primary-hover": hover,
    "--primary-active": active,
    /** Brand colour usable as text/icon on light surfaces (links, active nav). */
    "--primary-text": readableOn(primary, WHITE),
    "--accent": accent,
    "--accent-foreground": readableOn(primary, accent),
    "--ring": primary,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-ring": primary,
    "--chart-1": primary,
    // Legacy variables still used by pages that are not redesigned yet.
    "--brand": primary,
    "--brand-dark": hover,
    "--brand-rgb": `${red}, ${green}, ${blue}`,
  };
}

export function applyBrandVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

export function clearBrandVars() {
  const root = document.documentElement;
  for (const name of Object.keys(brandVars(DEFAULT_PRIMARY))) {
    root.style.removeProperty(name);
  }
}

/**
 * Runs before hydration (see app/layout.tsx) to apply the last tenant's
 * brand colours and avoid a flash of the default colour. The snapshot only
 * holds colour values and is removed on logout.
 */
export const themeBootScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||"null");if(s&&s.vars){var r=document.documentElement.style;for(var k in s.vars){if(/^--[a-z0-9-]+$/.test(k)&&/^[#0-9A-Fa-f, ]+$/.test(s.vars[k]))r.setProperty(k,s.vars[k])}}}catch(e){}`;
