import type { TileKey } from '@/lib/section';

/**
 * The hub's tile photos (Unsplash License, credits in assets/images/sections/CREDITS.md), resized to
 * 900 px wide JPEGs so the OTA bundle stays small (about 330 KB for all six).
 */
export const SECTION_PHOTOS: Record<TileKey, number> = {
  esports: require('../../assets/images/sections/esports.jpg'),
  gym: require('../../assets/images/sections/gym.jpg'),
  venues: require('../../assets/images/sections/venues.jpg'),
  shop: require('../../assets/images/sections/shop.jpg'),
  hire: require('../../assets/images/sections/hire.jpg'),
  events: require('../../assets/images/sections/events.jpg'),
};
