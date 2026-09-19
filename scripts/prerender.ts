import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where, limit, orderBy } from 'firebase/firestore';
import {
  renderHomeSSRHtml,
  renderCategorySSRHtml,
  renderListingDetailSSRHtml,
  renderNewsDetailSSRHtml,
  renderNewsListSSRHtml,
  renderFAQSSRHtml,
  renderPrivacyPolicySSRHtml,
  renderTermsSSRHtml,
  renderQiblaSSRHtml,
  renderSavedItemsSSRHtml,
  renderLoginSSRHtml,
  renderAddListingSSRHtml,
  renderNotFoundSSRHtml
} from '../src/utils/ssrTemplates';

const BASE_URL = 'https://www.halalottawa.ca';

const staticUrls = [
  "/",
  "/listings",
  "/news",
  "/restaurants",
  "/restaurants/orleans",
  "/restaurants/kanata",
  "/restaurants/barrhaven",
  "/restaurants/downtown",
  "/restaurants/bakery",
  "/restaurants/pizza",
  "/restaurants/burgers",
  "/restaurants/cafes",
  "/restaurants/seafood",
  "/restaurants/steakhouse",
  "/restaurants/shawarma",
  "/restaurants/poutine",
  "/restaurants/brunch",
  "/restaurants/breakfast",
  "/restaurants/pho",
  "/restaurants/ramen",
  "/restaurants/fried-chicken",
  "/restaurants/buffet",
  "/restaurants/tacos",
  "/restaurants/turkish",
  "/restaurants/middle-eastern",
  "/restaurants/moroccan",
  "/restaurants/lebanese",
  "/restaurants/syrian",
  "/restaurants/pakistani",
  "/restaurants/afghani",
  "/restaurants/indian",
  "/restaurants/persian",
  "/restaurants/chinese",
  "/restaurants/mediterranean",
  "/restaurants/thai",
  "/restaurants/korean",
  "/restaurants/italian",
  "/restaurants/bangladeshi",
  "/restaurants/mexican",
  "/restaurants/ethiopian",
  "/mosques",
  "/organizations",
  "/grocery",
  "/clothing",
  "/schools",
  "/butchers",
  "/faq",
  "/terms",
  "/privacy-policy",
  "/tools/qibla"
];

// Helper functions for secure character escaping and robust schema URLs
function escapeHtmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateDescription(text: string, maxLength = 155): string {
  if (!text || text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 100 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

function getAbsoluteUrl(urlStr: string): string {
  if (!urlStr) return "https://www.halalottawa.ca/default-og.jpg";
  let url = urlStr;
  
  if (url.includes('.run.app') && !url.startsWith('http')) {
    url = 'https://' + url;
  }

  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    url = url.replace(/ais-pre-o3grau7ukgun6nvnjrynhh-118138859761\.us-east5\.run\.app/gi, 'www.halalottawa.ca');
    url = url.replace(/ais-dev-o3grau7ukgun6nvnjrynhh-118138859761\.us-east5\.run\.app/gi, 'www.halalottawa.ca');
    url = url.replace(/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.run\.app/gi, 'www.halalottawa.ca');
    return url;
  }
  return `https://www.halalottawa.ca${urlStr.startsWith("/") ? "" : "/"}${urlStr}`;
}

function cleanPriceStr(priceVal: any): string {
  if (priceVal === undefined || priceVal === null) return "0";
  const str = String(priceVal).trim();
  if (str.toLowerCase() === 'free' || str === '0') return "0";
  const numOnly = str.replace(/[^0-9.]/g, '');
  return numOnly || "0";
}

function normalizeCategoryToSlug(cat: string): string {
  if (!cat) return 'listings';
  const c = cat.toLowerCase().trim();
  if (c.includes('restaurant')) return 'restaurants';
  if (c.includes('mosque') || c.includes('masjid')) return 'mosques';
  if (c.includes('organization')) return 'organizations';
  if (c.includes('grocery')) return 'grocery';
  if (c.includes('clothing')) return 'clothing';
  if (c.includes('school')) return 'schools';
  if (c.includes('butcher')) return 'butchers';
  return c.trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]+/g, '');
}

function getPrerenderOptimizedImageUrl(url: string | null | undefined, width: number = 800, height?: number): string | undefined {
  if (!url) return undefined;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith('data:') || lowerUrl.endsWith('.svg') || lowerUrl.includes('google.com/images/') || lowerUrl.includes('.gstatic.com/') || lowerUrl.includes('r2.dev') || lowerUrl.includes('r2.cloudflarestorage.com')) {
    return url;
  }
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    let baseUrl = url.split('=')[0];
    const params = [];
    if (width) params.push(`w${width}`);
    if (height) params.push(`h${height}`);
    params.push('c');
    return `${baseUrl}=${params.join('-')}`;
  }
  if (url.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', '85');
      urlObj.searchParams.set('fit', 'crop');
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    } catch (e) {
      return url;
    }
  }
  if (url.includes('res.cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const transform = `w_${width}${height ? `,h_${height}` : ''},c_fill,q_85,f_auto`;
      return `${parts[0]}/upload/${transform}/${parts[1]}`;
    }
  }
  const params: string[] = [`url=${encodeURIComponent(url)}`, `w=${width}`];
  if (height) params.push(`h=${height}`);
  params.push('q=85');
  return `/api/optimize-image?${params.join('&')}`;
}

// Helper to ensure directory exists
function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function getNeighborhoodFromAddress(address: string = '', suburb: string = ''): 'orleans' | 'kanata' | 'barrhaven' | 'downtown' | null {
  const normalizedAddr = (address || '').toLowerCase();
  const normalizedSub = (suburb || '').toLowerCase();
  const combined = `${normalizedSub} ${normalizedAddr}`;

  // 1. Direct Postal Code / Forward Sortation Area (FSA) matching
  const fsaMatch = combined.match(/\b([kK][0-2][a-zA-Z])\s?\d/);
  if (fsaMatch) {
    const fsa = fsaMatch[1].toUpperCase();
    if (['K1C', 'K1E', 'K1W', 'K4A'].includes(fsa)) return 'orleans';
    if (['K2K', 'K2L', 'K2M', 'K2T', 'K2S', 'K2V'].includes(fsa)) return 'kanata';
    if (['K2J', 'K2R'].includes(fsa)) return 'barrhaven';
    if (['K1N', 'K1P', 'K1R', 'K1S', 'K1Y', 'K1A', 'K2P', 'K1Z'].includes(fsa)) return 'downtown';
    if (['K2G'].includes(fsa)) {
      if (combined.includes('barrhaven') || combined.includes('chapman') || combined.includes('strandherd') || combined.includes('longfields')) {
        return 'barrhaven';
      }
    }
  }

  // 2. Suburb or Neighborhood Name Keyword Matching
  const orleansKeywords = [
    'orleans', 'orléans', 'convent glen', 'chateauneuf', 'queenswood', 'fallingbrook', 
    'chatelaine village', 'cardinal creek', 'avalon', 'notting gate', 'chapel hill',
    'cumberland', 'blackburn hamlet', 'bilberry creek'
  ];
  if (orleansKeywords.some(keyword => combined.includes(keyword))) return 'orleans';

  const kanataKeywords = [
    'kanata', 'stittsville', 'glen cairn', 'hazeldean', 'beaverbrook', 'katimavik', 
    'morgan\'s grant', 'morgans grant', 'bridlewood', 'emerald meadows', 'carp'
  ];
  if (kanataKeywords.some(keyword => combined.includes(keyword))) return 'kanata';

  const barrhavenKeywords = [
    'barrhaven', 'stonebridge', 'half moon bay', 'chapman mills', 'longfields', 
    'davidson heights', 'jockvale', 'cedarhill', 'orchard estates', 'manotick'
  ];
  if (barrhavenKeywords.some(keyword => combined.includes(keyword))) return 'barrhaven';

  const downtownKeywords = [
    'downtown', 'centretown', 'byward market', 'byward', 'lowertown', 'sandy hill', 
    'the glebe', 'glebe', 'golden triangle', 'lebreton flats', 'hintonburg', 
    'chinatown', 'little italy', 'westboro', 'old ottawa south', 'old ottawa east',
    'centretown west', 'wellington west', 'parliament hill'
  ];
  if (downtownKeywords.some(keyword => combined.includes(keyword))) return 'downtown';

  // 3. Street checks
  const orleansStreets = [
    'st. joseph blvd', 'st joseph blvd', 'st-joseph', 'tenth line', '10th line', 'trim rd', 'trim road',
    'jeanne d\'arc', 'jeanne darc', 'prestone', 'dufount', 'prestwick', 'charette', 'portobello',
    'watters', 'valin', 'charlemagne', 'belcourt', 'cumberland'
  ];
  if (orleansStreets.some(street => normalizedAddr.includes(street))) return 'orleans';
  if (normalizedAddr.includes('innes') && !normalizedAddr.includes('kanata') && !normalizedAddr.includes('barrhaven')) return 'orleans';

  const kanataStreets = [
    'terry fox', 'earl grey', 'campeau', 'march rd', 'march road', 'hazeldean', 
    'eagleson', 'kanata ave', 'castlefrank', 'katimavik road', 'palladium', 'iber rd'
  ];
  if (kanataStreets.some(street => normalizedAddr.includes(street))) return 'kanata';

  const barrhavenStreets = [
    'strandherd', 'marketplace ave', 'berrigan', 'cresthaven', 'chapman mills', 'jockvale'
  ];
  if (barrhavenStreets.some(street => normalizedAddr.includes(street))) return 'barrhaven';
  const blockCheck = normalizedAddr.match(/(\d+)\s+(greenbank|woodroffe)/);
  if (blockCheck && parseInt(blockCheck[1], 10) >= 2800) return 'barrhaven';

  const downtownStreets = [
    'rideau st', 'elgin st', 'laurier ave', 'sparks st', 'dalhousie st', 
    'albert st', 'slater st', 'o\'connor', 'metcalfe', 'kent st', 'lyon st', 
    'gloucester st', 'cooper st', 'lisgar st', 'gladstone', 'somerset st',
    'wellington st', 'preston st', 'clarence st', 'george st', 'york st',
    'queen st', 'bank st'
  ];
  if (downtownStreets.some(street => normalizedAddr.includes(street))) {
    if (normalizedAddr.includes('bank st')) {
      const bankMatch = normalizedAddr.match(/(\d+)\s+bank\s+st/);
      if (bankMatch) {
        const num = parseInt(bankMatch[1], 10);
        if (num < 1300) return 'downtown';
        return null;
      }
    }
    return 'downtown';
  }

  return null;
}

async function prerender() {
  console.log("Starting Static Site Generation (SSG) / Prerendering...");
  
  const distPath = path.resolve(process.cwd(), 'dist');
  const templatePath = path.resolve(distPath, 'index.html');
  
  if (!fs.existsSync(templatePath)) {
    console.error("Error: dist/index.html not found! Run 'vite build' first.");
    process.exit(1);
  }
  
  const baseTemplate = fs.readFileSync(templatePath, 'utf-8');
  try {
    fs.writeFileSync(path.resolve(distPath, 'template.spa.html'), baseTemplate, 'utf-8');
  } catch (spaErr) {
    console.warn("Could not save template.spa.html:", spaErr);
  }
  
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let fbApp;
  let db: any = null;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    fbApp = initializeApp(firebaseConfig, 'prerender-generator');
    db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Prerendering with static URLs only.");
  }

  // We will compile a list of all pages to render
  interface PageToPrerender {
    urlPath: string;
    filePath: string;
    routeType: string;
    initialData?: any;
    title: string;
    description: string;
    ogImage: string;
  }

  const pagesToPrerender: PageToPrerender[] = [];

  // 1. Prepare Static Pages
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const monthYearStr = `${currentMonth} ${currentYear}`;

  for (const url of staticUrls) {
    let title = "Halal Ottawa - Halal Places in Ottawa";
    let description = "Discover verified Halal restaurants, cafes, mosques, grocery stores, schools, and Muslim organizations in Ottawa. Stay connected with community updates and local news.";
    let ogImage = "https://www.halalottawa.ca/default-og.jpg";

    if (url === "/news") {
      title = "Halal Ottawa News - Ottawa's Muslim Community Hub";
      description = "Stay up to date with the latest stories, local community announcements, mosque updates, and community news from Ottawa's Muslim community.";
    } else if (url === "/restaurants") {
      title = `Halal Restaurants in Ottawa - ${monthYearStr}`;
      description = `Discover the best verified halal restaurants and food spots in Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get maps directions.`;
    } else if (url === "/restaurants/orleans") {
      title = `Halal Restaurants in Orleans - ${monthYearStr}`;
      description = `Find the best verified halal restaurants and food spots in Orleans, Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get directions.`;
    } else if (url === "/restaurants/kanata") {
      title = `Halal Restaurants in Kanata - ${monthYearStr}`;
      description = `Find the best verified halal restaurants and food spots in Kanata, Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get directions.`;
    } else if (url === "/restaurants/barrhaven") {
      title = `Halal Restaurants in Barrhaven - ${monthYearStr}`;
      description = `Find the best verified halal restaurants and food spots in Barrhaven, Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get directions.`;
    } else if (url === "/restaurants/downtown") {
      title = `Halal Restaurants in Downtown Ottawa - ${monthYearStr}`;
      description = `Find the best verified halal restaurants and food spots in Downtown, Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get directions.`;
    } else if (url.startsWith("/restaurants/")) {
      const subSlug = url.replace("/restaurants/", "");
      const cleanSub = decodeURIComponent(subSlug).replace(/-/g, " ");
      const formattedSub = cleanSub.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      title = `Halal ${formattedSub} in Ottawa - ${monthYearStr}`;
      description = `Discover the best verified halal ${formattedSub.toLowerCase()} spots and restaurants in Ottawa for ${monthYearStr}. Search by cuisine, read verified reviews, and get directions.`;
    } else if (url === "/mosques") {
      title = `Mosques in Ottawa - ${monthYearStr}`;
      description = `Locate local mosques, musallahs, and Islamic prayer spaces around Ottawa. Find prayer times and Friday khutbah details for ${monthYearStr}.`;
    } else if (url === "/grocery") {
      title = `Halal Grocery in Ottawa - ${monthYearStr}`;
      description = `Find the best halal grocery stores, supermarkets, and specialty food shops in Ottawa offering certified halal products and ingredients for ${monthYearStr}.`;
    } else if (url === "/organizations") {
      title = `Muslim Organizations in Ottawa - ${monthYearStr}`;
      description = `Connect with trusted Islamic organizations, community support networks, and local charities in Ottawa for ${monthYearStr}.`;
    } else if (url === "/clothing") {
      title = `Islamic Clothing in Ottawa - ${monthYearStr}`;
      description = `Explore trusted Islamic clothing stores and boutiques in Ottawa offering modest wear, hijabs, abayas, and thobes for ${monthYearStr}.`;
    } else if (url === "/schools") {
      title = `Islamic Schools in Ottawa - ${monthYearStr}`;
      description = `Browse accredited directories of Islamic schools, preschools, daycares, and weekend Quran educational programs in Ottawa for ${monthYearStr}.`;
    } else if (url === "/butchers") {
      title = `Halal Butchers in Ottawa - ${monthYearStr}`;
      description = `Find certified halal butcher shops and fresh meat markets in Ottawa providing premium hand-slaughtered zabihah meat for ${monthYearStr}.`;
    } else if (url === "/faq") {
      title = "FAQ | Halal Ottawa";
      description = "Got questions about the Halal Ottawa platform? Check out our compiled list of FAQs.";
    } else if (url === "/terms") {
      title = "Terms of Service | Halal Ottawa";
      description = "Read the legal terms of use and service agreements for using the Halal Ottawa website.";
    } else if (url === "/privacy-policy") {
      title = "Privacy Policy | Halal Ottawa";
      description = "Learn how your personal details, submissions, and metrics are secured and managed on Halal Ottawa.";
    } else if (url === "/tools/qibla") {
      title = "Ottawa Qibla Direction - Halal Ottawa";
      description = "Find the Qibla direction online accurately using your device compass and location in Ottawa.";
    }

    const relativeFilePath = url === "/" ? "index.html" : `${url.substring(1)}/index.html`;

    pagesToPrerender.push({
      urlPath: url,
      filePath: path.join(distPath, relativeFilePath),
      routeType: url === "/" ? "home" : "static",
      title,
      description,
      ogImage
    });
  }

  // 2. Fetch and Prepare Dynamic Pages (Listings, News)
  if (db) {
    try {
      console.log("Fetching dynamic contents from Firestore...");

      // Pre-fetch Home Page Initial Data
      try {
        const qListingsHome = query(collection(db, 'listings'), where('isApproved', '==', true), orderBy('createdAt', 'desc'), limit(8));
        const qNewsHome = query(collection(db, 'news'), where('isApproved', '==', true), limit(10));

        const [listingsSnap, newsSnap] = await Promise.all([
          getDocs(qListingsHome), getDocs(qNewsHome)
        ]);

        let listingsData = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        const parseListingTime = (val: any): number => {
          if (!val) return 0;
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          if (typeof val.seconds === 'number') return val.seconds * 1000;
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        listingsData = listingsData.sort((a, b) => parseListingTime(b.createdAt) - parseListingTime(a.createdAt)).slice(0, 8);
        let newsData = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        newsData = newsData.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()).slice(0, 6);

        const homePage = pagesToPrerender.find(p => p.urlPath === "/");
        if (homePage) {
          homePage.initialData = {
            listings: listingsData,
            news: newsData,
            timestamp: Date.now()
          };
        }
      } catch (homeErr) {
        console.error("Error fetching home page pre-fetch data:", homeErr);
      }

      // Listings SSG
      const listingsQuery = query(collection(db, 'listings'), where('isApproved', '==', true));
      const listingsSnap = await getDocs(listingsQuery);
      listingsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        
        let categoryPath = 'listings';
        if (Array.isArray(data.category) && data.category.length > 0) {
          categoryPath = normalizeCategoryToSlug(data.category[0]);
        } else if (typeof data.category === 'string') {
          categoryPath = normalizeCategoryToSlug(data.category);
        }

        const url = `/${categoryPath}/${idPath}`;
        const title = `${data.name} | Halal Ottawa`;
        const description = data.description ? truncateDescription(data.description) : "Discover verified halal details, reviews, and address info.";
        const photoCandidate = (Array.isArray(data.photos) ? data.photos.find((p: any) => typeof p === 'string' && p.trim() !== '') : null) || data.photo || data.coverImage || data.image || "";
        const ogImage = getAbsoluteUrl(photoCandidate);

        pagesToPrerender.push({
          urlPath: url,
          filePath: path.join(distPath, categoryPath, idPath, "index.html"),
          routeType: "listing",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });

        // Also duplicate to /listings/[slug] so that it resolves gracefully in both route patterns!
        pagesToPrerender.push({
          urlPath: `/listings/${idPath}`,
          filePath: path.join(distPath, "listings", idPath, "index.html"),
          routeType: "listing",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });
      });

      // Populate Category and Location Pages Data for SSG
      const allApprovedListings = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const parseListingTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (typeof val.seconds === 'number') return val.seconds * 1000;
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      const categoryMapSSG: Record<string, string> = {
        restaurants: 'Restaurants',
        mosques: 'Mosques',
        organizations: 'Organizations',
        grocery: 'Grocery',
        clothing: 'Clothing',
        schools: 'Schools',
        butchers: 'Butchers'
      };

      for (const [slug, catName] of Object.entries(categoryMapSSG)) {
        const catPage = pagesToPrerender.find(p => p.urlPath === `/${slug}`);
        if (catPage) {
          const filtered = allApprovedListings
            .filter((l: any) => {
              if (!l.category) return false;
              const catArray = Array.isArray(l.category) ? l.category : [l.category];
              return catArray.some((c: any) => String(c).toLowerCase().trim() === catName.toLowerCase().trim());
            })
            .sort((a, b) => parseListingTime(b.createdAt) - parseListingTime(a.createdAt));

          catPage.routeType = 'category';
          catPage.initialData = {
            listings: filtered,
            timestamp: Date.now()
          };
        }
      }

      const listingsAllPage = pagesToPrerender.find(p => p.urlPath === '/listings');
      if (listingsAllPage) {
        listingsAllPage.routeType = 'category';
        listingsAllPage.initialData = {
          listings: allApprovedListings.sort((a: any, b: any) => parseListingTime(b.createdAt) - parseListingTime(a.createdAt)),
          timestamp: Date.now()
        };
      }

      const locationsSSG = ['orleans', 'kanata', 'barrhaven', 'downtown'];
      for (const loc of locationsSSG) {
        const locPage = pagesToPrerender.find(p => p.urlPath === `/restaurants/${loc}`);
        if (locPage) {
          const filtered = allApprovedListings
            .filter((l: any) => {
              const catArray = Array.isArray(l.category) ? l.category : (l.category ? [l.category] : []);
              const isRestaurant = catArray.some((c: any) => String(c).toLowerCase().trim() === 'restaurants');
              if (!isRestaurant) return false;
              const neighborhood = getNeighborhoodFromAddress(l.address || '', l.suburb || '');
              return neighborhood === loc;
            })
            .sort((a, b) => parseListingTime(b.createdAt) - parseListingTime(a.createdAt));

          locPage.routeType = 'location';
          locPage.initialData = {
            listings: filtered,
            timestamp: Date.now()
          };
        }
      }

      // Restaurant Subcategories (Food Types and Cuisines) SSG
      const subcategoriesSSG = [
        'bakery', 'pizza', 'burgers', 'cafes', 'seafood', 'steakhouse', 'shawarma', 'poutine', 
        'brunch', 'breakfast', 'pho', 'ramen', 'fried-chicken', 'buffet', 'tacos',
        'turkish', 'middle-eastern', 'moroccan', 'lebanese', 'syrian', 'pakistani', 
        'afghani', 'indian', 'persian', 'chinese', 'mediterranean', 'thai', 'korean', 
        'italian', 'bangladeshi', 'mexican', 'ethiopian'
      ];
      for (const sub of subcategoriesSSG) {
        const subPage = pagesToPrerender.find(p => p.urlPath === `/restaurants/${sub}`);
        if (subPage) {
          const cleanSub = sub.replace(/-/g, ' ').toLowerCase();
          const filtered = allApprovedListings
            .filter((l: any) => {
              const catArray = Array.isArray(l.category) ? l.category : (l.category ? [l.category] : []);
              const typesArray = Array.isArray(l.types) ? l.types : (l.types ? [l.types] : []);
              const cuisinesArray = Array.isArray(l.cuisine) ? l.cuisine : (l.cuisine ? [l.cuisine] : []);

              const matchesCat = catArray.some((c: any) => String(c).toLowerCase().trim() === cleanSub);
              const matchesType = typesArray.some((t: any) => String(t).toLowerCase().trim() === cleanSub);
              const matchesCuisine = cuisinesArray.some((c: any) => String(c).toLowerCase().trim() === cleanSub);

              return matchesCat || matchesType || matchesCuisine;
            })
            .sort((a, b) => parseListingTime(b.createdAt) - parseListingTime(a.createdAt));

          subPage.routeType = 'category';
          subPage.initialData = {
            listings: filtered,
            timestamp: Date.now()
          };
        }
      }

      // News Articles SSG
      const newsQuery = query(collection(db, 'news'), where('isApproved', '==', true));
      const newsSnap = await getDocs(newsQuery);
      newsSnap.forEach((doc) => {
        const data = doc.data();
        const idPath = data.slug || doc.id;
        const url = `/news/${idPath}`;
        const title = `${data.title} | Halal Ottawa`;
        const description = data.content ? truncateDescription(data.content) : "Read latest updates and news regarding the Ottawa halal and Muslim community.";
        const ogImage = getAbsoluteUrl(data.coverImage || "");

        pagesToPrerender.push({
          urlPath: url,
          filePath: path.join(distPath, "news", idPath, "index.html"),
          routeType: "news",
          initialData: { id: doc.id, ...data },
          title,
          description,
          ogImage
        });
      });

      console.log(`Successfully fetched and prepared ${pagesToPrerender.length} pages for Static Site Generation.`);
    } catch (e) {
      console.error("Error details while preparing dynamic pages:", e);
    }
  }

  // 3. Render HTML and Write to Filesystem
  let renderCount = 0;
  for (const page of pagesToPrerender) {
    try {
      let html = baseTemplate;
      
      // Strip existing OG, Twitter and canonical tags to prevent duplicates and ensure fresh values are injected
      html = html.replace(/<meta\s+property=["']og:[^"']+["']\s+content=["'][^"']*["']\s*\/?>/gi, '');
      html = html.replace(/<meta\s+name=["']twitter:[^"']+["']\s+content=["'][^"']*["']\s*\/?>/gi, '');
      html = html.replace(/<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/gi, '');

      // Inject standard SEO Tags with safe HTML escaping
      html = html.replace(/<title>.*?<\/title>/gi, `<title>${escapeHtmlText(page.title)}</title>`);
      html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/gi, `<meta name="description" content="${escapeHtmlAttr(page.description)}" />`);
      
      const ogType = page.routeType === 'news' ? 'article' : 'website';

      let resolvedCanonicalPath = page.urlPath;
      if (page.initialData) {
        if (page.routeType === 'listing') {
          const cat = Array.isArray(page.initialData.category) && page.initialData.category.length > 0
            ? page.initialData.category[0]
            : typeof page.initialData.category === 'string' ? page.initialData.category : 'listings';
          const formattedCategory = normalizeCategoryToSlug(cat);
          resolvedCanonicalPath = `/${formattedCategory}/${page.initialData.slug || page.initialData.id}`;
        } else if (page.routeType === 'news') {
          resolvedCanonicalPath = `/news/${page.initialData.slug || page.initialData.id}`;
        }
      }

      let extraTags = `
    <meta property="og:site_name" content="Halal Ottawa" />
    <meta property="og:title" content="${escapeHtmlAttr(page.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(page.description)}" />
    <meta property="og:image" content="${escapeHtmlAttr(page.ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtmlAttr("https://www.halalottawa.ca" + resolvedCanonicalPath)}" />
    <meta property="og:type" content="${ogType}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(page.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(page.description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(page.ogImage)}" />
    <link rel="canonical" href="${escapeHtmlAttr("https://www.halalottawa.ca" + resolvedCanonicalPath)}" />
      `;

      // Dynamic LCP image preloads
      if (page.routeType === "home" || page.urlPath === "/") {
        // Preload first listing's hero image (width=480, height=240)
        const firstListing = page.initialData?.listings?.[0];
        if (firstListing?.photos?.[0]) {
          const firstListingPhoto = getPrerenderOptimizedImageUrl(firstListing.photos[0], 480, 240);
          if (firstListingPhoto) {
            extraTags += `\n    <link rel="preload" as="image" href="${escapeHtmlAttr(firstListingPhoto)}" fetchpriority="high" />`;
          }
        }
      } else if (page.routeType === "listing" && page.initialData) {
        // Preload listing's cover photo
        const hasPhoto = page.initialData.photos && page.initialData.photos.length > 0 && page.initialData.photos[0] && page.initialData.photos[0].trim() !== '';
        const photoUrl = hasPhoto ? page.initialData.photos[0] : "/ottawa-sunset.webp";
        const coverPreloadUrl = getPrerenderOptimizedImageUrl(photoUrl, 1920, 600);
        if (coverPreloadUrl) {
          extraTags += `\n    <link rel="preload" as="image" href="${escapeHtmlAttr(coverPreloadUrl)}" fetchpriority="high" />`;
        }
      } else if (page.routeType === "news" && page.initialData?.coverImage) {
        const coverPreloadUrl = getPrerenderOptimizedImageUrl(page.initialData.coverImage, 800, 256);
        if (coverPreloadUrl) {
          extraTags += `\n    <link rel="preload" as="image" href="${escapeHtmlAttr(coverPreloadUrl)}" fetchpriority="high" />`;
        }
      }

      if (page.urlPath === "/" || page.routeType === "home") {
        const websiteSchema = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Halal Ottawa",
          "alternateName": ["HalalOttawa", "Halal Ottawa Directory"],
          "url": "https://www.halalottawa.ca/",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://www.halalottawa.ca/listings?search={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        };
        extraTags += `\n    <script type="application/ld+json">${JSON.stringify(websiteSchema)}</script>`;
        const organizationSchema = {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Halal Ottawa",
          "url": "https://www.halalottawa.ca",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.halalottawa.ca/favicon.png"
          },
          "sameAs": [
            "https://www.instagram.com/halalottawa"
          ]
        };
        extraTags += `\n    <script type="application/ld+json">${JSON.stringify(organizationSchema)}</script>`;
      }

      // Inject JSON-LD Schema standard Markup structures
      if (page.initialData) {
        let schemaData: any = {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": page.title,
          "description": page.description,
          "image": page.ogImage,
          "url": `${BASE_URL}${page.urlPath}`
        };

        const fullUrl = `${BASE_URL}${page.urlPath}`;

        if (page.routeType === 'listing') {
          let schemaType = "LocalBusiness";
          const cat = (page.initialData.category || '').toString().toLowerCase();
          if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) {
            schemaType = "Restaurant";
          } else if (cat.includes('mosque') || cat.includes('masjid')) {
            schemaType = "PlaceOfWorship";
          } else if (cat.includes('grocery') || cat.includes('supermarket')) {
            schemaType = "GroceryStore";
          } else if (cat.includes('butcher')) {
            schemaType = "FoodEstablishment";
          }

          schemaData = {
            "@context": "https://schema.org",
            "@type": schemaType,
            "name": page.initialData.name,
            "description": page.description,
            "image": page.ogImage,
            "url": fullUrl,
            "address": page.initialData.address ? {
              "@type": "PostalAddress",
              "streetAddress": page.initialData.address,
              "addressLocality": "Ottawa",
              "addressRegion": "ON",
              "postalCode": page.initialData.postalCode || "",
              "addressCountry": "CA"
            } : undefined,
            "telephone": page.initialData.phoneNumber || undefined,
            "geo": page.initialData.lat && page.initialData.lng ? {
              "@type": "GeoCoordinates",
              "latitude": parseFloat(page.initialData.lat),
              "longitude": parseFloat(page.initialData.lng)
            } : undefined
          };

          // priceRange is only valid for Commercial Local Businesses
          if (schemaType !== "PlaceOfWorship") {
            schemaData.priceRange = page.initialData.priceRange || "$$";
          }

          if (page.initialData.averageRating && page.initialData.reviewCount) {
            schemaData.aggregateRating = {
              "@type": "AggregateRating",
              "ratingValue": parseFloat(page.initialData.averageRating).toFixed(1),
              "reviewCount": parseInt(page.initialData.reviewCount) || 1,
              "bestRating": "5",
              "worstRating": "1"
            };
          }
        } else if (page.routeType === 'news') {
          schemaData = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": fullUrl
            },
            "headline": page.initialData.title,
            "image": page.ogImage ? [page.ogImage] : undefined,
            "datePublished": page.initialData.publishDate || page.initialData.createdAt || new Date().toISOString(),
            "dateModified": page.initialData.updatedAt || page.initialData.publishDate || new Date().toISOString(),
            "author": {
              "@type": "Person",
              "name": page.initialData.author || "Halal Ottawa Staff"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Halal Ottawa",
              "logo": {
                "@type": "ImageObject",
                "url": "https://www.halalottawa.ca/favicon.png"
              }
            },
            "description": page.description
          };
        } else if ((page.routeType === 'category' || page.routeType === 'location') && page.initialData?.listings) {
          const categoryDisplayName = (page.title.split(' - ')[0] || 'Halal Directory').replace(/Halal /gi, '').replace(/ in Ottawa.*/gi, '').trim();
          schemaData = {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": page.title,
            "description": page.description,
            "url": fullUrl,
            "mainEntity": {
              "@type": "ItemList",
              "name": page.title,
              "numberOfItems": (page.initialData.listings || []).length,
              "itemListElement": (page.initialData.listings || []).slice(0, 25).map((l: any, idx: number) => {
                let catSlug = 'listings';
                if (Array.isArray(l.category) && l.category.length > 0) {
                  catSlug = normalizeCategoryToSlug(l.category[0]);
                } else if (typeof l.category === 'string') {
                  catSlug = normalizeCategoryToSlug(l.category);
                }
                return {
                  "@type": "ListItem",
                  "position": idx + 1,
                  "name": l.name,
                  "url": `https://www.halalottawa.ca/${catSlug}/${l.slug || l.id}`
                };
              })
            }
          };
        }

        const breadcrumbItems = [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.halalottawa.ca"
          }
        ];

        if (page.routeType === 'listing') {
          const mainCategoryStr = Array.isArray(page.initialData.category) && page.initialData.category.length > 0 
            ? page.initialData.category[0] 
            : (typeof page.initialData.category === 'string' ? page.initialData.category : 'listings');
          
          const catSlug = normalizeCategoryToSlug(mainCategoryStr);

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": mainCategoryStr,
            "item": `https://www.halalottawa.ca/${catSlug}`
          });

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": page.initialData.name,
            "item": fullUrl
          });
        } else if (page.routeType === 'category' || page.routeType === 'location') {
          const pathSegments = page.urlPath.split('/').filter(Boolean);
          if (pathSegments.length === 2 && pathSegments[0].toLowerCase() === 'restaurants') {
            breadcrumbItems.push({
              "@type": "ListItem",
              "position": 2,
              "name": "Restaurants",
              "item": "https://www.halalottawa.ca/restaurants"
            });
            const locName = pathSegments[1].toLowerCase().replace(/-/g, ' ');
            const formattedSub = locName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            breadcrumbItems.push({
              "@type": "ListItem",
              "position": 3,
              "name": formattedSub,
              "item": fullUrl
            });
          } else {
            const categoryDisplayName = (page.title.split(' - ')[0] || 'Category').replace(/Halal /gi, '').replace(/ in Ottawa.*/gi, '').trim();
            breadcrumbItems.push({
              "@type": "ListItem",
              "position": 2,
              "name": categoryDisplayName,
              "item": fullUrl
            });
          }
        } else if (page.routeType === 'news') {
          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": "News",
            "item": "https://www.halalottawa.ca/news"
          });

          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": page.initialData.title,
            "item": fullUrl
          });
        }

        const breadcrumbSchema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbItems
        };

        if (schemaData) {
          extraTags += `\n    <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
        }
        extraTags += `\n    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`;
      }

      if (page.initialData) {
        extraTags += `\n    <script>window.__INITIAL_ROUTE_TYPE__ = ${JSON.stringify(page.routeType)}; window.__INITIAL_DATA__ = ${JSON.stringify(page.initialData).replace(/</g, '\\u003c')};</script>`;
      }

      let ssrBodyHtml = '';
      if (page.routeType === 'home' && page.initialData) {
        ssrBodyHtml = renderHomeSSRHtml(page.initialData);
      } else if (page.routeType === 'listing' && page.initialData) {
        ssrBodyHtml = renderListingDetailSSRHtml(page.initialData);
      } else if ((page.routeType === 'category' || page.routeType === 'location') && page.initialData?.listings) {
        const h1 = page.title.split(' - ')[0] || page.title;
        const pathSegments = page.urlPath.split('/').filter(Boolean);
        let categoryName = 'Directory';
        if (pathSegments.length === 1) {
          const map: Record<string, string> = {
            listings: 'All Listings',
            restaurants: 'Restaurants',
            mosques: 'Mosques',
            organizations: 'Organizations',
            grocery: 'Grocery',
            clothing: 'Clothing',
            schools: 'Schools',
            butchers: 'Butchers'
          };
          categoryName = map[pathSegments[0].toLowerCase()] || pathSegments[0];
        } else if (pathSegments.length === 2 && pathSegments[0].toLowerCase() === 'restaurants') {
          categoryName = pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1).replace(/-/g, ' ');
        }

        ssrBodyHtml = renderCategorySSRHtml({
          title: page.title,
          h1Text: h1,
          description: page.description,
          formattedCategory: categoryName,
          urlPath: page.urlPath,
          listings: page.initialData.listings
        });
      } else if (page.routeType === 'news' && page.initialData) {
        ssrBodyHtml = renderNewsDetailSSRHtml(page.initialData);
      } else if (page.urlPath === '/news') {
        ssrBodyHtml = renderNewsListSSRHtml();
      } else if (page.urlPath === '/faq') {
        ssrBodyHtml = renderFAQSSRHtml();
      } else if (page.urlPath === '/privacy-policy') {
        ssrBodyHtml = renderPrivacyPolicySSRHtml();
      } else if (page.urlPath === '/terms') {
        ssrBodyHtml = renderTermsSSRHtml();
      } else if (page.urlPath === '/tools/qibla') {
        ssrBodyHtml = renderQiblaSSRHtml();
      }

      if (ssrBodyHtml) {
        html = html.replace('<div id="root"></div>', `<div id="root">${ssrBodyHtml}</div>`);
      }

      html = html.replace('</head>', `${extraTags}\n  </head>`);

      // Ensure target container exists
      ensureDirectoryExists(page.filePath);
      
      // Write to filesystem
      fs.writeFileSync(page.filePath, html, 'utf-8');
      renderCount++;
    } catch (err) {
      console.error(`Error prerendering static file for path ${page.urlPath}:`, err);
    }
  }

  console.log(`Prerendering completed! Statically compiled ${renderCount} pages and wrote to 'dist/'.`);
}

prerender().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Static Site Generation script crashed:", err);
  process.exit(1);
});
