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

    const teams = await page.$$eval("table tbody tr", trs => {
      const num = s => (s === "" || isNaN(Number(s)) ? 0 : Number(s));
      const rows = trs
        .map(tr => [...tr.querySelectorAll("td")].map(td => ({
          text: td.innerText.trim(),
          img: td.querySelector("img")?.src || null,
        })))
        .filter(r => r.length >= 15);
      const logoToName = {};
      // Columns: Rank/Team, P, W, L, D, B, FW, FL, F, A, PTS, H2H, GD, Last 5, Next
      const teams = rows.map(r => {
        const [rank, ...nameParts] = r[0].text.split("\n");
        const name = nameParts.join(" ").trim();
        if (r[0].img) logoToName[r[0].img] = name;
        return {
          rank: num(rank), name, logo: r[0].img,
          p: num(r[1].text), w: num(r[2].text), l: num(r[3].text), d: num(r[4].text),
          f: num(r[8].text), a: num(r[9].text), pts: num(r[10].text), gd: num(r[12].text),
          form: r[13].text.replace(/[^WLD]/g, ""),
          nextLogo: r[14].img,
        };
      });
      teams.forEach(t => (t.next = logoToName[t.nextLogo] || ""));
      return teams;
    });
    await page.close();

    if (teams.length === 0) throw new Error("no rows found – page layout may have changed");

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
