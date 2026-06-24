/**
 * whySML — Serverless API: Upload Image to Cloudinary
 * Cloudinary credentials stored securely in Vercel environment variables
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
    const { imageBase64, folder, publicId } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Log env var presence for debugging
    console.log('Cloudinary config check:', {
      hasCloudName: !!cloudName,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      cloudName: cloudName
    });

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ 
        error: 'Cloudinary not configured',
        missing: { cloudName: !cloudName, apiKey: !apiKey, apiSecret: !apiSecret }
      });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const uploadFolder = folder || 'whysml/shirts';
    const finalPublicId = publicId || `shirt_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    // Use unsigned upload to avoid signature complexity
    const formData = new FormData();
    formData.append('file', imageBase64);
    formData.append('upload_preset', 'whysml_upload');
    formData.append('folder', uploadFolder);
    formData.append('public_id', finalPublicId);

    console.log('Uploading to Cloudinary cloud:', cloudName);

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    const result = await cloudRes.json();
    console.log('Cloudinary response status:', cloudRes.status);
    console.log('Cloudinary result:', JSON.stringify(result));

    if (!cloudRes.ok) {
      return res.status(500).json({ 
        error: 'Cloudinary upload failed', 
        details: result.error?.message || JSON.stringify(result)
      });
    }

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
