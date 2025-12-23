
export async function onRequestGet(context) {
  const key = context.params.key;
  
  if (!key) return new Response("Missing key", { status: 400 });

  try {
      const object = await context.env.STORAGE.get(key);

      if (!object) {
        return new Response("Image not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      
      // Cache aggressively: Images are immutable (results are new keys)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable'); 
      headers.set('Access-Control-Allow-Origin', '*'); // Allow usage in canvas

      return new Response(object.body, { headers });
  } catch (e) {
      return new Response("Internal Error", { status: 500 });
  }
}
