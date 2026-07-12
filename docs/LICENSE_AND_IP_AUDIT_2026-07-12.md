# Focus Dolphin License And IP Release Audit

Status: **conditional pass; public submission blocked on exact renamed-package and external-record review**
Prepared: **2026-07-12 KST**
Prepared by: **OpenAI Codex (GPT-5)** for product owner **Choi Yunseong (최윤성)**

This is a repository and public-source due-diligence record, not legal advice or a trademark opinion. It can prove what is present in the source/package and identify obvious public conflicts. It cannot guarantee non-infringement, patent freedom to operate, trademark availability in every jurisdiction, or copyright protection for AI-generated material.

## Bottom Line

The code, bundled font, CSS tooling, generated mascot, and derived icon/promo assets have a defensible recorded distribution path. The extension ZIP can remain proprietary while carrying the bundled third-party licenses.

The product owner selected **Focus Dolphin — Website Blocker** before the first public store release. `FocusWhale` was the unreleased development codename and is not the intended public brand. That pre-release rename removes the known exact-name conflict with the active Focuswhale productivity business, but the limited Focus Dolphin knock-out search below is not legal clearance. After the Apple metadata correction was explained, Choi Yunseong directed the team to proceed on 2026-07-12, accepting the documented residual knock-out-screen risk. Live GitHub/dashboard renames and review of the exact renamed package and screenshots remain required.

## Original Work And Repository License

- The top-level `LICENSE` reserves Focus Dolphin's original source, documentation, and visual assets while granting end users permission to install and use an officially distributed extension.
- Third-party materials remain under their own terms; the repository license does not attempt to relicense them.
- `assets/sprites/focuswhale-placeholder.svg` retains the CC0-style public-domain dedication recorded when it was introduced. The explicit exception in `LICENSE` avoids implying that a later proprietary notice revoked that dedication.
- A public GitHub repository without an open-source license remains viewable/forkable under GitHub's platform terms, but does not grant a general right to copy, modify, or redistribute the project. See [GitHub's licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

## Bundled Third-Party Components

| Component | Use in release | License evidence | Result |
| --- | --- | --- | --- |
| Pretendard Variable | Bundled UI font | Full SIL OFL 1.1 in `public/licenses/Pretendard-LICENSE.txt`; source/public/dist copies are byte-identical | Pass |
| Tailwind CSS | Compiled production CSS | Complete MIT notice in `public/licenses/THIRD-PARTY-NOTICES.txt` | Pass |
| daisyUI | Compiled production CSS/components | Complete MIT notice in `public/licenses/THIRD-PARTY-NOTICES.txt` | Pass |
| Vite core runtime | Build-emitted module/runtime helpers | MIT notice and attribution in `public/licenses/THIRD-PARTY-NOTICES.txt` | Pass |

No runtime npm package, external font, CDN, analytics SDK, advertising SDK, remote script, or remote image is loaded by the production bundle. The CDN references under archived static `mockups/` do not enter `dist/` or the extension ZIP.

The clean release archive must still contain both license files under `licenses/`, and the extracted-archive scan must confirm their byte identity before upload.

## Mascot, Icons, And Promotional Art

- The four current v4 dolphin mascot source sheets were generated specifically for this repository with OpenAI image generation. Selected outputs, transparent intermediates, and deterministic assembly inputs are checked in under `assets/sprites/generated/v4/`; earlier v3 whale materials remain historical provenance and are not runtime art.
- `assets/sprites/atlas-report.json` records dimensions, sizes, and SHA-256 hashes for the generated source sheets, transparent inputs, and final 80-frame atlas.
- `scripts/generate-focusdolphin-icons.py` derives the 16/32/48/128 extension icons, store icon, and 440x280 Chrome promotional tile from the documented mature-dolphin idle frame. It adds only a project-authored teal badge/background, sizing, and shadow.
- The current 128px packaged and store icons are byte-identical. No third-party logo, icon library, stock art, or font is present in these assets.
- Under the [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/), as between the user and OpenAI and to the extent permitted by law, the user owns output. Those terms also warn that output may not be unique and place responsibility for lawful use on the user. The recorded provenance therefore supports distribution but is not a non-infringement warranty.

## External Design References

The current tracked product, public listing copy, and store assets contain no named third-party design brand, logo, screenshot, score, navigation, slogan, or copied media. The durable design decision in `DECISIONS.md` limits external references to generic information hierarchy and explicitly rejects copied branding, imagery, copy, permissions, and platform-specific semantics.

Visual similarity cannot be cleared by a text search alone. Final screenshots must be reviewed for overall trade-dress confusion before upload, but the present Focus Dolphin mascot, browser-specific flows, local-first privacy model, copy, and information architecture are materially project-specific.

## Store Policy Fit

- [Chrome Web Store policy](https://developer.chrome.com/docs/webstore/program-policies/policies) prohibits impersonation and infringement of patent, trademark, trade secret, copyright, and other proprietary rights, and applies that rule to the full product and listing.
- [Whale Store review guidance](https://developers.whale.naver.com/review_guides/) likewise prohibits infringement involving trademarks, patents, copyrighted works, third-party services, and media.
- The package and listing must not imply endorsement by Google, Chrome, NAVER, Whale, OpenAI, Notion, or any other company.

## Development-Codename Conflict And Search Limitation

The 2026-07-12 search found:

- an active exact-name commercial productivity site at <https://focuswhale.com/> selling Notion productivity systems at published prices from USD 20 to USD 49 and claiming thousands of customers;
- an official Notion Marketplace creator profile for **FocusWhale**, linked to `focuswhale.com`, with 57 published templates: <https://www.notion.com/templates/course-tracker-861>;
- an active `FOCUSWHALE.COM` registration in Verisign RDAP with a creation date of 2024-06-01: <https://rdap.verisign.com/com/v1/domain/FOCUSWHALE.COM>;
- no exact FocusWhale extension result in indexed Chrome Web Store or Whale Store searches;
- no exact result from the narrow USPTO wording queries attempted;
- incomplete WIPO, EUIPO/TMview, and Korean registration coverage because the available public interfaces could not all be searched conclusively.

The negative results are not clearance. Search indexing may be incomplete, unregistered/common-law rights may exist, and trademark rights are territorial and class-specific. The [USPTO's own search guidance](https://www.uspto.gov/trademarks/search/federal-trademark-searching) says a clearance search must consider confusingly similar marks, related goods/services, alternative spellings and pronunciations, and sources outside its federal database. The active adjacent-use conflict was enough to reject `FocusWhale` as the public name; it remains here to document the pre-release decision, not as an unresolved public-brand choice.

Exploratory replacement candidates `Whalune`, `Nudgefin`, `TideNudge`, and `Pausail` produced no obvious exact collision in limited general-web and indexed Chrome/Whale Store searches. They are **not cleared names**: domains, social handles, phonetic/similarity searches, relevant classes and territories, and counsel review remain open. They are recorded only to make a pre-launch rename cheaper, not as legal conclusions.

### Focus Dolphin Candidate Screen

The product owner proposed **Focus Dolphin** because it communicates the category more directly. The 2026-07-12 knock-out screen found:

- zero exact or combined `FOCUS DOLPHIN`, `FOCUSDOLPHIN`, or `DOLPHIN FOCUS` results in the official USPTO production search queries attempted;
- no exact returned/indexed item in Google Play, Chrome Web Store, or Whale Store;
- a Verisign RDAP 404 and no DNS resolution for `focusdolphin.com` at the time of checking;
- live `DOLPHIN` software marks in unrelated healthcare software categories; and
- an active Apple App Store listing visibly titled **US Browser-ad blocker Browser**, with the visible subtitle **Web Search Browsing Engine**. A Canadian web response also exposed `Volt Focus Dolphin Browser` as a secondary metadata string, while the product owner's live Korean storefront showed no Dolphin branding: <https://apps.apple.com/ca/app/us-browser-dark-web-browser/id1609766035>.

**Correction recorded 2026-07-12:** the Apple listing must not be treated as a competing **Focus Dolphin** product. Its visible product identity is **US Browser**, and the isolated regional metadata string may be legacy localization or app-store optimization text. It is weak search noise, not evidence of an active `Focus Dolphin` brand, and it does not materially worsen this candidate's knock-out result.

The corrected screen therefore leaves **Focus Dolphin** as a reasonable conditional-go candidate: no exact collision surfaced in the official USPTO queries or the indexed app/extension stores checked, and the exact `.com` appeared unregistered and unresolved at the time of checking. It is still not legal clearance. WIPO, EUIPO/TMview, KIPRIS/KIPO, broader confusing-similarity searches, and common-law use remain inconclusive and should be completed before asserting exclusivity.

The selected name required a coherent dolphin mascot/copy migration while preserving legacy storage keys, alarm namespaces, XP thresholds, badge IDs, and other installed-state contracts. The current v4 atlas and public copy now implement that identity; the exact integrated package and fresh screenshots still require verification.

### Straightforward Ocean-Compatible Candidates

A second 2026-07-12 knock-out screen prioritized names that begin with `Focus`, explain the category, and keep the existing whale mascot coherent:

| Candidate | Exact screen | Practical result |
| --- | --- | --- |
| **Focus Depth — Website Blocker** | No exact product/store result surfaced; official USPTO exact combined-mark query returned zero | Recommended for clarity and current-mascot fit. `focusdepth.com` is registered but had no DNS, so use another support domain or GitHub. The phrase is somewhat descriptive and therefore less ownable. |
| **Focus Breakwater** | No exact product/store result surfaced; official USPTO exact query returned zero; `focusbreakwater.com` returned Verisign RDAP 404 | Strongest availability/defensibility signal, but longer and less familiar to non-native English speakers. |
| **Whalune: Focus Site Blocker** | No exact Chrome, Whale, Google Play, Apple, GitHub, or general-web result surfaced | Distinctive and mascot-compatible, but similar names `Thalune`, `SHALUNE`, `WHALUNA`, and `Whaleden` require deeper similarity review; several official international checks remain incomplete. |

`Focus Harbor`, `Focus Reef`, `Focus Buoy`, `Focus Cove`, and `Focus Tide` were rejected after direct adjacent productivity/focus-product conflicts surfaced. `Focus Current`, `Focus Afloat`, `Focus Wake`, and `Focus Shoal` passed narrow exact screens but were weaker in domain availability, category clarity, or ordinary-language comprehension.

Under the owner's explicit “straightforward title” criterion, **Focus Dolphin — Website Blocker** is the selected conditional-go. The Apple link above is not a naming blocker. The alternatives remain historical screening notes only. The selected name is not legally cleared by this knock-out screen, and a descriptive store-title suffix does not create trademark clearance.

## Release Gates

- [x] Project and third-party license boundaries documented.
- [x] Full Pretendard OFL packaged.
- [x] Tailwind CSS, daisyUI, and Vite notices packaged.
- [x] Generated mascot source and deterministic atlas provenance recorded.
- [x] Extension/store icon and promo derivation made reproducible.
- [x] Current tracked materials contain no named external design reference or third-party logo.
- [x] Reject the conflicting development codename and select a distinct public product name: **Focus Dolphin — Website Blocker**.
- [x] Replace current runtime mascot art and public animal-specific copy with a coherent dolphin identity while retaining compatibility identifiers and historical evidence labels.
- [x] Record product-owner acceptance of the documented residual Focus Dolphin knock-out-screen risk. **Accepted by Choi Yunseong on 2026-07-12 after the Apple metadata correction; this is not legal clearance.**
- [ ] Complete broader international, common-law, and confusing-similarity review before asserting exclusivity; professional review remains recommended.
- [ ] Rename and verify the intended `lovebubbly/FocusDolphin` GitHub repository/URLs and both independent store dashboard records.
- [ ] Inspect the exact final Focus Dolphin ZIP and screenshots after integration.
- [ ] Record the final owner decision and evidence in `RELEASE_CHECKLIST.md` before either store submission.

## Recorded Decision

Choi Yunseong selected **Focus Dolphin — Website Blocker** and accepted the documented conditional-go risk on 2026-07-12 after correction of the irrelevant Apple-listing evidence. Do not publish under `FocusWhale`, and do not relabel historical whale archives or screenshots. Preserve development-only compatibility identifiers where migration would reset installed state or invalidate evidence. Complete the remaining repository, dashboard, exact-package, and screenshot gates before either store submission.
