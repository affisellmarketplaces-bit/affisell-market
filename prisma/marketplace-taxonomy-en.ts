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
        leaves: [
          "Mops",
          "Brooms",
          "Cleaning Cloths",
          "Spray Bottles",
          "Vacuum Accessories",
          "Rubber Gloves",
          "Descalers & Appliance Care",
        ],
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
        name: "Home Décor",
        leaves: ["Wall Art", "Mirrors", "Vases", "Clocks", "Photo Frames", "Decorative Objects"],
      },
      {
        name: "Storage & Organisation",
        leaves: ["Shelf Baskets", "Drawer Organisers", "Pantry Containers", "Over-Door Hooks", "Vacuum Bags", "Label Makers"],
      },
      {
        name: "Small Appliances",
        leaves: ["Kettles", "Toasters", "Blenders", "Air Fryers", "Rice Cookers", "Coffee Makers"],
      },
      {
        name: "Coffee & Espresso",
        leaves: ["Espresso Machines", "Coffee Grinders", "Moka Pots", "French Presses", "Pour-Over Drippers", "Milk Frothers"],
      },
      {
        name: "Bar & Drinkware",
        leaves: ["Cocktail Shakers", "Wine Glasses", "Decanters", "Bottle Openers", "Ice Cube Trays", "Coasters"],
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
      {
        name: "Outerwear",
        leaves: ["Trench Coats", "Puffer Jackets", "Denim Jackets", "Fleece Jackets", "Raincoats", "Capes"],
      },
      {
        name: "Swim & Beachwear",
        leaves: ["Bikinis", "One-Piece Swimsuits", "Cover-Ups", "Swim Shorts", "Rash Guards", "Beach Sarongs"],
      },
      {
        name: "Activewear",
        leaves: ["Sports Bras", "Leggings", "Running Shorts", "Track Jackets", "Compression Tops", "Gym Tops"],
      },
      {
        name: "Lingerie & Shapewear",
        leaves: ["Balconette Bras", "Push-Up Bras", "Lace Bralettes", "Bodysuits", "Shapewear Briefs", "Control Slips"],
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
      {
        name: "Swim & Beachwear",
        leaves: ["Swim Shorts", "Swim Trunks", "Board Shorts", "Rash Guards", "Swim Briefs", "Beach Shirts"],
      },
      {
        name: "Activewear & Gym",
        leaves: ["Training T-Shirts", "Gym Shorts", "Compression Leggings", "Track Jackets", "Gym Hoodies", "Base Layers"],
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
      {
        name: "Fragrance",
        leaves: ["Women's Perfume", "Men's Cologne", "Body Mists", "Fragrance Gift Sets", "Travel Sprays", "Solid Perfumes"],
      },
      {
        name: "Nail Care",
        leaves: ["Nail Polish", "Gel Nail Kits", "Nail Tools", "Press-On Nails", "Nail Treatments", "Nail Art"],
      },
      {
        name: "Men's Grooming",
        leaves: ["Electric Shavers", "Beard Trimmers", "Face Wash", "Moisturisers", "Hair Clay", "Grooming Kits"],
      },
      {
        name: "Beauty Tech",
        leaves: ["Facial Cleansing Brushes", "LED Face Masks", "IPL Devices", "Hair Straighteners", "Curling Wands", "Hot Air Brushes"],
      },
      {
        name: "Clean & Conscious Beauty",
        leaves: [
          "Refillable Skincare",
          "Solid Shampoo Bars",
          "Mineral Sunscreens",
          "Fragrance-Free Care",
          "COSMOS Certified",
          "Cruelty-Free Makeup",
        ],
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
      {
        name: "TV & Home Cinema",
        leaves: ["4K TVs", "OLED TVs", "TV Wall Mounts", "Streaming Devices", "Universal Remotes", "TV Antennas"],
      },
      {
        name: "Smart Home",
        leaves: ["Smart Bulbs", "Smart Plugs", "Video Doorbells", "Smart Locks", "Home Hubs", "Motion Sensors"],
      },
      {
        name: "Tablets & E-Readers",
        leaves: ["Drawing Tablets", "Kids' Tablets", "E-Reader Devices", "Tablet Folios", "Styluses", "E-Ink Accessories"],
      },
      {
        name: "Computer Components",
        leaves: ["Graphics Cards", "RAM Modules", "Internal SSDs", "CPU Coolers", "PC Cases", "Power Supplies"],
      },
      {
        name: "Printers & Scanners",
        leaves: ["Inkjet Printers", "Laser Printers", "Label Printers", "Portable Scanners", "Ink Cartridges", "Photo Paper"],
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
        name: "Laptops & PCs",
        leaves: ["Laptops", "Gaming Laptops", "2-in-1 Convertibles", "Chromebooks", "Desktop PCs", "Mini PCs"],
      },
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
      {
        name: "Data Storage",
        leaves: ["External SSDs", "USB Flash Drives", "NAS Enclosures", "Memory Cards", "Card Readers", "HDD Docking Stations"],
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
      {
        name: "Bird Supplies",
        leaves: ["Bird Cages", "Bird Food", "Perches", "Bird Toys", "Cuttlebone", "Cage Liners"],
      },
      {
        name: "Horse & Stable",
        leaves: ["Horse Rugs", "Bridles", "Grooming Kits", "Hoof Care", "Stable Buckets", "Lead Ropes"],
      },
      {
        name: "Reptile & Amphibian",
        leaves: ["Terrariums", "Heat Lamps", "UVB Bulbs", "Substrate", "Hides", "Misting Systems"],
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
      {
        name: "Nappy Care",
        leaves: ["Disposable Nappies", "Reusable Nappies", "Baby Wipes", "Changing Bags", "Nappy Pails", "Barrier Creams"],
      },
      {
        name: "Baby Healthcare",
        leaves: ["Baby Thermometers", "Nasal Aspirators", "Baby Grooming Kits", "Humidifiers", "Teethers", "Medicine Dispensers"],
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
      {
        name: "Water Sports",
        leaves: ["Surfboards", "SUP Boards", "Snorkelling Sets", "Swim Goggles", "Wetsuits", "Swim Caps"],
      },
      {
        name: "Winter Sports",
        leaves: ["Skis", "Snowboards", "Ski Boots", "Snow Goggles", "Thermal Base Layers", "Hand Warmers"],
      },
      {
        name: "Fishing",
        leaves: ["Fishing Rods", "Reels", "Tackle Boxes", "Lures & Baits", "Landing Nets", "Fishing Line"],
      },
      {
        name: "Golf",
        leaves: ["Golf Clubs", "Golf Balls", "Golf Bags", "Golf Gloves", "Training Aids", "Rangefinders"],
      },
      {
        name: "Racket Sports",
        leaves: ["Tennis Rackets", "Badminton Sets", "Squash Rackets", "Shuttlecocks", "Racket Strings", "Overgrips"],
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
      {
        name: "Model Kits & Miniatures",
        leaves: ["Scale Model Kits", "Model Paints", "Glue & Cement", "Airbrush Sets", "Display Cases", "Terrain Supplies"],
      },
      {
        name: "Plush & Soft Toys",
        leaves: ["Character Plush", "Baby Soft Toys", "Weighted Plush", "Puppet Toys", "Blanket Buddies", "Sound Plush"],
      },
      {
        name: "Outdoor Play",
        leaves: ["Trampolines", "Swing Sets", "Sandboxes", "Water Tables", "Scooters", "Balance Bikes"],
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
      {
        name: "Oils & Fluids",
        leaves: ["Engine Oil", "Coolant", "Brake Fluid", "Screen Wash", "Fuel Additives", "Grease"],
      },
      {
        name: "Replacement Parts",
        leaves: ["Wiper Blades", "Car Bulbs", "Air Filters", "Drive Belts", "Car Batteries", "Fuses"],
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
      {
        name: "Plant-Based & Vegan",
        leaves: ["Vegan Snacks", "Plant Protein", "Meat Alternatives", "Vegan Spreads", "Dairy-Free Desserts", "Vegan Ready Meals"],
      },
      {
        name: "Gluten-Free",
        leaves: ["Gluten-Free Pasta", "Gluten-Free Bread", "Gluten-Free Cereals", "Gluten-Free Baking Mixes", "GF Snack Bars", "Certified GF Oats"],
      },
      {
        name: "Keto & Low Carb",
        leaves: ["Keto Bars", "Low-Carb Crackers", "MCT Oil", "Sugar-Free Syrups", "Keto Baking Mixes", "Electrolyte Powders"],
      },
      {
        name: "Organic & Regenerative",
        leaves: ["Organic Fruit", "Organic Vegetables", "Organic Dairy", "Organic Eggs", "Organic Pantry", "Organic Baby Food"],
      },
      {
        name: "Halal & Ethically Slaughtered",
        leaves: ["Halal Meat", "Halal Snacks", "Halal Sweets", "Halal Sauces", "Halal Ready Meals", "Halal Baby Food"],
      },
      {
        name: "Kosher Foods",
        leaves: ["Kosher Meat", "Kosher Dairy", "Pareve Snacks", "Kosher Wine", "Passover Foods", "Kosher Baking"],
      },
      {
        name: "Sugar-Free & Diabetic-Friendly",
        leaves: ["No-Added-Sugar Drinks", "Sugar-Free Chocolate", "Low-GI Snacks", "Diabetic Bars", "Stevia Sweeteners", "Sugar-Free Jams"],
      },
      {
        name: "Lactose-Free & Low FODMAP",
        leaves: ["Lactose-Free Milk", "Lactose-Free Cheese", "Low FODMAP Snacks", "Low FODMAP Sauces", "Enzyme Supplements", "Gentle Fibre"],
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
      {
        name: "Dental & Oral Care",
        leaves: ["Electric Toothbrushes", "Manual Toothbrushes", "Mouthwash", "Dental Floss", "Whitening Kits", "Water Flossers"],
      },
      {
        name: "Feminine Care",
        leaves: ["Sanitary Pads", "Tampons", "Menstrual Cups", "Period Underwear", "Heat Patches", "Intimate Wash"],
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
      {
        name: "Pest & Weed Control",
        leaves: ["Insect Repellents", "Fly Traps", "Weedkillers", "Slug Pellets", "Animal Netting", "Rodent Repellers"],
      },
      {
        name: "Pools & Spas",
        leaves: ["Pool Covers", "Pool Cleaning Tools", "Water Test Kits", "Inflatable Pools", "Spa Steps", "Pool Thermometers"],
      },
      {
        name: "Seeds, Bulbs & Propagation",
        leaves: ["Flower Seeds", "Vegetable Seeds", "Herb Seeds", "Flower Bulbs", "Seed Trays", "Electric Propagators"],
      },
      {
        name: "Greenhouse & Hydroponics",
        leaves: ["Mini Greenhouses", "Hydroponic Starter Kits", "Grow Tents", "Coco Coir Blocks", "pH Test Kits", "EC Meters"],
      },
      {
        name: "Beekeeping & Wildlife",
        leaves: ["Beehives", "Bee Suits", "Smokers", "Honey Extractors", "Bird Feeders", "Bat Boxes"],
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
      {
        name: "Consoles & VR",
        leaves: ["Home Consoles", "Handheld Consoles", "VR Headsets", "VR Controller Straps", "Console Skins", "Charging Docks"],
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
  {
    name: "Arts, Crafts & Sewing",
    slug: "arts-crafts-and-sewing",
    icon: "🎨",
    channels: [
      {
        name: "Painting & Drawing",
        leaves: ["Acrylic Paints", "Watercolours", "Sketch Pads", "Paintbrushes", "Easels", "Charcoal Sets"],
      },
      {
        name: "Sewing & Fabric",
        leaves: ["Sewing Machines", "Fabric Metreage", "Threads", "Pins & Needles", "Rotary Cutters", "Dress Forms"],
      },
      {
        name: "Knitting & Crochet",
        leaves: ["Yarn Skeins", "Knitting Needles", "Crochet Hooks", "Stitch Markers", "Cable Needles", "Blocking Tools"],
      },
      {
        name: "Paper & Scrapbooking",
        leaves: ["Cardstock Packs", "Rubber Stamps", "Die-Cut Machines", "Washi Tape", "Glues", "Paper Punches"],
      },
      {
        name: "Jewellery Making",
        leaves: ["Bead Mixes", "Findings Kits", "Jewellery Pliers", "Wire Spools", "Charms", "Crimp Tools"],
      },
      {
        name: "Printmaking & Stencils",
        leaves: ["Screen Printing Kits", "Linoleum Blocks", "Brayers", "Stencil Sheets", "Relief Ink", "Print Presses"],
      },
    ],
  },
  {
    name: "Musical Instruments & Studio",
    slug: "musical-instruments-and-studio",
    icon: "🎹",
    channels: [
      {
        name: "Guitars & Bass",
        leaves: ["Electric Guitars", "Acoustic Guitars", "Bass Guitars", "Guitar Strings", "Capo", "Guitar Straps"],
      },
      {
        name: "Keyboards & Pianos",
        leaves: ["Digital Pianos", "MIDI Keyboards", "Synthesizers", "Keyboard Stands", "Sustain Pedals", "Bench Seats"],
      },
      {
        name: "Drums & Percussion",
        leaves: ["Acoustic Drum Kits", "Electronic Drums", "Cymbals", "Drumsticks", "Practice Pads", "Hand Percussion"],
      },
      {
        name: "Wind & Brass",
        leaves: ["Flutes", "Clarinets", "Saxophones", "Trumpets", "Recorders", "Mouthpieces"],
      },
      {
        name: "Strings & Orchestral",
        leaves: ["Violins", "Cellos", "Violas", "Bows", "Rosin", "String Sets"],
      },
      {
        name: "Studio & Live Sound",
        leaves: ["Audio Interfaces", "Studio Monitors", "Microphone Stands", "Pop Filters", "DI Boxes", "Rack Gear"],
      },
    ],
  },
  {
    name: "Major Appliances",
    slug: "major-appliances",
    icon: "❄️",
    channels: [
      {
        name: "Refrigeration",
        leaves: ["Fridge Freezers", "American Fridge Freezers", "Wine Coolers", "Mini Fridges", "Freezers", "Fridge Filters"],
      },
      {
        name: "Laundry",
        leaves: ["Washing Machines", "Tumble Dryers", "Washer Dryers", "Laundry Pedestals", "Ironing Systems", "Laundry Stacks"],
      },
      {
        name: "Cooking Built-In",
        leaves: ["Built-In Ovens", "Cooktops", "Range Cookers", "Extractor Hoods", "Warming Drawers", "Microwave Ovens"],
      },
      {
        name: "Dishwashers",
        leaves: ["Full-Size Dishwashers", "Slimline Dishwashers", "Integrated Panels", "Dishwasher Tablets", "Rinse Aid", "Cutlery Baskets"],
      },
    ],
  },
  {
    name: "Home Improvement & Building",
    slug: "home-improvement-and-building",
    icon: "🏗️",
    channels: [
      {
        name: "Paint & Wall",
        leaves: ["Interior Paint", "Exterior Paint", "Primers", "Paint Rollers", "Masking Tape", "Wallpaper"],
      },
      {
        name: "Electrical Install",
        leaves: ["Sockets & Switches", "Circuit Breakers", "Cable Reels", "Junction Boxes", "LED Downlights", "Doorbells"],
      },
      {
        name: "Plumbing",
        leaves: ["Pipe Fittings", "Taps", "Shower Heads", "Toilet Parts", "Silicone Sealant", "Pipe Insulation"],
      },
      {
        name: "Safety & Security",
        leaves: ["Smoke Alarms", "CO Detectors", "Safes", "Padlocks", "Security Chains", "Door Reinforcers"],
      },
      {
        name: "Flooring & Tiling",
        leaves: ["Laminate Flooring", "Vinyl Planks", "Floor Tiles", "Grout", "Spacers", "Underlay"],
      },
    ],
  },
  {
    name: "Movies, Music & Vinyl",
    slug: "movies-music-and-vinyl",
    icon: "💿",
    channels: [
      {
        name: "Vinyl Records",
        leaves: ["Rock Vinyl", "Pop Vinyl", "Jazz Vinyl", "Classical Vinyl", "Soundtracks", "Record Sleeves"],
      },
      {
        name: "CDs & Blu-ray",
        leaves: ["Music CDs", "Film Blu-ray", "Box Sets", "Concert DVDs", "4K UHD Films", "Steelbooks"],
      },
      {
        name: "Sheet Music & Books",
        leaves: ["Piano Scores", "Guitar Tab Books", "Songbooks", "Music Theory", "Conducting Scores", "Lyric Books"],
      },
    ],
  },
  {
    name: "Software & Digital",
    slug: "software-and-digital",
    icon: "💾",
    channels: [
      {
        name: "PC & Mac Software",
        leaves: ["Office Suites", "Antivirus", "Creative Suites", "Accounting Software", "Backup Tools", "VPN Subscriptions"],
      },
      {
        name: "Games Digital",
        leaves: ["Game Download Codes", "Season Passes", "DLC Codes", "Gift Cards", "Cloud Gaming Trials", "Loot Codes"],
      },
      {
        name: "Learning Digital",
        leaves: ["Language Apps", "Course Bundles", "Exam Prep", "Kids Learning Apps", "Music Lesson Codes", "CAD Trials"],
      },
    ],
  },
  {
    name: "Handmade & Personalised",
    slug: "handmade-and-personalised",
    icon: "✋",
    channels: [
      {
        name: "Handmade Home",
        leaves: ["Hand-Poured Candles", "Pottery", "Woven Baskets", "Macramé", "Wood Signs", "Custom Doormats"],
      },
      {
        name: "Handmade Fashion",
        leaves: ["Knitwear", "Embroidered Caps", "Leather Goods", "Hand-Dyed Scarves", "Beaded Jewellery", "Custom Totes"],
      },
      {
        name: "Personalised Gifts",
        leaves: ["Engraved Jewellery", "Photo Gifts", "Name Badges", "Monogrammed Towels", "Custom Mugs", "Wedding Favours"],
      },
    ],
  },
  {
    name: "Party, Wedding & Events",
    slug: "party-wedding-and-events",
    icon: "🎉",
    channels: [
      {
        name: "Party Decorations",
        leaves: ["Balloons", "Banners", "Confetti", "Table Centrepieces", "Party Lights", "Photo Booth Props"],
      },
      {
        name: "Tableware Disposable",
        leaves: ["Paper Plates", "Plastic Cups", "Napkins", "Straws", "Serving Trays", "Cake Stands"],
      },
      {
        name: "Wedding Supplies",
        leaves: ["Guest Books", "Ring Pillows", "Aisle Runners", "Wedding Arches", "Chair Covers", "Favour Bags"],
      },
      {
        name: "Seasonal Celebrations",
        leaves: ["Christmas Decor", "Halloween Props", "Easter Kits", "Diwali Lights", "Birthday Candles", "New Year Kits"],
      },
    ],
  },
  {
    name: "Costumes & Fancy Dress",
    slug: "costumes-and-fancy-dress",
    icon: "🎭",
    channels: [
      {
        name: "Adult Costumes",
        leaves: ["Superhero Costumes", "Historical Costumes", "Animal Onesies", "Career Costumes", "Horror Masks", "Wigs"],
      },
      {
        name: "Kids' Costumes",
        leaves: ["Princess Dresses", "Pirate Outfits", "Superhero Suits", "Animal Costumes", "Book Week", "Halloween Kids"],
      },
      {
        name: "Accessories & Makeup",
        leaves: ["Face Paint", "Fake Blood", "Capes", "Swords Toy", "Crowns", "Tights & Hosiery"],
      },
    ],
  },
  {
    name: "School & Teaching",
    slug: "school-and-teaching",
    icon: "✏️",
    channels: [
      {
        name: "Classroom Basics",
        leaves: ["Exercise Books", "Pencils", "Erasers", "Rulers", "Geometry Sets", "Clipboards"],
      },
      {
        name: "Teachers' Supplies",
        leaves: ["Reward Stickers", "Whiteboard Markers", "Bulletin Boards", "Laminating Pouches", "Name Tags", "Timers"],
      },
      {
        name: "University & Lab",
        leaves: ["Scientific Calculators", "Lab Notebooks", "Safety Goggles", "Dissection Kits", "Graph Paper", "Portfolio Cases"],
      },
    ],
  },
  {
    name: "Industrial & Professional",
    slug: "industrial-and-professional",
    icon: "⚙️",
    channels: [
      {
        name: "Measuring & Test",
        leaves: ["Digital Calipers", "Multimeters", "Laser Measures", "Thermal Cameras", "pH Meters", "Torque Wrenches"],
      },
      {
        name: "Workshop & Maintenance",
        leaves: ["Shop Vacuums", "Parts Washers", "Oil Drains", "Greasing Equipment", "Benches", "Tool Chests"],
      },
      {
        name: "Janitorial",
        leaves: ["Commercial Mops", "Floor Scrubbers", "Waste Bins", "Paper Towels Bulk", "Cleaning Trolleys", "Signage"],
      },
    ],
  },
  {
    name: "Equestrian & Farm",
    slug: "equestrian-and-farm",
    icon: "🐴",
    channels: [
      {
        name: "Riding Apparel",
        leaves: ["Riding Helmets", "Riding Boots", "Breeches", "Show Jackets", "Gloves", "Body Protectors"],
      },
      {
        name: "Stable & Tack",
        leaves: ["Saddles", "Saddle Pads", "Bits", "Halters", "Fly Masks", "Hay Nets"],
      },
      {
        name: "Poultry & Smallholding",
        leaves: ["Chicken Feeders", "Coops", "Electric Fencing", "Heat Lamps", "Water Troughs", "Incubators"],
      },
    ],
  },
  {
    name: "Travel Essentials",
    slug: "travel-essentials",
    icon: "✈️",
    channels: [
      {
        name: "Comfort & Sleep",
        leaves: ["Neck Pillows", "Eye Masks", "Travel Blankets", "Foot Rests", "Ear Plugs", "Compression Socks"],
      },
      {
        name: "Adapters & Power",
        leaves: ["Travel Adapters", "Voltage Converters", "USB Travel Hubs", "Plug Organisers", "Cable Bags", "Outlet Splitters"],
      },
      {
        name: "Security & Organisers",
        leaves: ["TSA Locks", "Money Belts", "RFID Sleeves", "Packing Cubes", "Toiletry Bags", "Luggage Tags"],
      },
    ],
  },
  {
    name: "Cycling & Urban Mobility",
    slug: "cycling-and-urban-mobility",
    icon: "🚲",
    channels: [
      {
        name: "Bikes & Frames",
        leaves: ["City Bikes", "Mountain Bikes", "Road Bikes", "Folding Bikes", "E-Bikes", "BMX"],
      },
      {
        name: "Components",
        leaves: ["Tyres", "Inner Tubes", "Pedals", "Chains", "Cassettes", "Handlebars"],
      },
      {
        name: "Scooters & Skates",
        leaves: ["Electric Scooters", "Kick Scooters", "Roller Skates", "Inline Skates", "Helmets", "Knee Pads"],
      },
    ],
  },
  {
    name: "Boating & Marine",
    slug: "boating-and-marine",
    icon: "⛵",
    channels: [
      {
        name: "Safety & Navigation",
        leaves: ["Life Jackets", "Marine GPS", "Compasses", "Flares", "Horns", "First Aid Marine"],
      },
      {
        name: "Deck & Mooring",
        leaves: ["Anchors", "Ropes", "Fenders", "Dock Lines", "Cleats", "Boat Covers"],
      },
      {
        name: "Engine & Maintenance",
        leaves: ["Marine Oil", "Fuel Filters", "Bilge Pumps", "Batteries Marine", "Propellers", "Antifouling Paint"],
      },
    ],
  },
  {
    name: "Running & Athletics",
    slug: "running-and-athletics",
    icon: "🏃",
    channels: [
      {
        name: "Running Gear",
        leaves: ["Running Shorts", "Running Tights", "Running Vests", "Race Belts", "Reflective Vests", "Spikes"],
      },
      {
        name: "Track & Field",
        leaves: ["Hurdles", "Shot Puts", "Discus", "Javelins Training", "Starting Blocks", "High Jump Bars"],
      },
      {
        name: "Training Accessories",
        leaves: ["Agility Ladders", "Speed Chutes", "Parachutes", "Markers", "Stopwatches", "Whistles"],
      },
    ],
  },
  {
    name: "Yoga, Pilates & Dance",
    slug: "yoga-pilates-and-dance",
    icon: "🩰",
    channels: [
      {
        name: "Yoga",
        leaves: ["Yoga Blocks", "Yoga Straps", "Bolsters", "Meditation Cushions", "Yoga Wheels", "Mat Bags"],
      },
      {
        name: "Pilates",
        leaves: ["Reformer Accessories", "Magic Circles", "Pilates Balls", "Resistance Bands", "Toe Sox", "Spine Correctors"],
      },
      {
        name: "Dance",
        leaves: ["Ballet Shoes", "Tap Shoes", "Dance Leotards", "Tights", "Leg Warmers", "Dance Bags"],
      },
    ],
  },
  {
    name: "Combat & Martial Arts",
    slug: "combat-and-martial-arts",
    icon: "🥋",
    channels: [
      {
        name: "Striking Gear",
        leaves: ["Boxing Gloves", "Hand Wraps", "Punch Bags", "Focus Mitts", "Head Guards", "Shin Guards"],
      },
      {
        name: "Martial Arts Uniforms",
        leaves: ["Karate Gi", "Judo Gi", "BJJ Rash Guards", "Belts", "Hakama", "Sparring Boots"],
      },
      {
        name: "Training Weapons",
        leaves: ["Foam Swords", "Escrima Sticks", "Nunchaku Foam", "Training Knives", "Targets", "Weapon Bags"],
      },
    ],
  },
  {
    name: "Archery & Targets",
    slug: "archery-and-targets",
    icon: "🏹",
    channels: [
      {
        name: "Bows",
        leaves: ["Recurve Bows", "Compound Bows", "Longbows", "Youth Bows", "Bow Strings", "Bow Cases"],
      },
      {
        name: "Arrows & Accessories",
        leaves: ["Arrows", "Broadheads", "Quivers", "Releases", "Sights", "Stabilisers"],
      },
      {
        name: "Targets & Ranges",
        leaves: ["Foam Targets", "Bag Targets", "Paper Faces", "Target Stands", "Backstops", "Bale Targets"],
      },
    ],
  },
  {
    name: "Board & Tabletop Games",
    slug: "board-and-tabletop-games",
    icon: "🎲",
    channels: [
      {
        name: "Strategy & Euro Games",
        leaves: ["Worker Placement", "Deck Builders", "Cooperative Games", "War Games", "Abstract Games", "Expansion Packs"],
      },
      {
        name: "Family & Party",
        leaves: ["Trivia Games", "Dexterity Games", "Card Games", "Dice Games", "Travel Games", "Kids' Games"],
      },
      {
        name: "RPG & Miniatures",
        leaves: ["RPG Rulebooks", "Dice Sets", "Battle Mats", "Painted Minis", "Terrain Tiles", "DM Screens"],
      },
    ],
  },
  {
    name: "Sustainable & Refill Living",
    slug: "sustainable-and-refill-living",
    icon: "♻️",
    channels: [
      {
        name: "Reusables for Home",
        leaves: ["Beeswax Wraps", "Silicone Food Lids", "Stainless Straws", "Compost Caddies", "Refillable Cleaning Bottles", "Dryer Balls"],
      },
      {
        name: "Low-Waste Personal Care",
        leaves: ["Safety Razors", "Refill Deodorant", "Shampoo Refills", "Toothpaste Tablets", "Menstrual Cups Retail", "Bamboo Toothbrushes"],
      },
      {
        name: "Solar & Portable Power",
        leaves: ["Portable Solar Panels", "Power Stations Solar", "Hand-Crank Torches", "Bike Dynamo Lights", "Solar Garden Lights", "USB Solar Chargers"],
      },
      {
        name: "Water & Air at Home",
        leaves: ["Countertop Filters", "Shower Filters", "Replacement Cartridges", "HEPA Room Filters", "Humidifier Filters", "Water Test Strips"],
      },
    ],
  },
  {
    name: "Senior, Adaptive & Daily Living",
    slug: "senior-adaptive-and-daily-living",
    icon: "🦯",
    channels: [
      {
        name: "Mobility & Walking Aids",
        leaves: ["Walking Frames", "Rollators", "Walking Sticks", "Quad Canes", "Walking Stick Tips", "Walking Frame Bags"],
      },
      {
        name: "Bathroom Safety",
        leaves: ["Grab Rails", "Shower Seats", "Non-Slip Mats", "Raised Toilet Seats", "Long-Handled Sponges", "Bath Steps"],
      },
      {
        name: "Dressing & Reach Aids",
        leaves: ["Dressing Sticks", "Zipper Pulls", "Button Hooks", "Sock Aids", "Long Shoehorns", "Reachers"],
      },
      {
        name: "Low Vision & Hearing Helpers",
        leaves: ["Large-Button Phones", "Talking Clocks", "Magnifier Lamps", "TV Listeners", "Dry-Aid Kits", "Alert Systems"],
      },
    ],
  },
  {
    name: "Pop Culture, Anime & Fandom",
    slug: "pop-culture-anime-and-fandom",
    icon: "🎌",
    channels: [
      {
        name: "Figures & Statues",
        leaves: ["Scale Anime Figures", "Nendoroid-Style", "PVC Statues", "Resin Kits", "Figure Display Cases", "LED Bases"],
      },
      {
        name: "Pins, Badges & Keychains",
        leaves: ["Enamel Pins", "Acrylic Charms", "Rubber Keychains", "Ita-Bags", "Badge Boards", "Lanyard Cards"],
      },
      {
        name: "Wall Art & Posters",
        leaves: ["Wall Scrolls", "Framed Prints", "Glow Posters", "Peel-and-Stick Murals", "Collector Lithographs", "Cork Boards"],
      },
      {
        name: "Convention & Cosplay Accessories",
        leaves: ["Foam Weapons Safe", "Coloured Contact Lenses Costume", "Wig Caps", "Body Paint Sets", "Prop Holsters", "Badge Holders"],
      },
    ],
  },
  {
    name: "B2B & Professional Supply",
    slug: "b2b-professional-supply",
    icon: "🏢",
    channels: [
      {
        name: "Office & Facility Consumables",
        leaves: [
          "Bulk Toilet Paper",
          "Hand Towel Rolls",
          "Commercial Bin Liners",
          "Surface Disinfectants",
          "Air Freshener Dispensers",
          "Soap Refills",
        ],
      },
      {
        name: "Hospitality & Catering",
        leaves: [
          "Disposable Chef Whites",
          "Takeaway Containers",
          "Catering Trays",
          "Napkin Dispensers",
          "Coffee Portion Packs",
          "Bar Syrup Pumps",
        ],
      },
      {
        name: "Retail Packaging & Labelling",
        leaves: ["Thermal Labels", "Price Guns", "Gift Boxes Wholesale", "Tissue Paper Bulk", "Ribbon Rolls", "Security Tags"],
      },
      {
        name: "Medical & Care Settings",
        leaves: [
          "Exam Gloves",
          "Disposable Gowns",
          "Wound Dressing Packs",
          "Bed Pads",
          "Surface Wipes Clinical",
          "Sharps Containers",
        ],
      },
      {
        name: "Workshop & Fleet Maintenance",
        leaves: ["Workshop Wipes", "Brake Cleaner Bulk", "Degreasers Trade", "Funnel Sets", "Oil Drain Pans", "Battery Chargers Pro"],
      },
      {
        name: "Landscaping & Grounds Trade",
        leaves: ["Professional Fertiliser", "Irrigation Fittings", "Safety Cones", "Hedge Trimmer Blades", "Mulch Bulk Bags", "Weed Fabric Rolls"],
      },
      {
        name: "IT & Office Hardware Procurement",
        leaves: ["Monitor Arms Bulk", "Docking Stations Trade", "KVM Switches", "Rack Shelves", "Cable Trays Office", "Refurbished Laptops Trade"],
      },
      {
        name: "Corporate Gifts & Awards",
        leaves: ["Engraved Trophies", "Award Plaques", "Branded Notebooks", "Logo Drinkware", "Gift Hampers Corporate", "Lanyards Bulk"],
      },
      {
        name: "Commercial Kitchen Equipment",
        leaves: [
          "Commercial Blenders",
          "Food Warmers",
          "Stainless Prep Tables",
          "Chef Knives Trade",
          "Food Thermometers Pro",
          "Grease Traps Small",
        ],
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
