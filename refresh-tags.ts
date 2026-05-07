import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };
import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// fallback for standard Vite usage if it's there
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No API KEY in env.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function check() {
    console.log("Fetching listings...");
    const snap = await getDocs(collection(db, "listings"));
    const listings = snap.docs.map(d => ({id: d.id, ...d.data()}));
    console.log(`Total listings to refresh: ${listings.length}`);
    
    // We will do this in batches of 10 to speed it up.
    for (let i = 0; i < listings.length; i += 10) {
        const batch = listings.slice(i, i + 10);
        console.log(`Processing batch ${i/10 + 1} of ${Math.ceil(listings.length/10)}`);
        
        await Promise.all(batch.map(async (listing: any) => {
            const prompt = `Review the listing mathematically. 
Name: "${listing.name}"
Description: ${listing.description}

1. CATEGORIES: Choose from this EXACT list: ['Restaurants', 'Mosques', 'Organizations', 'Grocery', 'Clothing', 'Schools', 'Butchers'].
   - Only assign 'Restaurants' if it is clearly a restaurant, cafe, bakery, or prominently serves prepared hot food.
   - For mosques, assign 'Mosques'.
   - For grocery or butchers, only assign 'Restaurants' if they have a prominent distinct hot food menu/grill section.
2. CUISINE: If it is a restaurant/grocery with hot food, choose from: ['Turkish', 'Middle Eastern', 'Moroccan', 'Lebanese', 'Syrian', 'Pakistani', 'Afghani', 'Indian', 'Persian', 'Chinese', 'Mediterranean', 'Thai', 'Korean', 'Italian', 'Bangladeshi', 'Mexican'].
3. TYPE: Choose from: ['Bakery', 'Pizza', 'Burgers', 'Cafés', 'Seafood', 'Steakhouse', 'Shawarma', 'Poutine', 'Brunch', 'Breakfast', 'Pho', 'Ramen', 'Fried Chicken', 'Buffet', 'Tacos'].

Return strictly as valid JSON: {"category": ["string"], "cuisine": ["string"], "type": ["string"]}. Return ONLY JSON, no markdown. Use empty arrays if none apply.`;

            let retries = 0;
            let success = false;
            while (retries < 3 && !success) {
                try {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: prompt,
                    });
                    const text = response.text || "";
                    const match = text.match(/\{[\s\S]*\}/);
                    if (match) {
                        const data = JSON.parse(match[0]);
                        let updates: any = {};
                        if (data.category && Array.isArray(data.category)) {
                            updates.category = data.category;
                            const isRest = data.category.includes('Restaurants');
                            updates.types = isRest && Array.isArray(data.type) ? data.type : [];
                            updates.cuisine = isRest && Array.isArray(data.cuisine) ? data.cuisine : [];
                            await updateDoc(doc(db, "listings", listing.id), updates);
                        }
                    }
                    success = true;
                } catch (err: any) {
                    if (err?.message?.includes('429') || err?.status === 429) {
                        retries++;
                        await new Promise(r => setTimeout(r, (2 ** retries) * 2000));
                    } else {
                        break;
                    }
                }
            }
        }));
        
        // Wait a small amount between batches to respect rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log("Finished refreshing tags for all listings!");
    process.exit(0);
}
check();
