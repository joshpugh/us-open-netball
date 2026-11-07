/*!
 * U.S. Open Netball standings embed
 * Usage:
 *   <div data-nl-ladder="ladies"></div>
 *   <div data-nl-ladder="mixed"></div>
 *   <script src="https://joshpugh.github.io/us-open-netball/embed.js" defer></script>
 * Optional attributes: data-title="false" hides the header bar.
 */
(function () {
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/embed\.js(\?.*)?$/, "") : "https://joshpugh.github.io/us-open-netball/";
  })();
  var LABEL = { ladies: "Ladies", mixed: "Mixed" };
  var REFRESH_MS = 60000;

  var CSS = [
    ":host{all:initial;display:block;width:100%}",
    ".nl{container-type:inline-size;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Arial,sans-serif;color:var(--nl-ink,#14161A);",
    "  --brand:var(--nl-brand,#0B1F4B);--accent:var(--nl-accent,#E4002B);--win:#1A7F4B;--loss:#C62828;--draw:#9CA3AF;--muted:#6B7280;--line:#E7E9EE;--zebra:#F7F8FA}",
    "*{box-sizing:border-box}",
    ".head{background:var(--brand);color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}",
    ".head h3{margin:0;font-size:18px;line-height:1.25;font-weight:700}",
    ".head p{margin:2px 0 0;font-size:13px;opacity:.8}",
    ".upd{font-size:12px;opacity:.75;white-space:nowrap;padding-top:3px}",
    ".card{border:1px solid var(--line);border-radius:0 0 12px 12px;background:#fff;overflow:hidden}",
    ".no-head .card{border-radius:12px}",
    "table{width:100%;border-collapse:collapse;font-size:14px;table-layout:auto}",
    "th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);font-weight:600;padding:10px 8px;text-align:center;border-bottom:1px solid var(--line);white-space:nowrap;background:#fff}",
    "td{padding:10px 8px;text-align:center;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums;color:var(--nl-ink,#14161A)}",
    "th.team,td.team{text-align:left}",
    "tbody tr:nth-child(even) td{background:var(--zebra)}",
    "tbody tr:last-child td{border-bottom:0}",
    ".rank{width:32px;color:var(--muted);font-weight:600}",
    ".tc{display:flex;align-items:center;gap:10px}",
    ".logo{width:28px;height:28px;border-radius:50%;object-fit:cover;background:#fff;border:1px solid var(--line);flex:none}",
    ".name{font-weight:600;line-height:1.25}",
    ".pts{font-weight:800;color:var(--accent)}",
    ".pos{color:var(--win)}.neg{color:var(--loss)}",
    ".form{display:inline-flex;gap:3px;flex-wrap:nowrap}",
    ".f{width:20px;height:20px;border-radius:4px;color:#fff;font-size:11px;font-weight:700;display:inline-grid;place-items:center}",
    ".f.W{background:var(--win)}.f.L{background:var(--loss)}.f.D{background:var(--draw)}",
    ".next img{width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid var(--line);vertical-align:middle}",
    ".msg{padding:24px;text-align:center;color:var(--muted);font-size:14px}",
    ".foot{font-size:11px;color:var(--muted);padding:6px 2px}",
    /* Responsive to the space it's placed in, not the screen */
    "@container (max-width:720px){.c-d,.c-f,.c-a,.c-next{display:none}}",
    "@container (max-width:500px){.c-form{display:none}table{font-size:13px}th,td{padding:9px 4px}th{font-size:10px;letter-spacing:.3px}.rank{width:22px}.logo{width:22px;height:22px}.tc{gap:7px}.head{padding:12px 14px}.head h3{font-size:16px}}",
    "@container (max-width:340px){.c-l{display:none}.upd{display:none}}"
  ].join("\n");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function mount(el) {
    var div = (el.getAttribute("data-nl-ladder") || "").toLowerCase();
    if (!LABEL[div] || el.__nl) return;
    el.__nl = true;
    var showHead = el.getAttribute("data-title") !== "false";
    var root = el.attachShadow ? el.attachShadow({ mode: "open" }) : el;

    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<div class="nl' + (showHead ? "" : " no-head") + '">' +
      (showHead
        ? '<div class="head"><div><h3>U.S. Open Netball Championships 2026</h3><p>' + LABEL[div] +
          ' · Standings</p></div><div class="upd"></div></div>'
        : "") +
      '<div class="card"><table><thead><tr>' +
      '<th>#</th><th class="team">Team</th><th>P</th><th>W</th><th class="c-l">L</th>' +
      '<th class="c-d">D</th><th class="c-f">F</th><th class="c-a">A</th>' +
      '<th>GD</th><th>Pts</th><th class="c-form" title="Last 5 games, latest first">Form</th><th class="c-next">Next</th>' +
      '</tr></thead><tbody><tr><td colspan="12" class="msg">Loading standings…</td></tr></tbody></table></div>' +
      '<div class="foot">Source: NetballConnect live scores. Updates automatically.</div></div>';

    var tbody = root.querySelector("tbody");
    var upd = root.querySelector(".upd");
    var lastUpdated = null;

    function draw(data) {
      if (data.updated === lastUpdated) return;
      lastUpdated = data.updated;
      tbody.innerHTML = data.teams.map(function (t) {
        var form = (t.form || "").split("").slice(0, 5).map(function (r) {
          return '<span class="f ' + r + '">' + r + "</span>";
        }).join("");
        return "<tr>" +
          '<td class="rank">' + t.rank + "</td>" +
          '<td class="team"><div class="tc">' +
            (t.logo ? '<img class="logo" src="' + esc(t.logo) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : "") +
            '<span class="name">' + esc(t.name) + "</span></div></td>" +
          "<td>" + t.p + "</td><td>" + t.w + '</td><td class="c-l">' + t.l + "</td>" +
          '<td class="c-d">' + t.d + '</td><td class="c-f">' + t.f + '</td><td class="c-a">' + t.a + "</td>" +
          '<td class="' + (t.gd > 0 ? "pos" : t.gd < 0 ? "neg" : "") + '">' + (t.gd > 0 ? "+" + t.gd : t.gd) + "</td>" +
          '<td class="pts">' + t.pts + "</td>" +
          '<td class="c-form"><span class="form">' + form + "</span></td>" +
          '<td class="c-next next">' + (t.nextLogo
            ? '<img src="' + esc(t.nextLogo) + '" alt="' + esc(t.next) + '" title="Next: ' + esc(t.next) + '" loading="lazy" onerror="this.style.display=\'none\'">'
            : "") + "</td></tr>";
      }).join("");
      if (upd) {
        upd.textContent = "Updated " + new Date(data.updated).toLocaleString("en-US",
          { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
      }
    }

    function load() {
      fetch(BASE + "data/" + div + ".json?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(draw)
        .catch(function () {
          if (!lastUpdated) tbody.innerHTML = '<tr><td colspan="12" class="msg">Standings are unavailable right now.</td></tr>';
        });
    }
    load();
    setInterval(function () { if (!document.hidden) load(); }, REFRESH_MS);
  }

  function init() {
    document.querySelectorAll("[data-nl-ladder]").forEach(mount);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
