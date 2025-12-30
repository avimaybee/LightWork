import { GoogleGenAI } from '@google/genai';

interface SearchRequest {
    query: string;
    images: Array<{
        id: string;
        filename: string;
        thumbnailUrl: string;
    }>;
}

export async function onRequestPost(context: any) {
    try {
        const body: SearchRequest = await context.request.json();
        const { query, images } = body;

        if (!query || !images || images.length === 0) {
            return new Response(JSON.stringify({ matchingIds: [] }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Use the free-tier Gemini API key if available, otherwise fallback to main key
        const apiKey = context.env.FREE_GEMINI_API_KEY || context.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
        }

        // Fetch descriptions from DB for these images
        const imageIds = images.map(i => i.id);
        const placeholders = imageIds.map(() => '?').join(',');

        let dbImages: any[] = [];
        try {
            const result = await context.env.DB.prepare(
                `SELECT id, filename, description FROM images WHERE id IN (${placeholders})`
            ).bind(...imageIds).all();
            dbImages = result.results || [];
        } catch (e) {
            console.error('Failed to fetch descriptions:', e);
            // Fallback to provided images if DB fetch fails
            dbImages = images.map(i => ({ id: i.id, filename: i.filename, description: '' }));
        }

        // Initialize Gemini
        const genAI = new GoogleGenAI({ apiKey });

        // Create a prompt that uses descriptions if available, falling back to filenames
        const prompt = `You are an intelligent image search engine. 
Search Query: "${query}"

Analyze the following images based on their AI-generated descriptions (preferred) or filenames.
Return a JSON array of IDs for images that match the query semantically.

Image List:
${dbImages.map((img, i) => {
            const desc = img.description ? `Description: "${img.description}"` : `(No description)`;
            return `${i + 1}. ID: ${img.id} | File: "${img.filename}" | ${desc}`;
        }).join('\n')}

Rules:
1. Prioritize matches in the 'Description' field.
2. If description is missing, fallback to filename.
3. Be semantically smart (e.g., "food" matches "burger", "pizza", "dining").
4. Return ONLY the JSON array: ["id1", "id2"]`;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
        });

        // Parse the response to extract matching IDs
        let matchingIds: string[] = [];
        const text = response.text || '';

        try {
            // Try to extract JSON array from response
            const jsonMatch = text.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                matchingIds = JSON.parse(jsonMatch[0]);
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            // If parsing fails, return all images as a fallback
            matchingIds = images.map(img => img.id);
        }

        return new Response(JSON.stringify({ matchingIds }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('AI Search error:', error);
        return new Response(JSON.stringify({
            error: error.message || 'Search failed',
            matchingIds: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
