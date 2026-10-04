/* HACKER SIM — playable prototype from the 2006 "Hacker simulator.doc" design.
   Covers: console + autosuggest, wired/wireless/laser modems, Oldnet vs Betanet,
   bounces + trace + logs + scramblers, password cracking/exploits/patches,
   email trojans / viruses / zombies / spam money, tasks with CPU/MEM time,
   hardware upgrades with install time, backbone tolls, damaged wires,
   physical movement + physical access, connection map with zoom, NPC traffic,
   hacker-group missions = the doc's Plot/Obstacles. Vanilla JS, no deps. */
'use strict';
const $ = s => document.querySelector(s);
const outEl = $('#term-output'), statusEl = $('#status-body'), invEl = $('#inv-body'),
  actionsEl = $('#actions-body'), notifEl = $('#notif-body'), inputEl = $('#term-input'),
  promptEl = $('#prompt'), suggestRow = $('#suggest-row');

/* ---------------- utils ---------------- */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function print(html, cls){ const d=document.createElement('div'); if(cls)d.className=cls; d.innerHTML=html; outEl.appendChild(d); outEl.scrollTop=outEl.scrollHeight; }
function notify(text, mail){ const d=document.createElement('div'); d.className='notif'+(mail?' mail':''); d.innerHTML=text; notifEl.prepend(d); while(notifEl.children.length>14) notifEl.lastChild.remove(); }
function fmtTime(s){ s=Math.floor(s); const h=String(Math.floor(s/3600)).padStart(2,'0'),m=String(Math.floor(s%3600/60)).padStart(2,'0'),x=String(s%60).padStart(2,'0'); return `${h}:${m}:${x}`; }

/* ---------------- world data ---------------- */
const PROGRAMS = {
  'scan':{price:0,desc:'network tester: finds devices, wires, damage, wireless in range'},
  'crack-basic':{price:0,desc:'dictionary password cracker (slow, noisy)'},
  'crack-pro':{price:120,desc:'rainbow + GPU cracker, 3x faster, quieter'},
  'tracer-view':{price:40,desc:'REQUIRED to see live trace % (doc: tracer viewing requires relevant programs)'},
  'scrambler':{price:90,desc:'confuses tracers: halves trace rate while running'},
  'decrypter':{price:80,desc:'breaks Betanet wireless encryption for downloads'},
  'mem-view':{price:30,desc:'memory viewer: see remote running programs'},
  'log-wipe':{price:25,desc:'wipes YOUR entries from a device log (lowers trace)'},
  'firewall-bypass':{price:110,desc:'exploit kit: one-click vuln exploit, needs target vuln id'},
  'trojan-mailer':{price:70,desc:'send email trojans that steal passwords when opened'},
  'virus':{price:60,desc:'crash a computer (DoS). Illegal, very noisy.'},
  'zombie-kit':{price:100,desc:'zombify a cracked box to send spam for you'},
  'monitor':{price:50,desc:'watchdog: alerts when trace spikes / someone hacks YOU'},
};
const HARDWARE = {
  'cpu-2x':{price:150,desc:'+120 MIPS CPU. install time 45s (pay +$40 to rush)'},
  'mem-512':{price:100,desc:'+512MB RAM (run more tasks). install 30s'},
  'wireless-card':{price:130,desc:'adds wireless modem: reach Betanet / intercept mobile traffic'},
  'laser-modem':{price:220,desc:'adds laser modem: fast backbone, no damage'},
};

/* Filesystem = flat path->text. Directories derived. */
function FS(files){ return Object.assign({}, files); }
const DEVICES = {
  'home-pc':{name:'home-pc',net:'old',kind:'workstation',x:120,y:210,range:0,traceRate:0,
    desc:'Your box. No different to others (doc) — CAN be hacked if careless.',
    hw:{cpu:100,mem:512,modems:['wired']},users:[{u:'me',p:'',home:'/home/me'}],
    fs:FS({'/readme.txt':'WELCOME.\nThe Betanet replaced the internet. The Oldnet (wired, rotting) is all we have left.\nType: help | missions | scan\n— dead-drop from cell K','/home/me/downloads/.keep':'','/etc/users.db':'me::admin\n','/etc/startup.msg':'home-pc login: me (no password locally)'}),
    vulns:[],logs:[],localOnly:true},
  'old-router':{name:'old-router',net:'old',kind:'node / exchange',x:230,y:170,range:0,traceRate:0.4,
    desc:'Street exchange. Relays wires. Keeps logs (doc).',hw:{cpu:60,mem:128,modems:['wired']},
    users:[],fs:FS({'/etc/log.txt':'[ambient] relay traffic…','/etc/wires.map':'home-pc <-> old-router OK\nold-router <-> rusty-archive OK\nold-router <-> dead-forum OK\nold-router <-> hacker-hq DAMAGED (packet loss)'}),
    vulns:[{id:'relay-leak',desc:'log disclosure',sev:1}],logs:[]},
  'rusty-archive':{name:'rusty-archive',net:'old',kind:'server (info site)',x:330,y:110,range:0,traceRate:1.2,
    desc:'Abandoned info site. Tips about Betanet structure.',hw:{cpu:80,mem:256,modems:['wired']},
    users:[{u:'archivist',p:'retrospect',home:'/home/archivist'}],
    fs:FS({'/pub/betanet-notes.txt':'BETANET: wireless, encrypted, gov watched.\nLaser backbone between towers. Toll per hop.\nTo hack it you need wireless + decrypter.\nBounce Oldnet->gateway->Betanet to stretch trace time.','/pub/tips.txt':'TIP: crack is CPU-bound. Better CPU = faster. crack-pro 3x.\nTIP: bounce through 3+ boxes. Each hop +trace time.\nTIP: always wipe logs after.','/home/archivist/mail.txt':'from:cell-K: kid, the old wires to hacker-hq are damaged. scan shows it. push through anyway.'}),
    vulns:[{id:'phf-24',desc:'old CGI exploit',sev:2}],logs:[]},
  'dead-forum':{name:'dead-forum',net:'old',kind:'workstation (power user)',x:350,y:250,range:0,traceRate:1.0,
    desc:'Power user box. Neutral. Has spam contacts worth stealing.',hw:{cpu:70,mem:256,modems:['wired']},
    users:[{u:'leecher',p:'password123',home:'/home/leecher'}],
    fs:FS({'/home/leecher/contacts.db':'spam-list: 4000 addresses (sellable)\n','/home/leecher/shared/mixtape.zip':'[binary junk]','/etc/users.db':'leecher:password123'}),
    vulns:[{id:'smtp-overflow',desc:'mail daemon overflow',sev:2}],logs:[]},
  'hacker-hq':{name:'hacker-hq',net:'both',kind:'server (your cell)',x:470,y:170,range:140,traceRate:0.8,
    desc:'CELL K headquarters. GATEWAY Oldnet<->Betanet (right HW+SW, per doc). Friendly.',hw:{cpu:200,mem:1024,modems:['wired','wireless','laser']},
    users:[{u:'cell-k',p:'oldnet-lives',home:'/home/cell-k'}],
    fs:FS({'/ops/mission-board.txt':'see missions command. we take care of our own.','/ops/betanet-leak.txt':'Beta handshake leaks addresses when laser relays congest. Use mem-view on tower then decrypter.','/tools/.keep':''}),
    vulns:[],logs:[],gateway:true},
  'cafe-laptop':{name:'cafe-laptop',net:'both',kind:'laptop (mobile)',x:200,y:330,range:110,traceRate:0.6,
    desc:'Left logged in at the cafe. PDA-like: often NOT password protected (doc). Physical access = free.',hw:{cpu:60,mem:256,modems:['wireless']},
    users:[{u:'tourist',p:'',home:'/home/tourist'}],
    fs:FS({'/home/tourist/cookies.txt':'betanet session tokens…','/home/tourist/photo.jpg':'[cat photo]'}),
    vulns:[{id:'open-share',desc:'open file share',sev:1}],logs:[],physicalAt:'cafe'},
  'relay-van':{name:'relay-van',net:'both',kind:'mobile intercept',x:420,y:320,range:170,traceRate:1.5,
    desc:'Rival crew van. Intercepts wireless. Crack it to bounce deep into Betanet.',hw:{cpu:120,mem:512,modems:['wireless','laser']},
    users:[{u:'wheelman',p:'midnight',home:'/home/wheelman'}],
    fs:FS({'/home/wheelman/routes.txt':'tower-1 <-> tower-2 laser, toll $5/hop\ncorp-shop always pays invoices…','/intercept/log.txt':'[wireless intercepts — need mem-view + decrypter]'}),
    vulns:[{id:'beta-handshake-leak',desc:'wireless handshake leak',sev:3}],logs:[],gateway:true},
  'beta-tower-1':{name:'beta-tower-1',net:'beta',kind:'laser backbone',x:600,y:120,range:220,traceRate:2.0,toll:5,
    desc:'Betanet laser backbone tower. Fast. Charges per transit (doc).',hw:{cpu:300,mem:512,modems:['wireless','laser']},
    users:[{u:'netops',p:'laserline',home:'/home/netops'}],
    fs:FS({'/etc/backbone.map':'tower-1 <-> tower-2 (laser, fast)\ntower-1 <-> corp-shop, corp-bank\ntower-2 <-> gov-monitor','/etc/log.txt':'[backbone relay log]'}),
    vulns:[{id:'beta-handshake-leak',desc:'laser congestion leak',sev:2}],logs:[]},
  'beta-tower-2':{name:'beta-tower-2',net:'beta',kind:'laser backbone',x:710,y:250,range:220,traceRate:2.0,toll:5,
    desc:'Betanet laser backbone tower #2.',hw:{cpu:300,mem:512,modems:['wireless','laser']},
    users:[{u:'netops',p:'laserline',home:'/home/netops'}],
    fs:FS({'/etc/backbone.map':'tower-2 <-> tower-1, gov-monitor, corp-bank','/etc/log.txt':'[backbone relay log]'}),
    vulns:[{id:'beta-handshake-leak',desc:'laser congestion leak',sev:2}],logs:[]},
  'corp-shop':{name:'corp-shop',net:'beta',kind:'server (commercial)',x:600,y:300,range:130,traceRate:4.0,
    desc:'Betanet storefront. Pays invoices. Heavily monitored.',hw:{cpu:150,mem:512,modems:['wireless']},
    users:[{u:'vendor',p:'sellmore',home:'/home/vendor'}],
    fs:FS({'/corp/pricelist.db':'PRICELIST (steal me for mission 3)\nwidget: $12\nzero-day: $9999\n','/corp/invoices.txt':'unpaid: dead-forum $20\n','/etc/users.db':'vendor:sellmore'}),
    vulns:[{id:'smtp-overflow',desc:'mail overflow',sev:2}],logs:[]},
  'corp-bank':{name:'corp-bank',net:'beta',kind:'server (bank)',x:770,y:140,range:140,traceRate:6.0,
    desc:'Corporate bank. Spam money flows here. Monitor watches it.',hw:{cpu:250,mem:1024,modems:['wireless','laser']},
    users:[{u:'teller',p:'vault9',home:'/home/teller'}],
    fs:FS({'/bank/accounts.txt':'cell-K escrow: $40\nvendor balance: $1200\n','/bank/transfers.log':'[monitored]'}),
    vulns:[{id:'vault-escape',desc:'transfer escape',sev:3}],logs:[]},
  'gov-monitor':{name:'gov-monitor',net:'beta',kind:'SUPERCOMPUTER + firewall',x:830,y:300,range:190,traceRate:12.0,
    desc:'GOVERNMENT tracer. Locates + arrests (doc). Touch briefly or not at all.',hw:{cpu:1000,mem:4096,modems:['wireless','laser']},
    users:[{u:'agent',p:' eyes-only-changeme ',home:'/home/agent'}],
    fs:FS({'/wanted/cell-k.txt':'SUBJECTS: cell-K. Shutdown Oldnet. Arrest wrongdoers. Destroy devices (doc).','/filter/behaviour.rules':'flag: crack, exploit, virus, zombie, >3 bounces'}),
    vulns:[{id:'zero-day',desc:'unknown (need firewall-bypass + decrypter)',sev:4}],logs:[]},
};
const WIRES = [ // [a,b,damaged]
  ['home-pc','old-router',false],['old-router','rusty-archive',false],
  ['old-router','dead-forum',false],['old-router','hacker-hq',true],
  ['beta-tower-1','beta-tower-2',false],
  ['rusty-archive','dead-forum',false],['dead-forum','hacker-hq',false],
];
const PLACES = {
  'home':{desc:'your flat. home-pc here. bus stop outside.',devices:['home-pc'],x:120,y:210},
  'street':{desc:'street with old copper junction (old-router cabinet).',devices:[],x:230,y:170},
  'datacenter':{desc:'abandoned datacenter: rusty-archive, dead-forum racks hum.',devices:[],x:340,y:180},
  'hideout':{desc:'cell-K hideout: hacker-hq server in the back.',devices:['hacker-hq'],x:470,y:170},
  'cafe':{desc:'cafe with open wifi. A tourist left cafe-laptop OPEN (physical access!).',devices:['cafe-laptop'],x:200,y:330},
  'downtown':{desc:'downtown under the laser towers. Backbone toll booths blink.',devices:[],x:650,y:200},
};
const MISSIONS = [
  {id:0,title:'Get on the Oldnet',brief:'Run scan, then list + view files on rusty-archive (connect rusty-archive).',check:s=>s.flags.scanned&&s.flags.visited.has('rusty-archive')},
  {id:1,title:'First crack',brief:'Crack archivist@rusty-archive (password in… dictionary? try crack archivist) then login.',check:s=>s.flags.cracked.has('rusty-archive:archivist')},
  {id:2,title:'Bounce like a ghost',brief:'Bounce via 3+ devices then reach hacker-hq: connect old-router, connect dead-forum, connect hacker-hq, login cell-k (pass: oldnet-lives). Wipe your logs after.',check:s=>s.flags.hqLogin&&s.chainMax>=3},
  {id:3,title:'Steal from Betanet',brief:'Gateway via hacker-hq or relay-van into Betanet. Download /corp/pricelist.db from corp-shop (needs decrypter on Betanet downloads).',check:s=>s.flags.stolePricelist},
  {id:4,title:'Spam pays',brief:'Build a zombie (crack relay-van, run zombie-kit) then run spam to earn $200+ total. Trojan the bank optionally: mail with trojan-mailer.',check:s=>s.money>=200&&s.flags.zombie},
  {id:5,title:'Ghost the Monitor',brief:'Connect to gov-monitor through a 4+ bounce chain, survive 20s connected with trace<100 (run scrambler + tracer-view), then disconnect + wipe. Finish the struggle.',check:s=>s.flags.ghosted},
];

/* ---------------- state ---------------- */
const S = {
  t: 8*3600+12*60, tick:0,
  place:'home', local:'home-pc',
  user:'me', cwd:{}, // per-device cwd path
  chain:[], // bounced device ids, endpoint = last
  logins:new Set(), // "dev:user"
  known:new Set(['home-pc','old-router']),
  money:50, rep:0, busts:0,
  trace:0, scramblerOn:false, tracerView:false,
  tasks:[], taskSeq:0,
  progs:new Set(['scan','crack-basic','tracer-view','log-wipe']),
  hw:{cpu:100,mem:512,modems:['wired']},
  pendingInstall:null,
  zombies:new Set(), crashed:new Set(),
  mailInbox:[], hist:[], histIdx:-1,
  flags:{scanned:false,visited:new Set(),cracked:new Set(),hqLogin:false,stolePricelist:false,zombie:false,ghosted:false,govTime:0},
  chainMax:0, over:false,
  mapZoom:1, mapCX:470, mapCY:210,
};
Object.keys(DEVICES).forEach(id=>{ S.cwd[id]='/'; });
DEVICES['gov-monitor'].users[0].p='panopticon'; // no trailing-space confusion; real pass

function curDevice(){ return DEVICES[S.chain.length?S.chain[S.chain.length-1]:S.local]; }
function endpoint(){ return S.chain.length?S.chain[S.chain.length-1]:null; }
function cpuTotal(){ return S.hw.cpu; }
function memTotal(){ return S.hw.mem; }
function memUsed(){ return S.tasks.reduce((a,t)=>a+t.mem,0); }

/* ---------------- filesystem helpers ---------------- */
function lsDir(dev, dir){
  if(!dir.endsWith('/')) dir+='/';
  const outDirs=new Set(), outFiles=[];
  for(const p of Object.keys(dev.fs)){
    if(!p.startsWith(dir)) continue;
    const rest=p.slice(dir.length);
    if(rest==='' ) continue;
    const slash=rest.indexOf('/');
    if(slash===-1) outFiles.push(rest);
    else outDirs.add(rest.slice(0,slash)+'/');
  }
  return {dirs:[...outDirs].sort(), files:outFiles.sort()};
}
function resolve(dev, cwd, arg){
  if(!arg||arg==='.') return cwd;
  let p = arg.startsWith('/')?arg:(cwd+(cwd.endsWith('/')?'':'/')+arg);
  const parts=[];
  for(const seg of p.split('/')){ if(!seg||seg==='.')continue; if(seg==='..')parts.pop(); else parts.push(seg); }
  return '/'+parts.join('/')+(isDir(dev,'/'+parts.join('/'))?'/':'');
}
function norm(p){ return p==='/'?'/':('/'+p.split('/').filter(Boolean).join('/')); }
function isDir(dev, p){
  p=norm(p);
  if(p==='/') return true;
  return Object.keys(dev.fs).some(k=>k===p+'/.keep'||k.startsWith(p+'/'));
}
function readFile(dev,p){ p=norm(p); return dev.fs[p]; }

/* ---------------- reachability (modems + wires + wireless + laser) ---------------- */
function dist(a,b){ const A=DEVICES[a],B=DEVICES[b]; return Math.hypot(A.x-B.x,A.y-B.y); }
function wireLink(a,b){ return WIRES.find(w=>(w[0]===a&&w[1]===b)||(w[0]===b&&w[1]===a)); }
function canReach(fromId, toId){
  const F=DEVICES[fromId], T=DEVICES[toId];
  if(fromId===toId) return {ok:false,why:'already there'};
  if(S.chain.includes(toId)) return {ok:false,why:'already in bounce chain (doc: cannot connect to same device twice in one chain)'};
  // gateway rule: crossing old<->beta requires a gateway in path or endpoints
  const fromNet=F.net, toNet=T.net;
  const crosses=(fromNet!==toNet&&fromNet!=='both'&&toNet!=='both');
  const pathHasGateway=[...S.chain,fromId].some(id=>DEVICES[id].gateway)||T.gateway;
  // direct wire?
  const w=wireLink(fromId,toId);
  if(w && F.hw.modems.includes('wired')&&T.hw.modems.includes('wired')){
    if(crosses&&!pathHasGateway) return {ok:false,why:'networks incompatible: need Oldnet<->Betanet gateway (hacker-hq / relay-van)'};
    return {ok:true,via:w[2]?'damaged wire (slow, lossy)':'wire',slow:w[2]?true:false};
  }
  // laser
  if(F.hw.modems.includes('laser')&&T.hw.modems.includes('laser')){
    if(crosses&&!pathHasGateway) return {ok:false,why:'need gateway to cross Oldnet<->Betanet'};
    return {ok:true,via:'laser backbone (toll may apply)',toll:(T.toll||0)};
  }
  // wireless range
  const r=Math.min(F.range||0,T.range||0, 160);
  const needW = F.hw.modems.includes('wireless')&&T.hw.modems.includes('wireless');
  if(needW && (dist(fromId,toId)<=Math.max(F.range||0,T.range||0))){
    if(T.net==='beta'&&!S.progs.has('decrypter')) return {ok:true,via:'wireless (ENCRYPTED — downloads will fail without decrypter)',warn:true};
    if(crosses&&!pathHasGateway) return {ok:false,why:'need gateway to cross Oldnet<->Betanet'};
    return {ok:true,via:'wireless'};
  }
  // multi-hop hint: can always connect if a known intermediate relays? No — player must bounce manually.
  return {ok:false,why:`no route: need shared wire / overlapping wireless range / laser. (scan to see). ${fromNet}->${toNet}${crosses?' + CROSS-NETWORK: route via hacker-hq or relay-van':''}`};
}

/* ---------------- logging / trace ---------------- */
function addLog(devId, entry){
  DEVICES[devId].logs.push(`[t+${fmtTime(S.t)}] ${entry}`);
  if(DEVICES[devId].logs.length>40) DEVICES[devId].logs.shift();
}
function traceTick(){
  const ep=endpoint();
  if(!ep){ S.trace=Math.max(0,S.trace-1.2); return; }
  const dev=DEVICES[ep];
  let rate=dev.traceRate;
  rate=Math.max(0.1, rate - 0.55*(S.chain.length-1)); // each bounce buys trace time (doc)
  if(S.scramblerOn) rate*=0.5;
  if(dev.net==='beta'&&!S.progs.has('decrypter')) rate*=1.2;
  if(S.crashed.has(ep)) rate=0;
  S.trace=clamp(S.trace+rate,0,100);
  if(ep==='gov-monitor'){ S.flags.govTime+=1; if(S.chain.length>=4&&S.flags.govTime>=20) S.flags.ghosted=true; }
  if(S.trace>=100) busted();
}
function busted(){
  S.busts++; S.trace=0;
  const fine=Math.min(S.money, 60+S.busts*20);
  S.money-=fine; S.rep-=1;
  print(`<b>TRACED.</b> Gov agents kick the door. Logs gave you away. Fine $${fine}. Chain burned. (${S.busts} bust${S.busts>1?'s':''})`,'err');
  notify(`<b>BUSTED</b> — fined $${fine}. Wipe logs next time (log-wipe) and use longer bounce chains + scrambler.`);
  // burn chain, leave logs
  S.chain=[]; S.logins.clear(); S.scramblerOn=false;
  S.flags.govTime=0;
  if(S.money<0)S.money=0;
  if(S.busts>=3&&!S.over){ print(`The cell pulls you out of town. <b>GAME OVER-ish</b> — but the Oldnet remembers. Type <span class=in>missions</span> to keep fighting.`,'warn'); }
}

/* ---------------- tasks (CPU/MEM + time) ---------------- */
function addTask(label, secs, mem, onDone, opts={}){
  if(memUsed()+mem>memTotal()){ print(`Not enough memory: need ${mem}MB, have ${memTotal()-memUsed()}MB free. Buy mem-512 or kill tasks.`,'err'); return null; }
  const t={id:++S.taskSeq,label,total:Math.max(1,Math.round(secs)),left:Math.max(1,Math.round(secs)),mem,cpu:opts.cpu||20,onDone,quiet:!!opts.quiet};
  S.tasks.push(t);
  if(!t.quiet) print(`[task #${t.id}] ${esc(label)} — ${t.total}s, ${mem}MB`,'dim');
  return t;
}
function tasksTick(){
  const cpuShare=cpuTotal()/Math.max(1,S.tasks.length);
  for(const t of S.tasks){
    const speed=clamp(cpuShare/100,0.25,4); // better CPU = faster (doc)
    t.left-=speed;
  }
  const done=S.tasks.filter(t=>t.left<=0);
  S.tasks=S.tasks.filter(t=>t.left>0);
  for(const d of done){ try{ d.onDone&&d.onDone(); }catch(e){ print('task error: '+esc(e.message),'err'); } }
}

/* ---------------- missions ---------------- */
function missionStatus(){
  let idx=MISSIONS.findIndex(m=>!m.check(S));
  if(idx===-1) idx=MISSIONS.length; // all done
  return idx;
}
function showMissions(){
  print(`<b>== CELL-K MISSION BOARD ==</b>  rep:${S.rep}  busts:${S.busts}`,'sys');
  MISSIONS.forEach(m=>{
    const done=m.check(S);
    print(`${done?'[DONE]':'[ -- ]'} <b>${m.id}. ${esc(m.title)}</b> — ${esc(m.brief)}`, done?'ok':'');
  });
  const i=missionStatus();
  if(i<MISSIONS.length) print(`Next: <span class=in>mission ${i}</span> — ${esc(MISSIONS[i].brief)}`,'warn');
  else { print(`<b>YOU WIN.</b> The Oldnet breathes; innocents get their corner of Betanet. The struggle is won.`,'ok'); notify('<b>VICTORY</b> — struggle complete.'); }
}

/* ---------------- programs (run) ---------------- */
function runProgram(name, args, dev){
  if(!S.progs.has(name)){ print(`No such program: ${name}. Buy it: shop / buy ${name}`,'err'); return; }
  const ep=endpoint();
  switch(name){
    case 'tracer-view': S.tracerView=true; print('tracer-view running: live trace % now visible in ACTIONS. (doc: viewing requires this program)','ok'); break;
    case 'scrambler': S.scramblerOn=true; print('scrambler running: trace rate halved. kill it with kill scrambler.','ok'); break;
    case 'monitor': addTask('monitor watch', 120, 40, ()=>{S.scramblerOn=false; print('monitor watch ended','dim');},{quiet:true}); print('monitor running: you will be warned on trace spikes.','ok'); break;
    case 'mem-view': {
      if(!ep){ print('mem-view needs a remote connection: connect somewhere first.','err'); break; }
      const rd=DEVICES[ep];
      addTask(`mem-view ${ep}`, 8, 60, ()=>{
        print(`-- ${ep} mem: ${rd.hw.cpu} MIPS, ${rd.hw.mem}MB; modems:${rd.hw.modems.join(',')}; users:${rd.users.map(u=>u.u).join(',')||'(none)'}; vulns:${rd.vulns.map(v=>v.id).join(',')||'none'}`, 'ok');
        if(ep==='beta-tower-1'||ep==='beta-tower-2') print('mem-view: laser relay congestion window LEAKS handshake addrs — decrypter can use this.','warn');
      });
      break; }
    case 'decrypter': print('decrypter is passive once owned: Betanet downloads + wireless intercepts work.','ok'); break;
    case 'log-wipe': {
      const target=args[0]||ep||S.local;
      if(!DEVICES[target]){ print('log-wipe <device> — wipes YOUR traces there.','err'); break; }
      addTask(`log-wipe ${target}`,6,30,()=>{
        DEVICES[target].logs=DEVICES[target].logs.filter(l=>!l.includes('you'));
        S.trace=Math.max(0,S.trace-18);
        print(`wiped your entries on ${target}. trace -18%.`,'ok');
      });
      break; }
    case 'firewall-bypass': {
      const vuln=args[0];
      if(!ep){ print('usage: run firewall-bypass <vuln-id> (connect first; scan/mem-view to find vuln)','err'); break; }
      const d=DEVICES[ep];
      const v=d.vulns.find(v=>v.id===vuln);
      if(!v){ print(`no vuln ${vuln||''} on ${ep}. vulns here: ${d.vulns.map(v=>v.id).join(', ')||'none (patched?)'}`,'err'); break; }
      addTask(`exploit ${vuln}@${ep}`, vuln==='zero-day'?25:10, 80, ()=>{
        d.vulns=d.vulns.filter(x=>x!==v);
        // auto-grant a login
        if(d.users.length){ const u=d.users[0].u; S.logins.add(`${ep}:${u}`); print(`<b>EXPLOITED ${vuln}</b> on ${ep}: got session as ${u}. (patch would have blocked this)`,'ok'); S.flags.cracked.add(`${ep}:${u}`); }
        else print(`exploited ${vuln} on ${ep}: no user db, but logs + relay now open.`,'ok');
        S.rep+=1; S.trace=clamp(S.trace+8,0,100);
      });
      break; }
    case 'trojan-mailer': case 'virus': case 'zombie-kit':
      print(`use the verbs directly: <span class=in>${name==='trojan-mailer'?'mail <user>@<device> <message>':name==='virus'?'infect':"zombify"}</span> (program must be owned — it is).`,'dim'); break;
    default: print(`ran ${esc(name)} ${esc(args.join(' '))} (no-op demo)`,'dim');
  }
}

/* ---------------- commands ---------------- */
const CMDS = {};
function reg(names, fn, help){ names.split('|').forEach(n=>CMDS[n]={fn,help}); }

reg('help', (a)=>{
  if(a[0]&&CMDS[a[0]]) { print(`<b>${a[0]}</b> — ${CMDS[a[0]].help}`); return; }
  print(`<b>STANDARD</b>: ls cd pwd cat|view mkdir rm mv search clear status map missions shop buy use go places leave`,'sys');
  print(`<b>MODEM</b>: scan connect login logout disconnect connections logins`,'sys');
  print(`<b>HACK</b>: crack exploit run tasks kill download upload mem? (run mem-view) wipe (run log-wipe)`,'sys');
  print(`<b>MAIL/MAYHEM</b>: mail inbox spam infect zombify`,'sys');
  print(`<b>DOC EXTRAS</b>: TAB completes · dual-console via <span class=in>tasks</span> · backbone tolls · damaged wires · physical <span class=in>go/use</span>`,'dim');
  print(`Try: <span class=in>missions</span> → <span class=in>scan</span> → <span class=in>connect rusty-archive</span>`,`warn`);
}, 'show help');

reg('missions|mission|story', ()=>showMissions(), 'mission board');
reg('clear', ()=>{outEl.innerHTML='';}, 'clear console');
reg('status', ()=>{
  const d=curDevice();
  print(`you:${S.user}@${d.name} place:${S.place} money:$${S.money} rep:${S.rep} cpu:${cpuTotal()} mem:${memUsed()}/${memTotal()} chain:${S.chain.length?S.chain.join(' → '):'(local)'} trace:${S.tracerView?S.trace.toFixed(0)+'%':'(run tracer-view)'}`,'sys');
}, 'status');

reg('ls|dir', (a)=>{
  const d=curDevice(); const dir=norm(S.cwd[d.name]||'/');
  const {dirs,files}=lsDir(d,dir);
  if(!dirs.length&&!files.length){ print('(empty)','dim'); return; }
  print(dirs.map(x=>`<span class=sys>${esc(x)}</span>`).join('  ')+' '+files.map(esc).join('  '));
}, 'list directory');
reg('pwd', ()=>{ const d=curDevice(); print(S.cwd[d.name]||'/','dim'); }, 'print dir');
reg('cd', (a)=>{
  const d=curDevice(); const to=resolve(d,S.cwd[d.name]||'/',a[0]||'/');
  const n=norm(to)+(to.endsWith('/')?'':'/');
  if(!isDir(d,n.replace(/\/$/,''))&&n!=='/'){ print(`no such dir: ${a[0]}`,'err'); return; }
  S.cwd[d.name]=norm(n===''?'/' : n).replace(/([^/])$/,'$1/'); if(S.cwd[d.name]==='//')S.cwd[d.name]='/';
  if(S.cwd[d.name][0]!=='/')S.cwd[d.name]='/'+S.cwd[d.name];
  // normalize double
  S.cwd[d.name]='/' + S.cwd[d.name].split('/').filter(Boolean).join('/') + (S.cwd[d.name]==='/'?'':'/');
  if(S.cwd[d.name]==='//')S.cwd[d.name]='/';
}, 'change directory');
reg('cat|view|type', (a)=>{
  if(!a[0]){ print('usage: cat <file>','err'); return; }
  const d=curDevice(); const p=norm(resolve(d,S.cwd[d.name]||'/',a[0]).replace(/\/$/,''));
  const c=readFile(d,p);
  if(c===undefined){ print(`no such file: ${a[0]}`,'err'); return; }
  print(esc(c)); 
  if(endpoint()===d.name) S.flags.visited.add(d.name);
  if(d.name==='corp-shop'&&p==='/corp/pricelist.db'&&S.logins.has('corp-shop:vendor')){ S.flags.stolePricelist=true; print('MISSION: pricelist secured. Cell-K will fence it.','ok'); }
}, 'view file');
reg('mkdir', (a)=>{ const d=curDevice(); if(!a[0]){print('usage: mkdir <dir>','err');return;} const p=norm(resolve(d,S.cwd[d.name]||'/',a[0]).replace(/\/$/,'')); d.fs[p+'/.keep']=''; print(`made ${p}/`,'dim'); }, 'make directory');
reg('rm|del|delete', (a)=>{ const d=curDevice(); if(!a[0]){print('usage: rm <file>','err');return;} const p=norm(resolve(d,S.cwd[d.name]||'/',a[0]).replace(/\/$/,'')); if(d.fs[p]===undefined){print('no such file','err');return;} delete d.fs[p]; print(`deleted ${p}`,'dim'); }, 'delete file');
reg('mv|move', (a)=>{ const d=curDevice(); if(a.length<2){print('usage: mv <src> <dst>','err');return;} const s=norm(resolve(d,S.cwd[d.name]||'/',a[0]).replace(/\/$/,'')); const t=norm(resolve(d,S.cwd[d.name]||'/',a[1]).replace(/\/$/,'')); if(d.fs[s]===undefined){print('no such file','err');return;} d.fs[t]=d.fs[s]; delete d.fs[s]; print(`moved to ${t}`,'dim'); }, 'move file');
reg('search|find', (a)=>{
  const d=curDevice(); const q=(a[0]||'').toLowerCase();
  const hits=Object.keys(d.fs).filter(p=>!q||p.toLowerCase().includes(q));
  print(hits.length?hits.map(esc).join('\n'):'(no matches)','dim');
}, 'find files');

reg('scan', ()=>{
  const from=S.chain.length?S.chain[S.chain.length-1]:S.local;
  addTask(`scan from ${from}`,5,30,()=>{
    S.flags.scanned=true;
    const found=[];
    for(const id of Object.keys(DEVICES)){
      if(id===from) continue;
      const r=canReach(from,id);
      if(r.ok){ S.known.add(id); found.push(id); }
      else if(dist(from,id)<170){ S.known.add(id); found.push(id+' (visible, no route: '+r.why.slice(0,80)+'…)'); }
    }
    print(`<b>SCAN from ${from}</b> — reachable/visible: ${found.join(', ')||'nothing new'}`,'ok');
    const dmg=WIRES.filter(w=>w[2]).map(w=>w[0]+'<->'+w[1]+' DAMAGED');
    if(dmg.length) print('wire damage: '+dmg.join('; ')+' (network tester, per doc)','warn');
    print('wireless: need overlapping range + wireless modems. backbone laser towers charge tolls.','dim');
  });
}, 'network tester: find devices/damage');

reg('connect', (a)=>{
  if(!a[0]){ print('usage: connect <device>  (TAB lists). Bounce: connect several in a row.','err'); return; }
  const to=a[0];
  if(!DEVICES[to]){ print(`unknown device ${to}. try scan first.`,'err'); return; }
  const from=S.chain.length?S.chain[S.chain.length-1]:S.local;
  const r=canReach(from,to);
  if(!r.ok){ print(`cannot connect ${from} → ${to}: ${r.why}`,'err'); return; }
  const toll=r.toll||0;
  const slow=WIRES.find(w=>w[2]&&((w[0]===from&&w[1]===to)||(w[0]===to&&w[1]===from)));
  if(toll>S.money){ print(`backbone toll $${toll} — you only have $${S.money}. Earn via spam.`,'err'); return; }
  const secs=slow?8:3;
  addTask(`connect ${from}→${to} (${r.via})`,secs,20,()=>{
    if(toll){ S.money-=toll; print(`paid backbone toll $${toll} (money $${S.money})`,'warn'); }
    S.chain.push(to); S.known.add(to); S.chainMax=Math.max(S.chainMax,S.chain.length);
    S.cwd[to]=S.cwd[to]||'/';
    const d=DEVICES[to];
    addLog(to,`CONNECT from ${from} …you… relay login pending`);
    if(from!=='home-pc'&&from!==S.local) addLog(from,`RELAY …you… → ${to}`);
    S.trace=clamp(S.trace+(d.net==='beta'?6:2),0,100);
    S.flags.visited.add(to);
    print(`connected: ${[...S.chain].join(' → ')} <span class=dim>(${r.via})</span>`,'ok');
    if(d.net==='beta'&&!S.progs.has('decrypter')) print('WARNING: Betanet encryption — downloads will fail until you own decrypter.','warn');
    if(to==='gov-monitor') print('!! GOVERNMENT SUPERCOMPUTER. Trace is FAST here. scrambler + short stay + wipe after.','err');
    updatePrompt();
  });
}, 'connect / bounce: connect <device>');

reg('login|logon', (a)=>{
  const ep=endpoint();
  if(!ep){ // local logon
    print('local session as me (home-pc has no local password). Use connect+login for remote.','dim'); return;
  }
  const d=DEVICES[ep];
  if(!d.users.length){ S.logins.add(ep+':guest'); print(`no auth on ${ep} (node/relay): open relay.`,'ok'); return; }
  const [u,p]=a;
  if(!u){ print(`usage: login <user> <password>  — users on ${ep}: ${d.users.map(x=>x.u).join(', ')} (crack or phish the rest)`,'err'); return; }
  const rec=d.users.find(x=>x.u===u);
  if(rec&&(rec.p===(p||''))){ S.logins.add(`${ep}:${u}`); addLog(ep,`LOGIN ${u} …you… OK`);
    print(`logged in to ${ep} as ${u}`,'ok');
    if(ep==='hacker-hq'&&u==='cell-k') S.flags.hqLogin=true;
    S.trace=clamp(S.trace+2,0,100);
  } else { print('login incorrect. (try crack, exploit, or trojan-mailer to learn it)','err'); S.trace=clamp(S.trace+4,0,100); addLog(ep,`FAILED login ${u} …you…`); }
}, 'login to endpoint');

reg('logout', (a)=>{ const n=parseInt(a[0]||'1',10)||1; for(let i=0;i<n;i++){ const l=[...S.logins].pop(); if(!l)break; S.logins.delete(l);} print('logged out ('+n+'). remaining: '+([...S.logins].join(', ')||'none'),'dim'); }, 'logout');
reg('disconnect|dc', (a)=>{ const n=parseInt(a[0]||'1',10)||1; for(let i=0;i<n&&S.chain.length;i++){ const d=S.chain.pop(); print(`disconnected ${d}`,'dim'); } if(!S.chain.length){S.scramblerOn=false;} updatePrompt(); }, 'disconnect N hops');
reg('connections|conn', ()=>{ print('chain: '+(S.chain.length?S.chain.join(' → '):'(local, no bounce)')+'\nlocal device: '+S.local+' @ '+S.place,'sys'); }, 'show paths');
reg('logins', ()=>{ print('logins: '+([...S.logins].join(', ')||'none'),'sys'); }, 'show logins');

reg('crack', (a)=>{
  const ep=endpoint();
  if(!ep){ print('crack needs a remote target: connect first. usage: crack <username>','err'); return; }
  const d=DEVICES[ep];
  const u=a[0]||(d.users[0]&&d.users[0].u);
  const rec=d.users.find(x=>x.u===u);
  if(!rec){ print(`no such user ${u} on ${ep}`,'err'); return; }
  if(!rec.p){ S.logins.add(`${ep}:${u}`); print(`${u}@${ep} has NO password (PDA-style, per doc). Logged in.`,'ok'); return; }
  const pro=S.progs.has('crack-pro');
  const secs=Math.max(4,(rec.p.length*4)/(pro?3:1)*(200/cpuTotal()));
  print(`cracking ${u}@${ep} with ${pro?'crack-pro':'crack-basic'} (~${secs.toFixed(0)}s, CPU-bound)… realistic: no letter-at-a-time silliness (doc).`,'warn');
  addTask(`crack ${u}@${ep}`,secs,pro?60:90,()=>{
    S.logins.add(`${ep}:${u}`); S.flags.cracked.add(`${ep}:${u}`);
    addLog(ep,`LOGIN ${u} …you… OK (cracked)`);
    S.rep+=1; S.trace=clamp(S.trace+6,0,100);
    print(`<b>CRACKED</b> ${u}@${ep} — password is <b>${esc(rec.p)}</b>. Auto-logged-in.`,'ok');
  });
}, 'password cracker: crack <user>');

reg('exploit', (a)=>{
  if(!a[0]){ print('usage: exploit <vuln-id>  (or: run firewall-bypass <vuln-id>)','err'); return; }
  runProgram('firewall-bypass',a,curDevice());
}, 'run a vulnerability exploit');

reg('run|exec', (a)=>{ if(!a[0]){print('usage: run <program> [args] — programs: '+[...S.progs].join(', '),'err');return;} runProgram(a[0],a.slice(1),curDevice()); }, 'run a program');

reg('tasks|ps|jobs', ()=>{ if(!S.tasks.length){print('(no running tasks — cpu idle)','dim');return;} S.tasks.forEach(t=>print(`#${t.id} ${esc(t.label)} — ${Math.max(0,t.left).toFixed(0)}s left, ${t.mem}MB`,'sys')); }, 'list tasks');
reg('kill', (a)=>{ if(!a[0]){print('usage: kill <id|name>','err');return;} const q=a[0].toLowerCase(); const i=S.tasks.findIndex(t=>String(t.id)===q||t.label.toLowerCase().includes(q)); if(i<0){ if(q.includes('scram')){S.scramblerOn=false;print('scrambler stopped','dim');} else print('no such task','err'); return;} const [t]=S.tasks.splice(i,1); if(t.label.startsWith('scram')||t.label.includes('scrambler'))S.scramblerOn=false; print(`killed #${t.id} ${esc(t.label)}`,'dim'); }, 'kill task');

reg('download|dl|get', (a)=>{
  const ep=endpoint();
  if(!ep){ print('nothing remote: connect somewhere, then download <remote-path>','err'); return; }
  if(!a[0]){ print('usage: download <remote-path>','err'); return; }
  const d=DEVICES[ep];
  if(![...S.logins].some(l=>l.startsWith(ep+':'))){ print(`not logged in to ${ep}. login/crack/exploit first.`,'err'); return; }
  const p=norm(a[0]);
  const content=readFile(d,p);
  if(content===undefined){ print(`no such remote file ${p}. try ls / search on the remote.`,'err'); return; }
  if(d.net==='beta'&&!S.progs.has('decrypter')){ print('ENCRYPTED Betanet transfer failed. Buy+own decrypter first (doc: different protocols).','err'); return; }
  const size=Math.max(3,Math.round(content.length/60));
  addTask(`download ${p} from ${ep}`,size,40,()=>{
    const home=DEVICES[S.local];
    const dest='/home/me/downloads/'+p.split('/').pop();
    home.fs[dest]=content;
    S.trace=clamp(S.trace+5,0,100);
    addLog(ep,`XFER …you… downloaded ${p}`);
    print(`downloaded → ${dest} on ${S.local}`,'ok');
    if(ep==='corp-shop'&&p==='/corp/pricelist.db'){ S.flags.stolePricelist=true; print('MISSION: pricelist secured.','ok'); }
  });
}, 'download remote file');
reg('upload|up|put', (a)=>{
  const ep=endpoint();
  if(!ep){ print('upload needs a remote connection.','err'); return; }
  if(a.length<2){ print('usage: upload <local-path> <remote-path>','err'); return; }
  const src=DEVICES[S.local]; const c=readFile(src,norm(a[0]));
  if(c===undefined){ print('no such local file. (downloads land in /home/me/downloads/)','err'); return; }
  if(![...S.logins].some(l=>l.startsWith(ep+':'))){ print('not logged in remotely.','err'); return; }
  DEVICES[ep].fs[norm(a[1])]=c; print(`uploaded → ${ep}:${norm(a[1])}`,'ok');
}, 'upload file');

reg('mail|email', (a)=>{
  const ep=endpoint();
  if(a[0]==='inbox'||!a[0]){ print(S.mailInbox.length?S.mailInbox.map((m,i)=>`[${i}] ${m}`).join('\n'):'(inbox empty)','sys'); return; }
  // mail <user>@<device> <msg...>
  const m=(a[0]||'').match(/^([^@]+)@(.+)$/);
  if(!m){ print('usage: mail <user>@<device> <message>  (own trojan-mailer to send trojans: mail -t …)','err'); return; }
  const [,u,dev]=m;
  if(!DEVICES[dev]){ print('unknown device','err'); return; }
  const isTrojan=(a[1]==='-t')||S._trojanNext;
  if(isTrojan&&!S.progs.has('trojan-mailer')){ print('need trojan-mailer program: buy it first.','err'); return; }
  const msg=a.slice(isTrojan&&a[1]==='-t'?2:1).join(' ')||'(no body)';
  addTask(`send mail to ${u}@${dev}`,3,10,()=>{
    S._trojanNext=false;
    addLog(dev,`MAIL to ${u} …you… ${isTrojan?'[TROJAN]':''}`);
    print(`mail sent to ${u}@${dev}${isTrojan?' WITH TROJAN attached':''}`,'ok');
    if(isTrojan){
      // victim opens after a bit, leaks password if user exists
      setTimeout(()=>{
        const rec=DEVICES[dev].users.find(x=>x.u===u);
        if(rec&&rec.p){ S.flags.cracked.add(`${dev}:${u}`); print(`TROJAN opened by ${u}@${dev}: captured password <b>${esc(rec.p)}</b>. Auto-added to your knowledge.`,'ok'); notify(`<b>Trojan success</b> ${u}@${dev} opened it.`); }
        else { print(`trojan mailed to ${u}@${dev} but no password to steal.`,'warn'); }
      }, 9000);
    }
  });
}, 'send email (trojans with -t)');
reg('trojan', ()=>{ S._trojanNext=true; print('next mail will carry a trojan (need trojan-mailer owned). usage: mail bob@corp-shop -t hello','warn'); }, 'arm trojan for next mail');
reg('inbox', ()=>{ print(S.mailInbox.length?S.mailInbox.map((m,i)=>`[${i}] ${m}`).join('\n'):'(inbox empty)','sys'); }, 'read inbox');

reg('spam', (a)=>{
  if(!S.zombies.size){ print('no zombies. Crack a box then: zombify (needs zombie-kit). Zombies send spam for you (doc: earn money from spam).','err'); return; }
  const n=S.zombies.size;
  addTask(`spam run (${n} zombies)`,10,50,()=>{
    const earn=15*n;
    S.money+=earn; S.rep+=1;
    print(`spam run complete via ${[...S.zombies].join(', ')}: +$${earn} (balance $${S.money})`,'ok');
    S.trace=clamp(S.trace+4,0,100);
  });
}, 'earn money via zombie spam');
reg('zombify|zombie', ()=>{
  const ep=endpoint();
  if(!S.progs.has('zombie-kit')){ print('need zombie-kit: buy it.','err'); return; }
  if(!ep){ print('connect + login somewhere first, then zombify it.','err'); return; }
  if(![...S.logins].some(l=>l.startsWith(ep+':'))){ print('need login on target first.','err'); return; }
  addTask(`zombify ${ep}`,8,60,()=>{ S.zombies.add(ep); S.flags.zombie=true; S.trace=clamp(S.trace+7,0,100); print(`${ep} is now YOUR ZOMBIE. Run spam to earn.`,'ok'); });
}, 'zombify a cracked box');
reg('infect|virus', ()=>{
  const ep=endpoint();
  if(!S.progs.has('virus')){ print('need virus program: buy it.','err'); return; }
  if(!ep){ print('connect somewhere first.','err'); return; }
  addTask(`virus → ${ep}`,6,50,()=>{ S.crashed.add(ep); S.trace=clamp(S.trace+15,0,100); S.rep-=1; print(`${ep} CRASHED (doc: crash computers with viruses). It will reboot in ~60s. Trace +15.`,'warn'); setTimeout(()=>{S.crashed.delete(ep); print(`${ep} rebooted.`,'dim');},60000); });
}, 'crash remote computer');

reg('wipe', (a)=>{ runProgram('log-wipe',a,curDevice()); }, 'wipe your log entries');
reg('trace', ()=>{ print(S.tracerView?`live trace: ${S.trace.toFixed(1)}% (endpoint ${endpoint()||'none'})`:'buy/run tracer-view to see trace (doc rule). Hint: disconnect early, bounce more, scrambler, wipe.','sys'); }, 'trace status');

reg('shop|store', ()=>{
  print('<b>== BLACK MARKET ==</b>  money: $'+S.money,'sys');
  print('-- programs --'); Object.entries(PROGRAMS).forEach(([k,v])=>print(`${S.progs.has(k)?'[OWNED]':'[     ]'} <b>${k}</b> $${v.price} — ${v.desc}`, S.progs.has(k)?'dim':''));
  print('-- hardware --'); Object.entries(HARDWARE).forEach(([k,v])=>print(`<b>${k}</b> $${v.price} — ${v.desc}`));
  print("buy with: buy <item>. install takes time (doc); pay rush with: buy <hw> rush",'dim');
}, 'shop');
reg('buy', (a)=>{
  const item=a[0]; const rush=a[1]==='rush';
  if(!item){ print('usage: buy <program|hardware>','err'); return; }
  if(PROGRAMS[item]){
    const p=PROGRAMS[item].price;
    if(S.progs.has(item)){ print('already owned','err'); return; }
    if(S.money<p){ print(`need $${p}, have $${S.money}. Run spam.`,'err'); return; }
    S.money-=p; S.progs.add(item);
    print(`installed ${item}. ${PROGRAMS[item].desc}`,'ok');
    notify(`delivered: <b>${esc(item)}</b> installed.`);
    return;
  }
  if(HARDWARE[item]){
    let p=HARDWARE[item].price+(rush?40:0);
    if(S.money<p){ print(`need $${p}, have $${S.money}`,'err'); return; }
    if(S.pendingInstall){ print('an install is already in progress.','err'); return; }
    S.money-=p;
    const secs=rush?5:(item==='cpu-2x'?45:30);
    print(`hardware ${item} purchased. INSTALL time ${secs}s${rush?' (rushed, paid extra — doc)':''}…`,'warn');
    S.pendingInstall=item;
    addTask(`install ${item}`,secs,0,()=>{
      if(item==='cpu-2x')S.hw.cpu+=120;
      if(item==='mem-512')S.hw.mem+=512;
      if(item==='wireless-card'&&!S.hw.modems.includes('wireless'))S.hw.modems.push('wireless');
      if(item==='laser-modem'&&!S.hw.modems.includes('laser'))S.hw.modems.push('laser');
      // also upgrade home-pc device record
      const h=DEVICES[S.local].hw; h.cpu=S.hw.cpu; h.mem=S.hw.mem; h.modems=[...S.hw.modems];
      if(item==='wireless-card')DEVICES[S.local].range=100;
      S.pendingInstall=null;
      print(`${item} INSTALL COMPLETE. cpu:${S.hw.cpu} mem:${S.hw.mem} modems:${S.hw.modems.join(',')}`,'ok');
      notify(`hardware ready: <b>${esc(item)}</b>`);
    });
    return;
  }
  print(`no such item ${item}. try shop.`,'err');
}, 'buy programs/hardware');

reg('go|walk|travel', (a)=>{
  if(!a[0]){ print('places: '+Object.keys(PLACES).join(', ')+' — usage: go <place>. Vehicles = fast travel to named locations (doc: no driving needed).','err'); return; }
  const p=a[0];
  if(!PLACES[p]){ print('unknown place. places: '+Object.keys(PLACES).join(', '),'err'); return; }
  addTask(`travel → ${p}`, p==='home'||S.place==='home'?4:7, 0, ()=>{
    S.place=p;
    print(`you are at <b>${p}</b>: ${PLACES[p].desc}`,'ok');
    if(p==='cafe') print('HINT: this laptop is physically OPEN. try: use cafe-laptop','warn');
    if(p==='hideout') print('HINT: physical access to hacker-hq = try use hacker-hq','warn');
  });
}, 'move physically');
reg('places|map-list', ()=>{ print(Object.entries(PLACES).map(([k,v])=>`<b>${k}</b>: ${v.desc}`).join('\n')); }, 'list places');
reg('use', (a)=>{
  if(!a[0]){ print('usage: use <device> — take physical control (doc: Use object). Nearby: '+(PLACES[S.place].devices.join(', ')||'none here — go somewhere') ,'err'); return; }
  const id=a[0];
  if(!PLACES[S.place].devices.includes(id)){ print(`${id} is not here (place ${S.place}). Nearby: ${PLACES[S.place].devices.join(', ')||'none'}.`,'err'); return; }
  S.local=id; S.chain=[]; S.cwd[id]=S.cwd[id]||'/';
  const d=DEVICES[id];
  print(`now USING ${id} physically. ${d.users.length&&d.users[0].p?`Local logon needed: logon ${d.users[0].u} / crack not needed — you're AT the keyboard, try empty or phished pass.`:'No local password — straight in (doc: PDAs often unprotected).'}`,'ok');
  if(id==='cafe-laptop'){ S.logins.add('cafe-laptop:tourist'); print('Physical access bonus: auto-logged-on as tourist.','ok'); }
  updatePrompt();
}, 'use a nearby device');
reg('leave', ()=>{ print(`stepped back from ${S.local} (it stays logged on, per doc). You are ${S.place}, controlling yourself now.`,'dim'); }, 'leave device');
reg('map', (a)=>{
  if(a[0]==='zoom'&&(a[1]==='in'||a[1]==='out')){ S.mapZoom=clamp(S.mapZoom*(a[1]==='in'?1.25:0.8),0.5,3); drawMap(); return; }
  const known=[...S.known].join(', ');
  print(`known devices (${S.known.size}): ${known}`,'sys');
  print('map window (top-right): click a node to connect · wheel zooms (world→region→city→live, per doc).','dim');
}, 'map info');
reg('money|wallet', ()=>print(`balance $${S.money} — earn: spam (needs zombies). backbone tolls $5/hop. hardware + programs cost.`,'sys'), 'money');

/* fallback for doc verbs */
reg('select', ()=>print('single-modem build: your modems are auto-selected (home-pc + upgrades). Buy wireless-card / laser-modem to add options.','dim'), 'modem select');
reg('show', (a)=>{ if((a[0]||'')==='connections'||(a[0]||'')==='conn')CMDS['connections'].fn([]); else if((a[0]||'')==='logins')CMDS['logins'].fn([]); else print('show connections|logins','err'); }, 'show X');

/* ---------------- input / history / suggest ---------------- */
const ALLWORDS=()=>[...Object.keys(CMDS),'..','/',...[...S.known],...Object.keys(PROGRAMS),...Object.keys(HARDWARE),...Object.keys(PLACES)];
function tokenize(s){ return s.trim().split(/\s+/).filter(Boolean); }
async function execLine(line){
  line=line.trim(); if(!line) return;
  S.hist.push(line); S.histIdx=S.hist.length;
  print(`<span class=in>${esc(promptEl.textContent)} ${esc(line)}</span>`);
  const [cmd,...args]=tokenize(line);
  const c=CMDS[cmd.toLowerCase()];
  if(!c){ print(`unknown command ${esc(cmd)}. try help.`,'err'); return; }
  try{ await c.fn(args); }catch(e){ print('error: '+esc(e.message),'err'); }
  checkMissions(); renderAll();
}
function updatePrompt(){ const d=curDevice(); promptEl.textContent=`${S.user}@${d.name}:${S.cwd[d.name]||'/'}>`; }
function updateSuggest(){
  const v=inputEl.value; const parts=tokenize(v);
  const frag=(v.endsWith(' ')||!parts.length)?'':parts[parts.length-1].toLowerCase();
  suggestRow.innerHTML='';
  if(!frag) return;
  const cands=ALLWORDS().filter(w=>w.toLowerCase().startsWith(frag)&&w.toLowerCase()!==frag).slice(0,8);
  cands.forEach(w=>{ const b=document.createElement('button'); b.textContent=w; b.onclick=()=>{ const p=tokenize(inputEl.value); if(inputEl.value.endsWith(' '))p.push(w); else p[p.length-1]=w; inputEl.value=p.join(' ')+' '; inputEl.focus(); updateSuggest(); }; suggestRow.appendChild(b); });
}
inputEl.addEventListener('input', updateSuggest);
inputEl.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ const v=inputEl.value; inputEl.value=''; suggestRow.innerHTML=''; execLine(v); }
  else if(e.key==='Tab'){ e.preventDefault(); const btn=suggestRow.querySelector('button'); if(btn)btn.click(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); if(S.hist.length){ S.histIdx=Math.max(0,S.histIdx-1); inputEl.value=S.hist[S.histIdx]||''; } }
  else if(e.key==='ArrowDown'){ e.preventDefault(); if(S.hist.length){ S.histIdx=Math.min(S.hist.length,S.histIdx+1); inputEl.value=S.hist[S.histIdx]||''; } }
});
$('#btn-help').onclick=()=>execLine('help');
$('#btn-missions').onclick=()=>execLine('missions');
$('#btn-map-full').onclick=()=>{S.mapZoom=S.mapZoom>=3?0.6:3;drawMap();};
document.querySelectorAll('#map-zoom-btns button').forEach(b=>b.onclick=()=>{S.mapZoom=clamp(S.mapZoom*(b.dataset.zoom==='in'?1.25:0.8),0.5,3);drawMap();});

/* ---------------- rendering ---------------- */
function renderStatus(){
  const d=curDevice();
  const ep=endpoint();
  statusEl.innerHTML=`
    <div class=row><span>time</span><b>${fmtTime(S.t)}</b></div>
    <div class=row><span>place / box</span><b>${esc(S.place)} / ${esc(d.name)}</b></div>
    <div class=row><span>net</span><b>${d.net==='both'?'Oldnet+Betanet gateway':d.net}</b></div>
    <div class=row><span>money</span><b>$${S.money}</b></div>
    <div class=row><span>rep / busts</span><b>${S.rep} / ${S.busts}</b></div>
    <div class=row><span>chain</span><b>${S.chain.length?esc(S.chain.join('→')):'(local)'}</b></div>
    <div>cpu ${cpuTotal()} MIPS</div><div class="bar cpu"><i style="width:${clamp(S.tasks.length*22,4,100)}%"></i></div>
    <div>mem ${memUsed()}/${memTotal()} MB</div><div class="bar mem"><i style="width:${clamp(memUsed()/memTotal()*100,2,100)}%"></i></div>
    <div>trace ${S.tracerView?S.trace.toFixed(0)+'%':'??? (run tracer-view)'}</div><div class="bar trace"><i style="width:${S.trace}%"></i></div>
    <div class=row><span>endpoint</span><b>${ep||'—'}</b></div>
    <div class=row><span>modems</span><b>${esc(S.hw.modems.join(','))}</b></div>`;
  invEl.innerHTML=`<div class=row><span>programs</span></div><div>${[...S.progs].map(esc).join(', ')}</div>
    <div class=row><span>zombies</span><b>${[...S.zombies].join(', ')||'none'}</b></div>
    <div class=row><span>mission</span><b>${missionStatus()<MISSIONS.length?esc(MISSIONS[missionStatus()].title):'COMPLETE ★'}</b></div>`;
}
function renderActions(){
  if(!S.tasks.length&&!S.tracerView){ actionsEl.innerHTML=`<span style="color:var(--dim)">idle — cpu free. run scan / crack / downloads to fill this (doc: cpu + completion times here).</span>`; return; }
  actionsEl.innerHTML=S.tasks.map(t=>`<div class=task><span>#${t.id} ${esc(t.label)}</span><span>${Math.max(0,t.left).toFixed(0)}s · ${t.mem}MB</span></div>`).join('')
    +(S.tracerView?`<div class=task><span>TRACE ${endpoint()?'@'+esc(endpoint()):'(local: safe)'}</span><span style="color:${S.trace>70?'var(--red)':'var(--grn)'}">${S.trace.toFixed(1)}%</span></div>`:'')
    +(S.scramblerOn?`<div class=task><span>scrambler ACTIVE</span><span>½ trace</span></div>`:'');
}
function renderAll(){ renderStatus(); renderActions(); updatePrompt(); }

/* ---------------- map ---------------- */
const canvas=$('#map'), ctx=canvas.getContext('2d');
function w2s(x,y){ const cx=S.mapCX, cy=S.mapCY, z=S.mapZoom; const r=canvas.getBoundingClientRect(); const sx=canvas.width/r.width||1; return [(x-cx)*z+canvas.width/2,(y-cy)*z+canvas.height/2]; }
function drawMap(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#030805'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const lvl=S.mapZoom<0.8?'world view':S.mapZoom<1.2?'region view':S.mapZoom<1.8?'city view':'live view';
  $('#map-level').textContent='— '+lvl;
  // streets hint
  ctx.strokeStyle='#0f2a1f'; ctx.beginPath(); ctx.moveTo(...w2s(80,260)); ctx.lineTo(...w2s(880,260)); ctx.stroke();
  // wires
  for(const [a,b,damaged] of WIRES){
    const A=DEVICES[a],B=DEVICES[b]; const [x1,y1]=w2s(A.x,A.y),[x2,y2]=w2s(B.x,B.y);
    ctx.strokeStyle=damaged?'#ff5470':'#1f8a4c'; ctx.setLineDash(damaged?[5,4]:[]); ctx.lineWidth=damaged?1.5:2;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
  }
  // laser backbone
  ctx.strokeStyle='#ffe14d'; ctx.lineWidth=1.5; ctx.setLineDash([2,3]);
  const t1=DEVICES['beta-tower-1'],t2=DEVICES['beta-tower-2'];
  { const [x1,y1]=w2s(t1.x,t1.y),[x2,y2]=w2s(t2.x,t2.y); ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke(); }
  ctx.setLineDash([]);
  // wireless ranges of known
  for(const id of S.known){ const d=DEVICES[id]; if(!d.range)continue; const [x,y]=w2s(d.x,d.y);
    ctx.strokeStyle='rgba(67,232,255,.18)'; ctx.beginPath(); ctx.arc(x,y,d.range*S.mapZoom,0,7); ctx.stroke(); }
  // nodes
  S._mapHits=[];
  for(const [id,d] of Object.entries(DEVICES)){
    const known=S.known.has(id); const [x,y]=w2s(id==='home-pc'?120:d.x,id==='home-pc'?210:d.y);
    if(x<-20||y<-20||x>canvas.width+20||y>canvas.height+20) continue;
    const inChain=S.chain.includes(id); const isEp=endpoint()===id; const isLocal=S.local===id&&!S.chain.length;
    ctx.beginPath(); ctx.arc(x,y,isEp?8:6,0,7);
    ctx.fillStyle=!known?'#3a4a44':isEp?'#ff5470':inChain?'#ffb347':isLocal?'#ffffff':d.net==='beta'?'#43e8ff':d.net==='both'?'#c792ff':'#33ff88';
    ctx.fill();
    ctx.fillStyle=known?'#c9ffe0':'#5a6a62'; ctx.font='10px monospace'; ctx.fillText(id,x+9,y+3);
    S._mapHits.push({id,x,y});
  }
}
canvas.addEventListener('click', e=>{
  const r=canvas.getBoundingClientRect(); const mx=(e.clientX-r.left)*(canvas.width/r.width), my=(e.clientY-r.top)*(canvas.height/r.height);
  let best=null,bd=1e9; for(const h of (S._mapHits||[])){ const d=Math.hypot(h.x-mx,h.y-my); if(d<bd){bd=d;best=h;} }
  if(best&&bd<22){ inputEl.value='connect '+best.id; inputEl.focus(); execLine('connect '+best.id); }
  else { // walk-to-centre
    S.mapCX=clamp(S.mapCX+(mx-canvas.width/2)/S.mapZoom,0,950); S.mapCY=clamp(S.mapCY+(my-canvas.height/2)/S.mapZoom,0,450); drawMap();
  }
});
canvas.addEventListener('wheel', e=>{ e.preventDefault(); S.mapZoom=clamp(S.mapZoom*(e.deltaY<0?1.15:0.87),0.5,3); drawMap(); }, {passive:false});

/* ---------------- missions + ambient + clock ---------------- */
let lastMissionIdx=0;
function checkMissions(){
  const i=missionStatus();
  if(i!==lastMissionIdx){
    if(i>MISSIONS.length-1&&lastMissionIdx<=MISSIONS.length-1){ print('<b>★ ALL MISSIONS COMPLETE — the struggle is won.</b>','ok'); notify('<b>VICTORY</b> — Oldnet lives.'); }
    else if(i<MISSIONS.length){ print(`MISSION DONE. Next: <b>${MISSIONS[i].title}</b> — ${MISSIONS[i].brief}`,'ok'); notify(`mission update: <b>${esc(MISSIONS[i].title)}</b>`); S.money+=25; S.rep+=1; print('cell-K paid $25.','warn'); }
    lastMissionIdx=i;
  }
}
const AMBIENT=[
  ()=>{ const ids=[...S.known]; const id=ids[Math.floor(Math.random()*ids.length)]; if(id&&id!==S.local)addLog(id,'ambient relay traffic'); },
  ()=>notify('email: <b>cell-K</b>: stay low. bounce more. wipe always.'),
  ()=>notify('email: <b>spam broker</b>: need 10k sends? paying $15 per zombie-run.'),
  ()=>{ if(S.money>150)notify('delivery: hardware sale ends soon (shop).'); },
  ()=>{ // rival hackers / gov ambient
    if(Math.random()<0.5) addLog('gov-monitor','scan sweep: Oldnet relay probed');
    else addLog('hacker-hq','ally route flap: datacenter');
  },
];
function tick(){
  if(S.over) return;
  S.t++; S.tick++;
  $('#clock').textContent=fmtTime(S.t)+`  day ${(Math.floor(S.t/86400)+1)}`;
  tasksTick(); traceTick();
  if(S.tick%18===0) AMBIENT[Math.floor(Math.random()*AMBIENT.length)]();
  if(S.tick%5===0){ renderAll(); }
  if(S.tick%2===0) drawMap();
  if(S.trace>70&&S.progs.has('monitor')){ /* monitor alerts */ if(S.tick%6===0) print('monitor: TRACE SPIKE — disconnect or wipe NOW.','err'); }
}

/* ---------------- intro ---------------- */
function intro(){
  const b=$('#story-banner'); b.style.display='block';
  b.innerHTML=`<b>PLOT:</b> The internet is dead — replaced by the gov-run wireless <b>Betanet</b>. No games, no filesharing, no personal sites. The old wired <b>Oldnet</b> rots, and the government hunts its servers. As a new initiate of hacker cell <b>K</b>, help keep Oldnet alive and pry open Betanet. <span style="opacity:.8">Type <b>missions</b> to begin. Physical body included: <b>go cafe</b>, <b>use cafe-laptop</b>.</span>`;
  print(`HACKER SIM booted.`, 'sys');
  print(`You are <b>me@${S.local}</b> at <b>home</b>. Money $${S.money}. Modems: ${S.hw.modems}.`,'sys');
  print(`Start: <span class=in>missions</span> · <span class=in>scan</span> · <span class=in>connect rusty-archive</span> · <span class=in>cat /pub/betanet-notes.txt</span>`,'warn');
  notify('email: <b>cell-K</b>: welcome, kid. read missions. don\'t get traced. — K', true);
  notify('delivery: <b>tracer-view $40</b> in shop — you already own one? check shop.');
  S.mailInbox.push('cell-K: welcome. missions → scan → crack. bounce everything.');
  showMissions();
}

/* boot */
renderAll(); drawMap(); intro();
setInterval(tick, 1000);
window.HS={S,DEVICES,execLine};
