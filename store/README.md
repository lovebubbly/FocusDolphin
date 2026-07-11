# FocusWhale Store Submission Pack

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** on **2026-07-11 KST**.

This directory contains paste-ready metadata for FocusWhale 1.0.0. It does not change or enter the extension ZIP. The current `release/FocusWhale-1.0.0.zip` is 2,754,338 bytes with SHA-256 `cba02253a1422d8f19ed7ddb16288f0c51a442656cbd02cf459740e68b5656a0`; its extracted tree is byte-equal to `dist/`. Exact English/Korean onboarding captures are ready, while the ordinary-browser active-session smoke and four core-flow screenshot refreshes remain pending.

## Selected 1.0 Path

FocusWhale 1.0.0 remains **Naver Whale first**, with the same local MV3 bundle prepared as a Chrome Web Store submission baseline. The extension now includes Korean and English interfaces plus localized manifest metadata. The browser chooses a supported locale automatically, with English as the fallback.

The same 1.0.0 source also includes a bundled three-step onboarding page. It opens automatically only after a new install, can be skipped or completed without starting a session, and can be replayed from Options. Onboarding does not request the optional browser-history permission.

Whale and Chrome submissions are independent: each receives a separate item ID, listing, review, update history, and publication URL.

## Files

- `STORE_LISTING.md`: production Korean and English listing copy.
- `PERMISSIONS_AND_PRIVACY.md`: dashboard declarations and permission justifications.
- `REVIEWER_INSTRUCTIONS.md`: repeatable bilingual reviewer path with no account or credentials.
- `RELEASE_NOTES_1.0.0.md`: first-release notes.
- `../store-assets/`: screenshots and promotional images outside the extension package; exact onboarding captures are current, while four core-flow composites remain prior-build collateral.

## Official Requirements Checked

Requirements were rechecked on 2026-07-11 against the [Whale distribution guide](https://developers.whale.naver.com/distribution), [Whale review guide](https://developers.whale.naver.com/review_guides/), [Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Chrome image requirements](https://developer.chrome.com/docs/webstore/images), [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [Chrome test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions).

Whale currently accepts MV3 ZIP submissions and requires a 128 x 128 icon plus one to four screenshots. Chrome requires the packaged 128 x 128 icon, one to five screenshots, and a 440 x 280 promotional tile. Shared screenshots use the stricter 1280 x 800 format.

## Owner-Only Submission Steps

1. Review both Korean and English listing copy, privacy disclosures, localized screenshots, and the license choice.
2. Confirm that GitHub Issues will be monitored without asking users to post private browsing details.
3. Recheck the already verified public privacy-policy URL at submission time.
4. Confirm the ZIP contains Pretendard's SIL OFL plus the Tailwind CSS, daisyUI, and Vite core MIT notices under `licenses/`.
5. Refresh the final ZIP checksum and size, then verify the install-only onboarding and core flows in Korean and English against that exact build.
6. Regenerate or approve screenshots that match the exact localized build.
7. Register or sign in to the selected publisher account.
8. Upload the checksum-verified ZIP and matching listing assets.
9. Request review, then record the store item ID, submission date, reviewer feedback, approval date, and public URL in `RELEASE_CHECKLIST.md`.

No document in this pack claims owner approval, store submission, or publication.

The repository's structured bug-report form collects browser/version and reproduction information while requiring the reporter to confirm that sensitive browsing and intent data were omitted.
