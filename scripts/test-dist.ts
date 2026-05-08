import fs from 'fs';
const buf = fs.readFileSync('dist/uploads/cedar-valley-restaurant.webp');
console.log('Size:', buf.length);
console.log('Hex:', buf.toString('hex').substring(0, 50));
