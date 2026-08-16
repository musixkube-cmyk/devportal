// Read .env the way Next.js would
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const lines = env.split('\n');
const vars = {};
for (const line of lines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    vars[m[1]] = val;
  }
}
const URL = vars.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SRVC = vars.SUPABASE_SERVICE_ROLE_KEY || '';
console.log('NEXT_PUBLIC_SUPABASE_URL:', URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY (length):', ANON.length, '(first 30 chars):', ANON.slice(0,30)+'...');
console.log('SUPABASE_SERVICE_ROLE_KEY (length):', SRVC.length, '(first 30 chars):', SRVC.slice(0,30)+'...');
console.log('IS_SUPABASE_CONFIGURED:', Boolean(URL && ANON));
console.log('');
console.log('Decoded JWT payloads:');
function decode(jwt) {
  try {
    const parts = jwt.split('.');
    const payload = Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString();
    return JSON.parse(payload);
  } catch(e) { return null; }
}
console.log('ANON payload:', decode(ANON));
console.log('SERVICE_ROLE payload:', decode(SRVC));
