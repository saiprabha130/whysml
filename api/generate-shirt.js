/**
 * whySML — Serverless API: Generate Shirt Images
 * Uses Stability AI to convert fabric photos into shirt images
 * API keys stored securely in Vercel environment variables
 */

const ALLOWED_ORIGINS = [
  'https://whysml.com',
  'https://www.whysml.com',
  'https://whysml-2.vercel.app'
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('vercel.app');

  const allowOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, shirtType, view } = req.body;

    if (!imageBase64 || !shirtType || !view) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['formal', 'casual'];
    const validViews = ['front', 'back', 'folded'];
    if (!validTypes.includes(shirtType)) return res.status(400).json({ error: 'Invalid shirt type' });
    if (!validViews.includes(view)) return res.status(400).json({ error: 'Invalid view' });

    const prompts = {
      formal: {
        front: "Professional product photo of a men's formal dress shirt, front view, on invisible mannequin, made from the reference fabric, crisp collar, button placket, pure white background, studio lighting, fashion photography",
        back: "Professional product photo of a men's formal dress shirt, back view, on invisible mannequin, made from the reference fabric, pure white background, studio lighting, fashion photography",
        folded: "Professional product photo of a men's formal dress shirt, neatly folded flat lay, made from the reference fabric, pure white background, studio lighting, fashion photography"
      },
      casual: {
        front: "Professional product photo of a men's casual shirt, front view, on invisible mannequin, made from the reference fabric, relaxed fit, pure white background, studio lighting, fashion photography",
        back: "Professional product photo of a men's casual shirt, back view, on invisible mannequin, made from the reference fabric, pure white background, studio lighting, fashion photography",
        folded: "Professional product photo of a men's casual shirt, neatly folded flat lay, made from the reference fabric, pure white background, studio lighting, fashion photography"
      }
    };

    const stabilityKey = process.env.STABILITY_AI_KEY;
    if (!stabilityKey) return res.status(500).json({ error: 'Stability AI not configured' });

    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'fabric.jpg');
    formData.append('prompt', prompts[shirtType][view]);
    formData.append('mode', 'image-to-image');
    formData.append('strength', '0.8');
    formData.append('output_format', 'jpeg');
    formData.append('model', 'sd3-large-turbo');

    const stabilityRes = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${stabilityKey}`, 'Accept': 'application/json' },
        body: formData
      }
    );

    if (!stabilityRes.ok) {
      const err = await stabilityRes.json().catch(() => ({}));
      console.error('Stability AI error:', err);
      return res.status(500).json({ error: 'Image generation failed', details: err.message || stabilityRes.status });
    }

    const result = await stabilityRes.json();
    return res.status(200).json({
      success: true,
      image: `data:image/jpeg;base64,${result.image}`,
      view, shirtType
    });

  } catch (error) {
    console.error('Generate shirt error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
