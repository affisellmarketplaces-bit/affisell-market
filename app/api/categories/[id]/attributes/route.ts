import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId: params.id },
    orderBy: { order: 'asc' }
  })
  return NextResponse.json({ attributes })
}
