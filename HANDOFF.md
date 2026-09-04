# WHF-HQ Project Handoff

_Last updated: September 3, 2026 (America/Chicago)_

## 1. Executive summary

WHF-HQ is the public, mobile-first Westonka / Holy Family Girls Swim & Dive team hub. It is a static progressive web app hosted by GitHub Pages from the public GitHub repository Whitehawks-GirlsSwim/WHF-HQ.

- Repository: https://github.com/Whitehawks-GirlsSwim/WHF-HQ
- Production app: https://whitehawks-girlsswim.github.io/WHF-HQ/
- Default branch: main
- Current season: 2026
- Current public season record in data.js: 0-0
- Current production baseline commit: 89939979f4395d265e3ebe1d9fbba5a24323403f (Restore clean app page)
- Development preference from Bob: use the GitHub web editor, make small targeted changes, commit directly only after confirmation, wait for GitHub Pages, and verify the live app before reporting success.

The production app was verified after the September 3 emergency restore. The Home screen and navigation load, Practice opens, data.js and app.js resolve from their correct URLs, and no browser console errors were present during that verification.

## 2. Current repository structure

### Root files

- **index.html** — Complete screen markup, permanent Home cards, bottom navigation, hidden Admin screen markup, external SDK include, and versioned asset references.
- **styles.css** — Mobile layout, cards, bottom navigation, records table, sponsor tiles, photo gallery/lightbox, pull-to-refresh UI, completed-item styling, and responsive behavior.
- **data.js** — Main content source under window.WHF_DATA. Contains schedules, meets, events, volunteer needs, sponsors, records, contacts, links, the team store, season record, and update/email content.
- **app.js** — Rendering and behavior: navigation, date filtering, schedule normalization, practice/meets rendering, admin utilities, Gmail draft generation, photo feed/lightbox/swiping, pull-to-refresh and sound, app badges, and OneSignal notification opt-in.
- **manifest.json** — PWA manifest. Standalone display, WHF HQ name, root scope/start URL, dark background/theme, app-icon.svg.
- **notification-sw.js** — Earlier notification service-worker support. Review its relationship with OneSignal before changing notification behavior.
- **app-icon.svg** — Installed-app icon.
- **team-hero.jpg** — Home/brand hero image.
- **RELEASE_NOTES_V15.txt** — Historical release notes.
- **release-72-deploy.txt** — A deployment trigger marker created when GitHub Pages needed a clean redeploy.

### Directories

- **push/onesignal/OneSignalSDKWorker.js** — Imports the OneSignal v16 web-push worker.
- **sponsor-logos/** — Official sponsor assets. These must be displayed without altering, recoloring, cropping, or recreating the logos.

There is no local Git checkout in the current Codex workspace. Work has been performed directly in the GitHub web editor.

## 3. Deployment and runtime setup

### GitHub Pages

- The app deploys automatically from main through GitHub Actions using the pages-build-deployment workflow.
- A commit is not complete until the latest Pages deployment succeeds and the production URL is verified.
- The repository is public.
- GitHub reported a successful status for the current main commit, and production was loaded and tested after commit 8993997.

### Cache/version behavior

index.html currently references:

- manifest.json?v=20260903-72
- styles.css?v=20260903-72
- data.js?v=20260903-72
- app.js?v=20260903-72

Important: changing the page URL with ?refresh=... does not reliably invalidate cached JavaScript or CSS. When app.js, data.js, styles.css, or manifest.json changes, update only the corresponding version query in index.html. Verify the exact final script URLs in production.

### PWA behavior

- manifest.json uses start_url "./", scope "./", and display "standalone".
- Users can save WHF-HQ to the iPhone or Android Home Screen.
- Pull-to-refresh is implemented in app.js and includes a refresh sound.
- App badge code exists, but badge behavior and true external push notifications are separate features.

## 4. Current app screens and navigation

Screens present in index.html:

- Home
- Events/Fundraisers (screen id: spirit)
- Volunteers
- Parents
- Booster
- Sponsors
- Meets
- Practice
- Program
- Photos
- Admin

Permanent bottom navigation:

- Home
- Meets
- Practice
- Events
- Parents
- Program

Admin is intentionally not shown in the bottom navigation. It opens by tapping the WHF brand mark seven times. This is obscurity, not real authentication. Never put passwords, private parent information, private email lists, financial credentials, or other secrets in the static app.

## 5. Completed functionality

### Home

- Hero/brand treatment for WHF Girls Swim & Dive.
- Date-aware next-event/practice card.
- Permanent Volunteer Sign-Ups card.
- Permanent Team Alerts / Turn On Notifications card.
- Latest-update banner with date, title, description, and action.
- Important date cards, including the team store and Senior Night / Pack the Pool.
- Past items are intended to be completed, hidden, or greyed based on their type/date.

### Meets

- One schedule rather than duplicated JV and Varsity lists.
- School dual meets are JV & Varsity.
- True Team, Sections, and State are Varsity-only.
- JV Champs is explicitly JV.
- Directions use physical addresses and Google Maps links.
- Current schedule contains 16 meets/events:
  - Aug 29 — Tim Daly Invitational, 10:00 AM, Orono
  - Sep 10 — vs Dassel-Cokato, 6:00 PM, Westonka
  - Sep 17 — at Watertown-Mayer/ML/SWC, 6:00 PM
  - Sep 22 — Senior Night / Pack the Pool vs Orono, 6:00 PM, Westonka
  - Sep 24 — vs Litchfield, 6:00 PM, Litchfield
  - Oct 1 — vs Hutchinson, 6:00 PM, Westonka
  - Oct 8 — at Delano, 6:00 PM
  - Oct 10 — True Team Sections, 9:00 AM, Willmar
  - Oct 12 — JV Champs, 5:00 PM, Westonka
  - Oct 17 — True Team State, noon, University of Minnesota
  - Oct 22 — vs Breck, 6:00 PM, Westonka
  - Nov 12 — Section Prelims, 6:00 PM, Hutchinson
  - Nov 14 — Section Finals, noon, Hutchinson
  - Nov 19 — State Dive Prelims, noon, University of Minnesota
  - Nov 20 — State Swim Prelims, noon, University of Minnesota
  - Nov 21 — State Swim/Dive Finals, noon, University of Minnesota

### Practice

- Swim and Dive live separately on the Practice screen.
- Swim and Dive schedules are rendered as individual daily cards.
- Completed practices are filtered from the active experience.
- Swim weekly schedule beginning Sep 7: Mon-Fri 3:30-6:00 PM and Saturday 7:00-10:00 AM, with Labor Day closed.
- Dive schedule beginning Sep 7: Mon-Fri 3:30-6:00 PM, no Saturday practices, with Labor Day closed.
- Current data contains 43 key-date items and 33 dive-practice items. The explicit daily September schedule currently runs through Sep 30. Add October dates only when Coach Ben/Sarah confirms them.

### Volunteers

- Volunteers have their own screen and a permanent Home card.
- Current links:
  - Saturday Team Breakfasts: https://www.signupgenius.com/go/10C0E4DA5AC28A0FB6-52289320-2024
  - Home Meet Volunteers: https://www.signupgenius.com/go/20F0F4BA9A723A2FB6-57207588-2025
- Detailed volunteer needs are stored in data.js and are dated "Open as of August 31."
- Leah Habicht is the Volunteer Coordinator contact referenced in team communications.

### Events and fundraising

- Culver's Serve Night was removed because it is not happening.
- Registration was removed because it closed.
- Crumbl fundraiser:
  - https://successfund.com/kyxwj
- Spirit of the Lakes is completed and records $1,335.47 from the Hydration Station and Dunk Tank combined.
- Team store is through Elsmore and spirit wear remains open through mid-October:
  - https://elsmoreswim.com/collections/mound-westonka-holy-family-hs-girls
- First Booster meeting (Aug 27) is completed and belongs with Booster/team events, not completed fundraisers.
- Upcoming Booster meeting dates in data.js:
  - Sep 15 — time/location TBD
  - Oct 12 — time/location TBD
  - Nov 10 — time/location TBD; Board Elections

### Sponsors

- 11 sponsors are stored in data.js.
- Current fundraising total shown: $16,785.47.
- Goal shown: $30,000.
- Spirit of the Lakes total is included.
- Sponsor logos use official supplied assets and should use contain-style sizing so the complete logo remains visible.
- "Presenting Partners" was intentionally retained.

### Program, records, and accolades

- Records section title: Team and Pool Records.
- 13 team/pool record rows are stored in data.js.
- Holy Family school records use the team green styling.
- Individual Accolades was removed because it duplicated the records presentation.
- The accolades data array remains present but empty.
- Mia Dongoske's 200 IM record was updated to 2:13.97 '25.
- Season record currently remains 0-0. Confirm whether the Tim Daly Invitational victory changes the official dual-meet record before editing it.

### Photos

- Separate Team Photos screen.
- Google Form submission link:
  - https://docs.google.com/forms/d/e/1FAIpQLSfuqlWPKp7vHszCnDJZGEoHUlXA1Q0nKjz4XiTk5D_uzxZTKg/viewform?usp=publish-editor
- Approved photo feed:
  - https://script.google.com/macros/s/AKfycbxhRaTiG44m4EUwc4_YFVJ9JiYK6zBB-sTq18a9VtJOmcIOnUMtSfsAzkPT6f-1hxA46Q/exec
- Google response spreadsheet:
  - https://docs.google.com/spreadsheets/d/1aI5tHDh9pNMqXHMKxsQuziu_AURmMgbirGAzKzR_f9U/edit?gid=1106269012
- Gallery cards intentionally do not use photo titles.
- Lightbox/swipe navigation is implemented so users can move through photos without closing each one.
- Photos should display inside WHF-HQ rather than send viewers to restricted Google Drive pages.
- Earlier production checks showed 10 team photos; reverify the full feed after any photo or app.js change.

### Parent and Booster content

- Redundant Season Schedule was removed from the Parents tab.
- Social links are present:
  - Instagram: https://www.instagram.com/whfswimanddive/
  - Facebook: https://www.facebook.com/share/187mhmtasu/?mibextid=wwxlfr
- Public contacts:
  - Bob Dongoske — Booster President — 952-261-2807 — mwhfswimdivegirls@gmail.com
  - Ben Hanson — Head Coach — 612-965-1707 — coach.ben.hanson@gmail.com

### Admin email drafting

- Admin can generate a weekly Booster update and open a real Gmail compose window.
- The app does not store parent email addresses.
- Email focus decision: Coach handles weekly practice communication; app-generated weekly emails should focus on Booster news, events/fundraising, volunteers, major meets, and WHF-HQ.
- Email style must follow Bob's established template: friendly generic opening, horizontal topic breaks, restrained relevant emojis, clear date-by-date volunteer needs, and Bob's exact signature.
- The weeklyUpdate data includes future leadership recruitment and mandatory equipment-training language for use in the admin email workflow. It should not become a public Home announcement unless Bob explicitly asks.

## 6. Notification setup

OneSignal web push is partially implemented.

### Configuration

- OneSignal App ID: cc26f77d-7d78-400a-9d13-61406a7db12b
- SDK loaded from:
  - https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js
- Worker:
  - push/onesignal/OneSignalSDKWorker.js
- Worker scope configured in app.js:
  - /WHF-HQ/push/onesignal/
- Home button calls enableTeamAlerts().
- app.js contains the OneSignal initialization, permission request, subscription-state handling, and enabled/off UI states.

### What was confirmed

- OneSignal onboarding reached its success state.
- Bob's iPhone appeared as the first subscribed Apple Web Push user.
- The installed Home Screen app successfully displayed the notification opt-in flow during setup.
- Current app.js still contains enableTeamAlerts and the OneSignal App ID.
- Current production loaded without console errors after the restore.

### What is NOT confirmed

- A real OneSignal push sent after the September 3 emergency restore has not been verified end-to-end.
- Do not tell the whole team that push notifications are fully ready until a test notification reaches Bob's subscribed iPhone while WHF-HQ is closed/backgrounded.
- Do not add phone numbers or parent email addresses to implement notifications.
- iPhone users must generally install WHF-HQ to the Home Screen, open it from the icon, tap Turn On Notifications, and allow the iOS prompt.

## 7. Current content/data details

data.js uses window.WHF_DATA and currently contains these top-level keys:

- season
- latestUpdate
- weeklyUpdate
- keyDates
- divePracticeSchedule
- meetSchedule
- parentCards
- socialLinks
- teamContacts
- boosterCards
- sponsorIntro
- sponsors
- volunteerCards
- events
- teamStore
- programSummary
- seasonRecord
- programHighlights
- photoLinks
- photoFeedUrl
- teamRecords
- accolades

Important source-of-truth issue:

- data.js currently says latestUpdate is "Meet Schedule Updated."
- app.js currently overrides DATA.latestUpdate at runtime with "Turn On Team Notifications."
- Production therefore shows the notification update even though data.js says something else.
- The next cleanup should remove this split source of truth and keep update content in data.js only, but do not attempt that during another urgent repair.

## 8. Recent changes and repair history

Relevant commits:

- 8993997 — Restore clean app page
- fa73a0a — Feature team notification signup on Home
- 056cb2c — Highlight Turn On Notifications for parents
- 2e31515 — Trigger Release 72 deployment
- ef4faaf — Add OneSignal notification worker
- a18236 — Add notification service worker
- 7098b91 — Update meet schedule dates and add JV Champs
- 848b313 — Enable pull refresh across Home screen
- 9dc34f8 — Add official sponsor logos

### September 3 incident

During notification-highlight work, the live app briefly failed with a duplicate JavaScript identifier error. A later cache-version edit accidentally produced a malformed data script URL. The final repair restored index.html from clean commit 056cb2c and committed that clean file as 8993997.

Post-repair production verification confirmed:

- data.js loads from data.js?v=20260903-72
- app.js loads from app.js?v=20260903-72
- Home content renders
- Practice navigation works
- No browser console errors were present

Do not repeat broad Find/Replace operations in the GitHub editor. Do not paste a replacement over a search result unless the complete target line is visibly confirmed.

## 9. Outstanding problems and immediate next work

### Priority 1 — Verify notifications without changing code

1. Open the OneSignal dashboard.
2. Confirm Bob's iPhone subscription is still Subscribed.
3. Send one test notification only to Bob's test subscription.
4. Confirm delivery while the installed WHF-HQ app is closed/backgrounded.
5. Confirm tapping it opens WHF-HQ.
6. Only after success should the notification rollout be advertised to parents.

This is a real external send and requires Bob's action-time confirmation before the test is sent.

### Priority 2 — Clean up Volunteer wording and refresh its data

Bob considers the current Home description messy/inaccurate.

Current hardcoded Home copy:

"Saturday breakfasts and home-meet volunteer roles."

Recommended replacement:

"View open sign-ups for home meets and Saturday team breakfasts."

Before updating the detailed volunteer cards or an email, open both SignUpGenius links and recalculate every remaining spot. The values in data.js are only accurate as of August 31 and must not be presented as current without verification.

### Priority 3 — Remove split latest-update logic

Move the intended latest-update content into data.js and remove the app.js runtime override. Keep only one source of truth. Do this as a small, separately tested change after notification delivery is confirmed.

### Priority 4 — Verify photo workflow

- Confirm the Apps Script feed still returns approved photos.
- Confirm all expected photos appear.
- Confirm tapping a photo opens the in-app lightbox, not restricted Drive.
- Confirm left/right swipe works on a phone.
- Do not expose unapproved submissions.

### Priority 5 — Content confirmations

- Confirm official season record after the Tim Daly win.
- Confirm Booster meeting times/locations for Sep 15, Oct 12, and Nov 10.
- Confirm the mandatory parent equipment-training date from Coach Ben.
- Add October practice dates only after coach confirmation.
- End-of-season banquet was discussed for Nov 21 or 22 but was not finalized; do not publish it yet.

## 10. Important product decisions to preserve

- Meets and Practice remain separate.
- Swim and Dive practice remain visually and structurally separate.
- Volunteers keep their own tab and a permanent Home shortcut.
- Admin stays hidden from normal navigation.
- Parent emails/phone numbers are not stored.
- Gmail drafting opens actual Gmail.
- Weekly emails stay Booster/event/volunteer-focused unless Bob requests otherwise.
- Dual meets include JV & Varsity; True Team, Sections, and State are Varsity-only.
- Oct 22 is Breck at Westonka at the normal 6:00 PM home-meet time.
- Senior Night / Pack the Pool is Sep 22 vs Orono at Westonka.
- Culver's Serve Night stays removed.
- Registration stays removed.
- Completed Booster meetings do not appear under completed fundraisers.
- Past practices should not clutter the active schedule.
- Sponsor logos must be used exactly as supplied.
- Individual Accolades stays removed.
- Team and Pool Records remains the records title.
- Photos have no titles and use an in-app swipe viewer.
- Push notification enrollment is opt-in; do not create a phone-number database.

## 11. Safe working procedure for the next ChatGPT Work session

1. Read this entire HANDOFF.md before making changes.
2. Check the current main commit and latest GitHub Pages deployment.
3. Open production with a unique verification query.
4. Confirm the four asset references in index.html before editing.
5. Check browser console errors.
6. Test Home, Meets, Practice, Events, Parents, Program, Volunteers, Photos, and the hidden Admin entry.
7. Make one narrowly scoped change at a time.
8. Prefer editing data.js for content and app.js/styles.css only for behavior or presentation.
9. Avoid broad or blind Find/Replace.
10. Before editing a large file, record the current good commit so it can be restored immediately.
11. If a JavaScript asset changes, intentionally bump only its query version in index.html.
12. Commit to main only after Bob confirms the final GitHub commit action.
13. Wait for pages-build-deployment to finish successfully.
14. Verify the live production app, not only the GitHub source.
15. For notification changes, test only Bob's device before advertising to the team.
16. Never report success until the exact user-facing behavior has been tested.

## 12. Definition of done for future changes

A change is complete only when:

- The GitHub commit exists on main.
- GitHub Pages deploys successfully.
- The production app loads with no console errors.
- The affected screen is visually and functionally verified.
- Mobile/PWA behavior is checked when relevant.
- External links point to the correct destination.
- No unrelated screens or data were changed.
- Bob is told exactly what changed and what was actually tested.
