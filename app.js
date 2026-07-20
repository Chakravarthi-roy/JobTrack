let data = [];
let editIndex = null;
let sortDir = "desc";
let expandedNoteIndex = null;
let notesAnimating = false;
const NOTES_ANIM_MS = 220;

function todayISO() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d - offsetMs).toISOString().slice(0, 10);
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportJSON() {
  const content = JSON.stringify(data, null, 2);
  downloadBlob(content, "applications.json", "application/json");
}

function csvEscape(val) {
  const s = String(val == null ? "" : val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportCSV() {
  const cols = [
    "role",
    "company",
    "applied",
    "reply",
    "status",
    "reached",
    "source",
    "location",
    "notes",
  ];
  const header = cols.join(",");
  const rows = data.map((r) => cols.map((c) => csvEscape(r[c])).join(","));
  const csv = [header, ...rows].join("\r\n");
  downloadBlob(csv, "applications.csv", "text/csv;charset=utf-8;");
}

function toggleSort() {
  sortDir = sortDir === "desc" ? "asc" : "desc";
  document.getElementById("sortArrow").textContent = sortDir === "desc" ? "↓" : "↑";
  render();
}

function onSearchInput() {
  const box = document.getElementById("searchBox");
  document.getElementById("searchClearBtn").style.display = box.value ? "flex" : "none";
  render();
}

function clearSearch() {
  const box = document.getElementById("searchBox");
  box.value = "";
  document.getElementById("searchClearBtn").style.display = "none";
  box.focus();
  render();
}

function handleSearchKeydown(e) {
  if (e.key === "Escape") {
    clearSearch();
  }
}

async function load() {
  const res = await fetch("/api/applications");
  data = await res.json();
  render();
}

async function save() {
  await fetch("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function days(a) {
  if (!a) return "";
  const d1 = new Date(a),
    d2 = new Date();
  return Math.floor((d2 - d1) / 86400000);
}

function statusClass(s) {
  return s.toLowerCase().replace(/\s+/g, "");
}

function badgeLabel(r) {
  const outcome = r.status === "Rejected" || r.status === "No Response";
  if (outcome && r.reached && r.reached !== "Applied") {
    return `${r.status} · ${r.reached}`;
  }
  return r.status;
}

function toggleNotes(i) {
  if (notesAnimating) return;

  const closingIndex = expandedNoteIndex;
  const openingIndex = expandedNoteIndex === i ? null : i;

  if (closingIndex !== null) {
    const openRow = document.querySelector(`tr.notes-row[data-index="${closingIndex}"]`);
    if (openRow) {
      notesAnimating = true;
      openRow.classList.remove("open");
      setTimeout(() => {
        expandedNoteIndex = openingIndex;
        notesAnimating = false;
        render();
      }, NOTES_ANIM_MS);
      return;
    }
  }

  expandedNoteIndex = openingIndex;
  render();
}

function updateTally() {
  const el = document.getElementById("tally");
  if (!data.length) {
    el.textContent = "";
    return;
  }
  const active = data.filter(
    (r) => r.status === "Applied" || r.status === "Assessment" || r.status === "Interview",
  ).length;
  const offers = data.filter((r) => r.status === "Offer").length;
  el.innerHTML = `<strong>${data.length}</strong> total &nbsp;·&nbsp; <strong>${active}</strong> active &nbsp;·&nbsp; <strong>${offers}</strong> offer${offers === 1 ? "" : "s"}`;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, term) {
  const escaped = escapeHtml(text);
  if (!term) return escaped;
  const re = new RegExp(escapeRegExp(escapeHtml(term)), "gi");
  return escaped.replace(re, (m) => `<mark class="hl">${m}</mark>`);
}

function inlineMarkdown(escapedText) {
  let out = escapedText.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  out = out.replace(/\*\*([^\*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^\*\n]+)\*/g, "<em>$1</em>");
  return out;
}

function renderMarkdown(rawText) {
  const escaped = escapeHtml(rawText);
  const lines = escaped.split("\n");
  let html = "";
  let inList = false;
  lines.forEach((line) => {
    const bullet = line.match(/^[-*] (.*)$/);
    if (bullet) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inlineMarkdown(bullet[1])}</li>`;
      return;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    const h3 = line.match(/^### (.*)$/);
    const h2 = line.match(/^## (.*)$/);
    const h1 = line.match(/^# (.*)$/);
    if (h3) html += `<span class="note-h3">${inlineMarkdown(h3[1])}</span>`;
    else if (h2) html += `<span class="note-h2">${inlineMarkdown(h2[1])}</span>`;
    else if (h1) html += `<span class="note-h1">${inlineMarkdown(h1[1])}</span>`;
    else if (line.trim() === "") html += "<br>";
    else html += `${inlineMarkdown(line)}<br>`;
  });
  if (inList) html += "</ul>";
  return html;
}

function htmlNodeToMarkdown(node) {
  let md = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      md += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      const inner = htmlNodeToMarkdown(child);
      if (tag === "h1") md += `\n# ${inner.trim()}\n`;
      else if (tag === "h2") md += `\n## ${inner.trim()}\n`;
      else if (["h3", "h4", "h5", "h6"].includes(tag)) md += `\n### ${inner.trim()}\n`;
      else if (tag === "b" || tag === "strong") md += `**${inner}**`;
      else if (tag === "i" || tag === "em") md += `*${inner}*`;
      else if (tag === "br") md += "\n";
      else if (tag === "li") md += `- ${inner.trim()}\n`;
      else if (tag === "p" || tag === "div") md += `${inner}\n`;
      else if (tag === "a") {
        const href = child.getAttribute("href");
        md += href && /^https?:\/\//.test(href) ? `[${inner}](${href})` : inner;
      } else {
        md += inner;
      }
    }
  });
  return md;
}

function htmlToMarkdown(htmlString) {
  const container = document.createElement("div");
  container.innerHTML = htmlString;
  let md = htmlNodeToMarkdown(container);
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  return md;
}

function handleNotesPaste(e) {
  const html = e.clipboardData && e.clipboardData.getData("text/html");
  if (html && html.trim()) {
    e.preventDefault();
    const md = htmlToMarkdown(html);
    const el = e.target;
    const start = el.selectionStart,
      end = el.selectionEnd;
    el.value = el.value.slice(0, start) + md + el.value.slice(end);
    const newPos = start + md.length;
    el.selectionStart = el.selectionEnd = newPos;
    autoGrowNotes();
  }
}

function matchesFilters(r) {
  const term = document.getElementById("searchBox").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;
  if (statusFilter && r.status !== statusFilter) return false;
  if (term) {
    const hay =
      `${r.role || ""} ${r.company || ""} ${r.source || ""} ${r.location || ""} ${r.notes || ""}`.toLowerCase();
    if (!hay.includes(term)) return false;
  }
  return true;
}

function render() {
  const tb = document.getElementById("rows");
  const empty = document.getElementById("empty");
  tb.innerHTML = "";
  const searchTerm = document.getElementById("searchBox").value.trim();

  const order = data
    .map((_, i) => i)
    .filter((i) => matchesFilters(data[i]))
    .sort((a, b) => {
      const da = data[a].applied,
        db = data[b].applied;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      const diff = new Date(da) - new Date(db);
      return sortDir === "desc" ? -diff : diff;
    });

  if (!data.length) {
    empty.style.display = "block";
    empty.innerHTML = `<div class="big">No applications logged yet</div><div>Add your first one above to start tracking.</div>`;
  } else if (!order.length) {
    empty.style.display = "block";
    empty.innerHTML = `<div class="big">No matches</div><div>Try a different search term or status filter.</div>`;
  } else {
    empty.style.display = "none";
  }

  order.forEach((i) => {
    const r = data[i];
    const tr = document.createElement("tr");
    const d = r.status === "Applied" || r.status === "No Response" ? days(r.applied) : "";
    const dLong = typeof d === "number" && d >= 21;
    tr.innerHTML = `
<td class="role">${highlight(r.role, searchTerm)}</td>
<td class="company">${highlight(r.company, searchTerm)}</td>
<td class="mono">${r.applied || "—"}</td>
<td class="mono">${r.reply || "—"}</td>
<td><span class="badge ${statusClass(r.status)}">${badgeLabel(r)}</span></td>
<td>${r.source ? highlight(r.source, searchTerm) : "—"}</td>
<td>${r.location ? highlight(r.location, searchTerm) : "—"}</td>
<td><span class="waiting${dLong ? " long" : ""}">${d === "" ? "—" : d + "d"}</span></td>
<td><div class="row-actions">
<button class="icon-btn notes-btn${r.notes ? " has-notes" : ""}${expandedNoteIndex === i ? " active" : ""}" onclick="toggleNotes(${i})" title="Notes" aria-label="Toggle notes">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>
</button>
<button class="icon-btn edit-btn" onclick="editRow(${i})" title="Edit" aria-label="Edit entry">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
</button>
<button class="icon-btn del-btn" onclick="del(${i})" title="Delete" aria-label="Delete entry">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
</button>
</div></td>`;
    tb.appendChild(tr);

    if (expandedNoteIndex === i) {
      const nr = document.createElement("tr");
      nr.className = "notes-row";
      nr.dataset.index = i;
      const reachedLine =
        r.reached && r.reached !== "Applied"
          ? `<div class="reached-line">Reached: ${r.reached}</div>`
          : "";
      const noteText = r.notes
        ? `<div class="notes-text">${renderMarkdown(r.notes)}</div>`
        : '<span class="notes-empty">No notes yet — click Edit to add one.</span>';
      nr.innerHTML = `<td colspan="9"><div class="notes-inner">${reachedLine}${noteText}</div></td>`;
      tb.appendChild(nr);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          nr.classList.add("open");
        });
      });
    }
  });
  updateTally();
}

function submitEntry() {
  const roleEl = document.getElementById("role");
  const companyEl = document.getElementById("company");
  const appliedEl = document.getElementById("applied");
  const replyEl = document.getElementById("reply");
  const statusEl = document.getElementById("status");
  const reachedEl = document.getElementById("reached");
  const sourceEl = document.getElementById("source");
  const locationEl = document.getElementById("location");
  const notesEl = document.getElementById("notes");

  if (!roleEl.value || !companyEl.value) return;
  const entry = {
    role: roleEl.value,
    company: companyEl.value,
    applied: appliedEl.value,
    reply: replyEl.value,
    status: statusEl.value,
    reached: reachedEl.value,
    source: sourceEl.value,
    location: locationEl.value,
    notes: notesEl.value,
  };

  if (editIndex !== null) {
    data[editIndex] = entry;
  } else {
    data.push(entry);
  }

  clearForm();
  exitEditMode();
  render();
  save();
}

function autoGrowNotes() {
  const el = document.getElementById("notes");
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function editRow(i) {
  const r = data[i];
  document.getElementById("role").value = r.role || "";
  document.getElementById("company").value = r.company || "";
  document.getElementById("applied").value = r.applied || "";
  document.getElementById("reply").value = r.reply || "";
  document.getElementById("status").value = r.status || "Applied";
  document.getElementById("reached").value = r.reached || "Applied";
  document.getElementById("source").value = r.source || "";
  document.getElementById("location").value = r.location || "";
  document.getElementById("notes").value = r.notes || "";
  autoGrowNotes();

  editIndex = i;
  document.getElementById("formTitle").textContent = `Editing "${r.role}" at ${r.company}`;
  document.getElementById("submitBtn").textContent = "Update entry";
  document.getElementById("cancelBtn").style.display = "inline-block";
  document.getElementById("entryCard").classList.add("editing");
  document.getElementById("entryCard").scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  clearForm();
  exitEditMode();
}

function handleFormKeydown(e) {
  if (e.key === "Escape") {
    if (editIndex !== null) cancelEdit();
    else clearForm();
  }
}

function clearForm() {
  document
    .getElementById("entryForm")
    .querySelectorAll("input, textarea")
    .forEach((x) => (x.value = ""));
  document.getElementById("status").selectedIndex = 0;
  document.getElementById("reached").selectedIndex = 0;
  document.getElementById("applied").value = todayISO();
  autoGrowNotes();
}

function exitEditMode() {
  editIndex = null;
  document.getElementById("formTitle").textContent = "Log a new application";
  document.getElementById("submitBtn").textContent = "Add entry";
  document.getElementById("cancelBtn").style.display = "none";
  document.getElementById("entryCard").classList.remove("editing");
}

function del(i) {
  if (editIndex === i) exitEditMode();
  else if (editIndex !== null && editIndex > i) editIndex--;

  data.splice(i, 1);

  if (expandedNoteIndex === i) expandedNoteIndex = null;
  else if (expandedNoteIndex !== null && expandedNoteIndex > i) expandedNoteIndex--;

  render();
  save();
}
document.getElementById("applied").value = todayISO();
load();