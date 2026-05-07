import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const slowCooker = await prisma.category.upsert({
    where: { slug: 'slow-cookers' },
    update: {},
    create: {
      name: 'Slow Cookers',
      slug: 'slow-cookers',
      parentSlug: 'kitchen-dining',
      fullPath: 'Home & Kitchen → Kitchen & Dining → Slow Cookers'
    }
  })

  const attrs = [
    { key: 'brand', label: 'Brand', required: true, type: 'text' },
    { key: 'color', label: 'Color', required: true, type: 'text' },
    { key: 'material', label: 'Material', required: false, type: 'text' },
    { key: 'dimensions', label: 'Product Dimensions', required: false, type: 'text' },
    { key: 'capacity', label: 'Capacity', required: true, type: 'text' },
    { key: 'dishwasher_safe', label: 'Is Dishwasher Safe', required: false, type: 'text' },
    { key: 'voltage', label: 'Voltage', required: false, type: 'text' },
    { key: 'number_of_items', label: 'Number of Items', required: false, type: 'text' },
    { key: 'upc', label: 'UPC', required: false, type: 'text' }
  ]

  for (const attr of attrs) {
    await prisma.categoryAttribute.upsert({
      where: { categoryId_key: { categoryId: slowCooker.id, key: attr.key } },
      update: {},
      create: { ...attr, categoryId: slowCooker.id }
    })
  }
  
  console.log('Slow Cookers category + 9 attributes seeded')
}

main().finally(() => prisma.$disconnect())
