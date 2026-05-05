import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const { image, mask } = await req.json();
    
    if (!REPLICATE_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN missing' }, { status: 500 });
    }

    // Start prediction
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'c11bac582d3ec9431357c967da9bdcb3d37949fbb0d5d74c4bff1cfde8fde846',
        input: {
          image,
          mask,
          prompt: 'remove text, clean background',
          num_inference_steps: 20,
        },
      }),
    });

    const prediction = await startRes.json();
    
    if (!startRes.ok) {
      return NextResponse.json({ error: prediction.detail || 'Replicate error' }, { status: 500 });
    }

    // Poll until complete
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(r => setTimeout(r, 1500));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Token ${REPLICATE_TOKEN}` },
      });
      result = await pollRes.json();
    }

    if (result.status === 'failed') {
      return NextResponse.json({ error: 'Inpainting failed' }, { status: 500 });
    }

    return NextResponse.json({ output: result.output });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
