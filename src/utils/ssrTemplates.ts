/**
 * ssrTemplates.ts
 *
 * Provides static HTML generators for:
 * - Home page (renderHomeSSRHtml)
 * - Category / Directory listing pages (renderCategorySSRHtml)
 * - Single listing / restaurant detail pages (renderListingDetailSSRHtml)
 * - News article detail pages (renderNewsDetailSSRHtml)
 * - Event detail pages (renderEventDetailSSRHtml)
 * - Job detail pages (renderJobDetailSSRHtml)
 *
 * Used during static site generation (scripts/prerender.ts) and dynamic server SSR (server.ts).
 */

import { getPlainText, getExcerpt } from './textUtils';
import {
  getImageUrl,
  getImageSrcSet,
  getUntransformedImageUrl,
  GLOBAL_HERO_IMAGE_PATH,
  HERO_IMAGE_WIDTHS,
  HERO_IMAGE_SIZES,
  CARD_IMAGE_WIDTHS,
  CARD_IMAGE_SIZES,
} from '../config/images';
import { DEFAULT_SITE_LOGO_URL } from '../services/publicSettings';

export function escapeHtmlText(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtmlAttr(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function normalizeCategoryToSlug(cat: string): string {
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

export function getOptimizedImageUrlSSR(url: string | null | undefined, width: number = 800, height?: number): string | undefined {
  if (!url) return undefined;
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith('data:') || lowerUrl.endsWith('.svg') || lowerUrl.includes('google.com/images/') || lowerUrl.includes('.gstatic.com/') || lowerUrl.includes('r2.dev') || lowerUrl.includes('r2.cloudflarestorage.com')) {
    return url;
  }
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    const baseUrl = url.split('=')[0];
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
    } catch {
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

const AD_SLOT_PLACEHOLDER_HTML = `
        <div class="my-8 w-full flex flex-col items-center justify-center overflow-hidden min-h-[274px] md:min-h-[114px]">
          <div class="mx-auto flex justify-center items-center w-[300px] max-w-full h-[250px] min-h-[250px] md:w-[728px] md:h-[90px] md:min-h-[90px]"></div>
          <p style="text-align: center;" class="mt-2 text-xs text-gray-500 m-0">
            <a href="https://muslimadnetwork.com/?pub=halalottawa.ca" title="Ads By Muslim Ad Network" target="_blank" rel="noopener noreferrer" class="hover:underline text-gray-500 text-decoration-none">
              Ads By Muslim Ad Network
            </a>
          </p>
        </div>`;

function renderSSRLayoutShell(innerHtml: string, logoUrl: string = DEFAULT_SITE_LOGO_URL): string {
  const navCategories = [
    { name: 'Restaurants', slug: 'restaurants', hasDropdown: true },
    { name: 'Mosques', slug: 'mosques', hasDropdown: false },
    { name: 'Grocery', slug: 'grocery', hasDropdown: false },
    { name: 'Clothing', slug: 'clothing', hasDropdown: false },
    { name: 'Schools', slug: 'schools', hasDropdown: false },
    { name: 'Butchers', slug: 'butchers', hasDropdown: false },
  ];

  const topNavLinksHtml = navCategories
    .map(
      (cat) => `
          <div class="relative group/menu py-2">
            <a href="/${cat.slug}" class="flex items-center gap-1.5 text-sm font-semibold transition-colors whitespace-nowrap text-gray-900 hover:text-[#e90b35] text-decoration-none">
              <span>${escapeHtmlText(cat.name)}</span>
              ${
                cat.hasDropdown
                  ? '<svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"></path></svg>'
                  : ''
              }
            </a>
          </div>`
    )
    .join('\n');

  return `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <header class="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 flex justify-between items-center px-4 md:px-8 lg:px-12">
        <div class="flex items-center justify-start md:hidden">
          <button class="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors" aria-label="Open menu">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="4" x2="20" y1="12" y2="12"></line><line x1="4" x2="20" y1="6" y2="6"></line><line x1="4" x2="20" y1="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="hidden md:flex items-center justify-start gap-2 cursor-pointer" aria-label="Halal Ottawa Home" role="link">
          <img src="${escapeHtmlAttr(logoUrl)}" alt="Halal Ottawa" class="h-[52px] w-[180px] object-contain" width="180" height="52" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        </div>
        <nav class="hidden md:flex shrink-0 justify-center items-center gap-4 lg:gap-6">
          ${topNavLinksHtml}
        </nav>
        <div class="absolute left-1/2 -translate-x-1/2 flex md:hidden items-center gap-2 cursor-pointer" aria-label="Halal Ottawa Home" role="link">
          <img src="${escapeHtmlAttr(logoUrl)}" alt="Halal Ottawa" class="h-[44px] w-[152px] object-contain" width="152" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        </div>
        <div class="flex justify-end items-center gap-3 relative">
          <a href="/login" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-400 hover:bg-gray-200 transition-colors shadow-sm" aria-label="Login or Account">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </a>
        </div>
      </header>
      <main class="flex-1 pt-20 pb-12">
${innerHtml}
      </main>
      <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-[110] hidden items-center justify-around px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)] min-h-[4.5rem]" aria-hidden="true"></nav>
      <footer class="bg-gray-950 pt-12 md:pt-16 pb-8 border-t border-gray-850 min-h-[420px]">
        <div class="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12">
          <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-12 lg:gap-8">
            <div class="lg:col-span-2 space-y-6">
              <a href="/" class="flex items-center gap-2 text-decoration-none" aria-label="Halal Ottawa Home">
                <img src="${escapeHtmlAttr(logoUrl)}" alt="Halal Ottawa" class="h-10 w-auto brightness-0 invert" loading="lazy" width="160" height="40" decoding="async" />
              </a>
              <p class="text-gray-400 text-sm leading-relaxed max-w-sm m-0">
                Supporting the Ottawa Muslim community by connecting people with halal-certified businesses, organizations, and local community news. Your trusted hub for halal life in the capital.
              </p>
            </div>
            <div class="space-y-6">
              <h3 class="text-white font-bold text-lg tracking-tight m-0">Browse</h3>
              <ul class="space-y-4 list-none p-0 m-0">
                <li><a href="/listings" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">All Listings</a></li>
                <li><a href="/news" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Community News</a></li>
              </ul>
            </div>
            <div class="space-y-6">
              <h3 class="text-white font-bold text-lg tracking-tight m-0">Support</h3>
              <ul class="space-y-4 list-none p-0 m-0">
                <li><a href="https://buymeacoffee.com/halalottawa.ca" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Donation</a></li>
                <li><a href="/faq" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">FAQ</a></li>
                <li><a href="/tools/qibla" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Qibla Direction</a></li>
                <li><a href="/terms" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Terms of Service</a></li>
                <li><a href="/privacy-policy" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Privacy Policy</a></li>
              </ul>
            </div>
            <div class="space-y-6">
              <h3 class="text-white font-bold text-lg tracking-tight m-0">Locations</h3>
              <ul class="space-y-4 list-none p-0 m-0">
                <li><a href="/restaurants/orleans" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Orleans</a></li>
                <li><a href="/restaurants/kanata" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Kanata</a></li>
                <li><a href="/restaurants/barrhaven" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Barrhaven</a></li>
                <li><a href="/restaurants/downtown" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Downtown</a></li>
              </ul>
            </div>
          </div>
          <div class="mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p class="text-gray-400 text-xs text-center md:text-left m-0">
              © ${new Date().getFullYear()} Halal Ottawa. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Static HTML for Homepage (LCP optimization)
 */
export function renderHomeSSRHtml(data: {
  listings?: any[];
  news?: any[];
  events?: any[];
  jobs?: any[];
  settings?: { heroImageUrl?: string; logoUrl?: string };
}): string {
  const listings = data.listings || [];
  const news = data.news || [];
  const heroImagePath = data.settings?.heroImageUrl || GLOBAL_HERO_IMAGE_PATH;
  const heroUntransformedUrl = getUntransformedImageUrl(heroImagePath);
  const logoUrl =
    data.settings?.logoUrl && !data.settings.logoUrl.includes('/wp-content/')
      ? data.settings.logoUrl
      : DEFAULT_SITE_LOGO_URL;

  const navCategories = [
    { name: 'Restaurants', slug: 'restaurants', hasDropdown: true },
    { name: 'Mosques', slug: 'mosques', hasDropdown: false },
    { name: 'Grocery', slug: 'grocery', hasDropdown: false },
    { name: 'Clothing', slug: 'clothing', hasDropdown: false },
    { name: 'Schools', slug: 'schools', hasDropdown: false },
    { name: 'Butchers', slug: 'butchers', hasDropdown: false },
  ];

  const topNavLinksHtml = navCategories
    .map(
      (cat) => `
          <div class="relative group/menu py-2">
            <a href="/${cat.slug}" class="flex items-center gap-1.5 text-sm font-semibold transition-colors whitespace-nowrap text-gray-900 hover:text-[#e90b35] text-decoration-none">
              <span>${escapeHtmlText(cat.name)}</span>
              ${
                cat.hasDropdown
                  ? '<svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"></path></svg>'
                  : ''
              }
            </a>
          </div>`
    )
    .join('\n');

  const categories = [
    { 
      name: 'Restaurants', 
      slug: 'restaurants', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>'
    },
    { 
      name: 'Mosques', 
      slug: 'mosques', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>'
    },
    { 
      name: 'Organizations', 
      slug: 'organizations', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>'
    },
    { 
      name: 'Grocery', 
      slug: 'grocery', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>'
    },
    { 
      name: 'Clothing', 
      slug: 'clothing', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path></svg>'
    },
    { 
      name: 'Schools', 
      slug: 'schools', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path><path d="M22 10v6"></path><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path></svg>'
    },
    { 
      name: 'Butchers', 
      slug: 'butchers', 
      svg: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3"></path><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"></path><circle cx="12.5" cy="8.5" r="2.5"></circle></svg>'
    },
  ];

  const categoryCardsHtml = categories.map((cat, i) => `
    <div class="flex-1 md:min-w-[130px] ${i >= 6 ? 'hidden md:block' : ''}">
      <a href="/${cat.slug}" aria-label="Browse ${escapeHtmlAttr(cat.name)} category" class="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all h-full outline-none focus:ring-2 focus:ring-[#e90b35] active:scale-95 text-decoration-none">
        <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35]">
          ${cat.svg}
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-center leading-tight">${escapeHtmlText(cat.name)}</span>
      </a>
    </div>
  `).join('\n');

  const listingCardsHtml = listings.slice(0, 8).map((l, idx) => {
    let catSlug = 'listings';
    if (Array.isArray(l.category) && l.category.length > 0) {
      catSlug = normalizeCategoryToSlug(l.category[0]);
    } else if (typeof l.category === 'string') {
      catSlug = normalizeCategoryToSlug(l.category);
    }
    const listingUrl = `/${catSlug}/${l.slug || l.id}`;
    const photoUrl = (l.photos && l.photos.length > 0) ? l.photos[0] : (l.coverImage || '/ottawa-sunset.webp');
    const cardSrc = getImageUrl(photoUrl, 480) || photoUrl;
    const cardSrcSet = getImageSrcSet(photoUrl, CARD_IMAGE_WIDTHS);
    const cardRawFallback = getUntransformedImageUrl(photoUrl) || photoUrl;
    const rating = l.averageRating ? Number(l.averageRating).toFixed(1) : '5.0';
    const rawAddress = l.address ? l.address.split(',')[0] : 'Ottawa, ON';

    return `
      <a href="${escapeHtmlAttr(listingUrl)}" class="min-w-[240px] md:min-w-0 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50 group hover:shadow-md transition-all text-decoration-none text-inherit block">
        <div class="relative aspect-[2/1] w-full bg-gray-100">
          <img 
            src="${escapeHtmlAttr(cardSrc)}" 
            srcset="${escapeHtmlAttr(cardSrcSet)}"
            sizes="${escapeHtmlAttr(CARD_IMAGE_SIZES)}"
            alt="${escapeHtmlAttr(l.name)}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            loading="lazy" 
            width="480" 
            height="240" 
            decoding="async"
            onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${escapeHtmlAttr(cardRawFallback)}';"
          />
          ${l.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>' : ''}
          <div class="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold text-gray-800">
            <svg class="w-3 h-3 text-yellow-400 fill-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
            <span>${rating}</span>
          </div>
        </div>
        <div class="p-4">
          <h3 class="font-bold leading-tight line-clamp-1 m-0 text-gray-900">${escapeHtmlText(l.name)}</h3>
          <div class="text-gray-600 text-xs font-semibold mt-2 flex items-center justify-between flex-wrap gap-2">
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${escapeHtmlText(rawAddress)}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  const newsCardsHtml = news.slice(0, 6).map((item, index) => {
    const newsUrl = `/news/${item.slug || item.id}`;
    const rawCover = item.coverImage || '/ottawa-sunset.webp';
    const coverUrl = getImageUrl(rawCover, 480) || rawCover;
    const coverSrcSet = getImageSrcSet(rawCover, CARD_IMAGE_WIDTHS);
    const coverRawFallback = getUntransformedImageUrl(rawCover) || rawCover;
    const dateStr = item.publishDate || item.createdAt ? new Date(item.publishDate || item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const authorName = item.author || 'Youssef Agrebi';

    return `
      <a href="${escapeHtmlAttr(newsUrl)}" class="bg-white hover:shadow-md transition-all border border-gray-50 group flex md:flex-col gap-4 md:gap-0 p-3 md:p-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm text-decoration-none text-inherit ${index >= 3 ? 'hidden md:flex' : ''}">
        <div class="relative w-24 h-24 md:w-full md:h-48 aspect-square md:aspect-none shrink-0 bg-gray-100">
          <img src="${escapeHtmlAttr(coverUrl)}" srcset="${escapeHtmlAttr(coverSrcSet)}" sizes="(max-width: 767px) 96px, (max-width: 1023px) 50vw, 33vw" alt="${escapeHtmlAttr(item.title)}" class="w-full h-full object-cover rounded-xl md:rounded-none group-hover:scale-105 transition-transform duration-500" loading="lazy" width="400" height="192" decoding="async" onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${escapeHtmlAttr(coverRawFallback)}';" />
        </div>
        <div class="flex-1 flex flex-col justify-between py-1 md:p-5">
          <div>
            <h3 class="font-bold leading-tight m-0 text-gray-900 group-hover:text-[#e90b35] transition-colors">${escapeHtmlText(item.title)}</h3>
            <div class="hidden md:block">
              <p class="text-gray-600 text-sm line-clamp-2 leading-relaxed mt-2 m-0">${escapeHtmlText(item.excerpt || getExcerpt(item.content || '', 160))}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 mt-3 md:mt-4 text-xs text-gray-600 font-semibold">
            <span class="flex items-center gap-1.5">
              <svg class="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
              <span>${dateStr}</span>
            </span>
            <span class="flex items-center gap-1.5 text-gray-600 hover:text-[#c4082c] focus:text-[#c4082c] font-medium transition-colors cursor-pointer" title="View author profile">
              <svg class="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span class="hover:underline">By ${escapeHtmlText(authorName)}</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  const adSlotPlaceholderHtml = `
        <div class="my-8 w-full flex flex-col items-center justify-center overflow-hidden min-h-[274px] md:min-h-[114px]">
          <div class="mx-auto flex justify-center items-center w-[300px] max-w-full h-[250px] min-h-[250px] md:w-[728px] md:h-[90px] md:min-h-[90px]"></div>
          <p style="text-align: center;" class="mt-2 text-xs text-gray-600 m-0">
            <a href="https://muslimadnetwork.com/?pub=halalottawa.ca" title="Ads By Muslim Ad Network" target="_blank" rel="noopener noreferrer" class="hover:underline text-gray-600 hover:text-gray-900 focus:text-gray-900 text-decoration-none">
              Ads By Muslim Ad Network
            </a>
          </p>
        </div>`;

  const ssrFaqs = [
    {
      question: 'How is halal status represented on listings?',
      answer: 'Listings are submitted by business owners and community members and reviewed by our moderators using available information such as community reporting, certification details where provided, and direct business details. Because menus, suppliers, and ownership can change, visitors are encouraged to confirm specific halal practices directly with the business.',
    },
    {
      question: 'How can I browse by category or neighbourhood?',
      answer: 'You can use the category icons or top navigation to browse Ottawa halal restaurants, mosques, grocery stores, butchers, clothing stores, Islamic schools, and Muslim organizations. Within the Restaurants directory and footer, you can also browse neighbourhood pages for Orléans, Kanata, Barrhaven, and Downtown Ottawa, or use the search bar to look up a specific place.',
    },
    {
      question: 'How is listing information updated?',
      answer: 'Registered users can submit new listings from their account, and business owners or community members can report outdated details or request updates by emailing info@halalottawa.ca. All submitted listings and updates are reviewed by moderators before appearing in the public directory.',
    },
    {
      question: 'How do I add my business to the directory?',
      answer: 'You can add your business by clicking the "Add Listing" button or the "+" icon in the top right corner. Ensure you have an account and are logged in to submit your business details for approval.',
    },
    {
      question: 'Is it free to list my business?',
      answer: 'Yes! Basic listings are completely free. We also offer premium features to stand out and attract more customers, which you can explore in your dashboard.',
    },
    {
      question: 'How are listings approved?',
      answer: 'Our community moderators review all submitted listings within 24-48 hours. They verify the information to ensure quality standards our community expects.',
    },
  ];

  const faqItemsHtml = ssrFaqs
    .map(
      (f) => `
                <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all duration-300">
                  <button aria-expanded="false" class="w-full text-left p-6 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-[#e90b35] focus:ring-inset">
                    <h3 class="font-bold text-lg text-gray-900 m-0">${escapeHtmlText(f.question)}</h3>
                    <svg class="w-5 h-5 text-gray-500 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
                  </button>
                  <div class="transition-all duration-300 ease-in-out" style="max-height:0;opacity:0">
                    <div class="p-6 pt-0 text-gray-600 text-sm leading-relaxed">
                      ${escapeHtmlText(f.answer)}
                    </div>
                  </div>
                </div>`
    )
    .join('\n');

  return `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <header class="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 flex justify-between items-center px-4 md:px-8 lg:px-12">
        <div class="flex items-center justify-start md:hidden">
          <button class="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors" aria-label="Open menu">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12h16"></path><path d="M4 18h16"></path><path d="M4 6h16"></path></svg>
          </button>
        </div>
        <div class="hidden md:flex items-center justify-start gap-2 cursor-pointer" aria-label="Halal Ottawa Home" role="link">
          <img src="${escapeHtmlAttr(logoUrl)}" alt="Halal Ottawa" class="h-[52px] w-[180px] object-contain" width="180" height="52" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        </div>
        <nav class="hidden md:flex shrink-0 justify-center items-center gap-4 lg:gap-6">
          ${topNavLinksHtml}
        </nav>
        <div class="absolute left-1/2 -translate-x-1/2 flex md:hidden items-center gap-2 cursor-pointer" aria-label="Halal Ottawa Home" role="link">
          <img src="${escapeHtmlAttr(logoUrl)}" alt="Halal Ottawa" class="h-[44px] w-[152px] object-contain" width="152" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
        </div>
        <div class="flex justify-end items-center gap-3 relative">
          <a href="/login" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-400 hover:bg-gray-200 transition-colors shadow-sm" aria-label="Login or Account">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </a>
        </div>
      </header>
      <main class="flex-1 pt-20 pb-12">
        <div class="w-full">
          <!-- Hero Section -->
          <section class="relative w-full h-[400px] md:h-[500px] lg:h-[550px] flex flex-col justify-center items-center px-4 overflow-hidden mb-8 md:mb-12">
            <div class="absolute inset-0 z-0">
              <img 
                src="${escapeHtmlAttr(getImageUrl(heroImagePath, 750))}" 
                srcset="${escapeHtmlAttr(getImageSrcSet(heroImagePath, HERO_IMAGE_WIDTHS))}"
                sizes="${escapeHtmlAttr(HERO_IMAGE_SIZES)}"
                alt="Ottawa Sunset" 
                class="w-full h-full object-cover brightness-[0.45] saturate-[1.2]" 
                fetchpriority="high"
                loading="eager"
                width="750" 
                height="564"
                decoding="sync"
                onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${escapeHtmlAttr(heroUntransformedUrl)}';"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/65 to-transparent"></div>
              <div class="absolute inset-0 bg-black/55"></div>
            </div>
            <div class="relative z-10 w-full max-w-3xl mx-auto text-center space-y-6">
              <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-lg leading-tight m-0">
                Halal Places in Ottawa
              </h1>
              <p class="text-white/95 text-sm md:text-lg max-w-xl mx-auto font-medium drop-shadow-md m-0">
                Discover verified halal restaurants, cafes, mosques, and local community news
              </p>
              <div class="w-full max-w-2xl mx-auto">
                <form action="/listings" method="GET" class="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#e90b35] transition-all flex items-center">
                  <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg>
                  <input 
                    type="text" 
                    name="search" 
                    placeholder="Search halal restaurants, mosques, or places in Ottawa..." 
                    class="w-full pl-12 pr-4 py-4 md:py-5 bg-white border-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 text-sm md:text-base outline-none"
                    value=""
                  />
                </form>
              </div>
            </div>
          </section>

          <!-- Main Content Container -->
          <div class="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 pb-12 space-y-8 md:space-y-12">
            ${adSlotPlaceholderHtml}

            <!-- Categories - Merged Single Responsive Component -->
            <section class="space-y-4 mb-8">
              <p class="text-gray-600 text-sm md:text-base leading-relaxed max-w-3xl mx-auto text-center m-0">
                Explore Ottawa halal restaurants, mosques, grocery stores, butchers, clothing stores, Islamic schools, and Muslim organizations. Browse by category or neighbourhood to find local options and community updates.
              </p>
              <div class="relative group">
                <button aria-label="Scroll categories left" class="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 shrink-0 w-8 h-8 bg-white/95 backdrop-blur-sm border border-gray-200/80 shadow-sm rounded-full items-center justify-center text-gray-500 hover:text-[#c4082c] transition-all duration-300 hover:scale-110 hover:bg-white z-10">
                  <svg class="w-4 h-4 transition-transform hover:-translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"></path></svg>
                </button>
                <div class="md:overflow-x-auto md:py-2 scroll-smooth scrollbar-hide">
                  <div class="grid grid-cols-3 md:flex gap-3">
                    ${categoryCardsHtml}
                  </div>
                </div>
                <button aria-label="Scroll categories right" class="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 shrink-0 w-8 h-8 bg-white/95 backdrop-blur-sm border border-gray-200/80 shadow-sm rounded-full items-center justify-center text-gray-500 hover:text-[#c4082c] transition-all duration-300 hover:scale-110 hover:bg-white z-10">
                  <svg class="w-4 h-4 transition-transform hover:translate-x-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>
                </button>
              </div>
            </section>

            <!-- Latest Listings Section -->
            <section class="space-y-4 content-visibility-auto">
              <div class="flex justify-between items-end">
                <h2 class="text-xl md:text-2xl font-bold text-gray-900 leading-tight m-0">Latest Listings</h2>
                <a href="/listings" aria-label="View all latest listings" class="text-gray-500 hover:text-[#e90b35] text-sm md:text-base font-medium transition-colors hover:underline cursor-pointer shrink-0 text-decoration-none">
                  View all
                </a>
              </div>
              <div class="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                ${listingCardsHtml}
              </div>
            </section>

            ${adSlotPlaceholderHtml}

            ${news.length > 0 ? `
            <!-- Latest News Section -->
            <section class="space-y-4 content-visibility-auto">
              <div class="flex justify-between items-end">
                <h2 class="text-xl md:text-2xl font-bold text-gray-900 leading-tight m-0">Latest News</h2>
                <a href="/news" aria-label="View all news articles" class="text-[#c4082c] hover:text-[#9e0623] focus:text-[#9e0623] text-sm md:text-base font-semibold hover:underline decoration-2 underline-offset-4 text-decoration-none">
                  View all
                </a>
              </div>
              <div class="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
                ${newsCardsHtml}
              </div>
            </section>` : ''}

            <!-- FAQ Section -->
            <section class="space-y-8 pt-8 pb-4 content-visibility-auto">
              <div class="text-center space-y-2">
                <h2 class="text-2xl font-bold text-gray-900 m-0">Frequently Asked Questions</h2>
                <p class="text-gray-600 m-0">Everything you need to know about Halal Ottawa</p>
              </div>
              <div class="space-y-4">
${faqItemsHtml}
              </div>
            </section>
          </div>
        </div>
      </main>
      <footer class="bg-gray-950 pt-12 md:pt-16 pb-8 border-t border-gray-850 min-h-[420px]">
        <div class="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12">
          <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-12 lg:gap-8">
            <div class="lg:col-span-2 space-y-6">
              <a href="/" class="flex items-center gap-2 text-decoration-none" aria-label="Halal Ottawa Home">
                <img src="${escapeHtmlAttr(logoUrl)}" alt="Halal Ottawa" class="h-10 w-auto brightness-0 invert" loading="lazy" width="160" height="40" decoding="async" />
              </a>
              <p class="text-gray-400 text-sm leading-relaxed max-w-sm m-0">
                Supporting the Ottawa Muslim community by connecting people with halal-certified businesses, organizations, and local community news. Your trusted hub for halal life in the capital.
              </p>
              <div class="pt-1 flex justify-start">
                <a href="https://www.google.com/preferences/source?q=halalottawa.ca" target="_blank" rel="noopener noreferrer" title="Add Halal Ottawa as preferred source on Google" class="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-all duration-200 group select-none">
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"></path><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.41 7.33 24 12 24z"></path><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"></path><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.59 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"></path></svg>
                  <span>Add Halal Ottawa as a preferred source on Google</span>
                </a>
              </div>
            </div>
            <div class="space-y-6">
              <h3 class="text-white font-bold text-lg tracking-tight m-0">Browse</h3>
              <ul class="space-y-4 list-none p-0 m-0">
                <li><a href="/listings" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">All Listings</a></li>
                <li><a href="/news" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Community News</a></li>
              </ul>
            </div>
            <div class="space-y-6">
              <h3 class="text-white font-bold text-lg tracking-tight m-0">Support</h3>
              <ul class="space-y-4 list-none p-0 m-0">
                <li><a href="https://buymeacoffee.com/halalottawa.ca" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Donation</a></li>
                <li><a href="/faq" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">FAQ</a></li>
                <li><a href="/terms" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Terms of Service</a></li>
                <li><a href="/privacy-policy" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Privacy Policy</a></li>
              </ul>
            </div>
            <div class="space-y-6">
              <h3 class="text-white font-bold text-lg tracking-tight m-0">Locations</h3>
              <ul class="space-y-4 list-none p-0 m-0">
                <li><a href="/restaurants/orleans" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Orleans</a></li>
                <li><a href="/restaurants/kanata" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Kanata</a></li>
                <li><a href="/restaurants/barrhaven" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Barrhaven</a></li>
                <li><a href="/restaurants/downtown" class="text-gray-400 hover:text-[#ff4d6d] focus:text-[#ff4d6d] text-sm transition-colors text-decoration-none">Downtown</a></li>
              </ul>
            </div>
          </div>
          <div class="mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p class="text-gray-400 text-xs text-center md:text-left m-0">
              © ${new Date().getFullYear()} Halal Ottawa. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Static HTML for Category / Directory Listing Pages
 */
export function renderCategorySSRHtml(options: {
  title: string;
  h1Text: string;
  description: string;
  formattedCategory: string;
  urlPath: string;
  listings: any[];
}): string {
  const { h1Text, description, formattedCategory, urlPath, listings } = options;
  const isUnderRestaurants = urlPath.startsWith('/restaurants') || urlPath.startsWith('/restaurants/');
  const cleanUrlPath = urlPath.replace(/\/+$/, '');
  const categories = [
    { name: 'Restaurants', slug: 'restaurants' },
    { name: 'Mosques', slug: 'mosques' },
    { name: 'Organizations', slug: 'organizations' },
    { name: 'Grocery', slug: 'grocery' },
    { name: 'Clothing', slug: 'clothing' },
    { name: 'Schools', slug: 'schools' },
    { name: 'Butchers', slug: 'butchers' },
  ];

  const categoryPillsHtml = categories.map(cat => {
    const isActive = formattedCategory.toLowerCase() === cat.name.toLowerCase();
    const activeClass = isActive 
      ? 'bg-[#e90b35] text-white shadow-md shadow-red-100' 
      : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50';
    return `<a href="/${cat.slug}" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all text-decoration-none ${activeClass}">${escapeHtmlText(cat.name)}</a>`;
  }).join('\n');

  const listingsCardsHtml = listings.length > 0 ? listings.map((l, idx) => {
    let catSlug = 'listings';
    if (Array.isArray(l.category) && l.category.length > 0) {
      catSlug = normalizeCategoryToSlug(l.category[0]);
    } else if (typeof l.category === 'string') {
      catSlug = normalizeCategoryToSlug(l.category);
    }
    const listingUrl = `/${catSlug}/${l.slug || l.id}`;
    const photoUrl = (l.photos && l.photos.length > 0) ? l.photos[0] : (l.coverImage || '/ottawa-sunset.webp');
    const optimizedPhoto = getOptimizedImageUrlSSR(photoUrl, 400, 192) || photoUrl;
    const rating = l.averageRating ? Number(l.averageRating).toFixed(1) : '5.0';
    const reviewCount = l.reviewCount || 0;
    const address = l.address ? escapeHtmlText(l.address.split(',')[0]) : 'Ottawa, ON';
    const mainCat = Array.isArray(l.category) ? (l.category[0] || 'Listing') : (l.category || 'Listing');
    const isEager = idx < 4;

    const typesArray = Array.isArray(l.types) ? l.types : (l.types ? [l.types] : []);
    const cuisinesArray = Array.isArray(l.cuisine) ? l.cuisine : (l.cuisine ? [l.cuisine] : []);
    const tags = Array.from(new Set([...typesArray, ...cuisinesArray])).filter(Boolean).slice(0, 2);

    return `
    <a href="${escapeHtmlAttr(listingUrl)}" class="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col sm:flex-row transition-all group text-decoration-none text-inherit">
      <div class="relative h-48 sm:w-48 sm:h-auto shrink-0 bg-gray-100">
        <img 
          src="${escapeHtmlAttr(optimizedPhoto)}" 
          alt="${escapeHtmlAttr(l.name)}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          loading="${isEager ? 'eager' : 'lazy'}"
          ${isEager ? 'fetchpriority="high"' : ''}
          width="400"
          height="192"
          decoding="async"
        />
        <div class="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-[#e90b35] bg-red-50 border border-red-100 px-2 py-1 rounded-md shadow-md backdrop-blur-md bg-opacity-95">
          ${escapeHtmlText(mainCat)}
        </div>
        ${l.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>' : ''}
      </div>
      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start">
            <h2 class="font-bold text-lg leading-tight group-hover:text-[#e90b35] transition-colors m-0 text-gray-900">${escapeHtmlText(l.name)}</h2>
            <div class="flex items-center gap-1 text-xs font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">
              <svg class="w-3 h-3 fill-yellow-400 text-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
              <span>${rating}</span>
            </div>
          </div>
          <div class="text-gray-500 text-sm mt-1 flex items-center justify-between flex-wrap gap-2">
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span>${address}</span>
            </span>
          </div>
          ${tags.length > 0 ? `
          <div class="flex flex-wrap gap-2 mt-3">
            ${tags.map(t => `<span class="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">${escapeHtmlText(t)}</span>`).join('')}
          </div>` : ''}
        </div>
        <div class="mt-4 flex justify-between items-center">
          <span class="text-xs text-gray-400">${reviewCount} reviews</span>
        </div>
      </div>
    </a>`;
  }).join('\n') : `
    <div class="col-span-full text-center py-12 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
      <p class="text-gray-900 text-base font-semibold mb-2">Verified ${escapeHtmlText(formattedCategory)} in Ottawa</p>
      <p class="text-gray-500 text-sm mb-4">Explore local halal dining options, browse nearby neighborhoods, or submit a new community listing.</p>
      <a href="/restaurants" class="inline-block bg-[#e90b35] text-white px-5 py-2 rounded-full font-bold text-sm text-decoration-none shadow-sm hover:bg-[#d00a2f]">View All Halal Restaurants</a>
    </div>`;

  const breadcrumbsHtml = isUnderRestaurants && cleanUrlPath !== '/restaurants'
    ? `<nav aria-label="Breadcrumbs" class="flex items-center gap-2 text-xs md:text-sm text-gray-500">
        <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
        <span class="text-gray-400">›</span>
        <a href="/restaurants" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Restaurants</a>
        <span class="text-gray-400">›</span>
        <span class="font-semibold text-gray-900">${escapeHtmlText(formattedCategory)}</span>
      </nav>`
    : `<nav aria-label="Breadcrumbs" class="flex items-center gap-2 text-xs md:text-sm text-gray-500">
        <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
        <span class="text-gray-400">›</span>
        <span class="font-semibold text-gray-900">${escapeHtmlText(formattedCategory)}</span>
      </nav>`;

  return renderSSRLayoutShell(`
    <div class="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${breadcrumbsHtml}

      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-gray-900 m-0">${escapeHtmlText(h1Text)}</h1>
          <p class="text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed m-0">${escapeHtmlText(description)}</p>
        </div>
        <a href="/listings/add" class="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f] text-decoration-none shrink-0" title="Add New Listing">
          <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </a>
      </div>

      <div class="space-y-4">
        <div class="relative w-full">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input type="text" placeholder="Search halal ${escapeHtmlText(formattedCategory.toLowerCase())} in Ottawa..." class="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none" />
        </div>

        <div class="flex md:flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <a href="/listings" class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all text-decoration-none ${cleanUrlPath === '/listings' ? 'bg-[#e90b35] text-white shadow-md shadow-red-100' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}">All</a>
          ${categoryPillsHtml}
        </div>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
        ${listingsCardsHtml}
      </div>
    </div>
  `);
}

/**
 * Static HTML for Single Listing Detail Pages (LCP optimization)
 */
export function renderListingDetailSSRHtml(listing: any): string {
  const catArray = Array.isArray(listing.category) ? listing.category : (listing.category ? [listing.category] : ['Restaurants']);
  const mainCategory = catArray[0] || 'Restaurants';
  const catSlug = normalizeCategoryToSlug(mainCategory);
  const photoUrl = (listing.photos && listing.photos.length > 0) ? listing.photos[0] : (listing.coverImage || '/ottawa-sunset.webp');
  const optimizedPhoto = getOptimizedImageUrlSSR(photoUrl, 1920, 600) || photoUrl;
  const rating = listing.averageRating ? Number(listing.averageRating).toFixed(1) : '0';
  const reviewCount = listing.reviewCount || 0;
  const address = listing.address || 'Ottawa, ON';
  const phone = listing.phoneNumber;
  const website = listing.website;
  const description = listing.description || '';

  const typesArray = Array.isArray(listing.types) ? listing.types : (listing.types ? [listing.types] : []);
  const cuisinesArray = Array.isArray(listing.cuisine) ? listing.cuisine : (listing.cuisine ? [listing.cuisine] : []);
  const tags = Array.from(new Set([...typesArray, ...cuisinesArray])).filter(Boolean).slice(0, 2);

  const tagsHtml = tags.map(tag => `
    <span class="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
      ${escapeHtmlText(tag)}
    </span>
  `).join(' ');

  const galleryHtml = (listing.photos && listing.photos.length > 1) ? `
    <div class="space-y-4 pt-4 border-t border-gray-100">
      <h2 class="text-xl font-bold text-gray-900 m-0">Photos</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        ${listing.photos.slice(0, 4).map((p: string) => `
          <div class="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100">
            <img src="${escapeHtmlAttr(getOptimizedImageUrlSSR(p, 400, 300) || p)}" alt="${escapeHtmlAttr(listing.name)}" class="w-full h-full object-cover" loading="lazy" width="400" height="300" decoding="async" />
          </div>
        `).join('\n')}
      </div>
    </div>
  ` : '';

  const descParagraphs = description ? String(description).split(/\r?\n\s*\r?\n/) : [];
  const renderDescPart = (text: string) =>
    text && text.trim()
      ? `<p class="text-gray-600 leading-relaxed whitespace-pre-wrap m-0">${escapeHtmlText(text)}</p>`
      : '';
  let aboutWithAdsHtml = '';
  if (descParagraphs.length <= 1) {
    aboutWithAdsHtml = `${renderDescPart(description)}${AD_SLOT_PLACEHOLDER_HTML}`;
  } else {
    const idx1 = Math.floor(descParagraphs.length / 2);
    const idx2 = idx1 * 2;
    const firstPart = descParagraphs.slice(0, idx1).join('\n\n');
    const secondPart = descParagraphs.slice(idx1, idx2).join('\n\n');
    const thirdPart = descParagraphs.slice(idx2).join('\n\n');
    aboutWithAdsHtml = `${renderDescPart(firstPart)}${AD_SLOT_PLACEHOLDER_HTML}${renderDescPart(secondPart)}${AD_SLOT_PLACEHOLDER_HTML}${thirdPart.trim() ? renderDescPart(thirdPart) : ''}`;
  }

  return renderSSRLayoutShell(`
    <div class="md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Hero Banner -->
      <div class="relative h-72 bg-slate-900 overflow-hidden">
        <img 
          src="${escapeHtmlAttr(optimizedPhoto)}" 
          alt="${escapeHtmlAttr(listing.name)}" 
          class="absolute inset-0 w-full h-full object-cover object-center" 
          fetchpriority="high" 
          loading="eager" 
          width="1920" 
          height="600" 
        />
          <div class="absolute inset-0 bg-black/70"></div>
          ${listing.isFeatured ? '<div class="absolute top-4 left-4 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest shadow-md">Featured</div>' : ''}
          
          <div class="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2 flex-wrap text-white">
                <a href="/${catSlug}" class="bg-[#e90b35] text-white border border-[#e90b35] px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase text-decoration-none shadow-sm">
                  ${escapeHtmlText(mainCategory)}
                </a>
                ${tagsHtml}
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-bold leading-tight m-0 text-white">${escapeHtmlText(listing.name)}</h1>
              </div>
              <div class="flex items-center gap-4 mt-2 text-sm">
                <div class="flex items-center gap-1">
                  <span class="text-yellow-400">★</span>
                  <span class="font-bold">${rating}</span>
                  <span class="text-white/70 text-xs">(${reviewCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <!-- Breadcrumbs -->
          <div class="hidden md:flex items-center gap-2 text-[13px] text-gray-500 font-medium overflow-x-auto whitespace-nowrap">
            <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
            <span class="text-gray-300">›</span>
            <a href="/${catSlug}" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">${escapeHtmlText(mainCategory)}</a>
            <span class="text-gray-300">›</span>
            <span class="text-gray-900 truncate max-w-[200px] font-semibold">${escapeHtmlText(listing.name)}</span>
          </div>

          <!-- 10-Column Layout matching ListingDetail.tsx -->
          <div class="grid grid-cols-1 lg:grid-cols-10 gap-8 mt-6">
            <!-- Left Column (col-span-7) -->
            <div class="lg:col-span-7 flex flex-col h-full gap-8">
              
              <!-- Info Buttons (Mobile: flex lg:hidden) -->
              <div class="flex lg:hidden flex-wrap justify-center gap-6 py-2">
                ${address ? `
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.name + ' ' + address)}" target="_blank" rel="nofollow noopener noreferrer" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><circle cx="12" cy="11" r="2" stroke-width="2"></circle></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Directions</span>
                </a>` : ''}

                ${phone ? `
                <a href="tel:${escapeHtmlAttr(phone)}" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Phone</span>
                </a>` : ''}

                ${listing.email ? `
                <a href="mailto:${escapeHtmlAttr(listing.email)}" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Email</span>
                </a>` : ''}

                ${website ? `
                <a href="${escapeHtmlAttr(website.startsWith('http') ? website : `https://${website}`)}" target="_blank" rel="nofollow noopener noreferrer" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="2" y1="12" x2="22" y2="12" stroke-width="2"></line><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Website</span>
                </a>` : ''}

                ${(listing.menuUrl || listing.menuPdfUrl) ? `
                <a href="${escapeHtmlAttr((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`)}" target="_blank" rel="nofollow noopener noreferrer" class="flex flex-col items-center gap-2 text-decoration-none group">
                  <div class="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35]">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <span class="text-[10px] font-bold text-gray-500 uppercase">Menu</span>
                </a>` : ''}
              </div>

              <!-- Navigation Tabs -->
              <div class="border-b border-gray-100">
                <div class="flex gap-8">
                  <span class="pb-4 font-bold text-sm text-[#e90b35] border-b-2 border-[#e90b35]">Overview</span>
                  <span class="pb-4 font-bold text-sm text-gray-400">Reviews (${reviewCount})</span>
                  ${(listing.photos && listing.photos.length > 1) ? `<span class="pb-4 font-bold text-sm text-gray-400">Photos (${listing.photos.length})</span>` : ''}
                  ${(listing.menuUrl || listing.menuPdfUrl || (listing.menuItems && listing.menuItems.length > 0)) ? `<span class="pb-4 font-bold text-sm text-gray-400">Menu</span>` : ''}
                </div>
              </div>

              <!-- About Section -->
              <section class="space-y-6">
                <div class="space-y-4">
                  <h2 class="text-xl font-bold m-0 text-gray-900">About</h2>
                  ${aboutWithAdsHtml}
                </div>
              </section>

              <!-- Menu Section (if present) -->
              ${(listing.menuUrl || listing.menuPdfUrl || (listing.menuItems && listing.menuItems.length > 0)) ? `
              <div class="space-y-4 pt-4 border-t border-gray-50">
                <div class="flex justify-between items-center">
                  <h2 class="text-xl font-bold flex items-center gap-2 m-0 text-gray-900">
                    <span class="w-8 h-8 rounded-full bg-[#e90b35]/10 text-[#e90b35] flex items-center justify-center font-bold text-sm">★</span>
                    Menu
                  </h2>
                  ${(listing.menuPdfUrl || listing.menuUrl) ? `
                  <a href="${escapeHtmlAttr((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`)}" target="_blank" rel="nofollow noopener noreferrer" class="text-[#e90b35] text-sm font-bold flex items-center gap-1 hover:underline text-decoration-none">
                    View Full Menu ↗
                  </a>` : ''}
                </div>
              </div>` : ''}

              <!-- Photos Gallery -->
              ${galleryHtml}

              <!-- Reviews Section -->
              <section class="space-y-6 pt-6 border-t border-gray-100">
                <div class="flex justify-between items-center">
                  <div>
                    <h2 class="text-xl font-bold m-0 text-gray-900">Reviews</h2>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-yellow-400 font-bold text-lg">★</span>
                      <span class="font-bold text-gray-900 text-lg">${rating}</span>
                      <span class="text-gray-400 text-sm">(${reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <!-- Right Column (Sidebar) matching ListingDetail.tsx -->
            <div class="flex flex-col lg:col-span-3 gap-6 h-full">
              <!-- Location Card -->
              ${address ? `
              <div class="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold m-0 text-gray-900">Location</h2>
                <div class="flex items-start gap-3 text-sm text-gray-600">
                  <span class="text-base text-[#e90b35] shrink-0 mt-0.5">📍</span>
                  <span>${escapeHtmlText(address)}</span>
                </div>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.name + ' ' + address)}" target="_blank" rel="nofollow noopener noreferrer" class="w-full py-3 bg-red-50 text-[#e90b35] font-bold rounded-xl hover:bg-red-100 transition-colors text-sm block text-center text-decoration-none">
                  Get Directions
                </a>
              </div>` : ''}

              <!-- Contact Card -->
              <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold mb-4 m-0 text-gray-900">Contact</h2>
                
                ${phone ? `
                <div class="flex items-center gap-4 text-sm text-gray-600">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  </div>
                  <a href="tel:${escapeHtmlAttr(phone)}" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors text-decoration-none">${escapeHtmlText(phone)}</a>
                </div>` : ''}

                ${listing.email ? `
                <div class="flex items-center gap-4 text-sm text-gray-600 break-all">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </div>
                  <a href="mailto:${escapeHtmlAttr(listing.email)}" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors line-clamp-1 text-decoration-none">${escapeHtmlText(listing.email)}</a>
                </div>` : ''}

                ${website ? `
                <div class="flex items-center gap-4 text-sm text-gray-600 break-all">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><line x1="2" y1="12" x2="22" y2="12" stroke-width="2"></line><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </div>
                  <a href="${escapeHtmlAttr(website.startsWith('http') ? website : `https://${website}`)}" target="_blank" rel="nofollow noopener noreferrer" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors line-clamp-1 text-decoration-none">
                    ${escapeHtmlText(website.replace(/^https?:\/\//, ''))}
                  </a>
                </div>` : ''}

                ${(listing.menuUrl || listing.menuPdfUrl) ? `
                <div class="flex items-center gap-4 text-sm text-gray-600 break-all pt-2">
                  <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <a href="${escapeHtmlAttr((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`)}" target="_blank" rel="nofollow noopener noreferrer" class="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors text-decoration-none">
                    View Menu
                  </a>
                </div>` : ''}
              </div>

              <!-- Hours Card -->
              ${listing.openingHours ? `
              <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold m-0 text-gray-900">Hours</h2>
                <div class="space-y-3">
                  ${(typeof listing.openingHours === 'string' ? listing.openingHours.split(', ') : []).map((hour: string) => {
                    const parts = hour.split(': ');
                    if (parts.length < 2) return `<div class="text-sm text-gray-700">${escapeHtmlText(hour)}</div>`;
                    const [day, time] = parts;
                    const isClosed = time.toLowerCase().includes('closed');
                    return `
                      <div class="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                        <span class="text-[13px] font-semibold text-gray-900">${escapeHtmlText(day)}</span>
                        <span class="text-[13px] font-semibold ${isClosed ? 'text-red-500' : 'text-gray-900'}">${escapeHtmlText(time)}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>` : ''}

              <!-- Social Media Card -->
              ${(listing.socialMedia && Object.values(listing.socialMedia).some(val => val)) ? `
              <div class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 class="text-xl font-bold mb-4 m-0 text-gray-900">Social Media</h2>
                <div class="flex flex-wrap gap-4">
                  ${listing.socialMedia?.instagram ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.instagram.startsWith('http') ? listing.socialMedia.instagram : `https://${listing.socialMedia.instagram}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    Instagram
                  </a>` : ''}
                  ${listing.socialMedia?.facebook ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.facebook.startsWith('http') ? listing.socialMedia.facebook : `https://${listing.socialMedia.facebook}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    Facebook
                  </a>` : ''}
                  ${listing.socialMedia?.twitter ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.twitter.startsWith('http') ? listing.socialMedia.twitter : `https://${listing.socialMedia.twitter}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    Twitter
                  </a>` : ''}
                  ${listing.socialMedia?.tiktok ? `
                  <a href="${escapeHtmlAttr(listing.socialMedia.tiktok.startsWith('http') ? listing.socialMedia.tiktok : `https://${listing.socialMedia.tiktok}`)}" target="_blank" rel="nofollow noopener noreferrer" class="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors text-decoration-none">
                    TikTok
                  </a>` : ''}
                </div>
              </div>` : ''}
            </div>
          </div>
        </div>
    </div>
  `);
}

/**
 * Static HTML for News Detail Pages
 */
export function renderNewsDetailSSRHtml(news: any): string {
  const coverUrl = news.coverImage ? (getOptimizedImageUrlSSR(news.coverImage, 800, 256) || news.coverImage) : '/ottawa-sunset.webp';
  const dateStr = news.publishDate || news.createdAt ? new Date(news.publishDate || news.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const authorName = news.author || 'Youssef Agrebi';
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const sourceLink = news.sourceLink ? (news.sourceLink.startsWith('http') ? news.sourceLink : `https://${news.sourceLink}`) : null;

  const rawNewsContent = news.content || news.description || '';
  const newsParagraphs = rawNewsContent ? String(rawNewsContent).split(/\r?\n\s*\r?\n/) : [];
  const renderNewsArticlePart = (text: string) =>
    text && text.trim()
      ? `<article class="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap flow-root overflow-hidden">${escapeHtmlText(text)}</article>`
      : '';
  let newsContentWithAdsHtml = '';
  if (newsParagraphs.length <= 1) {
    newsContentWithAdsHtml = `${renderNewsArticlePart(rawNewsContent)}${AD_SLOT_PLACEHOLDER_HTML}`;
  } else {
    const idx1 = Math.floor(newsParagraphs.length / 2);
    const idx2 = idx1 * 2;
    const firstPart = newsParagraphs.slice(0, idx1).join('\n\n');
    const secondPart = newsParagraphs.slice(idx1, idx2).join('\n\n');
    const thirdPart = newsParagraphs.slice(idx2).join('\n\n');
    newsContentWithAdsHtml = `${renderNewsArticlePart(firstPart)}${AD_SLOT_PLACEHOLDER_HTML}${renderNewsArticlePart(secondPart)}${AD_SLOT_PLACEHOLDER_HTML}${thirdPart.trim() ? renderNewsArticlePart(thirdPart) : ''}`;
  }

  return renderSSRLayoutShell(`
    <div class="md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="relative h-64 bg-gray-100 overflow-hidden">
        <img src="${escapeHtmlAttr(coverUrl)}" alt="${escapeHtmlAttr(news.title)}" class="w-full h-full object-cover" fetchpriority="high" loading="eager" width="800" height="256" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div class="absolute bottom-6 left-6 right-6 text-white">
          <h1 class="text-2xl font-bold leading-tight m-0 text-white">${escapeHtmlText(news.title)}</h1>
          <div class="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs text-white/90">
            <span class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${dateStr}</span>
            </span>
            <a href="/author/youssef-agrebi" class="flex items-center gap-2 text-white/90 hover:text-white font-medium text-decoration-none hover:underline">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>By ${escapeHtmlText(authorName)}</span>
            </a>
            <a href="https://www.google.com/preferences/source?q=halalottawa.ca" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/95 text-gray-900 text-[11px] font-semibold rounded-lg text-decoration-none shadow-sm">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
              <span>Preferred Source</span>
            </a>
          </div>
        </div>
      </div>

      <div class="p-6 space-y-8">
        <nav aria-label="Breadcrumbs" class="flex items-center gap-2 text-xs md:text-sm text-gray-500 font-medium overflow-x-auto whitespace-nowrap">
          <a href="/" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">Home</a>
          <span class="text-gray-300">›</span>
          <a href="/news" class="hover:text-[#e90b35] transition-colors text-decoration-none text-gray-500">News</a>
          <span class="text-gray-300">›</span>
          <span class="text-gray-900 truncate max-w-[260px] font-semibold">${escapeHtmlText(news.title)}</span>
        </nav>
        ${newsContentWithAdsHtml}

        ${sourceLink ? `
        <div class="flex justify-center pt-4">
          <a href="${escapeHtmlAttr(sourceLink)}" target="_blank" rel="nofollow noopener noreferrer" class="flex items-center gap-2 px-8 py-4 bg-[#e90b35] text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-100 hover:bg-[#d00a2f] transition-all text-decoration-none">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            Learn More
          </a>
        </div>` : ''}

        <!-- Google Preferred Source & Author Banner -->
        <div class="bg-gradient-to-r from-gray-50 via-white to-gray-50/80 border border-gray-200/80 rounded-2xl p-4 sm:p-5 shadow-xs my-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-xs">
                <img src="/favicon.png" alt="Halal Ottawa" class="w-6 h-6 object-contain shrink-0" width="24" height="24" loading="lazy" decoding="async" onerror="this.src='https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/favicon.webp'" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <a href="/author/youssef-agrebi" class="font-bold text-gray-900 text-sm sm:text-base text-decoration-none hover:text-[#e90b35]">
                    ${escapeHtmlText(authorName)}
                  </a>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                    Author
                  </span>
                </div>
                <p class="text-gray-600 text-xs sm:text-sm mt-0.5 leading-relaxed m-0">
                  Youssef Agrebi is an editor at Halal Ottawa with deep roots across the National Capital Region. Youssef is dedicated to reporting on local community announcements and Halal dining discoveries in Ottawa.
                </p>
                <div class="mt-2 flex items-center">
                  <a href="https://www.linkedin.com/in/youssef-agrebi-a05010aa/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-gray-500 hover:text-gray-700 text-decoration-none" title="Youssef Agrebi on LinkedIn" aria-label="Youssef Agrebi on LinkedIn">
                    <svg class="w-5 h-5 shrink-0" style="width:20px;height:20px;fill:#6b7280;" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.67 1.67 0 1 0 0-3.34 1.67 1.67 0 0 0 0 3.34m1.39 9.74v-8.37H5.07v8.37h2.78z"/></svg>
                  </a>
                </div>
              </div>
            </div>
            <a href="https://www.google.com/preferences/source?q=halalottawa.ca" target="_blank" rel="noopener noreferrer" class="shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 bg-white text-gray-800 text-xs sm:text-sm font-semibold rounded-xl border border-gray-200 shadow-xs text-decoration-none hover:bg-gray-50 self-start sm:self-auto" title="Add as preferred source on Google">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
              <span class="text-left leading-tight">
                Add as preferred source on Google
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `);
}

/**
 * Static HTML for News List Hub Page (/news)
 */
export function renderNewsListSSRHtml(articles: any[] = []): string {
  const newsList = articles.length > 0 ? articles : [];

  const newsCardsHtml = newsList.map((article, idx) => {
    const articleUrl = `/news/${article.slug || article.id}`;
    const coverUrl = article.coverImage ? (getOptimizedImageUrlSSR(article.coverImage, 400, 192) || article.coverImage) : '/ottawa-sunset.webp';
    const dateStr = article.publishDate || article.createdAt ? new Date(article.publishDate || article.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const authorName = article.author || 'Youssef Agrebi';

    return `
      <a href="${escapeHtmlAttr(articleUrl)}" class="block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-50 group flex flex-col text-decoration-none text-inherit">
        <div class="relative h-48 shrink-0 bg-gray-100">
          <img 
            src="${escapeHtmlAttr(coverUrl)}" 
            alt="${escapeHtmlAttr(article.title)}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            loading="${idx < 3 ? 'eager' : 'lazy'}" 
            ${idx < 3 ? 'fetchpriority="high"' : ''}
            width="400" 
            height="192" 
            decoding="async" 
          />
          ${article.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>' : ''}
        </div>
        <div class="p-5 flex flex-col justify-between flex-1">
          <div>
            <h2 class="text-lg font-bold leading-tight group-hover:text-[#e90b35] transition-colors m-0 text-gray-900">${escapeHtmlText(article.title)}</h2>
            <p class="text-gray-500 text-sm line-clamp-2 leading-relaxed mt-2 m-0">${escapeHtmlText(getPlainText(article.content || ''))}</p>
          </div>
          <div class="pt-4 flex justify-between items-end border-t border-gray-50 mt-3">
            <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-semibold">
              <span class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${dateStr}</span>
              </span>
            </div>
            <span class="flex items-center gap-1.5 text-gray-500 hover:text-[#e90b35] font-medium transition-colors cursor-pointer shrink-0">
              <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span class="hover:underline">Read More</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  return renderSSRLayoutShell(`
    <div class="p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 m-0">Ottawa News</h1>
            <a href="https://www.google.com/preferences/source?q=halalottawa.ca" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-gray-800 text-[11px] font-semibold rounded-lg border border-gray-200 shadow-2xs text-decoration-none">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
              <span>Preferred Source</span>
            </a>
          </div>
          <p class="text-sm text-gray-500 mt-1 m-0">Stay up to date with the latest stories and Muslim community news in Ottawa.</p>
        </div>
      </div>

      <!-- Google Preferred Source Banner -->
      <div class="bg-gradient-to-r from-gray-50 via-white to-red-50/30 border border-gray-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-xs">
              <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm sm:text-base leading-tight m-0">Follow Halal Ottawa on Google</h4>
              <p class="text-gray-500 text-xs sm:text-sm mt-1 leading-relaxed m-0">Add Halal Ottawa as your preferred source to see our stories first in Google Search, Top Stories, and AI Overviews.</p>
            </div>
          </div>
          <a href="https://www.google.com/preferences/source?q=halalottawa.ca" target="_blank" rel="noopener noreferrer" class="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-800 text-xs sm:text-sm font-semibold rounded-xl border border-gray-300 shadow-xs text-decoration-none">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
            <span>Add as preferred source</span>
          </a>
        </div>
      </div>

      <div class="relative w-full">
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        <input type="text" placeholder="Search community news, announcements, and articles..." class="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none" />
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        ${newsCardsHtml}
      </div>
    </div>
  `);
}

/**
 * Static HTML for FAQ Page (/faq)
 */
export function renderFAQSSRHtml(): string {
  const faqs = [
    {
      question: "What is Halal Ottawa?",
      answer: "Halal Ottawa is a community-driven platform designed to help residents and visitors discover halal-certified restaurants, grocery stores, mosques, schools, and organizations in the Ottawa region."
    },
    {
      question: "How can I add a business listing?",
      answer: "You can click on 'Add Listing' in the navigation menu. You'll need to create an account, fill out the business details (name, category, address, hours, photos), and submit it for review. Our team will approve it once verified."
    },
    {
      question: "Is it free to list my business?",
      answer: "Basic listings are completely free. We also offer featured listing options if you want to increase your visibility on our home page and search results."
    },
    {
      question: "How do you verify halal status?",
      answer: "We rely on a combination of community reporting, official certification agency data (like HMA or HMS), and direct verification with business owners. If you notice an error, please report it to us immediately."
    },
    {
      question: "How can I suggest community news or updates?",
      answer: "You can submit community news, mosque announcements, or local stories by reaching out to our editorial team at info@halalottawa.ca. All submissions are reviewed to ensure they benefit the Ottawa Muslim community."
    },
    {
      question: "How do I report a listing?",
      answer: "If you find information that is incorrect or a business that should no longer be listed, please contact us via email at info@halalottawa.ca with the listing details."
    }
  ];

  const faqsHtml = faqs.map(item => `
    <div class="border border-gray-100 rounded-xl overflow-hidden">
      <div class="w-full flex items-center justify-between p-4 md:p-6 text-left bg-white">
        <span class="font-bold text-gray-900">${escapeHtmlText(item.question)}</span>
        <svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      <div class="px-4 pb-4 md:px-6 md:pb-6 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-3">
        ${escapeHtmlText(item.answer)}
      </div>
    </div>
  `).join('\n');

  return renderSSRLayoutShell(`
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.08 4h.01"></path></svg>
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Frequently Asked Questions</h1>
            <p class="text-gray-500 max-w-2xl mx-auto m-0">
              Everything you need to know about using Halal Ottawa. Can't find what you're looking for? Reach out to our team.
            </p>
          </div>
        </div>

        <div class="space-y-4">
          ${faqsHtml}
        </div>
      </div>
    </div>
  `);
}

/**
 * Static HTML for Privacy Policy (/privacy-policy)
 */
export function renderPrivacyPolicySSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Your Privacy Matters</h1>
            <p class="text-gray-500 m-0">Last updated: March 25, 2026</p>
          </div>
        </div>

        <div class="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-8">
          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Introduction</h2>
            </div>
            <p>
              Halal Ottawa ("we", "us", or "our") is committed to protecting the privacy of our users in Ontario and across Canada. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile-optimized web application.
              We comply with the <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and other applicable Canadian privacy laws.
            </p>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Information We Collect</h2>
            </div>
            <p>We collect information that you provide directly to us when you:</p>
            <ul class="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> When you sign in via Google or email, we receive your name, email address, and profile picture.</li>
              <li><strong>User Content:</strong> Information you submit through our platform, including business listings, news articles, comments, and reviews.</li>
              <li><strong>Interaction Data:</strong> Information about the items you save (bookmarks) and your interactions with content.</li>
            </ul>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"></rect><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Data Security & Storage</h2>
            </div>
            <p>We use enterprise-grade cloud infrastructure (Google Cloud and Firebase) with encrypted data storage. We never sell your personal information to third parties.</p>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-3 text-gray-900">
              <svg class="w-5 h-5 text-[#e90b35]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              <h2 class="text-xl font-bold m-0 text-gray-900">Contact Us</h2>
            </div>
            <p>If you have questions about this Privacy Policy, please contact our team at <a href="mailto:privacy@halalottawa.ca" class="text-[#e90b35] font-semibold text-decoration-none hover:underline">privacy@halalottawa.ca</a>.</p>
          </section>
        </div>
      </div>
    </div>
  `);
}

/**
 * Static HTML for Terms of Service (/terms)
 */
export function renderTermsSSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Terms of Service</h1>
            <p class="text-gray-500 m-0">Last updated: April 29, 2024</p>
          </div>
        </div>

        <div class="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-8">
          <section class="space-y-4">
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Halal Ottawa, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on Halal Ottawa's website for personal, non-commercial transitory viewing only.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">3. User Submissions & Content</h2>
            <p>
              By submitting listings, reviews, or news articles, you certify that the information provided is accurate and complies with halal verification guidelines and community standards.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-bold text-gray-900 mb-4 m-0">4. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of Ontario, Canada.
            </p>
          </section>
        </div>
      </div>
    </div>
  `);
}

/**
 * Static HTML for Qibla Direction Page (/tools/qibla or /qibla)
 */
export function renderQiblaSSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div class="flex flex-col items-center text-center space-y-8">
          <div class="space-y-4">
            <div class="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor"></polygon></svg>
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-gray-900 m-0">Ottawa Qibla Direction</h1>
            <p class="text-gray-500 max-w-xl mx-auto m-0">
              Align your device with the arrow below to face the Kaaba in Mecca from Ottawa or anywhere else. For best accuracy, hold your device flat and away from magnetic interference.
            </p>
          </div>

          <div class="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
            Ottawa Bearing: 55.8° North-East
          </div>

          <div class="relative w-64 h-64 md:w-80 md:h-80 mx-auto my-4">
            <div class="absolute inset-0 rounded-full border-4 border-gray-100 shadow-inner bg-gray-50 flex items-center justify-center overflow-hidden">
              <div class="absolute top-4 text-[#e90b35] font-bold">N</div>
              <div class="absolute bottom-4 text-gray-400 font-bold">S</div>
              <div class="absolute right-4 text-gray-400 font-bold">E</div>
              <div class="absolute left-4 text-gray-400 font-bold">W</div>

              <div style="transform: rotate(55.8deg);" class="flex flex-col items-center justify-center">
                <div class="w-2 h-24 bg-[#e90b35] rounded-t-full shadow-md"></div>
                <span class="text-xs font-bold text-[#e90b35] mt-1">Qibla (55.8°)</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center w-full pt-4 border-t border-gray-100">
            <div class="bg-gray-50 p-4 rounded-2xl">
              <span class="text-xs text-gray-500 font-medium">True Bearing</span>
              <p class="text-lg font-bold text-gray-900 m-0 mt-1">55.8° NE</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-2xl">
              <span class="text-xs text-gray-500 font-medium">Distance to Kaaba</span>
              <p class="text-lg font-bold text-gray-900 m-0 mt-1">~10,250 km</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-2xl">
              <span class="text-xs text-gray-500 font-medium">Ottawa Coordinates</span>
              <p class="text-lg font-bold text-gray-900 m-0 mt-1">45.42° N, 75.70° W</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
}

/**
 * Static HTML for Saved Items Page (/saved)
 */
export function renderSavedItemsSSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="min-h-screen bg-[#F9FAFB] pb-12" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="max-w-5xl mx-auto px-6 py-8 space-y-12">
        <h1 class="text-3xl font-bold m-0 text-gray-900">Saved Items</h1>

        <section class="space-y-3">
          <h2 class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2 m-0">
            Saved Listings & News
          </h2>
          <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <div class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-[#e90b35] mx-auto">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 m-0">Saved Places & Articles</h3>
            <p class="text-sm text-gray-500 max-w-md mx-auto m-0">Keep track of your favorite Ottawa halal restaurants, grocery spots, and community news.</p>
            <div class="pt-4 flex flex-wrap gap-3 justify-center">
              <a href="/restaurants" class="px-5 py-2.5 bg-[#e90b35] text-white font-bold text-sm rounded-xl text-decoration-none shadow-md hover:bg-[#d00a2f] transition-all">
                Explore Restaurants
              </a>
              <a href="/mosques" class="px-5 py-2.5 bg-gray-100 text-gray-800 font-bold text-sm rounded-xl text-decoration-none hover:bg-gray-200 transition-all">
                Find Mosques
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  `);
}

/**
 * Static HTML for Login Page (/login)
 */
export function renderLoginSSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="min-h-screen bg-gray-50 flex flex-col justify-start pt-8 px-6 pb-6 max-w-md mx-auto w-full" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="text-center mb-5 space-y-1">
        <div class="w-12 h-12 bg-[#e90b35] rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-red-200 text-white">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 m-0">Welcome Back</h1>
        <p class="text-sm text-gray-500 m-0">Sign in to access community features.</p>
      </div>

      <div class="flex p-1 bg-gray-200/50 rounded-2xl mb-4">
        <a href="/login" class="flex-1 py-3 text-sm font-bold rounded-xl bg-white text-gray-900 shadow-sm text-center text-decoration-none">Login</a>
        <a href="/register" class="flex-1 py-3 text-sm font-bold rounded-xl text-gray-500 hover:text-gray-700 text-center text-decoration-none">Register</a>
      </div>

      <a href="/login" class="w-full py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm text-decoration-none">
        <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"></path></svg>
        Sign in with Google
      </a>

      <div class="relative py-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-4 bg-gray-50 text-gray-400 uppercase tracking-[0.2em] text-[11px] font-bold">Or continue with email</span>
        </div>
      </div>

      <div class="space-y-4">
        <div class="relative">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          <input type="email" placeholder="Email Address" class="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none" />
        </div>
        <div class="relative">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"></rect><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11V7a5 5 0 0110 0v4"></path></svg>
          <input type="password" placeholder="Password" class="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm outline-none" />
        </div>
      </div>

      <p class="text-xs text-gray-400 text-center mt-6">
        By signing in, you agree to Halal Ottawa's <a href="/terms" class="text-gray-600 underline text-decoration-none">Terms of Service</a> and <a href="/privacy-policy" class="text-gray-600 underline text-decoration-none">Privacy Policy</a>.
      </p>
    </div>
  `);
}

/**
 * Static HTML for Add Listing Page (/listings/add)
 */
export function renderAddListingSSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="p-4 md:p-8 max-w-3xl mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="bg-white rounded-3xl border border-gray-100 p-6 md:p-10 shadow-sm space-y-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 m-0">Submit a Place in Ottawa</h1>
          <p class="text-sm text-gray-500 mt-1 m-0">Help Ottawa Muslims discover certified halal restaurants, grocery markets, mosques, and schools.</p>
        </div>

        <div class="p-4 bg-red-50/70 border border-red-100 rounded-2xl text-sm text-red-900 space-y-2">
          <strong>Community Guidelines:</strong>
          <ul class="list-disc pl-5 space-y-1 text-xs text-red-800 m-0">
            <li>Establishment must be located within the Greater Ottawa & Gatineau region.</li>
            <li>Food businesses must offer certified halal meat or 100% halal menu options.</li>
            <li>All submissions undergo verification by community moderators before public listing.</li>
          </ul>
        </div>

        <div class="space-y-4 pt-2">
          <div class="p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Step 1: Business Details</span>
            <p class="text-sm text-gray-700 mt-1 m-0">Name, category (Restaurant, Mosque, Grocery, School, Butcher, Clothing), address, and phone number.</p>
          </div>
          <div class="p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Step 2: Halal & Dietary Information</span>
            <p class="text-sm text-gray-700 mt-1 m-0">Halal certification body, hand-slaughtered zabihah status, pork/alcohol free declaration.</p>
          </div>
          <div class="p-4 border border-gray-100 rounded-2xl bg-gray-50">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Step 3: Operating Hours & Photos</span>
            <p class="text-sm text-gray-700 mt-1 m-0">Upload storefront and interior photos, add operating hours and social links.</p>
          </div>
        </div>
      </div>
    </div>
  `);
}

/**
 * Static HTML for Author Profile Pages (/author/youssef-agrebi)
 */
export function renderAuthorSSRHtml(authorData: any = {}, articles: any[] = []): string {
  const authorName = authorData.name || "Youssef Agrebi";
  const initials = authorName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const authorBio = "Youssef Agrebi is an editor at Halal Ottawa with deep roots across the National Capital Region. Youssef is dedicated to reporting on local community announcements and Halal dining discoveries in Ottawa.";

  const articlesHtml = articles.map((article, idx) => {
    const articleUrl = `/news/${article.slug || article.id}`;
    const coverUrl = article.coverImage ? (getOptimizedImageUrlSSR(article.coverImage, 400, 192) || article.coverImage) : '/ottawa-sunset.webp';
    const dateStr = article.publishDate || article.createdAt ? new Date(article.publishDate || article.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    return `
      <a href="${escapeHtmlAttr(articleUrl)}" class="bg-white hover:shadow-md transition-all border border-gray-100 group flex flex-col rounded-3xl overflow-hidden shadow-sm text-decoration-none text-inherit">
        <div class="relative h-48 shrink-0 bg-gray-100 overflow-hidden">
          <img 
            src="${escapeHtmlAttr(coverUrl)}" 
            alt="${escapeHtmlAttr(article.title)}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            loading="${idx < 3 ? 'eager' : 'lazy'}" 
            ${idx < 3 ? 'fetchpriority="high"' : ''}
            width="400" 
            height="192" 
            decoding="async" 
          />
          ${article.isFeatured ? '<div class="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">Featured</div>' : ''}
        </div>
        <div class="flex-1 flex flex-col justify-between p-5 sm:p-6">
          <div>
            <h3 class="font-bold text-base sm:text-lg leading-snug text-gray-900 group-hover:text-[#e90b35] transition-colors line-clamp-2 m-0">${escapeHtmlText(article.title)}</h3>
            <p class="text-gray-500 text-xs sm:text-sm line-clamp-3 leading-relaxed mt-2.5 m-0">${escapeHtmlText(getPlainText(article.content || ''))}</p>
          </div>
          <div class="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-semibold">
            <span class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>${dateStr}</span>
            </span>
            <span class="flex items-center gap-1.5 text-gray-500 hover:text-[#e90b35] font-medium transition-colors cursor-pointer shrink-0">
              <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span class="hover:underline">Read More</span>
            </span>
          </div>
        </div>
      </a>
    `;
  }).join('\n');

  return renderSSRLayoutShell(`
    <div class="p-4 md:p-8 space-y-8 max-w-7xl xl:max-w-[1400px] mx-auto min-h-screen" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Breadcrumb -->
      <nav aria-label="Breadcrumb" class="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <a href="/" class="text-inherit hover:text-[#e90b35] text-decoration-none">Home</a>
        <span>/</span>
        <a href="/news" class="text-inherit hover:text-[#e90b35] text-decoration-none">News</a>
        <span>/</span>
        <span class="text-gray-900 font-bold">${escapeHtmlText(authorName)}</span>
      </nav>

      <!-- About Author Section -->
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-gray-900 m-0">About ${escapeHtmlText(authorName)}</h1>
          <p class="text-xs sm:text-sm text-gray-500 mt-1 m-0 leading-relaxed max-w-3xl">${escapeHtmlText(authorBio)}</p>
          <div class="mt-2.5 flex items-center">
            <a href="https://www.linkedin.com/in/youssef-agrebi-a05010aa/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-gray-500 hover:text-gray-700 text-decoration-none" title="Connect with ${escapeHtmlText(authorName)} on LinkedIn" aria-label="Connect with ${escapeHtmlText(authorName)} on LinkedIn">
              <svg class="w-5 h-5 shrink-0" style="width:20px;height:20px;fill:#6b7280;" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.67 1.67 0 1 0 0-3.34 1.67 1.67 0 0 0 0 3.34m1.39 9.74v-8.37H5.07v8.37h2.78z"/></svg>
            </a>
          </div>
        </div>
        <div class="shrink-0 pt-1">
          <a href="https://www.google.com/preferences/source?q=halalottawa.ca" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-gray-800 text-xs sm:text-sm font-semibold rounded-xl border border-gray-300 shadow-2xs text-decoration-none">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/></svg>
            <span>Add as preferred source on Google</span>
            <svg class="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </a>
        </div>
      </div>

      <!-- Articles Section -->
      <section class="space-y-6">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900 m-0">Articles by ${escapeHtmlText(authorName)}</h2>
          <p class="text-xs sm:text-sm text-gray-500 mt-1 m-0">Explore ${articles.length} published ${articles.length === 1 ? 'story' : 'stories'}, community announcements, and halal dining discoveries across Ottawa.</p>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${articlesHtml}
        </div>
      </section>
    </div>
  `);
}

/**
 * Static HTML for 404 Not Found Pages
 */
export function renderNotFoundSSRHtml(): string {
  return renderSSRLayoutShell(`
    <div class="flex-1 w-full max-w-7xl mx-auto px-4 mt-8 lg:mt-12 mb-20 flex flex-col items-center justify-center" style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div class="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 w-full text-center space-y-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div class="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <span class="text-3xl font-bold text-[#e90b35]">404</span>
        </div>
        
        <div class="space-y-2 max-w-md mx-auto">
          <h1 class="text-2xl font-bold text-gray-900 m-0">Page Not Found</h1>
          <p class="text-gray-500 m-0">Sorry, we couldn't find the page you're looking for.</p>
        </div>

        <div class="pt-4 flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mx-auto">
          <a href="/" class="flex-1 inline-flex items-center justify-center px-6 py-3.5 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-[#d00a2f] active:scale-95 transition-all text-decoration-none">
            Go Home
          </a>
          <a href="/listings" class="flex-1 inline-flex items-center justify-center px-6 py-3.5 border border-gray-200 rounded-2xl text-gray-700 bg-white hover:bg-gray-50 font-bold transition-all active:scale-95 text-decoration-none">
            Browse All Listings
          </a>
        </div>
      </div>
    </div>
  `);
}

