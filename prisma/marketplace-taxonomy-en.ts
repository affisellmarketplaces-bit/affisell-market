/**
 * US/UK-style marketplace category taxonomy (English, 3 levels: L1 > L2 > leaf).
 * Slugs are globally unique; seed inserts in parent-before-child order.
 */

export type TaxonomyChannel = { name: string; leaves: string[] }

export type TaxonomyRoot = {
  name: string
  slug: string
  icon: string
  channels: TaxonomyChannel[]
}

export type FlatCatRow = {
  name: string
  slug: string
  icon: string
  order: number
  parentSlug: string | null
}

function seg(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s*&\s*/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)
}

/** Curated top-level departments and aisles (English, US/UK-oriented retail nav). */
export const MARKETPLACE_CATEGORY_TAXONOMY_EN: TaxonomyRoot[] = [
  {
    name: "Home Supplies",
    slug: "home-supplies",
    icon: "🏠",
    channels: [
      {
        name: "Bathroom Supplies",
        leaves: [
          "Toothbrush Holders",
          "Soap Dispensers",
          "Shower Curtains",
          "Bath Mats",
          "Towel Racks",
          "Toilet Brushes",
        ],
      },
      {
        name: "Kitchen Storage",
        leaves: ["Food Containers", "Spice Racks", "Drawer Organisers", "Pantry Baskets", "Cabinet Shelves", "Wine Racks"],
      },
      {
        name: "Cleaning Supplies",
        leaves: ["Mops", "Brooms", "Cleaning Cloths", "Spray Bottles", "Vacuum Accessories", "Rubber Gloves"],
      },
      {
        name: "Laundry Care",
        leaves: ["Laundry Baskets", "Drying Racks", "Ironing Boards", "Lint Rollers", "Clothes Pegs", "Fabric Softener Balls"],
      },
      {
        name: "Home Fragrance",
        leaves: ["Scented Candles", "Reed Diffusers", "Room Sprays", "Wax Melts", "Incense Holders", "Air Fresheners"],
      },
    ],
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    icon: "🍳",
    channels: [
      {
        name: "Cookware",
        leaves: ["Frying Pans", "Sauce Pans", "Stock Pots", "Woks", "Dutch Ovens", "Grill Pans"],
      },
      {
        name: "Bakeware",
        leaves: ["Cake Tins", "Muffin Trays", "Baking Sheets", "Loaf Pans", "Cooling Racks", "Piping Bags"],
      },
      {
        name: "Kitchen Tools",
        leaves: ["Knife Sets", "Cutting Boards", "Peelers", "Whisks", "Spatulas", "Measuring Cups"],
      },
      {
        name: "Tableware",
        leaves: ["Dinner Plates", "Bowls", "Mugs", "Glassware", "Cutlery Sets", "Serving Platters"],
      },
      {
        name: "Small Appliances",
        leaves: ["Kettles", "Toasters", "Blenders", "Air Fryers", "Rice Cookers", "Coffee Makers"],
      },
      {
        name: "Lighting",
        leaves: ["Desk Lamps", "Floor Lamps", "Pendant Lights", "LED Strips", "Night Lights", "Bulbs"],
      },
    ],
  },
  {
    name: "Textiles & Soft Furnishings",
    slug: "textiles-soft-furnishings",
    icon: "🛏️",
    channels: [
      {
        name: "Bedding",
        leaves: [
          "Duvet Covers",
          "Fitted Sheets",
          "Pillowcases",
          "Memory Foam Pillows",
          "Blankets",
          "Mattress Protectors",
          "Bed Skirts",
        ],
      },
      {
        name: "Bath Textiles",
        leaves: ["Bath Towels", "Hand Towels", "Bathrobes", "Washcloths", "Bath Mats", "Shower Curtains"],
      },
      {
        name: "Curtains & Blinds",
        leaves: ["Blackout Curtains", "Sheer Panels", "Roller Blinds", "Curtain Rods", "Tiebacks", "Valances"],
      },
      {
        name: "Cushions & Throws",
        leaves: ["Sofa Cushions", "Floor Cushions", "Throws", "Cushion Covers", "Bean Bags", "Bolsters"],
      },
    ],
  },
  {
    name: "Women's Wear & Underwear",
    slug: "womens-wear-and-underwear",
    icon: "👗",
    channels: [
      {
        name: "Dresses",
        leaves: ["Casual Dresses", "Party Dresses", "Maxi Dresses", "Shirt Dresses", "Bodycon Dresses", "Summer Dresses"],
      },
      {
        name: "Tops & Tees",
        leaves: ["T-Shirts", "Blouses", "Tank Tops", "Hoodies", "Sweatshirts", "Crop Tops"],
      },
      {
        name: "Bottoms",
        leaves: ["Jeans", "Leggings", "Trousers", "Shorts", "Skirts", "Joggers"],
      },
      {
        name: "Underwear & Loungewear",
        leaves: ["Bras", "Briefs", "Camisoles", "Pyjama Sets", "Robes", "Socks"],
      },
      {
        name: "Bags & Handbags",
        leaves: ["Tote Bags", "Crossbody Bags", "Clutches", "Shoulder Bags", "Backpacks", "Wallets"],
      },
      {
        name: "Fashion Accessories",
        leaves: ["Belts", "Hair Accessories", "Scarves", "Gloves", "Hats", "Sunglasses"],
      },
    ],
  },
  {
    name: "Menswear & Underwear",
    slug: "menswear-and-underwear",
    icon: "👔",
    channels: [
      {
        name: "Shirts",
        leaves: ["Dress Shirts", "Casual Shirts", "Polo Shirts", "Flannel Shirts", "Oxford Shirts", "Linen Shirts"],
      },
      {
        name: "Trousers & Shorts",
        leaves: ["Chinos", "Cargo Trousers", "Jeans", "Shorts", "Joggers", "Suit Trousers"],
      },
      {
        name: "Outerwear",
        leaves: ["Jackets", "Coats", "Blazers", "Gilets", "Parkas", "Bomber Jackets"],
      },
      {
        name: "Underwear & Basics",
        leaves: ["Boxers", "Briefs", "Undershirts", "Socks", "Vests", "Thermal Tops"],
      },
      {
        name: "Grooming",
        leaves: ["Beard Oils", "Beard Balms", "Razors", "Shaving Cream", "Aftershave", "Hair Wax"],
      },
    ],
  },
  {
    name: "Kids' Fashion",
    slug: "kids-fashion",
    icon: "👶",
    channels: [
      {
        name: "Baby Clothing",
        leaves: ["Babygrows", "Bodysuits", "Baby Hats", "Scratch Mittens", "Bibs", "Rompers"],
      },
      {
        name: "Boys' Clothing",
        leaves: ["Boys' T-Shirts", "Boys' Shorts", "Boys' Jeans", "Boys' Hoodies", "School Uniforms", "Swimwear"],
      },
      {
        name: "Girls' Clothing",
        leaves: ["Girls' Dresses", "Girls' Skirts", "Girls' Tops", "Girls' Leggings", "School Uniforms", "Swimwear"],
      },
    ],
  },
  {
    name: "Muslim Fashion",
    slug: "muslim-fashion",
    icon: "🧕",
    channels: [
      {
        name: "Hijabs & Scarves",
        leaves: ["Chiffon Hijabs", "Jersey Hijabs", "Instant Hijabs", "Underscarves", "Pins", "Hijab Caps"],
      },
      {
        name: "Abayas & Dresses",
        leaves: ["Open Abayas", "Closed Abayas", "Kimono Abayas", "Modest Maxi Dresses", "Pleated Dresses", "Kaftans"],
      },
      {
        name: "Modest Tops",
        leaves: ["Tunics", "Longline Tops", "Layering Tops", "Modest Blouses", "Cardigans", "Kimono Tops"],
      },
    ],
  },
  {
    name: "Shoes",
    slug: "shoes",
    icon: "👟",
    channels: [
      {
        name: "Sneakers",
        leaves: ["Running Shoes", "Lifestyle Sneakers", "Slip-Ons", "High-Tops", "Trail Shoes", "Walking Shoes"],
      },
      {
        name: "Heels & Flats",
        leaves: ["Stilettos", "Block Heels", "Ballet Flats", "Loafers", "Mules", "Wedges"],
      },
      {
        name: "Boots & Sandals",
        leaves: ["Ankle Boots", "Knee Boots", "Sandals", "Slides", "Flip-Flops", "Winter Boots"],
      },
      {
        name: "Sports Footwear",
        leaves: ["Training Shoes", "Basketball Shoes", "Football Boots", "Hiking Boots", "Cycling Shoes", "Court Shoes"],
      },
    ],
  },
  {
    name: "Bags & Luggage",
    slug: "bags-and-luggage",
    icon: "🧳",
    channels: [
      {
        name: "Handbags",
        leaves: ["Satchels", "Bucket Bags", "Hobo Bags", "Mini Bags", "Chain Bags", "Quilted Bags"],
      },
      {
        name: "Backpacks",
        leaves: ["Laptop Backpacks", "Travel Backpacks", "Mini Backpacks", "Anti-Theft Backpacks", "School Backpacks", "Hydration Packs"],
      },
      {
        name: "Luggage",
        leaves: ["Carry-On Suitcases", "Checked Suitcases", "Travel Sets", "Garment Bags", "Toiletry Bags", "Packing Cubes"],
      },
      {
        name: "Wallets & Card Holders",
        leaves: ["Bifold Wallets", "Card Holders", "Coin Purses", "Passport Holders", "Phone Wallets", "Zip Wallets"],
      },
    ],
  },
  {
    name: "Jewelry & Accessories",
    slug: "jewelry-and-accessories",
    icon: "💎",
    channels: [
      {
        name: "Necklaces & Pendants",
        leaves: ["Gold Necklaces", "Silver Necklaces", "Charm Necklaces", "Chokers", "Pendant Sets", "Layered Chains"],
      },
      {
        name: "Earrings",
        leaves: ["Stud Earrings", "Hoop Earrings", "Drop Earrings", "Clip-Ons", "Ear Cuffs", "Huggies"],
      },
      {
        name: "Watches",
        leaves: ["Fashion Watches", "Smartwatches", "Watch Straps", "Pocket Watches", "Couple Watches", "Kids' Watches"],
      },
      {
        name: "Rings & Bracelets",
        leaves: ["Statement Rings", "Stacking Rings", "Charm Bracelets", "Cuff Bracelets", "Beaded Bracelets", "Anklets"],
      },
    ],
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty-and-personal-care",
    icon: "💄",
    channels: [
      {
        name: "Skincare",
        leaves: ["Face Serums", "Face Creams", "Cleansers", "Toners", "Sunscreen", "Face Masks"],
      },
      {
        name: "Makeup",
        leaves: ["Lipstick", "Foundation", "Mascara", "Eyeshadow Palettes", "Blush", "Setting Spray"],
      },
      {
        name: "Hair Care",
        leaves: ["Shampoo", "Conditioner", "Hair Oil", "Dry Shampoo", "Styling Cream", "Hair Brushes"],
      },
      {
        name: "Bath & Body",
        leaves: ["Body Lotion", "Body Wash", "Hand Cream", "Body Scrubs", "Deodorant", "Shower Tools"],
      },
    ],
  },
  {
    name: "Electronics",
    slug: "electronics",
    icon: "📱",
    channels: [
      {
        name: "Audio",
        leaves: ["Over-Ear Headphones", "In-Ear Earbuds", "Bluetooth Speakers", "Soundbars", "Microphones", "DACs"],
      },
      {
        name: "Cameras & Drones",
        leaves: ["Action Cameras", "Webcams", "Ring Lights", "Camera Tripods", "Memory Cards", "Drone Accessories"],
      },
      {
        name: "Wearables",
        leaves: ["Fitness Trackers", "Smart Rings", "Heart Rate Monitors", "GPS Watches", "Charging Docks", "Screen Protectors"],
      },
      {
        name: "Cables & Adapters",
        leaves: ["USB-C Cables", "HDMI Cables", "Multi-Port Hubs", "Wall Chargers", "Car Chargers", "Extension Leads"],
      },
    ],
  },
  {
    name: "Phones & Tablets",
    slug: "phones-and-tablets",
    icon: "📞",
    channels: [
      {
        name: "Phone Cases",
        leaves: ["Clear Cases", "Wallet Cases", "Rugged Cases", "Silicone Cases", "MagSafe Cases", "Flip Cases"],
      },
      {
        name: "Chargers & Power",
        leaves: ["Wireless Chargers", "Fast Chargers", "Power Banks", "Charging Cables", "Car Mount Chargers", "Charging Stations"],
      },
      {
        name: "Screen Protection",
        leaves: ["Tempered Glass", "Privacy Filters", "Film Protectors", "Cleaning Kits", "Applicator Tools", "Lens Protectors"],
      },
      {
        name: "Mounts & Holders",
        leaves: ["Car Phone Holders", "Desk Stands", "Tripod Mounts", "Selfie Sticks", "Gimbals", "Bike Mounts"],
      },
    ],
  },
  {
    name: "Computers & Office Equipment",
    slug: "computers-and-office-equipment",
    icon: "💻",
    channels: [
      {
        name: "Peripherals",
        leaves: ["Gaming Mice", "Ergonomic Mice", "Mechanical Keyboards", "Membrane Keyboards", "Mouse Pads", "Wrist Rests"],
      },
      {
        name: "Monitors & Stands",
        leaves: ["Gaming Monitors", "Portable Monitors", "Monitor Arms", "Laptop Stands", "Monitor Covers", "Privacy Screens"],
      },
      {
        name: "Office Supplies",
        leaves: ["Notebooks", "Pens", "Desk Organisers", "Staplers", "File Folders", "Whiteboards"],
      },
      {
        name: "Networking",
        leaves: ["Wi-Fi Routers", "Mesh Systems", "Ethernet Cables", "USB Wi-Fi Adapters", "Switches", "Range Extenders"],
      },
    ],
  },
  {
    name: "Pet Supplies",
    slug: "pet-supplies",
    icon: "🐕",
    channels: [
      {
        name: "Dog Supplies",
        leaves: ["Dog Food", "Dog Treats", "Dog Collars", "Dog Leads", "Dog Beds", "Dog Toys"],
      },
      {
        name: "Cat Supplies",
        leaves: ["Cat Food", "Cat Litter", "Cat Trees", "Cat Toys", "Cat Bowls", "Scratching Posts"],
      },
      {
        name: "Aquatic & Small Pets",
        leaves: ["Fish Tanks", "Filters", "Small Pet Bedding", "Hamster Wheels", "Bird Perches", "Reptile Heat Mats"],
      },
    ],
  },
  {
    name: "Baby & Maternity",
    slug: "baby-and-maternity",
    icon: "🍼",
    channels: [
      {
        name: "Feeding",
        leaves: ["Baby Bottles", "Teats", "Bottle Warmers", "High Chairs", "Bibs", "Sippy Cups"],
      },
      {
        name: "Nursery",
        leaves: ["Cots", "Changing Mats", "Baby Monitors", "Night Lights", "Blackout Blinds", "Musical Mobiles"],
      },
      {
        name: "Safety & Travel",
        leaves: ["Car Seats", "Strollers", "Baby Carriers", "Cabinet Locks", "Corner Guards", "Playpens"],
      },
      {
        name: "Maternity Wear",
        leaves: ["Maternity Leggings", "Nursing Bras", "Maternity Dresses", "Belly Bands", "Compression Socks", "Hospital Bags"],
      },
    ],
  },
  {
    name: "Sports & Outdoor",
    slug: "sports-and-outdoor",
    icon: "⚽",
    channels: [
      {
        name: "Fitness",
        leaves: ["Yoga Mats", "Resistance Bands", "Dumbbells", "Kettlebells", "Jump Ropes", "Foam Rollers"],
      },
      {
        name: "Camping & Hiking",
        leaves: ["Tents", "Sleeping Bags", "Camping Stoves", "Hiking Backpacks", "Trekking Poles", "Head Torches"],
      },
      {
        name: "Cycling",
        leaves: ["Bike Lights", "Helmets", "Bike Locks", "Water Bottle Cages", "Cycling Gloves", "Saddle Bags"],
      },
      {
        name: "Team Sports",
        leaves: ["Footballs", "Basketballs", "Training Cones", "Goalkeeper Gloves", "Shin Guards", "Whistles"],
      },
    ],
  },
  {
    name: "Toys & Hobbies",
    slug: "toys-and-hobbies",
    icon: "🧸",
    channels: [
      {
        name: "Action Figures & Dolls",
        leaves: ["Fashion Dolls", "Collectible Figures", "Playsets", "Doll Houses", "Mini Figures", "Plush Toys"],
      },
      {
        name: "Vehicles & RC",
        leaves: ["RC Cars", "RC Drones", "Toy Trains", "Die-Cast Models", "Track Sets", "Remote Controls"],
      },
      {
        name: "Learning & STEM",
        leaves: ["Building Blocks", "Science Kits", "Puzzles", "Art Easels", "Coding Toys", "Board Games"],
      },
    ],
  },
  {
    name: "Furniture",
    slug: "furniture",
    icon: "🛋️",
    channels: [
      {
        name: "Living Room",
        leaves: ["Sofas", "Armchairs", "Coffee Tables", "TV Stands", "Bookcases", "Side Tables"],
      },
      {
        name: "Bedroom",
        leaves: ["Bed Frames", "Wardrobes", "Dressing Tables", "Bedside Tables", "Mattresses", "Ottomans"],
      },
      {
        name: "Office Furniture",
        leaves: ["Office Desks", "Ergonomic Chairs", "Filing Cabinets", "Monitor Risers", "Cable Trays", "Footrests"],
      },
    ],
  },
  {
    name: "Tools & Hardware",
    slug: "tools-and-hardware",
    icon: "🔧",
    channels: [
      {
        name: "Power Tools",
        leaves: ["Drills", "Impact Drivers", "Angle Grinders", "Circular Saws", "Multi-Tools", "Batteries"],
      },
      {
        name: "Hand Tools",
        leaves: ["Screwdriver Sets", "Spanners", "Hammers", "Pliers", "Tape Measures", "Levels"],
      },
      {
        name: "Hardware & Fixings",
        leaves: ["Screws", "Wall Plugs", "Hooks", "Brackets", "Chains", "Padlocks"],
      },
    ],
  },
  {
    name: "Automotive & Motorcycle",
    slug: "automotive-and-motorcycle",
    icon: "🚗",
    channels: [
      {
        name: "Interior Accessories",
        leaves: ["Seat Covers", "Steering Wheel Covers", "Floor Mats", "Phone Holders", "Organisers", "Air Fresheners"],
      },
      {
        name: "Exterior & Care",
        leaves: ["Car Covers", "Pressure Washers", "Wax", "Microfibre Cloths", "Ice Scrapers", "Dash Cams"],
      },
      {
        name: "Motorcycle Gear",
        leaves: ["Helmets", "Riding Gloves", "Rain Suits", "Tank Bags", "Knee Guards", "Bluetooth Intercoms"],
      },
    ],
  },
  {
    name: "Food & Beverages",
    slug: "food-and-beverages",
    icon: "🥤",
    channels: [
      {
        name: "Snacks",
        leaves: ["Chips", "Protein Bars", "Nuts", "Dried Fruit", "Chocolate", "Biscuits"],
      },
      {
        name: "Tea & Coffee",
        leaves: ["Loose Leaf Tea", "Tea Bags", "Ground Coffee", "Coffee Pods", "Instant Coffee", "Milk Frothers"],
      },
      {
        name: "Pantry Staples",
        leaves: ["Pasta", "Rice", "Cooking Oil", "Spices", "Sauces", "Honey"],
      },
      {
        name: "Beverages",
        leaves: ["Energy Drinks", "Soft Drinks", "Juices", "Plant Milks", "Syrups", "Water Bottles"],
      },
    ],
  },
  {
    name: "Health",
    slug: "health",
    icon: "💊",
    channels: [
      {
        name: "Vitamins & Supplements",
        leaves: ["Vitamin C", "Multivitamins", "Omega-3", "Protein Powder", "Electrolytes", "Probiotics"],
      },
      {
        name: "Medical Devices",
        leaves: ["Blood Pressure Monitors", "Thermometers", "Pulse Oximeters", "Heating Pads", "TENS Machines", "Nebulisers"],
      },
      {
        name: "First Aid",
        leaves: ["Plasters", "Bandages", "Antiseptic", "Ice Packs", "First Aid Kits", "Gauze"],
      },
    ],
  },
  {
    name: "Garden & Outdoor",
    slug: "garden-and-outdoor",
    icon: "🌱",
    channels: [
      {
        name: "Garden Tools",
        leaves: ["Garden Tool Sets", "Spades", "Rakes", "Pruners", "Hoes", "Wheelbarrows"],
      },
      {
        name: "Plant Care",
        leaves: ["Plant Pots", "Soil", "Fertiliser", "Watering Cans", "Plant Supports", "Grow Lights"],
      },
      {
        name: "Outdoor Living",
        leaves: ["Garden Furniture", "Parasols", "BBQ Tools", "Fire Pits", "Outdoor Rugs", "String Lights"],
      },
    ],
  },
  {
    name: "Books, Stationery & Media",
    slug: "books-stationery-and-media",
    icon: "📚",
    channels: [
      {
        name: "Books",
        leaves: ["Fiction Books", "Non-Fiction Books", "Children's Books", "Cookbooks", "Self-Help", "Comics"],
      },
      {
        name: "Stationery",
        leaves: ["Planners", "Sticky Notes", "Highlighters", "Markers", "Envelopes", "Labels"],
      },
      {
        name: "Media Accessories",
        leaves: ["Book Lights", "Bookmarks", "Audiobook Codes", "E-Reader Cases", "Vinyl Sleeves", "CD Storage"],
      },
    ],
  },
  {
    name: "Video Games",
    slug: "video-games",
    icon: "🎮",
    channels: [
      {
        name: "Gaming Accessories",
        leaves: ["Controllers", "Controller Grips", "Charging Docks", "Gaming Headsets", "Thumb Grips", "Steering Wheels"],
      },
      {
        name: "PC Gaming",
        leaves: ["Gaming Keyboards", "Gaming Mice", "Mouse Mats", "Streaming Lights", "Capture Cards", "Gaming Chairs"],
      },
      {
        name: "Collectibles",
        leaves: ["Amiibo-Style Figures", "Steelbook Cases", "Art Books", "Soundtracks", "Plush Merch", "Pins"],
      },
    ],
  },
  {
    name: "Collectibles",
    slug: "collectibles",
    icon: "🖼️",
    channels: [
      {
        name: "Trading Cards",
        leaves: ["Booster Packs", "Card Sleeves", "Binders", "Playmats", "Deck Boxes", "Graded Slabs"],
      },
      {
        name: "Memorabilia",
        leaves: ["Signed Prints", "Replicas", "Medallions", "Display Cases", "Coin Holders", "Figurine Stands"],
      },
    ],
  },
]

export function flattenMarketplaceCategoryTaxonomy(): FlatCatRow[] {
  const rows: FlatCatRow[] = []
  for (const root of MARKETPLACE_CATEGORY_TAXONOMY_EN) {
    rows.push({
      name: root.name,
      slug: root.slug,
      icon: root.icon,
      order: rows.length + 1,
      parentSlug: null,
    })
    let o2 = 1
    for (const ch of root.channels) {
      const slug2 = `${root.slug}-${seg(ch.name)}`
      rows.push({
        name: ch.name,
        slug: slug2,
        icon: "📦",
        order: o2++,
        parentSlug: root.slug,
      })
      let o3 = 1
      for (const leaf of ch.leaves) {
        const slug3 = `${slug2}-${seg(leaf)}`
        rows.push({
          name: leaf,
          slug: slug3.slice(0, 64),
          icon: "🏷️",
          order: o3++,
          parentSlug: slug2,
        })
      }
    }
  }
  return rows
}

/** Insert order: every row appears after its parent. */
export function sortRowsForInsert(rows: FlatCatRow[]): FlatCatRow[] {
  const byParent = new Map<string | null, FlatCatRow[]>()
  for (const r of rows) {
    const k = r.parentSlug
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(r)
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
  }
  const out: FlatCatRow[] = []
  const queue: (string | null)[] = [null]
  while (queue.length) {
    const p = queue.shift()!
    const kids = byParent.get(p) ?? []
    for (const k of kids) {
      out.push(k)
      queue.push(k.slug)
    }
  }
  return out
}

export function leafSlugsFromRows(rows: FlatCatRow[]): Set<string> {
  const childParents = new Set(rows.map((r) => r.parentSlug).filter((x): x is string => Boolean(x)))
  return new Set(rows.filter((r) => !childParents.has(r.slug)).map((r) => r.slug))
}

/** Maps seed product slug → leaf category slug (must exist after taxonomy insert). */
export const SEED_PRODUCT_LEAF_BY_ITEM_SLUG: Record<string, string> = {
  "vegan-leather-handbag": "womens-wear-and-underwear-bags-and-handbags-tote-bags",
  "minimalist-watch": "jewelry-and-accessories-watches-fashion-watches",
  "lavender-candle": "home-supplies-home-fragrance-scented-candles",
  "bluetooth-headphones": "electronics-audio-over-ear-headphones",
  "vitamin-c-serum": "beauty-and-personal-care-skincare-face-serums",
  "yoga-mat": "sports-and-outdoor-fitness-yoga-mats",
  "polarized-sunglasses": "womens-wear-and-underwear-fashion-accessories-sunglasses",
  "portable-speaker": "electronics-audio-bluetooth-speakers",
  "organic-tea": "food-and-beverages-tea-and-coffee-loose-leaf-tea",
  "hydrating-cream": "beauty-and-personal-care-skincare-face-creams",
  "urban-backpack": "bags-and-luggage-backpacks-laptop-backpacks",
  "led-desk-lamp": "home-kitchen-lighting-desk-lamps",
  "wireless-charger": "phones-and-tablets-chargers-and-power-wireless-chargers",
  "beard-oil": "menswear-and-underwear-grooming-beard-oils",
  "memory-foam-pillow": "textiles-soft-furnishings-bedding-memory-foam-pillows",
  "gaming-mouse": "computers-and-office-equipment-peripherals-gaming-mice",
  "mechanical-keyboard": "computers-and-office-equipment-peripherals-mechanical-keyboards",
  "garden-tool-set": "garden-and-outdoor-garden-tools-garden-tool-sets",
}
