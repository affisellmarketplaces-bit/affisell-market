import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const HF_TOKEN = process.env.HF_TOKEN;
const MODEL = 'stabilityai/stable-diffusion-2-inpainting';

export async function POST(req: NextRequest) {
  try {
    if (!HF_TOKEN) {
      return NextResponse.json({ error: 'HF_TOKEN manquant' }, { status: 500 });
    }
    const { image, mask, prompt = 'remove text, clean background' } = await req.json();
    const imageBlob = await fetch(image).then(r => r.blob());
    const maskBlob = await fetch(mask).then(r => r.blob());
    const formData = new FormData();
    formData.append('image', imageBlob, 'image.png');
    formData.append('mask_image', maskBlob, 'mask.png');
    formData.append('inputs', prompt);
    
    let response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}` },
      body: formData,
    });

    if (response.status === 503) {
      await new Promise(r => setTimeout(r, 20000));
      response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        body: formData,
      });
    }

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error }, { status: 500 });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return NextResponse.json({ image: `data:image/png;base64,${base64}`, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
