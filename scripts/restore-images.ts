import fs from 'fs';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const b64Dir = path.join(process.cwd(), 'public', 'uploads-b64');

if (!fs.existsSync(b64Dir)) {
  console.log('No base64 directory found. Skipping restoration.');
  process.exit(0);
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let restored = 0;
const files = fs.readdirSync(b64Dir);
for (const file of files) {
  if (file.endsWith('.b64')) {
    const srcPath = path.join(b64Dir, file);
    const originalFilename = file.replace('.b64', '');
    const destPath = path.join(uploadDir, originalFilename);
    
    try {
      const b64Data = fs.readFileSync(srcPath, 'utf8');
      const buf = Buffer.from(b64Data, 'base64');
      fs.writeFileSync(destPath, buf);
      restored++;
    } catch (e: any) {
      console.error(`Error restoring ${file}: ${e.message}`);
    }
  }
}

console.log(`Restored ${restored} images from base64.`);
