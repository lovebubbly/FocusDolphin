# FocusWhale

FocusWhale is a local-first Manifest V3 extension for Naver Whale and Chromium browsers. It creates bounded focus sessions, adds humane friction before distracting sites, and rewards completed focus with a growing whale companion.

The product is deliberately non-punitive: users choose the intensity, the hard-mode emergency valve remains available, pets never die or regress, and FocusWhale does not send browsing data to an external service.

## Release Status

The current source and production build identify as **version 1.0.0**. Goal 8 executable commit `5029d2a924cc14b5175fe1da1f4f9a2fcf274fb8` is a technically verified branch candidate, not a claim of store publication.

Choi Yunseong approved the complete Goal 8 Phase A visual contract at exact commit `e7274a1` on 2026-07-11, with no exceptions. Phase B implements that contract across Session, Rules, Review, Preferences, blocked, overlay, onboarding, and completion states while retaining the existing MV3, wellness, privacy, and storage contracts.

Verified on the frozen 2026-07-12 Goal 8 production bundle:

- `npm run build`: pass, including the two-stage extension/content build and release verifier.
- `npm run typecheck`: pass.
- `npm test`: pass, **33 test files / 250 tests**.
- `assets/content.js`: classic IIFE, **194,791 bytes**, SHA-256 `1e61912aa791d63278fa79a8233ef5118c537e302e0c73d3f2948dc9f515b2df`.
- `assets/background.js`: **42,956 bytes**, SHA-256 `172ca0d895958575048e022f1ef3051fb76d46b74ff1efe1ba80c731ab6f1d0e`.
- `assets/popup.js`: **25,240 bytes**, SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`.
- Production output has no source maps, root-relative asset URLs, or unexpected external network URLs; the manifest exposes exactly four allowlisted web resources.
- English and Korean locale catalogs contain the same **530 message keys**, with placeholder parity and production-reference coverage.
- Authored production surface CSS is **115 lines**; raw colors are confined to the daisyUI theme declarations.
- Pretendard Variable and its SIL Open Font License remain packaged locally.

The comprehensive visible Naver Whale 4.38 / Chromium 148 popup/onboarding suite passed **161/161** assertions against the same unchanged background and UI system, including true hard-session completion, `+37 XP`, session-associated first-session/first-hard badges, keyboard access, light/dark representatives, reduced motion, and zero page/request errors. Final review then changed only popup milestone batching; the rebuilt final popup hash passed a separate **32/32** exact headed regression with five associated milestones, truthful deferred count, two keyboard acknowledgement screens, reload persistence, and the standard two-milestone case. Review, Rules at desktop and 390 px, Preferences permission behavior, active-session locking, modal focus restoration, light/dark/reduced-motion representatives, and truthful local metrics passed with zero extension diagnostics. Korean medium/hard/overlay QA passed live `x.com` aliases, the real 30-second gate and five-minute allow, both hard safe exits, pending/weekly bounds, Shadow DOM isolation, keyboard/inert/focus restoration, session ownership, and clean zero-session/zero-DNR teardown. The exact evidence boundary is in [QA.md](QA.md).

The old `release/FocusWhale-1.0.0.zip` and existing store imagery predate Goal 8. They are historical artifacts and must not be submitted or relabeled as this candidate. Publication still requires a clean-checkout rebuild of the selected executable commit, a regenerated and rescanned archive, an extracted-archive critical-flow smoke, refreshed store imagery, product-owner approval of the exact package/listing/disclosures, publisher upload, and store review.

Goal 5 opt-in LLM analysis remains intentionally out of scope and is not a v1.0.0 publication blocker.

## Features

- Goal 8 job-oriented UI: Session in the toolbar popup, Rules and Review in Options, and secondary Preferences.
- Product-owner-approved dark-first/light-parity visual system with the whale as the only expressive color focus, one dominant action per state, and no copied third-party branding, scores, navigation, or mobile-only claims.
- Session-first popup with a duration stepper, target summary, explicit intensity choice, radial active timer, immutable target/mode/source facts, two-step hard emergency control, and post-session growth acknowledgement.
- Rules as a compact projection of existing schedules and target lists, with focused editors and the same service-worker-owned active-session lock.
- Locally truthful Review with current-week focus, completed sessions, attempts, temporary access, eight-week recorded focus, attempted domains/categories, whale growth, and timestamp-derived latest badges.
- Manual and scheduled focus sessions.
- Install-only, three-step onboarding with a versioned local completion record, skip/setup-only outcomes, an optional first 25-minute session, and an Options replay action.
- Korean and English UI across onboarding, popup, Options, blocked page, soft overlay, pet stages, badges, growth copy, defaults, errors, and manifest metadata. Unsupported browser locales fall back to English.
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
- DNR updates filter removal requests to rules that currently exist and skip empty updates, avoiding unnecessary browser API calls without changing rule ownership or matching behavior.

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
- `chrome.storage.local`: active/past sessions, intent text, daily stats, recommendations, category overrides, temporary allows, emergency usage, growth records, ledgers, acknowledgements, recovery journals, and the versioned onboarding completion timestamp/outcome.
- Raw history URLs and visit records are processed in memory and are not persisted by FocusWhale. Thirty-day metrics use actual `history.getVisits` timestamps rather than lifetime URL counters. Stored recommendations contain domains and aggregate features, not titles, paths, queries, or visit timestamps.

Retention and deletion:

- Session logs and per-session ledgers keep at most 5,000 entries.
- Medium-mode intent entries keep at most 200 entries.
- Daily statistics retain 400 days.
- Growth events and celebration acknowledgements keep at most 500 records; pending celebrations remain until acknowledged.
- Temporary allows expire; transaction journals are removed after successful recovery.
- Options provides localized history-permission revoke and local-data clear controls. Local clearing is rejected while a session is active and preserves sync-backed lists, schedules, settings, and pet progress. It also preserves the current week's emergency-use allowance and any still-active schedule-occurrence suppression so clearing records cannot bypass either commitment rule. The local onboarding completion record is cleared; clearing does not itself reopen onboarding, and the flow remains manually replayable from Options.
- Removing the extension/browser sync data remains the path to clearing sync-backed fields.

Do not enter confidential or identifying information in the medium-mode intent field; it is local, but retained until capped out or cleared.

## UI And Assets

Production UI uses Tailwind CSS 4, daisyUI 5, and locally bundled Pretendard Variable. The supported production themes are the default light theme and `focuswhale-dark`.

Goal 8 keeps the compatible `focuswhale` and `focuswhale-dark` theme identifiers while making semantic theme variables authoritative for color, spacing, borders, and shadows. Authored production surface CSS is limited to 115 lines across the shared app/overlay entries and four one-line page imports. Raw colors are confined to the daisyUI theme declarations.

The extension chooses Korean for Korean browser UI language tags and English otherwise. Chrome/Whale `chrome.i18n` messages are preferred when their runtime catalog agrees with the requested UI language; the bundled matching catalog is used when a Whale profile reports a stale/mismatched runtime catalog. Product-authored defaults are translated, while user-authored pet names, list names, domains, schedules, and intent text are preserved verbatim.

The files directly under `mockups/` are archived Goal 6 references. The separately versioned [Goal 8 mockups](mockups/goal-8/README.md) are the approved structural contract for the current redesign: Choi Yunseong approved exact commit `e7274a1` on 2026-07-11 for all presented states with no exceptions. Mockup approval still does not substitute for live extension QA or store-publication approval.

## Architecture

```text
src/
  background/      MV3 service worker, sessions, schedules, DNR, recovery
  content/         classic-IIFE soft overlay and active-tab enforcement
  pages/
    onboarding/     install-only setup, first-session choice and replay
    popup/         session controls, active state, pet and completion overview
    options/       lists, schedules, analytics, privacy controls, pet details
    blocked/       medium/hard friction and safe return flow
  analytics/       local history aggregation and recommendation scoring
  pet/             XP, streaks, badges, growth events, renderer and recovery
  shared/          contracts, storage, messaging, localization and gamification helpers
  styles/          Tailwind/daisyUI themes and compiled UI styles
```

The build deliberately has two stages:

1. `vite.config.ts` builds the module service worker and extension pages into a clean `dist/`.
2. `vite.content.config.ts` appends `assets/content.js` as a single classic IIFE, because MV3 manifest content scripts cannot depend on ESM imports.
3. `scripts/verify-build.mjs` validates manifest and onboarding/locale targets, English manifest localization defaults, the exact four-resource WAR allowlist, content-script format/size, the packaged font license, absence of source maps, and absence of unexpected external URLs.

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
- [docs/GOAL_8_HANDOFF_2026-07-12.md](docs/GOAL_8_HANDOFF_2026-07-12.md): approved redesign boundary, production mapping, exact-current evidence, and release next steps.
- [docs/NOTION_ISSUE_TRIAGE.md](docs/NOTION_ISSUE_TRIAGE.md): current resolution of the Notion issue list.
- [docs/TECHNICAL_QA_EVIDENCE_2026-07-11.md](docs/TECHNICAL_QA_EVIDENCE_2026-07-11.md): sanitized exact-build alarm, restart, history-concurrency, and recovery-journal evidence.
- [store/README.md](store/README.md): selected-store strategy, listing copy, disclosures, reviewer instructions, and owner-only submission steps.
- [DECISIONS.md](DECISIONS.md): durable product and engineering decisions.
- [CHANGELOG.md](CHANGELOG.md): v1.0.0 release-candidate changes.

## Packaging And Publication

The existing `release/FocusWhale-1.0.0.zip` and current store imagery were produced before Goal 8 and are historical artifacts, not the package described by the current branch. Do not upload or relabel that ZIP as the Goal 8 candidate. After the Goal 8 executable commit is selected, rebuild from a clean checkout, regenerate the archive, repeat byte-equality/privacy/dependency scans, refresh the core-flow screenshots, load the extracted archive in a clean ordinary Whale profile, and record the new hash. [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) remains the public support/privacy channel, and [the repository privacy policy](https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md) was publicly verified on 2026-07-11.

The repository is publicly viewable but **all rights are reserved** under [LICENSE](LICENSE); no open-source license is granted for FocusWhale's original work. Pretendard remains under SIL OFL; Tailwind CSS, daisyUI, and the Vite core runtime retain their MIT notices in the shipped `licenses/` directory; generated sprite provenance is recorded separately.

## Documentation Provenance

- Product owner and repository maintainer: **Choi Yunseong (최윤성)** (`Yunseong Choi` in Git history).
- Goal 8 production and documentation were prepared by **OpenAI Codex (GPT-5)** at Choi Yunseong's request and last refreshed on **2026-07-12 KST**.
- Goal 8 Phase A was approved by **Choi Yunseong** on **2026-07-11** against exact commit `e7274a1`, for all presented states with no exceptions.
- Evidence comes from the local repository, automated gates, exact rebuilt-bundle Whale journeys recorded in `QA.md`, and retained historical baselines; mockup approval, technical verification, final package approval, and publication remain distinct labels.
- Code authorship remains defined by Git history. Documentation attribution does not imply product-owner approval of every Codex assessment.
