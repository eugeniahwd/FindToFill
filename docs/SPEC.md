# FindToFill: Product Spec

## 1. Goal
Help a KRL passenger quickly find a WORKING water dispenser or charging station inside the station they are at (or will transit through), see how far it is, and decide whether there is time to use it.

## 2. Users
- Commuter (guest or logged in). Guests can view the map, nearby facilities, facility status, layouts, and use the chatbot. Logged-in users can also report, review, favorite, and collect stamps.
- Admin: moderates reports and reviews and manages station data.

## 3. Pilot scope
Five pilot stations that have KAI Commuter water stations: Juanda, Jakarta Kota, Manggarai, Tanah Abang, Bekasi. The team may change this list, so keep it in seed data. Facility coordinates, layouts, and schedules are prepared by the team from field visits. Until real data exists, create clearly marked demo seed data (is_demo_data = true).

## 4. Modules and business rules

### 4.1 Authentication
Email and password via Supabase Auth, plus "Continue as guest". Writing actions (report, review, favorite) require login. Role is in profiles.role (commuter or admin). Admin is assigned manually in the database. Users cannot change their own role.

### 4.2 Nearest Station Locator
- Use browser geolocation. If permission is denied, ask the user to choose a station manually.
- Resolve the nearest pilot station by straight-line distance to the station center. If the nearest one is farther than 800 m (config), show "You are not at a pilot station" and let the user pick one.
- The user can always change the detected station (GPS is unreliable inside covered stations).
- List the station's facilities sorted by distance in meters (haversine from stored facility coordinates). Filter chips: All, Water, Charging, Available only.
- Card: type icon, name, platform or location detail, distance in meters, status badge, last report time.
- Map: Leaflet + OpenStreetMap. Markers: droplet for water, lightning for charging, blue dot for the user.

### 4.3 Live Report
- Statuses: Available, Empty, Broken, Under Maintenance. A photo is REQUIRED. Optional note up to 140 characters.
- The client compresses the photo with canvas (max 1280 px, JPEG about 0.7). The server accepts JPEG, PNG, WebP up to 5 MB.
- Rate limit: 5 reports per user per hour (config).
- Only reports from the last 7 days count. Current facility status = the most recent non-removed report in that window. If none: "No recent report" (neutral, makes no claim).
- Show "last report X min ago" and "View photo" (signed URL).

### 4.4 Review, Favorite, Stamp
- Review: rating 1 to 5 and comment up to 500 characters per facility. One review per user per facility, editable. The comment gets an embedding for semantic search.
- Favorite: toggle a station as favorite.
- Stamp: one stamp per user per facility, awarded the first time the user submits a report or a review for it (server-side). The Stamp Map shows pilot stations as stamped or not yet.

### 4.5 Station Layout
Each station has a layout image per level with facility markers placed by percentage coordinates (layout_x, layout_y). Level tabs appear if a station has more than one level. Legend: Water, Charging.

### 4.6 AI Quick-Message Chatbot
See docs/AI_CHATBOT.md. Quick messages only, no free typing.

### 4.7 Admin Moderation
Admin page with tabs Reports, Reviews, Stations. Lists recent items with photo thumbnails and filters (station, status). Action: Remove (soft delete, records who and when). The Stations tab adds or edits stations, facilities, layout images, and schedules. Non-admins are blocked in the UI, the API, and RLS. There is no approve queue.

## 5. Non-functional targets
- Chatbot answers within 3 seconds in at least 90% of runs, with a hard timeout of 10 seconds, then a fallback message.
- One-handed mobile use. Status is readable without relying on color.
- Privacy: GPS is not stored, chat logs hold no coordinates or personal data, photos are in a private bucket.
- Supabase free projects pause when inactive. Show a friendly error if the database is unreachable.

## 6. Defaults (editable decisions)
1. Most recent active report wins.
2. Stamp is awarded on the first report or review for a facility.
3. Walking speed 1.2 m/s. "Enough time to refill" = 2 x one-way walk time + 1 minute to fill must be less than or equal to minutes until the next train.
4. UI text in English. Chatbot replies in Indonesian.
5. Guests can use the chatbot, with an IP-hash rate limit of 20 requests per hour.
