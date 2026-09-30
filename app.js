import {config} from './config.js';
import {calculate,jakartaDay,nextArrival,csv,DAY,day} from './engine.mjs';
const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(n),money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
let raw,result,view='restock',token='',demo=false;
const today=()=>jakartaDay(); $('arrival').value=nextArrival(today());
function cell(text,cls){const td=document.createElement('td');td.textContent=text;if(cls)td.className=cls;return td;}
function settings(){return {today:today(),arrival:$('arrival').value,windowDays:+$('window').value,safetyDays:+$('safety').value,capacity:+$('capacity').value,shoeWeight:+$('shoe').value,sandalWeight:+$('sandal').value,storeId:config.storeId,storeName:config.storeName};}
function run(){try{result=calculate(raw,settings());$('download').disabled=false;render();}catch(e){result=null;$('message').textContent=e.message;$('workspace').hidden=false;$('gate').hidden=true;$('download').disabled=true;for(const id of ['kpis','chart','articles','tbody','thead'])$(id).replaceChildren();$('capacity-text').textContent='Perhitungan belum tersedia';$('capacity-note').textContent='Perbaiki pengaturan atau sumber, lalu hitung ulang.';$('capacity-bar').style.width='0%';$('count').textContent='';}}
function render(){
  $('workspace').hidden=false;$('gate').hidden=true;
  $('message').textContent=[demo?'MODE DEMO — seluruh angka merupakan data contoh.':'',...result.warnings].filter(Boolean).join(' ');
  $('kpis').replaceChildren();
  for(const [label,value,note] of [['Stok tersedia',fmt(result.available),'Available seluruh SKU'],['Unit terjual',fmt(result.qty),`${$('window').value} hari lengkap terakhir`],['Omzet',money(result.revenue),`${fmt(result.transactions)} pesanan unik`],['Restock disarankan',fmt(result.recommended),`${fmt(result.requested)} kebutuhan sebelum batas kapasitas`]]){
    const el=document.createElement('div');el.className='kpi';for(const [tag,v] of [['span',label],['strong',value],['small',note]]){const c=document.createElement(tag);c.textContent=v;el.append(c);}$('kpis').append(el);
  }
  $('capacity-text').textContent=`${fmt(result.occupied)} / ${fmt(result.capacity)} unit ruang terpakai · ${fmt(Math.max(0,result.capacity-result.occupied))} ruang kosong`;
  $('capacity-bar').style.width=`${Math.min(100,result.capacity?result.occupied/result.capacity*100:100)}%`;
  $('capacity-bar').style.background=result.occupied>=result.capacity?'#c44735':'#087f73';
  $('capacity-note').textContent=result.occupied>result.capacity?`Kelebihan ${fmt(result.occupied-result.capacity)} unit ruang. Restock ditahan; cek daftar take out dan lakukan pemindahan terlebih dahulu.`:`Restock tiba ${$('arrival').value}, mencakup ${result.cycle} hari. Kandidat take out belum dihitung sebagai ruang kosong.`;
  $('chart').replaceChildren();const max=Math.max(1,...result.trend.map(x=>x[1]));
  for(let i=+$('window').value;i>0;i--){const d=new Date(day(today())-i*DAY).toISOString().slice(0,10),q=new Map(result.trend).get(d)??0;const b=document.createElement('div');b.className='bar';b.style.height=`${q/max*100}%`;b.title=`${d}: ${q} pasang`;b.setAttribute('role','img');b.setAttribute('aria-label',b.title);$('chart').append(b);}
  const articles=new Map();for(const r of result.rows){const key=r.sku.match(/^[A-Za-z]+\d+/)?.[0]??r.sku;articles.set(key,(articles.get(key)??0)+r.sold);}
  $('articles').replaceChildren();for(const [key,q] of [...articles].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5)){const el=document.createElement('div');el.className='article';const n=document.createElement('span'),v=document.createElement('strong');n.textContent=key;v.textContent=`${fmt(q)} pasang`;el.append(n,v);$('articles').append(el);}
  if(!$('articles').children.length)$('articles').textContent='Belum ada penjualan dalam periode ini.';table();
}
const definitions={
  restock:{title:'Rekomendasi restock',note:'Prioritas SKU tercepat terjual. Qty disarankan dibatasi ruang kosong aktual; penjualan sebelum kedatangan belum dianggap membuka ruang.',headers:['SKU','Nama barang','Available','Terjual','Rata-rata / hari','Target stok','Kebutuhan','Qty disarankan','Alert'],source:()=>result.restock,values:r=>[r.sku,r.name,r.available,r.sold,fmt(r.rate),r.target,r.need,r.recommended,r.earlyRisk?'Berisiko habis sebelum kiriman':r.recommended<r.need?'Dibatasi kapasitas':'Restock']},
  takeout:{title:'Kandidat take out per SKU',note:'Tidak terjual ≥60 hari. Qty take out mengecualikan stok Reserved. Periksa fisik sebelum pemindahan.',headers:['SKU','Nama barang','On Hand','Reserved','Available','Terakhir terjual','Hari tanpa penjualan','Qty take out'],source:()=>result.takeout,values:r=>[r.sku,r.name,r.onHand,r.reserved,r.available,r.last,r.daysSince,r.takeout]},
  unknown:{title:'Perlu cek umur stok',note:'Tidak ditemukan penjualan SKU ini di riwayat. Belum otomatis take out; pastikan tanggal pertama masuk toko.',headers:['SKU','Nama barang','On Hand','Available','Tindakan'],source:()=>result.unknown,values:r=>[r.sku,r.name,r.onHand,r.available,'Periksa tanggal masuk / riwayat']},
  stock:{title:'Semua stok toko',note:'Location stok dan Lokasi penjualan dipetakan untuk satu toko.',headers:['SKU','Nama barang','Kategori','On Hand','Reserved','Available','Terjual','Terakhir terjual'],source:()=>result.rows,values:r=>[r.sku,r.name,r.category,r.onHand,r.reserved,r.available,r.sold,r.last||'Belum diketahui']}
};
function filtered(){const query=$('search').value.toLowerCase();return definitions[view].source().filter(r=>(r.sku+' '+r.name).toLowerCase().includes(query));}
function table(){if(!result)return;const def=definitions[view];$('table-title').textContent=def.title;$('table-note').textContent=def.note;$('thead').replaceChildren();const tr=document.createElement('tr');for(const h of def.headers){const th=document.createElement('th');th.textContent=h;tr.append(th);}$('thead').append(tr);$('tbody').replaceChildren();
  const rows=filtered();for(const r of rows){const row=document.createElement('tr');def.values(r).forEach((v,i)=>row.append(cell(v,i===1?'name':'')));$('tbody').append(row);}
  if(!rows.length){const tr=document.createElement('tr'),td=cell('Tidak ada SKU dalam tampilan ini.');td.colSpan=def.headers.length;tr.append(td);$('tbody').append(tr);}
  $('count').textContent=`${rows.length} SKU · sumber diperbarui ${raw.fetchedAt?new Date(raw.fetchedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'data contoh'}`;
}
async function load(){
  if(!token)return;$('refresh').disabled=true;$('message').textContent='Memuat stok dan penjualan toko…';
  try{const response=await fetch(config.apiBase+'/data',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const body=await response.json();if(!response.ok)throw Error(body.error||'Gagal membaca data');raw=body;demo=false;$('source').textContent='Data toko · akses tim';$('logout').hidden=false;run();}
  catch(e){raw=null;result=null;$('workspace').hidden=true;$('gate').hidden=false;$('message').textContent=e.message;}
  finally{$('refresh').disabled=!token;}
}
function demoData(){const stock=[['Item Code','Item Name','Location','On Hand','Reserved','Available']],sales=[['SKU','Nama Barang','Lokasi','Tanggal','QTY','amount','Status','No Pesanan']];const t=day(today());
  const items=[['PLH0102BLK-DM-42','Sepatu Derby Black',7,2,2],['PLH0102BLK-DM-43','Sepatu Derby Black',6,0,1],['PSD0648BGE-NN-42','Sandal Beige',9,1,1],['PLH1555WHI-CB-38','Sepatu White',14,2,0],['PSD0999OLV-NN-40','Sandal Olive baru',10,0,0]];
  for(const [sku,name,hand,res,q]of items){stock.push([sku,name,config.storeId,hand,res,hand-res]);if(q)for(let i=1;i<=30;i++)sales.push([sku,name,config.storeName,new Date(t-i*DAY).toISOString().slice(0,10),q,q*250000,'COMPLETED',`DEMO-${i}-${sku}`]);}
  sales.push(['PLH1555WHI-CB-38','Sepatu White',config.storeName,new Date(t-70*DAY).toISOString().slice(0,10),1,200000,'COMPLETED','DEMO-LAMA']);return {stock,sales};}
$('demo').onclick=()=>{raw=demoData();demo=true;token='';$('refresh').disabled=true;$('source').textContent='Demo · data contoh';run();};
$('recalculate').onclick=run;$('refresh').onclick=load;$('search').oninput=table;
$('logout').onclick=()=>{token='';raw=null;result=null;demo=false;$('workspace').hidden=true;$('gate').hidden=false;$('logout').hidden=true;$('refresh').disabled=true;$('source').textContent='Belum terhubung';$('message').textContent='';};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;for(const x of document.querySelectorAll('[data-view]'))x.setAttribute('aria-pressed',String(x===b));table();};
$('download').onclick=()=>{const def=definitions[view],headers=['Toko','Tanggal hitung','Kedatangan','Cakupan hari','Data',...def.headers],rows=filtered().map(r=>[config.storeName,today(),$('arrival').value,result.cycle,demo?'DEMO':'LIVE',...def.values(r)]);const url=URL.createObjectURL(new Blob([csv(headers,rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${demo?'DEMO-':''}${view}-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
if(!config.apiBase||!config.googleClientId){$('setup').textContent='Koneksi privat belum diaktifkan. Ikuti PANDUAN.md untuk mengatur login Google dan backend; demo sudah bisa dicoba.';}
else{ $('setup').textContent='Gunakan akun Google yang sudah diizinkan oleh pengelola.'; const init=()=>{if(!window.google?.accounts?.id)return false;google.accounts.id.initialize({client_id:config.googleClientId,callback:r=>{token=r.credential;load();}});google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with'});return true;};if(!init()){const interval=setInterval(()=>{if(init())clearInterval(interval);},500);setTimeout(()=>{clearInterval(interval);if(!$('google-signin').children.length)$('setup').textContent='Login Google gagal dimuat. Periksa koneksi internet, lalu muat ulang.';},15000);}}
