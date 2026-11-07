# Handover: U.S. Open Netball standings scraper → new Vercel site

**For:** Claude Code (or any developer) building the new Vercel site
**Reference implementation:** GitHub repo `joshpugh/us-open-netball`, live at https://joshpugh.github.io/us-open-netball/
**Status as of Sat Nov 7, 2026:** working in production, refreshing every 10 minutes for the 2026 U.S. Open Netball Championships weekend.

---

## 1. What this does

Pulls the live competition standings for the **Ladies** and **Mixed** divisions from NetballConnect's public ladder page, saves them as clean JSON, and renders our own branded, responsive standings tables. We built it because NetballConnect's own page can't be embedded cleanly (it carries their menus and filters) and has no public data feed.

## 2. Decide the architecture first

**Option A, recommended for this weekend: the Vercel site reads the feed that already exists.**
The GitHub Actions job is already scraping and publishing JSON every 10 minutes. The Vercel site just reads it. No scraper or browser on Vercel, and nothing new to break mid-tournament.

- Feeds (CORS is open, `Access-Control-Allow-Origin: *`):
  - `https://joshpugh.github.io/us-open-netball/data/ladies.json`
  - `https://joshpugh.github.io/us-open-netball/data/mixed.json`
- In Next.js, fetch on the server with `next: { revalidate: 60 }`, or on the client with a 60-second poll.

**Option B: the scraper runs inside Vercel, so the site is self-contained.** Use this for future tournaments, or if the GitHub repo is going away. Two constraints:

1. **Vercel crons on the Hobby (free) plan run at most once a day.** Anything more frequent fails at deploy time. Every-10-minutes needs Pro ($20 per member per month) or an outside scheduler. Source: https://vercel.com/docs/cron-jobs/usage-and-pricing
2. **The browser has to be the serverless build of Chromium.** Standard Playwright or Puppeteer is too big for a Vercel Function. Vercel's documented approach is `puppeteer-core` plus `@sparticuz/chromium` (or `-min`), listed in `serverExternalPackages` in `next.config`. Source: https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel

**Recommended Option B design (works on Hobby, no cron needed):**
- A route handler `GET /api/ladder/[division]` that scrapes on request and returns JSON with `Cache-Control: s-maxage=600, stale-while-revalidate=3600`.
- Vercel's CDN then serves cached data and refreshes it at most once every 10 minutes, in the background, when traffic comes in. Visitors never wait for the browser to start up.
- Set `export const maxDuration = 60` on the route. A cold Chromium start plus the page load takes about 10–20 seconds.
- **Keep the last good result:** if a scrape fails, or the guards in §5 throw, return the previous good JSON instead of an error or empty table. Store it in Vercel Blob, or keep it in memory as a fallback.
- **Untested risk:** NetballConnect has only been proven to load from GitHub's servers, not Vercel's. Confirm a scrape works on a Vercel preview deployment before go-live, and keep Option A available as a fallback.

## 3. Source details

| Item | Value |
|---|---|
| Public ladder page | `https://registration.netballconnect.com/livescorePublicLadder` |
| `organisationKey` | `d04c4ad3-d2ae-403c-8d31-637bc1fd3e4a` (Netball America) |
| `competitionUniqueKey` | `18ae8f74-51e4-4a5d-8ce8-09aaae90220f` (U.S. Open Netball Championships 2026) |
| `yearId` | `8` (2026) |
| Ladies `divisionId` | `34705` |
| Mixed `divisionId` | `34704` |
| Playoffs | Third group in the dropdown; ID not captured yet. Get it from the Group dropdown if needed. |
| Display parameters | `locked=1&hideFinder=1&hideRegionSwitcher=1&source=app` (`source=app` removes the site's main header and menu) |

Full URL pattern:
```
https://registration.netballconnect.com/livescorePublicLadder?organisationKey=d04c4ad3-d2ae-403c-8d31-637bc1fd3e4a&competitionUniqueKey=18ae8f74-51e4-4a5d-8ce8-09aaae90220f&yearId=8&locked=1&hideFinder=1&hideRegionSwitcher=1&divisionId={DIVISION_ID}&source=app
```

**Don't call their API directly.** The page gets its data from `api-netball.squadi.com/livescores/teams/ladder/v2`, but that endpoint returns 403 to any request that doesn't come from their own site. Do not get around this by faking Origin or Referer headers. Load the public page in a headless browser and read the rendered table, the same thing any visitor's browser does. If we want a proper feed, Netball America (as competition owner) can ask Squadi for API access.

## 4. Data contract (JSON per division)

```json
{
  "updated": "2026-11-07T21:27:24.298Z",
  "teams": [
    {
      "rank": 1,
      "name": "San Francisco Stars - Ladies",
      "logo": "https://storage.googleapis.com/...blob?generation=...&alt=media",
      "p": 5, "w": 5, "l": 0, "d": 0,
      "f": 52, "a": 8, "pts": 15, "gd": 44,
      "form": "WWWWW",
      "nextLogo": "https://storage.googleapis.com/...",
      "next": "Club Allyanze"
    }
  ]
}
```

- `form` is **latest game first**, one character per game (W, L or D). Display the first 5 only; there are a lot of games.
- `next` comes from matching the Next column's logo URL to a team's logo. The page shows only a logo there, not a name.
- Logos are hotlinked from NetballConnect's Google Cloud Storage. They work from any browser; add an `onerror` handler so a broken image hides itself.
- Columns we drop on purpose: B (bye), FW/FL (forfeits), H2H.

## 5. Scraping logic: what to copy

The reference is `scripts/scrape.mjs` in the repo. Port it to `puppeteer-core` (the selectors and page logic stay the same):

1. Open the division URL; wait for `table tbody tr td`, then about 2 more seconds for the table to finish rendering.
2. **Find each column by its header text, never by position.** The page changes layout with screen width: wide screens split "Rank" and "Team" into two columns, narrow screens combine them into one "Rank Team" column. Matching by position shifted every column in our first live run. Normalize each `thead th` to lowercase and match `rank`, `team`, `p`, `w`, `l`, `d`, `f`, `a`, `pts`, `gd`, `last 5`/`latest`, `next`.
3. If Rank and Team share one column, the cell text is `"{rank}\n{team name}"`.
4. **Guards:** throw if there are zero rows, or if any team name is empty. On a throw, keep the last good data; never publish a blank or garbled table.
5. Only write or commit when `teams` actually changed.

## 6. Front end: what to copy

Reference: `embed.js` (script embed) and `index.html` in the repo.

- **Columns:** # · Team (logo and name) · P · W · L · D · F · A · GD (green +, red −) · Pts (bold, accent color) · Form (last 5 as W/L/D chips) · Next (opponent logo with a hover title)
- **Responsive.** Base the breakpoints on the space the table sits in (CSS container queries), not the screen width:
  - ≤720px: hide D, F, A, Next
  - ≤500px: also hide Form; tighten padding; 22px logos
  - ≤340px: also hide L and the "updated" time
- **No horizontal scroll at 375px.** Long team names wrap.
- **Header:** "U.S. Open Netball Championships 2026", division name, and "Updated {weekday time, timezone}".
- **Placeholder colors** (swap for the site's brand): brand navy `#0B1F4B`, accent `#E4002B`, win `#1A7F4B`, loss `#C62828`, draw `#9CA3AF`
- **Refresh:** the client checks for new data every 60 seconds, and skips the check while the browser tab is hidden.
- In a Next.js site, build this as a React component rather than reusing `embed.js`. Keep the same data contract.

## 7. Acceptance checks

- [ ] Ladies and Mixed numbers match the live NetballConnect page (spot-check the top 4: P, Pts, GD, Form)
- [ ] Data refreshes within about 10 minutes of a result changing on NetballConnect
- [ ] A forced scrape failure leaves the last good table showing
- [ ] No horizontal scroll at 375px wide; columns drop as listed in §6
- [ ] Logos show; a broken logo hides itself and doesn't show a broken-image icon

## 8. After the tournament

- Turn off the GitHub workflows (**Update ladder** and **Watchdog**) or delete the repo, otherwise the loop keeps running.
- For the next event, the competition key, year ID and division IDs will change. Get them from the public ladder URL after choosing the competition and group in NetballConnect's dropdowns.
