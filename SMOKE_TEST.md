# FocusWhale Goal 1 Smoke Test

Use a local Chromium or Naver Whale profile with the unpacked `dist/` extension loaded after `npm run build`.

## Console Checks

1. DNR rules
   - Start a medium blocklist session for `example.com`.
   - In the extension service worker console:
     ```js
     await chrome.declarativeNetRequest.getDynamicRules()
     ```
   - Expected: one redirect rule in the `1-999` range with `resourceTypes: ["main_frame"]` and `requestDomains: ["example.com"]`.

2. Alarms
   - In the service worker console:
     ```js
     await chrome.alarms.getAll()
     ```
   - Expected: `focuswhale:session-end` exists while a session is active. Temporary allows add a `focuswhale:temp-allow:<domain>` alarm.

3. Storage
   - In the service worker console:
     ```js
     await chrome.storage.local.get(["activeSession", "tempAllows", "sessionLog", "intentLog"])
     ```
   - Expected: `activeSession` is present during a session, `tempAllows` appears after a medium override, and completed/aborted/interrupted sessions are appended to `sessionLog`.

4. History/back behavior
   - Open a blocked domain, use the blocked page `되돌아가기` button.
   - Expected: the tab navigates back when history exists. If there is no prior history, the page attempts to close the tab.

## Manual Scenarios

1. Medium blocklist
   - Create a blocklist containing `example.com`.
   - Start a medium session.
   - Visit `https://example.com`.
   - Expected: the blocked page shows the domain, remaining time, and an empty `div#pet-slot`.
   - Click `그래도 열기`, wait for the 30 second countdown, enter one line of intent, and submit.
   - Expected: `intentLog` records the reason, a 5 minute temp allow rule is installed in the `1000-1999` range, and after the temp allow alarm expires the site is blocked again.

2. Hard allowlist
   - Create an allowlist with only a known safe domain such as `developer.chrome.com`.
   - Start a hard session.
   - Visit a domain outside the list.
   - Expected: the blocked page shows no temporary allow UI. Only `비상 종료 요청` is available.

3. Emergency valve
   - During a hard session, click `비상 종료 요청`.
   - Expected: the page shows a 5 minute countdown. The service worker has `focuswhale:emergency-end`, and the session finalizes as `aborted` after the alarm.

4. Browser restart restore
   - Start a medium or hard session, close and reopen the browser before `endsAt`.
   - Expected: `onStartup` reconciles `activeSession`, reinstalls DNR rules, and recreates the session-end alarm.
   - Repeat with a session whose `endsAt` is already in the past before startup.
   - Expected: it is recorded in `sessionLog` with `status: "interrupted"` and active rules are removed.

5. Soft overlay
   - Start a soft session for a blocklisted domain.
   - Visit that domain.
   - Expected: a full-page shadow DOM overlay appears, `계속하기` enables after 10 seconds, and `되돌아가기` is available immediately.
