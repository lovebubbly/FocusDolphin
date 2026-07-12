# Focus Dolphin QA Evidence And Checklist

Last refreshed: **2026-07-12 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

Frozen Goal 8 baseline evidence boundary: **Phase B executable commit `5029d2a924cc14b5175fe1da1f4f9a2fcf274fb8` on `codex/goal-8-web-product-polish`, exercised against a rebuilt `dist/` whose 42,956-byte background worker has SHA-256 `172ca0d895958575048e022f1ef3051fb76d46b74ff1efe1ba80c731ab6f1d0e` and whose final 25,240-byte popup has SHA-256 `e191845b3f549fe92007c61d1002b10d233847751616c6bc04b277f566b16390`**. This and every hash below that predates the rename belong to the unreleased `FocusWhale` development codename. Choi Yunseong approved the complete Phase A mockup contract at commit `e7274a1` on 2026-07-11 with no exceptions. That historical whale-design approval is not a substitute for Focus Dolphin executable, dolphin-art, package, or publication evidence.

## 2026-07-12 Pre-Rename Automated Candidate (Historical)

The privacy-and-provenance candidate recorded below was verified statically and by automated gates before the Focus Dolphin identity migration. It has not received a Focus Dolphin browser-pass label.

- Automated gates pass: build, typecheck, **34 Vitest files / 259 application tests**, and **6 release-package boundary tests**. The verifier reports 11 manifest targets, exact four-resource WAR, classic content output, no source maps, root-relative asset URLs, or unexpected external URLs.
- Current fingerprints: manifest `0c0e21ab55def509f97c677e671ee429f362a5d3ea35ded75678f995b82ef9c9`; background **42,956 bytes** / `1e5cddc9a4cd79f0444b6927d17f77534b37bffaa7c6d1f59ccb2a098b85dfa2`; popup **27,173 bytes** / `50c92044b6deb4b924e21c8d5a6cff20b52378544ffe92d1e2818220c1c77718`; content **203,956 bytes** / `123c8ef35b632bb6b1ce590947924ced97673ad85e386824fca53ae33b3b0306`; Options **52,001 bytes** / `2960003197b7efaf7f72ec8339d11edecf899f3f4bbb362c9601734371c2392a`; onboarding **14,754 bytes** / `9fb2df04bd38894e20fcddd86c351486ffc9a2b7f65579cae4b27d789f691bd1`; blocked **16,813 bytes** / `722e6ac71d5d5f3fc82171eac09044eddd3681679abaea849791b9b7af3383cd`; atlas `b92f007ed9a87bb203596e26db0c125562a045ff75ef6eac5ac2beb3dbe7022e`.
- Static verification confirms the full English/Korean data disclosures are bundled in onboarding step 1 before the footer, and the host-page soft-allow `sessionStorage` write is absent.
- A fresh isolated Whale/Chrome disclosure-layout run was attempted but did not start the pre-rename FocusWhale build: headed browser launch was rejected by the environment's exhausted GUI approval quota, while all sandboxed headless Chromium binaries terminated before DevTools connection (`MachPortRendezvousServer ... Permission denied (1100)`). This is neither a product pass nor a product failure.
- The syntax-checked rerun harness at `/tmp/focuswhale-bilingual-disclosure-rehearsal.cjs` is local-only evidence and is not part of the repository. It must be rerun after browser-launch approval is available, in both languages at 1280 x 800 and 720 x 820, before packaging.

## 2026-07-12 Focus Dolphin Integrated Automated Candidate

This is exact evidence for the integrated working tree after the public-name, bilingual-copy, mascot, privacy, duration, language, and motion changes. It is not yet the selected executable commit or a browser pass.

- Automated gates pass: `npm run typecheck`, `npm run build`, **34 Vitest files / 264 application tests**, and **9 release-package boundary tests**.
- Locale catalogs have exact key and placeholder parity at **542 English / 542 Korean** entries. Both expose `Focus Dolphin — Website Blocker` as the manifest/store name and `Focus Dolphin` as the compact brand. The catalog regression rejects `FocusWhale`, standalone English `whale`, and standalone Korean `고래` in live product copy while preserving user-authored names.
- Current bundle fingerprints: manifest **1,381 bytes** / `2d19f370e02fc7adb83e26c9fa2cc04502413eef132de983dbf5a8952d0fac9a`; background **42,962 bytes** / `38859b70d94ddb37be951f2081bf8d75906b9b1e85b7d7e2d28e25b76dd06af6`; popup **27,175 bytes** / `6e51bd056c4ea5dfe0274f3edff50c088e7deb7710d0f3b16c99defa5328e567`; content **204,679 bytes** / `877062f6880153e6e74daceec4231a64e9339dc4b4fcc419c980b062d18812db`; Options **52,003 bytes** / `e8679d17ba29066ad467f6192ed9880ed56a3c1ba908c3f7d2cd5e693c9af2d5`; onboarding **14,757 bytes** / `17c04bf1f8e2ba3fe18b5dc422de77e05cdd7b15f7dbee1b334a3d459c8dbda2`; blocked **16,819 bytes** / `d8fb80445ac10b6ef986e32f9e063cfa30bc2762ced5809956c8b2fa8ff93cec`.
- The dolphin atlas is **768 x 3,840 RGBA**, eighty nonempty validated frames, and SHA-256 `b7a7a53b1b3b95e108da6b7e8970a4dd5ab1c75fc3b4ed6b598025e5107379e5`. Deterministic reassembly is byte-identical; all source/output metrics pass the 12 px safe margin. Light/dark contact-sheet review rejected angry focus and whale-like celebration drafts before selecting the final art.
- The packaged and store 128 px icons are byte-identical at SHA-256 `f2aad78150573693d4236377b830017315890d2c8f59cc85fabb2d0cc08e4714`; the 16/32/48/128 matrix keeps the rostrum, dorsal fin, and flukes visible.
- The deterministic working-tree rehearsal archive is `focus-dolphin-1.0.0.zip`: **3,715,534 bytes**, **31 entries**, SHA-256 `9477352d13105d1176c3cf540550b5a0252cbb2422528d92b943820bba1f5048`. `--verify-only` proves sorted, fixed-metadata, byte-equal `dist/` contents with manifest at the root. A selected-commit rebuild must reproduce this before it becomes release evidence.
- The archive contains the exact four Dolphin web-accessible resources, both locale catalogs, local font, four icons, and both required license notices. It contains no source maps, tests, TypeScript, source sheets, browser profiles, QA output, external network URLs, or stale live whale copy.
- Repository-sensitive-data scanning found no private key, provider/API token, personal email, machine path, credential file, or tracked browser database. The only password match is the deliberate `parsed.password = ""` URL-sanitization line. Ignored local browser profiles are not tracked and do not enter `dist/` or the archive.
- Live registry audit reports **0 total npm vulnerabilities** across 146 dependencies. Direct dependency licenses resolve to MIT, SIL OFL 1.1, or Apache 2.0; release-relevant notices are packaged.

## Focus Dolphin Candidate Evidence Required

- [x] Record fresh build, typecheck, application-test, package-test, locale-parity, and exact-bundle hashes after the public-name and mascot migration are integrated.
- [ ] Load the extracted `focus-dolphin-1.0.0.zip` in isolated ordinary Whale and Chrome profiles.
- [ ] Exercise onboarding, popup idle/active/completion, Options Review/Rules/Preferences, medium/hard blocked states, and soft overlay in English and Korean.
- [x] Confirm dolphin atlas resolution, all five stages x four moods, icon consistency, and no stale whale copy in current public surfaces through deterministic/static gates. **Browser reduced-motion, keyboard/focus, and extension-diagnostic checks remain pending below.**
- [ ] Capture fresh store imagery from that exact archive. Historical FocusWhale/whale screenshots must not be relabeled or submitted.

## 2026-07-12 Retained Motion Follow-Up

**MOTION FOLLOW-UP EXACT BUILD** means an earlier rebuilt working tree was loaded in a separate disposable Naver Whale 4.38.386.14 / Chromium 148 clone and profile. It is exact evidence for that pre-disclosure motion follow-up, not for the current hashes above, a store executable commit, or publication.

- Exercised fingerprints: background `18803d1704bf429c3515759ac68686873d761bc66d4fda8df8c078f3564938ef`; popup `410936dea5fc8389aea9fe2eb78aa6bfc5e7bd7127a073fa39ddb03e6712ff2c`; content `0ef9bbda96a03fec911e2923227f64f4d11354346a744b9e8f35cb51fdd2709f`; Options `c362d1a01cba7995de2965a67c3a7ac7c0e1d7d393d3a37aa893be8792c79d81`; onboarding `730c007d0664ffd196e346ca5588c602aefb88c9d652aa9a2c00903c76f6033c`; blocked `7cd6dd2d1edb4aad4a535e65b6f88ecb8fcad0ef3c91fb755eedb61979233846`.
- Onboarding showed the 260 ms hero entrance and 220 ms step entrance. A same-step intensity rerender produced zero new Web Animations and retained input focus.
- Popup idle showed one hero and one supporting-content entrance. Duration stepping and intensity selection stayed at motion key `idle` with zero replay; starting the session changed the key and produced the active hero/support entrances.
- Options Review and Rules each entered once. Re-selecting Rules produced zero Web Animations and retained tab focus. The fixed-height Review chart visibly rose across measured frames; reduced motion rendered final heights immediately.
- A new soft overlay produced one 260 ms card entrance while focus remained on Return to focus. Readiness produced one 320 ms badge confirmation without moving focus. Reduced motion produced zero new Web Animations and froze the sprite.
- The medium blocked card produced one 260 ms entrance and focused Return to focus. A Korean locale refresh retained the same semantic key and countdown while producing zero replay; Automatic was restored. The full 30-second intent gate and temporary-access success state also completed.
- Representative onboarding, popup, Options, blocked, and overlay reduced-motion states produced zero new Web Animations; their sprite animation computed to `none`. No animation controlled focus, navigation, storage, countdowns, or session state.
- The normal user Whale window was not targeted. The disposable app/profile were removed and local debugging port `9339` was closed after QA. No recording or external upload occurred.

## Evidence Labels

- **GOAL 8 HEADED EXACT BUILD**: directly exercised in isolated disposable, visible Naver Whale profiles after loading the frozen Goal 8 `dist/`; each suite verified the background-bundle fingerprint.
- **AUTOMATED GOAL 8**: covered by the current typecheck, Vitest suite, production build verifier, locale scan, or static acceptance scan.
- **GOAL 7 HISTORICAL**: directly exercised against the prior bilingual/onboarding candidate. It is regression context only and does not prove Goal 8.
- **HARNESS LIMITATION (HISTORICAL)**: the earlier Playwright-launched Goal 7 run stalled at `chrome.alarms.create`, and the same failure reproduced on its baseline. Goal 8 visible Whale automation no longer has this limitation and completed real session starts, alarms, DNR, completion, and reward acknowledgement.
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
| Tests | PASS | `npm test`: 34 Vitest files / 264 application tests plus 9 release-package boundary tests |
| Production build | PASS | two-stage Vite build plus `verify:build` |
| Background worker | PASS | 42,962 bytes; SHA-256 `38859b70d94ddb37be951f2081bf8d75906b9b1e85b7d7e2d28e25b76dd06af6` |
| Popup bundle | PASS | 27,175 bytes; SHA-256 `6e51bd056c4ea5dfe0274f3edff50c088e7deb7710d0f3b16c99defa5328e567` |
| Content script | PASS | classic IIFE, 204,679 bytes; SHA-256 `877062f6880153e6e74daceec4231a64e9339dc4b4fcc419c980b062d18812db` |
| Build hygiene | PASS | no source maps, root-relative asset URLs, or unexpected external URLs |
| WAR surface | PASS | exact four-resource allowlist |
| Font license | PASS | packaged Pretendard OFL matches source license |
| Localization package | PASS | `default_locale: en`; localized manifest fields; 542 English and 542 Korean catalog entries with placeholder parity, live-brand guards, and production-reference coverage |
| CSS/theme acceptance | PASS | 115 authored production surface lines; raw colors only in daisyUI theme declarations; local font/assets only |
| Focus Dolphin release archive | WORKING-TREE PASS | 3,715,534 bytes / 31 entries / SHA-256 `9477352d13105d1176c3cf540550b5a0252cbb2422528d92b943820bba1f5048`; selected-commit rebuild and browser QA pending |

## Goal 8 Current Headed Whale Evidence

Environment: Naver Whale 4.38.386.14 / Chromium 148, rebuilt `dist/`, isolated disposable profiles, development-path extension ID `ojojphoncmkplfcinppanpbbhhfjcpgi`. The broad popup/onboarding, Options, and intervention suites shared the final background/content/blocked/Options fingerprints. Final review then changed only popup milestone batching; a narrow final-popup suite fingerprinted and exercised the rebuilt popup shown above. Screenshots and DOM/console assertions stayed in ignored local `output/goal-8-final/`; no recording or external upload was used. Temporary profiles were removed and CDP ports 9341-9344 closed after each suite.

### Popup And Onboarding

The comprehensive English suite completed **161/161 assertions** with zero console/page errors and zero failed requests before the final popup-only batching guard. Its session engine, background, onboarding, themes, and non-batching UI evidence remain unchanged.

| Check | Result | Evidence |
| --- | --- | --- |
| Onboarding steps, completion, persistence, and explicit replay | PASS | Keyboard navigation/activation, selected intensity, quiet heading focus, interactive focus rings, 128/160 px pets, and no history request |
| Light, dark, and reduced-motion onboarding representatives | PASS | Layout, focus, overflow, local assets, and motion fallback checked |
| Popup idle at exact 360 x 580 | PASS | Session-first layout, English intensity wrapping, one dominant CTA, 40 px controls, no clipping or key leakage |
| Medium start and active facts | PASS | Real UI start preserved target, mode, source, clock, and Options lock |
| Upgrade to hard | PASS | Deadline and immutable facts stayed unchanged |
| Hard emergency confirmation and pending state | PASS | Two-step confirmation, safe Keep focusing, same-session durable request, approximately five-minute delay |
| True 25-minute hard completion | PASS | Real terminal contract awarded +37 XP once and rendered a 128 px celebration |
| Milestone association and acknowledgement | PASS | First Ripple and First Deep Dive events retained the completed session ID; both New chips cleared only after acknowledgement and stayed dismissed after reload |
| Accessibility and containment | PASS | Keyboard-only flow, no horizontal overflow, no controls below 40 px, local resources only |

The final 25,240-byte popup then passed **32/32 exact headed assertions**. A seven-event seed rendered the session plus exactly four milestone rows and a truthful `2 more changes` summary; keyboard acknowledgement wrote only those five rendered IDs, leaving the fifth associated and unrelated events pending. The next screen rendered and acknowledged exactly those two, and reload stayed dismissed. The standard session-plus-two-milestone case also passed. There were no horizontal/control clipping issues, message-key leaks, undersized controls, console/page/request/HTTP errors, or service-worker warnings/errors. Vertical completion content is intentionally scrollable inside 360 x 580.

### Options: Review, Rules, And Preferences

| Check | Result | Evidence |
| --- | --- | --- |
| Review empty and populated states | PASS | Current-week recorded focus is distinguished from completed sessions; attempts/temp access/eight-week trend/domain/category/growth data matched seeded storage |
| Whale and milestone presentation | PASS | 128/160 px pets, latest badge chosen by `earnedAt`, additive rest-day copy |
| Rules desktop and 390 px | PASS | Compact projection of existing schedules/lists; no mid-word split or horizontal overflow |
| Editors and destructive confirmation | PASS | Validation, keyboard use, Escape, focus trap, and focus return to the visible row invoker |
| Preferences permission state | PASS | Page load used `permissions.contains`; Not granted rendered without a prompt and Revoke remained disabled |
| Active-session lock | PASS | Review, Rules, and Preferences exposed no mutation route while active |
| Theme and motion representatives | PASS | Light, dark, narrow, and reduced-motion states rendered without extension diagnostics |

One modal-layer measurement sees the dimmed page's primary button plus the modal primary in the document tree. Only the modal action is operable and focusable while the modal is open, so this is an expected modal-layer exception rather than a two-CTA interaction failure.

### Blocked Page And Soft Overlay

The Korean suite passed every requested intervention row on the same frozen background hash. It ended with no active session, no pending emergency, zero DNR rules, zero extension/content/service-worker errors, a removed temporary profile, and a closed CDP port.

| Check | Result | Evidence |
| --- | --- | --- |
| MV3 redirect coverage | PASS | Live `x.com`, `www.x.com`, and `mobile.twitter.com` navigations redirected under matching rules |
| Medium friction | PASS | Intent entry, real 30-second gate, localized live ready announcement, five-minute temporary allow, happy pet, and Continue to live `x.com` |
| Hard long clock and safe exits | PASS | Durations above one hour use `H:MM:SS`; Return to focus from both initial and confirmation states navigated the top-level tab to `about:blank` |
| Hard emergency and weekly bound | PASS | Two-step request, approximately five-minute pending state, resting pet, reload-safe durable state, and localized rejection of a second unique weekly request while the session stayed active |
| Soft waiting and ready | PASS | Real `example.com` overlay, localized Check-in complete state, enabled Continue, hostile-page CSS isolation, and local compiled assets |
| Overlay accessibility and ownership | PASS | Real Tab/Shift+Tab trap, host body inert/restored, prior focus restored, session-scoped allow prevented reopen, and session end removed a rearmed overlay |
| Theme, motion, layout, and controls | PASS | Light/dark representatives, reduced pet/button motion, no overflow/clipping/key leaks, and no target below 40 px |
| Runtime diagnostics | PASS | Zero console errors/warnings, page errors, failed requests, or HTTP 400+ responses; worker exception details were null and error-event list empty |

The `lc.getunicorn.org` resources visible on the host page were injected by Naver Whale, not requested or referenced by the historical FocusWhale build. Host stderr contained only browser video-capture/crashpad cleanup warnings. Retained screenshots were visually inspected and byte-matched to stable verification captures; transient compositor captures were rejected.

### Locale, Network, And Evidence Boundaries

| Check | Result | Evidence |
| --- | --- | --- |
| English/Korean catalog key parity | PASS | **AUTOMATED GOAL 8**: 530 keys in each catalog, placeholder parity, computed-key family tests, and production-reference coverage |
| Manifest localization contract | PASS | **AUTOMATED GOAL 8**: localized manifest fields and `default_locale: en` verified |
| Whale locale mismatch fallback | PASS | Existing bundled-catalog fallback remains tested; Korean intervention QA exercises the frozen production bundle |
| Unknown-key leakage | PASS | Automated fallback/reference tests plus exact headed surface scans |
| External network references | PASS | Static verifier found no unexpected production URL; popup/onboarding and Options exact runs recorded zero failed requests or extension diagnostics |
| Evidence retention | PASS | Local screenshots/results live under ignored `output/goal-8-final/`; profiles, extension storage, and captures are not tracked or packaged |

## Goal 7 Bilingual Candidate Evidence (Historical)

The headed Goal 7 onboarding/localization evidence, including its historical automation limitation, remains available in Git history and the prior release documentation. It is superseded by the exact Goal 8 matrix above and must not be cited as proof of the current bundle.

## Prior v1.0.0 Baseline Browser Evidence

Everything in this section through the historical matrix was recorded for the prior v1.0.0 executable/release package. It is regression context only.

Environment:

- Exact-final browsers: Naver Whale 4.38.386.14 / Chromium 148 and Google Chrome for Testing 147 in isolated disposable headed profiles, plus isolated disposable headless profiles for the core matrix. The final notice-inclusive archive smoke used a visible disposable Whale profile.
- Consumer Google Chrome 148 rejected command-line unpacked-extension loading before the historical FocusWhale build ran, so it is not counted as an app failure or pass.
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

Earlier screenshots exist for popup idle/active/completed, options records/rules/automatic-start/growth, blocked medium/intent/hard/confirmation, and soft overlay. Those screenshots informed the implementation but do not prove the Goal 8 binary.

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
