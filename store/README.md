# Store listing and launch

App Store text lives in `../store.config.json` and is pushed with EAS Metadata. Google Play has no metadata push, so its text is here to paste into the Play Console.

## Links

- Website and web version: https://overclock.expo.app/
- Support: https://overclock.expo.app/support/
- Privacy policy: https://overclock.expo.app/privacy/
- Contact email: qgjameschen@gmail.com

The privacy and support pages are `public/privacy/` and `public/support/`. Redeploy after changing them with `npx expo export -p web && npx eas-cli@latest deploy --prod`. Keep the trailing slash in links: `/privacy` without it falls through to the game.

## Assets

| File                        | Use                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| `screenshots/ios/*.png`     | App Store, 6.9" iPhone, 1320×2868                                       |
| `screenshots/android/*.png` | Google Play phone screenshots, 1080×2160                                |
| `feature-graphic.png`       | Google Play feature graphic, 1024×500, made from `feature-graphic.html` |
| `play-icon.png`             | Google Play icon, 512×512                                               |

The screenshots come from the web build in Chrome at those viewport sizes, with seeded games: a mid-game board, a circuit preview mid-drag, a finished daily and the rules.

## Google Play listing

- App name: `Overclock: Circuit Puzzle`
- Short description: `Block puzzle on a circuit board. Clear lines, wire circuits, chain core blasts.`
- Full description: the `description` in `store.config.json`
- App category: Game, Puzzle
- Tags: Puzzle, Block puzzle, Casual

## Store forms

- **Apple App Privacy:** Data Not Collected.
- **Google Play Data safety:** no data collected or shared.
- Both rest on what the app sends: nothing except EAS Update checks. Those carry the OS, the project ID and a random installation token, which Expo describes as not identifying (https://expo.dev/privacy-explained). If you'd rather be conservative, Play lets you declare "App info and performance, diagnostics" as collected, not shared, not linked to the user.
- **Age rating:** Apple's answers are in `store.config.json` (all none, so 4+). On Play, answer the IARC questionnaire with no violence, gambling, user content, chat or purchases, which rates it Everyone / PEGI 3.
- **Play target audience:** pick 13 and over. Choosing ages under 13 puts the app in Google's Families program, which brings more review requirements.
- **Ads, in-app purchases, login:** none. All features are available without special access.
- **Encryption:** `ITSAppUsesNonExemptEncryption` is false in `app.json`. The app uses only standard HTTPS, so App Store Connect won't ask for export compliance.

## Launch checklist

These steps need your Apple and Google accounts.

### Apple

1. Enroll in the Apple Developer Program ($99/year).
2. In App Store Connect, create the app. Platform iOS, name `Overclock: Circuit Puzzle`, bundle ID `com.j769chen.overclock`, any SKU. If the name is taken, change `title` in `store.config.json` too.
3. Build and upload: `npx eas-cli@latest build --profile production --platform ios`, then `npx eas-cli@latest submit --platform ios`. The first run asks you to sign in to Apple and create certificates; let EAS manage them.
4. Push the listing: `npx eas-cli@latest metadata:push`.
5. In App Store Connect, upload the 6.9" screenshots, set the price to free, fill in App Privacy (Data Not Collected), and add review contact details.
6. Test the TestFlight build on your phone: sound, haptics, share sheet and daily.
7. Submit for review. Release is set to manual, so you choose when it goes live after approval.

### Google

1. Create a Google Play developer account ($25 once). New personal accounts must run a closed test with at least 12 testers for 14 days before production.
2. Create the app in the Play Console with the name above, as a free game.
3. Build: `npx eas-cli@latest build --profile production --platform android`. Upload this first `.aab` by hand in the Play Console; Google requires it before API uploads work.
4. For later builds, create a Google service account key and run `npx eas-cli@latest submit --platform android`.
5. Fill in the store listing, graphics, Data safety, content rating and target audience from this page.
6. Roll out to internal testing, then closed testing, then production.
