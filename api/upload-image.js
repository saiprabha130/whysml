/**
 * whySML — Serverless API: Upload Image to Cloudinary
 * Cloudinary credentials stored securely in Vercel environment variables
 * Never exposed to the client/browser
 */

import crypto from 'crypto';

const ALLOWED_ORIGIN = 'https://whysml.com';

export default async function handler(req, res) {
  // Security: Only allow requests from whysml.com
  const origin = req.headers.origin || '';
  if (origin !== ALLOWED_ORIGIN && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('vercel.app')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, folder, publicId } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary not configured' });
    }

    // Generate signature for secure upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const uploadFolder = folder || 'whysml/shirts';
    const finalPublicId = publicId || `shirt_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const signatureString = `folder=${uploadFolder}&public_id=${finalPublicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

    // Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', imageBase64);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', uploadFolder);
    formData.append('public_id', finalPublicId);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!cloudinaryResponse.ok) {
      const error = await cloudinaryResponse.json();
      console.error('Cloudinary error:', error);
      return res.status(500).json({ error: 'Upload failed', details: error.error?.message });
    }

    const result = await cloudinaryResponse.json();

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height
    });

  } catch (error) {
    console.error('Upload image error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
