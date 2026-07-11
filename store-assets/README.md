# FocusWhale store images

Publication images for the FocusWhale browser-extension listings. These files
are repository collateral only: `store-assets/` is not copied into `dist/` and
must not be included in the extension ZIP.

## Deliverables

| File | Dimensions | Intended use |
| --- | ---: | --- |
| `01-session-flow-1280x800.png` | 1280 x 800 | Popup before, during, and after a focus session |
| `02-completion-growth-1280x800.png` | 1280 x 800 | Session completion result and whale growth |
| `03-focus-friction-1280x800.png` | 1280 x 800 | Confirm-to-allow and full-block pages |
| `04-local-insights-1280x800.png` | 1280 x 800 | Local records and optional history-based recommendations |
| `05-onboarding-en-1280x800.png` | 1280 x 800 | Goal 7 first-install onboarding in English |
| `06-onboarding-ko-1280x800.png` | 1280 x 800 | Goal 7 first-install onboarding in Korean |
| `chrome-small-promo-440x280.png` | 440 x 280 | Chrome Web Store small promotional tile |
| `focuswhale-icon-128.png` | 128 x 128 | Store icon; byte-identical copy of the packaged icon |

The six listing screenshots use the Chrome Web Store's 1280 x 800 accepted
size and are also suitable for a Whale listing. The optional 1400 x 560 marquee
image is intentionally omitted; it is not needed for the initial submission.

## Source evidence

The product frames in `01` through `04` come from the prior v1.0.0 exact-build
browser QA captures created on 2026-07-11:

- `/tmp/focuswhale-qa-headed-visual-final/headed-popup-idle-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-popup-active-medium-light.png`
- `/tmp/focuswhale-qa-headed-final/popup-completion-normal-light-headed.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-options-growth-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-blocked-medium-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-blocked-hard-light.png`
- `/tmp/focuswhale-qa-headed-visual-final/headed-options-insights-light.png`
- `/tmp/focuswhale-qa-headed-final-cft/options-history-controlled-domain-only-headed.png`
- `public/icons/focuswhale-128.png`

`05` and `06` were captured directly at 1280 x 800 from the rebuilt Goal 7
`dist/` in isolated visible Whale 4.38 profiles on 2026-07-11. They show the
same first onboarding step in English and Korean, including the final
browser-sync disclosure and locally bundled pet/font assets. They contain no
profile, account, browsing-history, or user-entered data.

The four earlier core-flow composites remain accurate regression collateral,
but they predate the localized executable. Repeat or explicitly approve those
core-flow captures against the committed Goal 7 package before store upload.

The listing screenshots contain only authentic product captures. The captures
were scaled uniformly, tightly cropped, and arranged without a marketing frame;
the blocked-page sides and the tall options views were viewport-clipped without
changing UI content. The completion popup has a 16 px safety inset so its full
`FocusWhale` title remains unambiguous at the original 1280 x 800 size. No
marketing headline or explanatory copy was added to the product screenshots.
The promotional tile is a saturated, full-bleed FocusWhale brand-color field
containing only the packaged whale icon. The browser history example uses
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
da2a81b8eb106f3637fa8d143468ebd5f9fa4b89c17752cd29a5c707f0aa991f  chrome-small-promo-440x280.png
674a262e14eddd580d4e81462b0eb306f9dd0c86363e803965de1e4816245b55  focuswhale-icon-128.png
```
