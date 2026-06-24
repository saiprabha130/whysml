/**
 * whySML — Serverless API: Generate Shirt Images
 * Uses Stability AI to convert fabric photos into shirt images
 * API keys are stored securely in Vercel environment variables
 * Never exposed to the client/browser
 */

const ALLOWED_ORIGIN = 'https://whysml.com';

export default async function handler(req, res) {
  // Security: Only allow requests from whysml.com
  const origin = req.headers.origin || '';
  if (origin !== ALLOWED_ORIGIN && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('vercel.app')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, shirtType, view } = req.body;

    if (!imageBase64 || !shirtType || !view) {
      return res.status(400).json({ error: 'Missing required fields: imageBase64, shirtType, view' });
    }

    // Validate shirt type
    const validTypes = ['formal', 'casual'];
    if (!validTypes.includes(shirtType)) {
      return res.status(400).json({ error: 'Invalid shirt type' });
    }

    // Validate view
    const validViews = ['front', 'back', 'folded'];
    if (!validViews.includes(view)) {
      return res.status(400).json({ error: 'Invalid view type' });
    }

    // Build prompt based on shirt type and view
    const prompts = {
      formal: {
        front: 'A professional product photo of a men\'s formal dress shirt, front view, displayed on an invisible mannequin, made from the fabric shown in the reference image, crisp collar, button placket, white background, high quality fashion photography, studio lighting',
        back: 'A professional product photo of a men\'s formal dress shirt, back view, displayed on an invisible mannequin, made from the fabric shown in the reference image, white background, high quality fashion photography, studio lighting',
        folded: 'A professional product photo of a men\'s formal dress shirt, neatly folded and flat lay, made from the fabric shown in the reference image, white background, high quality fashion photography, studio lighting'
      },
      casual: {
        front: 'A professional product photo of a men\'s casual shirt, front view, displayed on an invisible mannequin, made from the fabric shown in the reference image, relaxed collar, white background, high quality fashion photography, studio lighting',
        back: 'A professional product photo of a men\'s casual shirt, back view, displayed on an invisible mannequin, made from the fabric shown in the reference image, white background, high quality fashion photography, studio lighting',
        folded: 'A professional product photo of a men\'s casual shirt, neatly folded and flat lay, made from the fabric shown in the reference image, white background, high quality fashion photography, studio lighting'
      }
    };

    const prompt = prompts[shirtType][view];

    // Call Stability AI API — key stored securely server-side
    const stabilityResponse = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_AI_KEY}`,
          'Accept': 'application/json'
        },
        body: (() => {
          const form = new FormData();
          // Convert base64 to blob
          const buffer = Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          form.append('image', blob, 'fabric.jpg');
          form.append('prompt', prompt);
          form.append('mode', 'image-to-image');
          form.append('strength', '0.75');
          form.append('output_format', 'jpeg');
          return form;
        })()
      }
    );

    if (!stabilityResponse.ok) {
      const error = await stabilityResponse.json();
      console.error('Stability AI error:', error);
      return res.status(500).json({ error: 'Image generation failed', details: error.message });
    }

    const result = await stabilityResponse.json();
    const generatedImageBase64 = result.image;

    return res.status(200).json({
      success: true,
      image: `data:image/jpeg;base64,${generatedImageBase64}`,
      view,
      shirtType
    });

  } catch (error) {
    console.error('Generate shirt error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
