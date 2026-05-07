import fs from 'fs';
import path from 'path';

function walkDir(dir) {
    let files = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            files = files.concat(walkDir(filePath));
        } else if (filePath.endsWith('.tsx')) {
            files.push(filePath);
        }
    }
    return files;
}

const files = walkDir('./src');
for(const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Only replace inside src={...} if it's not already having undefined check 
  // actually simpler to just replace any src={expression} with src={(expression) || undefined}
  let newContent = content.replace(/src=\{([^}]+)\}/g, (match, p1) => {
    if (p1.includes('|| undefined')) return match;
    return `src={(${p1}) || undefined}`;
  });
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
}
