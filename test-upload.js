import fetch from 'node-fetch';

async function test() {
  const res = await fetch("http://localhost:3000/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/invalid-image.jpg" })
  });
  console.log(await res.text());
}
test();
