# Goal 8 Phase A Mockups

Status: **APPROVED FOR PHASE B**

Prepared by: OpenAI Codex (GPT-5), requested by Choi Yunseong

Prepared on: 2026-07-11 KST

Baseline: `683f6f5f3bb496417f2cba1f442abac59bf676bc`

## Purpose

These static files translate reviewed focus-product hierarchy and visual evidence into FocusWhale's browser context. They do not reuse third-party assets, copy, scores, or mobile-only behavior.

The product hierarchy is:

- **Session:** the browser-action popup plus active, completion, blocked, and soft-overlay states.
- **Rules:** schedules, reusable target lists, intervention preferences, and advisory local-history suggestions.
- **Review:** truthful focus activity plus whale growth and rewards.
- **Preferences:** privacy, onboarding replay, analysis hours, and destructive data controls remain secondary.

## Approval Boundary

No production UI, runtime, locale catalog, manifest, package, or build configuration may change before explicit approval of these mockups. Silence or completion of this phase is not approval.

Approval must record:

- approver and date;
- exact mockup commit;
- approved state families;
- requested exceptions, if any.

## Review Pages

- `session.html`: popup idle, active, hard/emergency, and completion.
- `rules.html`: schedule rows, target lists, focused editor, and active-session lock.
- `review.html`: populated and empty truthful Review plus whale growth.
- `preferences.html`: subordinate behavior, optional analysis, onboarding replay, and local-data controls.
- `blocked.html`: medium and hard intervention state transitions.
- `overlay.html`: soft overlay waiting and ready states on light/dark hosts.
- `onboarding.html`: all three steps, completion, and error boundary.
- `pet-matrix.html`: the real five-stage/four-mood atlas and reduced-motion boundary.
- `theme-parity.html`: representative light-theme parity states.

Every review page opens directly from disk, uses local Pretendard and the real `384 x 1,920` whale atlas, and makes no external request. The toolbar switches the visual preview between English/Korean and dark/light without changing production localization behavior.

Open [`index.html`](./index.html) directly to enter the gallery. No build or local server is required. Query parameters are also available for deterministic review: `?lang=ko&theme=light&capture=1`.

Representative frozen images live in [`previews/`](./previews/). The HTML pages remain the approval source of truth because they contain the full state matrix and responsive behavior.

## Transfer Decisions

1. Keep Session in the browser popup; do not copy mobile bottom navigation.
2. Use one dominant number or action per state.
3. Present Rules as truthful projections of existing schedules and target lists; do not invent a new runtime owner.
4. Present only metrics supported by local records. Never show a composite score, inferred productivity, time saved, or passive browsing duration.
5. Keep the whale as FocusWhale's atmospheric hero. Do not import third-party imagery or branding.
6. Keep both production themes. Dark is the design lead, not the only supported theme.
7. Preserve every wellness invariant, intensity meaning, weekly emergency limit, active-session Options lock, local-only privacy rule, and acknowledgement/reward contract.

## Phase A Acceptance

- [x] All canonical pages open offline with no console error or missing asset.
- [x] English and Korean representative states show no overflow.
- [x] Dark-first hierarchy and representative light parity are approved.
- [x] Popup frames remain `360 x 580` with at most one visible primary CTA.
- [x] Rules and Review use truthful existing data semantics.
- [x] Medium/hard/overlay wording and emergency behavior are unchanged in meaning.
- [x] Production diff guard remains empty.
- [x] Product-owner approval is recorded.

Choi Yunseong approved all presented states on 2026-07-11 with no exceptions. The sanitized public Phase A commit is `e7274a1339a7f6849ace807c2fdaeeee33d031e8`; the terminology-only cleanup requested on 2026-07-12 did not alter layout or visual output. Technical evidence and the complete approval record are in [`PHASE_A_REPORT.md`](./PHASE_A_REPORT.md).

Production diff guard:

```sh
git diff --name-only 683f6f5 -- \
  src public package.json vite.config.ts vite.content.config.ts scripts/verify-build.mjs
```
