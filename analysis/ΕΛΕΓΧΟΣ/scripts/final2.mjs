import { readFileSync } from "node:fs";
import vm from "node:vm";
const HTML = readFileSync(process.env.LIVE, "utf8");
const W = JSON.parse(readFileSync(process.env.WCFG, "utf8"));
const els = {}; const mk=(id)=>({id,textContent:"",innerHTML:"",children:[],setAttribute(){},addEventListener(){},appendChild(c){this.children.push(c)}});
for (const id of ["cTotal","lTotal","cGreen","cYellow","cRed","cGrey","cNoLoc","cUndec","cNet","gwlist","empty","foot","map"]) els[id]=mk(id);
const ctx={document:{getElementById:(i)=>els[i]||null,createElement:()=>mk("li")},window:{},console:{log(){}},setTimeout(){},Date,Math,Number,String,Array,Object,JSON,isFinite,parseInt,parseFloat};
ctx.globalThis=ctx; vm.createContext(ctx);
new vm.Script(HTML.match(/<script>([\s\S]*?)<\/script>/)[1]).runInContext(ctx);
for (const p of W.parameters) if (p.key==="gateway_names") ctx.GW_NAMES=JSON.parse(p.value);
for (const p of W.parameters) if (p.key==="fleet_roster") ctx.applyRoster(JSON.parse(p.value));
const now=new Date().toISOString();
const G=[
 ["10011672","green","ΛΕΙΤΟΥΡΓΕΙ",0.13,11],["10007636","green","ΛΕΙΤΟΥΡΓΕΙ",0.07,10],
 ["1000C238","green","ΛΕΙΤΟΥΡΓΕΙ",0.05,8],["10007638","green","ΛΕΙΤΟΥΡΓΕΙ",0.07,2],
 ["1000F992","green","ΛΕΙΤΟΥΡΓΕΙ",0.12,2],["100151FF","green","ΛΕΙΤΟΥΡΓΕΙ",0.27,1],
 ["10006847","green","ΛΕΙΤΟΥΡΓΕΙ",0.27,1],["1000F98A","orange","ΑΡΑΙΟΣ ΜΑΡΤΥΡΑΣ",1.0,1],
 ["1000ECBE","red","ΧΩΡΙΣ ΠΡΟΣΦΑΤΟ ΜΑΡΤΥΡΑ",7104,1],["10009A7F","red","ΧΩΡΙΣ ΠΡΟΣΦΑΤΟ ΜΑΡΤΥΡΑ",8664,1],
].map(([c,col,st,h,n])=>({variable:"gateway_row",value:c,time:now,origin:"6a98855ca06e41000bfae024",
 metadata:{color:col,state:st,sensors:n,age_h:h,rssi:-90,text:"x",location:{lat:35.1,lng:25.1}}}));
G.unshift({variable:"gateway_summary",value:"8 με απόδειξη ζωής από 10 ορατά",time:now,origin:"6a98855ca06e41000bfae024",
 metadata:{sensors_seen:38,sensors_total:220,total:10,alive:8,suspect:1,dead:2}});
ctx.ingest(G); ctx.render();
console.log("ΠΛΑΚΙΔΙΑ  σύνολο",els.cTotal.textContent,"| με απόδειξη ζωής",els.cGreen.textContent,
 "| αραιός μάρτυρας",els.cYellow.textContent,"| χωρίς πρόσφατο μάρτυρα",els.cRed.textContent,
 "| άγνωστα",els.cGrey.textContent,"| αδήλωτα",els.cUndec.textContent,"| από δίκτυο",els.cNet.textContent);
console.log("\nΥΠΟΣΕΛΙΔΟ:");
for (const line of els.foot.textContent.match(/.{1,110}(\s|$)/g)) console.log("  "+line.trim());
