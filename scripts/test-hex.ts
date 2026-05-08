import https from 'https';

https.get('https://directory-beryl-ten.vercel.app/uploads/cedar-valley-restaurant.webp', (res) => {
  let chunks: Buffer[] = [];
  res.on('data', (chunk) => {
    chunks.push(chunk);
  });
  res.on('end', () => {
    let data = Buffer.concat(chunks);
    console.log('Size:', data.length);
    console.log('Hex:', data.toString('hex').substring(0, 50));
  });
});
