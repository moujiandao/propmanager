# Figma-Inspired Theme Refresh — Design

**Date:** 2026-06-12
**Branch:** `feat/figma-theme`

## Goal
Restyle the PropManager UI to resemble Figma's marketing site aesthetic: all-light
content, near-black text, neutral grays, hairline borders, generous whitespace, and
Inter typography with tight heading tracking. Visual-only change — no layout,
structure, copy, or behavior changes.

## Decisions (from brainstorming)
- **Direction:** Light content, **keep a dark sidebar** (neutralized to near-black).
  Login screen stays dark but its indigo accent is neutralized.
- **Accent:** Neutral black (`#111`) — black primary buttons, black/underlined links,
  gray active nav. No indigo.
- **Method:** Approach 2 — introduce a small `theme` token constant AND systematically
  swap recurring inline-style literals across the three UI files. New code references
  `theme`; existing literals are updated in place. No full token refactor.

## Design Tokens

### Palette
| Token | Value | Replaces |
|---|---|---|
| `text` (headings) | `#111111` | `#0f172a` |
| `textMuted` (body/description) | `#6b7280` | `#64748b` |
| `textFaint` (labels/meta) | `#9ca3af` | `#475569`, `#94a3b8` |
| `border` (hairline) | `#eaeaea` | `#e2e8f0` |
| `accent` (buttons/links/focus ring) | `#111111` | `#4f46e5` (indigo) |
| `accentHover` | `#000000` | indigo dark variants |
| `bg` / `card` | `#ffffff` | mostly unchanged |
| `bgSubtle` (read-only fields, hovers) | `#fafafa` / `#f8fafc` | `#f8fafc` |
| `sidebar` | `#111111` (neutral near-black) | `#0f172a` (slate, de-blued) |
| `sidebarText` inactive | `#9ca3af` | `#94a3b8` |
| `sidebarActive` | white 12% overlay + `#ffffff` text | indigo glow + `#a5b4fc` |

### Typography (Inter — already loaded)
- Headings: weight 600–700, letter-spacing `-0.02em`.
- Body: color `#6b7280`, weight 400–500.
- Page titles slightly larger; generous line-height.
- Keep existing `fontFamily` strings (Inter + system fallback).

### Shape
- Borders: `1.5px` → `1px` hairline (`#eaeaea`).
- Radii standardized: cards/modals `12`, buttons/inputs `8`, badges pill (`99`).
- Heavy box-shadows reduced to subtle or border-only.

## Component Treatments
- **Btn:** primary = black fill / white text; secondary = light-gray; ghost = transparent.
- **Inp / Sel:** 1px hairline border, black focus ring, `#fafafa` read-only.
- **Modal / cards:** hairline border, `12` radius, minimal shadow.
- **Badge:** neutral pills; keep semantic status colors but soften toward neutral grays.
- **Sidebar:** neutral near-black, gray inactive items, white-overlay active state.
- **PageHeader / StatCard:** tight bold near-black titles, gray subtitles.
- **Login screen:** keep dark; swap indigo gradient/accent to neutral black/white.

## Scope
**In scope (files):**
- `property-management-app.jsx` (defines `theme`, landlord + tenant UI, login, sidebar)
- `phase2-components.jsx`
- `email-automation-components.jsx`

**Out of scope:**
- No layout/structure changes, no copy changes.
- No new translation strings (purely visual; no new user-facing text).
- No changes to API routes, data, or `lib/`.

## Verification
- `npm run build` succeeds.
- One targeted browser screenshot of the dashboard to confirm the look.
- Spot-check login, a modal, and the sidebar active state.
