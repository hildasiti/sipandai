console.info('SIPANDAI v4.14 — Ringkasan Tahfidz responsif tanpa tombol per siswa.');
'use strict';
const S={token:'',user:null,home:null,view:'dashboard',classId:'',childId:'',additional:{},att:null,attEdit:false,attMode:'HARIAN',attDate:'',attMapel:'',sessionNo:'1',busy:false,menuCache:new Map(),needsHome:false,attRequest:0,learningTab:'journal'};
try { S.token=sessionStorage.getItem('sipandai_token')||''; } catch(e) {}
const $=(q)=>document.querySelector(q);
const E=(v)=>String(v===undefined||v===null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fd=(form)=>Object.fromEntries(new FormData(form).entries());
const role=(...names)=>!!S.user&&names.includes(S.user.role);
const studentName=(id)=>((S.home?.students||[]).find(s=>s.id===id)||S.home?.currentChild||{}).name||'Siswa';
const className=(id)=>((S.home?.classes||[]).find(c=>c.id===id)||{}).name||'Kelas';
// Dialog internal SIPANDAI — menggantikan confirm/alert bawaan browser.
const sipModalQueue=[];
let sipModalActive=false;
function sipDialog(message, options={}){
  return new Promise(resolve=>{
    sipModalQueue.push({message:String(message||''),options,resolve});
    sipNextDialog();
  });
}
function sipNextDialog(){
  if(sipModalActive||!sipModalQueue.length)return;
  sipModalActive=true;
  const {message,options,resolve}=sipModalQueue.shift();
  const isAlert=options.alert===true,destructive=options.danger===true;
  const previous=document.activeElement;
  const backdrop=document.createElement('div');
  backdrop.className='sip-dialog-backdrop';
  backdrop.innerHTML='<section class="sip-dialog-panel" role="alertdialog" aria-modal="true" aria-labelledby="sip-dialog-title" aria-describedby="sip-dialog-description" tabindex="-1">'+
    '<div class="sip-dialog-icon" aria-hidden="true"></div><h2 id="sip-dialog-title"></h2><p id="sip-dialog-description"></p>'+
    '<div class="sip-dialog-buttons"><button type="button" class="btn btn-outline sip-dialog-cancel">Batal</button><button type="button" class="btn btn-primary sip-dialog-ok">Lanjutkan</button></div></section>';
  const panel=backdrop.querySelector('.sip-dialog-panel'), title=backdrop.querySelector('#sip-dialog-title'), description=backdrop.querySelector('#sip-dialog-description');
  const cancel=backdrop.querySelector('.sip-dialog-cancel'),ok=backdrop.querySelector('.sip-dialog-ok');
  title.textContent=options.title||(destructive?'Konfirmasi penghapusan':isAlert?'Informasi SIPANDAI':'Konfirmasi tindakan');
  description.textContent=message;
  backdrop.querySelector('.sip-dialog-icon').textContent=destructive?'!':isAlert?'i':'?';
  if(destructive){backdrop.classList.add('sip-dialog-danger');ok.textContent=options.confirmText||'Ya, lanjutkan';}
  else ok.textContent=options.confirmText||(isAlert?'Mengerti':'Lanjutkan');
  if(isAlert)cancel.hidden=true;
  document.body.appendChild(backdrop);
  const finish=value=>{
    document.removeEventListener('keydown',onKey,true);
    backdrop.remove();sipModalActive=false;
    try{previous?.focus?.();}catch(e){}
    resolve(value);sipNextDialog();
  };
  const onKey=e=>{
    if(e.key==='Escape'){e.preventDefault();finish(false);}
    if(e.key==='Tab'){
      const controls=isAlert?[ok]:[cancel,ok];const first=controls[0],last=controls[controls.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  };
  document.addEventListener('keydown',onKey,true);
  cancel.addEventListener('click',()=>finish(false),{once:true});
  ok.addEventListener('click',()=>finish(true),{once:true});
  backdrop.addEventListener('click',e=>{if(e.target===backdrop&&!isAlert)finish(false);});
  (isAlert?ok:cancel).focus();
}
function sipConfirm(message,options={}){return sipDialog(message,options);}
function sipAlert(message,options={}){return sipDialog(message,{...options,alert:true});}
function toast(msg,error=false){const t=$('#toast');t.textContent=msg;t.className='toast'+(error?' error':'');t.style.display='block';clearTimeout(window._toastTimer);window._toastTimer=setTimeout(()=>t.style.display='none',4100);}
// v4.0: seluruh modul memakai transport API tunggal.
async function call(action,payload={}){
  const endpoint=String(window.SIPANDAI_CONFIG?.API_URL||'').trim();
  if(!/^https:\/\/[^\s]+\/api\/?$/.test(endpoint)){
    throw new Error('Alamat API belum diatur. Isi API_URL pada config.js setelah menyiapkan Cloudflare Worker.');
  }
  if(S.busy)processMessage(processLabel(action));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),120000);
  const requestStarted=performance.now();
  try{
    const response=await fetch(endpoint,{
      method:'POST',
      mode:'cors',
      cache:'no-store',
      credentials:'omit',
      // A simple CORS POST avoids a separate OPTIONS preflight. Worker validates
      // Origin, JSON payload, session token, and the backend bridge secret.
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify({action,payload,token:S.token||''}),
      signal:controller.signal
    });
    let result;
    try{result=await response.json();}
    catch(_){throw new Error('Respons server bukan JSON. Periksa URL Worker dan deployment Apps Script.');}
    if(!response.ok || !result || result.ok!==true){
      throw new Error(result?.error||result?.message||('Permintaan gagal (HTTP '+response.status+').'));
    }
    return result.data;
  }catch(err){
    if(err?.name==='AbortError')throw new Error('Permintaan melewati 120 detik. Cek data sebelum mencoba menyimpan ulang.');
    if(err instanceof TypeError)throw new Error('Tidak dapat menghubungi API SIPANDAI. Periksa koneksi, Worker, dan pengaturan domain GitHub Pages.');
    throw err;
  }finally{
    clearTimeout(timer);
    const elapsed=Math.round(performance.now()-requestStarted);
    console.info('[SIPANDAI_PERF]',action,'roundtrip_ms='+elapsed);
  }
}
// Cache antarmuka singkat: pindah menu tidak selalu menunggu API.
// Key termasuk identitas pengguna + kelas + parameter, sehingga tidak tertukar.
function menuCacheKey(action,payload={}){return [S.user?.id||'',S.classId,action,JSON.stringify(payload)].join('|');}
const pendingMenuRequests=new Map();
function cachedCall(action,payload={},ttl=30000){
  const key=menuCacheKey(action,payload),item=S.menuCache.get(key);
  if(ttl!==0&&item&&Date.now()<item.until)return Promise.resolve(item.value);
  if(pendingMenuRequests.has(key))return pendingMenuRequests.get(key);
  const request=call(action,payload).then(value=>{
    S.menuCache.set(key,{value,until:Date.now()+ttl});
    if(S.menuCache.size>60)S.menuCache.delete(S.menuCache.keys().next().value);
    return value;
  }).finally(()=>pendingMenuRequests.delete(key));
  pendingMenuRequests.set(key,request);
  return request;
}
function forgetMenuCache(...actions){
  for(const k of S.menuCache.keys())if(actions.some(a=>k.includes('|'+a+'|')))S.menuCache.delete(k);
}
// v4.12.1: kompatibilitas untuk backend yang masih memakai dua endpoint Tahfidz lama.
// Jika aksi gabungan tahDashboard belum tersedia, alihkan ke tahSettings + tahClassReport.
// Tidak mengulang mutasi/simpan; kedua endpoint fallback bersifat hanya-baca.
let tahDashboardUseLegacy=false;
const pendingTahDashboard=new Map();
function tahUnknownAction(err){return /aksi\s+tidak\s+dikenal(?:i)?|unknown\s+action/i.test(String(err?.message||err||''));}
function fetchTahDashboard(payload,ttl=45000){
  const key=menuCacheKey('tahDashboard',payload),cached=S.menuCache.get(key);
  if(ttl!==0&&cached&&Date.now()<cached.until)return Promise.resolve(cached.value);
  if(pendingTahDashboard.has(key))return pendingTahDashboard.get(key);
  const request=(async()=>{
    if(!tahDashboardUseLegacy){
      try{
        const combined=await cachedCall('tahDashboard',payload,ttl);
        if(!combined?.settings||!combined?.klass)throw new Error('Respons ringkasan Tahfidz tidak lengkap.');
        return combined;
      }catch(err){
        if(!tahUnknownAction(err))throw err;
        tahDashboardUseLegacy=true;
        console.warn('SIPANDAI: API Tahfidz gabungan belum tersedia; menggunakan endpoint lama sampai sesi ini berakhir.');
      }
    }
    const [settings,klass]=await Promise.all([
      cachedCall('tahSettings',payload,ttl),
      cachedCall('tahClassReport',payload,ttl)
    ]);
    const result={settings,klass};
    S.menuCache.set(key,{value:result,until:Date.now()+ttl});
    return result;
  })().finally(()=>pendingTahDashboard.delete(key));
  pendingTahDashboard.set(key,request);
  return request;
}
let operationStarted=0, operationTimer=null;
function processLabel(action){return ({login:'Memeriksa akun dan hak akses',logout:'Mengakhiri sesi',saveAttendance:'Menyimpan absensi siswa',saveJournal:'Menyimpan jurnal pembelajaran',saveAssessment:'Menyimpan asesmen',saveTask:'Menyimpan penugasan',addStudent:'Menyimpan data siswa',importStudents:'Mengimpor siswa dan akun orang tua',updateStudent:'Memperbarui siswa',saveBehavior:'Menyimpan catatan perilaku',changePassword:'Mengganti password',resetPassword:'Mereset password',saveGrades:'Menyimpan nilai'})[action]||(/^archive/i.test(action)?'Mengarsipkan data':'Menghubungi server SIPANDAI');}
function processMessage(label){const e=document.getElementById('sip-process-label');if(e)e.textContent=label||'Memproses permintaan…';}
function busy(state){
  S.busy=state;
  document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=state);
  let overlay=document.getElementById('sip-process-overlay');
  if(state){
    if(!overlay){overlay=document.createElement('div');overlay.id='sip-process-overlay';overlay.className='sip-process-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML='<div class="sip-process-panel"><div class="sip-process-ring"><span>✓</span></div><strong id="sip-process-label">Sedang memproses…</strong><p id="sip-process-time">Menghubungi server, mohon tunggu.</p><div class="sip-process-track"><span></span></div><small>Jangan tutup halaman sebelum proses selesai.</small></div>';document.body.appendChild(overlay);}
    operationStarted=Date.now();
    clearInterval(operationTimer);
    const update=()=>{const seconds=Math.floor((Date.now()-operationStarted)/1000),e=document.getElementById('sip-process-time');if(e)e.textContent=seconds<5?'Menghubungi server SIPANDAI…':seconds<15?`Masih memproses (${seconds} detik)…`:`Masih bekerja (${seconds} detik). Koneksi atau Spreadsheet mungkin sedang lambat.`;};
    update();operationTimer=setInterval(update,1000);
  }else{clearInterval(operationTimer);operationTimer=null;overlay?.remove();}
}

async function submitAction(action,data,opt={}){
  try{
    busy(true);
    const res=await call(action,data);
    if(['createUser','updateUser','resetPassword','createClass','updateClass','createSubject','updateSubject','addStudent','saveSubjectOwners','assignTeacher','linkParent','reviewRequest','requestLink','saveNotice','publishNotice','confirmNotice','saveBehavior','publishBehavior','saveAttendance'].includes(action)){
      if(action!=='saveAttendance') S.needsHome=true;
      if(action==='saveAttendance')forgetMenuCache('attendance');
      if(['linkParent','resetPassword'].includes(action))forgetMenuCache('parents');
      if(action==='reviewRequest'||action==='requestLink')forgetMenuCache('requests');
    }
    if(opt.credentials)showCredential(res);
    else if(opt.message!==false)toast(res.message||'Data berhasil disimpan.');
    if(opt.refresh!==false)await loadHome();
    return res;
  }catch(e){toast(e.message,true);}finally{busy(false);}
}
function showCredential(c){const node=$('#credential-box');if(node){node.innerHTML=`<div class="credential"><b>Simpan dan sampaikan secara privat</b><div class="section-gap">Username: <code>${E(c.username)}</code></div><div>Password sementara: <code>${E(c.password)}</code></div><p class="hint">Password ini hanya ditampilkan sekali. Pemilik akun harus menggantinya saat login pertama.</p><button type="button" class="btn btn-sm" data-action="copy-credential" data-value="${E('Username: '+c.username+'\nPassword: '+c.password)}">Salin kredensial</button></div>`;node.scrollIntoView({behavior:'smooth',block:'nearest'});}else{void sipAlert('Username: '+c.username+'\nPassword: '+c.password+'\n\nSimpan dengan aman.',{title:'Kredensial akun'});}}
function fillOptions(arr,selected='',placeholder='Pilih...'){return `<option value="">${E(placeholder)}</option>`+arr.map(x=>`<option value="${E(x.id)}" ${String(x.id)===String(selected)?'selected':''}>${E(x.name)}</option>`).join('');}
function head(title,description,action=''){
  const module=isLearningView(S.view)||['tahfidz','printing'].includes(S.view);
  const moduleTitle=isLearningView(S.view)?(role('ORANG_TUA')?'Pembelajaran':'Teacher Planner'):title;
  const compactDesc=isLearningView(S.view)?'Absensi, jurnal, penilaian, tugas, dan perilaku.':description;
  return `<div class="page-header${module?' compact-module':''}"><div><h1>${E(moduleTitle)}</h1>${compactDesc?`<p>${E(compactDesc)}</p>`:''}</div>${action}</div>`;
}
function empty(msg){return `<div class="empty">${E(msg)}</div>`;}
function loader(){return '<div class="loader sip-data-loader" role="status"><div class="sip-loader-art"><span></span><span></span><span></span></div><strong>Menyiapkan data…</strong><span class="small muted">Mengambil informasi dari Spreadsheet</span></div>';}
const MENUS={learning:['▤','Teacher Planner'],progress:['◴','Perkembangan'],journal:['▤','Teacher Planner'],assessments:['◈','Asesmen & Nilai'],tasks:['▧','Penugasan'],dashboard:['◫','Beranda'],notices:['◉','Pengumuman'],attendance:['▦','Absensi'],behaviors:['♡','Perilaku'],tahfidz:['◉','Tahfidz'],students:['♧','Siswa'],teachers:['▤','Guru Mapel'],parents:['⌂','Keluarga'],requests:['✓','Verifikasi'],users:['♙','Akun Guru'],classes:['▣','Kelas & Mapel'],printing:['▤','Cetak & Laporan'],settings:['⚙','Pengaturan'],more:['☰','Lainnya']};
function menuItems(){
  // Modul utama saja di sidebar; kegiatan Absensi & Perilaku merupakan tab Teacher Planner.
  const all=['dashboard','learning','tahfidz','notices'];
  if(!role('GURU_MAPEL'))all.push('progress');
  if(role('ADMIN','GURU_KELAS'))all.push('students','teachers');
  if(role('ADMIN','ORANG_TUA'))all.push('parents');
  if(role('ADMIN'))all.push('users','classes');
  if(!role('ORANG_TUA'))all.push('printing');
  all.push('settings');
  return all;
}
const MOBILE_NAV=['dashboard','learning','tahfidz','notices','more'];
function navButton(id,mobile=false){
  const active=S.view===id||(id==='learning'&&isLearningView(S.view));
  const label=id==='learning'&&role('ORANG_TUA')?'Pembelajaran':MENUS[id][1];
  return `<button type="button" data-action="nav" data-view="${id}" class="${mobile?'mobile-nav-btn':'nav-btn'} ${active?'active':''}" ${mobile?`aria-label="${E(label)}"`:''}><span class="sym" aria-hidden="true">${MENUS[id][0]}</span><span class="nav-label">${E(label)}</span></button>`;
}
function otherMenuItems(){return menuItems().filter(id=>!MOBILE_NAV.includes(id));}
function baseUI(){
  const initials=(S.user.fullName||'S').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  const cs=S.home?.classes||[];
  $('#app').innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><img class="logo" src="./icons/sipandai-logo6-256.png" alt="Logo SIPANDAI"><div><div class="logo-name">SIPANDAI</div><div class="small muted">Sekolah & Keluarga</div></div></div><nav class="nav" aria-label="Navigasi utama">${menuItems().map(id=>navButton(id)).join('')}</nav><div class="side-bottom"><div class="small muted">${E(S.user.role.replace('_',' '))}</div><b>${E(S.user.fullName)}</b><div class="section-gap"><button class="btn btn-outline btn-full" data-action="logout">Keluar akun</button></div></div></aside><main class="main"><header class="topbar"><div class="brand"><img class="logo" src="./icons/sipandai-logo6-256.png" alt="Logo SIPANDAI" style="width:35px;height:35px"><div><b>SIPANDAI</b><small>Informasi Pembelajaran & Pendampingan Anak</small></div></div><div class="topright">${cs.length>1&&!role('ORANG_TUA')?`<select class="select-small" id="switch-class" aria-label="Pilih kelas">${cs.map(c=>`<option value="${E(c.id)}" ${c.id===S.classId?'selected':''}>${E(c.name)}</option>`).join('')}</select>`:''}<span class="avatar">${E(initials)}</span><span class="name"><b>${E(S.user.fullName)}</b><small>${E(S.user.role.replaceAll('_',' '))}</small></span><button type="button" class="topbar-mobile-logout" data-action="logout" aria-label="Keluar akun">⇥ <span>Keluar</span></button></div></header><div id="content" class="main-content"></div></main></div><div id="mobile-more" class="mobile-more" role="dialog" aria-label="Menu lainnya" aria-hidden="true"><div class="mobile-more-title"><b>Menu Lainnya</b><button type="button" class="mobile-more-close" data-action="close-more" aria-label="Tutup menu">✕</button></div><nav aria-label="Menu tambahan">${otherMenuItems().map(id=>navButton(id)).join('')}</nav><div class="mobile-more-profile"><div class="small muted">${E(S.user.role.replaceAll('_',' '))}</div><b>${E(S.user.fullName)}</b></div><button type="button" class="btn btn-outline btn-full mobile-more-logout" data-action="logout">⇥ Keluar Akun</button></div><nav class="mobilebar" aria-label="Navigasi utama ponsel">${MOBILE_NAV.map(x=>navButton(x,true)).join('')}</nav>`;
}
function toggleMobileMore(open){
  const el=document.getElementById('mobile-more');if(!el)return;
  const next=typeof open==='boolean'?open:!el.classList.contains('open');
  el.classList.toggle('open',next);
  el.setAttribute('aria-hidden',String(!next));
  const trigger=document.querySelector('.mobilebar [data-view="more"]');
  if(trigger)trigger.setAttribute('aria-expanded',String(next));
  if(next)el.querySelector('.mobile-more-close')?.focus();
  else if(el.contains(document.activeElement))trigger?.focus();
}
function loginUI(){S.user=null;$('#app').innerHTML=`<div class="login-wrap"><div class="login-card"><div class="brand"><img class="logo" src="./icons/sipandai-logo6-256.png" alt="Logo SIPANDAI"><div><div class="logo-name">SIPANDAI</div><div class="small muted">Sekolah dan keluarga, saling terhubung</div></div></div><h1>Selamat datang kembali</h1><p class="muted">Masuk untuk melihat aktivitas pembelajaran dan perkembangan anak.</p><form id="login-form"><div class="field"><label class="label">Username / NIS</label><input name="username" autocomplete="username" required placeholder="Masukkan username atau NIS"></div><div class="field"><label class="label">Password</label><input name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password"></div><button type="submit" class="btn btn-primary btn-full">Masuk ke SIPANDAI →</button></form><div class="login-foot">Orang tua menggunakan NIS atau username akun keluarga dan password yang diberikan oleh guru kelas. Jika lupa password, hubungi Admin sekolah.</div></div></div>`;}
function passwordUI(){ $('#app').innerHTML=`<div class="login-wrap"><div class="login-card"><div class="brand"><img class="logo" src="./icons/sipandai-logo6-256.png" alt="Logo SIPANDAI"><b class="logo-name">SIPANDAI</b></div><h1>Ganti password awal</h1><p class="muted">Untuk menjaga data siswa, password sementara wajib diganti sebelum mengakses aplikasi.</p>${changePasswordForm()}<button class="btn btn-outline btn-full section-gap" data-action="logout">Keluar akun</button></div></div>`;}
function changePasswordForm(){return `<form id="change-password-form"><div class="field"><label class="label">Password saat ini</label><input type="password" name="oldPassword" required autocomplete="current-password"></div><div class="field"><label class="label">Password baru</label><input type="password" name="newPassword" minlength="5" required autocomplete="new-password" placeholder="Minimal 5 karakter; angka, huruf, atau campuran"></div><button class="btn btn-primary" type="submit">Simpan password baru</button></form>`;}
async function loadHome(){const home=await call('home',{classId:S.classId,childId:S.childId});S.needsHome=false;S.home=home;S.user=home.user;if(S.user.role==='GURU_MAPEL')S.attMode='MAPEL';S.classId=home.classId;S.childId=home.currentChild?.id||'';if(S.user.mustChangePassword){passwordUI();return;}baseUI();render();}
// SIPANDAI v4.14 — muat data opsional satu per satu hanya ketika Beranda sedang idle.
// Hindari 2 API berjalan bersamaan segera setelah login (terutama saat Google ContentService tidak stabil).
let sipPrefetchTimer=null;
let sipPrefetchSequence=0;
function prefetchTodayAttendance(){
  const generation=++sipPrefetchSequence;
  if(sipPrefetchTimer)clearTimeout(sipPrefetchTimer);
  if(!S.user||!S.home||!S.classId)return;
  const uid=S.user.id,classId=S.classId,day=S.home.serverDate;
  const eligible=()=>generation===sipPrefetchSequence&&S.user?.id===uid&&
    S.classId===classId&&S.home?.serverDate===day&&S.view==='dashboard'&&
    document.visibilityState==='visible'&&!S.busy&&Boolean(S.token);
  sipPrefetchTimer=setTimeout(async()=>{
    if(!eligible())return;
    if(role('ADMIN','GURU_KELAS','GURU_MAPEL')){
      const mode=role('GURU_MAPEL')?'MAPEL':'HARIAN';
      const subject=(S.home.subjects||[])[0]?.id||'';
      if(mode==='HARIAN'||subject){
        try{await cachedCall('attendance',{classId,date:day,mode,mapelId:subject,sessionNo:S.sessionNo},45000);}catch(_){/* optional prefetch */}
      }
    }
    if(!eligible()||role('ORANG_TUA'))return;
    // Delay again before Tahfidz; never overlap with attendance prefetch.
    await new Promise(resolve=>setTimeout(resolve,1000));
    if(!eligible())return;
    const period=(day||'').slice(0,7),payload={classId,period};
    if(period){try{await fetchTahDashboard(payload,45000);}catch(_){/* optional prefetch */}}
  },5000);
}
function prefetchTahfidz(){/* scheduled serially by prefetchTodayAttendance() */}

function render(){if(!S.home)return;document.querySelectorAll('[data-action=nav]').forEach(el=>el.classList.toggle('active',el.dataset.view===S.view||(el.dataset.view==='learning'&&isLearningView(S.view))));switch(S.view){case 'tahfidz':return renderTahfidz();case 'journal':return renderJournal();case 'assessments':return renderAssessments();case 'tasks':return renderTasks();case 'progress':return renderProgress();case 'dashboard':return renderDashboard();case 'printing':if(role('ORANG_TUA')){S.view='dashboard';return renderDashboard();}return renderPrinting();case 'notices':return renderNotices();case 'attendance':return renderAttendance();case 'behaviors':return renderBehaviors();case 'students':return renderStudents();case 'teachers':return renderTeachers();case 'parents':return renderParents();case 'requests':S.view='parents';FAMILY.tab='requests';return renderParents();case 'users':return renderUsers();case 'classes':return renderClasses();case 'settings':return renderSettings();default:S.view='dashboard';renderDashboard();}}
const LEARNING_VIEWS=['attendance','journal','assessments','tasks','behaviors'];
function isLearningView(id){return LEARNING_VIEWS.includes(id);}
function learningTabs(){
  const parent=role('ORANG_TUA');
  const tabs=[
    ['attendance','▦','Absen'],
    ['journal','▤','Jurnal'],
    ['assessments','◈','Asesmen & Nilai'],
    ['tasks','▧','Penugasan'],
    ['behaviors','♡','Perilaku']
  ].filter(x=>!parent||!['attendance','journal'].includes(x[0]));
  return `<nav class="module-tabs" aria-label="Bagian Teacher Planner">${tabs.map(x=>`<button type="button" class="module-tab ${S.view===x[0]?'active':''}" data-action="learning-tab" data-tab="${x[0]}" aria-current="${S.view===x[0]?'page':'false'}"><span aria-hidden="true">${x[1]}</span>${x[2]}</button>`).join('')}</nav>`;
}
function tahCacheContext(){return [S.user?.id||'',S.classId,S.childId||''].join('|');}
function clearTahDom(){if(typeof TAH!=='undefined')TAH.savedDom=null;}
function setContent(html){
 const content=$('#content');if(!content)return;
 // Simpan DOM Tahfidz sebenarnya (termasuk state form) saat berpindah menu.
 // Tidak membuat snapshot HTML: pilihan/form dan listener browser tetap utuh.
 if(S.view!=='tahfidz'&&content.querySelector('#tah-main')&&typeof TAH!=='undefined'&&((role('ORANG_TUA')&&TAH.detail)||(!role('ORANG_TUA')&&TAH.klass&&TAH.settings))&&TAH.viewClass===S.classId){
   const fragment=document.createDocumentFragment();
   while(content.firstChild)fragment.appendChild(content.firstChild);
   TAH.savedDom={fragment,context:tahCacheContext()};
 }
 content.innerHTML=html;
 // Susunan konsisten: judul modul, tab, baru konten.
 if(isLearningView(S.view)){
   const head=content.querySelector('.page-header');
   if(head)head.insertAdjacentHTML('afterend',learningTabs());
   else content.insertAdjacentHTML('afterbegin',learningTabs());
 }
}
function stat(label,value,sub=''){return `<div class="card stat"><div class="meta">${E(label)}</div><div class="value">${E(value)}</div><div class="meta">${E(sub)}</div></div>`;}
function childCards(){const children=S.home.children||[];return `<div class="child-grid">${children.map(c=>`<button type="button" class="child-card ${S.childId===c.id?'selected':''}" data-action="switch-child" data-id="${E(c.id)}"><div class="row"><span class="badge-round">🎒</span><div><div class="child-name">${E(c.name)}</div><div class="small muted">NIS ${E(c.nis)} · ${E(className(c.classId))}</div></div></div></button>`).join('')}</div>`;}
function renderDashboard(){const x=S.home,st=x.stats,cl=className(x.classId);const parent=role('ORANG_TUA');let html=head(parent?'Portal Orang Tua/Wali':'Ringkasan kegiatan','');
  if(parent){
    html+=`<div class="card parent-student-banner"><div class="panel-title">Nama Siswa ${x.children.length>1?`<span class="pill green">${x.children.length} anak</span>`:''}</div>${x.children.length?childCards():empty('Belum ada siswa yang terhubung. Hubungi Admin sekolah untuk memverifikasi relasi.')}</div>`;
    html+=`<div class="grid grid4 section-gap dashboard-stats parent-dashboard-stats" aria-label="Ringkasan perkembangan siswa">
      <div id="parent-stat-attendance">${stat('Kehadiran bulan ini','…','Memuat rincian hadir, izin, sakit, alpa')}</div>
      <div id="parent-stat-behavior">${stat('Catatan perilaku',st.behaviors||0,'Memuat apresiasi dan pembinaan')}</div>
      <div id="parent-stat-grades">${stat('Rata-rata nilai harian','—','Memuat nilai terpublikasi')}</div>
      <div id="parent-stat-tahfidz">${stat('Capaian Tahfidz','—','Memuat target dan murojaah')}</div>
    </div>`;
  }else{
    html+=`<div class="dashboard-class-banner"><span class="class-icon" aria-hidden="true">▦</span><span class="class-info">Kelas aktif: <b>${E(cl)}</b></span></div>`;
    html+=`<div class="grid grid4 section-gap dashboard-stats">${stat('Siswa di kelas',st.students)}${stat('Pengumuman terbit',st.notices)}${stat('Hadir hari ini',st.present||0,`Dari ${st.todayRecorded||0} absensi masuk`)}${stat('Catatan perilaku',st.behaviors)}</div>`;
  }
  html+=`<div class="grid grid2 section-gap dashboard-feeds"><div class="card"><div class="panel-title">Pengumuman terbaru <button type="button" class="btn btn-sm" data-action="nav" data-view="notices">Lihat semua</button></div><div class="stack">${x.notices.filter(a=>a.status==='PUBLISHED').slice(0,parent?3:4).map(n=>`<button type="button" class="item sip-notice-open" data-action="notice-detail" data-id="${E(n.id)}"><div class="small muted">${E(n.createdAt.slice(0,10))} · ${E(n.scope==='SEKOLAH'?'Sekolah':className(n.classId))}</div><h3>${E(n.title)}</h3><p class="small">${E(n.body.slice(0,180))}</p><span class="small sip-link-more">Lihat selengkapnya ›</span></button>`).join('')||empty('Belum ada pengumuman.')}</div></div><div class="card"><div class="panel-title">Catatan perkembangan perilaku <button type="button" class="btn btn-sm" data-action="nav" data-view="behaviors">Selengkapnya</button></div><div class="stack">${x.behaviors.slice(0,parent?3:4).map(b=>`<div class="item"><div class="item-head"><span class="pill ${b.kind==='POSITIF'?'green':'yellow'}">${b.kind==='POSITIF'?'Apresiasi':'Pembinaan'}</span><span class="small muted">${E(b.createdAt.slice(0,10))}</span></div><h3>${E(parent?'Untuk '+(x.currentChild?.name||'anak'):studentName(b.studentId))}</h3><p class="small">${E(b.description.slice(0,155))}</p></div>`).join('')||empty('Belum ada catatan perilaku.')}</div></div></div>`;
  setContent(html);
  if(parent&&S.childId)void loadParentDashboardCards();
}
async function loadParentDashboardCards(){
  const classId=S.classId,studentId=S.childId,requestKey=classId+'|'+studentId;
  const current=()=>role('ORANG_TUA')&&S.classId===classId&&S.childId===studentId&&S.view==='dashboard';
  // Tidak menahan Beranda: nilai dan Tahfidz dirender saat masing-masing respons siap.
  cachedCall('progressReport',{classId,studentId},50000).then(r=>{
    if(!current())return;
    PARENT_GRADE_UI.report=r;PARENT_GRADE_UI.key=requestKey;
    const month=r.attendance?.month;
    const att=$('#parent-stat-attendance');
    if(att)att.innerHTML=month?stat('Kehadiran bulan ini',month.present+' hadir',`Sakit ${month.sick} · Izin ${month.excused} · Alpa ${month.absent}`):stat('Kehadiran',r.attendance?.present||0,`Dari ${r.attendance?.total||0} hari tercatat`);
    const behavior=$('#parent-stat-behavior');if(behavior)behavior.innerHTML=stat('Catatan perilaku',(r.behavior.positive+r.behavior.guidance),`${r.behavior.positive} apresiasi · ${r.behavior.guidance} pembinaan`);
    const grades=$('#parent-stat-grades');if(grades){const g=r.parentGrades;grades.innerHTML=g?stat('Rata-rata nilai harian',g.dailyAverage===null?'—':formatParentGrade(g.dailyAverage),g.dailyCount+' nilai Harian/Proyek terpublikasi'):stat('Rata-rata nilai harian','—','Perbarui backend ke v4.8');}
  }).catch(e=>{if(current()){console.warn('Ringkasan wali belum tersedia:',e.message);const el=$('#parent-stat-grades');if(el)el.innerHTML=stat('Rata-rata nilai harian','—','Data belum tersedia');const at=$('#parent-stat-attendance');if(at)at.innerHTML=stat('Kehadiran',S.home?.stats?.present||0,'Dari '+(S.home?.stats?.daysRecorded||0)+' hari tercatat');}});
  cachedCall('tahStudentReport',{classId,studentId},60000).then(t=>{
    if(!current())return;const e=$('#parent-stat-tahfidz');if(e)e.innerHTML=stat('Capaian Tahfidz',t.totalTarget?`${t.doneTarget} / ${t.totalTarget}`:'—',t.totalTarget?`ayat target · Murojaah ${t.murojaahSessions||0} sesi`:'Belum ada target · Murojaah '+(t.murojaahSessions||0)+' sesi');
  }).catch(e=>{if(current()){const el=$('#parent-stat-tahfidz');if(el)el.innerHTML=stat('Capaian Tahfidz','—','Belum ada data Tahfidz');}});
}
function closeNoticeDialog(){const m=$('#sip-notice-detail-dialog');if(m)m.remove();}
function openNoticeDialog(id){
  const n=(S.home?.notices||[]).find(x=>x.id===id);if(!n)return;
  closeNoticeDialog();
  const isParent=role('ORANG_TUA');
  const node=document.createElement('div');node.id='sip-notice-detail-dialog';node.className='sip-notice-backdrop';
  node.innerHTML=`<section class="sip-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="sip-notice-dialog-title"><div class="sip-notice-dialog-head"><div><small class="muted">${E(n.createdAt?.slice(0,10)||'')} · ${E(n.scope==='SEKOLAH'?'Sekolah':className(n.classId))}</small><h2 id="sip-notice-dialog-title">${E(n.title)}</h2></div><button type="button" class="btn btn-outline" data-action="close-notice-dialog" aria-label="Tutup">✕</button></div><div class="sip-notice-dialog-content">${E(n.body)}</div><div class="sip-notice-dialog-foot">${isParent&&n.requireConfirm==='YES'?(n.confirmed?'<span class="pill green">✓ Sudah dikonfirmasi</span>':`<button class="btn btn-primary" data-action="confirm-notice" data-id="${E(n.id)}">Konfirmasi sudah membaca</button>`):''}<button class="btn btn-outline" data-action="close-notice-dialog">Tutup</button></div></section>`;
  document.body.appendChild(node);node.querySelector('button')?.focus();
}
async function openNoticeConfirmations(noticeId){
  const n=S.home?.notices?.find(x=>x.id===noticeId);if(!n)return;
  closeNoticeDialog();const node=document.createElement('div');node.id='sip-notice-detail-dialog';node.className='sip-notice-backdrop';
  node.innerHTML=`<section class="sip-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="sip-notice-dialog-title"><div class="sip-notice-dialog-head"><div><small class="muted">Rekap konfirmasi wali</small><h2 id="sip-notice-dialog-title">${E(n.title)}</h2></div><button class="btn btn-outline" data-action="close-notice-dialog">✕</button></div><div id="sip-notice-confirm-rows" class="sip-notice-dialog-content">${loader()}</div></section>`;
  document.body.appendChild(node);
  try{const result=await call('noticeConfirmations',{noticeId});const h=$('#sip-notice-confirm-rows');if(!h)return;
    h.innerHTML=`<p class="notice">${result.confirmed} dari ${result.total} relasi siswa–wali sudah dikonfirmasi.</p><div class="stack section-gap">${(result.rows||[]).map(x=>`<div class="item row-between wrap"><div><b>${E(x.studentName)}</b><div class="small muted">${E(x.nis)} · ${E(x.parentName)} (${E(x.username)})</div></div><span class="pill ${x.confirmed?'green':'yellow'}">${x.confirmed?'Sudah konfirmasi':'Belum konfirmasi'}</span></div>`).join('')||empty('Belum ada akun wali terhubung.')}</div>`;
  }catch(err){const h=$('#sip-notice-confirm-rows');if(h)h.innerHTML='<div class="notice warning">'+E(err.message)+'</div>';}
}
function renderNotices(){const x=S.home,can=role('ADMIN','GURU_KELAS','GURU_MAPEL'),parent=role('ORANG_TUA');let html=head('Papan pengumuman','Jadwal, ujian, agenda, dan informasi penting untuk keluarga.');
  if(can)html+=`<div class="card"><div class="panel-title">Tulis pengumuman baru</div><form id="notice-form"><div class="form-grid"><div class="field"><label class="label">Judul</label><input name="title" maxlength="120" required placeholder="Contoh: Ujian Matematika"></div><div class="field"><label class="label">Jangkauan</label><select name="scope"><option value="KELAS">Kelas aktif</option>${role('ADMIN')?'<option value="SEKOLAH">Seluruh sekolah</option>':''}</select></div><div class="wide field"><label class="label">Isi pengumuman</label><textarea name="body" maxlength="3500" required placeholder="Informasi yang perlu disampaikan..."></textarea></div><div class="field"><label class="label">Status</label><select name="status"><option value="PUBLISHED">Publikasikan sekarang</option><option value="DRAFT">Simpan draft</option></select></div><div class="field"><label class="label">Konfirmasi orang tua</label><select name="requireConfirm"><option value="">Tidak wajib</option><option value="YES">Memerlukan konfirmasi dibaca</option></select></div></div><button type="submit" class="btn btn-primary">Simpan pengumuman</button></form></div>`;
  html+=`<div class="card section-gap"><div class="panel-title">Daftar pengumuman <span class="pill">${x.notices.length}</span></div><div class="stack">${x.notices.map(n=>`<div class="item"><div class="item-head"><span class="pill ${n.status==='PUBLISHED'?'green':'yellow'}">${E(n.status==='PUBLISHED'?'Terbit':'Draft')}</span><span class="small muted">${E(n.createdAt.slice(0,10))} · ${E(n.scope==='SEKOLAH'?'Sekolah':className(n.classId))}</span></div><h3 style="margin-top:9px">${E(n.title)}</h3>${parent?`<button type="button" class="sip-notice-open sip-notice-summary" data-action="notice-detail" data-id="${E(n.id)}">${E(n.body.slice(0,180))}${n.body.length>180?'…':''} <span class="sip-link-more">Baca lengkap ›</span></button>`:`<p>${E(n.body)}</p>`}${can&&n.status==='DRAFT'&&(role('ADMIN')||n.authorId===S.user.id||role('GURU_KELAS'))?`<div class="actions"><button class="btn btn-sm btn-primary" data-action="publish-notice" data-id="${E(n.id)}">Terbitkan draft</button></div>`:''}${n.requireConfirm==='YES'?`<div class="section-gap">${parent? n.confirmed?'<span class="pill green">✓ Sudah dikonfirmasi</span>':'<span class="small muted">Buka detail untuk konfirmasi</span>':`<button class="btn btn-sm btn-outline" data-action="notice-confirmations" data-id="${E(n.id)}">Lihat konfirmasi orang tua</button>`}</div>`:''}</div>`).join('')||empty('Belum ada pengumuman.')}</div></div>`;setContent(html);
}
function renderAttendance(){if(role('GURU_MAPEL'))S.attMode='MAPEL';if(role('ORANG_TUA')){S.view='dashboard';render();return;}const x=S.home,mode=S.attMode,write=role('ADMIN','GURU_KELAS','GURU_MAPEL');if(!S.attDate)S.attDate=x.serverDate;if(!x.subjects.some(s=>s.id===S.attMapel))S.attMapel=x.subjects[0]?.id||'';
  const html=head('Absensi siswa','Absensi harian hanya satu kali per kelas; absensi mapel dicatat per sesi.')+`<div class="card"><div class="form-grid"><div class="field"><label class="label">Jenis absensi</label><select id="att-mode">${role('GURU_MAPEL')?'':`<option value="HARIAN" ${mode==='HARIAN'?'selected':''}>Harian</option>`}<option value="MAPEL" ${mode==='MAPEL'?'selected':''}>Per mata pelajaran</option></select></div><div class="field"><label class="label">Tanggal</label><input id="att-date" type="date" value="${E(S.attDate)}"></div>${mode==='MAPEL'?`<div class="field"><label class="label">Mata pelajaran</label><select id="att-subject">${fillOptions(x.subjects,S.attMapel,'Pilih mapel')}</select></div><div class="field"><label class="label">Sesi</label><select id="att-session">${Array.from({length:5},(_,i)=>`<option value="${i+1}" ${S.sessionNo===String(i+1)?'selected':''}>Sesi ${i+1}</option>`).join('')}</select></div>`:''}</div><div class="actions"><button class="btn btn-outline btn-sm" data-action="load-att">↻ Perbarui daftar</button><span class="small muted">Daftar muncul otomatis setelah tanggal dipilih.</span></div></div><div id="att-content" class="section-gap">${loader()}</div>`;
  setContent(html);
  const payload={classId:S.classId,date:S.attDate,mode:S.attMode,mapelId:S.attMapel,sessionNo:S.sessionNo};
  const cached=S.menuCache.get(menuCacheKey('attendance',payload));
  if(cached&&Date.now()<cached.until)paintAttendance(cached.value);
  else loadAttendance();
}
// v4.5: setiap perubahan tanggal, mapel, atau sesi memuat daftar secara otomatis.
function changeAttendanceSelection(){
  if(S.view!=='attendance'||!S.home)return;
  const date=$('#att-date')?.value||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const subject=$('#att-subject')?.value||S.attMapel;
  const session=$('#att-session')?.value||S.sessionNo;
  if(date===S.attDate&&subject===S.attMapel&&session===S.sessionNo)return;
  S.attDate=date;S.attMapel=subject;S.sessionNo=session;
  S.att=null;S.attEdit=false;S.pendingAttendance=null;
  const area=$('#att-content');if(area)area.innerHTML=loader();
  void loadAttendance();
}
async function loadAttendance(force=false){
  const reqNo=++S.attRequest;
  if(!S.home.classId){const h=$('#att-content');if(h)h.innerHTML=empty(role('GURU_MAPEL')?'Belum ada kelas atau mapel yang ditugaskan kepada akun Anda. Minta Guru Kelas menetapkan pengampu pada menu Guru Mapel.':'Buat atau pilih kelas terlebih dahulu.');return;}
  if(S.attMode==='MAPEL'&&!S.attMapel){const h=$('#att-content');if(h)h.innerHTML=empty('Tidak ada mata pelajaran yang ditugaskan ke akun ini. Guru Kelas perlu mengatur pengampu.');return;}
  try{
    const req={classId:S.classId,date:S.attDate,mode:S.attMode,mapelId:S.attMapel,sessionNo:S.sessionNo};
    // Manual refresh bypasses the short browser cache. Normal navigation uses it.
    const res=force?await call('attendance',req):await cachedCall('attendance',req,45000);
    if(reqNo!==S.attRequest||S.view!=='attendance')return;
    if(force)S.menuCache.set(menuCacheKey('attendance',req),{value:res,until:Date.now()+45000});
    paintAttendance(res);
  }catch(err){if(reqNo!==S.attRequest||S.view!=='attendance')return;const h=$('#att-content');if(h)h.innerHTML='<div class="notice warning">'+E(err.message)+'</div>';}
}
function paintAttendance(res){
  S.att=res;
  if(!res.hasSaved)S.attEdit=true;
  const unlocked=res.editable&&(!res.hasSaved||S.attEdit);
  const area=$('#att-content');if(!area)return;
  if(!res.rows.length){area.innerHTML=empty('Belum ada siswa di kelas ini.');return;}
  area.innerHTML=`<div class="card"><div class="row-between"><div><h2>Daftar kehadiran</h2><p class="small muted">${res.hasSaved?(unlocked?'Sedang mengedit absensi yang tersimpan.':'✓ Tersimpan'):'Belum disimpan. Semua siswa disiapkan sebagai Hadir.'}</p></div>${unlocked?'<button class="btn btn-sm" data-action="all-present">Semua hadir</button>':''}</div><form id="attendance-form"><div class="att-list section-gap">${res.rows.map((r,i)=>`<div class="att-student" data-student-id="${E(r.id)}"><div class="att-person"><span class="att-number">${i+1}</span><div><b>${E(r.name)}</b><span class="att-nis">NIS ${E(r.nis)}</span></div></div><div class="att-controls"><select class="att-status att-hidden-select" aria-label="Kehadiran ${E(r.name)}" ${unlocked?'':'disabled'}>${[['H','Hadir'],['S','Sakit'],['I','Izin'],['A','Alpa']].map(([v,t])=>`<option value="${v}" ${r.status===v?'selected':''}>${t}</option>`).join('')}</select><div class="att-choice" role="group" aria-label="Status kehadiran ${E(r.name)}">${[['H','Hadir'],['S','Sakit'],['I','Izin'],['A','Alpa']].map(([v,t])=>`<button type="button" class="att-choice-btn ${r.status===v?'selected':''} ${'att-'+v}" data-action="select-att-status" data-status="${v}" aria-pressed="${r.status===v}" ${unlocked?'':'disabled'}>${t}</button>`).join('')}</div><button type="button" class="att-note-toggle" data-action="toggle-att-note" title="Catatan siswa" aria-label="Buka catatan ${E(r.name)}">✎</button></div><div class="att-note-container" style="display:${r.note?'block':'none'}"><input class="att-note" value="${E(r.note)}" maxlength="200" placeholder="Catatan (opsional)" ${unlocked?'':'disabled'}></div></div>`).join('')}</div>${unlocked?`<div class="actions section-gap"><button class="btn btn-primary" type="submit">${res.hasSaved?'Simpan perubahan':'Simpan semua absensi'}</button>${res.hasSaved?'<button type="button" class="btn" data-action="cancel-att-edit">Batal edit</button>':''}</div>`:res.editable&&res.hasSaved?'<div class="actions section-gap"><span class="pill green">✓ Tersimpan</span><button type="button" class="btn" data-action="edit-attendance">Edit Absensi</button></div>':'<p class="hint">Hanya tersedia untuk monitoring.</p>'}</form></div>`;
}
// Bukti simpan dicocokkan dengan seluruh siswa, bukan hanya satu atau dua baris.
function savedAttendanceMatches(result,rows){
  if(!result?.hasSaved||!Array.isArray(result.rows)||result.rows.length!==rows.length)return false;
  const byId=new Map(result.rows.map(x=>[x.id,x]));
  return rows.every(x=>{const r=byId.get(x.studentId);return r&&r.status===x.status&&String(r.note||'').trim()===String(x.note||'').trim();});
}
function attendanceSavedUi(snapshot,rows,context){
  S.attEdit=false;S.pendingAttendance=null;
  S.needsHome=false;
  if(context.mode==='HARIAN'&&context.classId===S.classId&&context.date===S.home?.serverDate){
    S.home.stats.present=rows.filter(x=>x.status==='H').length;
    S.home.stats.todayRecorded=rows.length;
  }
  S.menuCache.set(menuCacheKey('attendance',context),{value:snapshot,until:Date.now()+45000});
  if(S.view==='attendance'&&S.classId===context.classId&&S.attDate===context.date)paintAttendance(snapshot);
}
async function verifyAttendanceAfterError(context,rows,initialError){
  // Jangan otomatis ulangi write; respons 502 bisa datang setelah Apps Script sudah menulis.
  S.pendingAttendance={context,rows};
  try{
    const fresh=await call('attendance',context);
    if(savedAttendanceMatches(fresh,rows)){
      attendanceSavedUi(fresh,rows,context);
      toast('Absensi telah tersimpan. Respons jaringan sempat terputus.');
      return;
    }
    if(S.view==='attendance'&&S.classId===context.classId&&S.attDate===context.date){
      const f=$('#attendance-form');
      if(f&&!$('#att-verify-warning')){
        const notice=document.createElement('div');notice.id='att-verify-warning';notice.className='notice warning';
        notice.innerHTML='<strong>Status penyimpanan belum pasti.</strong><p>Jangan tutup halaman atau mengirim ulang sebelum memeriksa. Isian Anda tetap dipertahankan.</p><button type="button" class="btn btn-outline btn-sm" data-action="verify-attendance">Periksa status</button>';
        f.prepend(notice);
      }
    }
    toast('Simpan belum dapat dikonfirmasi: '+initialError.message,true);
  }catch(e){toast('Server belum dapat dihubungi. Isian tetap tersedia; periksa status setelah koneksi pulih.',true);}
}
function renderBehaviors(){const x=S.home,parent=role('ORANG_TUA'),can=role('ADMIN','GURU_KELAS','GURU_MAPEL');let html=head('Catatan perilaku','Apresiasi hal positif dan pendampingan yang perlu perhatian.');
  if(can)html+=`<div class="card"><div class="panel-title">Tambah catatan</div><form id="behavior-form"><div class="form-grid"><div class="field"><label class="label">Siswa</label><select name="studentId" required>${fillOptions(x.students,'','Pilih siswa')}</select></div><div class="field"><label class="label">Kategori</label><select name="kind"><option value="POSITIF">Positif / apresiasi</option><option value="PEMBINAAN">Perlu pembinaan</option></select></div><div class="wide field"><label class="label">Deskripsi kejadian</label><textarea name="description" maxlength="2500" required placeholder="Tuliskan kejadian secara objektif..."></textarea></div><div class="wide field"><label class="label">Tindak lanjut (opsional)</label><textarea name="followUp" maxlength="1200" placeholder="Pendampingan guru atau yang dapat dilakukan di rumah..."></textarea></div><div class="field"><label class="label">Dokumentasi (opsional)</label><input type="file" id="behavior-file" accept="image/jpeg,image/png,application/pdf"><p class="hint">Foto JPG/PNG atau PDF, maksimal 3 MB.</p></div><div class="field"><label class="label">Publikasi</label><select name="status"><option value="DRAFT">Draft / untuk internal</option><option value="PUBLISHED">Terlihat oleh orang tua</option></select></div></div><button type="submit" class="btn btn-primary">Simpan catatan</button></form></div>`;
  html+=`<div class="card section-gap"><div class="panel-title">Riwayat catatan</div><div class="stack">${x.behaviors.map(b=>`<div class="item"><div class="item-head"><span class="pill ${b.kind==='POSITIF'?'green':'yellow'}">${b.kind==='POSITIF'?'Apresiasi':'Perlu pembinaan'}</span><span class="small muted">${E(b.createdAt.slice(0,10))}</span></div><h3 style="margin-top:9px">${E(parent?(x.currentChild?.name||'Anak Anda'):studentName(b.studentId))}</h3><p>${E(b.description)}</p>${b.followUp?`<p class="small section-gap"><b>Tindak lanjut:</b> ${E(b.followUp)}</p>`:''}<div class="actions">${b.status==='DRAFT'?'<span class="pill yellow">Draft / internal</span>':''}${can&&b.status==='DRAFT'&&(role('ADMIN')||b.authorId===S.user.id||role('GURU_KELAS'))?`<button class="btn btn-sm btn-primary" data-action="publish-behavior" data-id="${E(b.id)}">Publikasikan ke orang tua</button>`:''}${b.fileName?`<button class="btn btn-sm btn-outline" data-action="view-file" data-id="${E(b.id)}">📎 Lihat ${E(b.fileName)}</button>`:''}${can&&(role('ADMIN','GURU_KELAS')||b.authorId===S.user.id)?`<button class="btn btn-sm" data-action="archive-behavior" data-id="${E(b.id)}">Hapus catatan</button>`:''}</div></div>`).join('')||empty('Belum ada catatan perilaku.')}</div></div>`;
  setContent(html);
}

function parseImportStudents(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n').filter(x=>x.trim());
  if(!lines.length)throw new Error('Pilih file CSV atau tempel daftar siswa dahulu.');
  const delimiter=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
  const rows=lines.map(line=>{
    const cells=[];let v='',quoted=false;
    for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){cells.push(v.trim());v='';}else v+=c;}
    cells.push(v.trim());return cells;
  });
  if(/^nis$/i.test(rows[0][0].trim()))rows.shift();
  if(!rows.length)throw new Error('File tidak berisi siswa.');
  if(rows.some(x=>x.length!==2||!x[0]||!x[1]))throw new Error('Setiap baris wajib memiliki dua kolom: NIS dan Nama Siswa.');
  if(rows.length>100)throw new Error('Maksimal 100 siswa sekali impor. Pecah file menjadi beberapa bagian.');
  return rows.map(x=>({nis:x[0],name:x[1]}));
}
async function importStudentBatch(){
  const out=$('#import-result'),file=$('#import-csv-file')?.files?.[0];
  try{
    const raw=file?await file.text():$('#import-students-text').value;
    const rows=parseImportStudents(raw);
    if(!await sipConfirm('Impor '+rows.length+' siswa ke kelas '+className(S.classId)+(role('ADMIN')?' sekaligus membuat akun orang tua untuk NIS baru?':' tanpa membuat akun orang tua?'),{title:'Konfirmasi impor siswa',confirmText:'Ya, impor siswa'}))return;
    if(out)out.textContent='Menyimpan '+rows.length+' baris, mohon tunggu...';
    const r=await call('importStudentsParents',{classId:S.classId,rows});
    if(out)out.textContent='Berhasil: '+r.created+' siswa baru; '+(r.createdParents||0)+' akun orang tua dibuat'+(r.existingCompleted?' (termasuk '+r.existingCompleted+' untuk siswa yang sudah ada)':'')+'. Dilewati: '+r.skipped+'. '+(r.password?'Password awal: '+r.password+'. ':'')+(r.duplicates||[]).map(x=>x.nis+' ('+x.reason+')').join('; ');
    S.needsHome=true;FAMILY.list=[];forgetMenuCache('parents');
    await loadHome();
    toast('Impor selesai: '+r.created+' siswa baru'+(r.createdParents?' dan '+r.createdParents+' akun orang tua dibuat':'')+'.');
  }catch(e){if(out)out.textContent='Impor gagal: '+e.message;toast(e.message,true);}
}
function downloadImportTemplate(){
  const text='NIS,Nama Siswa\n10201,Ahmad Fauzan\n10202,Aisyah Zahra\n';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));a.download='template_import_sipandai.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* SIPANDAI v4.4 — tab terpisah dan filter daftar siswa */
const STUDENT_UI={tab:'list',query:'',page:1,pageSize:12};
function studentTabs(){return `<nav class="module-tabs" aria-label="Pengelolaan siswa">${[['list','Daftar Siswa'],['create','Tambah / Edit Siswa'],['import','Impor Siswa']].map(([id,label])=>`<button type="button" class="module-tab ${STUDENT_UI.tab===id?'active':''}" data-action="student-tab" data-tab="${id}">${E(label)}</button>`).join('')}</nav>`;}
function sipExitReason(st){
 return new Promise(resolve=>{const div=document.createElement('div');div.className='sip-notice-backdrop';div.innerHTML=`<section class="sip-notice-dialog" role="dialog" aria-modal="true"><div class="sip-notice-dialog-head"><div><small class="muted">Data lama tetap tersimpan</small><h2>Mutasi keluar: ${E(st.name)}</h2></div></div><div class="sip-notice-dialog-content"><p>Keanggotaan siswa akan dinonaktifkan. Nilai, absensi, dan hafalan tidak dihapus.</p><div class="field section-gap"><label class="label">Alasan keluar</label><select id="sip-exit-reason"><option>Mutasi ke sekolah lain</option><option>Berhenti sekolah</option><option>Pindah domisili</option><option>Lainnya</option></select></div><div class="field"><label class="label">Keterangan tambahan (opsional)</label><input id="sip-exit-detail" maxlength="180" placeholder="Contoh: per tanggal 16 Oktober"></div></div><div class="sip-notice-dialog-foot"><button class="btn btn-outline sip-exit-cancel">Batal</button><button class="btn btn-danger sip-exit-confirm">Mutasi keluar</button></div></section>`;document.body.appendChild(div);const done=v=>{div.remove();resolve(v)};div.querySelector('.sip-exit-cancel').onclick=()=>done(null);div.querySelector('.sip-exit-confirm').onclick=()=>done((div.querySelector('#sip-exit-reason').value+' — '+div.querySelector('#sip-exit-detail').value).slice(0,300));});
}
function sipChooseClassForTransfer(st,classes){
 return new Promise(resolve=>{const div=document.createElement('div');div.className='sip-notice-backdrop';div.innerHTML=`<section class="sip-notice-dialog" role="dialog" aria-modal="true"><h2>Pindah kelas: ${E(st.name)}</h2><p class="hint">NIS dan data historis tetap.</p><div class="field section-gap"><label class="label">Kelas tujuan</label><select id="sip-transfer-class">${classes.map(c=>`<option value="${E(c.id)}">${E(c.name)}</option>`).join('')}</select></div><div class="actions"><button class="btn btn-outline sip-cancel-transfer">Batal</button><button class="btn btn-primary sip-ok-transfer">Pindahkan</button></div></section>`;document.body.appendChild(div);const finish=v=>{div.remove();resolve(v);};div.querySelector('.sip-cancel-transfer').addEventListener('click',()=>finish(null));div.querySelector('.sip-ok-transfer').addEventListener('click',()=>finish(div.querySelector('#sip-transfer-class').value));});
}
function renderStudents(){
  if(!role('ADMIN','GURU_KELAS'))return;
  let html=head('Siswa','Data siswa kelas '+className(S.classId)+'.')+studentTabs()+'<div id="student-panel"></div>';
  setContent(html);paintStudentPanel();
}
function paintStudentPanel(){
  const panel=$('#student-panel');if(!panel)return;
  const isAdmin=role('ADMIN'),students=S.home?.students||[];
  if(STUDENT_UI.tab==='create'){
    panel.innerHTML=`<div class="card"><div class="panel-title" id="student-title">Tambah siswa</div><form id="student-form"><input type="hidden" name="id" value=""><div class="form-grid"><div class="field"><label class="label">NIS</label><input name="nis" required maxlength="35" placeholder="Nomor induk siswa"></div><div class="field"><label class="label">Nama lengkap</label><input name="name" required maxlength="140" placeholder="Nama siswa"></div></div><div class="actions"><button class="btn btn-primary" type="submit">Simpan siswa</button><button type="button" class="btn" data-action="student-new">Kosongkan</button></div><p class="hint">Siswa baru otomatis dibuatkan akun Orang Tua/Wali dengan username NIS dan password sementara. Nomor NIS terkunci setelah disimpan.</p></form><div id="credential-box"></div></div>`;
  }else if(STUDENT_UI.tab==='import'){
    panel.innerHTML=`<div class="card"><div class="panel-title">Impor Siswa & Akun Orang Tua</div><p class="hint">CSV dua kolom: NIS,Nama Siswa (maksimal 100 siswa). Akun orang tua dibuat otomatis, termasuk melengkapi akun siswa yang sudah ada dan belum mempunyai akun wali.</p><div class="field"><label class="label">Unggah CSV (opsional)</label><input type="file" id="import-csv-file" accept=".csv,text/csv,text/plain"></div><div class="field"><label class="label">Atau tempel dari Excel / Google Sheets</label><textarea id="import-students-text" rows="5" placeholder="NIS,Nama Siswa&#10;10201,Ahmad Fauzan&#10;10202,Aisyah Zahra"></textarea></div><div class="actions"><button class="btn" type="button" data-action="import-template">Unduh contoh CSV</button><button class="btn btn-primary" type="button" data-action="import-students">Impor siswa & akun</button></div><div id="import-result" class="hint" aria-live="polite"></div></div>`;
  }else{
    panel.innerHTML=`<div class="card"><div class="row-between wrap"><div class="panel-title">Daftar siswa <span class="pill">${students.length}</span></div><button type="button" class="btn btn-sm btn-primary" data-action="student-add">+ Tambah siswa</button></div><div class="field list-search"><label class="label" for="student-search">Cari nama siswa atau NIS</label><input id="student-search" type="search" autocomplete="off" placeholder="Ketik nama / NIS..." value="${E(STUDENT_UI.query)}"></div><div id="student-list-results"></div></div>`;
    paintStudentList();
  }
}
function paintStudentList(){
  const host=$('#student-list-results');if(!host)return;
  const query=String(STUDENT_UI.query).toLocaleLowerCase('id').trim();
  const rows=(S.home?.students||[]).filter(x=>!query||[x.name,x.nis].some(v=>String(v||'').toLocaleLowerCase('id').includes(query)));
  const pages=Math.max(1,Math.ceil(rows.length/STUDENT_UI.pageSize));STUDENT_UI.page=Math.min(pages,Math.max(1,STUDENT_UI.page));
  const start=(STUDENT_UI.page-1)*STUDENT_UI.pageSize;
  host.innerHTML=`<p class="small muted">${rows.length} siswa ditemukan</p><div class="list-card-grid">${rows.slice(start,start+STUDENT_UI.pageSize).map(x=>`<div class="item"><b>${E(x.name)}</b><div class="small muted">NIS ${E(x.nis)}</div><div class="actions"><button type="button" class="btn btn-sm btn-outline" data-action="edit-student" data-id="${E(x.id)}">Edit nama</button><button type="button" class="btn btn-sm btn-outline" data-action="student-exit" data-id="${E(x.id)}">Mutasi keluar</button>${role('ADMIN')?`<button type="button" class="btn btn-sm btn-outline" data-action="student-transfer" data-id="${E(x.id)}">Pindah kelas</button>`:''}</div></div>`).join('')||empty('Tidak ada siswa yang cocok.')}</div>${pages>1?`<div class="list-pagination"><button type="button" class="btn btn-sm" data-action="student-page" data-page="${STUDENT_UI.page-1}" ${STUDENT_UI.page===1?'disabled':''}>Sebelumnya</button><span class="small muted">Halaman ${STUDENT_UI.page} / ${pages}</span><button type="button" class="btn btn-sm" data-action="student-page" data-page="${STUDENT_UI.page+1}" ${STUDENT_UI.page===pages?'disabled':''}>Berikutnya</button></div>`:''}`;
}
function editStudentForm(id){
  const student=(S.home?.students||[]).find(x=>x.id===id);if(!student)return;
  STUDENT_UI.tab='create';renderStudents();const f=$('#student-form');if(!f)return;
  f.elements.namedItem('id').value=student.id;f.elements.namedItem('nis').value=student.nis;f.elements.namedItem('nis').readOnly=true;f.elements.namedItem('nis').title='NIS tidak boleh diubah';f.elements.namedItem('name').value=student.name;
  $('#student-title').textContent='Edit siswa: '+student.name;
  $('#student-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function resetStudentForm(){const f=$('#student-form');if(!f)return;f.reset();f.elements.namedItem('nis').readOnly=false;f.elements.namedItem('nis').removeAttribute('title');f.elements.namedItem('id').value='';$('#student-title').textContent='Tambah siswa';}

/* Satu tombol simpan seluruh mapel per kelas. */
async function renderTeachers(){
 if(!role('ADMIN','GURU_KELAS'))return;
 const staff=(S.home.staff||[]).filter(x=>x.active==='YES');
 const c=S.home.classes.find(x=>x.id===S.classId),owner=staff.find(t=>t.id===c?.teacherId)||{};
 let html=head('Guru Mapel','Atur pengampu seluruh mapel dalam satu formulir.');
 if(!c){setContent(html+empty('Pilih kelas untuk diatur.'));return;}
 const teachers=staff.filter(t=>t.role==='GURU_MAPEL'),assigned=S.home.classSubjects||[];
 html+=`<div class="card"><div class="row-between wrap"><div><b>${E(c.name)}</b><div class="small muted">Guru Kelas: ${E(owner.name||'Belum ada')}</div></div><span class="pill">${assigned.length} mapel</span></div><form id="subject-owners-form" class="section-gap"><div class="subject-map-grid">${assigned.map(sub=>`<div class="subject-map-item"><label class="label" for="mapel-${E(sub.id)}">${E(sub.name)}</label><select id="mapel-${E(sub.id)}" class="subject-owner-choice" data-mapel-id="${E(sub.id)}"><option value="" ${sub.teacherId===c.teacherId?'selected':''}>Guru Kelas — ${E(owner.name||'Pemilik kelas')}</option>${teachers.map(t=>`<option value="${E(t.id)}" ${sub.teacherId===t.id?'selected':''}>${E(t.name)}</option>`).join('')}</select></div>`).join('')}</div><div class="subject-map-footer"><span class="small muted" id="subject-owner-status">Perubahan belum disimpan.</span><button type="submit" class="btn btn-primary">Simpan Semua Pengampu</button></div></form></div>`;
 if(!teachers.length)html+=`<div class="notice warning section-gap">Belum ada Guru Mapel aktif. Tambahkan melalui menu Akun Guru.</div>`;
 setContent(html);
}
/* SIPANDAI v4.1 — manajemen keluarga khusus Admin; pencarian/filter/paginasi dilakukan
 * langsung di browser setelah satu kali pemuatan daftar. Tidak ada request setiap tombol diketik. */
const FAMILY={tab:'list',list:[],students:null,requests:null,classFilter:'',query:'',page:1,pageSize:12,parentQuery:'',linkClassId:'',selectedParentId:''};
const familyWords=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('id').trim();
function familyClassOptions(value,withAll=false){
 const cs=S.home?.classes||[];
 return (withAll?'<option value="">Semua kelas</option>':'<option value="">Pilih kelas</option>')+cs.map(c=>`<option value="${E(c.id)}" ${c.id===value?'selected':''}>${E(c.name)}</option>`).join('');
}
function familyTabNav(){return `<div class="module-tabs" role="tablist" aria-label="Kelola keluarga">${[['list','Daftar Orang Tua'],['link','Hubungkan Anak'],['requests','Verifikasi Relasi']].map(([id,name])=>`<button type="button" role="tab" class="module-tab ${FAMILY.tab===id?'active':''}" aria-selected="${FAMILY.tab===id}" data-action="family-tab" data-tab="${id}">${E(name)}</button>`).join('')}</div>`;}
async function renderParents(){
 if(role('ORANG_TUA')){
   setContent(head('Akun keluarga','Lihat anak terhubung dan ajukan penghubungan kepada Admin.')+`<div class="card"><div class="panel-title">Putra-putri terhubung</div>${S.home.children.length?childCards():empty('Belum ada anak terhubung.')}</div><div class="card section-gap"><div class="panel-title">Ajukan penambahan anak</div><p class="hint">Masukkan NIS anak lain. <b>Hanya Admin</b> yang boleh memeriksa dan menyetujui hubungan keluarga.</p><form id="request-link-form"><div class="field"><label class="label">NIS anak</label><input name="nis" required maxlength="35" placeholder="NIS anak lainnya"></div><button class="btn btn-primary" type="submit">Kirim pengajuan kepada Admin</button></form></div>`);return;
 }
 if(!role('ADMIN'))return;
 setContent(head('Keluarga & Orang Tua','Pencarian cepat, reset akun, dan verifikasi hubungan keluarga oleh Admin.')+familyTabNav()+'<div id="family-panel">'+loader()+'</div>');
 if(!FAMILY.list.length){
   try{FAMILY.list=await cachedCall('parents',{},60000);}catch(e){toast(e.message,true);const panel=$('#family-panel');if(panel)panel.innerHTML=empty('Tidak dapat memuat akun keluarga. '+e.message);return;}
 }
 if(S.view==='parents')paintFamilyPanel();
}
function paintFamilyPanel(){const area=$('#family-panel');if(!area||!role('ADMIN'))return;
 if(FAMILY.tab==='list')area.innerHTML=familyListShell();
 else if(FAMILY.tab==='link')area.innerHTML=familyLinkShell();
 else{area.innerHTML=loader();void loadFamilyRequests();}
 if(FAMILY.tab==='list')paintFamilyList();
 else if(FAMILY.tab==='link'){updateFamilyParentChoices();updateFamilyStudentChoices();}
}
function familyListShell(){return `<div class="card"><div class="panel-title">Daftar akun orang tua <span class="pill">${FAMILY.list.length} akun</span></div><div class="family-filters"><div class="field"><label class="label" for="family-class">Filter kelas</label><select id="family-class">${familyClassOptions(FAMILY.classFilter,true)}</select></div><div class="field"><label class="label" for="family-search">Cari nama orang tua / siswa / NIS</label><input id="family-search" type="search" autocomplete="off" value="${E(FAMILY.query)}" placeholder="Ketik nama, NIS atau username..." aria-controls="family-results"></div></div><div id="family-results" aria-live="polite"></div><div id="credential-box"></div></div>`;}
function familyMatch(row){
 const subset=FAMILY.classFilter?row.children.filter(x=>x.classId===FAMILY.classFilter):row.children;
 if(FAMILY.classFilter&&!subset.length)return false;
 if(!FAMILY.query)return true;
 const hay=familyWords([row.parentName,row.username,...subset.flatMap(x=>[x.studentName,x.nis,x.className])].join(' '));
 return hay.includes(familyWords(FAMILY.query));
}
function paintFamilyList(){
 const target=$('#family-results');if(!target)return;
 const matches=FAMILY.list.filter(familyMatch),pages=Math.max(1,Math.ceil(matches.length/FAMILY.pageSize));
 FAMILY.page=Math.min(Math.max(FAMILY.page,1),pages);
 const shown=matches.slice((FAMILY.page-1)*FAMILY.pageSize,FAMILY.page*FAMILY.pageSize);
 target.innerHTML=`<div class="family-resultbar"><span class="small muted">${matches.length} akun cocok · halaman ${FAMILY.page}/${pages}</span>${FAMILY.query?`<span class="pill green">Pencarian aktif</span>`:''}</div><div class="family-list">${shown.map(p=>{
 const children=FAMILY.classFilter?p.children.filter(x=>x.classId===FAMILY.classFilter):p.children;
 return `<div class="family-parent"><div class="family-parent-main"><div><b>${E(p.parentName)}</b><div class="small muted">Username: <code>${E(p.username)}</code></div></div><div class="family-parent-actions"><button class="btn btn-sm btn-outline" data-action="family-link-parent" data-id="${E(p.userId)}">Hubungkan Anak</button><button class="btn btn-sm btn-outline" data-action="reset-user" data-id="${E(p.userId)}">Reset Password</button></div></div><div class="family-children">${children.length?children.map(ch=>`<span class="family-child-chip">${E(ch.studentName)} · ${E(ch.className)}</span>`).join(''):'<span class="small muted">Belum memiliki anak terhubung</span>'}</div></div>`;
 }).join('')||empty('Tidak ada akun yang cocok. Ubah filter atau kata pencarian.')}</div><div class="family-pagination"><button type="button" class="btn btn-sm" data-action="family-page" data-page="${FAMILY.page-1}" ${FAMILY.page===1?'disabled':''}>← Sebelumnya</button><span class="small muted">${matches.length?'Menampilkan '+((FAMILY.page-1)*FAMILY.pageSize+1)+'–'+Math.min(FAMILY.page*FAMILY.pageSize,matches.length):'0'} dari ${matches.length}</span><button type="button" class="btn btn-sm" data-action="family-page" data-page="${FAMILY.page+1}" ${FAMILY.page===pages?'disabled':''}>Berikutnya →</button></div>`;
}
function familyLinkShell(){const cls=FAMILY.linkClassId||S.classId;FAMILY.linkClassId=cls;
 return `<div class="card"><div class="panel-title">Hubungkan anak ke akun orang tua</div><p class="hint">Hanya Admin yang dapat menyimpan hubungan keluarga. Pastikan identitas dan hubungan wali sudah diverifikasi.</p><form id="link-parent-form"><div class="family-filters"><div class="field"><label class="label" for="family-parent-query">Cari akun orang tua</label><input id="family-parent-query" type="search" autocomplete="off" placeholder="Nama / username orang tua" value="${E(FAMILY.parentQuery)}"></div><div class="field"><label class="label">Pilih akun orang tua</label><select id="family-parent-select" name="parentUserId" required></select></div><div class="field"><label class="label">Kelas anak</label><select id="family-link-class" required>${familyClassOptions(cls)}</select></div><div class="field"><label class="label">Pilih siswa</label><select id="family-link-student" name="studentId" required><option>Memuat siswa...</option></select></div><div class="field"><label class="label">Hubungan</label><select name="relation"><option>Ayah</option><option>Ibu</option><option>Wali</option></select></div></div><button type="submit" class="btn btn-primary">Simpan penghubungan</button></form><div id="family-link-message" class="hint section-gap" aria-live="polite"></div></div>`;
}
function updateFamilyParentChoices(){const select=$('#family-parent-select');if(!select)return;
 const list=FAMILY.list.filter(p=>familyWords(p.parentName+' '+p.username).includes(familyWords(FAMILY.parentQuery)));
 const selected=FAMILY.selectedParentId||select.value;
 select.innerHTML='<option value="">Pilih akun yang sudah ada...</option>'+list.slice(0,100).map(p=>`<option value="${E(p.userId)}" ${p.userId===selected?'selected':''}>${E(p.parentName)} (${E(p.username)})</option>`).join('');
 if(!list.some(p=>p.userId===selected))FAMILY.selectedParentId='';
}
async function updateFamilyStudentChoices(){const select=$('#family-link-student');if(!select)return;
 if(!FAMILY.students){select.innerHTML='<option value="">Memuat siswa...</option>';try{FAMILY.students=await cachedCall('familyStudents',{},60000);}catch(e){select.innerHTML='<option value="">Gagal memuat siswa</option>';toast(e.message,true);return;}}
 if(S.view!=='parents'||FAMILY.tab!=='link')return;
 const current=$('#family-link-student');if(!current)return;
 const list=FAMILY.students.filter(st=>st.classId===FAMILY.linkClassId);
 current.innerHTML=fillOptions(list.map(st=>({id:st.id,name:st.name+' — '+st.nis})),undefined,list.length?'Pilih siswa...':'Tidak ada siswa pada kelas ini');
}
async function loadFamilyRequests(force=false){const area=$('#family-panel');if(!area||FAMILY.tab!=='requests')return;
 try{if(!FAMILY.requests||force){FAMILY.requests=await cachedCall('requests',{},force?0:30000);}
 if(S.view!=='parents'||FAMILY.tab!=='requests')return;
 area.innerHTML=`<div class="card"><div class="panel-title">Permintaan menunggu verifikasi <span class="pill yellow">${FAMILY.requests.length}</span></div><p class="hint">Periksa identitas wali secara langsung sebelum menyetujui. Guru Kelas tidak dapat menyetujui relasi.</p><div class="stack">${FAMILY.requests.map(r=>`<div class="item"><b>${E(r.parentName)}</b> mengajukan anak <b>${E(r.studentName)}</b><div class="small muted">NIS: ${E(r.nis)} · ${E((r.createdAt||'').slice(0,10))}</div><div class="actions"><button type="button" class="btn btn-sm btn-primary" data-action="review-link" data-id="${E(r.id)}" data-status="APPROVED">Setujui</button><button type="button" class="btn btn-sm btn-danger" data-action="review-link" data-id="${E(r.id)}" data-status="REJECTED">Tolak</button></div></div>`).join('')||empty('Tidak ada permintaan yang menunggu.')}</div></div>`;
 }catch(e){toast(e.message,true);if(area)area.innerHTML=empty('Tidak dapat memuat permintaan.');}
}
async function reloadFamilyList(){FAMILY.list=[];forgetMenuCache('parents');const area=$('#family-panel');if(area)area.innerHTML=loader();try{FAMILY.list=await cachedCall('parents',{},0);if(S.view==='parents')paintFamilyPanel();}catch(e){toast(e.message,true);}}

/* SIPANDAI v4.4 — Pengelolaan Akun Guru & Kelas */
const USER_UI={tab:'list',query:'',page:1,pageSize:12,editingId:''};
function staffRows(){return (S.home?.staff||[]).filter(x=>['GURU_KELAS','GURU_MAPEL','KEPALA_SEKOLAH'].includes(x.role));}
function userTabs(){return `<nav class="module-tabs" aria-label="Kelola akun guru">${[['list','Daftar Akun Guru'],['create','Buat Akun Guru']].map(([id,label])=>`<button type="button" class="module-tab ${USER_UI.tab===id?'active':''}" data-action="user-tab" data-tab="${id}">${E(label)}</button>`).join('')}</nav>`;}
async function renderUsers(){if(!role('ADMIN'))return;setContent(head('Akun Guru','Kelola nama, role, dan password akun sekolah.')+userTabs()+'<div id="user-panel"></div>');paintUserPanel();}
function paintUserPanel(){
 const host=$('#user-panel');if(!host)return;
 if(USER_UI.tab==='create')host.innerHTML=`<div class="card"><div class="panel-title">Buat Akun Guru</div><form id="user-form"><div class="form-grid"><div class="field"><label class="label">Nama guru / pegawai</label><input name="fullName" required maxlength="120"></div><div class="field"><label class="label">Username</label><input name="username" required minlength="3" maxlength="90" pattern="(?:[A-Za-z0-9._]|-){3,90}" placeholder="Contoh: guru.nur"></div><div class="field"><label class="label">Role</label><select name="role"><option value="GURU_KELAS">Guru Kelas</option><option value="GURU_MAPEL">Guru Mapel</option><option value="KEPALA_SEKOLAH">Kepala Sekolah</option></select></div></div><div class="actions"><button class="btn btn-primary" type="submit">Buat Akun Guru</button></div></form><div id="credential-box"></div></div>`;
 else host.innerHTML=`<div class="card"><div class="row-between wrap"><div class="panel-title">Daftar Akun Guru <span class="pill">${staffRows().length}</span></div><button class="btn btn-sm btn-primary" type="button" data-action="user-tab" data-tab="create">+ Akun Guru</button></div><div class="field list-search"><label class="label" for="user-search">Cari nama, username, atau role</label><input type="search" id="user-search" autocomplete="off" value="${E(USER_UI.query)}" placeholder="Ketik nama guru..."></div><div id="user-edit-slot"></div><div id="user-list-results"></div><div id="credential-box"></div></div>`;
 if(USER_UI.tab==='list'){paintUserList();if(USER_UI.editingId)paintUserEdit();}
}
function paintUserList(){
 const host=$('#user-list-results');if(!host)return;
 const q=USER_UI.query.trim().toLocaleLowerCase('id');
 const all=staffRows().filter(x=>!q||[x.fullName,x.username,x.role].some(t=>String(t||'').toLocaleLowerCase('id').includes(q)));
 const pages=Math.max(1,Math.ceil(all.length/USER_UI.pageSize));USER_UI.page=Math.min(pages,Math.max(1,USER_UI.page));const begin=(USER_UI.page-1)*USER_UI.pageSize;
 host.innerHTML=`<p class="small muted">${all.length} akun ditemukan</p><div class="list-card-grid">${all.slice(begin,begin+USER_UI.pageSize).map(x=>`<div class="item"><div class="item-head"><b>${E(x.fullName)}</b><span class="pill">${E(x.role.replaceAll('_',' '))}</span></div><div class="small muted">${E(x.username)} · ${x.active==='YES'?'Aktif':'Nonaktif'}</div><div class="actions"><button class="btn btn-sm btn-outline" data-action="edit-user" data-id="${E(x.id)}">Edit akun</button><button class="btn btn-sm" data-action="reset-user" data-id="${E(x.id)}">Reset password</button></div></div>`).join('')||empty('Tidak ada akun guru yang cocok.')}</div>${pages>1?`<div class="list-pagination"><button class="btn btn-sm" type="button" data-action="user-page" data-page="${USER_UI.page-1}" ${USER_UI.page===1?'disabled':''}>Sebelumnya</button><span class="small muted">Halaman ${USER_UI.page}/${pages}</span><button class="btn btn-sm" type="button" data-action="user-page" data-page="${USER_UI.page+1}" ${USER_UI.page===pages?'disabled':''}>Berikutnya</button></div>`:''}`;
}
function paintUserEdit(){
 const slot=$('#user-edit-slot');if(!slot)return;
 const target=staffRows().find(x=>x.id===USER_UI.editingId);
 if(!target){slot.innerHTML='';return;}
 slot.innerHTML=`<div class="user-edit-panel"><div class="panel-title">Edit Akun Guru</div><form id="user-edit-form"><input type="hidden" name="userId" value="${E(target.id)}"><div class="form-grid"><div class="field"><label class="label">Nama lengkap</label><input name="fullName" maxlength="120" required value="${E(target.fullName)}"></div><div class="field"><label class="label">Username</label><input name="username" minlength="3" maxlength="90" required pattern="(?:[A-Za-z0-9._]|-){3,90}" value="${E(target.username)}"></div><div class="field"><label class="label">Role</label><select name="role">${[['GURU_KELAS','Guru Kelas'],['GURU_MAPEL','Guru Mapel'],['KEPALA_SEKOLAH','Kepala Sekolah']].map(([id,name])=>`<option value="${id}" ${target.role===id?'selected':''}>${name}</option>`).join('')}</select></div></div><p class="hint">Perubahan nama/username/role mengakhiri sesi akun tersebut. Jika guru masih menjadi pemilik kelas atau pengampu, pindahkan penugasannya dahulu sebelum mengubah role.</p><div class="actions"><button class="btn btn-primary" type="submit">Simpan Perubahan</button><button class="btn" type="button" data-action="cancel-edit-user">Batal</button></div></form></div>`;
 slot.scrollIntoView({behavior:'smooth',block:'nearest'});
}
const SUBJECT_ADMIN={items:[],query:'',editingId:'',request:0};
async function renderClasses(){
 if(!role('ADMIN'))return;
 const teachers=(S.home.staff||[]).filter(x=>x.role==='GURU_KELAS'&&x.active==='YES');
 const opts=(selected='')=>teachers.map(x=>`<option value="${E(x.id)}" ${x.id===selected?'selected':''}>${E(x.fullName)}</option>`).join('');
 let html=head('Kelas & Mapel','Kelola kelas, guru pemilik, dan daftar mata pelajaran.')+`<div class="grid grid2"><div class="card"><div class="panel-title" id="class-title">Tambah kelas</div><form id="class-form"><input type="hidden" name="id" value=""><div class="field"><label class="label">Nama kelas</label><input name="name" maxlength="70" required placeholder="Contoh: 5A"></div><div class="field"><label class="label">Guru Kelas pemilik</label><select name="teacherId" required>${opts()}</select></div><div class="actions"><button class="btn btn-primary" id="class-submit" type="submit">Tambah kelas</button><button class="btn" type="button" data-action="class-new">Batal edit</button></div></form></div><div class="card"><div class="panel-title" id="subject-form-title">Tambah mata pelajaran</div><form id="subject-form"><input type="hidden" name="id" value=""><div class="field"><label class="label">Nama mata pelajaran</label><input name="name" required maxlength="110" placeholder="Contoh: Bahasa Sunda"></div><div class="actions"><button id="subject-submit" class="btn btn-primary" type="submit">Tambah Mapel</button><button type="button" class="btn" data-action="subject-new">Batal edit</button></div></form><p class="hint">Perbaikan nama tidak mengubah ID mapel atau data nilai yang sudah tersimpan.</p></div></div>`;
 html+=`<div class="card section-gap"><div class="row-between"><div class="panel-title">Daftar Mata Pelajaran <span class="pill" id="subject-count">—</span></div><button type="button" class="btn btn-sm" data-action="subject-refresh">↻ Perbarui</button></div><div class="field" style="margin:12px 0"><label class="label" for="subject-search">Cari mata pelajaran</label><input type="search" id="subject-search" placeholder="Ketik nama mapel…" value="${E(SUBJECT_ADMIN.query)}" autocomplete="off"></div><div id="subject-list-host" aria-live="polite">${loader()}</div></div>`;
 html+=`<div class="card section-gap"><div class="panel-title">Daftar kelas <span class="pill">${S.home.classes.length}</span></div><div class="list-card-grid">${S.home.classes.map(c=>`<div class="item"><div class="item-head"><b>${E(c.name)}</b><span class="pill green">Aktif</span></div><p class="small muted">Guru Kelas: ${E(teachers.find(x=>x.id===c.teacherId)?.fullName||'Belum ditentukan')}</p><div class="actions"><button type="button" class="btn btn-sm btn-outline" data-action="edit-class" data-id="${E(c.id)}">Edit kelas & pemilik</button></div></div>`).join('')||empty('Belum ada kelas.')}</div></div>`;
 setContent(html);
 const request=++SUBJECT_ADMIN.request;
 try{
   const items=await cachedCall('subjectList',{},90000);
   if(request!==SUBJECT_ADMIN.request||S.view!=='classes')return;
   SUBJECT_ADMIN.items=items||[];paintSubjectList();
 }catch(err){const el=$('#subject-list-host');if(el&&S.view==='classes')el.innerHTML='<div class="notice warning">Gagal memuat mapel: '+E(err.message)+'</div>';}
}
function paintSubjectList(){
 const host=$('#subject-list-host');if(!host)return;
 const q=SUBJECT_ADMIN.query.trim().toLocaleLowerCase('id');
 const rows=SUBJECT_ADMIN.items.filter(x=>!q||x.name.toLocaleLowerCase('id').includes(q));
 const count=$('#subject-count');if(count)count.textContent=SUBJECT_ADMIN.items.length;
 host.innerHTML=`<div class="small muted">${rows.length} dari ${SUBJECT_ADMIN.items.length} mapel</div><div class="list-card-grid subject-list-grid">${rows.map(x=>`<div class="item subject-list-item"><b>${E(x.name)}</b><button type="button" class="btn btn-sm btn-outline" data-action="edit-subject" data-id="${E(x.id)}" aria-label="Edit mata pelajaran ${E(x.name)}">✎ Edit</button></div>`).join('')||empty('Tidak ada mapel yang cocok.')}</div>`;
}
function editSubjectForm(id){
 const item=SUBJECT_ADMIN.items.find(x=>x.id===id),f=$('#subject-form');if(!item||!f)return;
 f.elements.namedItem('id').value=item.id;f.elements.namedItem('name').value=item.name;
 SUBJECT_ADMIN.editingId=id;$('#subject-form-title').textContent='Edit mata pelajaran';$('#subject-submit').textContent='Simpan Perubahan';
 f.scrollIntoView({behavior:'smooth',block:'center'});f.elements.namedItem('name').focus({preventScroll:true});
}
function resetSubjectForm(){
 const f=$('#subject-form');if(!f)return;
 f.reset();f.elements.namedItem('id').value='';SUBJECT_ADMIN.editingId='';
 $('#subject-form-title').textContent='Tambah mata pelajaran';$('#subject-submit').textContent='Tambah Mapel';
}

function editClassForm(id){
 const c=(S.home.classes||[]).find(x=>x.id===id),f=$('#class-form');if(!c||!f)return;
 f.elements.namedItem('id').value=c.id;f.elements.namedItem('name').value=c.name;f.elements.namedItem('teacherId').value=c.teacherId;
 $('#class-title').textContent='Edit kelas '+c.name;$('#class-submit').textContent='Simpan Perubahan';
 f.scrollIntoView({behavior:'smooth',block:'center'});
}
function resetClassForm(){const f=$('#class-form');if(!f)return;f.reset();f.elements.namedItem('id').value='';$('#class-title').textContent='Tambah kelas';$('#class-submit').textContent='Tambah kelas';}

function renderSettings(){setContent(head('Pengaturan akun','Keamanan dan pemasangan aplikasi.')+`<div class="card" style="max-width:550px"><div class="panel-title">Pasang SIPANDAI di ponsel</div><p class="small muted">Buka SIPANDAI langsung dari layar utama seperti aplikasi. Koneksi internet tetap diperlukan untuk login dan menyimpan data.</p><div id="pwa-install-status" class="small muted">${window.matchMedia?.('(display-mode: standalone)').matches?'Aplikasi sudah terpasang.':'Gunakan tombol Pasang jika tersedia, atau menu browser → Tambahkan ke layar utama.'}</div><div class="actions section-gap"><button type="button" class="btn btn-primary" data-action="pwa-install">Pasang aplikasi</button></div><p class="hint">Pada iPhone/iPad, buka melalui Safari → Bagikan → Tambah ke Layar Utama.</p></div><div class="card section-gap" style="max-width:550px"><div class="panel-title">Keamanan akun</div><div class="notice">Username: <b>${E(S.user.username)}</b>. Sesi akan berakhir setelah password berhasil diganti.</div><div class="section-gap">${changePasswordForm()}</div></div>`);}
let pwaInstallEvent=null;
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();pwaInstallEvent=ev;});
window.addEventListener('appinstalled',()=>{pwaInstallEvent=null;toast('SIPANDAI berhasil dipasang di perangkat.');});
function installPWA(){
  if(window.matchMedia?.('(display-mode: standalone)').matches){toast('SIPANDAI sudah berjalan sebagai aplikasi.');return;}
  if(pwaInstallEvent){const ev=pwaInstallEvent;pwaInstallEvent=null;ev.prompt();ev.userChoice?.then(result=>{if(result?.outcome!=='accepted')toast('Anda dapat memasang SIPANDAI nanti melalui menu browser.');});return;}
  void sipAlert('Android Chrome: buka menu ⋮ lalu pilih “Instal aplikasi” atau “Tambahkan ke layar utama”. iPhone Safari: Bagikan → Tambah ke Layar Utama.',{title:'Pasang SIPANDAI'});
}
if('serviceWorker' in navigator && window.isSecureContext){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('PWA belum tersedia:',e.message)));
}

async function readFile(file){if(!file)return null;if(file.size>3*1024*1024)throw new Error('File melebihi 3 MB.');const allowed=['image/jpeg','image/png','application/pdf'];if(!allowed.includes(file.type))throw new Error('File harus JPG, PNG, atau PDF.');const data=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file);});return{name:file.name,mime:file.type,data};}
async function openBehaviorFile(id){try{toast('Menyiapkan dokumen...');const d=await call('getBehaviorFile',{behaviorId:id});const binary=atob(d.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const obj=URL.createObjectURL(new Blob([bytes],{type:d.mime}));const a=document.createElement('a');a.href=obj;a.download=d.name||'dokumen';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(obj),20000);}catch(e){toast(e.message,true);}}
// Semua tombol dan formulir menggunakan delegasi event supaya render ulang tetap konsisten.
/* ====================== UI SIPANDAI TAHAP 2 ====================== */
S.v2={editAssessmentRequest:0,journal:[],assessments:[],tasks:[],assessmentId:'',taskId:'',taskStudentId:'',fetchNo:0,detailRequest:0,journalKey:null,assessmentKey:null,taskKey:null};
const ASSESS_UI={tab:'list',query:'',subject:'ALL',type:'ALL',status:'ALL',page:1,pageSize:8};
S.progress={studentId:'',lastKey:'',report:null,requestId:0};
const PARENT_GRADE_UI={report:null,key:'',period:'ALL',requestId:0};
const isStaff=()=>role('ADMIN','KEPALA_SEKOLAH','GURU_KELAS','GURU_MAPEL');
const canRecord=()=>role('ADMIN','GURU_KELAS','GURU_MAPEL');
const canEditMapelUI=(id)=>role('ADMIN')||(S.home?.subjects||[]).some(s=>s.id===id);
const getSubjectName=(id)=>(S.home?.classSubjects||S.home?.subjects||[]).find(x=>x.id===id)?.name||'Mata pelajaran';
const subjectOptions=()=>fillOptions(S.home?.subjects||[],'','Pilih mata pelajaran');
const ownSubjectsHint=()=>!S.home?.subjects?.length?'<div class="notice warning section-gap">Belum ada mata pelajaran yang boleh Anda kelola. Minta Guru Kelas menetapkan pengampu melalui menu Guru Mapel.</div>':'';
const niceDate=(s)=>String(s||'').slice(0,16).replace('T',' ');
const statusText=(s)=>({DRAFT:'Draft',PUBLISHED:'Dipublikasikan',CLOSED:'Ditutup',RENCANA:'Rencana',TERLAKSANA:'Terlaksana',BELUM:'Belum dikumpulkan',SUBMITTED:'Sudah dikumpulkan',NEEDS_REVISION:'Perlu perbaikan',DONE:'Selesai'}[s]||s||'–');
const statusPill=(s)=>`<span class="pill ${['PUBLISHED','TERLAKSANA','DONE'].includes(s)?'green':['NEEDS_REVISION','DRAFT'].includes(s)?'yellow':''}">${E(statusText(s))}</span>`;
function sectionLoading(title,text){setContent(head(title,text)+loader());}
async function v2save(action,data,{refresh=true}={}){
  if(S.busy)return null;
  const submit=document.activeElement,form=submit?.closest?.('form'),label=document.activeElement?.textContent;
  try{
    if(['saveJournal','saveAssessment','saveTask'].includes(action)&&!data.mapelId)throw new Error('Pilih mata pelajaran yang diampu akun Anda. Bila belum ada, atur pengampu melalui Guru Mapel.');
    busy(true);
    if(submit&&submit.tagName==='BUTTON'){submit.dataset.originalLabel=submit.textContent;submit.textContent='Menyimpan…';}
    const result=await call(action,data);
    if(result&&result.ok===false)throw new Error((result.error||'Penyimpanan gagal di server.')+(result.ref?' [Referensi '+result.ref+']':''));
    form?.querySelector('.save-failure')?.remove();
    forgetMenuCache('journalList','assessmentList','taskList','assessmentDetail','taskDetail','progressReport');
    if(result.item){
      const map={saveJournal:['journal','journalKey',paintJournal],saveAssessment:['assessments','assessmentKey',paintAssessments],saveTask:['tasks','taskKey',paintTasks]};
      const spec=map[action];
      if(spec){const arr=S.v2[spec[0]],pos=arr.findIndex(x=>x.id===result.item.id);
        if(pos>=0)arr[pos]=result.item;else arr.unshift(result.item);
        if(S.view===({saveJournal:'journal',saveAssessment:'assessments',saveTask:'tasks'}[action]))spec[2]();
      }
    }
    if(action==='publishAssessment'){
      const x=S.v2.assessments.find(a=>a.id===data.id);if(x)x.status=result.status;
      if(S.view==='assessments')paintAssessments();
    }
    if(action==='taskStatus'){
      const x=S.v2.tasks.find(t=>t.id===data.id);if(x)x.status=result.status;
      if(S.view==='tasks')paintTasks();
    }
    if(refresh&&['saveJournal','saveAssessment','saveTask'].includes(action)){
      const form=document.getElementById(({saveJournal:'journal-form',saveAssessment:'assessment-form',saveTask:'task-form'})[action]);
      if(form){form.reset();if(form.elements.namedItem('id'))form.elements.namedItem('id').value='';
        const subject=form.elements.namedItem('mapelId');if(subject)subject.disabled=false;}
    }
    toast('Berhasil disimpan.');
    return result;
  }catch(err){console.error('SIPANDAI gagal menyimpan '+action,err);toast(err.message||'Gagal menyimpan.',true);if(form){let note=form.querySelector('.save-failure');if(!note){note=document.createElement('p');note.className='notice warning save-failure section-gap';note.setAttribute('role','alert');form.appendChild(note);}note.textContent='Belum tersimpan: '+(err.message||'Kesalahan tidak diketahui');}return null;
  }finally{busy(false);if(submit?.dataset?.originalLabel){submit.textContent=submit.dataset.originalLabel;delete submit.dataset.originalLabel;}}
}
function v2FormClass(){if(!S.classId) return '<div class="notice">Pilih atau buat kelas terlebih dahulu.</div>';return '';}

/* ----------------------------- JURNAL -------------------------------- */
function renderJournal(){
  if(!isStaff())return;
  const cl=S.classId,scope=cl;
  let html=head('Teacher Planner & Jurnal','Rencana, pelaksanaan, dan refleksi dalam satu tempat. Formulir tetap terbuka selama data dimuat.');
  if(canRecord()&&cl)html+=`<div class="card"><div class="panel-title">Buat atau perbarui jurnal</div><form id="journal-form"><input type="hidden" name="id" value=""><div class="form-grid"><div class="field"><label class="label">Tanggal</label><input name="date" type="date" required value="${E(S.home.serverDate)}"></div><div class="field"><label class="label">Mata pelajaran</label><select name="mapelId" required>${subjectOptions()}</select></div><div class="field wide"><label class="label">Rencana / tujuan pembelajaran</label><textarea name="plan" required maxlength="1800" placeholder="Apa yang akan dipelajari hari ini?"></textarea></div><div class="field wide"><label class="label">Kegiatan yang terlaksana</label><textarea name="activity" maxlength="2500" placeholder="Kegiatan, metode, dan hal penting selama pelajaran..."></textarea></div><div class="field wide"><label class="label">Refleksi / tindak lanjut</label><textarea name="reflection" maxlength="1800" placeholder="Apa yang berjalan baik dan perlu diperbaiki?"></textarea></div><div class="field"><label class="label">Status jurnal</label><select name="status"><option value="RENCANA">Masih rencana</option><option value="TERLAKSANA">Sudah terlaksana</option></select></div></div>${ownSubjectsHint()}<div class="actions"><button type="submit" class="btn btn-primary" ${!S.home.subjects.length?'disabled':''}>Simpan jurnal</button><button type="button" class="btn" data-action="clear-journal">Jurnal baru</button></div></form></div>`;
  if(!cl&&role('GURU_MAPEL'))html+='<div class="notice warning">Belum ada kelas yang ditugaskan. Hubungi Guru Kelas untuk pemetaan mapel.</div>';
  html+='<div id="journal-list" class="section-gap"><div class="notice">Menyiapkan riwayat jurnal…</div></div>';
  setContent(html);
  if(S.v2.journalKey===scope)paintJournal();
  if(cl){const no=++S.v2.fetchNo;
    cachedCall('journalList',{classId:cl},40000).then(list=>{
      if(S.view!=='journal'||cl!==S.classId||no!==S.v2.fetchNo)return;
      S.v2.journalKey=scope;S.v2.journal=list;paintJournal();
    }).catch(err=>{const el=$('#journal-list');if(el)el.innerHTML='<div class="notice">'+E(err.message)+'</div>';});
  }else{S.v2.journal=[];paintJournal();}
}
function paintJournal(){
  const el=$('#journal-list');if(!el)return;
  const list=S.v2.journal;
  el.innerHTML=`<div class="card section-gap"><div class="panel-title">Riwayat jurnal <span class="pill">${list.length}</span></div><div class="stack">${list.map(j=>`<div class="item"><div class="row-between"><b>${E(j.date)} · ${E(getSubjectName(j.mapelId))}</b>${statusPill(j.status)}</div><p class="section-gap">${E(j.plan)}</p>${j.activity?`<p class="small muted">Pelaksanaan: ${E(j.activity.slice(0,400))}</p>`:''}${j.reflection?`<p class="small muted">Refleksi: ${E(j.reflection.slice(0,250))}</p>`:''}${canRecord()&&canEditMapelUI(j.mapelId)&&(S.user.id===j.teacherId||role('ADMIN','GURU_KELAS'))?`<div class="actions"><button class="btn btn-sm" data-action="edit-journal" data-id="${E(j.id)}">Ubah jurnal</button><button class="btn btn-sm" data-action="archive-journal" data-id="${E(j.id)}">Hapus jurnal</button></div>`:''}</div>`).join('')||empty('Belum ada jurnal pada kelas ini.')}</div></div>`;
}
function editJournal(id){const j=S.v2.journal.find(x=>x.id===id),f=$('#journal-form');if(!j||!f)return;
  ['id','date','mapelId','plan','activity','reflection','status'].forEach(k=>{if(f.elements[k])f.elements[k].value=j[k]||'';});
  f.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ----------------------------- ASESMEN ------------------------------- */
function assessmentForm(){return `<div class="card"><div class="panel-title">Buat asesmen / atur informasi</div><form id="assessment-form"><input type="hidden" name="id"><div class="form-grid"><div class="field"><label class="label">Mata pelajaran</label><select name="mapelId" required>${subjectOptions()}</select></div><div class="field"><label class="label">Tanggal</label><input type="date" name="date" value="${E(S.home.serverDate)}" required></div><div class="field"><label class="label">Jenis asesmen</label><select name="type" id="assess-type"><option value="Asesmen Harian">Asesmen Harian</option><option value="Asesmen Tengah Semester">Asesmen Tengah Semester</option><option value="Asesmen Akhir Semester">Asesmen Akhir Semester</option><option value="Asesmen Akhir Tahun">Asesmen Akhir Tahun</option><option value="LAINNYA">Nama kategori lainnya...</option></select></div><div class="field"><label class="label">Kategori tambahan (bila memilih lainnya)</label><input name="customType" maxlength="100" placeholder="Contoh: Praktik / Proyek"></div><div class="field wide"><label class="label">Nama kegiatan asesmen</label><input name="name" maxlength="140" required placeholder="Contoh: Asesmen Harian 1 — Pecahan"></div><div class="field wide"><label class="label">Tujuan pembelajaran (opsional)</label><textarea name="objective" maxlength="1600" placeholder="Tujuan yang dinilai pada asesmen ini..."></textarea></div></div>${ownSubjectsHint()}<div class="actions"><button class="btn btn-primary" type="submit" ${!S.home.subjects.length?'disabled':''}>Simpan sebagai draft</button><button type="button" class="btn" data-action="clear-assessment">Asesmen baru</button></div></form></div>`;}
function assessmentTabs(){
  if(!canRecord())return '';
  return `<nav class="module-tabs assess-inner-tabs" aria-label="Kelola asesmen"><button type="button" class="module-tab ${ASSESS_UI.tab==='list'?'active':''}" data-action="assessment-ui-tab" data-tab="list">▤ Daftar Asesmen</button><button type="button" class="module-tab ${ASSESS_UI.tab==='form'?'active':''}" data-action="assessment-ui-tab" data-tab="form">＋ Buat / Edit Asesmen</button></nav>`;
}
// SIPANDAI v4.8: tampilan wali hanya menerima data nilai TERPUBLIKASI dari progressReport.
function formatParentGrade(value){return value===null||value===undefined||value===''?'—':Number(value).toLocaleString('id-ID',{maximumFractionDigits:2});}
function parentGradeDate(s){const t=String(s||'');return /^\d{4}-\d{2}-\d{2}$/.test(t)?t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4):t;}
function renderParentGrades(){
  const key=S.classId+'|'+S.childId;
  let html=head('Nilai Pembelajaran','Nilai terpublikasi per mata pelajaran, terbaru berdasarkan tanggal pelaksanaan.');
  html+=`<div class="card parent-grade-shell"><div class="parent-grade-toolbar"><div><div class="panel-title">Hasil belajar ${E(S.home.currentChild?.name||'siswa')}</div><p class="small muted">Rata-rata hanya dari Harian & Proyek. ASTS, ASAS, dan ASAT ditampilkan terpisah.</p></div><label class="field parent-grade-period"><span class="label">Tanggal pelaksanaan</span><select id="parent-grade-period" aria-label="Periode nilai"><option value="ALL">Semua tanggal · terbaru dulu</option><option value="30">30 hari terakhir</option><option value="90">90 hari terakhir</option><option value="365">1 tahun terakhir</option></select></label></div><div id="parent-grade-results" aria-live="polite">${loader()}</div></div>`;
  setContent(html);
  const period=$('#parent-grade-period');if(period)period.value=PARENT_GRADE_UI.period;
  if(PARENT_GRADE_UI.key===key&&PARENT_GRADE_UI.report?.parentGrades){paintParentGrades(PARENT_GRADE_UI.report);return;}
  const request=++PARENT_GRADE_UI.requestId,cl=S.classId,student=S.childId;
  cachedCall('progressReport',{classId:cl,studentId:student},50000).then(r=>{
    if(S.view!=='assessments'||S.childId!==student||S.classId!==cl||request!==PARENT_GRADE_UI.requestId)return;
    PARENT_GRADE_UI.report=r;PARENT_GRADE_UI.key=key;paintParentGrades(r);
  }).catch(e=>{const el=$('#parent-grade-results');if(el&&S.view==='assessments')el.innerHTML='<div class="notice warning">Gagal memuat nilai: '+E(e.message)+'</div>';});
}
function paintParentGrades(r){
  const host=$('#parent-grade-results');if(!host)return;
  if(!r.parentGrades){host.innerHTML='<div class="notice warning">Backend perlu diperbarui ke SIPANDAI v4.8 agar rata-rata harian dan nilai ASTS/ASAS/ASAT dapat dipisahkan.</div>';return;}
  const g=r.parentGrades,days=Number(PARENT_GRADE_UI.period)||0;
  const cutoff=days?new Date(Date.now()-days*86400000).toISOString().slice(0,10):'';
  const groups=g.subjects.map(s=>{
    const list=s.assessments.filter(a=>!cutoff||a.date>=cutoff);
    const scoredDaily=list.filter(a=>(a.category==='HARIAN'||a.category==='PROYEK')&&Number.isFinite(a.score));
    const avg=scoredDaily.length?scoredDaily.reduce((n,a)=>n+a.score,0)/scoredDaily.length:null;
    return {...s,assessments:list,dailyCount:scoredDaily.length,dailyAverage:avg};
  }).filter(s=>s.assessments.length);
  const daily=groups.flatMap(x=>x.assessments).filter(a=>(a.category==='HARIAN'||a.category==='PROYEK')&&Number.isFinite(a.score));
  const overall=daily.length?daily.reduce((n,a)=>n+a.score,0)/daily.length:null;
  const overallLabel=daily.length?formatParentGrade(overall):'—';
  let html=`<div class="parent-grade-summary"><div><span class="small muted">Rata-rata Harian + Proyek</span><strong>${E(overallLabel)}</strong><span class="small muted">${daily.length} nilai yang sudah dinilai</span></div><div><span class="small muted">Asesmen terpublikasi</span><strong>${groups.reduce((n,s)=>n+s.assessments.length,0)}</strong><span class="small muted">${groups.length} mata pelajaran</span></div></div>
    <p class="parent-grade-explain">Nilai ASTS, ASAS, ASAT, dan kategori lainnya <b>tidak</b> dihitung dalam rata-rata harian. Ini bukan nilai akhir rapor.</p>`;
  html+=groups.length?groups.map((s,i)=>`<details class="parent-grade-subject" ${i<2?'open':''}><summary><div><b>${E(s.name)}</b><span class="small muted">${s.assessments.length} asesmen · ${s.dailyCount} nilai harian/proyek</span></div><div class="parent-grade-avg"><span class="small muted">Rata-rata harian</span><strong>${E(formatParentGrade(s.dailyAverage))}</strong><span class="parent-grade-chevron">⌄</span></div></summary><div class="parent-grade-detail"><div class="parent-grade-labels"><span>Asesmen · tanggal pelaksanaan</span><span>Nilai</span></div>${s.assessments.map(a=>`<div class="parent-grade-row"><div class="parent-grade-about"><b>${E(a.name)}</b><div class="parent-grade-submeta"><span>${E(parentGradeDate(a.date))}</span><span class="parent-grade-type ${['ASTS','ASAS','ASAT'].includes(a.category)?'parent-grade-exam':''}">${E(({HARIAN:'Harian',PROYEK:'Proyek',LAINNYA:a.type})[a.category]||a.category)}</span></div>${a.feedback?`<div class="parent-grade-feedback">Catatan guru: ${E(a.feedback)}</div>`:''}</div><div class="parent-grade-score ${a.score===null?'parent-grade-unscored':''}">${a.score===null?'<span class="small muted">Belum dinilai</span>':E(formatParentGrade(a.score))}</div></div>`).join('')}</div></details>`).join(''):empty('Belum ada asesmen terpublikasi pada periode yang dipilih.');
  host.innerHTML=html;
}
function renderAssessments(){
  if(role('ORANG_TUA'))return renderParentGrades();
  const cl=S.classId,child=S.childId,scope=cl+'|'+child;
  if(!canRecord())ASSESS_UI.tab='list';
  let html=head('Asesmen & Nilai',role('ORANG_TUA')?'Nilai yang telah diterbitkan guru.':'Daftar asesmen dan penilaian siswa.');
  html+=assessmentTabs();
  if(ASSESS_UI.tab==='form'&&canRecord()&&cl){
    html+=assessmentForm();
    html+='<div class="actions section-gap"><button type="button" class="btn btn-outline" data-action="assessment-ui-tab" data-tab="list">← Kembali ke daftar asesmen</button></div>';
  }else{
    if(!cl&&role('GURU_MAPEL'))html+='<div class="notice warning">Akun Guru Mapel belum mendapatkan penugasan kelas. Minta Guru Kelas menentukan pengampu.</div>';
    html+=`<section id="assessment-list" class="card assess-catalog" aria-label="Daftar asesmen">
      <div class="row-between assess-list-heading"><div><div class="panel-title">Daftar Asesmen <span class="pill" id="assessment-total">0</span></div><p class="small muted">Cari asesmen, pilih filter, lalu buka nilai siswa.</p></div><button type="button" class="btn btn-sm btn-outline" data-action="assessment-reload" title="Perbarui daftar asesmen">↻ Perbarui</button></div>
      <div class="assess-filters"><label class="field"><span class="label">Cari asesmen</span><input type="search" id="assessment-search" placeholder="Nama asesmen, mapel atau tanggal…" value="${E(ASSESS_UI.query)}" autocomplete="off"></label>
      <label class="field"><span class="label">Mata pelajaran</span><select id="assessment-filter-subject"><option value="ALL">Semua mapel</option></select></label>
      <label class="field"><span class="label">Status</span><select id="assessment-filter-status"><option value="ALL">Semua status</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Dipublikasikan</option></select></label>
      <label class="field"><span class="label">Jenis</span><select id="assessment-filter-type"><option value="ALL">Semua jenis</option></select></label></div>
      <div id="assessment-results" aria-live="polite">${loader()}</div>
    </section>`;
  }
  setContent(html);
  if(ASSESS_UI.tab==='form')return;
  if(S.v2.assessmentKey===scope){paintAssessments();}
  if(cl){const no=++S.v2.fetchNo;
    cachedCall('assessmentList',{classId:cl,studentId:role('ORANG_TUA')?child:''},40000).then(list=>{
      if(S.view!=='assessments'||S.classId!==cl||S.childId!==child||no!==S.v2.fetchNo||ASSESS_UI.tab!=='list')return;
      S.v2.assessmentKey=scope;S.v2.assessments=list;paintAssessments();
    }).catch(err=>{const el=$('#assessment-results');if(el)el.innerHTML='<div class="notice warning">'+E(err.message)+'</div>';});
  }else{S.v2.assessments=[];paintAssessments();}
}
function paintAssessments(){
  const el=$('#assessment-results');if(!el)return;
  const all=S.v2.assessments||[],query=ASSESS_UI.query.trim().toLocaleLowerCase('id-ID');
  const subject=$('#assessment-filter-subject'),type=$('#assessment-filter-type'),status=$('#assessment-filter-status');
  if(subject){subject.innerHTML='<option value="ALL">Semua mapel</option>'+[...new Set(all.map(a=>a.mapelId).filter(Boolean))].map(id=>`<option value="${E(id)}">${E(getSubjectName(id))}</option>`).join('');subject.value=ASSESS_UI.subject;if(subject.selectedIndex<0){ASSESS_UI.subject='ALL';subject.value='ALL';}}
  if(type){type.innerHTML='<option value="ALL">Semua jenis</option>'+[...new Set(all.map(a=>a.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id')).map(t=>`<option value="${E(t)}">${E(t)}</option>`).join('');type.value=ASSESS_UI.type;if(type.selectedIndex<0){ASSESS_UI.type='ALL';type.value='ALL';}}
  if(status)status.value=ASSESS_UI.status;
  const list=all.filter(a=>(ASSESS_UI.subject==='ALL'||a.mapelId===ASSESS_UI.subject)&&(ASSESS_UI.type==='ALL'||a.type===ASSESS_UI.type)&&(ASSESS_UI.status==='ALL'||a.status===ASSESS_UI.status)&&(!query||[a.name,a.type,a.date,getSubjectName(a.mapelId)].some(t=>String(t||'').toLocaleLowerCase('id-ID').includes(query))));
  const pages=Math.max(1,Math.ceil(list.length/ASSESS_UI.pageSize));ASSESS_UI.page=Math.min(Math.max(1,ASSESS_UI.page),pages);
  const shown=list.slice((ASSESS_UI.page-1)*ASSESS_UI.pageSize,ASSESS_UI.page*ASSESS_UI.pageSize);
  const total=$('#assessment-total');if(total)total.textContent=list.length+' / '+all.length;
  el.innerHTML=`<div class="assess-list-grid">${shown.map(a=>`<article class="assess-list-item"><div class="row-between assess-item-top"><div class="assess-name">${E(a.name)}</div>${statusPill(a.status)}</div><div class="assess-meta">${E(getSubjectName(a.mapelId))} · ${E(a.date)}<span class="assess-type">${E(a.type)}</span></div>
    <div class="assess-item-actions"><button class="btn btn-sm btn-primary" data-action="assessment-detail" data-id="${E(a.id)}">${role('ORANG_TUA')?'Lihat Nilai':'Nilai Siswa ↗'}</button>${canRecord()&&canEditMapelUI(a.mapelId)&&a.status==='DRAFT'?`<button class="btn btn-sm btn-outline" data-action="edit-assessment" data-id="${E(a.id)}">Edit Info</button><button class="btn btn-sm" data-action="publish-assessment" data-id="${E(a.id)}" data-publish="true">Publikasikan</button>`:''}${canRecord()&&canEditMapelUI(a.mapelId)&&a.status==='PUBLISHED'?`<button class="btn btn-sm" data-action="publish-assessment" data-id="${E(a.id)}" data-publish="false">Tarik Publikasi</button>`:''}${canRecord()&&canEditMapelUI(a.mapelId)?`<button class="btn btn-sm btn-danger" data-action="archive-assessment" data-id="${E(a.id)}">Arsip</button>`:''}</div></article>`).join('')||'<div class="empty">Tidak ditemukan asesmen yang sesuai filter.</div>'}</div><div class="assess-pagination"><span>Menampilkan ${list.length?((ASSESS_UI.page-1)*ASSESS_UI.pageSize+1):0}–${Math.min(list.length,ASSESS_UI.page*ASSESS_UI.pageSize)} dari ${list.length} asesmen</span><div class="actions"><button type="button" class="btn btn-sm btn-outline" data-action="assessment-page" data-page="${ASSESS_UI.page-1}" ${ASSESS_UI.page<=1?'disabled':''}>← Sebelumnya</button><span class="assess-page-label">${ASSESS_UI.page} / ${pages}</span><button type="button" class="btn btn-sm btn-outline" data-action="assessment-page" data-page="${ASSESS_UI.page+1}" ${ASSESS_UI.page>=pages?'disabled':''}>Berikutnya →</button></div></div>`;
}
function closeAssessmentModal(force=false){
  const modal=$('#assessment-score-modal');if(!modal)return;
  if(!force&&S.busy){toast('Tunggu penyimpanan selesai.');return;}
  modal.remove();document.body.classList.remove('assess-modal-open');S.v2.assessmentId='';++S.v2.detailRequest;
  const opener=document.querySelector('[data-action="assessment-detail"]:focus');if(opener)opener.focus();
}
function assessmentModalSkeleton(){
  closeAssessmentModal(true);
  const modal=document.createElement('div');modal.id='assessment-score-modal';modal.className='assess-modal';
  modal.innerHTML=`<section class="assess-modal-panel" role="dialog" aria-modal="true" aria-labelledby="assess-dialog-title" tabindex="-1"><header class="assess-modal-header"><div><div class="small muted">SIPANDAI · Asesmen & Nilai</div><h2 id="assess-dialog-title">Memuat nilai siswa…</h2></div><button type="button" class="assess-close" data-action="assessment-close-modal" aria-label="Tutup dialog">✕</button></header><div class="assess-modal-body" id="assessment-modal-body">${loader()}</div></section>`;
  document.body.appendChild(modal);document.body.classList.add('assess-modal-open');modal.querySelector('.assess-modal-panel')?.focus();return modal;
}
async function loadAssessmentDetail(id){
  const modal=assessmentModalSkeleton();S.v2.assessmentId=id;const queryNo=++S.v2.detailRequest;
  try{
    const d=await cachedCall('assessmentDetail',{id,studentId:role('ORANG_TUA')?S.childId:''},13000);
    const h=modal.querySelector('#assessment-modal-body');
    if(!h||!modal.isConnected||S.v2.assessmentId!==id||queryNo!==S.v2.detailRequest||S.view!=='assessments')return;
    const title=modal.querySelector('#assess-dialog-title');title.textContent=d.assessment.name;
    if(role('ORANG_TUA')){h.innerHTML=`<div class="assess-parent-result"><div class="notice">Nilai terpublikasi: <strong>${E(d.score===''?'Belum dinilai':d.score)}</strong></div><div class="notice">${E(d.feedback||'Belum ada catatan dari guru.')}</div></div>`;return;}
    const editable=d.editable;
    const rows=d.rows||[];
    h.innerHTML=`${d.objective?`<p class="assess-objective">Tujuan: ${E(d.objective)}</p>`:''}<div class="assess-score-instructions">${rows.length} siswa · Nilai 0–100 · Kosongkan jika belum dinilai${editable?' · Simpan semua sekaligus':''}</div>
      <form id="score-form" data-id="${E(id)}">
      <div class="assess-score-list">${rows.map((s,i)=>`<div class="assess-score-row" data-student-id="${E(s.id)}"><div class="assess-score-student"><span class="assess-score-num">${i+1}</span><div class="assess-score-identity"><b>${E(s.name)}</b><span class="assess-score-nis">${E(s.nis)}</span></div></div><label class="assess-score-field"><span class="assess-visually-hidden">Nilai ${E(s.name)}</span><input type="number" class="score-input" min="0" max="100" step="0.01" inputmode="decimal" placeholder="—" aria-label="Nilai ${E(s.name)}" value="${E(s.score)}" ${editable?'':'disabled'}></label><button type="button" class="assess-note-toggle ${s.feedback?'has-note':''}" data-action="score-note-toggle" aria-expanded="false" aria-controls="assess-note-${i}" aria-label="${s.feedback?'Lihat catatan':'Tambahkan catatan'} untuk ${E(s.name)}" title="${s.feedback?'Catatan tersedia':'Tambahkan catatan (opsional)'}">✎</button><div id="assess-note-${i}" class="assess-note-expanded" hidden><label class="assess-note-label">Catatan untuk ${E(s.name)} <span class="muted">(opsional)</span></label><input class="score-note" maxlength="600" aria-label="Catatan ${E(s.name)}" placeholder="Tambahkan catatan jika diperlukan…" value="${E(s.feedback)}" ${editable?'':'disabled'}></div></div>`).join('')}</div>
      <footer class="assess-modal-footer"><span class="small muted" id="assess-save-status">${editable?'Pastikan nilai sudah sesuai sebelum dipublikasikan.':'Nilai hanya dapat diubah saat asesmen berstatus Draft.'}</span><div class="actions"><button type="button" class="btn btn-outline" data-action="assessment-close-modal">Tutup</button>${editable?'<button type="submit" class="btn btn-primary">Simpan Semua Nilai</button>':''}</div></footer></form>`;
  }catch(e){toast(e.message,true);const h=modal.querySelector('#assessment-modal-body');if(h&&modal.isConnected)h.innerHTML='<div class="notice warning">Gagal membuka nilai: '+E(e.message)+'</div>';}
}
async function editAssessment(id){
  const a=S.v2.assessments.find(x=>x.id===id);if(!a)return;
  const request=++S.v2.editAssessmentRequest;
  ASSESS_UI.tab='form';renderAssessments();
  const f=$('#assessment-form');if(!f)return;
  const card=f.closest('.card');
  const banner=document.createElement('div');banner.className='assess-edit-loading';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  banner.innerHTML='<span class="assess-edit-spinner" aria-hidden="true"></span><div><strong>Memuat informasi asesmen…</strong><div class="small muted">Nama, jenis, tanggal, dan tujuan pembelajaran sedang diambil.</div></div>';
  card.insertBefore(banner,f);
  f.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=true);
  f.setAttribute('aria-busy','true');
  f.scrollIntoView({behavior:'smooth',block:'start'});
  try{
    const d=await cachedCall('assessmentDetail',{id},13000);
    if(!f.isConnected||request!==S.v2.editAssessmentRequest||S.view!=='assessments'||ASSESS_UI.tab!=='form')return;
    f.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=false);
    f.elements.id.value=id;f.elements.mapelId.value=a.mapelId;f.elements.mapelId.disabled=true;
    f.elements.name.value=a.name;f.elements.date.value=a.date;f.elements.objective.value=d.objective||'';
    const types=['Asesmen Harian','Asesmen Tengah Semester','Asesmen Akhir Semester','Asesmen Akhir Tahun'];
    f.elements.type.value=types.includes(a.type)?a.type:'LAINNYA';f.elements.customType.value=types.includes(a.type)?'':a.type;
    banner.remove();f.removeAttribute('aria-busy');
  }catch(e){
    if(!f.isConnected||request!==S.v2.editAssessmentRequest)return;
    banner.classList.add('error');banner.innerHTML='<span aria-hidden="true">⚠</span><div><strong>Gagal memuat informasi asesmen.</strong><div class="small muted">'+E(e.message)+'</div><button class="btn btn-sm" type="button" data-action="edit-assessment" data-id="'+E(id)+'">Coba lagi</button></div>';
    f.removeAttribute('aria-busy');toast('Tidak dapat memuat informasi asesmen: '+e.message,true);
  }
}

/* ------------------------- TUGAS / KUIS ------------------------------ */
function taskForm(){return `<div class="card"><div class="panel-title">Buat penugasan</div><form id="task-form"><input type="hidden" name="id"><div class="form-grid"><div class="field"><label class="label">Mata pelajaran</label><select name="mapelId" required>${subjectOptions()}</select></div><div class="field"><label class="label">Batas pengumpulan</label><input name="dueAt" type="datetime-local" required></div><div class="field wide"><label class="label">Judul tugas / kuis</label><input name="title" required maxlength="160" placeholder="Contoh: Latihan pecahan halaman 34"></div><div class="field wide"><label class="label">Instruksi</label><textarea name="instructions" required maxlength="3500" placeholder="Langkah pengerjaan di rumah, alat, dan penjelasan singkat..."></textarea></div><div class="field wide"><label class="label">Tautan Google Forms (opsional)</label><input type="url" name="formUrl" maxlength="600" placeholder="https://forms.gle/..."></div></div>${ownSubjectsHint()}<div class="actions"><button type="submit" class="btn btn-primary" ${!S.home.subjects.length?'disabled':''}>Simpan draft tugas</button><button type="button" class="btn" data-action="clear-task">Tugas baru</button></div><p class="hint">Google Forms ditautkan sebagai kuis eksternal. Nilai Forms belum disinkronkan otomatis ke SIPANDAI.</p></form></div>`;}
function renderTasks(){
  const cl=S.classId,child=S.childId,scope=cl+'|'+child;
  let html=head('Penugasan & Kuis',role('ORANG_TUA')?'Kirim tugas, unggah foto, dan tanggapi guru.':'Beri tugas dan pantau pengumpulan siswa.');
  if(canRecord()&&cl)html+=taskForm();
  if(!cl&&role('GURU_MAPEL'))html+='<div class="notice warning">Belum ada kelas yang ditugaskan kepada akun ini.</div>';
  html+='<div id="task-list" class="section-gap"><div class="notice">Menyiapkan daftar tugas…</div></div><div id="task-detail-host" class="section-gap"></div>';
  setContent(html);
  if(S.v2.taskKey===scope)paintTasks();
  if(cl){const no=++S.v2.fetchNo;
    cachedCall('taskList',{classId:cl,studentId:role('ORANG_TUA')?child:''},40000).then(list=>{
      if(S.view!=='tasks'||S.classId!==cl||S.childId!==child||no!==S.v2.fetchNo)return;
      S.v2.taskKey=scope;S.v2.tasks=list;paintTasks();
    }).catch(err=>{const el=$('#task-list');if(el)el.innerHTML='<div class="notice">'+E(err.message)+'</div>';});
  }else{S.v2.tasks=[];paintTasks();}
}
function paintTasks(){
  const el=$('#task-list');if(!el)return;
  const list=S.v2.tasks;
  el.innerHTML=`<div class="card section-gap"><div class="panel-title">Daftar tugas <span class="pill">${list.length}</span></div><div class="stack">${list.map(t=>`<div class="item"><div class="row-between"><div><b>${E(t.title)}</b><div class="small muted">${E(getSubjectName(t.mapelId))} · Tenggat ${E(niceDate(t.dueAt))}</div></div>${statusPill(role('ORANG_TUA')?t.submissionStatus:t.status)}</div><p class="small section-gap">${E(t.instructions.slice(0,240))}</p>${t.formUrl?`<p class="small">📝 <a href="${E(t.formUrl)}" target="_blank" rel="noopener noreferrer">Buka Google Forms</a></p>`:''}<div class="actions"><button type="button" class="btn btn-sm btn-outline" data-action="task-detail" data-id="${E(t.id)}">Detail & pengumpulan</button>${canRecord()&&canEditMapelUI(t.mapelId)&&t.status==='DRAFT'?`<button type="button" class="btn btn-sm" data-action="edit-task" data-id="${E(t.id)}">Ubah</button><button type="button" class="btn btn-sm btn-primary" data-action="task-status" data-id="${E(t.id)}" data-status="PUBLISHED">Terbitkan</button>`:''}${canRecord()&&canEditMapelUI(t.mapelId)&&t.status==='PUBLISHED'?`<button type="button" class="btn btn-sm" data-action="task-status" data-id="${E(t.id)}" data-status="CLOSED">Tutup pengumpulan</button>`:''}${canRecord()&&canEditMapelUI(t.mapelId)?`<button type="button" class="btn btn-sm" data-action="archive-task" data-id="${E(t.id)}">Hapus penugasan</button>`:''}</div></div>`).join('')||empty('Belum ada tugas pada kelas ini.')}</div></div>`;
}
async function loadTaskDetail(taskId,studentId=''){
  S.v2.taskId=taskId;S.v2.taskStudentId=studentId;const queryNo=++S.v2.detailRequest;
  const h=$('#task-detail-host');if(!h)return;h.innerHTML=loader();
  try{const d=await cachedCall('taskDetail',{taskId,studentId:role('ORANG_TUA')?S.childId:studentId},12000);
    const host=$('#task-detail-host');if(!host||S.v2.taskId!==taskId||S.view!=='tasks'||queryNo!==S.v2.detailRequest)return;
    S.v2.taskStudentId=d.studentId;
    const t=d.task,parent=role('ORANG_TUA'),sub=d.submission;
    let html=`<div class="card"><div class="panel-title">Detail tugas: ${E(t.title)} ${statusPill(t.status)}</div><p>${E(t.instructions)}</p><p class="hint">Tenggat: ${E(niceDate(t.dueAt))}</p>${t.formUrl?`<div class="notice section-gap">Kuis eksternal: <a href="${E(t.formUrl)}" rel="noopener noreferrer" target="_blank">Buka Google Forms</a>. Penyelesaian Google Forms belum tersinkron otomatis.</div>`:''}`;
    if(!parent)html+=`<div class="field section-gap"><label class="label">Pilih siswa untuk memeriksa tugas</label><select id="task-pick-student">${d.students.map(s=>`<option value="${E(s.id)}" ${d.studentId===s.id?'selected':''}>${E(s.name)} — ${E(statusText(s.status))}</option>`).join('')}</select></div>`;
    html+=`<div class="divider"></div><div class="row-between"><b>Status: ${E(statusText(sub?.status||'BELUM'))}</b><span class="small muted">${E(niceDate(sub?.submittedAt||''))}</span></div><p class="section-gap">${E(sub?.note||'Belum ada keterangan pengumpulan.')}</p>`;
    if(d.files.length)html+=`<div class="stack section-gap">${d.files.map(f=>`<div class="row-between item"><span>📎 ${E(f.name)}</span><button type="button" class="btn btn-sm" data-action="task-file" data-id="${E(f.id)}">Buka lampiran</button></div>`).join('')}</div>`;
    if(parent&&d.canSubmit)html+=`<form id="submission-form" data-id="${E(taskId)}" class="section-gap"><div class="field"><label class="label">Keterangan pengumpulan / jawaban</label><textarea name="note" maxlength="1400" placeholder="Misalnya: Sudah mengerjakan halaman 34, foto terlampir..."></textarea></div><div class="field"><label class="label">Foto atau PDF (maks. 3 file total, masing-masing 3 MB)</label><input name="files" type="file" multiple accept="image/jpeg,image/png,application/pdf"><p class="hint">Foto akan diperkecil otomatis sebelum dikirim untuk menghemat kuota. Kirim file satu per satu secara otomatis.</p></div><button type="submit" class="btn btn-primary">Kirim / perbarui pengumpulan</button></form>`;
    if(parent&&!d.canSubmit)html+=`<div class="notice section-gap">${t.status==='CLOSED'?'Pengumpulan tugas sudah ditutup.':'Tugas telah dinyatakan selesai.'}</div>`;
    if(!parent&&d.canReview&&sub)html+=`<form id="review-form" data-id="${E(taskId)}" data-student="${E(d.studentId)}" class="section-gap"><div class="panel-title">Tindak lanjut guru</div><div class="field"><label class="label">Status hasil kerja</label><select name="status"><option value="DONE">Selesai</option><option value="NEEDS_REVISION">Perlu perbaikan</option></select></div><div class="field"><label class="label">Umpan balik guru</label><textarea name="message" required maxlength="1400" placeholder="Berikan komentar yang membantu siswa berkembang..."></textarea></div><button type="submit" class="btn btn-primary">Simpan umpan balik</button></form>`;
    html+=`<div class="divider"></div><div class="panel-title">Komunikasi terkait tugas</div><div class="stack">${d.messages.map(m=>`<div class="item"><div class="row-between"><b>${E(m.role==='ORANG_TUA'?'Orang Tua':'Guru')}</b><span class="small muted">${E(niceDate(m.createdAt))}</span></div><p>${E(m.message)}</p></div>`).join('')||empty('Belum ada tanggapan.')}</div>`;
    if(sub&&(parent||d.canReview))html+=`<form id="task-comment-form" data-id="${E(taskId)}" data-student="${E(d.studentId)}" class="section-gap"><div class="field"><label class="label">Balas catatan tugas</label><textarea name="message" maxlength="1000" required placeholder="Tanggapan sesuai tugas ini..."></textarea></div><button type="submit" class="btn">Kirim tanggapan</button></form>`;
    html+='</div>';host.innerHTML=html;
  }catch(e){toast(e.message,true);const host=$('#task-detail-host');if(host)host.innerHTML=empty('Detail tugas gagal dimuat.');}
}
function editTask(id){const t=S.v2.tasks.find(x=>x.id===id),f=$('#task-form');if(!t||!f)return;
  ['id','mapelId','title','instructions','dueAt','formUrl'].forEach(k=>{if(f.elements[k])f.elements[k].value=k==='dueAt'?String(t[k]).slice(0,16):(t[k]||'');});
  f.elements.mapelId.disabled=true;f.scrollIntoView({behavior:'smooth',block:'start'});
}
async function compressTaskFile(file){
  if(file.type==='application/pdf')return readFile(file);
  if(!['image/jpeg','image/png'].includes(file.type))throw new Error('Lampiran harus berupa foto JPG/PNG atau PDF.');
  const img=await new Promise((resolve,reject)=>{const im=new Image();const url=URL.createObjectURL(file);im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Foto tidak dapat dibaca.'));};im.src=url;});
  const ratio=Math.min(1,1400/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*ratio));cv.height=Math.max(1,Math.round(img.height*ratio));
  const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
  const data=cv.toDataURL('image/jpeg',0.78);assertImageSize(data);
  return{name:file.name.replace(/\.(png|jpe?g)$/i,'')+'.jpg',mime:'image/jpeg',data};
}
function assertImageSize(data){if(data.length>3*1024*1024*1.38)throw new Error('Foto masih terlalu besar (batas 3 MB).');}
async function openTaskFile(id){try{toast('Mengambil lampiran secara privat...');const d=await call('getTaskFile',{attachmentId:id});const raw=atob(d.base64),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:d.mime})),a=document.createElement('a');a.href=url;a.download=d.name||'tugas';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),25000);
  }catch(e){toast(e.message,true);}}

/* ================= TAHAP 3: LAPORAN PERKEMBANGAN ================= */
function progressStudentId(){
  return role('ORANG_TUA')?S.childId:(S.progress.studentId&&S.home.students.some(s=>s.id===S.progress.studentId)?S.progress.studentId:S.home.students[0]?.id||'');
}
function renderProgress(){
  const isParent=role('ORANG_TUA');const id=progressStudentId();S.progress.studentId=id;
  let html=head('Laporan Perkembangan Belajar','Pantauan sementara untuk mendampingi anak, bukan pengganti rapor resmi.');
  if(!isParent){
    html+=`<div class="card"><div class="row-between"><div class="panel-title">Siswa yang dipantau</div><button type="button" class="btn btn-sm btn-outline" data-action="refresh-progress">Perbarui laporan</button></div><select id="progress-student">${(S.home.students||[]).map(x=>`<option value="${E(x.id)}" ${x.id===id?'selected':''}>${E(x.name)} — ${E(x.nis)}</option>`).join('')}</select></div>`;
  }else html+=`<div class="notice">Laporan untuk <b>${E(S.home.currentChild?.name||'anak Anda')}</b>. Hanya informasi yang sudah diterbitkan guru yang ditampilkan. <button type="button" class="btn btn-sm" data-action="refresh-progress">Perbarui</button></div>`;
  html+='<div id="progress-body" class="section-gap"><div class="card">Memuat ringkasan perkembangan…</div></div>';
  setContent(html);
  const key=S.classId+'|'+id;
  if(key===S.progress.lastKey&&S.progress.report)paintProgress(S.progress.report);
  if(id)loadProgress();else $('#progress-body').innerHTML=empty('Belum ada siswa aktif pada kelas ini.');
}
async function loadProgress(force=false){
  const studentId=progressStudentId(),classId=S.classId;
  if(!studentId||!classId)return;
  const key=classId+'|'+studentId,req=++S.progress.requestId;
  const h=$('#progress-body');
  if(h&&(force||S.progress.lastKey!==key||!S.progress.report)){h.setAttribute('aria-busy','true');h.innerHTML=`<div class="card sip-progress-wait" role="status" aria-live="polite"><span class="dots" aria-hidden="true"></span><div><b>Memuat perkembangan siswa…</b><p class="small muted">Menyiapkan nilai, kehadiran, tugas, dan catatan siswa yang dipilih.</p></div></div>`;}
  if(force)forgetMenuCache('progressReport');
  try{
    const r=await cachedCall('progressReport',{studentId,classId},force?0:40000);
    if(req!==S.progress.requestId||S.view!=='progress'||classId!==S.classId||studentId!==progressStudentId())return;
    S.progress.report=r;S.progress.lastKey=key;if(h)h.removeAttribute('aria-busy');paintProgress(r);
  }catch(err){console.error('Gagal mengambil laporan',err);if(h){h.removeAttribute('aria-busy');h.innerHTML='<div class="notice warning">Gagal memuat laporan: '+E(err.message)+'</div>';}}
}
function paintProgress(r){
  const host=$('#progress-body');if(!host)return;
  const t=r.tasks,a=r.attendance,b=r.behavior;
  let html=`<div class="card"><div class="row-between"><div><h2>${E(r.student.name)}</h2><div class="small muted">NIS ${E(r.student.nis)} · ${E(r.className)}</div></div><div class="small muted">Pembaruan ${E(niceDate(r.generatedAt))}</div></div><p class="hint">${E(r.disclaimer)}</p></div>`;
  html+=`<div class="grid grid4 section-gap">
    ${stat('Kehadiran tercatat',a.total?a.percentage+'%':'–',a.total?'Hadir '+a.present+' dari '+a.total+' hari':'Belum ada data harian')}
    ${stat('Asesmen dinilai',r.marksCount,'Nilai yang sudah dipublikasikan')}
    ${stat('Tugas selesai',t.done,'Dari '+t.total+' tugas yang telah diterbitkan')}
    ${stat('Catatan apresiasi',b.positive,'Pembinaan: '+b.guidance)}
  </div>`;
  // Ringkasan perkembangan menggunakan rerata HARIAN+PROYEK saja; ujian tidak pernah dicampur.
  // Mapel ringkas: lima pertama langsung terlihat; mapel lainnya dibuka bila diperlukan.
  // Rincian nilai/ujian hanya terbuka saat nama mapel dipilih.
  const subjectItems=(r.subjects||[]).map(s=>{
    const daily=(s.marks||[]).filter(m=>m.category==='HARIAN'||m.category==='PROYEK');
    const exams=(s.marks||[]).filter(m=>['ASTS','ASAS','ASAT'].includes(m.category));
    const other=(s.marks||[]).filter(m=>!['HARIAN','PROYEK','ASTS','ASAS','ASAT'].includes(m.category));
    const value=s.dailyAverage===undefined?s.average:s.dailyAverage;
    return `<details class="progress-subject-compact"><summary class="progress-compact-summary"><span class="progress-compact-name">${E(s.name)}</span><span class="progress-compact-meta">${daily.length} nilai harian${exams.length?' · '+exams.length+' ujian':''}</span><strong class="progress-compact-score">${E(formatParentGrade(value))}</strong></summary><div class="progress-compact-detail">
      ${daily.length&&value!==null?`<div class="progress-meter"><span style="width:${Math.max(0,Math.min(100,Number(value)||0))}%"></span></div>`:''}
      ${exams.length?`<div class="progress-exam-list"><strong class="small">Ujian (tidak masuk rata-rata)</strong>${exams.map(m=>`<div class="row-between"><span>${E(m.category)} · ${E(m.name)}</span><b>${E(m.score)}</b></div>`).join('')}</div>`:''}
      ${daily.length||other.length?`<div class="progress-compact-grades">${[...daily,...other].map(m=>`<div class="row-between"><span>${E(m.name)} <small class="muted">${E(m.date)}</small></span><strong>${E(m.score)}</strong></div>${m.feedback?`<p class="small muted">${E(m.feedback)}</p>`:''}`).join('')}</div>`:'<p class="small muted">Belum ada nilai harian/proyek.</p>'}
    </div></details>`;
  });
  const progressSubjectCards=subjectItems.slice(0,5).join('')+(subjectItems.length>5?`<details class="progress-more-subjects"><summary>Lihat ${subjectItems.length-5} mata pelajaran lainnya</summary>${subjectItems.slice(5).join('')}</details>`:'');
  html+=`<div class="grid grid2 section-gap"><div class="card"><div class="panel-title">Perkembangan nilai per mapel</div><p class="hint">Rata-rata hanya dari Asesmen Harian dan Proyek terpublikasi. ASTS, ASAS dan ASAT tercantum terpisah.</p>${progressSubjectCards||empty('Belum ada nilai terpublikasi.')}</div>
    <div class="card"><div class="panel-title">Penugasan & tindak lanjut</div><div class="grid grid2"><div class="notice">Selesai: <b>${t.done}</b><div class="small">Dikumpulkan: ${t.submitted}</div></div><div class="notice">Perlu perbaikan: <b>${t.needsRevision}</b><div class="small">Belum terkumpul: ${t.missing}</div></div></div><div class="stack section-gap">${t.recent.map(x=>`<div class="item row-between"><div><b>${E(x.title)}</b><div class="small muted">Batas ${E(niceDate(x.dueAt))}</div></div>${statusPill(x.status)}</div>`).join('')||empty('Belum ada tugas yang diterbitkan.')}</div></div></div>`;
  html+=`<div class="grid grid2 section-gap"><div class="card"><div class="panel-title">Catatan perkembangan perilaku</div><div class="stack">${b.recent.map(x=>`<div class="item"><div class="row-between">${x.kind==='POSITIF'?'<span class="pill green">Apresiasi</span>':'<span class="pill yellow">Pembinaan</span>'}<span class="small muted">${E(x.date)}</span></div><p>${E(x.description)}</p>${x.followUp?`<p class="small">Tindak lanjut: ${E(x.followUp)}</p>`:''}</div>`).join('')||empty('Belum ada catatan perilaku yang dipublikasikan.')}</div></div>
    <div class="card"><div class="panel-title">Pesan perkembangan dari guru</div><div id="progress-notes" class="stack">${progressNotes(r)}</div></div></div>`;
  if(role('ADMIN','GURU_KELAS'))html+=`<div class="card section-gap"><div class="panel-title">Catatan perkembangan untuk orang tua</div><p class="hint">Draft hanya terlihat staf. Publikasikan setelah catatan diperiksa agar orang tua dapat membacanya.</p><form id="progress-note-form"><input type="hidden" name="id"><div class="field"><label class="label">Catatan / pendampingan yang disarankan</label><textarea name="note" maxlength="2200" required placeholder="Ceritakan perkembangan, kekuatan, dan langkah pendampingan yang dapat dilakukan keluarga..."></textarea></div><div class="field"><label class="label">Publikasi</label><select name="status"><option value="DRAFT">Simpan draft</option><option value="PUBLISHED">Publikasikan kepada orang tua</option></select></div><div class="actions"><button type="submit" class="btn btn-primary">Simpan catatan perkembangan</button><button type="button" class="btn" data-action="clear-progress-note">Catatan baru</button></div></form></div>`;
  host.innerHTML=html;
}
function progressNotes(r){return r.notes.map(x=>`<div class="item"><div class="row-between">${statusPill(x.status)}<span class="small muted">${E(x.date)}</span></div><p>${E(x.note)}</p>${role('ADMIN','GURU_KELAS')?`<button type="button" class="btn btn-sm section-gap" data-action="edit-progress-note" data-id="${E(x.id)}">Ubah catatan</button>`:''}</div>`).join('')||empty('Belum ada catatan perkembangan dari guru.');}
function editProgressNote(id){const r=S.progress.report,f=$('#progress-note-form');if(!r||!f)return;const note=r.notes.find(x=>x.id===id);if(!note)return;f.elements.namedItem('id').value=id;f.elements.namedItem('note').value=note.note;f.elements.namedItem('status').value=note.status;f.scrollIntoView({behavior:'smooth',block:'center'});}
function clearProgressNote(){const f=$('#progress-note-form');if(f)f.reset();if(f?.elements.namedItem('id'))f.elements.namedItem('id').value='';}
async function saveProgressForm(f){
  if(S.busy)return;const studentId=progressStudentId(),classId=S.classId,data=fd(f);
  try{
    busy(true);
    const r=await call('saveProgressNote',{...data,studentId,classId});
    forgetMenuCache('progressReport');
    const existing=S.progress.report;
    if(existing&&r.item){const i=existing.notes.findIndex(x=>x.id===r.id);if(i>=0)existing.notes[i]=r.item;else existing.notes.unshift(r.item);}
    toast('Catatan perkembangan berhasil disimpan.');
    clearProgressNote();
    const notes=$('#progress-notes');if(notes&&existing)notes.innerHTML=progressNotes(existing);
  }catch(err){console.error('Gagal simpan perkembangan',err);toast(err.message,true);}finally{busy(false);}
}

document.addEventListener('invalid',ev=>{
  const f=ev.target.closest?.('form');
  if(f&&['journal-form','assessment-form','task-form'].includes(f.getAttribute('id'))){
    const input=ev.target;
    toast('Lengkapi kolom '+(input.closest('.field')?.querySelector('label')?.textContent||input.name||'yang wajib diisi')+'.',true);
  }
},true);
document.addEventListener('submit',async ev=>{
  const f=ev.target;const formId=f?.getAttribute?.('id');if(!formId||formId==='print-form')return;ev.preventDefault();if(S.busy){toast('Sedang menyimpan data sebelumnya. Tunggu sebentar.');return;}
  const d=fd(f);
  if(formId==='subject-owners-form'){
    const owners=[...f.querySelectorAll('[data-mapel-id]')].map(x=>({mapelId:x.dataset.mapelId,teacherId:x.value}));
    try{busy(true);const result=await call('saveSubjectOwners',{classId:S.classId,owners});toast('Pengampu berhasil disimpan ('+(result.changed||0)+' perubahan).');S.needsHome=true;S.menuCache.clear();await loadHome();}
    catch(err){toast('Gagal menyimpan pengampu: '+err.message,true);}
    finally{busy(false);}return;
  }
  if(formId==='progress-note-form')return saveProgressForm(f);
  if(formId==='journal-form')return v2save('saveJournal',{...d,classId:S.classId});
  if(formId==='assessment-form'){const d=fd(f);if(f.elements.mapelId.disabled)d.mapelId=f.elements.mapelId.value;const res=await v2save('saveAssessment',{...d,classId:S.classId});if(res){ASSESS_UI.tab='list';ASSESS_UI.page=1;renderAssessments();}return;}
  if(formId==='score-form'){
    // Baris nilai memakai data-student-id; selector .att-student milik modul Absensi dan sebelumnya menghasilkan rows: [].
    const rows=[...f.querySelectorAll('.assess-score-row[data-student-id]')].map(tr=>({studentId:tr.dataset.studentId,score:tr.querySelector('.score-input').value.trim(),feedback:tr.querySelector('.score-note').value.trim()}));
    if(!rows.length){toast('Daftar siswa kosong. Tutup lalu buka kembali Nilai Siswa.',true);return;}
    if(rows.some(x=>x.score!==''&&(!Number.isFinite(Number(x.score))||Number(x.score)<0||Number(x.score)>100))){toast('Nilai harus dalam rentang 0 sampai 100.',true);return;}
    const res=await v2save('saveScores',{assessmentId:f.dataset.id,rows},{refresh:false});
    if(res){forgetMenuCache('assessmentDetail','progressReport');closeAssessmentModal(true);}return;
  }
  if(formId==='task-form'){const d=fd(f);if(f.elements.mapelId.disabled)d.mapelId=f.elements.mapelId.value;return v2save('saveTask',{...d,classId:S.classId});}
  if(formId==='submission-form'){
    const files=[...f.elements.files.files];if(files.length>3){toast('Maksimal tiga file dalam satu kali pengumpulan.',true);return;}
    const note=f.elements.note.value.trim();if(!note&&!files.length){toast('Isi keterangan atau pilih lampiran.',true);return;}
    try{busy(true);
      if(!files.length)await call('submitTask',{taskId:f.dataset.id,studentId:S.childId,note,files:[]});
      else for(let i=0;i<files.length;i++){
        const doc=await compressTaskFile(files[i]);
        await call('submitTask',{taskId:f.dataset.id,studentId:S.childId,note:i===0?note:'',files:[doc]});
      }
      toast('Tugas berhasil dikumpulkan.');forgetMenuCache('taskDetail','taskList');
      await loadTaskDetail(f.dataset.id,S.childId);
    }catch(e){toast(e.message+' Jika beberapa berkas sempat terkirim, periksa daftar lampiran sebelum mencoba lagi.',true);await loadTaskDetail(f.dataset.id,S.childId);}
    finally{busy(false);}return;
  }
  if(formId==='review-form'){const d=fd(f);const res=await v2save('reviewSubmission',{...d,taskId:f.dataset.id,studentId:f.dataset.student},{refresh:false});if(res)loadTaskDetail(f.dataset.id,f.dataset.student);return;}
  if(formId==='task-comment-form'){const d=fd(f);const res=await v2save('commentTask',{...d,taskId:f.dataset.id,studentId:f.dataset.student},{refresh:false});if(res)loadTaskDetail(f.dataset.id,f.dataset.student);return;}
  if(formId==='login-form') {try{busy(true);const loginStarted=Date.now();const r=await call('login',{...d,withHome:true});S.token=r.token;try{sessionStorage.setItem('sipandai_token',S.token);}catch(e){}S.user=r.user;S.attMode=r.user.role==='GURU_MAPEL'?'MAPEL':'HARIAN';S.attDate='';S.attMapel='';S.v2.journalKey=null;S.v2.assessmentKey=null;S.v2.taskKey=null;S.v2.journal=[];S.v2.assessments=[];S.v2.tasks=[];S.progress.report=null;S.progress.lastKey='';PARENT_GRADE_UI.report=null;PARENT_GRADE_UI.key='';PARENT_GRADE_UI.period='ALL';S.menuCache.clear();USER_UI.tab='list';USER_UI.query='';USER_UI.editingId='';STUDENT_UI.tab='list';STUDENT_UI.query='';clearTahDom();S.view='dashboard';S.learningTab=r.user.role==='ORANG_TUA'?'assessments':'journal';
   if(r.user.mustChangePassword)passwordUI();
   else if(r.home){
     S.home=r.home;S.user=r.home.user;S.needsHome=false;S.classId=r.home.classId;S.childId=r.home.currentChild?.id||'';
     baseUI();render();prefetchTodayAttendance();prefetchTahfidz();
   }else {await loadHome();prefetchTodayAttendance();prefetchTahfidz();}
   console.info('SIPANDAI: login & halaman awal '+(Date.now()-loginStarted)+' ms (termasuk respons jaringan)',r.perf||'');}catch(e){toast(e.message,true);}finally{busy(false);}return;}
  if(formId==='change-password-form'){const r=await submitAction('changePassword',d,{refresh:false});if(r?.ok){S.token='';try{sessionStorage.removeItem('sipandai_token');}catch(e){}loginUI();toast('Password diganti. Silakan login dengan password baru.');}return;}
  if(formId==='user-form'){
    const r=await submitAction('createUser',d,{credentials:false,message:false,refresh:false});
    if(r){S.home.staff.push({id:r.id,username:r.username,fullName:r.fullName,name:r.fullName,role:r.role,active:'YES'});toast('Akun Guru berhasil dibuat. Simpan kredensialnya.');showCredential(r);}
    return;
  }
  if(formId==='user-edit-form'){
    const r=await submitAction('updateUser',d,{refresh:false});
    if(r){S.home.staff=S.home.staff.map(x=>x.id===r.user.id?{...x,...r.user,name:r.user.fullName}:x);USER_UI.editingId='';paintUserPanel();toast('Akun diperbarui. Pemilik perlu login kembali.');}
    return;
  }
  if(formId==='class-form'){
    const result=await submitAction(d.id?'updateClass':'createClass',d);
    if(result?.reassigned)toast('Guru Kelas dan '+result.reassigned+' penugasan mapel telah disesuaikan.');return;
  }
  if(formId==='subject-form'){
    const editing=!!d.id,action=editing?'updateSubject':'createSubject';
    const result=await submitAction(action,d,{refresh:false});
    if(result){forgetMenuCache('subjectList','progressReport','assessmentList');S.needsHome=true;SUBJECT_ADMIN.query='';SUBJECT_ADMIN.editingId='';await loadHome();toast(editing?'Nama mapel diperbarui tanpa mengubah riwayat.':'Mata pelajaran ditambahkan.');}
    return;
  }
  if(formId==='student-form'){
    const updating=!!d.id;
    const r=await submitAction(updating?'updateStudent':'addStudent',{...d,classId:S.classId},{refresh:false});
    if(r){
      if(r.createdParents)await sipAlert('Akun wali dibuat otomatis. Username: '+r.parentUsername+'; password awal: '+r.password+'. Sampaikan secara pribadi kepada wali.',{title:'Kredensial akun orang tua'});
      if(r.updatedParentLogin)toast('NIS dan username akun wali terkait diperbarui.');
      S.needsHome=true;FAMILY.list=[];forgetMenuCache('parents');
      await loadHome();
    }
    return;
  }
  if(formId==='assign-form')return submitAction('assignTeacher',{...d,classId:S.classId});
  if(formId==='link-parent-form'){if(!role('ADMIN'))return;const r=await submitAction('linkParent',d,{refresh:false});if(r){FAMILY.tab='list';FAMILY.query='';FAMILY.page=1;await reloadFamilyList();}return;}
  if(formId==='request-link-form')return submitAction('requestLink',d,{refresh:false});
  if(formId==='notice-form')return submitAction('saveNotice',{...d,classId:S.classId,requireConfirm:d.requireConfirm==='YES'});
  if(formId==='attendance-form'){
    const rows=[...f.querySelectorAll('.att-student[data-student-id]')].map(tr=>({studentId:tr.dataset.studentId,status:tr.querySelector('.att-status').value,note:tr.querySelector('.att-note').value}));
    const oldAttendance=S.att;
    const savedContext={classId:S.classId,date:S.attDate,mode:S.attMode,mapelId:S.attMapel,sessionNo:S.sessionNo};
    if(S.busy)return;
    try{
      busy(true);processMessage('Menyimpan absensi siswa…');
      await call('saveAttendance',{...savedContext,rows,edit:!!oldAttendance?.hasSaved&&S.attEdit});
      forgetMenuCache('attendance');
      const byId=new Map(rows.map(x=>[x.studentId,x]));
      const snapshot={...oldAttendance,hasSaved:true,rows:(oldAttendance?.rows||[]).map(s=>({...s,...byId.get(s.id)}))};
      attendanceSavedUi(snapshot,rows,savedContext);
      toast('Absensi tersimpan.');
    }catch(e){
      // Jaringan/502: jangan menyimpan ulang secara otomatis. Cek hasil dari backend.
      if(/502|503|504|Gateway|jaringan|menghubungi|respons|melewati|server|upstream|Apps Script|HTTP/i.test(e.message)){
        processMessage('Memeriksa hasil penyimpanan…');
        await verifyAttendanceAfterError(savedContext,rows,e);
      }else toast(e.message,true);
    }finally{busy(false);}
    return;
  }
  if(formId==='behavior-form'){try{busy(true);const file=await readFile($('#behavior-file')?.files[0]);await submitAction('saveBehavior',{...d,file,classId:S.classId});}catch(e){toast(e.message,true);}finally{busy(false);}return;}
  console.error('SIPANDAI: handler simpan tidak ditemukan untuk formulir',formId);
  toast('Formulir '+formId+' belum memiliki proses penyimpanan. Hubungi pengelola.',true);
});
// Saat mengetik nilai, Enter maju ke siswa berikutnya (bukan mengirim seluruh formulir).
document.addEventListener('keydown',ev=>{
  if(ev.key!=='Enter'||!ev.target.matches?.('#score-form .score-input'))return;
  ev.preventDefault();
  const cells=[...document.querySelectorAll('#score-form .score-input:not(:disabled)')];
  const i=cells.indexOf(ev.target),next=cells[i+(ev.shiftKey?-1:1)];
  if(next){next.focus();next.select();}
});
// Tanda pena berubah saat catatan ditambahkan atau dikosongkan.
document.addEventListener('input',ev=>{
  if(!ev.target.matches?.('#score-form .score-note'))return;
  const b=ev.target.closest('.assess-score-row')?.querySelector('.assess-note-toggle');
  if(b)b.classList.toggle('has-note',Boolean(ev.target.value.trim()));
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')toggleMobileMore(false);});
document.addEventListener('click',ev=>{
  const drawer=document.getElementById('mobile-more');
  if(drawer?.classList.contains('open')&&!ev.target.closest('#mobile-more,.mobilebar'))toggleMobileMore(false);
});
document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
  if(action==='nav'&&b.dataset.view==='more'){toggleMobileMore();return;}
  if(action==='close-more'){toggleMobileMore(false);return;}
  if(action==='learning-tab'){
    const target=b.dataset.tab;
    if(!isLearningView(target)||(role('ORANG_TUA')&&['journal','attendance'].includes(target)))return;
    if(S.view===target)return;
    S.learningTab=target;S.view=target;S.v2.fetchNo++;render();document.documentElement.scrollTop=0;return;
  }
  if(action==='nav'){
    const requested=b.dataset.view;
    const nextView=requested==='learning'?(role('ORANG_TUA')&&['journal','attendance'].includes(S.learningTab)?'assessments':S.learningTab):requested;
    // Klik berulang pada menu aktif tidak membangun halaman atau memanggil server lagi.
    if(nextView===S.view&&!S.needsHome){toggleMobileMore(false);return;}
    S.view=nextView;
    if(isLearningView(S.view))S.learningTab=S.view;
    S.v2.fetchNo++;S.att=null;
    toggleMobileMore(false);
    if(S.needsHome){try{await loadHome();}catch(e){toast(e.message,true);}}
    else render();
    document.documentElement.scrollTop=0;return;
  }
  if(action==='notice-detail'){openNoticeDialog(b.dataset.id);return;}
  if(action==='close-notice-dialog'){closeNoticeDialog();return;}
  if(action==='notice-confirmations'){void openNoticeConfirmations(b.dataset.id);return;}
  if(action==='student-exit'){const st=S.home?.students?.find(x=>x.id===b.dataset.id);if(!st)return;const reason=await sipExitReason(st);if(!reason)return;try{busy(true);await call('studentExit',{classId:S.classId,studentId:st.id,reason});S.needsHome=true;await loadHome();toast('Siswa dimutasi keluar; data historis dipertahankan.');}catch(e){toast(e.message,true);}finally{busy(false);}return;}
  if(action==='student-transfer'){if(!role('ADMIN'))return;const st=S.home?.students?.find(x=>x.id===b.dataset.id);const classes=(S.home?.classes||[]).filter(c=>c.id!==S.classId);if(!st||!classes.length)return sipAlert('Belum ada kelas tujuan.');const index=await sipChooseClassForTransfer(st,classes);if(!index)return;try{busy(true);await call('studentTransfer',{studentId:st.id,fromClassId:S.classId,toClassId:index});S.needsHome=true;await loadHome();toast('Siswa berhasil dipindahkan.');}catch(e){toast(e.message,true);}finally{busy(false);}return;}
  if(action==='refresh-progress'){S.progress.lastKey='';return loadProgress(true);}
  if(action==='edit-progress-note')return editProgressNote(b.dataset.id);
  if(action==='clear-progress-note')return clearProgressNote();
  if(action==='family-tab'){
    if(!role('ADMIN'))return;
    FAMILY.tab=b.dataset.tab;
    document.querySelectorAll('.module-tabs [data-action="family-tab"]').forEach(el=>{const active=el.dataset.tab===FAMILY.tab;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));});
    paintFamilyPanel();return;
  }
  if(action==='family-link-parent'){
    if(!role('ADMIN'))return;FAMILY.selectedParentId=b.dataset.id;FAMILY.parentQuery='';FAMILY.tab='link';
    document.querySelectorAll('[data-action="family-tab"]').forEach(el=>{const active=el.dataset.tab==='link';el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));});
    paintFamilyPanel();return;
  }
  if(action==='family-page'){FAMILY.page=Number(b.dataset.page)||1;paintFamilyList();return;}
  if(action==='user-tab'){USER_UI.tab=b.dataset.tab;USER_UI.editingId='';renderUsers();return;}
  if(action==='edit-user'){USER_UI.editingId=b.dataset.id;paintUserEdit();return;}
  if(action==='cancel-edit-user'){USER_UI.editingId='';paintUserEdit();return;}
  if(action==='user-page'){USER_UI.page=Number(b.dataset.page)||1;paintUserList();return;}
  if(action==='student-tab'){STUDENT_UI.tab=b.dataset.tab;renderStudents();return;}
  if(action==='student-add'){STUDENT_UI.tab='create';renderStudents();return;}
  if(action==='student-page'){STUDENT_UI.page=Number(b.dataset.page)||1;paintStudentList();return;}
  if(action==='edit-class'){editClassForm(b.dataset.id);return;}
  if(action==='pwa-install'){installPWA();return;}
  if(action==='class-new'){resetClassForm();return;}
  if(action==='edit-subject'){editSubjectForm(b.dataset.id);return;}
  if(action==='subject-new'){resetSubjectForm();return;}
  if(action==='subject-refresh'){forgetMenuCache('subjectList');renderClasses();return;}
  if(action==='import-students'){await importStudentBatch();return;}
  if(action==='import-template'){downloadImportTemplate();return;}
  if(action==='edit-student'){editStudentForm(b.dataset.id);return;}
  if(action==='student-new'){resetStudentForm();return;}
  if(action==='edit-attendance'){if(!S.att?.editable)return;S.attEdit=true;paintAttendance(S.att);return;}
  if(action==='cancel-att-edit'){S.attEdit=false;paintAttendance(S.att);return;}
  if(['archive-journal','archive-assessment','archive-task','archive-behavior'].includes(action)){
    const info={
      'archive-journal':['archiveJournal','Jurnal akan dihapus dari daftar aktif. Riwayatnya tersimpan untuk audit.','journal'],
      'archive-assessment':['archiveAssessment','Asesmen beserta nilainya akan disembunyikan dari laporan dan akun orang tua. Lanjutkan?','assessments'],
      'archive-task':['archiveTask','Tugas beserta pengumpulan tidak lagi ditampilkan. File tetap diarsipkan secara privat.','tasks'],
      'archive-behavior':['archiveBehavior','Catatan perilaku akan disembunyikan dari guru dan orang tua.','behaviors']
    }[action];
    if(!await sipConfirm(info[1],{danger:true,title:'Konfirmasi pengarsipan',confirmText:'Ya, arsipkan'}))return;
    try{busy(true);const res=await call(info[0],{id:b.dataset.id});if(!res?.ok)throw new Error(res?.error||'Tidak dapat mengarsipkan data.');
      forgetMenuCache('journalList','assessmentList','assessmentDetail','taskList','taskDetail');
      S.progress.lastKey='';
      if(info[2]==='journal'){S.v2.journal=S.v2.journal.filter(x=>x.id!==b.dataset.id);paintJournal();}
      else if(info[2]==='assessments'){S.v2.assessments=S.v2.assessments.filter(x=>x.id!==b.dataset.id);closeAssessmentModal(true);paintAssessments();}
      else if(info[2]==='tasks'){S.v2.tasks=S.v2.tasks.filter(x=>x.id!==b.dataset.id);S.v2.taskId='';paintTasks();const h=$('#task-detail-host');if(h)h.innerHTML='';}
      else {S.needsHome=true;await loadHome();}
      toast('Data telah diarsipkan dan tidak lagi ditampilkan.');
    }catch(err){console.error('SIPANDAI archive failed',err);toast('Gagal menghapus: '+err.message,true);}finally{busy(false);}return;
  }
  if(action==='edit-journal'){editJournal(b.dataset.id);return;}
  if(action==='clear-journal'){const f=$('#journal-form');if(f){f.reset();f.elements.id.value='';}return;}
  if(action==='score-note-toggle'){
    const row=b.closest('.assess-score-row');const field=row?.querySelector('.assess-note-expanded');
    if(!field)return;
    const show=field.hidden;
    field.hidden=!show;b.setAttribute('aria-expanded',String(show));
    b.classList.toggle('is-open',show);
    if(show)field.querySelector('.score-note')?.focus({preventScroll:true});
    return;
  }
  if(action==='assessment-close-modal'){closeAssessmentModal();return;}
  if(action==='assessment-ui-tab'){
    if(b.dataset.tab==='form'&&!canRecord())return;
    ASSESS_UI.tab=b.dataset.tab==='form'?'form':'list';renderAssessments();return;
  }
  if(action==='assessment-page'){ASSESS_UI.page=Math.max(1,Number(b.dataset.page)||1);paintAssessments();return;}
  if(action==='assessment-reload'){forgetMenuCache('assessmentList');S.v2.assessmentKey=null;renderAssessments();return;}
  if(action==='assessment-detail'){loadAssessmentDetail(b.dataset.id);return;}
  if(action==='edit-assessment'){editAssessment(b.dataset.id);return;}
  if(action==='clear-assessment'){const f=$('#assessment-form');if(f){f.reset();f.elements.id.value='';f.elements.mapelId.disabled=false;}return;}
  if(action==='publish-assessment'){
    const pub=b.dataset.publish==='true';if(!await sipConfirm(pub?'Publikasikan nilai sehingga dapat dilihat orang tua?':'Tarik publikasi agar nilai dapat dikoreksi?',{title:'Konfirmasi publikasi nilai'}))return;
    return v2save('publishAssessment',{id:b.dataset.id,publish:pub});
  }
  if(action==='task-detail'){loadTaskDetail(b.dataset.id);return;}
  if(action==='edit-task'){editTask(b.dataset.id);return;}
  if(action==='clear-task'){const f=$('#task-form');if(f){f.reset();f.elements.id.value='';f.elements.mapelId.disabled=false;}return;}
  if(action==='task-status'){
    if(!await sipConfirm(b.dataset.status==='PUBLISHED'?'Publikasikan tugas untuk orang tua?':'Tutup pengumpulan tugas?',{title:'Konfirmasi status tugas'}))return;
    return v2save('taskStatus',{id:b.dataset.id,status:b.dataset.status});
  }
  if(action==='task-file'){openTaskFile(b.dataset.id);return;}
  if(action==='mobile-more'){toggleMobileMore();return;}
  if(action==='logout'){++sipPrefetchSequence;if(sipPrefetchTimer)clearTimeout(sipPrefetchTimer);tahDashboardUseLegacy=false;busy(true);processMessage('Mengakhiri sesi…');try{if(S.token)await call('logout');}catch(e){}finally{busy(false);}S.token='';S.user=null;S.home=null;S.v2.journalKey=null;S.v2.assessmentKey=null;S.v2.taskKey=null;S.v2.journal=[];S.v2.assessments=[];S.v2.tasks=[];S.progress.report=null;S.progress.lastKey='';PARENT_GRADE_UI.report=null;PARENT_GRADE_UI.key='';PARENT_GRADE_UI.period='ALL';S.menuCache.clear();FAMILY.list=[];FAMILY.students=null;FAMILY.requests=null;FAMILY.query='';FAMILY.classFilter='';clearTahDom();S.needsHome=false;try{sessionStorage.removeItem('sipandai_token');}catch(e){}loginUI();return;}
  if(action==='switch-child'){clearTahDom();S.progress.lastKey='';PARENT_GRADE_UI.report=null;PARENT_GRADE_UI.key='';PARENT_GRADE_UI.period='ALL';++PARENT_GRADE_UI.requestId;S.childId=b.dataset.id;S.v2.assessmentId='';S.v2.taskId='';S.classId=(S.home.children.find(x=>x.id===S.childId)||{}).classId||S.classId;try{await loadHome();}catch(e){toast(e.message,true);}return;}
  if(action==='confirm-notice'){const result=await submitAction('confirmNotice',{noticeId:b.dataset.id},{refresh:false});if(result){closeNoticeDialog();S.home.notices=S.home.notices.map(x=>x.id===b.dataset.id?{...x,confirmed:true}:x);render();toast('Konfirmasi pengumuman tersimpan.');}return;}
  if(action==='publish-notice')return submitAction('publishNotice',{id:b.dataset.id});
  if(action==='publish-behavior')return submitAction('publishBehavior',{id:b.dataset.id});
  if(action==='load-att'){S.attEdit=false;S.attDate=$('#att-date')?.value||S.home.serverDate;S.attMapel=$('#att-subject')?.value||S.attMapel;S.sessionNo=$('#att-session')?.value||'1';S.pendingAttendance=null;$('#att-content').innerHTML=loader();return loadAttendance(true);}
  if(action==='verify-attendance'){
    const pending=S.pendingAttendance;if(!pending||S.busy)return;
    try{busy(true);processMessage('Memeriksa status absensi…');const r=await call('attendance',pending.context);
      if(savedAttendanceMatches(r,pending.rows)){attendanceSavedUi(r,pending.rows,pending.context);toast('Absensi tersimpan.');}
      else toast('Absensi belum dapat dikonfirmasi. Jika masih belum tersimpan, Anda dapat mencoba simpan lagi.',true);
    }catch(e){toast(e.message,true);}finally{busy(false);}return;
  }
  if(action==='select-att-status'){
     const card=b.closest('.att-student');const select=card?.querySelector('.att-status');if(!select||select.disabled)return;
     select.value=b.dataset.status;card.querySelectorAll('.att-choice-btn').forEach(btn=>{const active=btn.dataset.status===select.value;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));});return;
   }
   if(action==='toggle-att-note'){const field=b.closest('.att-student')?.querySelector('.att-note-container');if(field){field.style.display=field.style.display==='none'?'block':'none';if(field.style.display==='block')field.querySelector('input')?.focus();}return;}
   if(action==='all-present'){document.querySelectorAll('.att-status:not(:disabled)').forEach(s=>{s.value='H';const card=s.closest('.att-student');card?.querySelectorAll('.att-choice-btn').forEach(btn=>{const active=btn.dataset.status==='H';btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));});});toast('Semua siswa ditandai Hadir. Jangan lupa simpan.');return;}
  if(action==='view-file')return openBehaviorFile(b.dataset.id);
  if(action==='review-link'){if(!await sipConfirm('Pastikan hubungan keluarga telah diverifikasi. Lanjutkan?',{title:'Verifikasi hubungan keluarga'}))return;const result=await submitAction('reviewRequest',{id:b.dataset.id,status:b.dataset.status},{refresh:false});if(result){FAMILY.requests=null;FAMILY.tab='requests';await loadFamilyRequests(true);FAMILY.list=[];forgetMenuCache('parents');}return;}
  if(action==='reset-user'){if(!await sipConfirm('Reset password akun ini? Sesi lama akan dibatalkan.',{title:'Reset password',confirmText:'Ya, reset password',danger:true}))return;return submitAction('resetPassword',{userId:b.dataset.id},{credentials:true,refresh:false});}
  if(action==='copy-credential'){try{await navigator.clipboard.writeText(b.dataset.value);toast('Kredensial disalin. Sampaikan secara pribadi.');}catch(e){toast('Gagal menyalin otomatis. Silakan salin teks kredensial.',true);}return;}
});
document.addEventListener('input',ev=>{
 if(ev.target.id==='assessment-search'){ASSESS_UI.query=ev.target.value;ASSESS_UI.page=1;paintAssessments();return;}
 if(ev.target.id==='user-search'){USER_UI.query=ev.target.value;USER_UI.page=1;paintUserList();return;}
 if(ev.target.id==='student-search'){STUDENT_UI.query=ev.target.value;STUDENT_UI.page=1;paintStudentList();return;}
 if(ev.target.id==='family-search'){FAMILY.query=ev.target.value;FAMILY.page=1;paintFamilyList();}
 if(ev.target.id==='family-parent-query'){FAMILY.parentQuery=ev.target.value;FAMILY.selectedParentId='';updateFamilyParentChoices();}
});
document.addEventListener('change',ev=>{
 if(ev.target.id==='parent-grade-period'){PARENT_GRADE_UI.period=ev.target.value;if(PARENT_GRADE_UI.report)paintParentGrades(PARENT_GRADE_UI.report);return;}
 if(['assessment-filter-subject','assessment-filter-status','assessment-filter-type'].includes(ev.target.id)){const key=({'assessment-filter-subject':'subject','assessment-filter-status':'status','assessment-filter-type':'type'})[ev.target.id];ASSESS_UI[key]=ev.target.value;ASSESS_UI.page=1;paintAssessments();return;}
 if(ev.target.id==='family-class'){FAMILY.classFilter=ev.target.value;FAMILY.page=1;paintFamilyList();return;}
 if(ev.target.id==='family-link-class'){FAMILY.linkClassId=ev.target.value;void updateFamilyStudentChoices();return;}
 if(ev.target.id==='family-parent-select'){FAMILY.selectedParentId=ev.target.value;return;}
 if(['att-date','att-subject','att-session'].includes(ev.target.id)){changeAttendanceSelection();return;}
 if(ev.target.id==='progress-student'){S.progress.studentId=ev.target.value;loadProgress();return;}if(ev.target.id==='task-pick-student'){loadTaskDetail(S.v2.taskId,ev.target.value);return;}if(ev.target.id==='switch-class'){clearTahDom();S.progress.lastKey='';S.classId=ev.target.value;S.v2.assessmentId='';S.v2.taskId='';S.attMapel='';S.att=null;S.attEdit=false;setContent(head('Menyiapkan kelas', 'Memuat data dan pengampu kelas yang dipilih…')+loader());loadHome().catch(e=>toast(e.message,true));}if(ev.target.id==='att-mode'){S.attMode=ev.target.value;S.att=null;S.attEdit=false;S.pendingAttendance=null;renderAttendance();}});
(async()=>{if(!S.token){loginUI();return;}try{await loadHome();prefetchTodayAttendance();prefetchTahfidz();}catch(e){S.token='';try{sessionStorage.removeItem('sipandai_token');}catch(x){}loginUI();toast('Sesi berakhir. Silakan login kembali.',true);}})();

/* SIPANDAI v4.10 — Cetak horizontal dan Excel asli untuk e-Rapor. */
let printableData=null;
const PRINT_TITLES={tahfidzStudent:'Laporan Tahfidz Siswa',tahfidzClass:'Rekap Tahfidz Kelas',students:'Daftar Siswa',attendance:'Rekap Absensi',journal:'Jurnal Pembelajaran',scores:'Daftar Nilai Asesmen',tasks:'Rekap Penugasan',behaviors:'Catatan Perilaku',progress:'Laporan Perkembangan Belajar'};
const PRINT_GROUPS=[
 {id:'akademik',icon:'▤',title:'Akademik',description:'Daftar siswa, jurnal, nilai, dan rekap penugasan.',types:['students','journal','scores','tasks']},
 {id:'kehadiran',icon:'▦',title:'Kehadiran',description:'Rekap kehadiran harian dan per mapel dalam bentuk horizontal.',types:['attendance']},
 {id:'tahfidz',icon:'◉',title:'Tahfidz',description:'Laporan hafalan individu dan rekap kelas.',types:['tahfidzStudent','tahfidzClass']},
 {id:'perkembangan',icon:'◴',title:'Perkembangan',description:'Laporan perkembangan belajar individual.',types:['progress']},
 {id:'pembinaan',icon:'♡',title:'Pembinaan',description:'Rekap apresiasi dan catatan perilaku.',types:['behaviors']}
];
let PRINT_ACTIVE='akademik';
function printGroups(){return role('ORANG_TUA')?[]:PRINT_GROUPS;}
function printActiveGroup(){return printGroups().find(g=>g.id===PRINT_ACTIVE)||printGroups()[0];}
function printTypeOptions(group){return group.types.map(t=>`<option value="${t}">${E(PRINT_TITLES[t])}</option>`).join('');}
function printSubjectOptions(includeAll=false){
 const ss=role('GURU_MAPEL')?(S.home?.subjects||[]):(S.home?.classSubjects||S.home?.subjects||[]);
 return (includeAll?'<option value="">Semua mata pelajaran</option>':'')+ss.map(s=>`<option value="${E(s.id)}">${E(s.name)}</option>`).join('');
}
function renderPrinting(){
 if(role('ORANG_TUA')){S.view='dashboard';renderDashboard();return;}
 const k=S.home?.students||[],today=S.home?.serverDate||new Date().toISOString().slice(0,10);
 const month=Number(today.slice(5,7)),semesterStart=today.slice(0,4)+(month>=7?'-07-01':'-01-01');
 const group=printActiveGroup();if(!group)return;PRINT_ACTIVE=group.id;
 let body=head('Cetak & Laporan','Atur format, pratinjau, lalu cetak atau unduh Excel.');
 body+=`<nav class="module-tabs print-tabs" aria-label="Kategori laporan">${printGroups().map(g=>`<button type="button" class="module-tab ${g.id===PRINT_ACTIVE?'active':''}" data-action="print-tab" data-tab="${g.id}" aria-current="${g.id===PRINT_ACTIVE?'page':'false'}"><span aria-hidden="true">${g.icon}</span>${g.title}</button>`).join('')}</nav>`;
 body+=`<div class="card print-settings"><div class="panel-title">Pengaturan laporan</div><form id="print-form"><div class="print-filter-grid">
 <div class="field" data-print-field="type"><label class="label">Jenis dokumen</label><select name="type" id="print-type">${printTypeOptions(group)}</select></div>
 <div class="field" data-print-field="scoreMode"><label class="label">Bentuk daftar nilai</label><select name="scoreMode" id="print-score-mode"><option value="MAPEL">Per mata pelajaran</option><option value="SISWA">Per siswa (rekap mapel)</option></select></div>
 <div class="field" data-print-field="student"><label class="label">Siswa</label><select name="studentId" id="print-student">${fillOptions(k,k[0]?.id||'','Pilih siswa')}</select></div>
 <div class="field" data-print-field="mapel"><label class="label">Mata pelajaran</label><select name="mapelId" id="print-mapel">${printSubjectOptions()}</select></div>
 <div class="field" data-print-field="date"><label class="label">Tanggal awal</label><input type="date" name="from" value="${E(semesterStart)}"></div>
 <div class="field" data-print-field="date"><label class="label">Tanggal akhir</label><input type="date" name="to" value="${E(today)}"></div>
 <div class="field" data-print-field="mode"><label class="label">Jenis absensi</label><select name="mode" id="print-att-mode">${role('GURU_MAPEL')?'':'<option value="HARIAN">Absensi harian</option>'}<option value="MAPEL">Absensi per mapel</option></select></div>
 <div class="field" data-print-field="period"><label class="label">Bulan Tahfidz</label><input type="month" name="period" value="${E(today.slice(0,7))}"></div>
 </div><div class="actions"><button type="submit" class="btn btn-primary">Buat Pratinjau</button></div><p id="print-filter-hint" class="hint"></p></form></div>`;
 body+=`<div id="print-preview" class="card section-gap">${empty('Pilih laporan, lalu klik Buat Pratinjau.')}</div>`;
 setContent(body);updatePrintFields();
}
function updatePrintFields(){
 const f=document.getElementById('print-form');if(S.view!=='printing'||!f)return;
 const type=f.elements.namedItem('type')?.value||'';
 const mode=f.elements.namedItem('mode')?.value||'HARIAN';
 const sm=f.elements.namedItem('scoreMode')?.value||'MAPEL';
 const display={student:['progress','tahfidzStudent'].includes(type)||(type==='scores'&&sm==='SISWA'),date:['attendance','journal','scores','tasks','behaviors'].includes(type),mode:type==='attendance',scoreMode:type==='scores',mapel:(type==='scores'&&sm==='MAPEL')||(type==='attendance'&&mode==='MAPEL'),period:type==='tahfidzClass',type:true};
 f.querySelectorAll('[data-print-field]').forEach(el=>{el.hidden=!display[el.dataset.printField];});
 const mapel=f.elements.namedItem('mapelId');
 if(mapel&&type==='attendance'&&mode==='MAPEL'){
  const current=mapel.value;
  mapel.innerHTML=printSubjectOptions(true);
  mapel.value=current||'';
 }else if(mapel&&type==='scores'&&sm==='MAPEL'){
  const current=mapel.value;
  mapel.innerHTML=printSubjectOptions(false);
  if(current&&[...mapel.options].some(x=>x.value===current))mapel.value=current;
 }
 const hint=$('#print-filter-hint');if(hint)hint.textContent=type==='scores'?'AH dibuat otomatis sesuai jumlah asesmen. Proyek masuk Rerata Harian; ASTS/ASAS/ASAT terpisah.':type==='attendance'?'Satu siswa per baris, tanggal menjadi kolom. Sel kosong berarti belum ada absensi.':' ';
}
function switchPrintTab(id){
 const group=printGroups().find(g=>g.id===id);if(!group)return;
 PRINT_ACTIVE=id;
 document.querySelectorAll('.print-tabs .module-tab').forEach(b=>{const active=b.dataset.tab===id;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
 const select=$('#print-type');if(select)select.innerHTML=printTypeOptions(group);
 updatePrintFields();printableData=null;
 const preview=$('#print-preview');if(preview)preview.innerHTML=empty('Kategori diubah. Buat pratinjau untuk laporan yang dipilih.');
}
/* Format cetak SIPANDAI: tampilan A4/A4 landscape tergantung jenis laporan. */
function sipDocShell(title,subtitle,content,meta='',wide=false){
 const stamp=new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
 return `<article class="sip-doc${wide?' sip-doc-wide':''}"><header class="sip-doc-head"><div class="sip-doc-brand"><img class="sip-doc-symbol" src="./icons/sipandai-logo6-256.png" alt="Logo SIPANDAI"><div><b>SIPANDAI</b><small>Informasi Pembelajaran & Pendampingan Anak</small></div></div><span class="sip-doc-type">LAPORAN SEKOLAH</span></header>
 <section class="sip-doc-title"><p class="sip-doc-eyebrow">Rekap pembelajaran</p><h1>${E(title)}</h1><p>${E(subtitle)}</p></section>
 ${meta?`<div class="sip-doc-meta">${meta}</div>`:''}${content}
 <footer class="sip-doc-footer"><span>Dicetak dari SIPANDAI · ${E(stamp)}</span><span>Dokumen internal sekolah; data sesuai pencatatan pada sistem</span></footer></article>`;
}
function sipMetric(label,number,help='') {return `<div class="sip-doc-metric"><span>${E(label)}</span><b>${E(number)}</b>${help?`<small>${E(help)}</small>`:''}</div>`;}
function sipSection(title,body){return `<section class="sip-doc-card"><h2>${E(title)}</h2>${body}</section>`;}
function sipMiniBar(value){return `<div class="sip-doc-bar"><span style="width:${Math.min(100,Math.max(0,Number(value)||0))}%"></span></div>`;}
function printTable(data){
 const table=`<div class="sip-doc-table-scroll"><table class="sip-print-table"><thead><tr>${data.headers.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${data.rows.map(row=>`<tr>${row.map(c=>`<td>${E(c??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return sipDocShell(PRINT_TITLES[data.type]||'Laporan SIPANDAI',`Kelas ${data.className||'-'}`,sipSection('Rincian data',table),`<div><strong>${E(data.from||'Semua tanggal')}</strong><small>Dari</small></div><div><strong>${E(data.to||'Sekarang')}</strong><small>Sampai</small></div><div><strong>${data.rows.length}</strong><small>Baris data</small></div>`);
}
/* SIPANDAI v4.11: matriks absensi dengan total, layout cetak tanpa halaman kop kosong. */
/* SIPANDAI v4.11.1: rekap kehadiran per 24 tanggal dan maksimal 30 siswa per lembar A4 landscape. */
function printAttendanceWorkbook(data){
 const sheets=data.sheets||[],pages=[];
 const printDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x;
 const period=[printDate(data.from)||'Semua tanggal',printDate(data.to)||'Sekarang'].join(' – ');
 const when=new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
 sheets.forEach(sheet=>{
  const headers=sheet.headers||[],rows=sheet.rows||[];
  const fixed=3,dates=Number(sheet.attendanceLayout?.dateColumns)||0,summary=Number(sheet.attendanceLayout?.summaryColumns)||4;
  const summaries=Array.from({length:summary},(_,i)=>headers.length-summary+i)
      .filter(i=>!/^keterangan$/i.test(String(headers[i]||'')));
  const daily=Math.max(1,Math.ceil(dates/24)),studentPages=Math.max(1,Math.ceil(rows.length/30));
  for(let part=0;part<daily;part++){
   const ids=[0,1,2,...Array.from({length:Math.min(24,dates-part*24)},(_,i)=>fixed+part*24+i),...summaries];
   const nDates=ids.length-fixed-summaries.length;
   for(let batch=0;batch<studentPages;batch++){
    const selected=rows.slice(batch*30,batch*30+30);
    const isFirst=part===0&&batch===0;
    const heading=data.mode==='MAPEL'?(sheet.title||sheet.name||'Absensi Mapel'):'Rekap Absen Harian';
    const suffix=(daily*studentPages)>1?` <small>Bagian ${part+1}/${daily} · Siswa ${batch*30+1}–${Math.min(rows.length,batch*30+30)}</small>`:'';
    // Identitas siswa dan rekap selalu diulang pada semua potongan tanggal.
    const th=`<tr><th rowspan="2" class="col-no">No</th><th rowspan="2" class="col-nis">NIS</th><th rowspan="2" class="col-name">Nama Siswa</th>${nDates?`<th colspan="${nDates}" class="sip-att-date-group">Tanggal / Bulan</th>`:''}<th colspan="${summaries.length}" class="sip-att-total-group">Rekap Kehadiran</th></tr><tr>${ids.slice(3,3+nDates).map(i=>`<th class="col-date">${E(headers[i])}</th>`).join('')}${summaries.map(i=>`<th class="col-total">${E(headers[i])}</th>`).join('')}</tr>`;
    const body=selected.map(row=>`<tr>${ids.map(i=>{
      const value=i>=fixed&&i<fixed+dates?({Hadir:'H',Sakit:'S',Izin:'I',Alpa:'A'}[row[i]]||row[i]||''):row[i];
      const klass=i===0?'col-no':i===1?'col-nis':i===2?'col-name':i<fixed+dates?'col-date':'col-total';
      return `<td class="${klass}">${E(value??'')}</td>`;
    }).join('')}</tr>`).join('');
    pages.push(`<article class="sip-doc sip-doc-wide sip-att-page"><div class="sip-att-topline"><div class="sip-att-school"><img src="./icons/sipandai-logo6-256.png" alt=""><div><strong>SIPANDAI</strong><small>Informasi Pembelajaran & Pendampingan Anak</small></div></div><span class="sip-att-label">REKAP PEMBELAJARAN</span></div><div class="sip-att-titleline"><div><h1>${E(heading)}</h1><span>Kelas ${E(data.className||'-')}${suffix}</span></div><div class="sip-att-period">${E(period)}</div></div><table class="sip-att-compact-table"><colgroup><col class="col-no"><col class="col-nis"><col class="col-name">${Array.from({length:nDates},()=>'<col class="col-date">').join('')}${summaries.map(()=>'<col class="col-total">').join('')}</colgroup><thead>${th}</thead><tbody>${body}</tbody></table><footer class="sip-att-footer"><span>H: Hadir · S: Sakit · I: Izin · A: Alpa · Kosong: belum tercatat</span><span>Dicetak ${E(when)}</span></footer></article>`);
   }
  }
 });
 return `<div class="sip-att-pages">${pages.join('')}</div>`;
}
function printWorkbook(data){
 if(data.type==='attendance')return printAttendanceWorkbook(data);
 const isAttendance=false,isScores=data.type==='scores',blocks=[];
 for(const sheet of data.sheets||[]){
  const heads=sheet.headers||[],rows=sheet.rows||[],layout=sheet.scoreLayout||{};
  const fixed=isAttendance?3:isScores?(layout.identityColumns||0):0;
  let partitions;
  if(isAttendance){
   // Empat total kehadiran dan kolom keterangan selalu diulang pada setiap pecahan tanggal.
   const summaryCount=Number(sheet.attendanceLayout?.summaryColumns)||5;
   const trailing=Array.from({length:summaryCount},(_,i)=>heads.length-summaryCount+i);
   const configured=Number(sheet.attendanceLayout?.dateColumns);
   const dateCols=Number.isFinite(configured)?Math.max(0,configured):Math.max(0,heads.length-fixed-summaryCount);
   const datesPerPage=7;
   partitions=Array.from({length:Math.max(1,Math.ceil(dateCols/datesPerPage))},(_,j)=>[
    ...Array.from({length:fixed},(_,i)=>i),
    ...Array.from({length:Math.max(0,Math.min(datesPerPage,dateCols-j*datesPerPage))},(_,k)=>fixed+j*datesPerPage+k),
    ...trailing
   ]);
  }else if(isScores){
   const n=Number(layout.assessmentColumns)||0;
   const maxColumns=data.scoreMode==='SISWA'?10:8;
   const last=Array.from({length:heads.length-fixed-n},(_,i)=>fixed+n+i);
   partitions=Array.from({length:Math.max(1,Math.ceil(n/maxColumns))},(_,j)=>[
    ...Array.from({length:fixed},(_,i)=>i),
    ...Array.from({length:Math.max(0,Math.min(maxColumns,n-j*maxColumns))},(_,k)=>fixed+j*maxColumns+k),
    ...last
   ]);
  }else partitions=[heads.map((_,i)=>i)];
  partitions.forEach((indexes,part)=>{
   let header;
   if(isScores&&layout.assessmentColumns>0){
    const firstCount=fixed,assessCount=indexes.filter(i=>i>=fixed&&i<fixed+layout.assessmentColumns).length;
    const leading=indexes.slice(0,firstCount),trailing=indexes.slice(firstCount+assessCount);
    header=`<tr>${leading.map(i=>`<th rowspan="2">${E(heads[i])}</th>`).join('')}
      ${assessCount?`<th colspan="${assessCount}" class="sip-score-group-title">Jenis Asesmen</th>`:''}
      ${trailing.map(i=>`<th rowspan="2">${E(heads[i])}</th>`).join('')}</tr>
      <tr>${indexes.slice(firstCount,firstCount+assessCount).map(i=>`<th>${E(heads[i])}</th>`).join('')}</tr>`;
   }else if(isAttendance){
    const dCount=indexes.filter(i=>i>=fixed&&i<fixed+(Number(sheet.attendanceLayout?.dateColumns)||0)).length;
    const tail=indexes.slice(fixed+dCount);
    header=`<tr>${indexes.slice(0,fixed).map(i=>`<th rowspan="2">${E(heads[i])}</th>`).join('')}
      ${dCount?`<th colspan="${dCount}" class="sip-att-date-group">Tanggal/Bulan</th>`:''}
      <th colspan="${tail.length}" class="sip-att-total-group">Rekap Kehadiran</th></tr>
      <tr>${indexes.slice(fixed,fixed+dCount).map(i=>`<th>${E(heads[i])}</th>`).join('')}
      ${tail.map(i=>`<th>${E(heads[i])}</th>`).join('')}</tr>`;
   }else header=`<tr>${indexes.map(i=>`<th>${E(heads[i])}</th>`).join('')}</tr>`;
   const body=rows.map(row=>`<tr>${indexes.map(i=>{
     const raw=row[i];let value=isAttendance&&i>=fixed&&i<fixed+(Number(sheet.attendanceLayout?.dateColumns)||0)?({Hadir:'H',Sakit:'S',Izin:'I',Alpa:'A'}[raw]||raw):raw;
     if(isScores&&i===heads.length-(layout.hasFeedback?2:1)&&typeof value==='number')value=value.toLocaleString('id-ID',{maximumFractionDigits:2});
     const isName=(isAttendance||data.scoreMode==='MAPEL')?i===2:i===1;
     const numeric=isScores&&i>=fixed&&i<fixed+Number(layout.assessmentColumns||0)||isScores&&i===heads.length-(layout.hasFeedback?2:1);
     return `<td${isName?' class="sip-print-name"':numeric?' class="sip-score-number"':''}>${E(value??'')}</td>`;
   }).join('')}</tr>`).join('');
   const label=sheet.title||sheet.name||'Rekap';
   const suffix=partitions.length>1?` · Bagian ${part+1}/${partitions.length}`:'';
   blocks.push(`<section class="sip-wide-sheet${isScores?' sip-score-sheet':isAttendance?' sip-att-sheet':''}"><h2>${E(label+suffix)}</h2><div class="sip-doc-table-scroll"><table class="sip-print-table sip-wide-table${isScores?' sip-grade-table':isAttendance?' sip-att-table':''}"><thead>${header}</thead><tbody>${body}</tbody></table></div>
    ${isAttendance?'<p class="sip-doc-small">H = Hadir · S = Sakit · I = Izin · A = Alpa · Kosong = belum tercatat. Sabtu/Minggu dan hari tanpa pencatatan dikecualikan.</p>':''}</section>`);
  });
 }
 if(isScores){
  blocks.push(`<section class="sip-grade-notes"><b>Catatan:</b><div><b>AH</b> = Asesmen Harian; jumlah AH menyesuaikan data yang ada.</div><div><b>Proyek</b> ikut dalam Rerata Harian.</div><div><b>ASAS</b> = Asesmen Akhir Semester (semester ganjil).</div><div><b>ASAT</b> = Asesmen Akhir Tahun (semester genap).</div><div><b>Rerata Harian</b> hanya dari AH dan Proyek yang sudah dinilai.</div></section>`);
 }
 const subtitle=`Kelas ${data.className||'-'}${isAttendance?' · Rekap kehadiran':''}`;
 const printDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x;
 const meta=`<div><strong>${E(printDate(data.from)||'Semua tanggal')}</strong><small>Dari tanggal</small></div><div><strong>${E(printDate(data.to)||'Sekarang')}</strong><small>Sampai tanggal</small></div>`;
 return sipDocShell(data.title||PRINT_TITLES[data.type],subtitle,blocks.join(''),meta,true);
}
function printTahSummary(t){
 if(!t)return '';
 return sipSection('Tahfidz & Murojaah',
 `<div class="sip-doc-stats">${sipMetric('Target tuntas',t.doneTarget+' / '+t.totalTarget+' ayat')}${sipMetric('Hafalan terverifikasi',t.memorizedVerses+' ayat')}${sipMetric('Murojaah',t.murojaahSessions+' sesi',t.murojaahDays+' hari')}</div>
 ${sipMiniBar(t.percentage)}<p class="sip-doc-small">${t.percentage===null?'Target belum ditetapkan':t.percentage+'% dari target kelas telah dituntaskan'}</p>
 <div class="sip-doc-grid">${(t.hafalan||[]).map(x=>`<div class="sip-doc-row"><strong>${E(x.surahName)}</strong><small>${E(x.ranges)} · ${x.count} ayat</small></div>`).join('')||'<p>Belum ada hafalan tercatat.</p>'}</div>`);
}
function printProgress(r,t){const a=r.attendance||{},subjects=r.subjects||[],tasks=r.tasks||{},b=r.behavior||{};
 const stats=`<div class="sip-doc-stats">${sipMetric('Kehadiran',a.percentage===null?'-':a.percentage+'%',`${a.present||0} dari ${a.total||0} hari`)}${sipMetric('Asesmen terpublikasi',r.marksCount||0)}${sipMetric('Tugas selesai',tasks.done||0)}</div>`;
 const scores=sipSection('Perkembangan per Mata Pelajaran',`<div class="sip-doc-grid">${subjects.map(s=>`<div class="sip-doc-subject"><div class="sip-doc-subject-head"><b>${E(s.name)}</b><b>${E(s.average)}</b></div>${sipMiniBar(s.average)}<small>${s.count} asesmen · Terakhir: ${E(s.latest)}</small></div>`).join('')||'<p>Nilai yang sudah dipublikasikan belum tersedia.</p>'}</div>`);
 const notes=sipSection('Catatan dan Pendampingan',`<div class="sip-doc-notes">${(r.notes||[]).filter(x=>x.status==='PUBLISHED').map(x=>`<div><small>${E(x.date)}</small><p>${E(x.note)}</p></div>`).join('')||'<p>Belum ada catatan perkembangan yang dipublikasikan.</p>'}</div>`);
 const summary=sipSection('Aktivitas dan Pembinaan',`<div class="sip-doc-stats">${sipMetric('Tugas perlu perbaikan',tasks.needsRevision||0)}${sipMetric('Tugas belum dikumpulkan',tasks.missing||0)}${sipMetric('Apresiasi perilaku',b.positive||0)}</div>`);
 return sipDocShell('Laporan Perkembangan Belajar',r.student.name,stats+scores+(t?printTahSummary(t):'')+summary+notes+`<p class="sip-doc-disclaimer">${E(r.disclaimer||'Laporan informatif, bukan pengganti rapor resmi.')}</p>`,`<div><strong>${E(r.student.nis)}</strong><small>NIS</small></div><div><strong>${E(r.className)}</strong><small>Kelas</small></div>`);
}
function printTahfidz(r){
 const stats=`<div class="sip-doc-stats">${sipMetric('Target tuntas',r.doneTarget+' / '+r.totalTarget)}${sipMetric('Hafalan tercatat',r.memorizedVerses+' ayat')}${sipMetric('Murojaah terverifikasi',r.murojaahSessions+' sesi',r.murojaahDays+' hari')}</div>`;
 const targets=sipSection('Target Hafalan Kelas & Lanjutan',`<div class="sip-doc-grid">${r.targets.map(t=>`<div class="sip-doc-subject"><div class="sip-doc-subject-head"><strong>${E(t.surahName)} · Ayat ${t.startAyah}–${t.endAyah}${(r.individualTargets||[]).some(x=>x.id===t.id)?' (Lanjutan Individu)':''}</strong><b>${t.done}/${t.count}</b></div>${sipMiniBar(t.count?100*t.done/t.count:0)}<small>${E(t.semester)} ${t.dueDate?'· '+E(t.dueDate):''}</small></div>`).join('')||'<p>Target kelas belum ditentukan.</p>'}</div>`);
 const mastered=sipSection('Hafalan yang Sudah Dimiliki',`<div class="sip-doc-grid">${r.hafalan.map(x=>`<div class="sip-doc-row"><b>${E(x.surahName)} <span>${x.count} ayat</span></b><small>Ayat tuntas: ${E(x.ranges)}</small></div>`).join('')||'<p>Belum ada hafalan yang dinyatakan tuntas.</p>'}</div>`);
 const entries=sipSection('Riwayat Setoran & Murojaah Terbaru',`<table class="sip-print-table"><thead><tr><th>Tanggal</th><th>Kegiatan</th><th>Surah / Ayat</th><th>Hasil</th><th>Arahan Guru</th></tr></thead><tbody>${r.entries.slice(0,25).map(x=>`<tr><td>${E(x.date)}</td><td>${E(tahKinds[x.kind]||x.kind)}</td><td>${E(x.surahName)} ${x.startAyah}–${x.endAyah}</td><td>${E(tahStatuses[x.status]||x.status)}</td><td>${E(x.note)}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada setoran</td></tr>'}</tbody></table>`);
 const awards=r.awards.length?sipSection('Apresiasi dari Guru',r.awards.map(x=>`<div class="sip-doc-highlight"><strong>${E(x.title)}</strong><p>${E(x.note)}</p><small>${E(x.period||x.date)}</small></div>`).join('')):'';
 return sipDocShell('Laporan Tahfidz & Murojaah',r.student.name,stats+targets+mastered+entries+awards+'<p class="sip-doc-disclaimer">Capaian hafalan adalah ayat unik yang telah diverifikasi dan dinyatakan tuntas. Jumlah sesi murojaah tidak menambah hitungan hafalan.</p>',`<div><strong>${E(r.student.nis)}</strong><small>NIS</small></div><div><strong>${E(r.className)}</strong><small>Kelas</small></div>`);
}
function printTahfidzClass(r){
 const target=(r.targets||[]).map(t=>`${t.surahName} ${t.startAyah}–${t.endAyah}`).join(' · ');
 const table=`<table class="sip-print-table"><thead><tr><th>No</th><th>NIS</th><th>Siswa</th><th>Ayat tuntas/target</th><th>Persentase</th><th>Murojaah</th><th>Hari aktif</th></tr></thead><tbody>${r.students.map((x,i)=>`<tr><td>${i+1}</td><td>${E(x.nis)}</td><td>${E(x.name)}</td><td>${x.done}/${x.target}</td><td>${x.percentage??'-'}%</td><td>${x.sessions}</td><td>${x.days}</td></tr>`).join('')}</tbody></table>`;
 return sipDocShell('Rekap Tahfidz & Murojaah Kelas',r.className+' · Bulan '+(r.period||''),sipSection('Daftar Capaian Siswa',table)+`<p class="sip-doc-disclaimer">Rekap berisi catatan setoran yang diverifikasi guru. Gunakan secara internal sebagai dasar pembinaan; hindari mengumumkan peringkat murid.</p>`,`<div><strong>${r.students.length}</strong><small>Siswa</small></div><div><strong>${E(target||'Belum ada target')}</strong><small>Target aktif</small></div>`);
}
function renderPrintDoc(data){
 if(data.kind==='progress')return printProgress(data.report,data.tahfidz);
 if(data.kind==='tahfidzStudent')return printTahfidz(data.report);
 if(data.kind==='tahfidzClass')return printTahfidzClass(data.report);
 if(data.kind==='workbook')return printWorkbook(data);
 return printTable(data);
}
function createPrintable(doc){document.getElementById('sip-print-root')?.remove();const wrap=document.createElement('div');wrap.id='sip-print-root';wrap.innerHTML=doc;document.body.appendChild(wrap);}
function previewPrint(data){
 printableData=data;const wrap=$('#print-preview');if(!wrap)return;
 wrap.innerHTML=`<div class="row-between print-preview-heading"><strong>Pratinjau dokumen</strong><div class="actions"><button type="button" class="btn btn-primary" data-action="print-now">Cetak / Simpan PDF</button>${data.kind==='workbook'?'<button type="button" class="btn" data-action="export-xlsx">Unduh Excel (.xlsx)</button>':data.kind==='table'?'<button type="button" class="btn" data-action="export-csv">Unduh CSV</button>':''}</div></div><div class="sip-print-preview">${renderPrintDoc(data)}</div>`;
}
function printNow(){if(!printableData)return;createPrintable(renderPrintDoc(printableData));window.print();}
function csvCell(x){let v=String(x??'');if(/^[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
function exportCsv(){const d=printableData;if(!d||d.kind!=='table')return;const all=[d.headers,...d.rows].map(row=>row.map(csvCell).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+all],{type:'text/csv;charset=utf-8'});downloadPrintBlob(blob,'SIPANDAI_'+d.type+'.csv');}
function downloadPrintBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function exportXlsx(){
 const d=printableData;if(!d||d.kind!=='workbook')return;
 if(typeof window.SipandaiXlsx!=='function'){toast('Modul Excel belum termuat. Muat ulang aplikasi.',true);return;}
 try{
  const bytes=window.SipandaiXlsx(d.sheets);
  downloadPrintBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`SIPANDAI_${d.type}_${d.mode||d.scoreMode||'rekap'}_${d.from||'semua'}.xlsx`);
 }catch(err){console.error('SIPANDAI Excel',err);toast('Gagal membuat Excel: '+(err.message||'Kesalahan tidak diketahui'),true);}
}
document.addEventListener('submit',async ev=>{
 if(ev.target.getAttribute('id')!=='print-form')return;
 ev.preventDefault();if(role('ORANG_TUA'))return;
 const f=ev.target,fd=Object.fromEntries(new FormData(f).entries());
 if(fd.from&&fd.to&&fd.from>fd.to){toast('Tanggal awal tidak boleh lebih besar dari tanggal akhir.',true);return;}
 try{busy(true);const data=await call('printData',{...fd,classId:S.classId});previewPrint(data);}catch(err){toast('Gagal membuat laporan: '+err.message,true);}finally{busy(false);}
},true);
document.addEventListener('change',ev=>{
 if(S.view==='printing'&&ev.target?.closest?.('#print-form')){
  if(['print-type','print-score-mode','print-att-mode'].includes(ev.target.id))updatePrintFields();
  printableData=null;
  const preview=$('#print-preview');
  if(preview)preview.innerHTML=empty('Filter berubah. Klik Buat Pratinjau untuk laporan terbaru.');
 }
},true);
document.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='print-tab'){ev.preventDefault();switchPrintTab(b.dataset.tab);return;}
 if(b.dataset.action==='print-now'){ev.preventDefault();printNow();return;}
 if(b.dataset.action==='export-csv'){ev.preventDefault();exportCsv();return;}
 if(b.dataset.action==='export-xlsx'){ev.preventDefault();exportXlsx();}
},true);

/* ===== SIPANDAI v3.6 | Modul Tahfidz & Murojaah ===== */
const TAH={key:'',settings:null,klass:null,detail:null,studentId:'',period:'',request:0,tab:'overview',viewClass:'',savedDom:null,studentSubTab:'progress'};
const tahStatuses={TUNTAS:'Tuntas',PENGUATAN:'Lancar, perlu penguatan',PERBAIKAN:'Perlu perbaikan',ULANG:'Mengulang setoran'};
const tahKinds={SETORAN:'Setoran hafalan',MUROJAAH:'Murojaah'};
function tahSurahOptions(selected='78'){
 const list=TAH.settings?.surahs||[];
 return list.map(x=>`<option value="${x.number}" ${String(x.number)===String(selected)?'selected':''}>${x.number}. ${E(x.name)} (${x.verses} ayat)</option>`).join('');
}
function tahSelect(name,label,selected='78'){
 return `<div class="field"><label class="label">${E(label)}</label><select name="${E(name)}" class="tah-surah" required>${tahSurahOptions(selected)}</select></div>`;
}
function tahAyatInputs(start='1',end='10'){
 return `<div class="form-grid"><div class="field"><label class="label">Ayat awal</label><input type="number" min="1" max="286" name="startAyah" value="${E(start)}" required></div><div class="field"><label class="label">Ayat akhir</label><input type="number" min="1" max="286" name="endAyah" value="${E(end)}" required></div></div>`;
}
function tahStudentOptions(selected){
 const list=S.home?.students||[];
 return list.map(x=>`<option value="${E(x.id)}" ${x.id===selected?'selected':''}>${E(x.name)} — ${E(x.nis)}</option>`).join('');
}
function tahTeacherForm(){
 const setting=TAH.settings;if(!setting?.canManage)return '';
 const chosen=new Set(setting.assignedTeacherIds||[]),teachers=(setting.teachers||[]).filter(x=>x.id!==S.user.id);
 return `<div class="card"><div class="panel-title">Guru Tahfidz yang bertugas</div><p class="hint">Guru Kelas selalu dapat mencatat Tahfidz. Pilih Guru Tahfidz tambahan yang memiliki akun aktif. Guru ini juga bisa menerima dan mencatat setoran.</p><div class="stack section-gap">${teachers.length?teachers.map(t=>`<div class="row-between item"><div><b>${E(t.name)}</b><div class="small muted">${E(t.role.replace('_',' '))}</div></div><button type="button" class="btn btn-sm ${chosen.has(t.id)?'btn-danger':'btn-outline'}" data-action="tah-teacher" data-id="${E(t.id)}" data-active="${chosen.has(t.id)?'false':'true'}">${chosen.has(t.id)?'Cabut tugas':'+ Tugaskan'}</button></div>`).join(''):empty('Belum ada akun Guru Tahfidz. Admin perlu membuat akun Guru Mapel terlebih dahulu.')}</div></div>`;
}
function tahIndividualTargetForm(){
 const list=(TAH.klass?.students||[]).filter(x=>x.baseComplete);
 const extras=TAH.settings?.individualTargets||[];
 return `<div class="card section-gap"><div class="panel-title">Target lanjutan khusus siswa</div><p class="hint">Hanya untuk siswa yang sudah tuntas seluruh target kelas. Siswa lain tetap memakai target kelas semula.</p>${!list.length?'<div class="notice">Belum ada siswa yang menuntaskan seluruh target kelas.</div>':`<form id="tah-individual-target-form"><div class="field"><label class="label">Siswa yang memenuhi syarat</label><select name="studentId" required>${list.map(x=>`<option value="${E(x.studentId)}">${E(x.name)} — target kelas tuntas</option>`).join('')}</select></div>${tahSelect('surahNo','Surah target lanjutan')}${tahAyatInputs(1,10)}<div class="form-grid"><div class="field"><label class="label">Semester</label><select name="semester"><option>Ganjil</option><option>Genap</option></select></div><div class="field"><label class="label">Target selesai (opsional)</label><input type="date" name="dueDate"></div></div><div class="field"><label class="label">Catatan (opsional)</label><input name="notes" maxlength="400"></div><button type="submit" class="btn btn-primary">Tambahkan target siswa</button></form>`}<div class="stack section-gap">${extras.map(t=>`<div class="item row-between wrap"><div><b>${E(t.studentName)} — ${E(t.surahName)} ${E(t.startAyah)}–${E(t.endAyah)}</b><div class="small muted">Target lanjutan · Semester ${E(t.semester)}</div></div><button class="btn btn-sm btn-danger" data-action="tah-archive" data-kind="individualTarget" data-id="${E(t.id)}">Arsipkan</button></div>`).join('')||''}</div></div>`;
}
function tahTargetForm(){return `<div class="card"><div class="panel-title">Target hafalan kelas</div><p class="hint">Satu target berlaku untuk seluruh siswa pada kelas aktif; capaian siswa dihitung masing-masing. Bisa membuat lebih dari satu surah.</p><form id="tah-target-form" class="section-gap"><input type="hidden" name="id">${tahSelect('surahNo','Surah target')}${tahAyatInputs(1,40)}<div class="form-grid"><div class="field"><label class="label">Semester</label><select name="semester"><option>Ganjil</option><option>Genap</option></select></div><div class="field"><label class="label">Target selesai (opsional)</label><input type="date" name="dueDate"></div></div><div class="field"><label class="label">Catatan target (opsional)</label><input name="notes" maxlength="400" placeholder="Contoh: target semester ganjil"></div><div class="actions"><button type="submit" class="btn btn-primary">Simpan target kelas</button><button type="reset" class="btn">Target baru</button></div></form><div class="stack section-gap">${(TAH.settings?.targets||[]).map(t=>`<div class="item row-between"><div><b>${E(t.surahName)} · Ayat ${E(t.startAyah)}–${E(t.endAyah)}</b><div class="small muted">Semester ${E(t.semester)} ${t.dueDate?'· Selesai '+E(t.dueDate):''}</div></div><div class="actions"><button class="btn btn-sm" data-action="tah-edit-target" data-id="${E(t.id)}">Edit</button><button class="btn btn-sm btn-danger" data-action="tah-archive" data-kind="target" data-id="${E(t.id)}">Arsipkan</button></div></div>`).join('')||empty('Belum ada target hafalan untuk kelas ini.')}</div></div>`;}
function tahBaselineForm(){return `<div class="card"><div class="panel-title">Catat hafalan yang sudah dimiliki</div><p class="hint">Gunakan untuk hafalan yang telah diverifikasi sebelum masuk SIPANDAI atau sebelum target saat ini. Tidak perlu memasukkan ulang setiap ayat satu per satu.</p><form id="tah-baseline-form"><div class="field"><label class="label">Siswa</label><select name="studentId" required>${tahStudentOptions(TAH.studentId)}</select></div>${tahSelect('surahNo','Surah yang telah dikuasai')}${tahAyatInputs(1,10)}<div class="field"><label class="label">Keterangan</label><input name="note" maxlength="800" placeholder="Contoh: diverifikasi melalui tes awal"></div><button type="submit" class="btn btn-primary">Simpan hafalan awal</button></form></div>`;}
function tahEntryForm(){return `<div class="card" id="tah-entry-card"><div class="panel-title">Catat setoran / murojaah</div><form id="tah-entry-form"><input type="hidden" name="id"><div class="form-grid"><div class="field"><label class="label">Nama siswa</label><select name="studentId" required>${tahStudentOptions(TAH.studentId)}</select></div><div class="field"><label class="label">Tanggal</label><input name="date" type="date" value="${E(S.home?.serverDate||'')}" required></div><div class="field"><label class="label">Jenis kegiatan</label><select name="kind"><option value="SETORAN">Setoran hafalan baru</option><option value="MUROJAAH">Murojaah hafalan</option></select></div>${tahSelect('surahNo','Surah')}</div>${tahAyatInputs(1,10)}<div class="form-grid"><div class="field"><label class="label">Hasil setoran</label><select name="status">${Object.entries(tahStatuses).map(([v,l])=>`<option value="${v}">${E(l)}</option>`).join('')}</select></div><div class="field"><label class="label">Kelancaran</label><select name="fluency"><option value="">Belum dinilai</option><option value="BAIK">Baik</option><option value="CUKUP">Cukup</option><option value="BIMBINGAN">Perlu bimbingan</option></select></div><div class="field"><label class="label">Tajwid</label><select name="tajwid"><option value="">Belum dinilai</option><option value="BAIK">Baik</option><option value="CUKUP">Cukup</option><option value="BIMBINGAN">Perlu bimbingan</option></select></div><div class="field"><label class="label">Makhraj</label><select name="makhraj"><option value="">Belum dinilai</option><option value="BAIK">Baik</option><option value="CUKUP">Cukup</option><option value="BIMBINGAN">Perlu bimbingan</option></select></div></div><div class="field"><label class="label">Catatan dan arahan murojaah untuk rumah</label><textarea name="note" maxlength="1000" placeholder="Contoh: ulangi ayat 1–10 dengan pendampingan orang tua"></textarea></div><div class="field"><label class="label"><input type="checkbox" name="published" checked style="width:auto;min-height:0"> Bagikan catatan ini kepada orang tua</label></div><div class="actions"><button type="submit" class="btn btn-primary">Simpan setoran</button><button type="reset" class="btn">Setoran baru</button></div></form></div>`;}
function tahAwardForm(){return `<div class="card"><div class="panel-title">Apresiasi & reward Tahfidz</div><p class="hint">Apresiasi diberikan oleh guru berdasarkan ketekunan, usaha, dan kualitas murojaah. Saran siswa aktif hanya terlihat oleh guru, bukan papan peringkat publik.</p><form id="tah-award-form"><div class="field"><label class="label">Siswa</label><select name="studentId">${tahStudentOptions(TAH.studentId)}</select></div><div class="form-grid"><div class="field"><label class="label">Judul apresiasi</label><input name="title" maxlength="130" placeholder="Contoh: Istiqamah Murojaah" required></div><div class="field"><label class="label">Periode</label><input name="period" maxlength="80" value="${E((S.home?.serverDate||'').slice(0,7))}"></div></div><div class="field"><label class="label">Alasan dan catatan guru</label><textarea name="note" maxlength="900" placeholder="Contoh: rajin murojaah dengan bacaan yang terus membaik"></textarea></div><label class="label"><input type="checkbox" name="published" checked style="width:auto;min-height:0"> Tampilkan apresiasi pada akun orang tua</label><div class="actions"><button type="submit" class="btn btn-primary">Berikan apresiasi</button></div></form></div>`;}
function tahProgressBar(pct){return `<div class="progress-meter"><span style="width:${Math.max(0,Math.min(100,Number(pct)||0))}%"></span></div>`;}
function tahSuggestNext(r){
 const form=$('#tah-entry-form');if(!form||form.elements.namedItem('id')?.value||form.elements.namedItem('kind')?.value==='MUROJAAH')return;
 for(const target of r.targets||[]){
   const saved=(r.hafalan||[]).find(x=>Number(x.surahNo)===Number(target.surahNo));const have=new Set();
   (saved?.ranges||'').split(',').forEach(part=>{const m=part.trim().match(/^(\d+)(?:[–-](\d+))?$/);if(!m)return;for(let i=Number(m[1]);i<=Number(m[2]||m[1]);i++)have.add(i);});
   for(let a=target.startAyah;a<=target.endAyah;a++)if(!have.has(a)){
      form.elements.namedItem('surahNo').value=String(target.surahNo);
      form.elements.namedItem('startAyah').value=a;
      form.elements.namedItem('endAyah').value=Math.min(a+4,target.endAyah);
      return;
   }
 }
}
function tahEntryList(detail,editable){return (detail.entries||[]).map(x=>`<div class="item"><div class="row-between wrap"><b>${E(tahKinds[x.kind]||x.kind)} · ${E(x.surahName)} ${E(x.startAyah)}–${E(x.endAyah)}</b><span class="small muted">${E(x.date)}</span></div><div class="small muted">${E(tahStatuses[x.status]||x.status)} · Kelancaran: ${E(x.fluency||'—')} · Tajwid: ${E(x.tajwid||'—')} · Makhraj: ${E(x.makhraj||'—')}</div>${x.note?`<p class="small section-gap">${E(x.note)}</p>`:''}${editable?`<div class="actions"><button class="btn btn-sm" data-action="tah-edit-entry" data-id="${E(x.id)}">Edit</button><button class="btn btn-sm btn-danger" data-action="tah-archive" data-kind="entry" data-id="${E(x.id)}">Arsipkan</button></div>`:x.note?`<div class="actions">${x.homeConfirmed?'<span class="pill green">✓ Sudah didampingi di rumah</span>':`<button type="button" class="btn btn-sm btn-outline" data-action="tah-confirm-home" data-id="${E(x.id)}">Konfirmasi pendampingan rumah</button>`}</div>`:''}</div>`).join('')||empty('Belum ada riwayat setoran atau murojaah.');}
function tahDetailMarkup(r){
 const pct=r.percentage;
 return `<div class="card"><div class="row-between wrap"><div><div class="panel-title" style="margin:0">${E(r.student.name)}</div><p class="small muted">NIS ${E(r.student.nis)} · ${E(r.className)}</p></div><span class="pill green">${pct===null?'Belum ada target':pct+'% target'}</span></div><div class="grid grid3 section-gap">${stat('Ayat target tuntas',r.doneTarget+' / '+r.totalTarget)}${stat('Hafalan tercatat',r.memorizedVerses,'Ayat unik lintas surah')}${stat('Murojaah terverifikasi',r.murojaahSessions,r.murojaahDays+' hari berbeda')}</div><div class="section-gap">${tahProgressBar(pct)}</div><p class="hint">Capaian dari hafalan awal terverifikasi dan setoran yang berstatus Tuntas; pengulangan tidak dihitung dua kali.</p></div>
 <div class="grid grid2 section-gap"><div class="card"><div class="panel-title">Target kelas & lanjutan</div><div class="stack">${r.targets.map(t=>`<div class="item"><div class="row-between"><b>${E(t.surahName)} ${t.startAyah}–${t.endAyah}</b>${(r.individualTargets||[]).some(x=>x.id===t.id)?'<small class="pill green">Lanjutan individu</small>':''}<span class="pill">${t.done}/${t.count} ayat</span></div>${tahProgressBar(t.count?100*t.done/t.count:0)}</div>`).join('')||empty('Target belum ditetapkan.')}</div></div>
 <div class="card"><div class="panel-title">Hafalan yang telah dimiliki</div><p class="hint">Daftar ini menampilkan ayat-ayat unik yang telah dinyatakan tuntas, termasuk hafalan sebelum target kelas.</p><div class="stack section-gap">${r.hafalan.map(x=>`<div class="item"><div class="row-between"><b>${E(x.surahName)}</b><span class="pill green">${x.count} ayat</span></div><div class="small muted">Ayat: ${E(x.ranges)}</div></div>`).join('')||empty('Belum ada hafalan terverifikasi yang dicatat.')}</div></div></div>
 <div class="grid grid2 section-gap"><div class="card"><div class="panel-title">Riwayat setoran & murojaah</div><div class="stack">${tahEntryList(r,r.editable)}</div></div><div class="card"><div class="panel-title">Apresiasi & catatan prestasi</div><div class="stack">${r.awards.map(x=>`<div class="item"><span class="pill green">Apresiasi</span><h3 class="section-gap">${E(x.title)}</h3><p class="small">${E(x.note)}</p><div class="small muted">${E(x.period||x.date)}</div>${r.editable?`<button type="button" class="btn btn-sm btn-danger section-gap" data-action="tah-archive" data-kind="award" data-id="${E(x.id)}">Arsipkan apresiasi</button>`:''}</div>`).join('')||empty('Belum ada apresiasi tercatat.')}</div></div></div>`;
}
const TAH_TEACHER_TABS=[
 ['overview','Ringkasan','◫'],['entry','Setoran & Murojaah','▤'],
 ['students','Hafalan Siswa','♧'],['targets','Target & Guru','◎'],
 ['awards','Apresiasi','☆'],['reports','Cetak Laporan','▣']
];
const TAH_PARENT_TABS=[['overview','Ringkasan','◫'],['students','Hafalan','♧'],['entries','Setoran & Apresiasi','☆']];
function tahTabs(parent=false){
 const tabs=parent?TAH_PARENT_TABS:TAH_TEACHER_TABS;
 return `<nav id="tah-tabbar" class="tah-tabs" role="tablist" aria-label="Submenu Tahfidz">${tabs.map(([id,label,icon])=>`<button type="button" class="tah-tab" role="tab" id="tah-tab-${id}" aria-controls="tah-pane-${id}" aria-selected="${TAH.tab===id?'true':'false'}" tabindex="${TAH.tab===id?'0':'-1'}" data-action="tah-tab" data-tab="${id}"><span class="tah-tab-icon" aria-hidden="true">${icon}</span>${E(label)}</button>`).join('')}</nav>`;
}
function tahPane(id,body){return `<section class="tah-pane" role="tabpanel" id="tah-pane-${id}" aria-labelledby="tah-tab-${id}" ${TAH.tab===id?'':'hidden'}>${body}</section>`;}
function tahSwitchTab(tab,options={}){
 const root=$('#tah-main');if(!root)return;
 const button=root.querySelector(`#tah-tab-${tab}`);
 if(!button)return;
 TAH.tab=tab;
 root.querySelectorAll('.tah-tab').forEach(b=>{const active=b.dataset.tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
 root.querySelectorAll('.tah-pane').forEach(p=>{p.hidden=p.id!==`tah-pane-${tab}`;});
 if(options.focus)button.focus({preventScroll:true});
 if(options.scroll)document.querySelector('#tah-tabbar')?.scrollIntoView({behavior:'smooth',block:'start'});
 if(!role('ORANG_TUA')&&(tab==='entry'||(tab==='students'&&TAH.studentSubTab==='progress'))){
  if(!TAH.detail||TAH.detail?.student?.id!==TAH.studentId)tahLoadStudent(false);
  else if(tab==='entry')tahSuggestNext(TAH.detail);
 }
}
/** Submenu Hafalan Siswa: monitoring menjadi tampilan utama, input awal opsional. */
function tahStudentSubTabs(canEdit){
 const current=canEdit&&TAH.studentSubTab==='baseline'?'baseline':'progress';
 TAH.studentSubTab=current;
 const tabs=[['progress','Progres & Monitoring'],...(canEdit?[['baseline','Catat Hafalan Awal']]:[])];
 return `<nav class="tah-student-subtabs" role="tablist" aria-label="Submenu Hafalan Siswa">${tabs.map(([id,label])=>`<button type="button" class="tah-student-subtab" id="tah-student-subtab-${id}" data-action="tah-student-subtab" data-subtab="${id}" role="tab" aria-controls="tah-student-panel-${id}" aria-selected="${current===id?'true':'false'}" tabindex="${current===id?'0':'-1'}">${label}</button>`).join('')}</nav>`;
}
function tahStudentPanel(id,content){
 return `<section class="tah-student-subpane" role="tabpanel" id="tah-student-panel-${id}" aria-labelledby="tah-student-subtab-${id}" ${TAH.studentSubTab===id?'':'hidden'}>${content}</section>`;
}
function tahSwitchStudentSubTab(tab,options={}){
 const root=$('#tah-pane-students');
 if(!root)return;
 const button=root.querySelector(`#tah-student-subtab-${tab}`);
 if(!button)return;
 TAH.studentSubTab=tab;
 root.querySelectorAll('.tah-student-subtab').forEach(b=>{
   const selected=b.dataset.subtab===tab;
   b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;
 });
 root.querySelectorAll('.tah-student-subpane').forEach(p=>{p.hidden=p.id!==`tah-student-panel-${tab}`;});
 if(options.focus)button.focus({preventScroll:true});
 if(tab==='progress'){
   const detailHost=$('#tah-student-detail');
   if(!TAH.detail||TAH.detail?.student?.id!==TAH.studentId)tahLoadStudent(false);
   else if(detailHost&&!detailHost.querySelector('.card'))detailHost.innerHTML=tahDetailMarkup(TAH.detail);
 }
}
function tahParentMarkup(detail){
 const wrap=document.createElement('div');wrap.innerHTML=tahDetailMarkup(detail);
 const pieces=[...wrap.children];
 if(!['overview','students','entries'].includes(TAH.tab))TAH.tab='overview';
 const parts=[pieces[0]?.outerHTML||'',pieces[1]?.outerHTML||'',pieces[2]?.outerHTML||''];
 return tahTabs(true)+tahPane('overview',parts[0])+tahPane('students',parts[1])+tahPane('entries',parts[2]);
}
function renderTahfidz(){
 const parent=role('ORANG_TUA');
 const cache=TAH.savedDom;
 if(cache&&cache.context===tahCacheContext()&&TAH.viewClass===S.classId&&(parent?TAH.detail:TAH.klass&&TAH.settings)){
   const content=$('#content');content.replaceChildren(cache.fragment);TAH.savedDom=null;
   // Tidak ada operasi network; kembali ke tab dan formulir persis seperti sebelum berpindah.
   return;
 }
 if(cache&&cache.context!==tahCacheContext())clearTahDom();
 if(TAH.viewClass!==S.classId){TAH.viewClass=S.classId;TAH.tab='overview';TAH.detail=null;TAH.klass=null;TAH.settings=null;TAH.studentId='';TAH.studentSubTab='progress';}
 TAH.studentId=parent?S.childId:TAH.studentId&&S.home.students?.some(x=>x.id===TAH.studentId)?TAH.studentId:S.home.students?.[0]?.id||'';
 let html=head('Tahfidz',parent?'Pantau hafalan dan perkembangan anak.':'Target, setoran, dan murojaah siswa.');
 html+=`<div id="tah-main">${tahTabs(parent)}${(parent?TAH_PARENT_TABS:TAH_TEACHER_TABS).map(x=>tahPane(x[0],loader())).join('')}</div>`;setContent(html);
 // Setelah halaman dibangun ulang (mis. kelas diganti), data yang masih valid bisa langsung ditampilkan.
 if(!parent&&TAH.settings&&TAH.klass&&TAH.viewClass===S.classId){drawTahTeacher();return;}
 if(parent&&TAH.detail&&TAH.viewClass===S.classId){const el=$('#tah-main');if(el)el.innerHTML=tahParentMarkup(TAH.detail);return;}
 loadTahfidz();
}
async function loadTahfidz(refresh=false){
 const parent=role('ORANG_TUA'),classId=S.classId,studentId=parent?S.childId:TAH.studentId,req=++TAH.request;
 try{
  if(parent){const detail=await cachedCall('tahStudentReport',{classId,studentId},refresh?0:25000);if(req!==TAH.request||S.view!=='tahfidz')return;TAH.detail=detail;$('#tah-main').innerHTML=tahParentMarkup(detail);return;}
  const period=TAH.period||(S.home?.serverDate||'').slice(0,7);
  const {settings,klass}=await fetchTahDashboard({classId,period},refresh?0:45000);
  if(req!==TAH.request||S.view!=='tahfidz'||S.classId!==classId)return;
  TAH.settings=settings;TAH.klass=klass;drawTahTeacher();
  if(TAH.tab==='entry'||(TAH.tab==='students'&&TAH.studentSubTab==='progress'))await tahLoadStudent(false);
 }catch(err){
  console.error('SIPANDAI Tahfidz gagal dimuat:',err);
  const h=$('#tah-main');
  if(h)h.innerHTML=`<div class="notice warning"><b>Tahfidz belum berhasil dimuat.</b><div class="section-gap">${E(err.message)}</div><div class="actions"><button type="button" class="btn btn-outline btn-sm" data-action="tah-refresh">↻ Coba lagi</button></div></div>`;
 }
}
function tahPrintPanel(){
 const students=S.home?.students||[];
 return `<div class="grid grid2"><div class="card"><div class="panel-title">Cetak laporan Tahfidz</div><p class="hint">Pratinjau dibuat dengan format rapi yang sama dengan modul Cetak & Laporan. Pilih laporan siswa atau rekap kelas, lalu simpan sebagai PDF.</p><form id="print-form" class="section-gap"><div class="field"><label class="label">Jenis laporan</label><select id="print-type" name="type"><option value="tahfidzStudent">Laporan Tahfidz Siswa</option><option value="tahfidzClass">Rekap Tahfidz Kelas</option></select></div><div class="field"><label class="label">Siswa untuk laporan individual</label><select name="studentId" id="tah-print-student">${fillOptions(students,TAH.studentId||students[0]?.id||'','Pilih siswa')}</select></div><div class="field" id="print-period-field" style="display:none"><label class="label">Bulan rekap murojaah</label><input type="month" name="period" value="${E(TAH.period||(S.home?.serverDate||'').slice(0,7))}"></div><div class="actions"><button type="submit" class="btn btn-primary">Buat pratinjau</button><button type="button" class="btn btn-outline" data-action="nav" data-view="printing">Menu cetak lainnya</button></div></form></div><div class="card"><div class="panel-title">Dokumen tersedia</div><div class="stack"><div class="item"><b>Laporan Tahfidz Individu</b><p class="hint">Target, capaian hafalan, setoran, murojaah, dan apresiasi.</p></div><div class="item"><b>Rekap Tahfidz Kelas</b><p class="hint">Ringkasan progres tiap siswa dan aktivitas murojaah menurut periode.</p></div></div></div></div><div id="print-preview" class="card section-gap">${empty('Pratinjau laporan muncul di sini setelah memilih Buat pratinjau.')}</div>`;
}
function drawTahTeacher(){
 const k=TAH.klass,rows=k.students||[];
 if(!TAH_TEACHER_TABS.some(x=>x[0]===TAH.tab))TAH.tab='overview';
 const period=TAH.period||(S.home?.serverDate||'').slice(0,7);
 const summary=`<div class="tah-summary-toolbar"><span class="small muted">Aktivitas bulan <b>${E(period)}</b></span><button class="btn btn-sm btn-outline" data-action="tah-refresh">↻ Perbarui</button></div>
 <div class="grid grid3 section-gap">${stat('Siswa dalam kelas',rows.length)}${stat('Target hafalan aktif',(TAH.settings?.targets||[]).length)}${stat('Sesi murojaah tercatat',rows.reduce((s,x)=>s+x.sessions,0))}</div>
 <div class="card section-gap tah-overview-card"><div class="panel-title">Perkembangan seluruh siswa</div><div class="tah-student-summary" role="table" aria-label="Ringkasan hafalan dan murojaah seluruh siswa"><div class="tah-summary-head" role="row"><span role="columnheader">Nama siswa</span><span role="columnheader">Capaian hafalan</span><span role="columnheader">Murojaah</span></div>${rows.map(x=>`<div class="tah-summary-row" role="row"><div class="tah-summary-identity" role="rowheader"><b>${E(x.name)}</b><small>${E(x.nis)}</small></div><div class="tah-summary-hafalan" role="cell"><span class="tah-summary-count">${E(x.done)} / ${E(x.target)} <small>ayat</small></span>${tahProgressBar(x.percentage)}</div><div class="tah-summary-activity" role="cell"><span><strong>${E(x.sessions)}</strong> sesi</span><span><strong>${E(x.days)}</strong> hari</span></div></div>`).join('')||'<div class="tah-summary-empty">Belum ada siswa di kelas ini.</div>'}</div></div>`;
 const readonlyTargets=`<div class="card"><div class="panel-title">Target hafalan kelas</div><div class="stack">${(TAH.settings?.targets||[]).map(t=>`<div class="item"><b>${E(t.surahName)} · ${E(t.startAyah)}–${E(t.endAyah)}</b><div class="small muted">Semester ${E(t.semester)}</div></div>`).join('')||empty('Belum ada target kelas.')}</div></div>`;
 const canEdit=!role('KEPALA_SEKOLAH');
 const targetPanel=canEdit?`<div class="grid grid2">${tahTargetForm()}${tahTeacherForm()}</div>${tahIndividualTargetForm()}`:readonlyTargets;
 const selectedStudent=`<div class="tah-intro-card"><div><b>Riwayat dan hafalan siswa</b><p class="hint">Pilih siswa untuk melihat ayat yang telah tuntas, riwayat setoran, dan apresiasinya.</p></div><div class="tah-compact-select"><label class="label" for="tah-student-select">Pilih siswa</label><select id="tah-student-select">${tahStudentOptions(TAH.studentId)}</select></div></div>`;
 const awardsIntro=`<div class="tah-intro-card"><div><b>Apresiasi & ketekunan</b><p class="hint">Jumlah sesi hanya rekomendasi. Apresiasi tetap mempertimbangkan kualitas bacaan, perkembangan, dan usaha.</p></div><div class="tah-compact-select"><label class="label" for="tah-period">Periode bulan</label><input type="month" id="tah-period" value="${E(period)}"></div></div>`;
 const suggestions=k.appreciationSuggestions.length?`<div class="notice section-gap"><b>Ide apresiasi</b><div class="small">${k.appreciationSuggestions.map(x=>E(x.name)+' ('+x.sessions+' sesi)').join(' · ')}</div><p class="hint">Informasi hanya untuk guru, bukan peringkat siswa yang dipublikasikan.</p></div>`:'';
 const panes=[
 tahPane('overview',summary),
 tahPane('entry',canEdit?tahEntryForm():`<div class="card">${empty('Akses monitoring: pencatatan setoran hanya untuk Guru Kelas atau Guru Tahfidz.')}</div>`),
 tahPane('students',selectedStudent+tahStudentSubTabs(canEdit)+
   tahStudentPanel('progress',`<div id="tah-student-detail">${empty('Pilih siswa untuk memuat riwayat hafalannya.')}</div>`)+
   (canEdit?tahStudentPanel('baseline',tahBaselineForm()):'')),
 tahPane('targets',targetPanel),
 tahPane('awards',awardsIntro+suggestions+(canEdit?`<div class="section-gap">${tahAwardForm()}</div>`:'')),
 tahPane('reports',tahPrintPanel())
 ];
 const el=$('#tah-main');if(el)el.innerHTML=tahTabs(false)+panes.join('');
 const detailHost=$('#tah-student-detail');
 if(detailHost&&TAH.detail?.student?.id===TAH.studentId)detailHost.innerHTML=tahDetailMarkup(TAH.detail);
}
async function tahLoadStudent(refresh=false){
 if(!TAH.studentId){const h=$('#tah-student-detail');if(h)h.innerHTML=empty('Belum ada siswa terdaftar.');return;}
 const studentId=TAH.studentId,classId=S.classId,req=++TAH.request;
 const h=$('#tah-student-detail');if(h)h.innerHTML=loader();
 try{const r=await cachedCall('tahStudentReport',{classId,studentId},refresh?0:20000);if(req!==TAH.request||S.view!=='tahfidz')return;TAH.detail=r;if(h)h.innerHTML=tahDetailMarkup(r);tahSuggestNext(r);}
 catch(e){if(h)h.innerHTML=`<div class="notice warning">${E(e.message)}</div>`;}
}
function tahInvalidate(){forgetMenuCache('tahDashboard','tahSettings','tahClassReport','tahStudentReport','printData');TAH.klass=null;TAH.detail=null;TAH.savedDom=null;}
async function tahSave(action,data){
 try{busy(true);processMessage('Menyimpan catatan Tahfidz…');const r=await call(action,{...data,classId:S.classId});if(!r?.ok)throw new Error('Server tidak mengonfirmasi penyimpanan.');tahInvalidate();if(action==='tahSaveBaseline')TAH.studentSubTab='progress';toast('Catatan Tahfidz berhasil disimpan.');await loadTahfidz(true);return r;}
 catch(e){toast('Tidak tersimpan: '+e.message,true);return null;}finally{busy(false);}
}
function tahEditEntry(id){const entry=TAH.detail?.entries?.find(x=>x.id===id);if(!entry)return;tahSwitchTab('entry');const form=$('#tah-entry-form');if(!form)return;
 ['id','date','studentId','kind','surahNo','startAyah','endAyah','status','fluency','tajwid','makhraj','note'].forEach(k=>{const el=form.elements.namedItem(k);if(el)el.value=entry[k]??'';});form.elements.namedItem('published').checked=entry.published==='YES';form.scrollIntoView({behavior:'smooth',block:'start'});
}
document.addEventListener('submit',async ev=>{
 const f=ev.target,id=f?.getAttribute?.('id');if(!id||!id.startsWith('tah-'))return;
 ev.preventDefault();ev.stopImmediatePropagation();
 if(S.busy){toast('Tunggu proses yang sedang berjalan selesai.');return;}
 const data=fd(f);
 if(data.surahNo){const surah=TAH.settings?.surahs?.find(x=>String(x.number)===String(data.surahNo));if(surah&&(Number(data.startAyah)<1||Number(data.endAyah)<Number(data.startAyah)||Number(data.endAyah)>surah.verses)){toast('Rentang ayat tidak sesuai jumlah ayat surah.',true);return;}}
 if(['tah-target-form','tah-individual-target-form','tah-entry-form','tah-baseline-form','tah-award-form'].includes(id)&&data.studentId)TAH.studentId=data.studentId;
 const actions={'tah-target-form':'tahSaveTarget','tah-individual-target-form':'tahSaveIndividualTarget','tah-entry-form':'tahSaveEntry','tah-baseline-form':'tahSaveBaseline','tah-award-form':'tahSaveAward'};
 if(actions[id])await tahSave(actions[id],{...data,published:!!f.elements.namedItem('published')?.checked});
},true);
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-action]'),action=b?.dataset?.action;if(!action||!action.startsWith('tah-'))return;
 ev.preventDefault();ev.stopImmediatePropagation();
 if(action==='tah-tab'){tahSwitchTab(b.dataset.tab,{focus:true,scroll:false});return;}
 if(action==='tah-student-subtab'){tahSwitchStudentSubTab(b.dataset.subtab,{focus:true});return;}
 if(action==='tah-record-student'){
  TAH.studentId=b.dataset.id;
  ['tah-entry-form','tah-baseline-form','tah-award-form','tah-student-select','tah-print-student'].forEach(id=>{const f=$('#'+id),el=f?.tagName==='SELECT'?f:f?.elements?.namedItem('studentId');if(el)el.value=TAH.studentId;});
  tahSwitchTab('entry',{scroll:true});return;
 }
 if(action==='tah-refresh')return loadTahfidz(true);
 if(action==='tah-confirm-home'){if(!await sipConfirm('Konfirmasi bahwa hafalan pada arahan guru sudah didampingi di rumah?',{title:'Konfirmasi murojaah di rumah'}))return;const id=b.dataset.id;try{busy(true);processMessage('Mencatat pendampingan rumah…');await call('tahConfirmHome',{classId:S.classId,studentId:S.childId,entryId:id});tahInvalidate();toast('Pendampingan di rumah berhasil dikonfirmasi.');await loadTahfidz(true);}catch(err){toast(err.message,true);}finally{busy(false);}return;} 
 if(action==='tah-pick-student'){TAH.studentId=b.dataset.id;['tah-entry-form','tah-baseline-form','tah-award-form'].forEach(id=>{const f=$('#'+id);if(f?.elements.namedItem('studentId'))f.elements.namedItem('studentId').value=TAH.studentId;});const s=$('#tah-student-select');if(s)s.value=TAH.studentId;tahSwitchTab('students',{scroll:true});return tahLoadStudent(false);}
 if(action==='tah-edit-entry')return tahEditEntry(b.dataset.id);
 if(action==='tah-edit-target'){tahSwitchTab('targets');const t=TAH.settings?.targets?.find(x=>x.id===b.dataset.id),f=$('#tah-target-form');if(!t||!f)return;['id','surahNo','startAyah','endAyah','dueDate','semester','notes'].forEach(k=>{const el=f.elements.namedItem(k);if(el)el.value=t[k]??'';});f.scrollIntoView({behavior:'smooth'});return;}
 if(action==='tah-teacher'){const on=b.dataset.active==='true';if(!await sipConfirm((on?'Tugaskan':'Cabut penugasan')+' Guru Tahfidz ini untuk kelas aktif?',{title:'Pemetaan Guru Tahfidz'}))return;return tahSave('tahAssign',{teacherId:b.dataset.id,active:on});}
 if(action==='tah-archive'){if(!await sipConfirm('Data akan disembunyikan dari daftar aktif dan laporan; riwayat audit tetap tersimpan.',{danger:true,title:'Arsipkan catatan Tahfidz',confirmText:'Ya, arsipkan'}))return;return tahSave('tahArchive',{id:b.dataset.id,kind:b.dataset.kind});}
},true);

document.addEventListener('change',ev=>{
 if(ev.target?.id==='tah-period'){TAH.period=ev.target.value;loadTahfidz(true);return;}
 if(ev.target?.id==='tah-student-select'){
   TAH.studentId=ev.target.value;
   ['tah-entry-form','tah-baseline-form','tah-award-form'].forEach(id=>{const f=$('#'+id);if(f?.elements.namedItem('studentId'))f.elements.namedItem('studentId').value=TAH.studentId;});
   if(TAH.tab==='students'&&TAH.studentSubTab==='progress')tahLoadStudent(false);return;
 }
 if(ev.target?.matches('#tah-entry-form [name="studentId"],#tah-baseline-form [name="studentId"],#tah-award-form [name="studentId"]')){
   TAH.studentId=ev.target.value;
   const pick=$('#tah-student-select');if(pick)pick.value=TAH.studentId;
   ['tah-entry-form','tah-baseline-form','tah-award-form'].forEach(id=>{const f=$('#'+id);if(f?.elements.namedItem('studentId'))f.elements.namedItem('studentId').value=TAH.studentId;});
   if(TAH.tab==='entry'||TAH.studentSubTab==='progress')tahLoadStudent(false);
 }
},true);
document.addEventListener('keydown',ev=>{
 const sub=ev.target?.closest?.('.tah-student-subtab');
 if(sub&&['ArrowRight','ArrowLeft','Home','End'].includes(ev.key)){
   const items=[...sub.parentNode.querySelectorAll('.tah-student-subtab')],i=items.indexOf(sub);
   const next=ev.key==='Home'?items[0]:ev.key==='End'?items[items.length-1]:items[(i+(ev.key==='ArrowRight'?1:-1)+items.length)%items.length];
   if(next){ev.preventDefault();tahSwitchStudentSubTab(next.dataset.subtab,{focus:true});}
   return;
 }
 const b=ev.target?.closest?.('.tah-tab');if(!b||!['ArrowRight','ArrowLeft','Home','End'].includes(ev.key))return;
 const list=[...b.parentNode.querySelectorAll('.tah-tab')],idx=list.indexOf(b);
 const next=ev.key==='Home'?list[0]:ev.key==='End'?list[list.length-1]:list[(idx+(ev.key==='ArrowRight'?1:-1)+list.length)%list.length];
 if(next){ev.preventDefault();tahSwitchTab(next.dataset.tab,{focus:true});}
});

document.addEventListener('change',ev=>{if(ev.target?.id==='print-type'){const field=document.getElementById('print-period-field');if(field)field.style.display=ev.target.value==='tahfidzClass'?'block':'none';}},true);

// SIPANDAI v4.6 — Tutup dialog nilai dengan Esc / area luar, tanpa menutup saat penyimpanan berlangsung.
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'&&document.getElementById('assessment-score-modal')){ev.preventDefault();closeAssessmentModal();}
  if(ev.key==='Tab'){
    const modal=document.getElementById('assessment-score-modal');if(!modal)return;
    const controls=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
    if(!controls.length)return;
    if(ev.shiftKey&&document.activeElement===controls[0]){ev.preventDefault();controls.at(-1).focus();}
    else if(!ev.shiftKey&&document.activeElement===controls.at(-1)){ev.preventDefault();controls[0].focus();}
  }
},true);
document.addEventListener('click',ev=>{if(ev.target?.id==='assessment-score-modal')closeAssessmentModal();});

// SIPANDAI v4.9 — pencarian mapel langsung tanpa API tambahan.
document.addEventListener('input',ev=>{
 if(ev.target?.id==='subject-search'){
   SUBJECT_ADMIN.query=ev.target.value;
   paintSubjectList();
 }
});
