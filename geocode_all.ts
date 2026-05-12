import { db } from './src/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

async function geocode(address: string): Promise<[number, number] | null> {
  const cleanAddress = address.replace(/(?:Unit|Apt|Suite|#|Room)\s*[A-Za-z0-9\-]+/gi, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').trim();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanAddress)}&format=json&limit=1`, {
      headers: { 
        'Accept-Language': 'en',
        'User-Agent': 'HalalOttawaApp/1.0 (test@example.com)'
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (err) {
    console.error("Error geocoding", address, err);
  }
  return null;
}

async function run() {
  const q = collection(db, 'listings');
  const snap = await getDocs(q);
  console.log(`Found ${snap.docs.length} listings. Geocoding...`);
  for (const item of snap.docs) {
    const data = item.data();
    if (data.address && (!data.lat || data.lat === 45.4215)) {
      console.log(`Geocoding ${data.name}: ${data.address}...`);
      const coords = await geocode(data.address);
      if (coords) {
        await updateDoc(doc(db, 'listings', item.id), {
          lat: coords[0],
          lng: coords[1]
        });
        console.log(`Updated ${data.name} to [${coords[0]}, ${coords[1]}]`);
      } else {
         console.log(`Could not geocode ${data.address}`);
      }
      await new Promise(r => setTimeout(r, 1000)); // Rate limit
    } else {
        console.log(`Skipping ${data.name} (already geocoded or no address)`);
    }
  }
  console.log("Done");
}

run().catch(console.error);
