import { execSync } from 'child_process';
console.log(execSync('git log -p -n 3 src/pages/Listings.tsx src/pages/Events.tsx').toString());
