import {test} from 'node:test';import assert from 'node:assert/strict';import {calculate,csv,day,nextArrival} from '../engine.mjs';
const sh=['Item Code','Item Name','Location','On Hand','Reserved','Available'];
const sa=['SKU','Lokasi','Tanggal','QTY','amount','Status','No Pesanan'];
const base={today:'2026-09-29',arrival:'2026-09-29',storeId:'8',storeName:'Toko Anggrek'};
const sales=(sku,q=2)=>Array.from({length:30},(_,i)=>[sku,'Toko Anggrek',new Date(day(base.today)-(i+1)*86400000).toISOString().slice(0,10),q,q*100000,'COMPLETED',`ORD-${i}`]);
test('Selasa 3 hari, Jumat 4 hari, kapasitas default 1500',()=>{const raw={stock:[sh,['A','Sepatu',8,3,0,3]],sales:[sa,...sales('A')]};const tue=calculate(raw,base);assert.equal(tue.restock[0].need,5);assert.equal(tue.capacity,1500);assert.equal(tue.cycle,3);const fri=calculate(raw,{...base,today:'2026-09-29',arrival:'2026-10-02'});assert.equal(fri.cycle,4);assert.equal(fri.restock[0].need,10);});
test('Kapasitas penuh menahan restock; take out belum membuka ruang',()=>{const r=calculate({stock:[sh,['A','Sepatu',8,1500,1500,0],['B','Sandal',8,20,2,18]],sales:[sa,...sales('A'),['B','Toko Anggrek','2026-07-01',1,100,'COMPLETED','OLD']]},base);assert.equal(r.recommended,0);assert.equal(r.takeout[0].takeout,18);});
test('Prioritas cepat terjual dibatasi ruang berbobot',()=>{const r=calculate({stock:[sh,['A','Sepatu',8,0,0,0],['B','Sandal',8,0,0,0]],sales:[sa,...sales('A',2),...sales('B',1)]},{...base,capacity:5,shoeWeight:2});assert.equal(r.restock[0].sku,'A');assert.equal(r.restock[0].recommended,2);assert.equal(r.restock[1].recommended,1);});
test('Take out tepat 60 hari, penjualan hari ini mencegah take out dan tidak masuk rata-rata',()=>{const cutoff=new Date(day(base.today)-60*86400000).toISOString().slice(0,10);const r=calculate({stock:[sh,['A','Sepatu',8,2,0,2],['B','Sepatu',8,2,0,2],['C','Sepatu',8,2,0,2]],sales:[sa,['A','Toko Anggrek',cutoff,1,100,'COMPLETED','OLD'],['B','Toko Anggrek',cutoff,1,100,'COMPLETED','OLD2'],['B','Toko Anggrek',base.today,1,100,'COMPLETED','NOW']]},base);assert.deepEqual(r.takeout.map(x=>x.sku),['A']);assert.equal(r.qty,0);assert.equal(r.unknown[0].sku,'C');});
test('Pesanan unik, filter toko/status, parsing angka Inggris',()=>{const r=calculate({stock:[sh,['A','Sepatu',8,10,0,10]],sales:[sa,['A','Toko Anggrek','28-09-2026 14:10',1,'794,660','COMPLETED','ONE'],['A','Toko Anggrek','28-09-2026 14:20',1,200000,'COMPLETED','ONE'],['A','Toko Lain','28-09-2026',99,10,'COMPLETED','X'],['A','Toko Anggrek','28-09-2026',10,10,'CANCELLED','X']]},base);assert.equal(r.transactions,1);assert.equal(r.qty,2);assert.equal(r.revenue,994660);});
test('Header gagal jelas; CSV aman dari rumus',()=>{assert.throws(()=>calculate({stock:[['SKU']],sales:[sa]},base),/Kolom sumber/);assert.ok(csv(['SKU'],[['=HYPERLINK(1)']]).includes("'=HYPERLINK"));assert.equal(nextArrival('2026-09-30'),'2026-10-02');});

test('Stok biasa dan laser dijumlahkan per SKU; penjualan digabung tanpa berlipat',()=>{
 const r=calculate({stock:[sh,['A','Sepatu biasa',8,3,1,2],['A','Sepatu laser',8,2,0,2],['A','Sepatu lain',9,100,0,100]],sales:[sa,...sales('A',1),...sales('A',1)]},{...base,capacity:8});
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].onHand,5);assert.equal(r.rows[0].reserved,1);assert.equal(r.rows[0].available,4);
 assert.equal(r.rows[0].sold,60);assert.equal(r.rows[0].rate,2);assert.equal(r.rows[0].need,4);assert.equal(r.rows[0].recommended,3);assert.equal(r.occupied,5);
 assert.equal(r.rows[0].name,'Sepatu biasa / Sepatu laser');
});
