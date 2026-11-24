/* AU0009 resources page: renders the 12 weeks and the admin tools.
   Files in the week folders come from assets/resources.js (made by build.py).
   OneDrive links added through the admin login are kept in assets/links.js,
   which the admin panel saves straight to GitHub. */
(function () {
  "use strict";

  // Admin login. The password is stored only as a salted PBKDF2 hash.
  // This is a convenience gate: the real protection is the GitHub token,
  // which only lives in the admin's own browser.
  var ADMIN = {
    user: "kcam",
    salt: "770a55410eb848e70812481b13807e92",
    iterations: 210000,
    hash: "d8532f814119ec7276d5460d6e36f13e890088bd7b4c67715b23aaf02c0328d3"
  };
  var LS_GH = "au0009.github", SS_ADMIN = "au0009.admin";

  var data = window.AU0009_DATA;
  var host = document.getElementById("weeks");
  if (!data) { host.innerHTML = '<p class="empty">The resources list could not be loaded. Run build.py to create assets/resources.js.</p>'; return; }

  var links = { weeks: {} };          // admin-added links, by week number
  var isAdmin = false;
  var openState = {};                 // remembers which weeks are open across re-renders
  var firstRender = true;

  // ---------- helpers ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (attrs[k] == null) continue;
      if (k === "text") n.textContent = attrs[k];
      else if (k === "cls") n.className = attrs[k];
      else if (k === "on") for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function toDate(iso) { var p = (iso || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function fmtDate(iso) { var d = toDate(iso); return d ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function store(kind, key, val) { try { var s = kind === "local" ? localStorage : sessionStorage; if (val === undefined) return s.getItem(key); if (val === null) s.removeItem(key); else s.setItem(key, val); } catch (e) { return null; } }

  // OneDrive / SharePoint link helpers
  var KIND_FROM_LINK = { p: "PowerPoint", w: "Word", x: "Excel", b: "PDF", v: "Video", i: "Image", f: "Folder", o: "OneNote" };
  function guessKind(url) {
    var m = /sharepoint\.com\/:([a-z]):\//i.exec(url || "");
    if (m && KIND_FROM_LINK[m[1].toLowerCase()]) return KIND_FROM_LINK[m[1].toLowerCase()];
    var ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url || "");
    var map = { pptx: "PowerPoint", ppt: "PowerPoint", docx: "Word", doc: "Word", xlsx: "Excel", pdf: "PDF", mp4: "Video", png: "Image", jpg: "Image" };
    return ext && map[ext[1].toLowerCase()] || "";
  }
  function isOneDrive(url) { return /sharepoint\.com|onedrive\.live\.com|1drv\.ms/i.test(url || ""); }
  // Turns a OneDrive / SharePoint link into one that downloads the file.
  // "/:p:/r/personal/..." links (and links copied from the address bar) point at the file's path,
  // so they use SharePoint's download.aspx. Sharing links ("/:p:/g/...") get download=1.
  // Any web=1 is removed, because it forces the file to open in the browser.
  function downloadUrl(url) {
    if (!url) return url;
    try {
      var u = new URL(url);
      if (/sharepoint\.com$/i.test(u.hostname)) {
        if (/\/_layouts\/15\/download\.aspx/i.test(u.pathname)) return url;
        var path = u.pathname.replace(/^\/:[a-z]:\/r(?=\/)/i, "");
        var site = /^\/((?:personal|sites|teams)\/[^\/]+)\/.+\.[a-z0-9]{2,5}$/i.exec(decodeURIComponent(path));
        if (site && !/^\/:[a-z]:\/[gs]\//i.test(u.pathname)) {
          return u.origin + "/" + site[1] + "/_layouts/15/download.aspx?SourceUrl=" + encodeURIComponent(decodeURIComponent(path));
        }
      }
      u.searchParams.delete("web");
      u.searchParams.set("download", "1");
      return u.toString();
    } catch (e) {
      return url.replace(/([?&])web=1&?/, "$1").replace(/[?&]$/, "") + (url.indexOf("?") > -1 ? "&" : "?") + "download=1";
    }
  }
  var DL_TEXT = { PowerPoint: "PowerPoint", Word: "Word", Excel: "Excel", PDF: "PDF", Video: "Video", Image: "Image" };

  // ---------- course header ----------
  var c = data.course || {};
  if (c.delivery) $("delivery").textContent = c.delivery;
  if (c.shareUrl) { var s = $("shareLink"); s.href = c.shareUrl; s.textContent = c.shareText || c.shareUrl; }

  // ---------- current week ----------
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var current = data.weeks[0] ? data.weeks[0].week : 1;
  data.weeks.forEach(function (w) { var d = toDate(w.date); if (d && d <= today) current = w.week; });
  var hashWeek = +((location.hash.match(/^#week-(\d+)$/) || [])[1] || 0);

  // ---------- rendering ----------
  function linkItem(w, it, idx, list) {
    var kind = it.kind || "Link";
    var actions = [];
    if (it.url) actions.push({ text: it.buttonText || (kind === "Link" || kind === "Folder" ? "Open" : "View"), href: it.url, external: true });
    if (it.url && it.download && kind !== "Link" && kind !== "Folder") actions.push({ text: DL_TEXT[kind] || "Download", href: downloadUrl(it.url), external: true, dl: true });
    return { kind: kind, label: it.label, description: it.description, actions: actions, admin: { week: w.week, idx: idx, count: list.length, id: it.id } };
  }

  function renderRow(w, it) {
    var acts = el("div", { cls: "acts" });
    it.actions.forEach(function (a, i) {
      var attrs = { cls: "btn" + (i > 0 ? " ghost" : ""), href: a.href };
      if (a.view || a.external) { attrs.target = "_blank"; attrs.rel = "noopener"; }
      if (a.download) attrs.download = a.download;
      acts.appendChild(el("a", attrs, [a.text,
        el("span", { cls: "sr", text: " " + it.label + (a.view || (a.external && !a.dl) ? " (opens in a new tab)" : "") }),
        a.size ? el("span", { cls: "sz", text: a.size }) : null]));
    });
    var info = el("div", { cls: "info" }, [el("strong", { text: it.label }), it.description ? el("span", { text: it.description }) : null]);
    if (isAdmin) {
      if (it.admin) {
        var a = it.admin;
        var del = el("button", { cls: "mini danger", type: "button", text: "Delete", on: { click: function () {
          if (del.dataset.armed) { removeLink(a.week, a.id); return; }
          del.dataset.armed = "1"; del.textContent = "Confirm delete";
          setTimeout(function () { if (del.isConnected) { delete del.dataset.armed; del.textContent = "Delete"; } }, 4000);
        } } });
        info.appendChild(el("div", { cls: "admin-row" }, [
          el("button", { cls: "mini", type: "button", text: "Edit", on: { click: function () { openEditor(a.week, a.id); } } }),
          el("button", { cls: "mini", type: "button", text: "Move up", disabled: a.idx === 0 ? "" : null, on: { click: function () { moveLink(a.week, a.id, -1); } } }),
          el("button", { cls: "mini", type: "button", text: "Move down", disabled: a.idx === a.count - 1 ? "" : null, on: { click: function () { moveLink(a.week, a.id, 1); } } }),
          del
        ]));
      } else {
        info.appendChild(el("div", { cls: "admin-row" }, [el("span", { cls: "tag", text: "From the week folder" })]));
      }
    }
    return el("li", {}, [el("span", { cls: "kind k-" + it.kind.toLowerCase(), text: it.kind }), info, acts]);
  }

  function render() {
    host.querySelectorAll("details.week").forEach(function (d) { openState[d.id] = d.open; });
    host.innerHTML = "";
    document.body.classList.toggle("is-admin", isAdmin);
    data.weeks.forEach(function (w) {
      var extra = (links.weeks[w.week] || []);
      var items = w.items.concat(extra.map(function (it, i, arr) { return linkItem(w, it, i, arr); }));
      var n = items.length, isNow = w.week === current;
      var pill = isNow ? el("span", { cls: "pill now", text: "This week" + (n ? ", " + n + (n === 1 ? " resource" : " resources") : "") })
               : n ? el("span", { cls: "pill", text: n + (n === 1 ? " resource" : " resources") })
               : el("span", { cls: "pill soon", text: "Coming soon" });
      var summary = el("summary", {}, [
        el("span", { cls: "wk" }, ["Week", el("b", { text: String(w.week) })]),
        el("span", { cls: "wt" }, [el("strong", { text: w.title || ("Week " + w.week) }), el("span", { text: fmtDate(w.date) })]),
        pill,
        el("span", { cls: "chev", "aria-hidden": "true" })
      ]);
      var body = el("div", { cls: "body" });
      if (w.summary) body.appendChild(el("p", { cls: "summary-text", text: w.summary }));
      if (!n) body.appendChild(el("p", { cls: "empty", text: "Resources for this week will appear here." }));
      else { var ul = el("ul", { cls: "list" }); items.forEach(function (it) { ul.appendChild(renderRow(w, it)); }); body.appendChild(ul); }
      if (isAdmin) body.appendChild(el("button", { cls: "addbtn", type: "button", on: { click: function () { openEditor(w.week); } } }, ["+ Add resource to Week " + w.week]));
      var id = "week-" + w.week;
      var det = el("details", { cls: "week" + (n ? " has" : "") + (isNow ? " current" : ""), id: id }, [summary, body]);
      det.open = firstRender ? (hashWeek ? hashWeek === w.week : isNow) : !!openState[id];
      host.appendChild(det);
    });
    firstRender = false;
  }

  // ---------- open all / links to a week ----------
  function openWeek(id, focus) { var d = $(id); if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); if (focus) d.querySelector("summary").focus({ preventScroll: true }); } }
  window.addEventListener("hashchange", function () { var m = location.hash.match(/^#(week-\d+)$/); if (m) openWeek(m[1]); });
  $("openAll").onclick = function () { host.querySelectorAll("details").forEach(function (d) { d.open = true; }); };
  $("closeAll").onclick = function () { host.querySelectorAll("details").forEach(function (d) { d.open = false; }); };
  if (data.built) $("updated").textContent = "Last updated " + data.built;

  // ---------- load admin-added links (fresh copy, skips browser cache) ----------
  function boot() {
    if (window.AU0009_LINKS && window.AU0009_LINKS.weeks) links = window.AU0009_LINKS;
    if (store("session", SS_ADMIN) === "1") isAdmin = true;
    render();
    if (isAdmin) showAdminBar();
    if (hashWeek) setTimeout(function () { openWeek("week-" + hashWeek); }, 50);
  }
  var sc = document.createElement("script");
  sc.src = "assets/links.js?v=" + Date.now();
  sc.onload = boot; sc.onerror = boot;
  document.body.appendChild(sc);

  // ---------- login ----------
  async function checkPassword(user, pass) {
    if (user.trim().toLowerCase() !== ADMIN.user) return false;
    if (!window.crypto || !crypto.subtle) throw new Error("This browser cannot check the password here. Open the page over https.");
    var salt = new Uint8Array(ADMIN.salt.match(/../g).map(function (h) { return parseInt(h, 16); }));
    var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
    var bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: ADMIN.iterations }, key, 256);
    var hex = Array.prototype.map.call(new Uint8Array(bits), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    return hex === ADMIN.hash;
  }
  $("adminLogin").addEventListener("click", function () { if (isAdmin) return; $("loginErr").textContent = ""; $("loginForm").reset(); $("loginDlg").showModal(); $("lgUser").focus(); });
  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("loginGo"); btn.disabled = true; btn.textContent = "Checking...";
    try {
      if (await checkPassword($("lgUser").value, $("lgPass").value)) {
        isAdmin = true; store("session", SS_ADMIN, "1");
        $("loginDlg").close(); render(); showAdminBar();
        if (!ghConfig().token) openSettings();
      } else { $("loginErr").textContent = "That username or password is not right."; $("lgPass").select(); }
    } catch (err) { $("loginErr").textContent = err.message; }
    btn.disabled = false; btn.textContent = "Log in";
  });
  $("logoutBtn").addEventListener("click", function () { isAdmin = false; store("session", SS_ADMIN, null); $("adminBar").hidden = true; render(); });
  function showAdminBar() { $("adminBar").hidden = false; setStatus(ghConfig().token ? "Logged in. Changes save to GitHub automatically." : "Connect GitHub in Settings before adding resources.", ghConfig().token ? "" : "warn"); }
  function setStatus(msg, kind) { var s = $("saveStatus"); s.textContent = msg; s.className = "status " + (kind || ""); }

  // ---------- GitHub settings ----------
  function guessRepo() {
    var h = location.hostname, m = /^([^.]+)\.github\.io$/i.exec(h);
    if (!m) return { owner: "", repo: "" };
    var first = location.pathname.split("/").filter(Boolean)[0];
    return { owner: m[1], repo: first && !/\.html?$/.test(first) ? first : h };
  }
  function ghConfig() {
    var saved = {}; try { saved = JSON.parse(store("local", LS_GH) || "{}"); } catch (e) {}
    var cfg = (data.course && data.course.github) || {}, g = guessRepo();
    return {
      owner: saved.owner || cfg.owner || g.owner, repo: saved.repo || cfg.repo || g.repo,
      branch: saved.branch || cfg.branch || "main", path: saved.path || cfg.linksPath || "assets/links.js",
      token: saved.token || ""
    };
  }
  function openSettings() {
    var g = ghConfig();
    $("ghOwner").value = g.owner; $("ghRepo").value = g.repo; $("ghBranch").value = g.branch; $("ghPath").value = g.path; $("ghToken").value = g.token;
    $("ghMsg").textContent = ""; $("ghMsg").className = "msg"; $("ghDlg").showModal();
  }
  $("settingsBtn").addEventListener("click", openSettings);
  $("ghForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var cfg = { owner: $("ghOwner").value.trim(), repo: $("ghRepo").value.trim(), branch: $("ghBranch").value.trim() || "main", path: $("ghPath").value.trim() || "assets/links.js", token: $("ghToken").value.trim() };
    var msg = $("ghMsg"); msg.className = "msg"; msg.textContent = "Testing the connection...";
    try {
      var r = await fetch("https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo, { headers: ghHeaders(cfg.token) });
      if (r.status === 401) throw new Error("GitHub did not accept that token. Check it has not expired.");
      if (r.status === 404) throw new Error("Repository not found. Check the owner and repository name, and that the token has access to it.");
      if (!r.ok) throw new Error("GitHub replied with an error (" + r.status + ").");
      var repo = await r.json();
      if (repo.permissions && !repo.permissions.push) throw new Error("The token can read this repository but cannot save to it. Give it Contents: Read and write.");
      store("local", LS_GH, JSON.stringify(cfg));
      msg.className = "msg ok"; msg.textContent = "Connected to " + repo.full_name + ".";
      showAdminBar();
      setTimeout(function () { $("ghDlg").close(); }, 900);
    } catch (err) { msg.className = "msg bad"; msg.textContent = err.message || "Could not reach GitHub."; }
  });
  $("ghForget").addEventListener("click", function () { store("local", LS_GH, null); $("ghToken").value = ""; $("ghMsg").className = "msg"; $("ghMsg").textContent = "Token removed from this browser."; showAdminBar(); });

  function ghHeaders(token) { return { "Accept": "application/vnd.github+json", "Authorization": "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28" }; }
  function b64(str) { var bytes = new TextEncoder().encode(str), bin = ""; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); }
  function unb64(s) { var bin = atob(s.replace(/\s/g, "")), bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function serialise(obj) { return "/* Links added through the admin login. Saved automatically, but safe to edit by hand. */\nwindow.AU0009_LINKS = " + JSON.stringify(obj, null, 2) + ";\n"; }
  function parseLinksFile(text) { var m = /window\.AU0009_LINKS\s*=\s*([\s\S]*?);?\s*$/.exec(text); return m ? JSON.parse(m[1].replace(/;\s*$/, "")) : { weeks: {} }; }

  var saving = Promise.resolve();
  // Each change is applied to the latest copy on GitHub, so two open tabs cannot wipe each other out.
  function commit(change, message) {
    var cfg = ghConfig();
    if (!cfg.token || !cfg.owner || !cfg.repo) { setStatus("Not saved: connect GitHub in Settings first.", "bad"); openSettings(); return Promise.reject(new Error("no token")); }
    var url = "https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + "/contents/" + cfg.path.split("/").map(encodeURIComponent).join("/");
    saving = saving.catch(function () {}).then(async function () {
      setStatus("Saving...", "busy");
      for (var attempt = 0; attempt < 3; attempt++) {
        var sha = null, remote = { weeks: {} };
        var g = await fetch(url + "?ref=" + encodeURIComponent(cfg.branch) + "&t=" + Date.now(), { headers: ghHeaders(cfg.token), cache: "no-store" });
        if (g.ok) { var j = await g.json(); sha = j.sha; try { remote = parseLinksFile(unb64(j.content)); } catch (e) { remote = { weeks: {} }; } }
        else if (g.status !== 404) throw new Error("Could not read " + cfg.path + " from GitHub (" + g.status + ").");
        if (!remote.weeks) remote.weeks = {};
        change(remote);
        remote.updated = new Date().toISOString();
        var body = { message: message, content: b64(serialise(remote)), branch: cfg.branch };
        if (sha) body.sha = sha;
        var p = await fetch(url, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, ghHeaders(cfg.token)), body: JSON.stringify(body) });
        if (p.ok) { links = remote; render(); setStatus("Saved. Learners will see it within a minute or two.", "ok"); return; }
        if (p.status !== 409 && p.status !== 422) throw new Error("GitHub would not save the change (" + p.status + ").");
      }
      throw new Error("GitHub kept reporting a conflict. Refresh the page and try again.");
    }).catch(function (err) { if (err.message !== "no token") setStatus("Not saved: " + err.message, "bad"); throw err; });
    return saving;
  }

  function weekList(obj, wk) { obj.weeks[wk] = obj.weeks[wk] || []; return obj.weeks[wk]; }
  function removeLink(wk, id) {
    commit(function (o) { o.weeks[wk] = weekList(o, wk).filter(function (x) { return x.id !== id; }); if (!o.weeks[wk].length) delete o.weeks[wk]; }, "Remove resource from Week " + wk).catch(function () {});
  }
  function moveLink(wk, id, dir) {
    commit(function (o) {
      var l = weekList(o, wk), i = l.findIndex(function (x) { return x.id === id; }), j = i + dir;
      if (i < 0 || j < 0 || j >= l.length) return; var t = l[i]; l[i] = l[j]; l[j] = t;
    }, "Reorder Week " + wk + " resources").catch(function () {});
  }

  // ---------- add / edit dialog ----------
  var editing = null;
  function openEditor(wk, id) {
    var it = id ? (links.weeks[wk] || []).filter(function (x) { return x.id === id; })[0] : null;
    editing = { week: wk, id: id || null };
    $("edTitle").textContent = (it ? "Edit resource in" : "Add a resource to") + " Week " + wk;
    $("edUrl").value = it ? it.url : ""; $("edLabel").value = it ? it.label : ""; $("edDesc").value = it ? (it.description || "") : "";
    $("edKind").value = it ? it.kind : "PowerPoint"; $("edBtn").value = it ? (it.buttonText || "") : "";
    $("edDl").checked = it ? !!it.download : true; $("edMsg").textContent = ""; $("edMsg").className = "msg";
    kindTouched = !!it; syncDl(); $("edDlg").showModal(); $("edUrl").focus();
  }
  var kindTouched = false;
  $("edKind").addEventListener("change", function () { kindTouched = true; syncDl(); });
  $("edUrl").addEventListener("input", function () {
    var k = guessKind(this.value); if (k && !kindTouched) $("edKind").value = k;
    if (!/^https?:\/\//i.test(this.value.trim()) && this.value.trim()) this.setCustomValidity("Paste the full link, starting with https://"); else this.setCustomValidity("");
    syncDl();
  });
  function syncDl() {
    var k = $("edKind").value, can = k !== "Link" && k !== "Folder";
    $("edDlWrap").hidden = !can;
    $("edDlHint").textContent = isOneDrive($("edUrl").value) || !$("edUrl").value ? "Adds a second button that downloads the file instead of opening it in OneDrive." : "Download only works reliably for OneDrive and SharePoint links.";
  }
  $("edCancel").addEventListener("click", function () { $("edDlg").close(); });
  $("edForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var url = $("edUrl").value.trim(), label = $("edLabel").value.trim();
    if (!/^https?:\/\//i.test(url)) { $("edMsg").className = "msg bad"; $("edMsg").textContent = "Paste the full share link, starting with https://"; return; }
    var kind = $("edKind").value;
    var rec = { id: editing.id || uid(), kind: kind, label: label, description: $("edDesc").value.trim(), url: url,
                download: kind !== "Link" && kind !== "Folder" && $("edDl").checked, buttonText: $("edBtn").value.trim() || undefined };
    var wk = editing.week, isEdit = !!editing.id, go = $("edSave");
    go.disabled = true; $("edMsg").className = "msg"; $("edMsg").textContent = "Saving to GitHub...";
    commit(function (o) {
      var l = weekList(o, wk), i = l.findIndex(function (x) { return x.id === rec.id; });
      if (i > -1) l[i] = rec; else l.push(rec);
    }, (isEdit ? "Edit" : "Add") + " Week " + wk + " resource: " + label)
      .then(function () { $("edDlg").close(); openState["week-" + wk] = true; render(); })
      .catch(function (err) { $("edMsg").className = "msg bad"; $("edMsg").textContent = err.message === "no token" ? "Connect GitHub in Settings first." : "Not saved: " + err.message; })
      .then(function () { go.disabled = false; });
  });
})();
