import { Listing, NewsArticle, Event, Job, ListingType, CuisineType } from './types';

export const CATEGORIES = [
  'Restaurants',
  'Mosques',
  'Organizations',
  'Grocery',
  'Clothing',
  'Schools',
  'Butchers',
] as const;

export const LISTING_TYPES: ListingType[] = [
  'Bakery', 'Pizza', 'Burgers', 'Cafés', 'Seafood', 'Steakhouse', 'Shawarma', 'Poutine', 'Brunch', 'Breakfast', 'Pho', 'Ramen', 'Fried Chicken', 'Buffet', 'Tacos'
];

export const CUISINES: CuisineType[] = [
  'Turkish', 'Middle Eastern', 'Moroccan', 'Lebanese', 'Syrian', 'Pakistani', 'Afghani', 'Indian', 'Persian', 'Chinese', 'Mediterranean', 'Thai', 'Korean', 'Italian', 'Bangladeshi', 'Mexican', 'Ethiopian'
];

export const DEMO_LISTINGS: Listing[] = [];

export const DEMO_NEWS: NewsArticle[] = [];

export const DEMO_EVENTS: Event[] = [];

export const DEMO_JOBS: Job[] = [];
