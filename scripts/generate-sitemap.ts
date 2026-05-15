import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const BASE_URL = 'https://www.halalottawa.ca';

const staticUrls = [
  "/",
  "/news",
  "/events",
  "/jobs",
  "/restaurants",
  "/mosques",
  "/organizations",
  "/grocery",
  "/clothing",
  "/schools",
  "/butchers",
  "/faq",
  "/terms",
  "/privacy-policy",
  "/login",
  "/register",
  "/tools/qibla"
];

async function generateSitemap() {
  console.log("Generating sitemap...");
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let fbApp;
  let db;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    fbApp = initializeApp(firebaseConfig, 'sitemap-generator');
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Generating sitemap with static URLs only.");
  }

  const urls: { loc: string; changefreq: string; priority: string }[] = [];

  // Add static URLs
  for (const url of staticUrls) {
    let priority = "0.8";
    if (url === "/") priority = "1.0";
    else if (["/news", "/events", "/jobs"].includes(url)) priority = "0.9";
    else if (["/faq", "/terms", "/privacy-policy", "/login", "/register"].includes(url)) priority = "0.3";

    urls.push({
      loc: `${BASE_URL}${url}`,
      changefreq: priority === "0.3" ? "monthly" : "daily",
      priority: priority,
    });
  }

  // Fetch dynamic content if DB is available
  if (db) {
    try {
      // 1. Listings
      const listingsQuery = query(collection(db, 'listings'), where('isApproved', '==', true));
      const listingsSnap = await getDocs(listingsQuery);
      listingsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        
        let categoryPath = 'listings';
        if (Array.isArray(data.category) && data.category.length > 0) {
          categoryPath = encodeURIComponent(data.category[0].toLowerCase());
        } else if (typeof data.category === 'string') {
          categoryPath = encodeURIComponent(data.category.toLowerCase());
        }

        urls.push({
          loc: `${BASE_URL}/${categoryPath}/${idPath}`,
          changefreq: "weekly",
          priority: "0.7",
        });
      });

      // 2. News
      const newsQuery = query(collection(db, 'news'), where('isApproved', '==', true));
      const newsSnap = await getDocs(newsQuery);
      newsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        urls.push({
          loc: `${BASE_URL}/news/${idPath}`,
          changefreq: "weekly",
          priority: "0.7",
        });
      });

      // 3. Events
      const eventsQuery = query(collection(db, 'events'), where('isApproved', '==', true));
      const eventsSnap = await getDocs(eventsQuery);
      eventsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        urls.push({
          loc: `${BASE_URL}/events/${idPath}`,
          changefreq: "weekly",
          priority: "0.7",
        });
      });

      // 4. Jobs
      const jobsQuery = query(collection(db, 'jobs'), where('isApproved', '==', true));
      const jobsSnap = await getDocs(jobsQuery);
      jobsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        urls.push({
          loc: `${BASE_URL}/jobs/${idPath}`,
          changefreq: "weekly",
          priority: "0.7",
        });
      });
      console.log(`Added dynamic URLs from Firestore. Total URLs: ${urls.length}`);
    } catch (e) {
      console.error("Error fetching dynamic URLs from Firestore:", e);
    }
  }

  // Generate XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  for (const url of urls) {
    xml += `  <url>\n`;
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += `  </url>\n`;
  }
  
  xml += `</urlset>\n`;

  const outputPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  console.log(`Sitemap written to ${outputPath}`);
}

generateSitemap().catch(console.error);
