import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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
  await setDoc(doc(db, "test", "write-test"), { ok: true });
  console.log("Write success!");
  process.exit();
}
run().catch(console.error);
