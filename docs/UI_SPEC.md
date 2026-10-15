# UI Spec

## Design tokens
- Background white #FFFFFF, page background #F8F9FB.
- Navy #011638: headings, logo, water icons. Teal #00628C: secondary buttons (for example Navigate), links, highlights. Light blue #C8E6FF: chips and tags. Yellow #FFD233: charging icons and primary action buttons (Login, Report condition, Submit report). Text on yellow is navy.
- Status colors (always badge = color + icon + text label):
  - Available: green #2E7D32 on tint #E8F5E9
  - Empty: amber #FFD233 on tint #FFF8D6, dark text
  - Broken: red #BA1A1A on tint #FDECEA
  - Under Maintenance: slate #607D8B on tint #ECEFF1
  - No recent report: gray #6B7280 on #F3F4F6
- Font: Inter. Regular body, Medium labels, Bold headings. Sizes: h1 24 to 28, h2 18 to 20, body 14 to 16, caption 12.
- Cards radius 12, soft shadow, spacing scale 4/8/12/16/24, touch targets at least 44 px.
- Water marker: droplet in a navy circle. Charging marker: lightning bolt in a yellow circle.
- Logo: map pin with a water droplet, wordmark "FindToFill", tagline "Find it. Fill it."

## Shared components
StatusBadge, FacilityCard, FilterChips, StationHeader (detected station + "Change"), MapView (Leaflet), LayoutView, BottomNav (Home, Map, Chatbot, Stamps, Profile; active item is a yellow pill), QuickMessageButton, AnswerCard, ReviewCard, StampMapItem, PhotoUploader, AdminTable. Every data view needs loading (skeleton), empty, and error states.

## Pages
1. /login: logo, tagline, Login and Register tabs, a note "You can explore the map and use the chatbot without logging in. Login is needed to report, review, favorite, and collect stamps.", button "Continue as guest".
2. / (Home): StationHeader, map card (user dot, facility markers), filter chips (All, Water, Charging, Available only), "Nearest facilities" list sorted by distance, floating chatbot button, BottomNav. If GPS is denied or outside the pilot area: station picker.
3. /map: full-screen map of all pilot stations. Tapping a station opens its detail page.
4. /station/[id]: name, line chips, favorite heart, facility list (FacilityCard with status, last report time, View photo), Station Layout section with level tabs and legend, water rating summary with "Write a review", fixed button "Report condition".
5. /report/[facilityId]: facility summary; step 1 choose one of four status cards; step 2 photo (required); step 3 optional note (140 characters); text "Reports are shown for 7 days."; submit button disabled until a status and a photo are set; success and rate-limit states.
6. /community: tabs Reviews, Favorites, Stamp Map. Reviews: station selector, average rating, Write a review, list of reviews. Favorites: favorite stations with their current facility status. Stamp Map: pilot stations as stamped (filled) or not yet (outlined), text "N of 5 stations tried" and a progress bar.
7. /chat: StationHeader, five quick message buttons (Indonesian text), the chosen message as a bubble, then the AnswerCard (facility name, location in station, distance in meters, status badge, last report time) and a short assistant message. If scheduleReminder: hint "Perhatikan papan informasi stasiun untuk jadwal kedatangan KRL terkini." Fallback state with a link to the map. No text input.
8. /profile: email, role, logout, my last 10 reports.
9. /admin (admin only): tabs Reports, Reviews, Stations. Table with photo thumbnail, station, facility, status badge, reporter, date, action Remove (confirm dialog). Filters by station and status. Stations tab: add and edit stations, facilities, layout images, schedules.

## Do not build (appeared in early Stitch mockups but are out of scope)
Banner "Scan QR at dispenser to earn points", "+10 pts", "Level 3 Steward", "Tested Daily" badge, voice note, "Technician dispatched", Approve or Batch Approve buttons.

## Copy rules
UI text in English. Chatbot text in Indonesian. Keep all strings in one place for future translation.
