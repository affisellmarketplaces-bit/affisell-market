import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY missing in .env.local', exists: false }, { status: 500 })
    }
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    await openai.models.list()
    
    return NextResponse.json({ 
      success: true, 
      message: 'OPENAI_API_KEY works',
      keyPrefix: process.env.OPENAI_API_KEY.substring(0, 7) + '...'
    })
  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message,
      exists: !!process.env.OPENAI_API_KEY 
    }, { status: 500 })
  }
}
