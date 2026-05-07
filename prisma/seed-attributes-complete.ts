import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Trouve la vraie catégorie
  const cellPhones = await prisma.category.findUnique({
    where: { slug: 'electronics-cell-phones-accessories' }
  })
  
  if (!cellPhones) {
    console.log('❌ Category not found')
    return
  }
  
  console.log('✅ Found category:', cellPhones.id)
  
  // 2. Supprime les anciens attributs
  await prisma.categoryAttribute.deleteMany({
    where: { categoryId: cellPhones.id }
  })
  
  // 3. Crée les 11 attributs avec le BON ID
  await prisma.categoryAttribute.createMany({
    data: [
      { categoryId: cellPhones.id, key: 'brand', label: 'Brand', type: 'TEXT', required: true, order: 1 },
      { categoryId: cellPhones.id, key: 'model_name', label: 'Model Name', type: 'TEXT', required: true, order: 2 },
      { categoryId: cellPhones.id, key: 'operating_system', label: 'Operating System', type: 'SELECT', options: ['iOS', 'Android'], required: true, order: 3 },
      { categoryId: cellPhones.id, key: 'storage_capacity', label: 'Storage Capacity', type: 'SELECT', options: ['64GB', '128GB', '256GB', '512GB', '1TB'], required: true, order: 4 },
      { categoryId: cellPhones.id, key: 'screen_size', label: 'Screen Size', type: 'NUMBER', unit: 'inches', required: false, order: 5 },
      { categoryId: cellPhones.id, key: 'battery_capacity', label: 'Battery Capacity', type: 'NUMBER', unit: 'mAh', required: false, order: 6 },
      { categoryId: cellPhones.id, key: 'color', label: 'Color', type: 'TEXT', required: false, order: 7 },
      { categoryId: cellPhones.id, key: 'ram', label: 'RAM', type: 'SELECT', options: ['4GB', '6GB', '8GB', '12GB', '16GB'], required: false, order: 8 },
      { categoryId: cellPhones.id, key: 'camera_resolution', label: 'Rear Camera', type: 'TEXT', required: false, order: 9 },
      { categoryId: cellPhones.id, key: 'network', label: 'Network', type: 'SELECT', options: ['4G', '5G'], required: false, order: 10 },
      { categoryId: cellPhones.id, key: 'sim_type', label: 'SIM Type', type: 'SELECT', options: ['Single SIM', 'Dual SIM', 'eSIM'], required: false, order: 11 },
    ]
  })
  
  console.log('✅ Seeded 11 attributes for Cell Phones')
}

main().finally(() => prisma.$disconnect())
