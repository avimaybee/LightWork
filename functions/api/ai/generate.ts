
import { GoogleGenAI } from "@google/genai";

export async function onRequestPost(context) {
    try {
        const { type, jobId, text } = await context.request.json();
        const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });
        const model = 'gemini-2.5-flash-image';

        let prompt = "";
        let imagePart = null;

        if (type === 'enhance') {
            // Text-only task
            if (!text) return new Response("Missing text", { status: 400 });
            prompt = `Refine the following image editing instruction to be more technical, precise, and effective for an AI image generator. Keep it concise. Input: "${text}"`;
        }
        else if (type === 'rename' || type === 'describe') {
            // Vision tasks
            if (!jobId) return new Response("Missing jobId", { status: 400 });

            // Fetch image from R2
            const imageRecord = await context.env.DB.prepare("SELECT r2_key_original FROM images WHERE id = ?").bind(jobId).first();
            if (!imageRecord) return new Response("Image not found", { status: 404 });

            const obj = await context.env.STORAGE.get(imageRecord.r2_key_original);
            const arrayBuffer = await obj.arrayBuffer();
            const b64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            imagePart = { inlineData: { data: b64Data, mimeType: 'image/jpeg' } };

            if (type === 'rename') {
                prompt = "Analyze this image and generate a short, SEO-friendly, kebab-case filename (e.g. 'sunset-beach-portrait'). Do not include file extension.";
            } else {
                prompt = "Analyze this image and provide a detailed technical description of the subject, lighting, and composition that could be used as a prompt to recreate or edit it.";
            }
        } else {
            return new Response("Invalid type", { status: 400 });
        }

        const parts = imagePart ? [imagePart, { text: prompt }] : [{ text: prompt }];

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts }
        });

        return new Response(JSON.stringify({ success: true, result: response.text.trim() }));
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }));
    }
}
