import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Check if Slow Cookers category exists by name
  let slowCooker = await prisma.category.findFirst({
    where: { name: 'Slow Cookers' }
  })

  // 2. Create it if missing
  if (!slowCooker) {
    slowCooker = await prisma.category.create({
      data: { name: 'Slow Cookers' }
    })
  }

  // 3. Seed attributes
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
      where: { 
        categoryId_key: { 
          categoryId: slowCooker.id, 
          key: attr.key 
        } 
      },
      update: {},
      create: { ...attr, categoryId: slowCooker.id }
    })
  }
  
  console.log('✅ Slow Cookers + 9 attributes seeded. Category ID:', slowCooker.id)
}

main()
 .catch(e => console.error(e))
 .finally(() => prisma.$disconnect())
