import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const CATEGORIES = [
  // Electronics
  { name: 'Smartphones', slug: 'smartphones', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'storage', label: 'Storage', type: 'text', required: false, order: 2 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Laptops', slug: 'laptops', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'ram', label: 'RAM', type: 'text', required: false, order: 2 },
    { key: 'storage', label: 'Storage', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Headphones', slug: 'headphones', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'form_factor', label: 'Form Factor', type: 'text', required: false, order: 2 },
    { key: 'connectivity', label: 'Connectivity', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Cameras', slug: 'cameras', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'type', label: 'Type', type: 'text', required: false, order: 2 },
    { key: 'megapixels', label: 'Megapixels', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Printers', slug: 'printers', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'type', label: 'Printer Type', type: 'text', required: false, order: 2 },
    { key: 'connectivity', label: 'Connectivity', type: 'text', required: false, order: 3 }
  ]},
  { name: 'TVs', slug: 'tvs', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'size', label: 'Screen Size', type: 'text', required: false, order: 2 },
    { key: 'resolution', label: 'Resolution', type: 'text', required: false, order: 3 }
  ]},
  
  // Fashion
  { name: 'T-Shirts', slug: 'tshirts', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'size', label: 'Size', type: 'text', required: true, order: 2 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Shoes', slug: 'shoes', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'size', label: 'Size', type: 'text', required: true, order: 2 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Jeans', slug: 'jeans', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'size', label: 'Size', type: 'text', required: true, order: 2 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Watches', slug: 'watches', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'type', label: 'Type', type: 'text', required: false, order: 2 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 3 }
  ]},
  
  // Home
  { name: 'Slow Cookers', slug: 'slow-cookers', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'capacity', label: 'Capacity', type: 'text', required: false, order: 2 }
  ]},
  { name: 'Coffee Makers', slug: 'coffee-makers', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'type', label: 'Type', type: 'text', required: false, order: 2 }
  ]},
  { name: 'Furniture', slug: 'furniture', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'material', label: 'Material', type: 'text', required: false, order: 2 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 3 }
  ]},
  
  // Beauty
  { name: 'Skincare', slug: 'skincare', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'type', label: 'Product Type', type: 'text', required: false, order: 2 },
    { key: 'volume', label: 'Volume', type: 'text', required: false, order: 3 }
  ]},
  { name: 'Makeup', slug: 'makeup', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
    { key: 'type', label: 'Product Type', type: 'text', required: false, order: 2 },
    { key: 'shade', label: 'Shade', type: 'text', required: false, order: 3 }
  ]},
  
  // Sports
  { name: 'Fitness Equipment', slug: 'fitness-equipment', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'type', label: 'Equipment Type', type: 'text', required: false, order: 2 }
  ]},
  
  // Fallback pour tout le reste
  { name: 'Other', slug: 'other', attributes: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, order: 1 },
    { key: 'type', label: 'Product Type', type: 'text', required: false, order: 2 },
    { key: 'material', label: 'Material', type: 'text', required: false, order: 3 },
    { key: 'color', label: 'Color', type: 'text', required: false, order: 4 }
  ]}
]

async function main() {
  for (const cat of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug }
    })
    
    for (const attr of cat.attributes) {
      await prisma.categoryAttribute.upsert({
        where: { categoryId_key: { categoryId: category.id, key: attr.key } },
        update: {},
        create: { ...attr, categoryId: category.id }
      })
    }
    console.log(`Seeded: ${cat.name}`)
  }
}

main().finally(() => prisma.$disconnect())
