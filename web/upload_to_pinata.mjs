import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';

const envRaw = fs.readFileSync('/Users/ishikabhoyar/Desktop/me/ethmumbai/backend/.env', 'utf8');
const PINATA_JWT = envRaw.split('\n').find(l => l.startsWith('PINATA_JWT=')).split('=').slice(1).join('=').trim();

function collectFiles(dir, base = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full, base));
    else results.push({ full, relative: path.relative(base, full).replace(/\\/g, '/') });
  }
  return results;
}

const outDir = path.resolve('./out');
const files = collectFiles(outDir);
console.log(`Uploading ${files.length} files to Pinata...`);

const form = new FormData();
for (const { full, relative } of files) {
  form.append('file', fs.createReadStream(full), { filename: relative });
}
form.append('pinataMetadata', JSON.stringify({ name: 'd3ploy-web-landing' }));
form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

const res = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
  maxBodyLength: Infinity,
  headers: {
    Authorization: `Bearer ${PINATA_JWT}`,
    ...form.getHeaders(),
  },
});

console.log('\n✅ Done!');
console.log('CID:', res.data.IpfsHash);
console.log('Gateway:', `https://ipfs.io/ipfs/${res.data.IpfsHash}`);
