export const DAY = 86400000;
export function jakartaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function day(s) {
  if(typeof s==='number') return Math.floor(s-25569)*DAY;
  const v=String(s??'').trim();
  let m=v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return Date.UTC(+m[1],+m[2]-1,+m[3]);
  m=v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  return m ? Date.UTC(+m[3],+m[2]-1,+m[1]) : NaN;
}
export function num(v){
  if(typeof v==='number') return v;
  // Sumber memakai format angka Inggris: amount contoh 794,660.
  const s=String(v??'').trim(); if(!s) return 0;
  const n=Number(s.replace(/,/g,'')); return Number.isFinite(n)?n:NaN;
}
export function objects(values, required) {
  const headers=(values[0]??[]).map(x=>String(x).trim());
  for(const h of required) if(!headers.includes(h)) throw Error(`Kolom sumber tidak ditemukan: ${h}`);
  return values.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export function nextArrival(today){let t=day(today); while(![2,5].includes(new Date(t).getUTCDay()))t+=DAY; return new Date(t).toISOString().slice(0,10);}
export function cycleDays(arrival){const w=new Date(day(arrival)).getUTCDay(); if(w===2)return 3;if(w===5)return 4;throw Error('Pilih tanggal Selasa atau Jumat.');}
export function calculate(raw, settings){
  const {today,arrival,windowDays=30,safetyDays=1,capacity=1500,shoeWeight=1,sandalWeight=1,storeId='8',storeName='Toko Anggrek'}=settings;
  const t=day(today), a=day(arrival), cycle=cycleDays(arrival);
  if(!Number.isFinite(t)||!Number.isFinite(a)||![windowDays,capacity,shoeWeight,sandalWeight,safetyDays].every(Number.isFinite)||a<t||windowDays<1||capacity<0||shoeWeight<=0||sandalWeight<=0||safetyDays<0)throw Error('Pengaturan perhitungan tidak valid.');
  const stocks=objects(raw.stock,['Item Code','Item Name','Location','On Hand','Reserved','Available']);
  const sales=objects(raw.sales,['SKU','Lokasi','Tanggal','QTY','amount','Status','No Pesanan']);
  const metrics=new Map(), trend=new Map(),orders=new Set(), warnings=[];
  let revenue=0,qty=0,invalidDates=0,invalidNumbers=0,earliest=Infinity;
  for(const r of sales){
    if(String(r.Lokasi).trim()!==storeName)continue;
    const d=day(r.Tanggal); if(!Number.isFinite(d)){invalidDates++;continue;} earliest=Math.min(earliest,d);
    if(String(r.Status).trim().toUpperCase()!=='COMPLETED'||d>t)continue;
    const q=num(r.QTY),amount=num(r.amount); if(!Number.isFinite(q)||!Number.isFinite(amount)){invalidNumbers++;continue;} if(q<=0)continue;
    const sku=String(r.SKU).trim();if(!sku)continue;
    const m=metrics.get(sku)??{qty:0,last:-Infinity};m.last=Math.max(m.last,d);
    if(d>=t-windowDays*DAY&&d<t){m.qty+=q;qty+=q;revenue+=amount; if(r['No Pesanan'])orders.add(r['No Pesanan']);
      const date=new Date(d).toISOString().slice(0,10);trend.set(date,(trend.get(date)??0)+q);}
    metrics.set(sku,m);
  }
  if(invalidDates||invalidNumbers)throw Error(`${invalidDates} tanggal dan ${invalidNumbers} angka penjualan tidak valid. Perbaiki sumber sebelum menghitung.`);
  if(earliest>t-windowDays*DAY)warnings.push(`Riwayat sumber belum mencakup ${windowDays} hari penuh; rata-rata dapat terlalu rendah.`);
  // Setiap baris SKU di lokasi toko adalah stok fisik terpisah (termasuk versi laser).
  const grouped=new Map();
  for(const r of stocks){
    if(String(r.Location).trim()!==storeId)continue;
    const sku=String(r['Item Code']).trim();if(!sku)continue;
    const values=['On Hand','Reserved','Available'].map(k=>num(r[k]));
    if(!values.every(Number.isFinite))throw Error(`Angka stok tidak valid: ${sku}`);
    const g=grouped.get(sku)??{'Item Code':sku,names:new Set(),'On Hand':0,Reserved:0,Available:0};
    g.names.add(String(r['Item Name']).trim());
    ['On Hand','Reserved','Available'].forEach((k,i)=>g[k]+=values[i]);
    grouped.set(sku,g);
  }
  const map=new Map();
  for(const r of grouped.values()){
    const sku=r['Item Code'];
    const onHand=num(r['On Hand']),reserved=num(r.Reserved),available=num(r.Available);
    if(![onHand,reserved,available].every(Number.isFinite))throw Error(`Angka stok tidak valid: ${sku}`);
    const name=[...r.names].filter(Boolean).join(' / '); const category=/sandal/i.test(name)?'Sandal':/sepatu|boots|loafer|oxford|derby/i.test(name)?'Sepatu':'Lainnya';
    const weight=category==='Sandal'?sandalWeight:shoeWeight;
    const m=metrics.get(sku)??{qty:0,last:-Infinity},rate=m.qty/windowDays;
    const target=Math.ceil(rate*(cycle+safetyDays));
    const projectedAvailable=Math.max(0,available-rate*((a-t)/DAY));
    const need=Math.max(0,Math.ceil(target-projectedAvailable));
    const daysSince=Number.isFinite(m.last)?Math.floor((t-m.last)/DAY):null;
    map.set(sku,{sku,name,category,weight,onHand,reserved,available,sold:m.qty,rate,last:Number.isFinite(m.last)?new Date(m.last).toISOString().slice(0,10):'',daysSince,target,need,recommended:0,
      takeout:daysSince!==null&&daysSince>=60?Math.max(0,Math.floor(Math.min(available,onHand-reserved))):0,
      earlyRisk:rate>0&&available<rate*((a-t)/DAY),unknownAge:daysSince===null&&onHand>0});
  }
  if(!map.size)throw Error('Tidak ditemukan stok untuk ID lokasi yang dipilih. Periksa pemetaan Location dan Lokasi.');
  const rows=[...map.values()],occupied=rows.reduce((s,r)=>s+Math.max(0,r.onHand)*r.weight,0);
  let space=Math.max(0,capacity-occupied);
  // Prioritas tercepat terjual, lalu hari stok terpendek. Take out belum dianggap sudah dilakukan.
  const restock=rows.filter(r=>r.need>0).sort((x,y)=>y.rate-x.rate||(x.available/x.rate-y.available/y.rate)||x.sku.localeCompare(y.sku));
  for(const r of restock){r.recommended=Math.min(r.need,Math.floor((space+1e-9)/r.weight));space-=r.recommended*r.weight;}
  const missing=[...metrics].filter(([sku,m])=>m.qty>0&&!map.has(sku));
  if(missing.length)warnings.push(`${missing.length} SKU terjual tidak ditemukan di stock toko; perlu cek database.`);
  if(rows.some(r=>r.available<0))warnings.push('Ada Available negatif; kebutuhan memakai nol sebagai dasar.');
  if(earliest>t-60*DAY)warnings.push('Riwayat belum mencakup 60 hari; barang tanpa penjualan harus dicek manual.');
  return {rows,restock,takeout:rows.filter(r=>r.takeout>0).sort((x,y)=>y.daysSince-x.daysSince),unknown:rows.filter(r=>r.unknownAge),warnings,trend:[...trend].sort(),qty,revenue,transactions:orders.size,occupied,space,capacity,cycle,
    available:rows.reduce((s,r)=>s+r.available,0),requested:restock.reduce((s,r)=>s+r.need,0),recommended:restock.reduce((s,r)=>s+r.recommended,0)};
}
export function csv(headers,rows){const cell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');}
