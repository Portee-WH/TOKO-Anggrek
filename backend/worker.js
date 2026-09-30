import {createRemoteJWKSet,jwtVerify,SignJWT,importPKCS8} from 'jose';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
let accessToken='',tokenUntil=0;
async function sheetsToken(env){
  if(accessToken&&Date.now()<tokenUntil)return accessToken;
  const key=await importPKCS8(env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),'RS256');
  const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/spreadsheets.readonly'})
    .setProtectedHeader({alg:'RS256'}).setIssuer(env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const data=await response.json();if(!response.ok||!data.access_token)throw Error('Tidak dapat mengakses akun pembaca sheet.');
  accessToken=data.access_token;tokenUntil=Date.now()+(Number(data.expires_in)-120)*1000;return accessToken;
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin!==env.ALLOWED_ORIGIN)return new Response(JSON.stringify({error:'Origin tidak diizinkan.'}),{status:403,headers});
  headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(request.method!=='GET'||new URL(request.url).pathname!=='/data')return reply({error:'Endpoint tidak ditemukan.'},404);
  try{
    const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)return reply({error:'Silakan login.'},401);
    let payload;try{({payload}=await jwtVerify(token,jwks,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID}));}catch{return reply({error:'Login tidak valid atau kedaluwarsa. Silakan login kembali.'},401);}
    const emails=(env.ALLOWED_EMAILS??'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(payload.email_verified!==true||!emails.includes(String(payload.email??'').toLowerCase()))return reply({error:'Akun ini tidak memiliki akses dashboard.'},403);
    const readerToken=await sheetsToken(env);
    const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.SHEET_ID)}/values:batchGet`);
    url.searchParams.append('ranges',"'stock toko'!A:J");url.searchParams.append('ranges',"'sales toko'!A:P");url.searchParams.set('valueRenderOption','UNFORMATTED_VALUE');url.searchParams.set('dateTimeRenderOption','FORMATTED_STRING');
    const response=await fetch(url,{headers:{Authorization:'Bearer '+readerToken}});if(!response.ok)return reply({error:'Sheet tidak dapat dibaca. Periksa izin Viewer akun pembaca, nama tab, dan aktivasi Sheets API.'},502);
    const data=await response.json();const stock=data.valueRanges?.[0]?.values??[],sourceSales=data.valueRanges?.[1]?.values??[];
    // Jangan kirim Pelanggan, No Telp, atau Catatan ke browser.
    const keep=['SKU','Nama Barang','Lokasi','Tanggal','QTY','amount','Status','No Pesanan'];const head=(sourceSales[0]??[]).map(x=>String(x).trim());
    if(keep.some(h=>!head.includes(h)))return reply({error:'Kolom sales toko berubah; periksa header sumber.'},422);
    const indexes=keep.map(h=>head.indexOf(h));const sales=[keep,...sourceSales.slice(1).map(row=>indexes.map(i=>row[i]??''))];
    return reply({stock,sales,fetchedAt:new Date().toISOString()});
  }catch{return reply({error:'Koneksi backend belum lengkap atau mengalami gangguan. Periksa konfigurasi akun pembaca.'},502);}
}};
