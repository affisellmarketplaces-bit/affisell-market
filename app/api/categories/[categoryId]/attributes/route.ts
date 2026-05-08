import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params
  const attributes = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: { order: 'asc' }
  })
  return NextResponse.json(attributes)
}
