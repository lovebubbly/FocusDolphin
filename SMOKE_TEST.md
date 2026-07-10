# FocusWhale Smoke Test

Documentation refresh: **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)**, **2026-07-11 02:29 KST**.

Use a dedicated Naver Whale or Chromium profile with the freshly built `dist/` loaded unpacked. Do not reuse stale build output.

## Preconditions

```sh
npm run typecheck
npm test
npm run build
```

Expected automated result for the v1.0.0 candidate: 30 test files / 196 tests; classic `assets/content.js` at 116,276 bytes; exact four-resource WAR allowlist; no source maps or unexpected external URLs.

Release artifact: `release/FocusWhale-1.0.0.zip`, 2,693,022 bytes, SHA-256 `4d766244997647161b63a6d7f5018970e5ab7df94a99af82cecfd6aa7469af0f`. The checksum passes; its 32 entries / 24 files extract byte-for-byte equal to the exact current `dist/`; `manifest.json` is at the root; the extracted copy passes a clean-profile Whale smoke load under extension ID `codbhopmpipbogplaofkgndjeoemjbck`; and the archive token/path/email scan found no findings.

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

### Storage

```js
await chrome.storage.local.get(null)
await chrome.storage.sync.get(null)
```

Expected:

- Sync: settings, site lists, schedules, pet state.
- Local: active/past sessions, intent entries, daily stats, recommendations, temp allows, growth/ack records, ledgers, emergency use, schedule-occurrence suppression, and short-lived journals.
- Finalization/settlement journals disappear after successful recovery.
- No raw browser-history export, page title, or page body is persisted.

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
4. Choose `그래도 열기`.
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
4. Dismiss, toggle list mode, and reopen the popup.
5. Confirm the same overview does not return and XP did not duplicate.
6. In the pet fixture/options, inspect all five stages across `idle`, `happy`, `focus`, and `celebrate`.

### Optional History And Clear Controls

1. In Options, revoke `history` if already granted.
2. Confirm core focus controls still work.
3. Invoke recommendation analysis; only then should Whale request history permission.
4. Confirm result rows contain domain/category/visit aggregates only.
5. Revoke permission and confirm stored core configuration remains.
6. When idle, confirm `로컬 기록 지우기`; local activity should clear while sync settings/lists/schedules/pet remain. The current week's emergency-use allowance and a still-active schedule suppression must also remain.
7. During a session, confirm the same clear request is rejected.
8. Start an analysis, allow an idle local clear to succeed before the result commits, and confirm the stale recommendation result is not written back. A due session alarm must remain responsive while analysis computes.

## Recorded Exact-Final Browser Evidence

Headless and headed checks used isolated disposable profiles. Naver Whale 4.38 / Chromium 148 used development-path extension ID `ojojphoncmkplfcinppanpbbhhfjcpgi`; Chrome for Testing 147 exercised the real optional-permission prompt.

- PASS: complete soft overlay shadow/font/pet/focus/inert/countdown/continue/back/reduced-motion/completion flow with no page errors.
- PASS: medium 0:30 friction, one temporary-allow transaction, sanitized continue, expiry/reblock, one completion log, and sequential reward acknowledgement.
- PASS: hard confirmation/cancel/pending/reload/weekly rejection and scheduled-occurrence suppression with exact boundary re-arm.
- PASS: popup emergency valve, Options validation/lock/name/request-denial flow, 20-state pet matrix, adversarial `x.com.`, and browser-process restart recovery.
- PASS: popup multi-digit input retained focus through `2 -> 24 -> 240`; dark idle theme resolved correctly.
- PASS: extracted release archive loaded in a clean Whale profile under ID `codbhopmpipbogplaofkgndjeoemjbck` and fetched the exact 116,276-byte content script.
- PASS: Chrome for Testing 147 repeated the exact-final soft and medium flows.
- PASS: headed Whale verified Options keyboard tabs/modal focus, blank-intent rejection after the real 30-second friction, completion acknowledgement followed by list rerender, and normal/reduced post-session XP/progress animation.
- PASS: headed Whale covered 13 light/dark/reduced-motion surface states, 68 measured contrast checks (minimum 4.94:1), all effective targets at least 40px, visible focus rings, no overflow, 19 screenshots, and zero page errors.
- PASS: headed Chrome for Testing displayed and accepted the real `history` permission sheet, retained domain-only controlled results, excluded extension URLs/path/query/title/timestamps, revoked permission, and started a medium session afterward.
- PASS: visible Whale ran the simultaneous natural/emergency deadline, restored direct deletion/replacement of settings/lists/schedules, and started the next eligible occurrence after expired suppression with its exact alarms and DNR.
- PASS: a visible Whale process stopped before a shortened deadline, restarted only after it was overdue, finalized once, and remained unchanged across a second restart; three distinct PIDs loaded identical bundle hashes.
- PASS: instrumented exact-build history stress kept a five-second callback pending while the due session was first observed complete at +23 ms; a successful local clear then rejected the stale result without restoring recommendations.
- PASS: instrumented exact-build worker replacement at the durable session-finalization and pet-settlement journal boundaries recovered one log, one stats credit, one settlement, one growth event, and one XP delta, with no remaining journal/rule/alarm.

Remaining evidence boundary:

- Every technical exact-build row in `QA.md` is now checked. The history-latency and worker-interruption rows are explicitly instrumented evidence rather than unmodified user-flow evidence.
- Consumer Google Chrome 148 rejects command-line unpacked-extension loading before FocusWhale runs; Chrome for Testing remains the supported disposable-profile cross-check channel.
- Product-owner reward/visual judgment, public privacy/store metadata, and publication sign-off are not recorded.

Track owner/publication work in [QA.md](QA.md) and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). Do not infer approval or publication from technical green checks.
