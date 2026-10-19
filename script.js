// script.js — SmartResolve client with optional Google Sheets backend
// After you deploy the Google Apps Script web app, paste its URL below as API_ENDPOINT.
// Example: var API_ENDPOINT = "https://script.google.com/macros/s/AKfycbx.../exec";

(function () {
  var API_ENDPOINT = ""; // <-- REPLACE WITH YOUR APPS SCRIPT WEB APP URL

  var tickets = [
    { id: "NT-2026-001", cat: "Network Connectivity", pri: "High", desc: "Internet/Wi-Fi failure for 5 users – warehouse VLAN 20", tech: "Alex Rivera", time: "2h 15m", status: "In Progress" },
    { id: "NT-2026-002", cat: "Software", pri: "Medium", desc: "Password reset for user j.doe@novatech.com", tech: "Maya Kim", time: "45m", status: "Resolved" },
    { id: "NT-2026-003", cat: "Hardware", pri: "Low", desc: "Mouse not responsive – desk 17 replaced", tech: "Liam Chen", time: "30m", status: "Resolved" },
    { id: "NT-2026-004", cat: "Server Outage", pri: "High", desc: "DB Server CRMPROD01 unresponsive, service outage", tech: "Priya Singh", time: "4h 03m", status: "In Progress" },
    { id: "NT-2026-005", cat: "Software", pri: "Medium", desc: "ERP login error – permission denied for accounting team", tech: "Jordan Lee", time: "1h 20m", status: "Open" }
  ];
  var seedCount = tickets.length;

  function fetchRemoteTickets() {
    if (!API_ENDPOINT) return Promise.resolve([]);
    return fetch(API_ENDPOINT + "?action=list")
      .then(function (r) { if (!r.ok) throw new Error('Network response not OK'); return r.json(); })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return []; });
  }

  try {
    var saved = JSON.parse(localStorage.getItem("nt-submitted") || "[]");
    if (Array.isArray(saved)) saved.forEach(function (t) { if (t && t.id && t.desc) tickets.push(t); });
  } catch (e) {}

  var state = { pri: "All", status: "All" };
  var rows = document.getElementById("rows");
  var empty = document.getElementById("empty");

  function esc(s) { return String(s).replace(/[&<>\"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pillClass(s) { return s === "Resolved" ? "pill resolved" : s === "Open" ? "pill open" : "pill"; }

  function renderStats() {
    var high = tickets.filter(function (t) { return t.pri === "High"; }).length;
    var res = tickets.filter(function (t) { return t.status === "Resolved"; }).length;
    var prog = tickets.filter(function (t) { return t.status === "In Progress"; }).length;
    document.getElementById("stats").innerHTML =
      '<div class="stat"><b>' + tickets.length + '</b><span>Total tickets</span></div>' +
      '<div class="stat high"><b>' + high + '</b><span>High priority</span></div>' +
      '<div class="stat"><b>' + prog + '</b><span>In progress</span></div>' +
      '<div class="stat"><b>' + res + '</b><span>Resolved</span></div>';
  }

  function renderRows() {
    var list = tickets.filter(function (t) {
      return (state.pri === "All" || t.pri === state.pri) && (state.status === "All" || t.status === state.status);
    });
    rows.innerHTML = list.map(function (t) {
      return '<tr class="' + (t.pri === "High" ? "is-high" : "") + '">' +
        '<td class="id">' + esc(t.id) + '</td><td>' + esc(t.cat) + '</td><td>' + esc(t.pri) + '</td>' +
        '<td>' + esc(t.desc) + '</td><td>' + esc(t.tech || '') + '</td><td class="num">' + esc(t.time || '') + '</td>' +
        '<td><span class="' + pillClass(t.status) + '">' + esc(t.status) + '</span></td></tr>';
    }).join("");
    empty.hidden = list.length > 0;
  }

  function chips(containerId, key, values) {
    var box = document.getElementById(containerId);
    values.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = v;
      b.setAttribute("aria-pressed", v === "All" ? "true" : "false");
      b.addEventListener("click", function () {
        state[key] = v;
        box.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
        renderRows();
      });
      box.appendChild(b);
    });
  }

  renderStats(); renderRows();
  chips("fPriority", "pri", ["All", "High", "Medium", "Low"]);
  chips("fStatus", "status", ["All", "Open", "In Progress", "Resolved"]);

  var form = document.getElementById("tform");
  var catSel = document.getElementById("cat");
  var usersWrap = document.getElementById("usersWrap");
  var usersSel = document.getElementById("users");
  var prioOut = document.getElementById("prioOut");
  var ack = document.getElementById("ack");

  function assess() {
    var cat = catSel.value;
    if (!cat) return null;
    var n = usersWrap.hidden ? "1" : usersSel.value;
    var pri = "Medium", level = "Level 1 response within 2 hours", why = "Standard request.";
    if (cat === "Hardware") { pri = "Low"; why = "A single device problem."; }
    if (cat === "Network Connectivity" && n === "5+") { pri = "High"; level = "Escalated to Level 2 within 24 hours"; why = "5 or more people are affected."; }
    if (cat === "Server Outage") { pri = "High"; level = "Level 1 response within 2 hours, then Level 2 if downtime passes 30 minutes"; why = "Server outages are always High priority."; }
    return { pri: pri, level: level, why: why, n: n };
  }

  function showPriority() {
    usersWrap.hidden = catSel.value !== "Network Connectivity";
    var a = assess();
    if (!a) { prioOut.innerHTML = '<span class="hint">Choose a category to see the priority and the response time.</span>'; return; }
    prioOut.innerHTML = '<span class="pill ' + (a.pri === "High" ? "high" : "") + '">' + a.pri + ' priority</span>' +
      '<p style="margin:0">' + esc(a.level) + '.</p><p class="hint">' + esc(a.why) + '</p>';
  }
  catSel.addEventListener("change", showPriority);
  usersSel.addEventListener("change", showPriority);

  function setErr(field, msg) {
    var box = document.getElementById("f-" + field), out = document.getElementById("e-" + field);
    out.textContent = msg || "";
    box.classList.toggle("bad", !!msg);
    return !msg;
  }

  function nextId() {
    var max = 0;
    tickets.forEach(function (t) { var m = /(\d+)$/.exec(t.id); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return "NT-2026-" + String(max + 1).padStart(3, "0");
  }

  fetchRemoteTickets().then(function (remote) {
    var seen = {};
    tickets.forEach(function (t) { seen[t.id] = true; });
    remote.forEach(function (r) { if (r && r.id && !seen[r.id]) { tickets.push(r); seen[r.id] = true; } });
    renderStats(); renderRows();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = form.name.value.trim(), email = form.email.value.trim(), desc = form.desc.value.trim();
    var ok = true;
    ok = setErr("name", name.length < 2 ? "Enter your full name." : "") && ok;
    ok = setErr("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a valid email address, like name@company.com.") && ok;
    ok = setErr("cat", catSel.value ? "" : "Choose a request category.") && ok;
    ok = setErr("desc", desc.length < 10 ? "Describe the problem in at least 10 characters." : "") && ok;
    if (!ok) { var first = form.querySelector(".bad input, .bad select, .bad textarea"); if (first) first.focus(); return; }

    var a = assess();
    var t = { id: nextId(), cat: catSel.value, pri: a.pri, desc: desc, tech: "Team Leader", time: "Pending", status: "Open", name: name, email: email, more: form.more.value || "" };
    tickets.push(t);
    try { localStorage.setItem("nt-submitted", JSON.stringify(tickets.slice(seedCount))); } catch (err) {}

    if (API_ENDPOINT) {
      fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t)
      })
      .then(function (r) { return r.json(); })
      .then(function (res) { return fetchRemoteTickets(); })
      .then(function (remote) {
        var seen = {};
        tickets = tickets.filter(Boolean);
        tickets.forEach(function (tt) { if (tt && tt.id) seen[tt.id] = true; });
        remote.forEach(function (r) { if (r && r.id && !seen[r.id]) tickets.push(r); });
        renderStats(); renderRows();
      })
      .catch(function () { renderStats(); renderRows(); });
    } else {
      renderStats(); renderRows();
    }

    var sla = a.pri === "High" && a.level.indexOf("Level 2 within") === 0 ? "Level 2 – 24 hours" : "Level 1 – 2 hours";
    ack.innerHTML =
      '<h3><span class="ok-dot" aria-hidden="true">✓</span> Ticket ' + esc(t.id) + ' has been logged</h3>' +
      '<p class="hint" style="margin:0">It is now in the ticket log above. This is the acknowledgement email you would receive.</p>' +
      '<article class="mail"><header><small>Ticket acknowledgement · auto-response</small><strong>Subject: Ticket Received – [' + esc(t.id) + ']</strong></header>' +
      '<div class="body"><p>Dear ' + esc(name) + ',</p><p>Your request, "' + esc(desc) + '", has been successfully logged.</p>' +
      '<dl class="kv"><dt>Ticket ID</dt><dd>' + esc(t.id) + '</dd><dt>Priority</dt><dd' + (a.pri === "High" ? ' class="badge-high"' : '') + '>' + esc(a.pri) + '</dd><dt>Assigned to</dt><dd>Team Leader</dd><dt>Sent to</dt><dd>' + esc(email) + '</dd></dl>' +
      '<p>We\\'ll respond within the SLA timeframe (' + sla + '). You can track progress in SmartResolve.</p>' +
      '<p class="sig">Regards,<br>NovaTech Solutions | Help Desk<br>Team Leader Thato Ndlovu</p></div></article>' +
      '<p style="margin:1rem 0 0"><button type="button" class="btn ghost" id="clearTickets">Remove tickets I submitted</button></p>';
    ack.hidden = false;
    document.getElementById("clearTickets").addEventListener("click", function () {
      tickets.length = seedCount;
      try { localStorage.removeItem("nt-submitted"); } catch (err) {}
      renderStats(); renderRows(); ack.hidden = true;
    });
    form.reset(); showPriority();
    ack.scrollIntoView({ behavior: "smooth", block: "start" });
    ack.focus({ preventScroll: true });
  });

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  function selectTab(i) {
    tabs.forEach(function (t, j) {
      var on = i === j;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById("p" + j).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(i); });
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var n = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
        selectTab(n); tabs[n].focus();
      }
    });
  });
})();
