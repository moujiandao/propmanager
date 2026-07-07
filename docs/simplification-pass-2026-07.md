# UI Simplification Pass — 2026-07-07

A conservative, behavior-preserving cleanup of the four UI files (`property-management-app.jsx`,
`phase2-components.jsx`, `email-automation-components.jsx`, `renewal-components.jsx`).
28 edits, +90/−77 lines, zero behavior change. This doc explains *why* each move is a
simplification and, more usefully, the **transferable principle** and the **cases where you
should not do it**. The point isn't the diff; it's the judgment.

---

## The meta-lessons (read these even if you skip the rest)

### 1. Scope a cleanup by expected yield, and use code history as the proxy
We scanned only the UI files, not the `lib/` seams. Cleanup pays off where code *accreted under
speed* (one 4,200-line monolith grown a `renderPage()` case at a time), and yields ~nothing where
someone already sat down and factored the code (the small, tested `lib/<entity>` modules). Pointing
a simplifier at already-factored code mostly produces churn or, worse, suggestions to unwind the
very seams you built on purpose. **Protect the deliberate code; hunt in the fast-accreted code.**

### 2. "Behavior-preserving" is a claim you have to *verify*, not assert
Every edit here was one of a few provably-safe shapes (dead code, no-op collapse, literal
extraction). The safety came from three gates run *after* the edits: `npm test` (72/72),
`npm run build` (compiles + type-checks all routes), and lint. Refactors that "look obviously
safe" are exactly the ones that ship silent regressions — the discipline is running the gate
anyway.

### 3. Judge a lint/test result by its *delta*, not its absolute number
Lint reported **35 problems** on the branch. Alarming — until we `git stash`-ed the changes and
ran lint on `main`: also 35, identical rules and locations, only line numbers shifted. On a legacy
codebase the absolute count is noise (pre-existing `<img>`, setState-in-effect, memoization
warnings). **The signal is the diff against the base branch.** Command pattern:
```
git stash && npm run lint 2>&1 | grep 'problems'; git stash pop
```

### 4. Separate "cleanup" from "behavior change" ruthlessly, even when they touch the same line
We found three `<Btn style={{background:"#ef4444"}}>` delete buttons where `Btn` never spreads
`style` — so they've never rendered red (a latent bug). Removing the dead prop is cleanup; making
the button actually red is a behavior change. Those are **different pull requests**. We held the
dead-prop removal so as not to erase the breadcrumb before the bug was triaged. Mixing the two is
how a "harmless cleanup" quietly changes the UI.

---

## The simplifications, by category

### A. Dead code removal
The safest category — removing something provably unreachable/unused can't change behavior.

- **Unused variables**: `daysUntilStart` was computed in two pages and never read (render used
  `notStartedYet`/`fmtDate` instead). Delete.
- **Unused props**: `setData` destructured in `ContractsPage`/`PropertiesPage` but never used
  (those pages write via fetch routes / `usePropertyMutations`). *Nuance:* `TenantsPage` and
  `MaintenancePage` **do** use `setData` — we left those. "Unused" is per-component, not global.
- **Unused imports**: `Badge`, `buildContext`.
- **Duplicate object keys**: `T.en` had `st_failed` and `saving` defined twice. JS silently keeps
  the **last**, so the first was dead. *Principle:* a duplicate key is a dead-code bug, not a
  stylistic choice. We also fixed the matching duplicates in `T.zh` to keep en/zh parity — the
  bilingual pairing is deliberate, but a *duplicate within one language* is not.
- **Unread computed field**: `renewal`'s `due` objects carried an `end` field nothing consumed.

> When NOT to: if a variable is unused but its *right-hand side* has a side effect (a function call
> that mutates or logs), you can't delete it — you'd remove the effect. All of ours were pure.

### B. No-op / redundant logic
Collapsing expressions that always evaluate to the same thing.

- **Identical-branch ternaries**: `color: cond ? "#111111" : "#111111"` → `color: "#111111"` (both
  branches equal, so the condition is dead). Five sites in the monolith, one in phase2.
  *Watch out:* on those same elements an **adjacent** `cursor: cond ? "pointer" : "default"` ternary
  was meaningful — we collapsed only the no-op one. Don't pattern-match the whole line.
- **Needless template literal**: `` label={`${t.colStatus}`} `` → `label={t.colStatus}` (wrapping a
  string in a template that does nothing).
- **Verbose null checks**: `x !== null && x !== undefined` → `x != null` (the one case where loose
  `!=` is idiomatic and correct — `!= null` matches both null and undefined and nothing else).

### C. Hoisting duplicated inline-style objects
This app has **no CSS classes** — styling is 100% inline objects — so a repeated style literal *is*
duplication, and hoisting to a `const` is the app's DRY mechanism.

- Repeated literal → one file-level `const`, spread at each site, overriding only the differing
  field: `<button style={{ ...dangerIconBtnStyle, fontSize: 12 }}>`.
- Examples: `dangerIconBtnStyle`, `PRIORITY_COLORS` (was rebuilt *every* `.map` iteration — hoisting
  also avoids re-allocating the object per render), `emptyCard`, `dangerBtn`, `iconBtn`, `footerRow`,
  `errText`, `docTypeBadgeColor`, `filterSelectStyle`, `emptyState`, `sectionHeading`, `redChip`.

> *Principle:* extract the **common base**, let call sites override the deltas. Don't
> over-parameterize — if two objects differ in five fields, they're not the same object; forcing
> them together with a config bag is worse than the duplication.
>
> When NOT to: we kept these consts **inside each file**. A cross-file "shared styles" module would
> have coupled the deliberately self-contained component files (they already have a circular import
> we don't want to deepen). Local duplication across files beat a shared dependency here.

### D. Extracting small repeated helpers
Same expression repeated → one named function.

- `fullName(x)` = `[x.name, x.lastName].filter(Boolean).join(' ')` (4 sites; callers keep their own
  `|| fallback`).
- `nl2br(s)` = `s ? s.replace(/\n/g, '<br>') : ''` (2 sites).
- `isActiveTenant(x)` = the current/future-tenant status test (2 sites; a caller composes the extra
  `&& !inBatch.has(x.id)`).

> *Principle:* naming the expression is half the value — `isActiveTenant(x)` reads better than the
> raw status comparison even before you count the dedupe. But only extract the part that's
> **identical**; leave the varying condition at the call site rather than passing flags in.

### E. Import the canonical formatter instead of re-implementing it
`phase2-components.jsx` had two local currency formatters (`fmt`, `fmt2`) that re-implemented
`lib/format`'s `fmt`. Replaced with `import { fmt } from '@/lib/format'`.

> This is the one that required the most care, because "looks the same" ≠ "is the same":
> - We verified every call site was truthy-guarded (`x ? fmt(x) : '—'`), so `lib/format`'s `|| 0`
>   fallback is never hit → identical output.
> - We deliberately **did not** touch `renewal`'s local `fmtMoney`, which returns `'—'` for null
>   where `lib/format`'s `fmt` returns `$0`. Consolidating it *would change rendered output*, so it
>   stays local (and the file has a comment explaining why).
> - We did not touch `new Date(x).toLocaleDateString()` calls: they emit a browser-locale
>   month/day string, a *different format* from `fmtDate`'s rule. Same trap.
>
> *Transferable trap:* two formatters with the same name and similar body can have different
> null/edge behavior. Before merging, check the boundaries (null, 0, empty, locale), not the happy
> path.

---

## What we deliberately did NOT do (and why that's part of the skill)

- **Didn't collapse the `lib/<entity>` seams** — deliberate architecture.
- **Didn't factor away `T.en`/`T.zh` duplication** — the bilingual pairing is intentional; only
  same-language *duplicate keys* were bugs.
- **Didn't convert state-driven `renderPage()` nav to routes** — deliberate.
- **Didn't touch the circular imports** between component files — deliberate; keeping styles
  file-local respects it.
- **Didn't do the 8 "Tier 3" structural dedupes** (shared `BackButton`, `PreviewCard`, merged
  dashboard tenant cards, a segmented-toggle helper) — these cross into judgment calls that touch
  interactive wiring or per-variant differences. They're a separate, per-item pass, not a
  rubber-stamp cleanup.

> The restraint *is* the lesson: a good simplification pass is defined as much by what it refuses
> to touch as by what it changes.

---

## How it was verified
| Gate | Result |
|---|---|
| `npm test` | 72/72 pass |
| `npm run lint` | identical problem set to `main` (zero new) |
| `npm run build` | exit 0, all routes incl. `/dashboard` compiled |
| `code-reviewer` subagent | PASS, no blocking issues |
| diff audit vs `main` | every hunk maps to one authorized finding; nothing over-applied |
