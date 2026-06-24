/**
 * whySML — Serverless API: Upload Image to Cloudinary
 * Cloudinary credentials stored securely in Vercel environment variables
 */

import crypto from 'crypto';

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

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary not configured' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const uploadFolder = folder || 'whysml/shirts';
    const finalPublicId = publicId || `shirt_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const signatureString = `folder=${uploadFolder}&public_id=${finalPublicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

    const formData = new FormData();
    formData.append('file', imageBase64);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', uploadFolder);
    formData.append('public_id', finalPublicId);

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!cloudRes.ok) {
      const err = await cloudRes.json().catch(() => ({}));
      return res.status(500).json({ error: 'Upload failed', details: err.error?.message });
    }

    const result = await cloudRes.json();
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
