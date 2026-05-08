import fs from 'fs';
import path from 'path';

const dir = 'public/uploads';
let total = 0;
for (const file of fs.readdirSync(dir)) {
  total += fs.statSync(path.join(dir, file)).size;
}
console.log('Total MB:', (total / 1024 / 1024).toFixed(2));
