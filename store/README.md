# FocusWhale Store Submission Pack

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** on **2026-07-11 KST**.

This directory contains paste-ready metadata for FocusWhale 1.0.0. It does not change or enter the extension ZIP. The release artifact remains `release/FocusWhale-1.0.0.zip`.

## Selected 1.0 Path

The exact reviewed 1.0.0 package targets the **Naver Whale Store first**. That choice preserves the current English manifest description, Korean interface, and original product target. `STORE_LISTING.md` labels the English manifest value as the exact-package short description; its Korean replacement is a proposal that requires a separately authorized rebuild.

Chrome Web Store copy and privacy disclosures are prepared as a second submission baseline. Before uploading the same package to Chrome, the owner should authorize a new reviewed build with a browser-neutral manifest description. A full English listing should not imply an English interface until the extension is localized.

Whale and Chrome submissions are independent: each receives a separate item ID, listing, review, update history, and publication URL.

## Files

- `STORE_LISTING.md`: Korean production listing plus English reference copy.
- `PERMISSIONS_AND_PRIVACY.md`: dashboard declarations and permission justifications.
- `REVIEWER_INSTRUCTIONS.md`: repeatable reviewer path with no account or credentials.
- `RELEASE_NOTES_1.0.0.md`: first-release notes.
- `../store-assets/`: exact-build screenshots and promotional images, outside the extension package.

## Official Requirements Checked

Requirements were rechecked on 2026-07-11 against the [Whale distribution guide](https://developers.whale.naver.com/distribution), [Whale review guide](https://developers.whale.naver.com/review_guides/), [Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Chrome image requirements](https://developer.chrome.com/docs/webstore/images), [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [Chrome test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions).

Whale currently accepts MV3 ZIP submissions and requires a 128 x 128 icon plus one to four screenshots. Chrome requires the packaged 128 x 128 icon, one to five screenshots, and a 440 x 280 promotional tile. Shared screenshots use the stricter 1280 x 800 format.

## Owner-Only Submission Steps

1. Review the Korean listing, privacy disclosures, screenshots, and license choice.
2. Confirm that GitHub Issues will be monitored without asking users to post private browsing details.
3. Recheck the already verified public privacy-policy URL at submission time.
4. Confirm the ZIP contains Pretendard's SIL OFL plus the Tailwind CSS, daisyUI, and Vite core MIT notices under `licenses/`.
5. Register or sign in to the selected publisher account.
6. Upload the exact checksum-verified ZIP and the prepared listing assets.
7. Request review, then record the store item ID, submission date, reviewer feedback, approval date, and public URL in `RELEASE_CHECKLIST.md`.

No document in this pack claims owner approval, store submission, or publication.

The repository's structured bug-report form collects browser/version and reproduction information while requiring the reporter to confirm that sensitive browsing and intent data were omitted.
