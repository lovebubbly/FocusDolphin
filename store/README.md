# Focus Dolphin Store Submission Pack

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** and refreshed on **2026-07-15 KST**.

This directory contains the current update metadata for **Focus Dolphin — Website Blocker** 1.0.1 plus the historical 1.0.0 launch record. It does not enter the extension ZIP. Historical `FocusWhale` ZIPs and whale screenshots must not be uploaded or relabeled. The current `store-assets/` submission set contains only Focus Dolphin captures.

## Selected 1.0.1 Update Path

Focus Dolphin 1.0.1 was submitted to **Chrome Web Store and Whale Store in parallel** on 2026-07-15 KST. Both dashboards received the same deterministic MV3 ZIP: 3,716,109 bytes, 31 entries, SHA-256 `cc63612f2bf6bb667b851bcfeac89cf67ae6b5a8ad431bdcc89068daa3553bab`. Each store retains its independent item ID, listing, review, and publication record. The extension includes Korean and English interfaces plus localized manifest metadata; users may select Automatic, English, or Korean, with English as the unsupported-locale fallback.

The 1.0.1 update changes only gentle-overlay behavior. It adds no permission and does not change the existing onboarding, listing imagery, or optional-history boundary.

Whale and Chrome submissions are independent: each receives a separate item ID, listing, review, update history, and publication URL.

## Files

- `STORE_LISTING.md`: production Korean and English listing copy.
- `PERMISSIONS_AND_PRIVACY.md`: dashboard declarations and permission justifications.
- `REVIEWER_INSTRUCTIONS.md`: repeatable bilingual reviewer path with no account or credentials.
- `RELEASE_NOTES_1.0.0.md`: historical first-release notes.
- `RELEASE_NOTES_1.0.1.md`: English and Korean patch notes submitted to the update dashboards.
- `../store-assets/`: five current screenshots, icon, and promotional tile outside the extension package; source reports and checksums are recorded in its README.

## Official Requirements Checked

Requirements were rechecked on 2026-07-12 against the [Whale distribution guide](https://developers.whale.naver.com/distribution), [Whale review guide](https://developers.whale.naver.com/review_guides/), [Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Chrome image requirements](https://developer.chrome.com/docs/webstore/images), [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [Chrome test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions).

Whale currently accepts MV3 ZIP submissions and requires a 128 x 128 icon plus one to four screenshots. Chrome requires the packaged 128 x 128 icon, one to five screenshots, and a 440 x 280 promotional tile. Shared screenshots use the stricter 1280 x 800 format.

## Update Submission Record

1. The deterministic `focus-dolphin-1.0.1.zip` was rebuilt and validated from the committed patch source.
2. Chrome accepted the package as draft version 1.0.1 without permission changes; the owner authorized submission and the dashboard now reports **Pending review** with automatic publication after approval.
3. Whale accepted the same package as version 1.0.1; English and Korean update notes were saved before submission and the dashboard now reports **심사 중**.
4. Existing icons, screenshots, descriptions, privacy declarations, category, regions, and public visibility remain unchanged.
5. Public listings continue to serve version 1.0.0 until each independent review and rollout completes.

The repository's structured bug-report form collects browser/version and reproduction information while requiring the reporter to confirm that sensitive browsing and intent data were omitted.
