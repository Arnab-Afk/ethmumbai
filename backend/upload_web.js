'use strict';
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const envRaw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const PINATA_JWT = envRaw.split('\n').find(l => l.startsWith('PINATA_JWT=')).split('=').slice(1).join('=').trim();

function collectFiles(dir, base) {
  if (!base) base = dir;
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full, base));
    else results.push({ full, relative: path.relative(base, full).replace(/\\/g, '/') });
  }
  return results;
}

const outDir = path.resolve(__dirname, '../web/out');
const files = collectFiles(outDir);
console.log(`Uploading ${files.length} files to Pinata v3 Files API...`);

const form = new FormData();
for (const { full, relative } of files) {
  form.append('file', fs.createReadStream(full), { filename: relative });
}
form.append('name', 'd3ploy-web-landing');

axios.post('https://uploads.pinata.cloud/v3/files', form, {
  maxBodyLength: Infinity,
  headers: {
    Authorization: `Bearer ${PINATA_JWT}`,
    ...form.getHeaders(),
  },
}).then(res => {
  const cid = res.data?.data?.cid;
  console.log('\n✅ Done!');
  console.log('CID:', cid);
  console.log('Gateway:', `https://ipfs.io/ipfs/${cid}`);
}).catch(err => {
  console.error('Error:', JSON.stringify(err.response?.data || err.message, null, 2));
  process.exit(1);
});
