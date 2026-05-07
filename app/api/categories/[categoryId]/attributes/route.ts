import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
