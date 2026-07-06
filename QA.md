# FocusWhale QA Checklist

Per orchestration protocol, real Whale/manual browser checks are not executed by Codex. Use this checklist after loading `dist/` as an unpacked extension.

## Build Gate

- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] `npm test`

## Scenario 1: Schedule Auto Start

- [ ] Create a blocklist with `example.com`.
- [ ] Create an enabled schedule whose current time window includes now.
- [ ] Reload/restart the extension service worker.
- [ ] Expected: `activeSession.source === "schedule"` and DNR rules are installed.
- [ ] Move outside the schedule window or wait for the end boundary.
- [ ] Expected: schedule session completes, DNR rules clear, session is appended to `sessionLog`.

Result notes:

```text

```

## Scenario 2: Allowlist Hard Deep Work

- [ ] Create an allowlist containing only an explicitly needed domain such as `docs.google.com`.
- [ ] Start a hard session from the popup.
- [ ] Open a domain outside the allowlist.
- [ ] Expected: blocked page shows remaining time and pet, with only the emergency end request available.
- [ ] Try editing lists/schedules in options.
- [ ] Expected: UI is read-only and says changes are available after the session; service worker also rejects hard-session list/schedule changes.

Result notes:

```text

```

## Scenario 3: Recommendation Approval Flow

- [ ] In options, click `방문 기록 분석`.
- [ ] Expected: recommendations are domain-only and contain no raw URLs, titles, or visit timestamps.
- [ ] Click `차단 목록에 추가` for one recommendation.
- [ ] Expected: the domain is added only after that click; no candidate is auto-blocked.

Result notes:

```text

```

## Restore And Cleanup

- [ ] Start a medium session, restart the browser before `endsAt`.
- [ ] Expected: startup reconcile reinstalls DNR rules and alarms.
- [ ] Create a medium temp allow, then wait for expiry.
- [ ] Expected: temp allow rule in the `1000-1999` range is removed.
- [ ] Simulate a missed completed session and open popup/options.
- [ ] Expected: XP settlement is idempotent, pet does not regress, interrupted sessions remain visible in dashboard.

Result notes:

```text

```

## Streak Freeze Scenario

- [ ] Use dev fixtures or controlled `sessionLog` dates to create a 7-day completed streak.
- [ ] Expected: one freeze is earned, capped at two.
- [ ] Add a missed day.
- [ ] Expected: one freeze is consumed without guilt/shame copy.
- [ ] Add a later completed session after a break with no freeze.
- [ ] Expected: recovery state is shown neutrally and the streak restarts from 50%.

Result notes:

```text

```
