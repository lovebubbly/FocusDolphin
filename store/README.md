# Focus Dolphin Store Submission Pack

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** and refreshed on **2026-07-12 KST**.

This directory contains paste-ready metadata for **Focus Dolphin — Website Blocker** 1.0.0. It does not enter the extension ZIP. Every existing `FocusWhale` ZIP and whale screenshot is a historical development artifact and must not be uploaded or relabeled. All listing screenshots must be replaced with exact-package Focus Dolphin captures before submission.

## Selected 1.0 Path

Focus Dolphin 1.0.0 targets **Chrome Web Store and Whale Store in parallel**. One clean, checksum-verified MV3 ZIP may be reused after exact-package smoke testing in both browsers, but each store receives independent metadata, item IDs, reviews, and publication URLs. The extension includes Korean and English interfaces plus localized manifest metadata; users may select Automatic, English, or Korean, with English as the unsupported-locale fallback.

The same 1.0.0 source also includes a bundled three-step onboarding page. It opens automatically only after a new install, can be skipped or completed without starting a session, and can be replayed from Options. Onboarding does not request the optional browser-history permission.

Whale and Chrome submissions are independent: each receives a separate item ID, listing, review, update history, and publication URL.

## Files

- `STORE_LISTING.md`: production Korean and English listing copy.
- `PERMISSIONS_AND_PRIVACY.md`: dashboard declarations and permission justifications.
- `REVIEWER_INSTRUCTIONS.md`: repeatable bilingual reviewer path with no account or credentials.
- `RELEASE_NOTES_1.0.0.md`: first-release notes.
- `../store-assets/`: screenshots and promotional images outside the extension package; the present screenshots are prior-build collateral and are not uploadable evidence for the final candidate.

## Official Requirements Checked

Requirements were rechecked on 2026-07-12 against the [Whale distribution guide](https://developers.whale.naver.com/distribution), [Whale review guide](https://developers.whale.naver.com/review_guides/), [Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Chrome image requirements](https://developer.chrome.com/docs/webstore/images), [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [Chrome test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions).

Whale currently accepts MV3 ZIP submissions and requires a 128 x 128 icon plus one to four screenshots. Chrome requires the packaged 128 x 128 icon, one to five screenshots, and a 440 x 280 promotional tile. Shared screenshots use the stricter 1280 x 800 format.

## Owner-Only Submission Steps

1. Record owner acceptance of the residual Focus Dolphin naming risk after the documented knock-out screen; this repository audit is not legal advice or full clearance.
2. Review both Korean and English listing copy, privacy disclosures, localized screenshots, and the license choice.
3. Rename the GitHub repository/remote to `lovebubbly/FocusDolphin`, verify its Issues and privacy-policy URLs live, and confirm that Issues will be monitored without asking users to post private browsing details.
4. Update the Chrome and Whale dashboard product names independently, then recheck the exact public privacy-policy URL at submission time.
5. From the selected clean commit, run all gates and `npm run package:release`; retain its ZIP, checksum, and per-file report.
6. Confirm the ZIP contains Pretendard's SIL OFL plus the Tailwind CSS, daisyUI, and Vite core MIT notices under `licenses/`.
7. Verify onboarding, language selection, and core flows in Korean and English in both Chrome and Whale against that exact package.
8. Regenerate or approve screenshots that match the exact localized package.
9. Complete Chrome publisher setup and Whale developer registration.
10. Upload the checksum-verified ZIP and matching listing assets to both dashboards.
11. Request both reviews, then record each store item ID, submission date, reviewer feedback, approval date, and public URL in `RELEASE_CHECKLIST.md`.

No document in this pack claims owner approval, store submission, or publication.

The repository's structured bug-report form collects browser/version and reproduction information while requiring the reporter to confirm that sensitive browsing and intent data were omitted.
