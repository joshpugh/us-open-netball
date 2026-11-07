// Loads the public NetballConnect ladder page in a headless browser
// (the same page any visitor sees) and saves each division to data/<key>.json.
import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

const DIVISIONS = { ladies: 34705, mixed: 34704 };
const base = id =>
  "https://registration.netballconnect.com/livescorePublicLadder" +
  "?organisationKey=d04c4ad3-d2ae-403c-8d31-637bc1fd3e4a" +
  "&competitionUniqueKey=18ae8f74-51e4-4a5d-8ce8-09aaae90220f" +
  `&yearId=8&locked=1&hideFinder=1&hideRegionSwitcher=1&divisionId=${id}&source=app`;

mkdirSync("data", { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const [key, id] of Object.entries(DIVISIONS)) {
  try {
    const page = await browser.newPage();
    await page.goto(base(id), { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("table tbody tr td", { timeout: 60000 });
    await page.waitForTimeout(2000); // let the table finish rendering

    const teams = await page.$$eval("table", tables => {
      const table = tables.find(t => t.querySelector("tbody tr td"));
      const num = s => (s === "" || isNaN(Number(s)) ? 0 : Number(s));
      // Map columns by header text, so layout changes (e.g. Rank and Team
      // split into two columns on wide screens) don't shift the data.
      const heads = [...table.querySelectorAll("thead th")].map(th =>
        th.innerText.replace(/\s+/g, " ").trim().toLowerCase());
      const col = test => heads.findIndex(test);
      const iRank = col(h => h.startsWith("rank"));
      const iTeam = col(h => h.includes("team"));
      const iP = col(h => h === "p"), iW = col(h => h === "w"), iL = col(h => h === "l"), iD = col(h => h === "d");
      const iF = col(h => h === "f"), iA = col(h => h === "a"), iPts = col(h => h === "pts"), iGd = col(h => h === "gd");
      const iForm = col(h => h.includes("last 5") || h.includes("latest"));
      const iNext = col(h => h === "next");

      const rows = [...table.querySelectorAll("tbody tr")]
        .map(tr => [...tr.querySelectorAll("td")])
        .filter(c => c.length >= heads.length - 1 && c.length > 5);
      const txt = (c, i) => (i >= 0 && c[i] ? c[i].innerText.trim() : "");
      const img = (c, i) => (i >= 0 && c[i] ? c[i].querySelector("img")?.src || null : null);

      const logoToName = {};
      const teams = rows.map(c => {
        let rank, name;
        if (iRank === iTeam) {                 // combined "Rank Team" column
          const [r, ...n] = txt(c, iTeam).split("\n");
          rank = r; name = n.join(" ").trim();
        } else {
          rank = txt(c, iRank); name = txt(c, iTeam).replace(/\s+/g, " ").trim();
        }
        const logo = img(c, iTeam);
        if (logo) logoToName[logo] = name;
        return {
          rank: num(rank), name, logo,
          p: num(txt(c, iP)), w: num(txt(c, iW)), l: num(txt(c, iL)), d: num(txt(c, iD)),
          f: num(txt(c, iF)), a: num(txt(c, iA)), pts: num(txt(c, iPts)), gd: num(txt(c, iGd)),
          form: txt(c, iForm).replace(/[^WLD]/g, ""),   // latest game first
          nextLogo: img(c, iNext),
        };
      });
      teams.forEach(t => (t.next = logoToName[t.nextLogo] || ""));
      return teams;
    });
    await page.close();

    if (teams.length === 0 || teams.some(t => !t.name)) throw new Error("table not parsed – page layout may have changed");

    const file = `data/${key}.json`;
    if (existsSync(file)) {
      const prev = JSON.parse(readFileSync(file, "utf8"));
      if (JSON.stringify(prev.teams) === JSON.stringify(teams)) {
        console.log(`${key}: no change`);
        continue;
      }
    }
    writeFileSync(file, JSON.stringify({ updated: new Date().toISOString(), teams }, null, 1));
    console.log(`${key}: saved ${teams.length} teams`);
  } catch (e) {
    failures++;
    console.error(`${key}: ${e.message}`); // keep the last good file
  }
}

await browser.close();
if (failures === Object.keys(DIVISIONS).length) process.exit(1);
