/* ========= Keys ========= */
const LS_USERS = 'sms_users_v1';
const LS_AUTH  = 'sms_auth_v1';
const LS_STUDS = 'sms_students_v1';

/* ========= Helpers ========= */
const $ = (s,root=document)=>root.querySelector(s);
const $$= (s,root=document)=>Array.from(root.querySelectorAll(s));
function loadJSON(k,fb){ try{return JSON.parse(localStorage.getItem(k)) ?? fb}catch{return fb} }
function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)) }

/* Simple password score 0..4 */
function pwScore(p){ let s=0; if(p.length>=8)s++; if(/[A-Z]/.test(p)&&/[a-z]/.test(p))s++; if(/\d/.test(p))s++; if(/[^\w\s]/.test(p))s++; return s; }
/* Hash (SHA-256 hex) */
async function sha256Hex(text){ const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }

/* ========= Router (hash-based) ========= */
const routes = {
  '#/login':'view-login',
  '#/register':'view-register',
  '#/home':'view-home',
  '#/add':'view-add',
  '#/students':'view-students'
};
function go(hash){
  const viewId = routes[hash] || (getSession()? 'view-home':'view-login');
  // auth gate
  const protectedViews = ['view-home','view-add','view-students'];
  if(protectedViews.includes(viewId) && !getSession()){
    location.hash = '#/login'; return;
  }
  // topbar show/hide
  $('#appTopbar').style.display = protectedViews.includes(viewId) ? '' : 'none';
  // nav active
  $$('.nav a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===hash));
  // show current view
  Object.values(routes).forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById(viewId).classList.remove('hidden');
  // enter hooks
  if(viewId==='view-home') onEnterHome();
  if(viewId==='view-students') renderTable();
  if(viewId==='view-add') setupAddEditForm();
}
window.addEventListener('hashchange', ()=>go(location.hash));

/* ========= Auth ========= */
function getSession(){ return loadJSON(LS_AUTH,null) }
function setSession(o){ saveJSON(LS_AUTH,o) }
function clearSession(){ localStorage.removeItem(LS_AUTH) }

function bindLogin(){
  const form = $('#login-form'); if(!form) return;
  $('#login-toggle').addEventListener('click', ()=> {
    const el=$('#login-password'); el.type = el.type==='password'?'text':'password';
  });
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const u=$('#login-username').value.trim();
    const p=$('#login-password').value;
    const msg=$('#login-msg');
    const users = loadJSON(LS_USERS,[]);
    const found = users.find(x=>x.username.toLowerCase()===u.toLowerCase());
    if(!found){ msg.textContent='ไม่พบบัญชีผู้ใช้'; msg.style.color='#ffd1a6'; return; }
    const hash = await sha256Hex(p);
    if(hash!==found.passHash){ msg.textContent='รหัสผ่านไม่ถูกต้อง'; msg.style.color='#ffd1a6'; return; }
    setSession({username:found.username,name:found.name,loginAt:Date.now()});
    msg.textContent='เข้าสู่ระบบสำเร็จ ✓'; msg.style.color='#b5ffb0';
    setTimeout(()=> location.hash='#/home', 300);
  });
}

function bindRegister(){
  const form = $('#register-form'); if(!form) return;
  const nameEl=$('#reg-name'), userEl=$('#reg-username'), passEl=$('#reg-password'), confEl=$('#reg-confirm'), agreeEl=$('#agree');
  const barIn=$('#passBarIn'), passTxt=$('#passTxt'), submitBtn=$('#reg-submit'), msg=$('#reg-msg');

  $('#togglePass').addEventListener('click', ()=>{ passEl.type = passEl.type==='password'?'text':'password' });
  $('#toggleConfirm').addEventListener('click', ()=>{ confEl.type = confEl.type==='password'?'text':'password' });

  function updateStrength(){
    const sc = pwScore(passEl.value);
    const labels=['อ่อนมาก','อ่อน','ปานกลาง','ดี','แข็งแรง'];
    barIn.style.width = ['0%','25%','50%','75%','100%'][sc];
    passTxt.textContent = 'ความแข็งแรง: ' + labels[sc];
  }
  function ok(){
    return nameEl.value.trim().length>=2 &&
           userEl.value.trim().length>=4 &&
           passEl.value.length>=8 &&
           confEl.value===passEl.value &&
           agreeEl.checked;
  }
  [nameEl,userEl,passEl,confEl,agreeEl].forEach(el=>{
    el.addEventListener('input', ()=>{ updateStrength(); submitBtn.disabled=!ok(); });
    el.addEventListener('change', ()=>{ updateStrength(); submitBtn.disabled=!ok(); });
  });
  updateStrength(); submitBtn.disabled=!ok();

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!ok()){ submitBtn.disabled=true; return; }
    const users = loadJSON(LS_USERS,[]);
    if(users.some(u=>u.username.toLowerCase()===userEl.value.trim().toLowerCase())){
      msg.textContent='ชื่อผู้ใช้นี้ถูกใช้แล้ว'; msg.style.color='#ffd1a6'; return;
    }
    const hash = await sha256Hex(passEl.value);
    users.push({id:Date.now().toString(36), name:nameEl.value.trim(), username:userEl.value.trim(), passHash:hash});
    saveJSON(LS_USERS, users);
    msg.textContent='สมัครสมาชิกสำเร็จ ✓'; msg.style.color='#b5ffb0';
    setTimeout(()=> location.hash='#/login', 600);
  });
}

function bindLogout(){
  $('#logoutBtn')?.addEventListener('click', ()=>{ clearSession(); location.hash='#/login'; });
}

/* ========= Home enter (welcome & name) ========= */
function onEnterHome(){
  const sess = getSession(); if(sess) $('#currentUserName').textContent = sess.name || sess.username;
  const modal = $('#welcomeModal');
  if(!sessionStorage.getItem('welcomed') && modal){
    modal.style.display='flex';
    $('#closeModal').addEventListener('click', ()=> modal.style.display='none');
    window.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none' });
    sessionStorage.setItem('welcomed','1');
  }
}

/* ========= Students CRUD ========= */
function students(){ return loadJSON(LS_STUDS,[]) }
function setStudents(arr){ saveJSON(LS_STUDS,arr) }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7) }

(function seed(){
  if(students().length===0){
    setStudents([
      {id:uid(), code:'66010001', firstName:'Somchai', lastName:'Jaidee', major:'IT', phone:'0812345678', email:'somchai@example.com'},
      {id:uid(), code:'66010002', firstName:'Suda', lastName:'Meechai', major:'CS', phone:'0891112222', email:'suda@example.com'}
    ]);
  }
})();

function setupAddEditForm(){
  const form = $('#student-form'); if(!form) return;
  const params = new URLSearchParams(location.hash.split('?')[1]||'');
  const editId = params.get('id');
  const msg = $('#form-msg');
  if(editId){
    $('#form-title').textContent='แก้ไขข้อมูลนักศึกษา';
    const s = students().find(x=>x.id===editId);
    if(s){
      $('#studentId').value=s.id; $('#code').value=s.code; $('#firstName').value=s.firstName; $('#lastName').value=s.lastName;
      $('#major').value=s.major; $('#phone').value=s.phone; $('#email').value=s.email;
    }
  }else{
    $('#form-title').textContent='เพิ่มข้อมูลนักศึกษา';
    form.reset(); $('#studentId').value='';
  }

  form.onsubmit = (e)=>{
    e.preventDefault();
    const code=$('#code').value.trim(), firstName=$('#firstName').value.trim(),
          lastName=$('#lastName').value.trim(), major=$('#major').value.trim(),
          phone=$('#phone').value.trim(), email=$('#email').value.trim();
    if(!code||!firstName||!lastName||!major||!phone||!email){ msg.textContent='กรุณากรอกข้อมูลให้ครบถ้วน'; msg.style.color='#ffd1a6'; return; }

    let list = students();
    const idCur = $('#studentId').value;
    if(idCur){
      const i=list.findIndex(x=>x.id===idCur);
      if(i>-1){ list[i]={id:idCur, code, firstName, lastName, major, phone, email}; setStudents(list); msg.textContent='บันทึกการแก้ไขสำเร็จ ✓'; msg.style.color='#b5ffb0'; setTimeout(()=>location.hash='#/students',500); }
    }else{
      if(list.some(x=>x.code===code)){ msg.textContent='มีรหัสนักศึกษานี้แล้ว'; msg.style.color='#ffd1a6'; return; }
      list.push({id:uid(), code, firstName, lastName, major, phone, email}); setStudents(list);
      form.reset(); msg.textContent='เพิ่มข้อมูลสำเร็จ ✓'; msg.style.color='#b5ffb0';
    }
  };
}

function renderTable(){
  const tbody = $('#tbody'); const empty = $('#empty'); if(!tbody) return;
  const q = ($('#search')?.value||'').toLowerCase().trim();
  const list = students().filter(s=>[s.code,s.firstName,s.lastName,s.major,s.phone,s.email].join(' ').toLowerCase().includes(q));
  tbody.innerHTML = '';
  if(list.length===0){ empty.style.display=''; return; } else empty.style.display='none';
  for(const s of list){
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${s.code}</td>
      <td>${s.firstName} ${s.lastName}</td>
      <td>${s.major}</td>
      <td>${s.phone}</td>
      <td>${s.email}</td>
      <td class="center">
        <a class="btn" href="#/add?id=${encodeURIComponent(s.id)}">✏️ แก้ไข</a>
        <button class="btn danger" data-del="${s.id}">ลบ</button>
      </td>`;
    tbody.appendChild(tr);
  }
}

function bindStudentsPage(){
  $('#search')?.addEventListener('input', renderTable);
  $('#export-json')?.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(students(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='students.json'; a.click(); URL.revokeObjectURL(url);
  });
  $('#clear-all')?.addEventListener('click', ()=>{
    if(confirm('ลบข้อมูลทั้งหมดในระบบ (localStorage)?')){ setStudents([]); renderTable(); }
  });
  $('#students-table')?.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-del]'); if(!btn) return;
    const id = btn.getAttribute('data-del');
    if(confirm('ยืนยันการลบข้อมูลนี้หรือไม่?')){
      setStudents(students().filter(x=>x.id!==id)); renderTable();
    }
  });
}

/* ========= App boot ========= */
function init(){
  bindLogin(); bindRegister(); bindLogout(); bindStudentsPage();
  if(!location.hash) location.hash = '#/login';
  go(location.hash);
}
document.addEventListener('DOMContentLoaded', init);
