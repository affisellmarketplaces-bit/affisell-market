/** Amazon-style marketplace departments for sidebar taxonomy. */

export type DepartmentBadge = "NEW" | "ECO"

export type Department = {
  id: string
  name: string
  icon: string
  count: string
  badge?: DepartmentBadge
}

export const DEPARTMENTS: Department[] = [
  { id: "automotive", name: "Automotive", icon: "🚗", count: "18.4k" },
  { id: "baby", name: "Baby", icon: "👶", count: "26.1k" },
  { id: "beauty", name: "Beauty & Personal Care", icon: "💄", count: "42.8k", badge: "NEW" },
  { id: "books", name: "Books", icon: "📚", count: "91.3k" },
  { id: "cell-phones", name: "Cell Phones & Accessories", icon: "📱", count: "33.7k" },
  { id: "clothing", name: "Clothing, Shoes & Jewelry", icon: "👗", count: "156k" },
  { id: "computers", name: "Computers & Office", icon: "💻", count: "67.2k" },
  { id: "electronics", name: "Electronics", icon: "🔌", count: "124k" },
  { id: "garden", name: "Garden & Outdoor", icon: "🌿", count: "22.9k", badge: "ECO" },
  { id: "grocery", name: "Grocery & Gourmet Food", icon: "🛒", count: "54.6k" },
  { id: "health-household", name: "Health & Household", icon: "🏥", count: "38.1k" },
  { id: "home-kitchen", name: "Home & Kitchen", icon: "🏠", count: "98.5k" },
  { id: "industrial", name: "Industrial & Scientific", icon: "⚗️", count: "11.2k" },
  { id: "luggage", name: "Luggage & Travel Gear", icon: "🧳", count: "9.8k" },
  { id: "luxury-beauty", name: "Luxury Beauty", icon: "✨", count: "6.4k" },
  { id: "movies-tv", name: "Movies & TV", icon: "🎬", count: "31.0k" },
  { id: "music-cd", name: "Music, CDs & Vinyl", icon: "🎵", count: "14.3k" },
  { id: "musical-instruments", name: "Musical Instruments", icon: "🎸", count: "7.9k" },
  { id: "office-products", name: "Office Products", icon: "📎", count: "19.6k" },
  { id: "pet-supplies", name: "Pet Supplies", icon: "🐕", count: "28.4k", badge: "NEW" },
  { id: "software", name: "Software", icon: "💾", count: "5.3k" },
  { id: "sports-outdoors", name: "Sports & Outdoors", icon: "⚽", count: "45.7k", badge: "ECO" },
  { id: "tools-improvement", name: "Tools & Home Improvement", icon: "🔧", count: "36.2k" },
  { id: "toys-games", name: "Toys & Games", icon: "🧸", count: "61.9k" },
  { id: "video-games", name: "Video Games", icon: "🎮", count: "52.1k" },
  { id: "arts-crafts", name: "Arts, Crafts & Sewing", icon: "🎨", count: "13.8k" },
  { id: "handmade", name: "Handmade", icon: "🧶", count: "8.7k", badge: "NEW" },
  { id: "appliances", name: "Appliances", icon: "🧊", count: "24.0k" },
  { id: "collectibles", name: "Collectibles & Fine Art", icon: "🖼️", count: "4.2k" },
  { id: "digital-music", name: "Digital Music", icon: "🎧", count: "12.1k" },
  { id: "gift-cards", name: "Gift Cards", icon: "🎁", count: "3.9k" },
  { id: "subscribe-save", name: "Subscribe & Save", icon: "🔁", count: "16.5k" },
  { id: "smart-home", name: "Smart Home", icon: "🏡", count: "21.3k" },
  { id: "affordable", name: "Affordable Finds", icon: "💰", count: "89.0k" },
  { id: "same-day", name: "Same-Day Delivery", icon: "⚡", count: "7.1k" },
]
