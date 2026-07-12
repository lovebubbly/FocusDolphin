# Focus Dolphin store images

Publication images for the Focus Dolphin browser-extension listings. These files
are repository collateral only: `store-assets/` is not copied into `dist/` and
must not be included in the extension ZIP.

## Deliverables

| File | Dimensions | Intended use |
| --- | ---: | --- |
| `01-session-flow-1280x800.png` | 1280 x 800 | Popup before, during, and after a focus session |
| `02-completion-growth-1280x800.png` | 1280 x 800 | Historical session completion result and whale growth; replace before submission |
| `03-focus-friction-1280x800.png` | 1280 x 800 | Confirm-to-allow and full-block pages |
| `04-local-insights-1280x800.png` | 1280 x 800 | Local records and optional history-based recommendations |
| `05-onboarding-en-1280x800.png` | 1280 x 800 | Goal 7 first-install onboarding in English |
| `06-onboarding-ko-1280x800.png` | 1280 x 800 | Goal 7 first-install onboarding in Korean |
| `chrome-small-promo-440x280.png` | 440 x 280 | Chrome Web Store small promotional tile |
| `focusdolphin-icon-128.png` | 128 x 128 | Focus Dolphin store icon; byte-identical copy of the packaged icon |

The six listing screenshots use the Chrome Web Store's 1280 x 800 accepted
size and are also suitable for a Whale listing. The optional 1400 x 560 marquee
image is intentionally omitted; it is not needed for the initial submission.

## Source evidence

The product frames in `01` through `04` come from the prior v1.0.0 FocusWhale exact-build
browser QA captures created on 2026-07-11:

- `/tmp/focuswhale-qa-headed-visual-final/headed-popup-idle-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-popup-active-medium-light.png`
- `/tmp/focuswhale-qa-headed-final/popup-completion-normal-light-headed.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-options-growth-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-blocked-medium-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-blocked-hard-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-options-insights-light.png`
- `/tmp/focuswhale-qa-headed-final-cft/options-history-controlled-domain-only-headed.png`
- `public/icons/focuswhale-128.png` (historical source path at capture time)

`05` and `06` were captured directly at 1280 x 800 from the rebuilt Goal 7
`dist/` in isolated visible Whale 4.38 profiles on 2026-07-11. They show the
same first onboarding step in English and Korean, including the final
browser-sync disclosure and locally bundled pet/font assets. They contain no
profile, account, browsing-history, or user-entered data.

All six screenshots remain accurate historical regression collateral, but they
predate the Focus Dolphin name and mascot. They must be replaced from the exact
Focus Dolphin package before store upload; do not relabel them.

The historical listing screenshots contain only authentic product captures. The captures
were scaled uniformly, tightly cropped, and arranged without a marketing frame;
the blocked-page sides and the tall options views were viewport-clipped without
changing UI content. The completion popup has a 16 px safety inset so its full
`FocusWhale` development title remains unambiguous at the original 1280 x 800 size. No
marketing headline or explanatory copy was added to the product screenshots.
The current promotional tile and extension/store icons are generated deterministically
by `scripts/generate-focusdolphin-icons.py` from the documented mature-dolphin idle
frame in `assets/sprites/focusdolphin-atlas.png`; the script adds only a
project-authored teal field/badge, sizing, and shadow. The browser history example uses
reserved synthetic domains, and no image contains personal browsing data,
account details, or credentials.

All composition inputs were local. The rendering process made no external
network request. Outputs were visually inspected at their original dimensions.

## SHA-256

```text
05c4e542b741442e6eb1b47faa6ec0f9ab37380d94453805c360ea89aaf95ee3  01-session-flow-1280x800.png
52d12c5a2c4c8b7cefd3e5710795a42ee7b8d8806f591ed8f1fd597989f8e060  02-completion-growth-1280x800.png
760b5c065f5a7d1f54d4b9b22871f273b1c3ad9ba40c03ecd4f7ab1923ae59c7  03-focus-friction-1280x800.png
8d459a5c9757ccb320b58c3c9fcbba7045c3ed2dae53bae6553c2717b47eb732  04-local-insights-1280x800.png
40dfcff90b07c9f55cc11aa2e3e2a743e278cd3c292a5d6e9c54127fb092493a  05-onboarding-en-1280x800.png
7216384825263d0280b20e6d072515f5c288f9cf358550c556f355a6da6b19d1  06-onboarding-ko-1280x800.png
96cd9dc42c9f52ffe09e364e95b5c143a5fc05ff430a795f5d248662f8346671  chrome-small-promo-440x280.png
f2aad78150573693d4236377b830017315890d2c8f59cc85fabb2d0cc08e4714  focusdolphin-icon-128.png
```

The six screenshots above are historical and must be replaced after the final
name and exact release ZIP are fixed. Chrome accepts up to five listing
screenshots and Whale up to four, so the release set is four current English
and four current Korean 1280 x 800 captures, localized per store listing.
