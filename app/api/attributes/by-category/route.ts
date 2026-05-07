import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')
  
  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
  }

  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: { label: 'asc' }
  })

  return NextResponse.json({ attributes })
}
