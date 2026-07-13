# Focus Dolphin Smoke Test

Documentation refresh: **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)**, **2026-07-13 KST**.

Use the extracted, checksum-verified release ZIP in a dedicated Naver Whale or Chromium profile. Loading `dist/` remains useful during development, but it is not release-artifact evidence.

This checklist targets **Focus Dolphin — Website Blocker** after its pre-release rename from the unreleased `FocusWhale` development codename. Phase A commit `e7274a1` was approved by Choi Yunseong on 2026-07-11 for every presented state, with no exceptions, but that approval predates the dolphin identity. It remains structural history and does not replace renamed executable, package, visual, or publication verification.

## Preconditions

```sh
npm run typecheck
npm test
npm run build
```

Historical expected result for the frozen pre-rename Goal 8 candidate: 33 test files / 250 tests; 42,956-byte `assets/background.js` with SHA-256 `172ca0d895958575048e022f1ef3051fb76d46b74ff1efe1ba80c731ab6f1d0e`; 25,240-byte `assets/popup.js` with SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`; classic `assets/content.js` at 194,791 bytes with SHA-256 `1e61912aa791d63278fa79a8233ef5118c537e302e0c73d3f2948dc9f515b2df`; 11 verified manifest targets; exact four-resource WAR allowlist; no source maps, root-relative asset URLs, or unexpected external URLs; packaged Pretendard license; onboarding page; 530-key English/Korean catalogs; 115 authored production surface CSS lines; and raw colors only in theme declarations. Record fresh counts and hashes for the integrated Focus Dolphin build rather than copying these values.

Current release artifact boundary: commit `09d7e26`, `release/focus-dolphin-1.0.0.zip`, **3,715,534 bytes / 31 entries / SHA-256 `9477352d13105d1176c3cf540550b5a0252cbb2422528d92b943820bba1f5048`**. The clean-checkout rebuild is byte-identical. Historical FocusWhale archives remain development evidence only.

## 2026-07-13 Exact-package result

- Chrome for Testing comprehensive suite: **PASS**, 13 end-to-end steps, including exact duration, Options lock, real `x.com` DNR/friction, growth settlement, hard confirmation, overlay, diagnostics, and cleanup.
- Ordinary Naver Whale 4.38 / Chromium 148 direct-CDP suite: **PASS** in 52.6 seconds against the same extracted tree and ZIP hash.
- English/Korean onboarding and popup layout: **PASS** in Whale and Chrome for Testing at 1280 x 800 and 720 x 820 with no overflow, undersized controls, missing atlas, or serious diagnostics.
- Evidence paths are recorded in `QA.md`. The ordinary-Whale suite ended with no active session, pending emergency, temporary allow, DNR rule, or alarm.

## Goal 8 Pre-Rename Exact-Build Matrix (Historical)

Environment: visible Naver Whale 4.38.386.14 / Chromium 148, isolated disposable profiles, frozen rebuilt `dist/`, development-path extension ID `ojojphoncmkplfcinppanpbbhhfjcpgi`. Every suite checked the background fingerprint above. Local evidence is under ignored `output/goal-8-final/`; profiles and CDP ports were cleaned after use.

These passes establish behavior for unchanged core flows but do not verify the Focus Dolphin name, dolphin atlas, icons, localized animal copy, or renamed ZIP. Repeat every mascot/name-bearing row against the extracted Focus Dolphin archive before publication.

| Surface / behavior | Result | Exact evidence boundary |
| --- | --- | --- |
| Onboarding Steps 1-3, completion, persistence, replay, keyboard, 128/160 px pets | PASS | English; light/dark and reduced-motion representatives; no optional-history request |
| Popup idle at 360 x 580, medium start, hard upgrade, hard confirmation/pending | PASS | English; 161/161 popup/onboarding assertions; zero page/request errors |
| True 25-minute hard completion and growth acknowledgement | PASS | +37 XP once; First Ripple and First Deep Dive tied to the session; final popup 32/32 regression preserves extra milestones across two acknowledgement screens and reload |
| Review empty/populated, truthful stats, growth and latest badge | PASS | English; seeded storage matched visible output; 128/160 px pets |
| Rules desktop/390 px, editors, modal keyboard/focus, active lock | PASS | English; no mid-word break or overflow; background inert during modal |
| Preferences optional-history status | PASS | English; no permission prompt on load; Revoke disabled when absent |
| Blocked medium/hard and soft overlay | PASS | Korean exact headed suite: live aliases, real 30-second medium gate/allow, hard long clock/safe exits/pending/weekly bound, overlay isolation/focus/inert/session ownership, theme/motion representatives, zero extension errors |
| Local-only/static network boundary | PASS | Build verifier plus zero failed requests/extension diagnostics in completed exact suites |

## Goal 7 First-Run And Localization (Historical)

### First Install, Completion, And Replay

Run once with an English browser UI and once with a Korean browser UI, each in a fresh disposable profile:

1. Load the newly rebuilt `dist/` unpacked.
2. Confirm onboarding opens on the install event and does not request `history` permission.
3. Inspect all three steps: local-first pet/privacy introduction, editable blocklist, and explicit intensity choice with optional 25-minute session.
4. Confirm `soft` is selected by default and no intensity is automatically increased.
5. Confirm the hard-session emergency note applies only to hard sessions.
6. Finish without starting a session and inspect `chrome.storage.local.get("focuswhaleOnboarding")`.
7. Expected: `{ version: 1, completedAt: <positive timestamp>, outcome: "setup_only" }`.
8. Close and reopen the same unpacked profile. Onboarding must not open again.
9. Open Options and activate the onboarding replay action. Expected URL ends with `src/pages/onboarding/index.html?replay=1`.
10. Confirm replay does not clear or masquerade as a new install completion.

Current evidence:

| Check | English | Korean |
| --- | --- | --- |
| First-install onboarding | HEADED EXACT PASS | HEADED EXACT PASS |
| Three-step layout/copy/pet | HEADED EXACT PASS | HEADED EXACT PASS |
| Completion persistence | HEADED EXACT PASS | HEADED EXACT PASS (`setup_only`) |
| Once-only reopen guard | HEADED EXACT PASS | HEADED EXACT PASS |
| Options replay action | HEADED EXACT PASS | HEADED UI PASS; shared launch path automated |
| Optional history not requested | HEADED EXACT PASS | HEADED EXACT PASS |

### Surface Localization Matrix

Inspect document language, visible copy, product-owned default names, pet sprite, focus order, console, and horizontal overflow. User-authored pet/list names must remain unchanged.

| Surface | English | Korean | Publication status |
| --- | --- | --- | --- |
| Onboarding steps 1-3 | PASS | PASS | No key leak, unexpected English/Hangul crossover, overflow, or console error observed |
| Popup idle at 360 x 600 | PASS | PASS | Default product names localized; pet and CTA visible |
| Options activity + replay entry | PASS | PASS | No key leak or horizontal overflow observed |
| Blocked page without active session | PENDING | PASS | Repeat English and all active-session states in a normal browser |
| Blocked medium/hard | PENDING | PENDING | Requires a current normal-browser session-start pass |
| Soft overlay | PENDING | PENDING | Requires a current normal-browser session-start pass |
| Completion overview | PENDING | PENDING | Requires a current normal-browser session-start/completion pass |

### Locale Contract And Offline Assets

1. Confirm `manifest.json` has `default_locale: "en"` and uses `__MSG_appName__` / `__MSG_appDescription__`; the action title must also be localized.
2. Confirm `_locales/en/messages.json` and `_locales/ko/messages.json` each contain the same 460 keys.
3. On Korean Whale, compare `chrome.i18n.getUILanguage()` and `chrome.i18n.getMessage("@@ui_locale")`.
4. If Whale reports `ko-KR` but exposes `en_US` as the runtime catalog, confirm the bundled fallback still renders Korean. This mismatch was reproduced and passed in the current headed Whale run.
5. Search every visible state for raw message-key identifiers and stale hard-coded source-language copy.
6. Confirm production output contains no external CSS, font, sprite, catalog, analytics, or other network URL. The build verifier passes this static check; capture a live network log separately before publication.

### Known Harness Boundary

Playwright-launched Whale stalls at `chrome.alarms.create` during session start and consumes roughly 97-100% CPU. The same stall reproduces from pre-Goal-7 commit `acb45b6`, so it remains a harness limitation rather than an application regression. Direct raw CDP against an ordinary installed Whale process is the supported release path; that path now passes active popup, blocked, overlay, completion, and cleanup against the exact Focus Dolphin ZIP.

Do not record a Google Chrome Goal 7 smoke pass from the attempted run: browser URL policy blocked extension pages before the extension could be exercised.

## Service-Worker Checks

### DNR

1. Create a blocklist containing `x.com`.
2. Start a medium session.
3. In the service-worker console run:

```js
await chrome.declarativeNetRequest.getDynamicRules()
```

Expected:

- Session rules use IDs `1-999`, `main_frame`, and redirect actions.
- `x.com` and `twitter.com` aliases are both covered.
- Redirect substitution sends the HTTP(S) scheme, host, and path in the blocked-page fragment; userinfo, query, and source fragment are not retained.
- Temporary allow rules, when present, use IDs `1000-1999` with higher priority.

### Alarms

```js
await chrome.alarms.getAll()
```

Expected while applicable:

- `focuswhale:session-end` for an active session.
- `focuswhale:temp-allow:<domain>` for a medium temporary allow.
- `focuswhale:emergency-end` only after confirmed hard emergency scheduling.

These alarm names intentionally retain the unreleased development codename as compatibility identifiers. Do not rename them as part of public branding.

### Storage

```js
await chrome.storage.local.get(null)
await chrome.storage.sync.get(null)
```

Expected:

- Sync: settings, site lists, schedules, pet state.
- Local: active/past sessions, intent entries, daily stats, recommendations, temp allows, growth/ack records, ledgers, emergency use, schedule-occurrence suppression, and short-lived journals.
- Local onboarding: `focuswhaleOnboarding` with version, completion timestamp, and `skipped`, `setup_only`, or `session_started` outcome.
- Finalization/settlement journals disappear after successful recovery.
- No raw browser-history export, page title, or page body is persisted.

`focuswhaleOnboarding` intentionally remains a compatibility storage key; the public product name is Focus Dolphin.

## Surface Smoke Flows

### Popup Active

1. Start a medium session.
2. Reopen the popup.
3. Confirm countdown updates without the layout rerendering or stealing focus.
4. Confirm the `focus` pet is visible.
5. Open Options and confirm locked controls cannot mutate settings, lists, or schedules.

### `x.com` Medium Redirect

1. During the matching medium session, navigate to `https://focuswhale-user:focuswhale-pass@x.com./some/path?private=value#section` using dummy credentials only.
2. Confirm redirect to the extension blocked page.
3. Confirm remaining time, domain, focus pet, and medium actions render.
4. Choose `그래도 열기` / `Open anyway`.
5. Confirm the first wait is 30 seconds and blank intent cannot submit.
6. Enter a non-sensitive reason, wait for enablement, and request access.
7. Confirm the blocked return target is `https://x.com./some/path`: the path and trailing hostname dot remain, while credentials, query, and source fragment are absent. Then verify continue uses that sanitized HTTP(S) target.
8. After five minutes, confirm navigation blocks again.

### Return To Focus

1. From the blocked page, press the return-to-focus action.
2. Expected: deterministic navigation to `about:blank`; it must not expose or guess a prior tab-history entry.

### Hard Emergency

1. Start a hard session and visit a blocked site.
2. Confirm there is no temporary allow.
3. First emergency click must show confirmation only.
4. Cancel and verify no request was spent.
5. Confirm again and verify a five-minute pending countdown plus `pendingEmergency` storage/alarm.
6. Reload the blocked page; pending state must restore.
7. Verify a second unique hard-session request in the same local week is rejected.

For a hard session started by an active schedule:

1. Complete the same confirmed five-minute emergency flow.
2. Confirm the session ends without an immediate replacement session.
3. Confirm the session's `scheduleWindowEnd` and the resulting `scheduleSuppression.windowEnd` equal the exact schedule boundary, including when reconciliation began after a sub-minute offset.
4. Reconcile/reload inside the same window and confirm the occurrence stays suppressed.
5. Advance beyond the window and confirm suppression expires without blocking the next eligible occurrence.

### Soft Overlay

1. Start a soft session for a blocklisted domain.
2. Visit the domain.
3. Confirm the overlay renders in a shadow root with compiled local CSS/font and a visible focus pet.
4. Confirm the host page is inert while the overlay is active.
5. Confirm keyboard focus remains inside the overlay.
6. Test return-to-focus and delayed continue; confirm the host page restores afterward.

### Completion And Pet

1. Let a short session finish naturally.
2. Open the popup and confirm one completion overview.
3. Confirm awarded XP, count-up, progress, `celebrate` mood, and any milestones.
4. For a first 25-minute hard completion, confirm First Ripple and First Deep Dive carry the completed session ID and appear in the same acknowledgement batch.
5. Dismiss, toggle list mode, and reopen the popup.
6. Confirm the same overview does not return and XP/milestones did not duplicate.
7. In the pet fixture/options, inspect all five stages across `idle`, `happy`, `focus`, and `celebrate`.

### Optional History And Clear Controls

1. In Options, revoke `history` if already granted.
2. Confirm core focus controls still work.
3. Invoke recommendation analysis; only then should Whale request history permission.
4. Confirm result rows contain domain/category/visit aggregates only.
5. Revoke permission and confirm stored core configuration remains.
6. When idle, confirm `로컬 기록 지우기` / `Clear local activity`; local activity should clear while sync settings/lists/schedules/pet remain. The current week's emergency-use allowance and a still-active schedule suppression must also remain.
7. During a session, confirm the same clear request is rejected.
8. Start an analysis, allow an idle local clear to succeed before the result commits, and confirm the stale recommendation result is not written back. A due session alarm must remain responsive while analysis computes.

## Prior v1.0.0 Recorded Browser Evidence

The rows below were recorded for the prior v1.0.0 release executable. They remain useful regression evidence but do not prove the current onboarding/localization build.

Headless and headed checks used isolated disposable profiles. Naver Whale 4.38 / Chromium 148 used development-path extension ID `ojojphoncmkplfcinppanpbbhhfjcpgi`; Chrome for Testing 147 exercised the real optional-permission prompt.

- PASS: complete soft overlay shadow/font/pet/focus/inert/countdown/continue/back/reduced-motion/completion flow with no page errors.
- PASS: medium 0:30 friction, one temporary-allow transaction, sanitized continue, expiry/reblock, one completion log, and sequential reward acknowledgement.
- PASS: hard confirmation/cancel/pending/reload/weekly rejection and scheduled-occurrence suppression with exact boundary re-arm.
- PASS: popup emergency valve, Options validation/lock/name/request-denial flow, 20-state pet matrix, adversarial `x.com.`, and browser-process restart recovery.
- PASS: popup multi-digit input retained focus through `2 -> 24 -> 240`; dark idle theme resolved correctly.
- PASS: the notice-inclusive release archive loaded in a clean visible Whale 4.38 profile under ID `ejhfobkhmdabjhobogffeineggppeafj`, rendered the popup with no page console errors, opened the packaged notice, and retained the exact 116,276-byte content script.
- PASS: Chrome for Testing 147 repeated the exact-final soft and medium flows.
- PASS: headed Whale verified Options keyboard tabs/modal focus, blank-intent rejection after the real 30-second friction, completion acknowledgement followed by list rerender, and normal/reduced post-session XP/progress animation.
- PASS: headed Whale covered 13 light/dark/reduced-motion surface states, 68 measured contrast checks (minimum 4.94:1), all effective targets at least 40px, visible focus rings, no overflow, 19 screenshots, and zero page errors.
- PASS: headed Chrome for Testing displayed and accepted the real `history` permission sheet, retained domain-only controlled results, excluded extension URLs/path/query/title/timestamps, revoked permission, and started a medium session afterward.
- PASS: visible Whale ran the simultaneous natural/emergency deadline, restored direct deletion/replacement of settings/lists/schedules, and started the next eligible occurrence after expired suppression with its exact alarms and DNR.
- PASS: a visible Whale process stopped before a shortened deadline, restarted only after it was overdue, finalized once, and remained unchanged across a second restart; three distinct PIDs loaded identical bundle hashes.
- PASS: instrumented exact-build history stress kept a five-second callback pending while the due session was first observed complete at +23 ms; a successful local clear then rejected the stale result without restoring recommendations.
- PASS: instrumented exact-build worker replacement at the durable session-finalization and pet-settlement journal boundaries recovered one log, one stats credit, one settlement, one growth event, and one XP delta, with no remaining journal/rule/alarm.

Remaining evidence boundary:

- Every technical row in the historical v1.0.0 matrix was checked at that time. The history-latency and worker-interruption rows are explicitly instrumented evidence rather than unmodified user-flow evidence.
- Consumer Google Chrome 148 rejected command-line unpacked-extension loading before the historical FocusWhale build ran; Chrome for Testing remains the supported disposable-profile cross-check channel and has passed the extracted Focus Dolphin archive.
- Exact-package normal-Whale active-session proof, zero-external-request diagnostics, archive proof, public privacy URL, and listing-image review are complete. Dashboard submission, store review, and publication remain external gates.

Track owner/publication work in [QA.md](QA.md) and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Do not infer approval or publication from technical green checks.
