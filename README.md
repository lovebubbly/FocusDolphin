# FocusWhale

FocusWhale is a local-first Manifest V3 browser extension for Naver Whale and Chromium browsers. It helps you start bounded focus sessions, add humane friction before distracting sites, and reward completed focus with a small whale companion.

The project is intentionally not a punishment system. It keeps autonomy visible: the user chooses the session strength, the pet never dies or regresses, and browsing data is not sent to an external server.

## Status

Current implementation status: MVP complete for local development.

- Manifest V3 extension scaffold with Vite and strict TypeScript
- Declarative Net Request based blocking and redirects
- Manual focus sessions and scheduled sessions
- `soft`, `medium`, and `hard` session intensity modes
- Blocklist and allowlist modes
- Temporary allow flow for medium sessions
- Emergency end valve for hard sessions
- Popup, options page, blocked page, and soft overlay
- Pet XP, stages, streaks, streak freezes, and badges
- Local history aggregation and domain-level recommendations
- daisyUI/Tailwind UI redesign with light, dark, and extra color themes
- Character-based extension toolbar icons

Not implemented yet:

- Goal 5 LLM analysis. This is intentionally reserved for a later opt-in version.
- Store packaging and Chrome Web Store / Whale distribution review.
- Full manual QA matrix across every Whale/browser restart scenario.

## Product Principles

FocusWhale follows a few non-negotiable wellness rules.

- No automatic intensity escalation.
- No shame, guilt, punishment, pet death, or pet regression copy.
- Hard mode keeps an emergency valve.
- XP is not shown as a constant pressure loop.
- Recommendations are suggestions only; domains are never auto-blocked.
- Browsing history analysis stays local and works on domain-level data.

## Session Modes

### Soft

Soft mode does not hard-block the page. Instead, it injects a shadow DOM overlay with a short countdown and an immediate `go back` action. This is for gentle interruption and awareness.

### Medium

Medium mode redirects matching navigation to the FocusWhale blocked page. The user can request a temporary allow after a countdown and a short intent entry. Temporary allows expire automatically.

### Hard

Hard mode redirects matching navigation and does not offer a temporary allow. It still keeps an emergency end request, because the extension is a self-control tool rather than a trap.

## Site Lists

FocusWhale supports two list modes.

- `blocklist`: block only the listed domains during a session.
- `allowlist`: allow only the listed domains during a session and redirect everything else.

Domain matching is normalized and handled through Declarative Net Request dynamic rules. The allowlist implementation uses higher-priority allow rules over a catch-all redirect rule.

## Pet System

The pet system rewards completed focus without punishment.

- Completed sessions grant XP.
- XP advances the whale through stages.
- Streaks record recent focus continuity.
- Streak freezes provide a forgiveness mechanism.
- Badges are additive only.
- Missed sessions do not harm or kill the pet.

The runtime sprite atlas is stored in `assets/sprites/focuswhale-atlas.png`, with source and license notes in `assets/sprites/LICENSE.md`.

## Analytics And Recommendations

The options page can analyze local browsing history to produce domain-level recommendations.

FocusWhale does not display page titles, raw URLs, or timestamps in the recommendation list. Candidates are shown as compact rows with domain, category, visit count, and a manual `block` action.

Recommendations are stored locally and only become blocklist entries after explicit user approval.

## Privacy

FocusWhale is designed as a local-first extension.

- No backend service is configured.
- No telemetry endpoint is configured.
- No API keys or tokens are required.
- History analysis runs in the extension using browser history permission.
- Domain recommendations are domain-only and avoid raw URL/title/timestamp display.
- Settings, lists, schedules, and pet state use Chrome/Whale extension storage.

Note: `chrome.storage.sync` may sync extension configuration through the browser account if browser sync is enabled. Browsing history records themselves are not uploaded by FocusWhale.

## Permissions

The manifest currently requests:

- `declarativeNetRequest`: install dynamic redirect and allow rules.
- `storage`: persist settings, sessions, pet state, and local stats.
- `alarms`: end sessions, expire temp allows, and reconcile schedules.
- `history`: build local domain-level recommendations.
- `tabs`: support blocked-page navigation behavior.
- `<all_urls>` host permissions: apply rules and soft overlays across user-selected sites.

## UI

The production UI uses Tailwind CSS 4, daisyUI 5, and a local Pretendard Variable font bundle.

Implemented surfaces:

- Popup idle state
- Popup active session state
- Options page
- Blocked page
- Soft overlay
- Static mockups in `mockups/`

Themes:

- `focuswhale`
- `focuswhale-dark`
- `focuswhale-ocean`
- `focuswhale-mint`
- `focuswhale-lavender`
- `focuswhale-coral`

## Architecture

```text
src/
  background/      MV3 service worker, sessions, schedules, DNR rules
  content/         soft overlay injection and navigation hooks
  pages/
    popup/         session start and pet status UI
    options/       settings, lists, schedules, analytics, recommendations
    blocked/       redirect target and medium/hard flows
  analytics/       local history aggregation and recommendation scoring
  pet/             pet state, XP settlement, streaks, badges, renderer
  shared/          shared types, storage wrapper, messaging, XP helpers
  styles/          Tailwind/daisyUI app and overlay CSS entries
```

Build inputs are configured in `vite.config.ts`. The extension manifest lives in `public/manifest.json`.

## Development

Install dependencies:

```sh
npm install
```

Run the required checks:

```sh
npm run build
npm run typecheck
npm test
```

The test suite currently covers background rules/sessions/schedules, shared storage and XP helpers, pet rewards/streaks/badges, local analytics, history recommendation flow, and options model behavior.

## Load In Whale Or Chrome

1. Run `npm run build`.
2. Open `whale://extensions` or `chrome://extensions`.
3. Enable developer mode.
4. Choose `Load unpacked`.
5. Select the generated `dist/` directory.
6. Pin the extension if you want the whale toolbar icon visible.

When updating local code, rebuild and reload the unpacked extension.

## Manual QA

Automated checks are necessary but not enough for browser extensions. Use:

- `SMOKE_TEST.md` for DNR, alarms, storage, history, and basic Whale smoke flows.
- `QA.md` for schedule, hard allowlist, recommendation, restart restore, and streak freeze scenarios.

Already recorded smoke coverage includes popup render, a medium session, DNR redirect to the blocked page, completion cleanup, options render, and local history recommendations.

## Security Scan Notes

Before publishing, the tracked repository was scanned for common secret patterns:

- AWS access keys
- OpenAI-style API keys
- GitHub tokens
- Google API keys
- Slack tokens
- JWT-like tokens
- private key blocks
- obvious `apiKey`, `token`, `secret`, and `password` assignments

Result at the time of this README update: no tracked secrets were found. An additional scan for private Notion/profile strings and common API key environment names also returned no matches in tracked files.

## Repository Hygiene

Generated dependencies and build outputs are ignored:

- `node_modules/`
- `dist/`
- `coverage/`
- `.worktrees/`
- local `.env*` files
- private key material such as `*.pem`, `*.key`, and `*.p12`

Do not commit unpacked browser profiles, local extension state, real browsing exports, or screenshots containing personal browser data.

## Known Limitations

- A user can still disable or remove the extension. This is a browser-extension limitation and an explicit product assumption.
- Whale compatibility can differ from Chrome despite Chromium support; keep using the Whale smoke checklist.
- The project is not packaged for store distribution yet.
- The current LLM analysis goal is not implemented.

## License And Assets

The generated whale sprite and extension icons are project assets. Sprite generation and processing notes are recorded in `assets/sprites/LICENSE.md`.

Pretendard Variable is bundled locally under `assets/fonts/` with its SIL Open Font License text in `assets/fonts/Pretendard-LICENSE.txt`.

No top-level open-source license has been selected yet.
