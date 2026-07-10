# FocusWhale v1.0.0 Release Checklist

Last refreshed: **2026-07-11 01:33 KST** by **OpenAI Codex (GPT-5)**, for requester and product owner **Choi Yunseong (최윤성)**.

The source version is 1.0.0, but this checklist is the publication gate. Unchecked blocking rows mean the product is not ready to submit.

## Automated Gate

- [x] `npm run typecheck` passes.
- [x] `npm test` passes: 30 files / 196 tests.
- [x] `npm run build` passes.
- [x] Content script is a classic IIFE (116,276 bytes).
- [x] Manifest targets exist.
- [x] WAR list contains exactly four reviewed resources.
- [x] Production output contains no source maps.
- [x] Production JS/CSS/HTML/JSON contains no unexpected external URLs.
- [x] Packaged Pretendard OFL exactly matches the source license.
- [x] Atlas report validates 384 x 1,920, 4 x 20, 80 frames.
- [x] Release ZIP extracts byte-for-byte equal to exact final `dist/` with `manifest.json` at the root.

## Live Final-Build QA

- [x] Load the exact rebuilt `dist/` in isolated headless Whale profiles and exercise that exact output. **Whale 4.38 / Chromium 148**
- [x] Popup active state and visible focus pet in Whale. **Headless exact-final pass**
- [x] Active-session options lock is visible in Whale. **Headless exact-final pass**
- [x] Trailing-dot, credential-bearing `x.com.` navigation redirects in Whale. **Headless exact-final pass**
- [x] Blocked return target retains the path/trailing hostname dot while stripping credentials, query, and fragment. **Headless exact-final pass; HSTS upgraded HTTP to HTTPS**
- [x] Medium commits exactly one temporary-allow transaction, then expires and reblocks. **Whale and Chrome for Testing exact-final pass**
- [x] Deterministic return-to-focus `about:blank` exit. **Headless exact-final pass**
- [x] Popup idle and multi-digit custom duration. **Headless exact-final pass: 2 -> 24 -> 240**
- [x] Natural completion creates one completion log and separately acknowledged reward panels; acknowledgement stays dismissed after reload. **Headless exact-final pass**
- [x] Hard confirmation, pending reload, five-minute deadline, and weekly rejection. **Headless exact-final pass**
- [x] Emergency-end a scheduled hard session and verify the same occurrence does not restart before its exact window end, including a sub-minute reconcile offset. **Headless exact-final pass**
- [x] Full soft overlay flow on a real host page. **Whale and Chrome for Testing exact-final pass**
- [x] Pet name persistence across popup/options/browser restart. **Headless exact-final pass**
- [x] Optional history grant/analyze/revoke, domain-only output, extension-URL exclusion, and post-revoke core use. **Headed Chrome for Testing 147 exact-build pass**
- [ ] Long history analysis does not delay session completion, and a successful local clear invalidates an older in-flight result. **Automated current; headed stress check pending**
- [x] Local-data clear when idle and rejection while active. **Headless exact-final pass**
- [x] Restart before `endsAt` preserves the active session, rules, alarm, name, and lock across a real browser PID change. **Headless exact-build pass; overdue-at-start restart and fault injection remain open in `QA.md`**
- [x] Light/dark visual and contrast matrix. **Headed Whale exact-build pass: 13 states, 68 contrast checks, minimum 4.94:1, 19 screenshots, no page errors**
- [x] Reduced-motion matrix for overlay, all 20 pet states, and completion. **Headless/headed exact-build pass**
- [x] All five stages x four moods in installed extension. **20 sprites / 20 atlas rows**
- [x] Chrome cross-check for core redirect/overlay behavior. **Chrome for Testing 147 exact-final soft/medium pass**

The core matrix passed in Whale. The exact headed pass additionally covered list-rerender dismissal, blank intent, Options keyboard/modal focus, normal/reduced completion motion, and the full visual/accessibility sweep. Chrome for Testing 147 accepted the real optional-history prompt and passed grant/results/revoke/post-revoke core use. Stock Google Chrome 148 rejects command-line unpacked extensions before FocusWhale runs, so it is not counted as an application failure or pass. Local screenshots were used for visual assertions; no recording or external upload occurred.

## Privacy And Security

- [x] Reconcile `PRIVACY.md` against final retention and in-product clear behavior.
- [x] Set [GitHub Issues](https://github.com/lovebubbly/FocusWhale/issues) as the support/privacy contact channel.
- [ ] Publish `PRIVACY.md` at a stable public HTTPS URL.
- [ ] Add the public privacy URL to store metadata.
- [x] Secret/privacy scan passes against the exact current candidate and release archive; archive token/path/email scan has no findings.
- [ ] Repeat the scan against the exact release commit if it differs from the current artifact.
- [x] Confirm no real browsing exports, browser profiles, extension storage, or personal screenshots are included.
- [x] Sanitize machine-specific `/Users/...` paths from `docs/SNSLOCK_CORE_CONCEPT_PORT_PLAN.md`.
- [ ] Review all permissions/host permissions and write store justifications.
- [x] Confirm no backend, telemetry, advertising, remote AI, CDN, or remote font was introduced.

## Package

- [x] Review `git status` and final diff; preserve intentional user changes.
- [ ] Commit the exact reviewed candidate.
- [ ] Rebuild from the release commit in a clean dependency environment.
- [x] Create `release/FocusWhale-1.0.0.zip` from the exact final `dist/` with the manifest at archive root.
- [x] Load the extracted ZIP into a clean profile and smoke test it. **MV3 v1.0.0 popup and exact 116,276-byte content bundle passed under extension ID `codbhopmpipbogplaofkgndjeoemjbck`**
- [x] Record archive size: 2,693,022 bytes.
- [x] Record and verify SHA-256: `4d766244997647161b63a6d7f5018970e5ab7df94a99af82cecfd6aa7469af0f`.
- [x] Confirm manifest/name/description/version/icons.
- [x] Confirm the archive is byte-equal to exact final `dist/`: 32 entries / 24 files.
- [x] Confirm no source maps, tests, TypeScript, generated source sheets, or private docs are in the ZIP.
- [ ] Create signed Git tag/release notes if the project uses tags.

## Store Materials

- [ ] Choose target store(s): Whale, Chrome Web Store, or both.
- [ ] Prepare listing title, short description, full description, category, and language coverage.
- [ ] Prepare final screenshots from the release build only.
- [ ] Prepare required promotional/store images without personal browser data.
- [ ] Add support URL and monitored support contact.
- [ ] Add privacy URL.
- [ ] Write reviewer instructions for blocklist/medium/hard/optional-history testing.
- [ ] Document why broad HTTP(S) host access and the content script are necessary.
- [ ] Confirm whether a top-level software license is required and select one deliberately.

## Approval And Publication

- [ ] Product owner reviews unresolved QA evidence and accepts/rejects exceptions.
- [ ] Product owner approves listing copy/assets/privacy disclosures.
- [ ] Submit to the selected store(s).
- [ ] Record submission ID/date/account owner.
- [ ] Resolve reviewer feedback without weakening wellness/privacy invariants.
- [ ] Record approval/publication URLs and dates.
- [ ] Update `CHANGELOG.md` from local release candidate to public release only after publication.

## Current Decision

**Not ready for store submission yet.** Automated gates, headed usability/accessibility/history checks, the core browser matrix, the clean-profile extracted-archive smoke test, and the archive audit pass. Overdue-start and destructive recovery-journal checks remain open, as do public policy verification, permission justifications, store materials, the exact reviewed commit/rebuild/tag decision, top-level license decision, and owner approval.
