import fs from 'fs';
const buf = fs.readFileSync('public/uploads/cedar-valley-restaurant.webp');
console.log('Size:', buf.length);
console.log('Hex:', buf.toString('hex').substring(0, 50));
console.log('UTF8:', buf.toString('utf8').substring(0, 100));
