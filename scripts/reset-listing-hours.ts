import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0904645018",
  appId: "1:604019460073:web:24cb77107f1819e8e5ad78",
  apiKey: "AIzaSyC0Q3FrK1N1Z4wkwLhkBAJsrtBaKiEjP5I",
  authDomain: "gen-lang-client-0904645018.firebaseapp.com",
  databaseId: "ai-studio-8c45b12a-480e-4fc2-99d6-d2b9d696e7f6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-8c45b12a-480e-4fc2-99d6-d2b9d696e7f6");

async function run() {
  console.log("Fetching all listings from Firestore...");
  const listingsCol = collection(db, "listings");
  const snapshot = await getDocs(listingsCol);
  
  console.log(`Found ${snapshot.docs.length} listings. Resetting 'openingHours' to empty...`);
  
  let successCount = 0;
  for (const docSnap of snapshot.docs) {
    const listingId = docSnap.id;
    const data = docSnap.data();
    try {
      await updateDoc(doc(db, "listings", listingId), {
        openingHours: ""
      });
      console.log(`Successfully reset hours for listing: ${data.name || listingId}`);
      successCount++;
    } catch (err) {
      console.error(`Failed to reset hours for listing ${listingId}:`, err);
    }
  }

  console.log(`Successfully reset hours for ${successCount}/${snapshot.docs.length} listings!`);
  process.exit(0);
}

run().catch(err => {
  console.error("Error executing script:", err);
  process.exit(1);
});
