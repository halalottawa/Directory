import fs from 'fs';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
const b64Dir = path.join(process.cwd(), 'public', 'uploads-b64');

if (!fs.existsSync(b64Dir)) {
  fs.mkdirSync(b64Dir, { recursive: true });
}

const files = fs.readdirSync(uploadDir);
for (const file of files) {
  if (file.endsWith('.webp') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
    const srcPath = path.join(uploadDir, file);
    const destPath = path.join(b64Dir, `${file}.b64`);
    
    // Only encode if it's a valid local binary (e.g. not corrupted)
    // We assume local environment has correct files
    const buf = fs.readFileSync(srcPath);
    fs.writeFileSync(destPath, buf.toString('base64'));
    console.log(`Encoded ${file} to b64`);
  }
}

console.log('All images encoded to base64.');
