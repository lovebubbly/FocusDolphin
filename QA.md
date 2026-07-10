# FocusWhale QA Evidence And Checklist

Last refreshed: **2026-07-11 01:33 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

## Evidence Labels

- **HEADLESS EXACT BUILD**: directly exercised in an isolated temporary-profile, headless Naver Whale after rebuilding and loading the exact current `dist/`.
- **HEADED EXACT BUILD**: directly exercised in an isolated temporary-profile, visible browser after rebuilding and loading the exact current `dist/`; browser-chrome permission UI and visible focus behavior are included where stated.
- **HEADLESS PRIOR CANDIDATE**: directly exercised headlessly before the final durability/recovery fixes. Useful regression evidence, but not exact-final proof.
- **LIVE PRIOR BUILD**: directly exercised in a visible Naver Whale profile before the latest source fixes and rebuild. It remains valuable regression evidence, but does not prove the newest binary.
- **AUTOMATED CURRENT**: covered by typecheck, Vitest, or build verification on the current source/build, but not re-run live after the latest rebuild.
- **EARLIER BASELINE**: captured in an earlier build/profile and useful for comparison only.
- **PENDING**: must be exercised before publication.

Do not turn an automated, prior-build live, or earlier-baseline result into an exact-final claim.

## Automated Release Gate

| Gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | PASS | `npm run typecheck` |
| Tests | PASS | `npm test`: 30 files / 196 tests |
| Production build | PASS | two-stage Vite build plus `verify:build` |
| Content script | PASS | classic IIFE, 116,276 bytes |
| Build hygiene | PASS | no source maps or unexpected external URLs |
| WAR surface | PASS | exact four-resource allowlist |
| Font license | PASS | packaged Pretendard OFL matches source license |
| Release archive | PASS | 2,693,022-byte ZIP; SHA-256 `4d766244997647161b63a6d7f5018970e5ab7df94a99af82cecfd6aa7469af0f`; checksum passes; extracted tree byte-equal to `dist/` |
| Archive hygiene | PASS | 32 entries / 24 files; token/path/email scan found no findings |

## Live Browser Evidence

Environment:

- Exact-final browsers: Naver Whale 4.38.386.14 / Chromium 148 and Google Chrome for Testing 147 in isolated disposable headed profiles, plus isolated disposable headless profiles for the core matrix and archive smoke.
- Consumer Google Chrome 148 rejected command-line unpacked-extension loading before FocusWhale ran, so it is not counted as an app failure or pass.
- Development-path extension ID: `ojojphoncmkplfcinppanpbbhhfjcpgi`. The current clean-profile extracted archive used ID `codbhopmpipbogplaofkgndjeoemjbck`; extension IDs are path/profile dependent.
- Exact artifact boundary: the current exact rows exercised the 01:33 `dist/` that produced the recorded release ZIP. The popup emergency harness fingerprinted the loaded manifest, page, JS, and CSS assets.
- Capture boundary: visual assertions saved local screenshots under `/tmp`; the restart, `x.com`, and archive-load checks explicitly recorded `screenCapture: false`. No recording or external upload was used.
- Permission boundary: the earlier headless request could not operate browser chrome. The exact headed Chrome-for-Testing run accepted the real prompt and completed grant, controlled analysis, revoke, and post-revoke core-use checks.

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
| Browser restart before deadline | HEADLESS EXACT BUILD PASS | A real process-ID change before `endsAt` preserved session/deadline/name/rules/alarm and kept Options locked. A later normal completion settled once under duplicate recovery requests; this does not cover restart after an already-overdue deadline or destructive journal fault injection. |
| Completion and rerender | HEADED EXACT BUILD PASS | Whale passed normal XP/count-up/progress motion, reduced-motion final-state rendering, dismissal across the separate list-mode rerender, and zero page errors. |
| Medium blank intent | HEADED EXACT BUILD PASS | Whale rejected empty intent without navigation, temporary allow, or transaction side effects. |
| Options keyboard/modal focus | HEADED EXACT BUILD PASS | Whale passed tab keyboard semantics, destructive-modal focus trap, Escape close, and focus restoration to the invoker. |
| Visual/accessibility matrix | HEADED EXACT BUILD PASS | Whale passed 13 light/dark states, 68 measured contrast checks (minimum 4.94:1), all inspected targets at least 40 x 40 px, 19 local screenshots, and zero page errors. |
| Optional history lifecycle | HEADED EXACT BUILD PASS | Chrome for Testing accepted the real browser prompt, rendered controlled domain-only results, excluded extension URLs, revoked permission, and started a medium session afterward. |
| Extracted release archive | HEADLESS EXACT BUILD PASS | The clean-profile archive copy loaded as MV3 v1.0.0 under ID `codbhopmpipbogplaofkgndjeoemjbck`, rendered the popup, fetched the exact 116,276-byte content bundle, and produced no page errors. |

The core exact-final matrix is green in Whale, with soft/medium cross-checks and the real history-permission lifecycle green in Chrome for Testing. Current automated coverage additionally covers non-HTTP(S) history rejection, cold-start finalization ordering, stale-session fallback filtering, serialized configuration writes, user-owned default lists, minute-precise history scoring, cross-midnight stats, monotonic pet/streak journal recovery, acknowledgement pruning, and schedule-alarm recovery.

Still pending before publication:

- Restarting Whale only after a session is already overdue, plus destructive interruption injection during each recovery journal.
- Product-owner visual/reward judgment and final manual sign-off.

## Earlier Baseline Evidence

Earlier screenshots exist for popup idle/active/completed, options records/rules/automatic-start/growth, blocked medium/intent/hard/confirmation, and soft overlay. Those screenshots informed the implementation but do not prove the exact current binary.

An earlier 2026-07-06 Whale run also exercised a one-minute medium session, YouTube redirect, completion cleanup, options rendering, and local history recommendations. Treat it as regression context only.

## Publication-Blocking Exact-Final Matrix

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
- [ ] Natural session completion wins if it races the emergency alarm.

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
- [ ] A history scan in progress does not delay a due session alarm; if local clear succeeds before its result commit, the stale recommendation result is not restored. **AUTOMATED CURRENT**
- [x] Zero-value charts/bars remain legible. **HEADLESS EXACT BUILD**

### Session Recovery

- [x] Restart Whale before `endsAt`; session rules and alarms reconcile. **HEADLESS EXACT BUILD; browser PID changed**
- [ ] Restart after `endsAt`; finalization occurs once and active rules clear.
- [ ] Simulate interruption during session finalization; recovery journal completes safely.
- [ ] Simulate interruption during pet settlement; XP is awarded once.
- [ ] Active-session locked sync fields are restored if changed outside the UI.
- [x] Emergency-ending a scheduled session does not restart that occurrence before its window end. **HEADLESS EXACT BUILD**
- [ ] The next eligible schedule occurrence starts normally after suppression expires.

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

Product-owner approval: **not recorded**.

Store/publication approval: **not recorded**.

Final manual QA owner/date: ____________________

Release decision: [ ] approve  [ ] reject  [ ] approve with documented exceptions
