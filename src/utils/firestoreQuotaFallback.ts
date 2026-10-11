import fs from 'fs';
import path from 'path';

export function isFirestoreQuotaError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as any)?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted')
  );
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function formatSlugTitle(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CATEGORY_SLUG_TO_NAME: Record<string, string> = {
  restaurants: 'Restaurants',
  mosques: 'Mosques',
  organizations: 'Organizations',
  grocery: 'Grocery',
  clothing: 'Clothing',
  schools: 'Schools',
  butchers: 'Butchers',
};

const RESTAURANT_SUBCATEGORY_SLUGS = new Set([
  'orleans',
  'kanata',
  'barrhaven',
  'downtown',
  'bakery',
  'pizza',
  'burgers',
  'cafes',
  'seafood',
  'steakhouse',
  'shawarma',
  'poutine',
  'brunch',
  'breakfast',
  'pho',
  'ramen',
  'fried-chicken',
  'buffet',
  'tacos',
  'turkish',
  'middle-eastern',
  'moroccan',
  'lebanese',
  'syrian',
  'pakistani',
  'afghani',
  'indian',
  'persian',
  'chinese',
  'mediterranean',
  'thai',
  'korean',
  'italian',
  'bangladeshi',
  'mexican',
  'ethiopian',
]);

let cachedFallbackListings: any[] | null = null;
let cachedFallbackNews: any[] | null = null;

function parseSitemapsForFallback(): { listings: any[]; news: any[] } {
  if (cachedFallbackListings && cachedFallbackNews) {
    return { listings: cachedFallbackListings, news: cachedFallbackNews };
  }

  const listings: any[] = [];
  const newsMap = new Map<string, any>();

  const mainCandidates = [
    path.resolve(process.cwd(), 'public', 'sitemap.xml'),
    path.resolve(process.cwd(), 'dist', 'sitemap.xml'),
  ];
  const newsCandidates = [
    path.resolve(process.cwd(), 'public', 'sitemap-news.xml'),
    path.resolve(process.cwd(), 'dist', 'sitemap-news.xml'),
  ];

  const mainSitemapPath = mainCandidates.find((p) => fs.existsSync(p));
  const newsSitemapPath = newsCandidates.find((p) => fs.existsSync(p));

  if (newsSitemapPath) {
    try {
      const newsXml = fs.readFileSync(newsSitemapPath, 'utf-8');
      const urlBlocks = newsXml.match(/<url>[\s\S]*?<\/url>/g) || [];
      for (const block of urlBlocks) {
        const locMatch = block.match(/<loc>(.*?)<\/loc>/);
        if (!locMatch) continue;
        const loc = unescapeXml(locMatch[1]);
        const urlPath = loc.replace(/^https?:\/\/[^/]+/i, '');
        const parts = urlPath.split('/').filter(Boolean);
        if (parts.length !== 2 || parts[0] !== 'news') continue;
        const slug = parts[1];
        const pubDateMatch = block.match(/<news:publication_date>(.*?)<\/news:publication_date>/);
        const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);
        const titleMatch = block.match(/<news:title>(.*?)<\/news:title>/);

        const title = titleMatch ? unescapeXml(titleMatch[1]) : formatSlugTitle(slug);
        const publishDate = pubDateMatch
          ? unescapeXml(pubDateMatch[1])
          : lastmodMatch
          ? `${unescapeXml(lastmodMatch[1])}T12:00:00Z`
          : '2026-06-01T12:00:00Z';
        const updatedAt = lastmodMatch ? `${unescapeXml(lastmodMatch[1])}T12:00:00Z` : publishDate;

        newsMap.set(slug, {
          id: slug,
          slug,
          title,
          excerpt: `${title} — Read the full Ottawa community update on Halal Ottawa.`,
          content: `${title}\n\nStay connected with Halal Ottawa for verified community updates, local news, and announcements across the National Capital Region.`,
          coverImage: 'https://www.halalottawa.ca/default-og.jpg',
          publishDate,
          createdAt: publishDate,
          updatedAt,
          author: 'Youssef Agrebi',
          isApproved: true,
        });
      }
    } catch {
      // Ignore fallback parse error
    }
  }

  if (mainSitemapPath) {
    try {
      const mainXml = fs.readFileSync(mainSitemapPath, 'utf-8');
      const urlBlocks = mainXml.match(/<url>[\s\S]*?<\/url>/g) || [];
      for (const block of urlBlocks) {
        const locMatch = block.match(/<loc>(.*?)<\/loc>/);
        if (!locMatch) continue;
        const loc = unescapeXml(locMatch[1]);
        const urlPath = loc.replace(/^https?:\/\/[^/]+/i, '');
        const parts = urlPath.split('/').filter(Boolean);
        if (parts.length !== 2) continue;

        const [catSlug, itemSlug] = parts;
        const lastmodMatch = block.match(/<lastmod>(.*?)<\/lastmod>/);
        const imageLocMatch = block.match(/<image:loc>(.*?)<\/image:loc>/);
        const imageTitleMatch = block.match(/<image:title>(.*?)<\/image:title>/);

        const lastmodIso = lastmodMatch
          ? `${unescapeXml(lastmodMatch[1])}T12:00:00Z`
          : '2026-06-01T12:00:00Z';
        const imageUrl = imageLocMatch ? unescapeXml(imageLocMatch[1]) : '';
        const imageTitle = imageTitleMatch ? unescapeXml(imageTitleMatch[1]) : formatSlugTitle(itemSlug);

        if (catSlug === 'news') {
          const existing = newsMap.get(itemSlug);
          if (existing) {
            if (imageUrl) existing.coverImage = imageUrl;
            if (!existing.title && imageTitle) existing.title = imageTitle;
          } else {
            newsMap.set(itemSlug, {
              id: itemSlug,
              slug: itemSlug,
              title: imageTitle,
              excerpt: `${imageTitle} — Read the full Ottawa community update on Halal Ottawa.`,
              content: `${imageTitle}\n\nStay connected with Halal Ottawa for verified community updates, local news, and announcements across the National Capital Region.`,
              coverImage: imageUrl || 'https://www.halalottawa.ca/default-og.jpg',
              publishDate: lastmodIso,
              createdAt: lastmodIso,
              updatedAt: lastmodIso,
              author: 'Youssef Agrebi',
              isApproved: true,
            });
          }
          continue;
        }

        const categoryName = CATEGORY_SLUG_TO_NAME[catSlug];
        if (!categoryName) continue;
        if (catSlug === 'restaurants' && RESTAURANT_SUBCATEGORY_SLUGS.has(itemSlug.toLowerCase())) {
          continue;
        }

        const lowerSlug = itemSlug.toLowerCase();
        let suburb = 'Ottawa';
        if (lowerSlug.includes('kanata')) suburb = 'Kanata';
        else if (lowerSlug.includes('orleans')) suburb = 'Orleans';
        else if (lowerSlug.includes('barrhaven')) suburb = 'Barrhaven';
        else if (lowerSlug.includes('downtown')) suburb = 'Downtown';

        const cuisines: string[] = [];
        const types: string[] = [];
        if (lowerSlug.includes('turkish') || lowerSlug.includes('sultan') || lowerSlug.includes('tava') || lowerSlug.includes('kumpir')) cuisines.push('Turkish');
        if (lowerSlug.includes('lebanese') || lowerSlug.includes('cedar') || lowerSlug.includes('boustan') || lowerSlug.includes('tawouk')) cuisines.push('Lebanese');
        if (lowerSlug.includes('syrian') || lowerSlug.includes('sham') || lowerSlug.includes('retaj')) cuisines.push('Syrian');
        if (lowerSlug.includes('moroccan') || lowerSlug.includes('marrakech') || lowerSlug.includes('casablanca') || lowerSlug.includes('tajine') || lowerSlug.includes('maghreb')) cuisines.push('Moroccan');
        if (lowerSlug.includes('afghan') || lowerSlug.includes('salang') || lowerSlug.includes('baghlan')) cuisines.push('Afghani');
        if (lowerSlug.includes('indian') || lowerSlug.includes('pak-india') || lowerSlug.includes('biryani')) cuisines.push('Indian');
        if (lowerSlug.includes('karahi') || lowerSlug.includes('mezbaan') || lowerSlug.includes('pak-india')) cuisines.push('Pakistani');
        if (lowerSlug.includes('persian') || lowerSlug.includes('tehran') || lowerSlug.includes('caspian') || lowerSlug.includes('shiraz') || lowerSlug.includes('shirin')) cuisines.push('Persian');
        if (lowerSlug.includes('chinese') || lowerSlug.includes('wok') || lowerSlug.includes('uyghur')) cuisines.push('Chinese');
        if (lowerSlug.includes('mediterranean') || lowerSlug.includes('jericho') || lowerSlug.includes('phynicia')) cuisines.push('Mediterranean');
        if (lowerSlug.includes('thai') || lowerSlug.includes('chahaya')) cuisines.push('Thai');
        if (lowerSlug.includes('italian') || lowerSlug.includes('sarjinos') || lowerSlug.includes('kara-mia')) cuisines.push('Italian');
        if (lowerSlug.includes('bangladeshi') || lowerSlug.includes('tasty-junction') || lowerSlug.includes('taste-junction')) cuisines.push('Bangladeshi');
        if (lowerSlug.includes('mexican') || lowerSlug.includes('tacozzo')) cuisines.push('Mexican');
        if (lowerSlug.includes('ethiopian') || lowerSlug.includes('african') || lowerSlug.includes('gacan')) cuisines.push('Ethiopian');
        if (lowerSlug.includes('shawarma') || lowerSlug.includes('falafel') || lowerSlug.includes('habibi') || lowerSlug.includes('almandi')) cuisines.push('Middle Eastern');

        if (lowerSlug.includes('shawarma') || lowerSlug.includes('falafel')) types.push('Shawarma');
        if (lowerSlug.includes('pizza') || lowerSlug.includes('truecrust')) types.push('Pizza');
        if (lowerSlug.includes('bakery') || lowerSlug.includes('sweets') || lowerSlug.includes('baklawa') || lowerSlug.includes('buns') || lowerSlug.includes('pies')) types.push('Bakery');
        if (lowerSlug.includes('cafe') || lowerSlug.includes('chaa') || lowerSlug.includes('crepes') || lowerSlug.includes('chocomyth')) types.push('Cafés');
        if (lowerSlug.includes('seafood') || lowerSlug.includes('mermaids') || lowerSlug.includes('khalil')) types.push('Seafood');
        if (lowerSlug.includes('poutine')) types.push('Poutine');
        if (lowerSlug.includes('burger') || lowerSlug.includes('smash') || lowerSlug.includes('laziz') || lowerSlug.includes('night-bite')) types.push('Burgers');
        if (lowerSlug.includes('bbq') || lowerSlug.includes('grill') || lowerSlug.includes('smoked') || lowerSlug.includes('meat-me')) types.push('Steakhouse');
        if (lowerSlug.includes('eggstatic') || lowerSlug.includes('hollys')) {
          types.push('Breakfast');
          types.push('Brunch');
        }
        if (lowerSlug.includes('saigon')) types.push('Pho');
        if (lowerSlug.includes('chicken') || lowerSlug.includes('finga')) types.push('Fried Chicken');
        if (lowerSlug.includes('digbys') || lowerSlug.includes('saba-palace')) types.push('Buffet');
        if (lowerSlug.includes('tacozzo')) types.push('Tacos');

        listings.push({
          id: itemSlug,
          slug: itemSlug,
          name: imageTitle,
          category: [categoryName],
          cuisine: cuisines,
          types,
          photos: imageUrl ? [imageUrl] : [],
          coverImage: imageUrl || '',
          address: `${suburb}, ON`,
          suburb,
          description: `${imageTitle} is a verified ${categoryName.toLowerCase().replace(/s$/, '')} in ${suburb}, Ottawa listed on Halal Ottawa.`,
          reviewCount: 0,
          averageRating: 0,
          isApproved: true,
          isFeatured: false,
          createdAt: lastmodIso,
          updatedAt: lastmodIso,
        });
      }
    } catch {
      // Ignore fallback parse error
    }
  }

  cachedFallbackListings = listings;
  cachedFallbackNews = Array.from(newsMap.values());
  return { listings: cachedFallbackListings, news: cachedFallbackNews };
}

export function getFallbackListings(): any[] {
  return parseSitemapsForFallback().listings;
}

export function getFallbackNews(): any[] {
  return parseSitemapsForFallback().news;
}
