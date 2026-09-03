import { Event } from "../types";

// Pre-generated local community events in Ottawa to guarantee instant render with zero LLM waiting time
export const PREGENERATED_COMMUNITY_EVENTS: Event[] = [
  {
    id: "pregen-ottawa-halal-food-fest-2026",
    slug: "ottawa-halal-food-fest-2026",
    title: "Ottawa Halal Food & Heritage Festival",
    description: "Experience the premier annual celebration of authentic halal cuisines from across the globe, featuring local Ottawa food trucks, family bazaar stalls, cultural exhibitions, and community presentations.",
    organizer: "Ottawa Muslim Association & Community Partners",
    location: "Lansdowne Park, 1525 Princess Patricia Way, Ottawa, ON",
    dateTime: "2026-07-18T11:00:00.000Z",
    coverImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200",
    isFeatured: true,
    isApproved: true,
    createdAt: "2026-01-15T12:00:00.000Z",
    submittedBy: "system",
    lat: 45.3995,
    lng: -75.6836
  },
  {
    id: "pregen-oma-open-house-2026",
    slug: "ottawa-mosque-community-open-house",
    title: "Ottawa Mosque Community Open House & Cultural Tour",
    description: "A welcoming guided tour and interactive open house at the historic Ottawa Mosque on Northwestern Avenue. Discover Islamic art, architecture, library archives, and engage in open dialogue with local scholars.",
    organizer: "Ottawa Mosque (OMA)",
    location: "251 Northwestern Ave, Ottawa, ON K1Y 0M1",
    dateTime: "2026-05-09T13:00:00.000Z",
    coverImage: "https://images.unsplash.com/photo-1542810634-71277d95dcbb?q=80&w=1200",
    isFeatured: true,
    isApproved: true,
    createdAt: "2026-01-20T14:30:00.000Z",
    submittedBy: "system",
    lat: 45.3976,
    lng: -75.7381
  },
  {
    id: "pregen-kma-youth-sports-2026",
    slug: "kanata-youth-halaqa-sports-night",
    title: "Kanata Muslim Association Youth Night & Sports",
    description: "A fun and uplifting evening for youth in the west end, featuring basketball, indoor sports, team-building discussions, and a community dinner at the Kanata Muslim Association center.",
    organizer: "Kanata Muslim Association (KMA)",
    location: "351 Sandhill Rd, Kanata, ON K2K 2V2",
    dateTime: "2026-04-25T18:00:00.000Z",
    coverImage: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?q=80&w=1200",
    isFeatured: false,
    isApproved: true,
    createdAt: "2026-02-01T10:00:00.000Z",
    submittedBy: "system",
    lat: 45.3347,
    lng: -75.9189
  },
  {
    id: "pregen-snmc-family-bazaar-2026",
    slug: "snmc-barrhaven-family-bazaar",
    title: "SNMC Barrhaven Family BBQ & Community Bazaar",
    description: "Annual outdoor community gathering hosted by the South Nepean Muslim Community in Barrhaven. Features local artisan vendors, halal barbecue, children's bouncy castles, and charity initiatives.",
    organizer: "South Nepean Muslim Community (SNMC)",
    location: "3020 Woodroffe Ave, Nepean, ON K2J 4G3",
    dateTime: "2026-06-13T12:00:00.000Z",
    coverImage: "https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200",
    isFeatured: true,
    isApproved: true,
    createdAt: "2026-02-10T09:00:00.000Z",
    submittedBy: "system",
    lat: 45.2818,
    lng: -75.7486
  }
];

/**
 * Fetches recent community events using a cached server-side endpoint with revalidation,
 * or immediate pre-generated data. The browser NEVER invokes a live synchronous LLM call
 * to render default page content.
 */
export const fetchRecentEvents = async (): Promise<Event[]> => {
  try {
    const response = await fetch('/api/events/cached');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        return data.events;
      }
    }
  } catch (error) {
    console.warn("Could not fetch server-cached events, serving pre-generated events:", error);
  }
  return PREGENERATED_COMMUNITY_EVENTS;
};

