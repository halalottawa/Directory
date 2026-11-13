import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, setLogLevel } from 'firebase/firestore';
import { buildMainSitemapXml, buildNewsSitemapXml } from '../src/utils/sitemapBuilder';
import { isFirestoreQuotaError, getFallbackListings, getFallbackNews } from '../src/utils/firestoreQuotaFallback';

async function generateSitemap() {
  console.log("Generating sitemaps...");
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let fbApp;
  let db;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    fbApp = initializeApp(firebaseConfig, 'sitemap-generator');
    try {
      setLogLevel('silent');
    } catch {}
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Generating sitemaps with static URLs only.");
  }

  let allApprovedListings: any[] = [];
  let allApprovedNews: any[] = [];
  let allApprovedReviews: any[] = [];

  if (db) {
    try {
      const [listingsSnap, newsSnap, reviewsSnap] = await Promise.all([
        getDocs(query(collection(db, 'listings'), where('isApproved', '==', true))),
        getDocs(query(collection(db, 'news'), where('isApproved', '==', true))),
        getDocs(query(collection(db, 'reviews'), where('isApproved', '==', true))),
      ]);

      listingsSnap.forEach((docSnap) => {
        allApprovedListings.push({ id: docSnap.id, ...docSnap.data() });
      });

      newsSnap.forEach((docSnap) => {
        allApprovedNews.push({ id: docSnap.id, ...docSnap.data() });
      });

      reviewsSnap.forEach((docSnap) => {
        allApprovedReviews.push({ id: docSnap.id, ...docSnap.data() });
      });

      console.log(`Fetched ${allApprovedListings.length} approved listings, ${allApprovedNews.length} approved news articles, and ${allApprovedReviews.length} approved reviews from Firestore.`);
    } catch (e) {
      if (!isFirestoreQuotaError(e)) {
        console.error("Error fetching dynamic URLs from Firestore:", e);
      }
      allApprovedListings = getFallbackListings();
      allApprovedNews = getFallbackNews();
    }
  } else {
    allApprovedListings = getFallbackListings();
    allApprovedNews = getFallbackNews();
  }

  const excludedPaths = new Set<string>();
  try {
    const redirectsPath = path.resolve(process.cwd(), 'redirects.json');
    if (fs.existsSync(redirectsPath)) {
      const parsed = JSON.parse(fs.readFileSync(redirectsPath, 'utf-8'));
      if (parsed?.redirects && typeof parsed.redirects === 'object') {
        for (const k of Object.keys(parsed.redirects)) {
          const norm = String(k || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
          excludedPaths.add(norm);
        }
      }
      if (Array.isArray(parsed?.gone)) {
        for (const g of parsed.gone) {
          const norm = String(g || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
          excludedPaths.add(norm);
        }
      }
    }
  } catch (err) {
    console.warn("Could not read redirects.json during sitemap generation:", err);
  }

  // 1. Build Main Sitemap (sitemap.xml)
  const { xml: mainXml, entries: mainEntries } = buildMainSitemapXml(allApprovedListings, allApprovedNews, {
    reviews: allApprovedReviews,
    excludedPaths,
  });
  const outputPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, mainXml, 'utf-8');
  console.log(`Main sitemap (${mainEntries.length} unique URLs) written to ${outputPath}`);

  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    const distLogPath = path.join(distPath, 'sitemap.xml');
    fs.writeFileSync(distLogPath, mainXml, 'utf-8');
    console.log(`Main sitemap written to ${distLogPath}`);
  }

  // 2. Build Google News Sitemap (sitemap-news.xml)
  const { xml: newsXml, entries: newsEntries } = buildNewsSitemapXml(allApprovedNews);
  const outputNewsPath = path.resolve(process.cwd(), 'public', 'sitemap-news.xml');
  fs.writeFileSync(outputNewsPath, newsXml, 'utf-8');
  console.log(`News sitemap (${newsEntries.length} unique qualifying articles) written to ${outputNewsPath}`);

  if (fs.existsSync(distPath)) {
    const distNewsPath = path.join(distPath, 'sitemap-news.xml');
    fs.writeFileSync(distNewsPath, newsXml, 'utf-8');
    console.log(`News sitemap written to ${distNewsPath}`);
  }
}

generateSitemap().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
