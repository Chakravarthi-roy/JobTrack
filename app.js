let data=[];
let editIndex=null;
let sortDir="desc";
let expandedNotes=new Set();
function toggleSort(){
 sortDir = sortDir==="desc" ? "asc" : "desc";
 document.getElementById("sortArrow").textContent = sortDir==="desc" ? "↓" : "↑";
 render();
}
function onSearchInput(){
 const box=document.getElementById("searchBox");
 document.getElementById("searchClearBtn").style.display = box.value ? "flex" : "none";
 render();
}
function clearSearch(){
 const box=document.getElementById("searchBox");
 box.value="";
 document.getElementById("searchClearBtn").style.display="none";
 box.focus();
 render();
}
function handleSearchKeydown(e){
 if(e.key==="Escape"){
 clearSearch();
 }
}
async function load(){
 const res=await fetch("/api/applications");
 data=await res.json();
 render();
}
async function save(){
 await fetch("/api/applications",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(data)
 });
}
function days(a){
 if(!a) return "";
 const d1=new Date(a), d2=new Date();
 return Math.floor((d2-d1)/86400000);
}
function statusClass(s){
 return s.toLowerCase().replace(/\s+/g,"");
}
function badgeLabel(r){
 const outcome = r.status==="Rejected" || r.status==="No Response";
 if(outcome && r.reached && r.reached!=="Applied"){
 return `${r.status} · ${r.reached}`;
 }
 return r.status;
}
function toggleNotes(i){
 if(expandedNotes.has(i)) expandedNotes.delete(i);
 else expandedNotes.add(i);
 render();
}
function updateTally(){
 const el=document.getElementById("tally");
 if(!data.length){el.textContent="";return;}
 const active=data.filter(r=>r.status==="Applied"||r.status==="Assessment"||r.status==="Interview").length;
 const offers=data.filter(r=>r.status==="Offer").length;
 el.innerHTML=`<strong>${data.length}</strong> total &nbsp;·&nbsp; <strong>${active}</strong> active &nbsp;·&nbsp; <strong>${offers}</strong> offer${offers===1?"":"s"}`;
}
function escapeHtml(s){
 return String(s==null?"":s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
}
function escapeRegExp(s){
 return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function highlight(text, term){
 const escaped=escapeHtml(text);
 if(!term) return escaped;
 const re=new RegExp(escapeRegExp(escapeHtml(term)), "gi");
 return escaped.replace(re, m => `<mark class="hl">${m}</mark>`);
}
function matchesFilters(r){
 const term=document.getElementById("searchBox").value.trim().toLowerCase();
 const statusFilter=document.getElementById("statusFilter").value;
 if(statusFilter && r.status!==statusFilter) return false;
 if(term){
 const hay=`${r.role||""} ${r.company||""} ${r.source||""} ${r.location||""} ${r.notes||""}`.toLowerCase();
 if(!hay.includes(term)) return false;
 }
 return true;
}
function render(){
 const tb=document.getElementById("rows");
 const empty=document.getElementById("empty");
 tb.innerHTML="";
 const searchTerm=document.getElementById("searchBox").value.trim();

 const order=data.map((_,i)=>i).filter(i=>matchesFilters(data[i])).sort((a,b)=>{
 const da=data[a].applied, db=data[b].applied;
 if(!da && !db) return 0;
 if(!da) return 1;
 if(!db) return -1;
 const diff=new Date(da)-new Date(db);
 return sortDir==="desc" ? -diff : diff;
 });

 if(!data.length){
 empty.style.display="block";
 empty.innerHTML=`<div class="big">No applications logged yet</div><div>Add your first one above to start tracking.</div>`;
 }else if(!order.length){
 empty.style.display="block";
 empty.innerHTML=`<div class="big">No matches</div><div>Try a different search term or status filter.</div>`;
 }else{
 empty.style.display="none";
 }

 order.forEach(i=>{
 const r=data[i];
 const tr=document.createElement("tr");
 const d=(r.status==="Applied"||r.status==="No Response")?days(r.applied):"";
 const dLong=typeof d==="number" && d>=21;
 tr.innerHTML=`
<td class="role">${highlight(r.role, searchTerm)}</td>
<td class="company">${highlight(r.company, searchTerm)}</td>
<td class="mono">${r.applied||"—"}</td>
<td class="mono">${r.reply||"—"}</td>
<td><span class="badge ${statusClass(r.status)}">${badgeLabel(r)}</span></td>
<td>${r.source?highlight(r.source, searchTerm):"—"}</td>
<td>${r.location?highlight(r.location, searchTerm):"—"}</td>
<td>${r.jd?'<a class="jd-link" href="'+r.jd+'" target="_blank">Open ↗</a>':'—'}</td>
<td><span class="waiting${dLong?" long":""}">${d===""?"—":d+"d"}</span></td>
<td><div class="row-actions">
<button class="icon-btn notes-btn${r.notes?" has-notes":""}${expandedNotes.has(i)?" active":""}" onclick="toggleNotes(${i})" title="Notes" aria-label="Toggle notes">
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

 if(expandedNotes.has(i)){
 const nr=document.createElement("tr");
 nr.className="notes-row";
 const reachedLine=(r.reached && r.reached!=="Applied")?`<div class="reached-line">Reached: ${r.reached}</div>`:"";
 const noteText=r.notes?`<span class="notes-text">${highlight(r.notes, searchTerm)}</span>`:'<span class="notes-empty">No notes yet — click Edit to add one.</span>';
 nr.innerHTML=`<td colspan="10">${reachedLine}${noteText}</td>`;
 tb.appendChild(nr);
 }
 });
 updateTally();
}
function submitEntry(){
 const roleEl=document.getElementById("role");
 const companyEl=document.getElementById("company");
 const appliedEl=document.getElementById("applied");
 const replyEl=document.getElementById("reply");
 const statusEl=document.getElementById("status");
 const reachedEl=document.getElementById("reached");
 const sourceEl=document.getElementById("source");
 const locationEl=document.getElementById("location");
 const jdEl=document.getElementById("jd");
 const notesEl=document.getElementById("notes");

 if(!roleEl.value || !companyEl.value) return;
 const entry={
 role:roleEl.value,company:companyEl.value,applied:appliedEl.value,
 reply:replyEl.value,status:statusEl.value,reached:reachedEl.value,
 source:sourceEl.value,location:locationEl.value,jd:jdEl.value,notes:notesEl.value
 };

 if(editIndex!==null){
 data[editIndex]=entry;
 }else{
 data.push(entry);
 }

 clearForm();
 exitEditMode();
 render();
 save();
}
function autoGrowNotes(){
 const el=document.getElementById("notes");
 el.style.height="auto";
 el.style.height=el.scrollHeight+"px";
}
function editRow(i){
 const r=data[i];
 document.getElementById("role").value=r.role||"";
 document.getElementById("company").value=r.company||"";
 document.getElementById("applied").value=r.applied||"";
 document.getElementById("reply").value=r.reply||"";
 document.getElementById("status").value=r.status||"Applied";
 document.getElementById("reached").value=r.reached||"Applied";
 document.getElementById("source").value=r.source||"";
 document.getElementById("location").value=r.location||"";
 document.getElementById("jd").value=r.jd||"";
 document.getElementById("notes").value=r.notes||"";
 autoGrowNotes();

 editIndex=i;
 document.getElementById("formTitle").textContent=`Editing "${r.role}" at ${r.company}`;
 document.getElementById("submitBtn").textContent="Update entry";
 document.getElementById("cancelBtn").style.display="inline-block";
 document.getElementById("entryCard").classList.add("editing");
 document.getElementById("entryCard").scrollIntoView?.({behavior:"smooth", block:"start"});
}
function cancelEdit(){
 clearForm();
 exitEditMode();
}
function handleFormKeydown(e){
 if(e.key==="Escape"){
 if(editIndex!==null) cancelEdit(); else clearForm();
 }
}
function clearForm(){
 document.getElementById("entryForm").querySelectorAll("input, textarea").forEach(x=>x.value="");
 document.getElementById("status").selectedIndex=0;
 document.getElementById("reached").selectedIndex=0;
 autoGrowNotes();
}
function exitEditMode(){
 editIndex=null;
 document.getElementById("formTitle").textContent="Log a new application";
 document.getElementById("submitBtn").textContent="Add entry";
 document.getElementById("cancelBtn").style.display="none";
 document.getElementById("entryCard").classList.remove("editing");
}
function del(i){
 if(editIndex===i) exitEditMode();
 else if(editIndex!==null && editIndex>i) editIndex--;

 data.splice(i,1);

 const shifted=new Set();
 expandedNotes.forEach(idx=>{
 if(idx<i) shifted.add(idx);
 else if(idx>i) shifted.add(idx-1);
 });
 expandedNotes=shifted;

 render();
 save();
}
load();