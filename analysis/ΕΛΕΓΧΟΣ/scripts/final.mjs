import { readFileSync } from "node:fs";
import vm from "node:vm";
const HTML = readFileSync(process.env.LIVE, "utf8");
const W = JSON.parse(readFileSync(process.env.WCFG, "utf8"));
const els = {}; const mk = (id)=>({id,textContent:"",innerHTML:"",children:[],setAttribute(){},addEventListener(){},appendChild(c){this.children.push(c)}});
for (const id of ["cTotal","lTotal","cGreen","cYellow","cRed","cGrey","cNoLoc","cUndec","cNet","gwlist","empty","foot","map"]) els[id]=mk(id);
const ctx={document:{getElementById:(i)=>els[i]||null,createElement:()=>mk("li")},window:{},console:{log(){}},setTimeout(){},Date,Math,Number,String,Array,Object,JSON,isFinite,parseInt,parseFloat};
ctx.globalThis=ctx; vm.createContext(ctx);
new vm.Script(HTML.match(/<script>([\s\S]*?)<\/script>/)[1]).runInContext(ctx);

// ΑΚΡΙΒΩΣ ό,τι κάνει η onStart της σελίδας, με τις ΖΩΝΤΑΝΕΣ παραμέτρους
const ps = W.parameters;
for (const p of ps) if (p.key === "gateway_names") ctx.GW_NAMES = JSON.parse(p.value);
for (const p of ps) if (p.key === "fleet_roster") ctx.applyRoster(JSON.parse(p.value));

const now = new Date().toISOString();
const G = [
  ["10011672","green","ΛΕΙΤΟΥΡΓΕΙ",0.1,11,35.339863,25.162653],
  ["10007636","green","ΛΕΙΤΟΥΡΓΕΙ",0.0,11,35.340664,25.16161],
  ["1000C238","green","ΛΕΙΤΟΥΡΓΕΙ",0.1,7,35.367172,24.731691],
  ["100151FF","green","ΛΕΙΤΟΥΡΓΕΙ",0.2,2,35.340664,25.16161],
  ["1000F992","green","ΛΕΙΤΟΥΡΓΕΙ",0.1,2,35.28333,25.115557],
  ["10007638","green","ΛΕΙΤΟΥΡΓΕΙ",0.0,2,35.071259,24.772301],
  ["1000F98A","green","ΛΕΙΤΟΥΡΓΕΙ",0.0,1,35.33645,25.17281],
  ["1000AC29","green","ΛΕΙΤΟΥΡΓΕΙ",0.2,1,35.010345,24.871683],
  ["1000ECBE","red","ΔΕΝ ΑΠΑΝΤΑ",7091.2,1,39.775085,22.825647],
  ["10009A7F","red","ΔΕΝ ΑΠΑΝΤΑ",8672.7,1,39.378334,22.935],
].map(([c,col,st,h,n,lat,lng])=>({variable:"gateway_row",value:c,time:now,origin:"6a98855ca06e41000bfae024",
  metadata:{color:col,state:st,sensors:n,age_h:h,rssi:-90,text:"x",location:{lat,lng}}}));
ctx.ingest(G); ctx.render();

console.log("σύνολο", els.cTotal.textContent, "| πράσινα", els.cGreen.textContent,
  "κόκκινα", els.cRed.textContent, "άγνωστα", els.cGrey.textContent,
  "| αδήλωτα", els.cUndec.textContent, "| από δίκτυο", els.cNet.textContent);
console.log("");
let i=0;
for (const li of els.gwlist.children) {
  const t = li.innerHTML.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  if (i++ < 11) console.log(" ", t.slice(0,118));
}
console.log("  … και", els.gwlist.children.length-11, "ακόμη (αδήλωτα)");
