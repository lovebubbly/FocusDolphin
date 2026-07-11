# FocusWhale Privacy Policy

Product owner: **Choi Yunseong (최윤성)**. Repository-accuracy refresh prepared by **OpenAI Codex (GPT-5)** on **2026-07-11 02:42 KST**.

Effective date: July 10, 2026

FocusWhale is a local-first Naver Whale and Chromium extension. This policy describes version 1.0.0 as implemented in this repository.

## Summary

- FocusWhale has no backend, analytics service, advertising SDK, telemetry endpoint, or remote API.
- FocusWhale does not sell data or transmit browsing history, session records, or intent text to the developer or to an app-integrated external service. The only browser-managed transmission the extension can request is sync storage for the configuration and pet fields described below.
- Browsing-history analysis runs inside the extension. Raw history URLs and individual visit records are processed in memory and are not saved by FocusWhale.
- Settings stored with `chrome.storage.sync` may be transmitted and retained by the browser's sync service when the user enables browser-account sync. That browser-managed sync is not a FocusWhale server.

## Permissions And Their Use

FocusWhale requests only the permissions used by its current features:

- `declarativeNetRequest`: install session-scoped redirect and allow rules for domains selected by the user.
- `storage`: retain settings, site lists, schedules, session state, local statistics, recommendations, and pet progress.
- `alarms`: finish sessions, expire temporary allows, and start scheduled sessions reliably while the service worker sleeps.
- Optional `history`: after the user chooses to run recommendation analysis and grants access, analyze up to the most recent 30 days of browser history. The extension's core session and blocking features do not require this permission.
- `http://*/*` and `https://*/*` host access and a content script: find and redirect already-open web tabs that conflict with an active session, and apply soft overlays and blocking behavior on user-selected sites. Access excludes non-web schemes. The content script uses the current page URL to identify its domain; it does not read, save, or transmit page text, form fields, passwords, messages, or page content.

## Data FocusWhale Processes

### Browser history

When the user starts the recommendation analysis and grants the optional history permission, FocusWhale queries the most recent 30 days of browser history in daily windows, with a bounded sample of at most 5,000 distinct URLs. It then uses `history.getVisits` to count the actual visits whose timestamps fall inside that 30-day window; it does not treat lifetime URL counters as recent activity. Raw URL and visit records are held only in memory while the analysis runs. FocusWhale reduces them to domain-level recommendations containing the domain, category, visit count, focus-hour ratio, and a local score. It does not save page titles, full paths, query strings, or individual visit timestamps.

### Focus sessions and blocking

FocusWhale stores the active session and a session log, including session identifiers, start and end times, selected intensity and site list, completion status, and related aggregate counters. It also stores temporary domain allows, daily focus and blocked-attempt aggregates, emergency-end usage, active scheduled-occurrence suppression, and short-lived recovery journals used to make session finalization reliable.

When FocusWhale redirects a blocked page, it keeps only the web origin and path needed for a possible return. Credentials, query parameters, and fragments are removed before they become part of the blocked-page return address.

In medium mode, the reason a user types before requesting temporary access is saved locally with its timestamp, domain, and related session identifier. This free-text intent may be sensitive; it is not transmitted by FocusWhale.

### Settings and pet progress

FocusWhale stores focus-hour and overlay settings, user-created blocklists and allowlists, schedules, and pet state. Pet state includes the pet name, XP, growth stage, focus minutes, streak/freeze status, and earned badges. Growth events, settlement ledgers, celebration state, and crash-recovery journals are stored locally.

## Storage Locations

The following configuration and progress data use `chrome.storage.sync`: settings, site lists, schedules, and pet state. If browser sync is enabled, the browser vendor may sync this data across the user's signed-in browsers under the vendor's own privacy terms.

All other FocusWhale data uses `chrome.storage.local`, including active and past sessions, intent entries, daily aggregates, recommendations, category overrides, growth records, temporary allows, emergency-use records, schedule-occurrence suppression, and recovery journals. FocusWhale does not copy these local records to its own server.

## Retention And Deletion

- Raw history records are not persisted by FocusWhale after an analysis. The derived recommendation list remains in local extension storage until a later analysis replaces it or the user clears extension data. If an idle local clear succeeds while an older analysis is still running, its stale result is rejected instead of recreating the cleared recommendation list.
- Temporary allows expire automatically. Transaction and recovery journals are removed after their work completes.
- Growth events and celebration acknowledgements are each capped at the newest 500 records. Pending celebrations remain until acknowledged.
- Session history and its idempotency ledgers retain at most the newest 5,000 session identifiers or records. Medium-mode intent history retains at most the newest 200 entries. Daily aggregates older than 400 days are pruned when new daily activity is recorded.
- Emergency-use state rolls over by local week. The current derived recommendation list is replaced by the next analysis.
- FocusWhale Options provides `로컬 기록 지우기`, which removes local activity, recommendation, intent, growth-log, temporary-allow, and recovery data after a confirmation. This action is rejected while a session is active so it cannot undermine an in-progress focus commitment. Synced settings, lists, schedules, and pet progress are intentionally preserved. The current local week's emergency-use allowance and any unexpired suppression for an early-ended scheduled occurrence are also preserved so clearing records cannot reset those two commitment safeguards.
- FocusWhale Options also provides `방문 기록 권한 해제`. Individual site lists and schedules can be deleted separately.
- To remove both local and synced FocusWhale data, use the browser's extension-data and sync controls or remove the extension. Browser-managed synced values may need to be cleared through the browser account's sync controls.

## Network Activity And Third Parties

The release bundle contains its UI styles, pet artwork, icons, and Pretendard font locally. It does not load CDN assets, web fonts, or remote scripts. FocusWhale does not integrate third-party analytics, advertising, crash reporting, or AI services.

The browser and its sync service are platform providers. Their handling of browser history, extension permissions, and synced extension storage is governed by their own terms and privacy policies.

FocusWhale's use of information received from browser APIs, including the optional history API, adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/), including its Limited Use requirements. Information is used only to provide or improve the user-facing focus, recommendation, recovery, and pet-progression features described in this policy. It is not sold, used for advertising, used for creditworthiness, transferred for unrelated purposes, or made available for developer-side human review. The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Children And Sensitive Data

FocusWhale is a general productivity tool and is not designed to collect information from children. Users should avoid entering confidential or personally identifying information in the medium-mode intent field because that text is retained locally until extension storage is cleared.

## Policy Changes

Material changes to data collection, permissions, transmission, or retention should be reflected in this file and in the released extension before publication. A future feature that introduces a backend or external AI service must require a separate, explicit privacy review and policy update.

## Contact

For support, privacy questions, or deletion questions, use [FocusWhale GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues). Do not include private browsing details, intent text, or other sensitive information in a public issue.

The intended stable public location for this policy is [the repository `PRIVACY.md`](https://github.com/lovebubbly/FocusWhale/blob/main/PRIVACY.md). Publication evidence must verify that exact HTTPS URL after the release-preparation commits are pushed.
