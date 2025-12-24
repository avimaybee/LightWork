
export async function onRequestGet(context) {
  // Get the key from params - may be URL encoded
  let key = context.params.key;

  if (!key) return new Response("Missing key", { status: 400 });

  // Decode the key if it's URL encoded
  try {
    key = decodeURIComponent(key);
  } catch (e) {
    // Key wasn't encoded, use as-is
  }

  console.log("[Images API] Fetching key:", key);

  try {
    const object = await context.env.STORAGE.get(key);

    if (!object) {
      console.log("[Images API] Key not found in R2:", key);

      // Try to list objects to debug
      const list = await context.env.STORAGE.list({ limit: 10 });
      console.log("[Images API] Available keys sample:", list.objects.map(o => o.key));

      return new Response("Image not found: " + key, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Cache aggressively: Images are immutable (results are new keys)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*'); // Allow usage in canvas

    return new Response(object.body, { headers });
  } catch (e) {
    console.error("[Images API] Error:", e);
    return new Response("Internal Error: " + e.message, { status: 500 });
  }
}
