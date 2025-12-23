
import { GoogleGenAI } from "@google/genai";

export async function onRequestPost(context) {
    let jobId: string | null = null;

    try {
        const body = await context.request.json();
        jobId = body.jobId;
        const { model, systemPrompt, userPrompt } = body;
        
        // 1. Get Image Info from DB
        const imageRecord = await context.env.DB.prepare("SELECT * FROM images WHERE id = ?").bind(jobId).first();
        if (!imageRecord) return new Response("Image not found", { status: 404 });

        // 2. Get Image Data from R2
        const obj = await context.env.STORAGE.get(imageRecord.r2_key_original);
        if (!obj) return new Response("Source image missing in storage", { status: 404 });

        const arrayBuffer = await obj.arrayBuffer();
        const b64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // 3. Call Gemini
        const ai = new GoogleGenAI({ apiKey: context.env.API_KEY });
        
        // Configure Request
        const isPro = model === 'gemini-3-pro-image-preview';
        const config: any = {};
        
        if (isPro) {
            // Pro model supports specific image configs
            config.imageConfig = {
                imageSize: "2K" // Default to high quality for Pro
            };
        }

        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: b64Data, mimeType: 'image/jpeg' } },
                    { text: `${systemPrompt}\n\n${userPrompt || ''}` }
                ]
            },
            config: config
        });

        // 4. Extract Result safely (Iterate through parts)
        let imageBytes = null;
        
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    imageBytes = part.inlineData.data;
                    break; 
                }
            }
        }

        if (!imageBytes) {
             console.error("Gemini response missing image data:", JSON.stringify(response));
             // Check if there was a text refusal or error message
             const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
             const errorMsg = textPart ? textPart.text : "Model returned no image data.";
             throw new Error(errorMsg);
        }

        // 5. Save Result to R2
        const resultKey = `result-${jobId}.png`;
        // Decode base64 to Uint8Array for storage
        const binaryString = atob(imageBytes);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        await context.env.STORAGE.put(resultKey, bytes, {
            httpMetadata: { contentType: 'image/png' }
        });

        // 6. Update DB
        await context.env.DB.prepare("UPDATE images SET status = ?, r2_key_result = ? WHERE id = ?")
            .bind('completed', resultKey, jobId).run();

        // Return bytes to frontend for immediate display without refetch
        return new Response(JSON.stringify({ success: true, imageBytes })); 

    } catch (e) {
        // Log error and update DB status
        try {
            if (jobId) {
                await context.env.DB.prepare("UPDATE images SET status = ?, error_msg = ? WHERE id = ?")
                    .bind('error', e.message, jobId).run();
            }
        } catch (dbError) {
            // Ignore DB update errors during crash
        }
        
        return new Response(JSON.stringify({ success: false, error: e.message }));
    }
}
