export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  location?: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  consentToUpdates: boolean;
  emailFrequency?: 'immediately' | 'daily' | 'weekly' | 'bi-weekly' | 'never';
  pushNotifications: boolean;
  pushFrequency?: 'immediately' | 'daily' | 'weekly' | 'bi-weekly' | 'never';
  savedListings?: string[];
  savedNews?: string[];
  savedEvents?: string[];
  savedJobs?: string[];
}

export type ListingCategory = 'Restaurants' | 'Mosques' | 'Organizations' | 'Grocery' | 'Clothing' | 'Schools' | 'Butchers';

export type ListingType = 'Bakery' | 'Pizza' | 'Burgers' | 'Cafés' | 'Seafood' | 'Steakhouse' | 'Shawarma' | 'Poutine' | 'Brunch' | 'Breakfast' | 'Pho' | 'Ramen' | 'Fried Chicken' | 'Buffet' | 'Tacos';
export type CuisineType = 'Turkish' | 'Middle Eastern' | 'Moroccan' | 'Lebanese' | 'Syrian' | 'Pakistani' | 'Afghani' | 'Indian' | 'Persian' | 'Chinese' | 'Mediterranean' | 'Thai' | 'Korean' | 'Italian' | 'Bangladeshi' | 'Mexican' | 'Ethiopian';

export interface Listing {
  id: string;
  slug?: string;
  name: string;
  photos: string[];
  address: string;
  suburb?: string;
  lat: number;
  lng: number;
  distance?: number;
  phoneNumber: string;
  email?: string;
  website?: string;
  openingHours: string;
  description: string;
  category: ListingCategory[];
  types?: ListingType[];
  cuisine?: CuisineType[];
  averageRating: number;
  reviewCount: number;
  isFeatured: boolean;
  isApproved: boolean;
  submittedBy: string;
  createdAt: string;
  views?: number;
  // Plan/Monetization logic
  plan?: 'basic' | 'premium';
  autoRenewPremium?: boolean;
  autoRenewFeatured?: boolean;
  // Premium Features
  menuPdfUrl?: string; // New field for PDF menu URL
  menuUrl?: string; // Add menu
  menuItems?: {
    category: string;
    items: {
      name: string;
      price: string;
      description?: string;
    }[];
  }[];
  socialMediaLinks?: string[]; // Array of full URLs
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };
}

export interface PlanRequest {
  id: string;
  listingId: string;
  userId: string;
  listingName: string;
  plan: 'basic' | 'premium';
  isFeatured: boolean;
  autoRenewPremium: boolean;
  autoRenewFeatured: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  requestType: 'new_listing' | 'claim_listing';
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface Review {
  id: string;
  listingId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
}

export interface NewsArticle {
  id: string;
  slug?: string;
  title: string;
  coverImage: string;
  author: string;
  publishDate: string;
  content: string;
  sourceLink?: string;
  isFeatured: boolean;
  isApproved: boolean;
  submittedBy: string;
  createdAt: string;
  views?: number;
  commentCount?: number;
}

export interface Event {
  id: string;
  slug?: string;
  title: string;
  coverImage: string;
  organizer: string;
  location: string;
  lat: number;
  lng: number;
  dateTime: string;
  isMultiDay?: boolean;
  endDate?: string;
  description: string;
  registrationLink?: string;
  isFeatured: boolean;
  isApproved: boolean;
  submittedBy: string;
  createdAt: string;
  views?: number;
  attendeeCount?: number;
}

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Freelance' | 'Internship';

export interface Job {
  id: string;
  slug?: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  description: string;
  salary?: string;
  type: JobType;
  applyLink: string;
  isFeatured: boolean;
  isApproved: boolean;
  submittedBy: string;
  createdAt: string;
  views?: number;
  applicationCount?: number;
}

export interface Comment {
  id: string;
  parentId: string; // NewsArticle ID or Event ID
  parentType: 'news' | 'event';
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  isApproved: boolean;
  createdAt: string;
  replyTo?: string; // ID of another comment
}

export interface Ad {
  id: string;
  imageUrl: string;
  link: string;
  placement: 'news' | 'event';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  isRead: boolean;
  createdAt: string;
}
