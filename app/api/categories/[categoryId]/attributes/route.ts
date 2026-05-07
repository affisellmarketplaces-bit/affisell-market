import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  req: Request,
  { params }: { params: { categoryId: string } }
) {
  try {
    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId: params.categoryId },
      orderBy: { order: 'asc' }
    })
    return NextResponse.json({ attributes })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ attributes: [] }, { status: 500 })
  }
}
