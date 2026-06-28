// Vercel serverless function. Verifies a Payhip license key server-side so the
// product secret key is never exposed to the browser.
// Set PAYHIP_PRODUCT_SECRET_KEY in Vercel → Project → Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, error: "Method not allowed" });
  }
  const { license_key } = req.body || {};
  if (!license_key) return res.status(400).json({ valid: false, error: "Missing license_key" });

  const secret = process.env.PAYHIP_PRODUCT_SECRET_KEY;
  if (!secret) return res.status(500).json({ valid: false, error: "Server not configured" });

  try {
    const url = "https://payhip.com/api/v2/license/verify?license_key=" + encodeURIComponent(license_key);
    const r = await fetch(url, { headers: { "product-secret-key": secret } });
    const text = await r.text();
    if (!text) return res.status(200).json({ valid: false }); // Payhip returns empty on failure
    const data = JSON.parse(text);
    const enabled = data && data.data && data.data.enabled === true;
    // Optional: enforce a single activation by checking/incrementing data.data.uses here.
    return res.status(200).json({ valid: !!enabled });
  } catch (e) {
    return res.status(500).json({ valid: false, error: "Verification failed" });
  }
}
