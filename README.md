# FocusWhale

Personal screentime Chrome extension for Naver Whale. The extension is Manifest V3, local-first, and uses vanilla TypeScript with Vite.

## Commands

```sh
npm install
npm run build
npm run typecheck
npm test
```

## Load In Browser

1. Run `npm run build`.
2. Open `chrome://extensions` or `whale://extensions`.
3. Enable developer mode.
4. Click "Load unpacked".
5. Select the generated `dist/` directory.

## Goal 0 Checklist

- [x] Vite + TypeScript strict + vitest scaffold exists.
- [x] Manifest V3 uses a module service worker, not a background page.
- [x] Manifest declares `declarativeNetRequest`, `storage`, `alarms`, `history`, `tabs`, and `<all_urls>`.
- [x] Multi-entry build includes background, content script, popup, options, and blocked page.
- [x] `src/shared/types.ts` matches the shared type contract.
- [x] `src/shared/storage.ts` provides typed storage wrappers, key constants, and change subscription helper.
- [x] `src/shared/messaging.ts` provides typed messages and one retry for cold-start send failures.
- [x] `src/shared/xp.ts` provides pure XP and stage functions.
- [x] Placeholder entries log `OK`.
- [x] `npm run build` succeeds.
- [x] `npm run typecheck` succeeds.
- [x] `npm test` succeeds.

## Manual Loading Note

Goal 0 only creates loadable placeholders. Browser smoke checks that require Whale are documented later in `SMOKE_TEST.md` by the blocking-engine goal.

## Goal 6 UI Verification Checklist

Implementation themes: `focuswhale`, `focuswhale-dark`, `focuswhale-ocean`, `focuswhale-mint`, `focuswhale-lavender`, `focuswhale-coral`.

- [ ] Popup idle, light and dark: pet hero is the only decorative color area; bottom primary CTA is the only full-width button.
- [ ] Popup active, light and dark: radial progress frames the pet; intensity upgrade actions render as small soft floating buttons.
- [ ] Blocked medium, light and dark: one centered card; temporary-allow friction stays inside the same card.
- [ ] Blocked hard, light and dark: no temporary allow; emergency valve remains visible as `btn-error btn-soft`.
- [ ] Soft overlay, light and dark: shadow DOM card uses bundled CSS and remains isolated from the page.
- [ ] Options, light and dark: content is centered at 720px max width; four dashboard stats stay in one stats row on desktop.
- [ ] Recommendations: rows are table/list-like, no giant cards, row height stays compact, category labels use soft badges.
- [ ] Additional themes: `focuswhale-ocean`, `focuswhale-mint`, `focuswhale-lavender`, and `focuswhale-coral` keep contrast and component structure intact.
