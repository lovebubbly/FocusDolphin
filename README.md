# FocusWhale

FocusWhale is a local-first Manifest V3 extension for Naver Whale and Chromium browsers. It creates bounded focus sessions, adds humane friction before distracting sites, and rewards completed focus with a growing whale companion.

The product is deliberately non-punitive: users choose the intensity, the hard-mode emergency valve remains available, pets never die or regress, and FocusWhale does not send browsing data to an external service.

## Release Status

The current source and production build identify as **version 1.0.0**. This is a local release candidate, not a claim of store publication.

Verified on the 2026-07-11 02:29 KST release-candidate tree:

- `npm run typecheck`: pass.
- `npm test`: pass, **30 test files / 196 tests**.
- `npm run build`: pass, including the two-stage extension/content build and release verifier.
- `assets/content.js`: classic IIFE, **116,276 bytes**; no module imports/exports.
- Production output: no source maps and no unexpected external network URLs.
- Manifest web-accessible resources: exactly four allowlisted files.
- Pretendard Variable and its SIL Open Font License are packaged locally.

The rebuilt bundle passed the isolated Whale 4.38 core matrix for soft, medium, hard, popup emergency, Options, all 20 pet states, adversarial `x.com.`, pre-deadline and overdue browser-process restart, simultaneous natural/emergency alarms, active-session sync restoration, next-occurrence schedule recovery, and clean-profile extracted-archive loading. Exact headed Whale checks additionally passed completion dismissal across list rerenders, blank-intent rejection, Options keyboard/modal focus, normal and reduced-motion completion, and a 13-state visual matrix with 68 contrast checks (minimum 4.94:1), 40 px minimum targets, 19 screenshots, and no page errors. Explicitly labeled instrumented exact-build checks replaced the MV3 worker at both durable journal boundaries and held a history callback for five seconds while the due session was first observed complete 23 ms after its deadline and a later local clear rejected the stale result. Headed Chrome for Testing 147 accepted the real optional-history prompt, showed controlled domain-only results with extension URLs excluded, revoked the permission, and then started a medium session successfully. See [QA.md](QA.md) for the exact evidence boundary.

Still pending before publication:

- Enter the verified public privacy-policy and support URLs in the Whale publisher submission.
- Record product-owner approval of the prepared store copy, disclosures, and exact-build imagery.
- Upload the exact package to the selected store and complete its review process.

Goal 5 opt-in LLM analysis remains intentionally out of scope and is not a v1.0.0 publication blocker.

## Features

- Manual and scheduled focus sessions.
- User-selected `soft`, `medium`, or `hard` intensity; never automatically escalated.
- Blocklist and allowlist site modes.
- DNR-based main-frame redirects for medium/hard sessions.
- Shadow-DOM soft overlay for soft sessions.
- Medium-mode countdown, required intent entry, and five-minute temporary allow.
- Two-step hard-mode emergency end, delayed five minutes and limited to one request per local week.
- Exact scheduled-session deadlines and abort suppression so an emergency-ended occurrence does not restart until its true schedule window has passed.
- Popup, options, blocked page, and soft overlay with active-session state updates.
- Pet XP v2, five non-regressing stages, streak forgiveness, additive badges, and post-session growth overview.
- Four pet moods: `idle`, `happy`, `focus`, and `celebrate`.
- Local dashboard statistics and optional domain-only browser-history recommendations.
- History analysis computes off the session-operation queue so long scans cannot delay alarms; the final write re-enters the queue and is discarded if local data was cleared meanwhile.
- Local data deletion and optional-history permission revocation from Options.

## Wellness Rules

- No automatic intensity escalation.
- No shame, guilt, punishment, pet death, sickness, or regression.
- Hard mode always retains an emergency valve.
- XP is not a persistent pressure HUD; it appears in the post-session overview and user-opened growth details.
- Recommendations never auto-block a domain.
- Browsing analysis stays on-device and reduces history to domain-level summaries.

## Session Modes

### Soft

The page is not redirected. A compiled, isolated shadow-DOM overlay presents a short pause, an immediate return-to-focus action, and a delayed continue action.

### Medium

Matching main-frame navigation redirects to the extension blocked page. The original destination is carried in the URL fragment after removing credentials, query parameters, and fragments. After the countdown and a non-empty intent entry, a five-minute temporary allow can return to that sanitized HTTP(S) destination.

### Hard

Matching navigation redirects to the blocked page without a temporary allow. Emergency end requires an initial request, a second confirmation, and a five-minute delay. Only one unique hard-session emergency request is accepted per local week; repeats for the same pending session are idempotent.

## Pet System

Completed sessions grant XP once:

```text
XP = floor(completed_minutes * intensity_multiplier)
soft = 1.0, medium = 1.2, hard = 1.5
```

Stages begin at `0`, `100`, `600`, `2,000`, and `6,000` XP. Stage 4 is a star-marked adult whale, replacing the earlier clipped crown treatment.

The production atlas is [assets/sprites/focuswhale-atlas.png](assets/sprites/focuswhale-atlas.png): **384 x 1,920**, four columns by twenty rows, 96 px frames, eighty validated frames. Rows represent five stages across four moods (`idle`, `happy`, `focus`, `celebrate`). Source, assembly, validation, and asset-license notes are in [assets/sprites/LICENSE.md](assets/sprites/LICENSE.md).

Growth settlement is service-worker owned and idempotent. Per-session ledgers and recovery journals prevent duplicate XP, preserve newer synced progress during stale-journal recovery, and resume interrupted writes. See [docs/GAMIFICATION_V2.md](docs/GAMIFICATION_V2.md).

## Privacy And Data

FocusWhale has no backend, telemetry SDK, advertising SDK, remote AI integration, API keys, or external asset loads. The repository policy is [PRIVACY.md](PRIVACY.md); the release checklist records when its public URL has been verified.

The mandatory manifest permissions are `declarativeNetRequest`, `storage`, and `alarms`. Browser history is an **optional permission** requested only when the user starts recommendation analysis. HTTP(S) host access supports session redirects, already-open-tab handling, and soft overlays.

Storage summary:

- `chrome.storage.sync`: settings, site lists, schedules, pet state. Browser-account sync may transmit these fields through the browser vendor when enabled.
- `chrome.storage.local`: active/past sessions, intent text, daily stats, recommendations, category overrides, temporary allows, emergency usage, growth records, ledgers, acknowledgements, and recovery journals.
- Raw history URLs and visit records are processed in memory and are not persisted by FocusWhale. Thirty-day metrics use actual `history.getVisits` timestamps rather than lifetime URL counters. Stored recommendations contain domains and aggregate features, not titles, paths, queries, or visit timestamps.

Retention and deletion:

- Session logs and per-session ledgers keep at most 5,000 entries.
- Medium-mode intent entries keep at most 200 entries.
- Daily statistics retain 400 days.
- Growth events and celebration acknowledgements keep at most 500 records; pending celebrations remain until acknowledged.
- Temporary allows expire; transaction journals are removed after successful recovery.
- Options provides `방문 기록 권한 해제` and `로컬 기록 지우기`. Local clearing is rejected while a session is active and preserves sync-backed lists, schedules, settings, and pet progress. It also preserves the current week's emergency-use allowance and any still-active schedule-occurrence suppression so clearing records cannot bypass either commitment rule.
- Removing the extension/browser sync data remains the path to clearing sync-backed fields.

Do not enter confidential or identifying information in the medium-mode intent field; it is local, but retained until capped out or cleared.

## UI And Assets

Production UI uses Tailwind CSS 4, daisyUI 5, and locally bundled Pretendard Variable. The supported production themes are the default light theme and `focuswhale-dark`.

The files under `mockups/` are archived Goal 6 Phase-A design references. They document the approved direction but are **not** the current production DOM contract or a substitute for live extension QA.

## Architecture

```text
src/
  background/      MV3 service worker, sessions, schedules, DNR, recovery
  content/         classic-IIFE soft overlay and active-tab enforcement
  pages/
    popup/         session controls, active state, pet and completion overview
    options/       lists, schedules, analytics, privacy controls, pet details
    blocked/       medium/hard friction and safe return flow
  analytics/       local history aggregation and recommendation scoring
  pet/             XP, streaks, badges, growth events, renderer and recovery
  shared/          contracts, storage, messaging and gamification helpers
  styles/          Tailwind/daisyUI themes and compiled UI styles
```

The build deliberately has two stages:

1. `vite.config.ts` builds the module service worker and extension pages into a clean `dist/`.
2. `vite.content.config.ts` appends `assets/content.js` as a single classic IIFE, because MV3 manifest content scripts cannot depend on ESM imports.
3. `scripts/verify-build.mjs` validates manifest targets, the exact four-resource WAR allowlist, content-script format/size, the packaged font license, absence of source maps, and absence of unexpected external URLs.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

Load the result:

1. Open `whale://extensions` or `chrome://extensions`.
2. Enable developer mode.
3. Choose **Load unpacked** and select `dist/`.
4. Rebuild and reload the extension after source changes.

The live Whale development extension used for final-candidate checks had ID `ojojphoncmkplfcinppanpbbhhfjcpgi`. Extension IDs can change with a different unpacked profile/key and must not be hard-coded.

## Verification Guides

- [QA.md](QA.md): evidence ledger and final manual matrix.
- [SMOKE_TEST.md](SMOKE_TEST.md): reproducible DNR, alarm, storage, and surface checks.
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md): publication gate and remaining work.
- [docs/SOL_HANDOFF.md](docs/SOL_HANDOFF.md): architecture, risk, and successor handoff.
- [docs/NOTION_ISSUE_TRIAGE.md](docs/NOTION_ISSUE_TRIAGE.md): current resolution of the Notion issue list.
- [docs/TECHNICAL_QA_EVIDENCE_2026-07-11.md](docs/TECHNICAL_QA_EVIDENCE_2026-07-11.md): sanitized exact-build alarm, restart, history-concurrency, and recovery-journal evidence.
- [store/README.md](store/README.md): selected-store strategy, listing copy, disclosures, reviewer instructions, and owner-only submission steps.
- [DECISIONS.md](DECISIONS.md): durable product and engineering decisions.
- [CHANGELOG.md](CHANGELOG.md): v1.0.0 release-candidate changes.

## Packaging And Publication

Version 1.0.0 is packaged at `release/FocusWhale-1.0.0.zip` (**2,694,409 bytes**, SHA-256 `241a9863fde194a20d1f0f54dc1a7377bf9314dd40413e5fd1488dab52c97f18`). Its checksum passes; the 33-entry/25-file extracted tree is byte-for-byte equal to the exact current `dist/`; and a clean visible Whale 4.38 profile loaded the extracted copy as extension ID `ejhfobkhmdabjhobogffeineggppeafj`, rendered the popup with no page console errors, and opened the packaged third-party notice. The executable payload remains byte-identical to the fully tested release candidate; the only package addition is `licenses/THIRD-PARTY-NOTICES.txt`. The archive token/path/email scan found no findings. This is still not a store-submitted release. The exact package is selected for a Whale Store first submission. Paste-ready listing, permission, privacy, reviewer, and release-note materials are under [store/](store/); exact-build listing images are under `store-assets/`. [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) is the public support/privacy channel, and [the repository privacy policy](https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md) was publicly verified on 2026-07-11. Before public release, complete every remaining owner/store item in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and obtain owner sign-off.

The repository is publicly viewable but **all rights are reserved** under [LICENSE](LICENSE); no open-source license is granted for FocusWhale's original work. Pretendard remains under SIL OFL; Tailwind CSS, daisyUI, and the Vite core runtime retain their MIT notices in the shipped `licenses/` directory; generated sprite provenance is recorded separately.

## Documentation Provenance

- Product owner and repository maintainer: **Choi Yunseong (최윤성)** (`Yunseong Choi` in Git history).
- This release/handoff and store-preparation refresh was prepared by **OpenAI Codex (GPT-5)**, at Choi Yunseong's request and last refreshed on **2026-07-11 10:17 KST**.
- Evidence comes from the local repository, current automated gates, and exact-build disposable-profile browser runs recorded in `QA.md`; owner and publication checks remain labeled explicitly.
- Code authorship remains defined by Git history. Documentation attribution does not imply product-owner approval of every Codex assessment.
