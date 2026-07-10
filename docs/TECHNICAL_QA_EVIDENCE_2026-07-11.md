# FocusWhale Technical QA Evidence - 2026-07-11

> **Provenance**
>
> - Product owner and requester: **Choi Yunseong (최윤성)**
> - Executed and recorded by: **OpenAI Codex (GPT-5)**
> - Visible-browser execution window: **2026-07-11 01:50-02:12 KST**
> - Final gate and documentation refresh: **2026-07-11 02:29 KST**
> - Browser: **Naver Whale 4.38.386.14 / Chromium 148**
> - Scope: the seven technical rows that were still open after the earlier exact-build matrix
> - Approval boundary: these results do not record product-owner approval, store review, or publication

## Artifact Identity

Every run loaded the same local `dist/`. The final rebuild after documentation edits is byte-for-byte equal to the reviewed release ZIP.

| Item | Recorded value |
| --- | --- |
| Manifest | MV3, FocusWhale 1.0.0 |
| Development-path extension ID | `ojojphoncmkplfcinppanpbbhhfjcpgi` |
| Background worker | 42,842 bytes; SHA-256 `f3884cdd70e425b5cb6f061b98c0f4f3acddcf300fbd69c8513fd144fc53d0ad` |
| Content script | 116,276 bytes; SHA-256 `7caaa383bbe4dbbe950304af9a654f9e5d24066b11f328bc9610a8cf96a9e743` |
| Popup bundle | SHA-256 `9d4c694e5f36cec7de825e97ccd6f8bc7120a7dfa54d3506be7c72460398dc5e` |
| Options bundle | SHA-256 `e16da2db37cd8a58d1b22fad842920fb32678da53491c2545778a5bca522c144` |
| Release ZIP | 2,693,022 bytes; SHA-256 `4d766244997647161b63a6d7f5018970e5ab7df94a99af82cecfd6aa7469af0f` |
| Extracted comparison | 24 files; `diff -qr` returned no difference |

No screen recording or screenshot was captured for these technical runs. Disposable browser profiles and controller scripts stayed under `/tmp`; no artifact was uploaded.

## Evidence Boundary

- **HEADED EXACT BUILD** used the unchanged production bundle in visible Whale processes with real extension APIs.
- **INSTRUMENTED EXACT BUILD** loaded that same bundle, then used CDP only to provide deterministic history responses/latency or to stop the worker runtime at a reviewed compiled-code boundary.
- The optional-history browser prompt and real domain-only result lifecycle were already covered separately in headed Chrome for Testing. The concurrency run below deliberately isolates queue timing and stale-write rejection.
- Temporary controller files are not part of the source tree or release archive. This appendix preserves their sanitized inputs, measured outputs, and assertion contract.

## Headed Exact-Build Runs

### Natural Completion And Emergency Alarm Race

Method:

1. Start a hard session through the production runtime message.
2. Request its emergency end through the production flow.
3. Set `activeSession.endsAt` and `pendingEmergency.dueAt` to the same deadline.
4. Arm both production alarms for that deadline and wait for durable settlement.

Recorded result:

| Field | Value |
| --- | --- |
| Session | `session-1783703531830-5d9f597f-e1c6-4047-9622-d2c217ccff3e` |
| Shared deadline | `1783703537854` |
| Final status | `completed` |
| Matching completion records | 1 |
| Stats credit / pet ledger / growth event | 1 / 1 / 1 |
| Active state / pending emergency | cleared / cleared |
| Remaining finalization journal / DNR rules / session alarms | 0 / 0 / 0 |

### Protected Sync Restoration

During one active medium session, the controller first removed and then replaced `settings`, `siteLists`, and `schedules` directly through `chrome.storage.sync`. Both mutations returned to the durable lock snapshot.

| Field | Value |
| --- | --- |
| Session | `session-1783703539256-cc21a086-8c2e-4079-93f1-85ca4bd22f6a` |
| Restored keys | `settings`, `siteLists`, `schedules` |
| Session after restoration | same ID, still active |
| Lock snapshot | same session; all three values present |
| DNR / deadline alarm | rule ID 1 present / session alarm present |

### Next Eligible Schedule Occurrence

An expired suppression for the same schedule/list preceded a newly eligible medium occurrence.

| Field | Value |
| --- | --- |
| Prior suppression end | `1783703519999` |
| New schedule | `qa-next-eligible`, 02:12-02:16 local time |
| New session | `session-1783703540837-5a3aad7d-f7d0-4dbd-aaf5-e1953b96a5d6` |
| Exact session/window end | `1783703760000` |
| Suppression after start | absent |
| Session alarm / reconcile alarm | both `1783703760000` |
| DNR | rule ID 1 present |

### Restart Only After The Deadline

The launcher stopped Whale before the shortened deadline, waited until two seconds after it, restarted the same profile, verified recovery, then restarted once more to detect duplication.

| Field | Value |
| --- | --- |
| Whale process IDs | `27032 -> 27510 -> 27700` |
| Session | `session-1783702735188-62562fcc-0e1f-44c5-8876-7f0d2fb73a74` |
| Deadline | `1783702747208` |
| Browser stopped | `1783702735334` (before deadline) |
| First restart target time | `1783702749208` (after deadline) |
| Completion record / stats credit | 1 / 1 minute |
| Pet settlement / growth event | 1 / 1 |
| Final pet XP / focus minutes | 1 / 1 |
| Active state / journals / DNR / session alarms | cleared / 0 / 0 / 0 |
| Second restart | fingerprint unchanged |

## Instrumented Exact-Build Runs

### History Concurrency And Stale Commit

Instrumentation forced the worker's history-permission check true, returned empty synthetic history windows, and delayed the first `chrome.history.search` callback by 5,000 ms. The remaining 29 search windows returned immediately. No production source or built asset changed.

| Field | Value |
| --- | --- |
| Whale process ID | `32252` |
| Session | `session-1783703024151-1eb60b24-eb47-4466-abf8-93c08d20524f` |
| Session deadline | `1783703025061` |
| First observed complete | `1783703025084` (+23 ms) |
| First search entered / callback returned | `1783703024162` / `1783703029173` |
| Search calls | 30 |
| Local clear start / finish | `1783703025085` / `1783703025093` |
| Analysis finished | `1783703029176` |
| Analysis response | expected stale-local-data failure |
| Recommendations after clear | absent |

The +23 ms value is the first post-snapshot observation of completed durable state, not an internal alarm-handler timestamp.

### Session-Finalization Journal Interruption

CDP set a breakpoint in the compiled worker immediately after `sessionFinalizationJournal` became durable and before the completion record or pet settlement began. `Target.closeTarget` was accepted, the debugger detached, the old target disappeared, and a normal `GET_STATE` request started a new worker runtime and replayed the journal.

| Field | Value |
| --- | --- |
| Session | `qa-session-finalization-1783703483481` |
| Requested / resolved compiled column | `18874` / `18912` |
| Worker time origin before / after | `1783703472909.8` / `1783703483503.8` |
| State at interruption | session journal present; 0 completion records; no pet journal/ledger/growth; XP 0 |
| Recovered completion / settlement / growth | 1 / 1 / 1 |
| Recovered stats / XP | 25 minutes / 30 XP |
| Remaining journals / DNR / session alarms | 0 / 0 / 0 |

### Pet-Settlement Journal Interruption

CDP paused at the compiled settlement-application entry after both the session journal and `petSettlementJournal` were durable, while the completion record existed but the pet ledger, growth event, and XP did not. The same target-close/detach/wake sequence replaced the runtime and replayed settlement.

| Field | Value |
| --- | --- |
| Session | `qa-pet-settlement-1783703472880` |
| Requested / resolved compiled column | `2240` / `2266` |
| Worker time origin before / after | `1783703418324.5` / `1783703472909.8` |
| State at interruption | both journals present; 1 completion record; no pet ledger/growth; XP 0 |
| Recovered completion / settlement / growth | 1 / 1 / 1 |
| Recovered stats / XP | 25 minutes / 30 XP |
| Remaining journals / DNR / session alarms | 0 / 0 / 0 |

Each journal scenario then issued repeated `GET_STATE` and `RECONCILE_PET` requests plus another due session alarm. The durable fingerprint did not change.

## Final Gate

After recording this evidence:

- `npm run typecheck`: pass.
- `npm test -- --run`: 30 files / 196 tests, pass.
- `npm run build`: pass; verifier reports 116,276-byte classic content output.
- Current `dist/` versus extracted release ZIP: no difference.
- Release checksum sidecar: pass.
- Added-line secret and machine-path scan: no finding.

The remaining work is product-owner judgment and store/publication preparation, not an open technical implementation or runtime QA row.
