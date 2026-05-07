import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Attr = {
  key: string
  label: string
  required: boolean
  type: 'text'
  order?: number
}

type CategorySeed = {
  name: string
  slug: string
  attributes: Attr[]
}

const CATEGORIES: CategorySeed[] = [
  {
    name: 'Smartphones',
    slug: 'smartphones',
    attributes: [
      { key: 'brand', label: 'Brand', required: true, type: 'text' },
      { key: 'model', label: 'Model', required: true, type: 'text' },
      { key: 'storage', label: 'Storage', required: true, type: 'text' },
      { key: 'color', label: 'Color', required: true, type: 'text' },
      { key: 'ram', label: 'RAM', required: false, type: 'text' },
      { key: 'screen_size', label: 'Screen Size', required: false, type: 'text' },
    ],
  },
  {
    name: 'Laptops',
    slug: 'laptops',
    attributes: [
      { key: 'brand', label: 'Brand', required: true, type: 'text' },
      { key: 'cpu', label: 'CPU', required: true, type: 'text' },
      { key: 'ram', label: 'RAM', required: true, type: 'text' },
      { key: 'storage', label: 'Storage', required: true, type: 'text' },
      { key: 'screen_size', label: 'Screen Size', required: false, type: 'text' },
      { key: 'gpu', label: 'GPU', required: false, type: 'text' },
    ],
  },
  {
    name: 'T-Shirts',
    slug: 't-shirts',
    attributes: [
      { key: 'brand', label: 'Brand', required: true, type: 'text' },
      { key: 'size', label: 'Size', required: true, type: 'text' },
      { key: 'color', label: 'Color', required: true, type: 'text' },
      { key: 'material', label: 'Material', required: false, type: 'text' },
      { key: 'gender', label: 'Gender', required: false, type: 'text' },
      { key: 'fit', label: 'Fit', required: false, type: 'text' },
    ],
  },
  {
    name: 'Slow Cookers',
    slug: 'slow-cookers',
    attributes: [
      { key: 'brand', label: 'Brand', required: true, type: 'text' },
      { key: 'capacity', label: 'Capacity', required: true, type: 'text' },
      { key: 'color', label: 'Color', required: true, type: 'text' },
      { key: 'voltage', label: 'Voltage', required: false, type: 'text' },
      { key: 'dishwasher_safe', label: 'Dishwasher Safe', required: false, type: 'text' },
      { key: 'material', label: 'Material', required: false, type: 'text' },
      { key: 'dimensions', label: 'Dimensions', required: false, type: 'text' },
      { key: 'number_of_items', label: 'Number of Items', required: false, type: 'text' },
    ],
  },
  {
    name: 'Headphones',
    slug: 'headphones',
    attributes: [
      { key: 'brand', label: 'Brand', required: true, type: 'text' },
      { key: 'form_factor', label: 'Form Factor', required: true, type: 'text' },
      { key: 'connectivity', label: 'Connectivity', required: true, type: 'text' },
      { key: 'color', label: 'Color', required: true, type: 'text' },
    ],
  },
  {
    name: 'Shoes',
    slug: 'shoes',
    attributes: [
      { key: 'brand', label: 'Brand', required: true, type: 'text' },
      { key: 'size', label: 'Size', required: true, type: 'text' },
      { key: 'color', label: 'Color', required: true, type: 'text' },
      { key: 'material', label: 'Material', required: true, type: 'text' },
    ],
  },
  {
    name: 'Printers',
    slug: 'printers',
    attributes: [
      { key: 'brand', label: 'Brand', type: 'text', required: true, order: 1 },
      { key: 'type', label: 'Printer Type', type: 'text', required: true, order: 2 },
      { key: 'color', label: 'Color', type: 'text', required: false, order: 3 },
      { key: 'connectivity', label: 'Connectivity', type: 'text', required: false, order: 4 },
      { key: 'print_tech', label: 'Print Technology', type: 'text', required: false, order: 5 },
    ],
  },
]

async function main() {
  for (const categorySeed of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: categorySeed.slug },
      update: { name: categorySeed.name },
      create: {
        name: categorySeed.name,
        slug: categorySeed.slug,
      },
    })

    for (const [idx, attr] of categorySeed.attributes.entries()) {
      const order = attr.order ?? idx + 1
      await prisma.categoryAttribute.upsert({
        where: {
          categoryId_key: {
            categoryId: category.id,
            key: attr.key,
          },
        },
        update: {
          label: attr.label,
          required: attr.required,
          type: attr.type,
          order,
        },
        create: {
          categoryId: category.id,
          key: attr.key,
          label: attr.label,
          required: attr.required,
          type: attr.type,
          order,
        },
      })
    }
  }

  console.log('Seeded 7 categories with attributes using upsert')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
