# Focus Dolphin store images

Prepared by **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)** and refreshed on **2026-07-13 KST**.

Publication images for **Focus Dolphin — Website Blocker** 1.0.0. These files are repository collateral only: `store-assets/` is excluded from `dist/` and from the extension ZIP.

## Current submission set

| File | Dimensions | Exact-package content |
| --- | ---: | --- |
| `01-session-flow-1280x800.png` | 1280 x 800 | Idle, active 95-minute session, and completed-session dolphin growth |
| `02-focus-friction-1280x800.png` | 1280 x 800 | Initial `x.com` intervention and the 30-second intention gate |
| `03-growth-and-session-lock-1280x800.png` | 1280 x 800 | +114 XP growth overview and immutable active-session Options state |
| `04-local-preferences-1280x800.png` | 1280 x 800 | Explicit language selection and optional on-device history analysis |
| `05-onboarding-en-1280x800.png` | 1280 x 800 | English local-first onboarding disclosure |
| `chrome-small-promo-440x280.png` | 440 x 280 | Chrome Web Store small promotional tile |
| `focusdolphin-icon-128.png` | 128 x 128 | Store icon, byte-identical to the packaged 128 px icon |

Chrome receives all five screenshots. Whale receives `01` through `04`, satisfying its one-to-four screenshot boundary. The shared release set is English; Korean remains a fully supported interface and passed separate exact-package layout checks, but localized Korean listing screenshots are optional and are not being represented by relabeled English frames.

## Source evidence

Every product frame comes from the extracted, checksum-verified archive `release/focus-dolphin-1.0.0.zip`:

- ZIP SHA-256: `9477352d13105d1176c3cf540550b5a0252cbb2422528d92b943820bba1f5048`
- selected executable commit: `09d7e26`
- ordinary Whale exact-package report: `/tmp/focus-dolphin-raw-cdp-qa-2026-07-13T02-57-10-758Z/release-qa-report.json`
- Chrome for Testing exact-package report: `/tmp/focus-dolphin-exact-final-20260713-1130-v3/chrome-for-testing/chrome-for-testing-exact/exact-package-report.json`
- bilingual Whale report: `/tmp/focus-dolphin-bilingual-final-20260713-1042-v2/whale/whale/bilingual-report.json`
- bilingual Chrome report: `/tmp/focus-dolphin-bilingual-final-20260713-1042-v2/chrome-for-testing/chrome-for-testing/bilingual-report.json`

The first three images arrange authentic product captures over a full-bleed neutral product background. Frames were scaled uniformly without changing UI content. `04` is a top-aligned crop of the exact Options page, and `05` is the ordinary-Whale 1280 x 800 capture without recomposition. No marketing headline, testimonial, third-party mark, browser chrome, or explanatory overlay was added.

The only shown domain is `x.com`, exercised as a configured block target. The displayed intention is synthetic. The images contain no account, profile, personal browsing history, credential, private path, or user identity. All five were inspected at their original dimensions; edge-pixel checks also confirmed that the neutral full-bleed background was not corrupted by the image viewer.

The promotional tile and icons are generated deterministically by `scripts/generate-focusdolphin-icons.py` from the documented mature-dolphin atlas frame. They contain no third-party logo or copied media.

## SHA-256

```text
ebefc983f5a541c06ffdcbb0969ba778e0787cb8b832d42e005d7967b1df28fb  01-session-flow-1280x800.png
3a8e916d8698254c800bbbd95c222f23afd2b0d6483459dd6da91b8ea9d2a732  02-focus-friction-1280x800.png
4c1d95ed0f68c88fa463a9c5ae1d2c7dfa7e0688dac8c7f9ce50b66a602e9597  03-growth-and-session-lock-1280x800.png
22010050c29e2e675a9010cf07bdb85358858ca5e4f5820c8db6e9ab3b71ed13  04-local-preferences-1280x800.png
befba72b04d5d6114c160d37a3b238446af017a6aa9d0ef7e340ba286c83c063  05-onboarding-en-1280x800.png
96cd9dc42c9f52ffe09e364e95b5c143a5fc05ff430a795f5d248662f8346671  chrome-small-promo-440x280.png
f2aad78150573693d4236377b830017315890d2c8f59cc85fabb2d0cc08e4714  focusdolphin-icon-128.png
```
