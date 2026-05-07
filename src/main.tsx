import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import App from './App.tsx';
import './index.css';

// Validate connection to Firestore
async function testConnection() {
  // Small delay to allow Firebase to initialize and network to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    console.error("Firestore connection test failed:", error);
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
