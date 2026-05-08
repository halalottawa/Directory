import https from 'https';

https.get('https://directory-beryl-ten.vercel.app/uploads/cedar-valley-restaurant.webp', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk.toString('utf8');
  });
  res.on('end', () => {
    console.log('First 200 bytes of body:');
    console.log(data.substring(0, 200));
  });
}).on('error', (e) => {
  console.error(e);
});
