/**
 * Themes.
 *
 * Every theme must define every token — there are no fallbacks, because a half-defined theme
 * fails silently by inheriting the previous one's colours.
 *
 * `border` is deliberately a token. Pure-black borders are right in `cream` and wrong in Mocha;
 * dark themes use a light border, which is what neobrutalism does when it goes dark.
 *
 * The per-card pastels in `apps.ts` do NOT change with the theme — they're each card's identity.
 * That is also why `accentInk` is dark in every theme: every accent here is a mid-to-light gold,
 * so light text on it fails contrast. `npm run check:contrast` enforces that against the live
 * page rather than against this table.
 */

export interface ThemeTokens {
  canvas: string
  surface: string
  ink: string
  inkMuted: string
  inkSubtle: string
  accent: string
  accentInk: string
  border: string
  grid: string
}

export interface Theme {
  id: string
  label: string
  dark: boolean
  tokens: ThemeTokens
}

/** Positional so each palette reads as one line: canvas, surface, ink×3, accent, accentInk, border, grid. */
const t = (
  canvas: string, surface: string,
  ink: string, inkMuted: string, inkSubtle: string,
  accent: string, accentInk: string, border: string, grid: string,
): ThemeTokens => ({ canvas, surface, ink, inkMuted, inkSubtle, accent, accentInk, border, grid })

export const themes: readonly Theme[] = [
  { id: 'cream', label: 'Cream', dark: false, tokens:
    t('#F7F5EE', '#FFFFFF', '#161616', 'rgba(22,22,22,.74)', 'rgba(22,22,22,.60)', '#FACC00', '#161616', '#161616', 'rgba(22,22,22,.055)') },

  { id: 'latte', label: 'Catppuccin Latte', dark: false, tokens:
    t('#EFF1F5', '#FFFFFF', '#4C4F69', '#575A70', '#5F6379', '#DF8E1D', '#11111B', '#4C4F69', 'rgba(76,79,105,.08)') },

  { id: 'frappe', label: 'Catppuccin Frappé', dark: true, tokens:
    t('#303446', '#292C3C', '#C6D0F5', '#B5BFE2', '#A5ADCE', '#E5C890', '#232634', '#C6D0F5', 'rgba(198,208,245,.08)') },

  { id: 'macchiato', label: 'Catppuccin Macchiato', dark: true, tokens:
    t('#24273A', '#1E2030', '#CAD3F5', '#B8C0E0', '#A5ADCB', '#EED49F', '#181926', '#CAD3F5', 'rgba(202,211,245,.08)') },

  { id: 'mocha', label: 'Catppuccin Mocha', dark: true, tokens:
    t('#1E1E2E', '#181825', '#CDD6F4', '#BAC2DE', '#A6ADC8', '#F9E2AF', '#11111B', '#CDD6F4', 'rgba(205,214,244,.08)') },

  { id: 'rose-pine', label: 'Rosé Pine', dark: true, tokens:
    t('#191724', '#1F1D2E', '#E0DEF4', '#C4C1DC', '#A6A1C0', '#F6C177', '#191724', '#E0DEF4', 'rgba(224,222,244,.08)') },

  { id: 'rose-pine-moon', label: 'Rosé Pine Moon', dark: true, tokens:
    t('#232136', '#2A273F', '#E0DEF4', '#C4C1DC', '#A9A5C4', '#F6C177', '#232136', '#E0DEF4', 'rgba(224,222,244,.08)') },

  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', dark: false, tokens:
    t('#FAF4ED', '#FFFAF3', '#575279', '#63597F', '#6E6A86', '#EA9D34', '#26233A', '#575279', 'rgba(87,82,121,.09)') },

  { id: 'nord', label: 'Nord', dark: true, tokens:
    t('#2E3440', '#3B4252', '#ECEFF4', '#D8DEE9', '#B8C1D0', '#EBCB8B', '#2E3440', '#ECEFF4', 'rgba(236,239,244,.07)') },

  { id: 'gruvbox-dark', label: 'Gruvbox Dark', dark: true, tokens:
    t('#282828', '#32302F', '#EBDBB2', '#D5C4A1', '#BDAE93', '#FABD2F', '#282828', '#EBDBB2', 'rgba(235,219,178,.07)') },

  { id: 'gruvbox-light', label: 'Gruvbox Light', dark: false, tokens:
    t('#FBF1C7', '#FFFBEF', '#3C3836', '#504945', '#5F5650', '#D79921', '#1D2021', '#3C3836', 'rgba(60,56,54,.09)') },

  { id: 'dracula', label: 'Dracula', dark: true, tokens:
    t('#282A36', '#21222C', '#F8F8F2', '#E2E2DC', '#BFC7E0', '#F1FA8C', '#282A36', '#F8F8F2', 'rgba(248,248,242,.07)') },

  { id: 'tokyo-night', label: 'Tokyo Night', dark: true, tokens:
    t('#1A1B26', '#16161E', '#C0CAF5', '#A9B1D6', '#949EC8', '#E0AF68', '#1A1B26', '#C0CAF5', 'rgba(192,202,245,.07)') },

  { id: 'everforest', label: 'Everforest', dark: true, tokens:
    t('#2D353B', '#343F44', '#D3C6AA', '#C0B296', '#A5AC9E', '#DBBC7F', '#2D353B', '#D3C6AA', 'rgba(211,198,170,.07)') },

  { id: 'kanagawa', label: 'Kanagawa', dark: true, tokens:
    t('#1F1F28', '#16161D', '#DCD7BA', '#C8C093', '#A9A18B', '#E6C384', '#1F1F28', '#DCD7BA', 'rgba(220,215,186,.07)') },

  { id: 'solarized-dark', label: 'Solarized Dark', dark: true, tokens:
    t('#002B36', '#073642', '#EEE8D5', '#C6C3B4', '#A2A093', '#B58900', '#002B36', '#EEE8D5', 'rgba(238,232,213,.07)') },

  { id: 'solarized-light', label: 'Solarized Light', dark: false, tokens:
    t('#FDF6E3', '#FFFDF6', '#073642', '#31555F', '#4E6E78', '#B58900', '#002B36', '#073642', 'rgba(7,54,66,.09)') },

  { id: 'one-dark', label: 'One Dark', dark: true, tokens:
    t('#282C34', '#21252B', '#DCE0E8', '#C2C8D4', '#9AA3B2', '#E5C07B', '#282C34', '#DCE0E8', 'rgba(220,224,232,.07)') },
]

export const DEFAULT_THEME = 'cream'

/** Emitted into the document as one stylesheet. Themes are data; this is the only renderer. */
export function themeCss(): string {
  return themes
    .map(({ id, tokens: k }) =>
      `[data-theme="${id}"]{` +
      [
        `--canvas-base:${k.canvas}`,
        `--canvas-grid:${k.grid}`,
        `--surface:${k.surface}`,
        `--ink:${k.ink}`,
        `--ink-muted:${k.inkMuted}`,
        `--ink-subtle:${k.inkSubtle}`,
        `--accent:${k.accent}`,
        `--accent-ink:${k.accentInk}`,
        `--border:${k.border}`,
      ].join(';') +
      `}`,
    )
    .join('\n')
}
