# FocusWhale QA Evidence And Checklist

Last refreshed: **2026-07-11 12:08 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

Current evidence boundary: **Goal 7 onboarding and Korean/English localization working tree on `codex/goal-7-onboarding-i18n`, rebuilt and checked on 2026-07-11**. The older v1.0.0 release evidence is retained below as a historical regression baseline and does not prove the current Goal 7 binary.

## Evidence Labels

- **GOAL 7 HEADED EXACT BUILD**: directly exercised in an isolated disposable, visible Naver Whale profile after rebuilding and loading the current Goal 7 `dist/`.
- **AUTOMATED GOAL 7**: covered by the current typecheck, Vitest suite, or production build verifier.
- **HARNESS LIMITATION**: the Playwright-launched Whale process could not complete the action, and the same failure was reproduced on the pre-Goal-7 baseline. This is not a Goal 7 regression finding and is not a normal-browser pass.
- **V1 BASELINE EXACT BUILD**: directly exercised against the prior v1.0.0 release candidate. Historical labels such as `HEADLESS EXACT BUILD`, `HEADED EXACT BUILD`, and `INSTRUMENTED EXACT BUILD` below refer only to that retained baseline.
- **HEADLESS PRIOR CANDIDATE**: directly exercised headlessly before the final durability/recovery fixes. Useful regression evidence, but not exact-final proof.
- **LIVE PRIOR BUILD**: directly exercised in a visible Naver Whale profile before the latest source fixes and rebuild. It remains valuable regression evidence, but does not prove the newest binary.
- **AUTOMATED CURRENT**: retained historical wording for the v1 baseline only.
- **EARLIER BASELINE**: captured in an earlier build/profile and useful for comparison only.
- **PENDING**: must be exercised before publication.

Do not turn an automated, prior-build live, or earlier-baseline result into an exact-final claim.

## Automated Release Gate

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `npm run typecheck` |
| Tests | PASS | `npm test`: 33 files / 237 tests |
| Production build | PASS | two-stage Vite build plus `verify:build` |
| Content script | PASS | classic IIFE, 178,301 bytes; SHA-256 `beed14e097185ddf2d31f3a17f07b9a422d99b715e22d9bc8eae17eb111e31a6` |
| Build hygiene | PASS | no source maps or unexpected external URLs |
| WAR surface | PASS | exact four-resource allowlist |
| Font license | PASS | packaged Pretendard OFL matches source license |
| Localization package | PASS | `default_locale: en`; localized manifest name/description/action title; 460 English and 460 Korean catalog entries; onboarding and both catalogs required by `verify:build` |
| Release archive | PASS | 2,754,338-byte ZIP; SHA-256 `cba02253a1422d8f19ed7ddb16288f0c51a442656cbd02cf459740e68b5656a0`; 31 files; manifest at root; extracted tree byte-equal to `dist/` |
| Archive hygiene | PASS | notices included; no tokens, private keys, personal email, machine path, source map, TypeScript, tests, profiles, or bundled dependency tree; production audit reports zero vulnerabilities |

## Goal 7 Current Headed Whale Evidence

Environment: Naver Whale 4.38 / Chromium 148, current rebuilt `dist/`, isolated disposable profiles, development-path extension ID `ojojphoncmkplfcinppanpbbhhfjcpgi`. Screenshots and DOM/console assertions stayed local; no recording or external upload was used.

### First-Run Onboarding

| Check | English | Korean | Evidence |
| --- | --- | --- | --- |
| Opens only on first install | PASS | PASS | **GOAL 7 HEADED EXACT BUILD**; reopening the same unpacked profile did not reopen onboarding |
| Three-step flow renders | PASS | PASS | Pet/privacy, list edit, and explicit intensity/optional 25-minute session steps were inspected |
| Completion persists | PASS | PASS | Versioned local completion state was present; Korean run recorded `version: 1`, `outcome: setup_only` |
| Skip/finish path | PASS | PASS | Completion view rendered without requesting optional history access |
| Replay from Options | PASS | PASS | English activation opened `?replay=1`; the action rendered correctly in Korean and the shared launch path is unit-tested; replay is not treated as a new install |
| Default intensity is soft | PASS | PASS | No automatic escalation; hard-only emergency explanation remained present |
| Optional `history` permission is not requested | PASS | PASS | Completion retained optional-history state as false; no browser permission prompt appeared |

### Localized Surface Matrix

| Surface | English | Korean | Key leak / overflow / console boundary |
| --- | --- | --- | --- |
| Onboarding, all three steps | PASS | PASS | No untranslated message key, unexpected Hangul in English, horizontal overflow, or page console error |
| Popup idle, 360 x 600 | PASS | PASS | Product-owned names localized (`Miro` / `미로`, default list labels); CTA and pet remained visible |
| Options activity and onboarding replay | PASS | PASS | No key leak or horizontal overflow; replay opened correctly |
| Blocked page, no active session | PENDING | PASS | Korean no-session state passed; English and active-session blocked states require normal-browser follow-up |
| Soft overlay | PENDING | PENDING | Current Goal 7 active-session overlay was not proven in a normal browser |
| Light/dark localization sweep | PENDING | PENDING | Prior v1 visual coverage remains historical; repeat against the localized binary |

### Locale And Network Boundaries

| Check | Result | Evidence |
| --- | --- | --- |
| English/Korean catalog key parity | PASS | **AUTOMATED GOAL 7**: 460 keys in each catalog plus i18n and computed-key family tests |
| Manifest localization contract | PASS | **AUTOMATED GOAL 7**: `__MSG_appName__`, `__MSG_appDescription__`, localized action title, and `default_locale: en` verified |
| Whale locale mismatch fallback | PASS | Whale reported `getUILanguage() = ko-KR` while the runtime catalog exposed `@@ui_locale = en_US`; bundled Korean fallback rendered the Korean surfaces, and the mismatch path is unit-tested |
| Unknown-key leakage | PASS | Automated fallback tests plus headed checks on the surfaces listed above |
| External network references | PASS | Build verifier found no unexpected external URL in production JS/CSS/HTML/JSON; fonts, CSS, sprites, and catalogs are packaged locally |
| Live zero-network trace | PENDING | No current Goal 7 browser network-log capture is recorded; do not infer it from the static build scan |

### Session-Start Harness Boundary

The Playwright-launched Whale process stalled at `chrome.alarms.create` when starting a session and consumed roughly 97-100% CPU. The exact same stall reproduced from the pre-Goal-7 baseline commit `acb45b6`, so this is recorded as a **HARNESS LIMITATION / pre-existing baseline behavior**, not evidence of a localization regression. It also means the current Goal 7 binary does **not** yet have a normal-browser pass for session start, active popup, medium/hard blocked flows, soft overlay, or completion.

Google Chrome is not counted as a Goal 7 extension smoke pass: the browser URL policy blocked access to the unpacked extension pages before FocusWhale could be exercised.

Exact current store captures: English and Korean onboarding step 1 were captured at 1280 x 800 from the rebuilt Goal 7 `dist/`; both include the final browser-sync disclosure and contain no account, profile, history, or user-entered data. The four older core-flow store composites remain prior-build collateral.

## Prior v1.0.0 Baseline Browser Evidence

Everything in this section through the historical matrix was recorded for the prior v1.0.0 executable/release package. It is regression context only.

Environment:

- Exact-final browsers: Naver Whale 4.38.386.14 / Chromium 148 and Google Chrome for Testing 147 in isolated disposable headed profiles, plus isolated disposable headless profiles for the core matrix. The final notice-inclusive archive smoke used a visible disposable Whale profile.
- Consumer Google Chrome 148 rejected command-line unpacked-extension loading before FocusWhale ran, so it is not counted as an app failure or pass.
- Development-path extension ID: `ojojphoncmkplfcinppanpbbhhfjcpgi`. The current clean-profile extracted archive used ID `ejhfobkhmdabjhobogffeineggppeafj`; extension IDs are path/profile dependent.
- Exact artifact boundary: the behavioral rows exercised the executable payload retained in the current release ZIP. The publication refresh adds only `licenses/THIRD-PARTY-NOTICES.txt`; every pre-existing extracted file remains byte-identical. The popup emergency and recovery harnesses fingerprinted the loaded bundles; the built background worker SHA-256 remains `f3884cdd70e425b5cb6f061b98c0f4f3acddcf300fbd69c8513fd144fc53d0ad`.
- Capture boundary: visual assertions saved local screenshots under `/tmp`; the restart, `x.com`, and archive-load checks explicitly recorded `screenCapture: false`. No recording or external upload was used.
- Permission boundary: the earlier headless request could not operate browser chrome. The exact headed Chrome-for-Testing run accepted the real prompt and completed grant, controlled analysis, revoke, and post-revoke core-use checks.
- Recovery boundary: the overdue test used three distinct visible Whale process IDs. Journal tests debugger-paused the exact 42,842-byte built worker immediately after the relevant durable journal write, accepted `Target.closeTarget`, detached the debugger, observed a new worker `performance.timeOrigin`, and then replayed recovery through a normal runtime request.
- Instrumented history boundary: the real permission lifecycle used the browser prompt as recorded above. The concurrency stress separately forced the worker's permission check true in memory, returned empty synthetic history windows, and held the first search callback for five seconds; all messages, alarms, queues, storage, session settlement, generation checks, and loaded application code remained the exact build.
- Sanitized timestamps, process IDs, breakpoint locations, and pre/post recovery values are preserved in `docs/TECHNICAL_QA_EVIDENCE_2026-07-11.md`.

Verified:

| State / Behavior | Result | Notes |
| --- | --- | --- |
| Soft overlay and completion | HEADLESS EXACT BUILD PASS | Whale and Chrome for Testing passed packaged font/sprite, shadow DOM, inert/focus containment, countdown/continue/back cleanup, light/dark reduced motion, natural completion, sequential reward acknowledgement, and zero page errors. |
| Medium friction transaction | HEADLESS EXACT BUILD PASS | Whale and Chrome for Testing passed the 0:30 gate, one allow/intent transaction, sanitized continue, expiry cleanup, reblock, one completion log, sequential acknowledgement, and zero page errors. |
| Hard blocked flow | HEADLESS EXACT BUILD PASS | Whale passed no temporary allow, request/cancel/confirm, five-minute deadline, reload restoration, weekly rejection, and the neutral focused return action. |
| Scheduled hard emergency | HEADLESS EXACT BUILD PASS | The aborted occurrence stayed idle, retained exact suppression, and re-armed reconciliation at the true window boundary. |
| Popup emergency valve | HEADLESS EXACT BUILD PASS | Two-step request, 300-second deadline, countdown progress, idempotent repeat, clean return, 40 px target, and exact asset fingerprints passed. |
| Options | HEADLESS EXACT BUILD PASS | Validation/focus, narrow layout, dependent-list guard, horizontal summary stats, name close/reopen persistence, permission request/denial, and zero-state rendering passed. |
| Pet matrix | HEADLESS EXACT BUILD PASS | All 5 stages x 4 moods rendered as 20 sprites/20 atlas rows; reduced motion disabled all 20 animations; the star adult was visible and unclipped. |
| `x.com.` edge case | HEADLESS EXACT BUILD PASS | Whale redirected a credential-bearing trailing-dot target, preserved the path/dot, stripped userinfo/query/fragment, and returned to `about:blank`; HSTS safely upgraded it to HTTPS. |
| Browser restart before deadline | HEADLESS EXACT BUILD PASS | A real process-ID change before `endsAt` preserved session/deadline/name/rules/alarm and kept Options locked. A later normal completion settled once under duplicate recovery requests; the complementary overdue and destructive-journal cases are recorded below. |
| Completion and rerender | HEADED EXACT BUILD PASS | Whale passed normal XP/count-up/progress motion, reduced-motion final-state rendering, dismissal across the separate list-mode rerender, and zero page errors. |
| Medium blank intent | HEADED EXACT BUILD PASS | Whale rejected empty intent without navigation, temporary allow, or transaction side effects. |
| Options keyboard/modal focus | HEADED EXACT BUILD PASS | Whale passed tab keyboard semantics, destructive-modal focus trap, Escape close, and focus restoration to the invoker. |
| Visual/accessibility matrix | HEADED EXACT BUILD PASS | Whale passed 13 light/dark states, 68 measured contrast checks (minimum 4.94:1), all inspected targets at least 40 x 40 px, 19 local screenshots, and zero page errors. |
| Optional history lifecycle | HEADED EXACT BUILD PASS | Chrome for Testing accepted the real browser prompt, rendered controlled domain-only results, excluded extension URLs, revoked permission, and started a medium session afterward. |
| Extracted release archive | HEADED EXACT BUILD PASS | The final notice-inclusive archive loaded in visible Whale 4.38 as MV3 v1.0.0 under ID `ejhfobkhmdabjhobogffeineggppeafj`, rendered the popup, opened the packaged notice, retained the exact 116,276-byte content bundle, and produced no popup page errors. |
| Alarm race, sync lock, schedule continuation | HEADED EXACT BUILD PASS | Visible Whale ran simultaneous natural/emergency alarms; natural completion won with one log, one stats credit, one pet settlement, one growth event, and no residual rules/alarms. Direct deletion and replacement of all three protected sync collections restored the durable snapshot without disturbing the active session. An expired prior suppression was removed and the next eligible medium occurrence started with exact session/reconcile deadlines and DNR. |
| Overdue cold restart | HEADED EXACT BUILD PASS | Whale stopped before the shortened deadline, restarted only after it was overdue, and finalized exactly once. Three distinct process IDs loaded identical bundle hashes; a second verification restart preserved one log, one stats credit, one XP/growth settlement, and zero active rules/alarms/journals. |
| Recovery-journal interruption | INSTRUMENTED EXACT BUILD PASS | At both the session-finalization and pet-settlement compiled boundaries, the durable journal existed before the paused worker was replaced. Each recovery produced one completion log, one 25-minute stats credit, one settlement ledger entry, one growth event, and 30 XP; no journal, DNR rule, or session alarm remained after repeated reconciliation. Built-worker SHA-256: `f3884cdd70e425b5cb6f061b98c0f4f3acddcf300fbd69c8513fd144fc53d0ad`. |
| History concurrency and stale commit | INSTRUMENTED EXACT BUILD PASS | The deterministic first search callback remained pending for five seconds while the due session was first observed complete 23 ms after its deadline. Local clearing then completed before analysis returned; the generation guard returned the expected stale-result failure and did not restore recommendations. |

The historical v1 exact-final matrix was green in Whale, with soft/medium cross-checks and the real history-permission lifecycle green in Chrome for Testing. Every technical row below had exact-build browser or explicitly instrumented evidence for that v1 executable. Its automated coverage additionally covered non-HTTP(S) history rejection, cold-start finalization ordering, stale-session fallback filtering, serialized configuration writes, user-owned default lists, minute-precise history scoring, cross-midnight stats, monotonic pet/streak journal recovery, acknowledgement pruning, and schedule-alarm recovery.

Still pending before publication:

- Product-owner visual/reward judgment and final manual sign-off.
- Public privacy-URL verification, support-monitoring confirmation, owner approval, publisher-dashboard entry, store review, and publication remain tracked in `RELEASE_CHECKLIST.md`.

## Earlier Baseline Evidence

Earlier screenshots exist for popup idle/active/completed, options records/rules/automatic-start/growth, blocked medium/intent/hard/confirmation, and soft overlay. Those screenshots informed the implementation but do not prove the current Goal 7 binary.

An earlier 2026-07-06 Whale run also exercised a one-minute medium session, YouTube redirect, completion cleanup, options rendering, and local history recommendations. Treat it as regression context only.

## Historical v1.0.0 Exact-Final Matrix

### Popup

- [x] Idle state fits within the popup without clipped text or controls. **HEADLESS EXACT BUILD**
- [x] Active session countdown renders and the focus pet remains visible. **HEADLESS EXACT BUILD**
- [x] Active countdown remains stable over an extended interval without layout/focus churn. **HEADLESS EXACT BUILD**
- [x] Custom multi-digit duration can be typed without focus loss. **HEADLESS EXACT BUILD: 2 -> 24 -> 240**
- [x] Natural completion creates one completion log and opens one overview. **HEADLESS EXACT BUILD**
- [x] Dismissed celebration does not reappear after popup reload. **HEADLESS EXACT BUILD**
- [x] Dismissed celebration remains dismissed after changing list mode. **HEADED EXACT BUILD**
- [x] XP/count-up/progress animations complete normally. **HEADED EXACT BUILD**
- [x] Reduced motion jumps to final values without hidden content. **HEADED EXACT BUILD**

### Medium Block

- [x] A trailing-dot, credential-bearing `x.com.` URL redirects during a matching medium session. **HEADLESS EXACT BUILD**
- [x] The blocked return target retains the path/trailing hostname dot and strips credentials, query, and fragment. **HEADLESS EXACT BUILD**
- [x] The 0:30 friction countdown completes visibly. **HEADLESS EXACT BUILD**
- [x] Blank intent cannot submit, navigate, or create a temporary allow. **HEADED EXACT BUILD**
- [x] Valid intent commits exactly one five-minute temporary-allow transaction. **HEADLESS EXACT BUILD**
- [x] Continue navigates to the already-sanitized original path. **HEADLESS EXACT BUILD**
- [x] Temporary allow expires and blocking resumes. **HEADLESS EXACT BUILD**
- [x] The exercised session produces one completion log and separately acknowledged reward panels. **HEADLESS EXACT BUILD**
- [x] Medium blocked-page return-to-focus exits to `about:blank`. **HEADLESS EXACT BUILD**

### Hard Block

- [x] No temporary-allow action is present. **HEADLESS EXACT BUILD**
- [x] First emergency click changes to a confirmation state only. **HEADLESS EXACT BUILD**
- [x] Cancel returns to the hard blocked state. **HEADLESS EXACT BUILD**
- [x] Second confirmation schedules a five-minute pending state. **HEADLESS EXACT BUILD**
- [x] Pending state survives blocked-page reload. **HEADLESS EXACT BUILD**
- [x] A second unique hard-session request in the same local week is rejected. **HEADLESS EXACT BUILD**
- [x] Natural session completion wins if it races the emergency alarm. **HEADED EXACT BUILD; simultaneous real alarms, completed exactly once**

### Soft Overlay

- [x] Overlay renders inside shadow DOM on a real HTTP(S) page. **HEADLESS EXACT BUILD**
- [x] Compiled CSS and packaged Pretendard resolve inside the shadow root. **HEADLESS EXACT BUILD**
- [x] Focus pet loads in the shadow root. **HEADLESS EXACT BUILD**
- [x] Underlying page is inert while the modal is present and restores afterward. **HEADLESS EXACT BUILD**
- [x] Focus is trapped; keyboard actions match the intended flow. **HEADLESS EXACT BUILD**
- [x] Countdown, continue, and return-to-focus behaviors work. **HEADLESS EXACT BUILD**
- [x] No new page or extension console errors appear during the complete soft flow. **HEADLESS EXACT BUILD**

### Options

- [x] Active-session settings/list/schedule lock is visible. **HEADLESS EXACT BUILD**
- [x] Out-of-band settings mutation is reverted while the exact-final active session is running. **HEADLESS EXACT BUILD; all protected fields also automated**
- [x] Keyboard tab semantics and focus order are correct, and destructive modals trap/restore focus. **HEADED EXACT BUILD**
- [x] Pet name persists after close/reopen and browser restart. **HEADLESS EXACT BUILD**
- [x] Optional history permission is requested only after analysis is invoked. **HEADLESS EXACT BUILD; denial path**
- [x] Domain recommendations show no titles, paths, query strings, or visit timestamps; extension URLs are excluded. **HEADED EXACT BUILD**
- [x] Revoking history permission leaves core focus features usable. **HEADED EXACT BUILD; medium session started after revoke**
- [x] `로컬 기록 지우기` clears local activity when idle, preserves sync-backed data, and is rejected during a session. **HEADLESS EXACT BUILD**
- [x] A history scan in progress does not delay a due session alarm; if local clear succeeds before its result commit, the stale recommendation result is not restored. **INSTRUMENTED EXACT BUILD; five-second delayed callback, first observed complete at +23 ms, stale commit rejected**
- [x] Zero-value charts/bars remain legible. **HEADLESS EXACT BUILD**

### Session Recovery

- [x] Restart Whale before `endsAt`; session rules and alarms reconcile. **HEADLESS EXACT BUILD; browser PID changed**
- [x] Restart after `endsAt`; finalization occurs once and active rules clear. **HEADED EXACT BUILD; three distinct Whale PIDs and second-restart idempotence**
- [x] Simulate interruption during session finalization; recovery journal completes safely. **INSTRUMENTED EXACT BUILD; worker replaced at compiled post-journal boundary**
- [x] Simulate interruption during pet settlement; XP is awarded once. **INSTRUMENTED EXACT BUILD; worker replaced with journal durable and XP still zero, then 30 XP once**
- [x] Active-session locked sync fields are restored if changed outside the UI. **HEADED EXACT BUILD; direct delete and replacement of settings, lists, and schedules**
- [x] Emergency-ending a scheduled session does not restart that occurrence before its window end. **HEADLESS EXACT BUILD**
- [x] The next eligible schedule occurrence starts normally after suppression expires. **HEADED EXACT BUILD; exact boundary, session/reconcile alarms, and DNR verified**

### Visual And Accessibility

- [x] Popup idle/active/completed in light and dark themes. **HEADED EXACT BUILD**
- [x] Blocked medium/hard in light and dark themes. **HEADED EXACT BUILD**
- [x] Options all four tabs in light and dark themes. **HEADED EXACT BUILD**
- [x] Soft overlay contrast on light and dark host pages. **HEADLESS EXACT BUILD**
- [x] All five stages in all four moods: 20 combinations / 80 frames. **HEADLESS EXACT BUILD**
- [x] Star-marked adult is centered and unclipped; no crown asset remains. **HEADLESS EXACT BUILD**
- [x] Touch targets are at least 40 x 40 px and keyboard focus is visible. **HEADED EXACT BUILD; all inspected targets pass**
- [x] WCAG contrast spot-checks pass for primary actions, muted copy, badges, alerts, and timers. **HEADED EXACT BUILD; 68 checks, minimum 4.94:1**
- [x] Reduced-motion mode removes nonessential transitions without losing state feedback. **HEADLESS/HEADED EXACT BUILD; overlay, all 20 pet states, and completion pass**

## Sign-Off

Current Goal 7 technical sign-off: **not recorded**. Normal-browser session start and the active blocked/overlay/completion localization sweep remain pending.

Product-owner approval: **not recorded**.

Store/publication approval: **not recorded**.

Final manual QA owner/date: ____________________

Release decision: [ ] approve  [ ] reject  [ ] approve with documented exceptions
