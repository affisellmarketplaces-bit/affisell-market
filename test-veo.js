import 'dotenv/config'

const API_KEY = process.env.VEO_API_KEY
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT  
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION

async function testVeo() {
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/veo-3.1-generate-001:predict`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt: "A cat dancing in Paris" }],
      parameters: { durationSeconds: 4 }
    })
  })

  const data = await res.json()
  console.log(JSON.stringify(data, null, 2))
}

testVeo()