
export type ProcessMode = 'fast' | 'pro';

export enum AppModel {
  FAST = 'gemini-2.5-flash-image', // Nano Banana
  PRO = 'gemini-3-pro-image-preview', // Nano Banana Pro
}

export type ProcessingStatus = 
  | 'idle' 
  | 'uploading' 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'error'
  | 'retrying'
  | 'paused'; 

export interface ImageJob {
  id: string;
  file?: File; // Only present in frontend state before upload or if freshly dropped
  fileName: string; 
  thumbnailUrl: string; 
  originalUrl?: string; // Blob URL or R2 URL
  resultUrl?: string; // R2 URL
  status: ProcessingStatus;
  localPrompt: string;
  errorMsg?: string;
  retryCount: number;
  timestamp: number;
  
  // Interaction
  selected?: boolean;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  jobs: ImageJob[];
  modulePrompt: string;
  selectedMode: ProcessMode;
  selectedModulePreset: string;
}

export interface Module {
  id: string;
  name: string;
  prompt: string;
  isCustom: boolean;
}

// Default modules are now a fallback, real data should come from DB if possible
export const DEFAULT_MODULES: Module[] = [
  { 
    id: 'general', 
    name: 'General', 
    prompt: "Analyze the uploaded image to determine its subject and context. Generate a high-fidelity 'Remastered' version of this image. The goal is to maximize visual clarity and aesthetic appeal while remaining faithful to the original subject matter.\n\nEnforce the following standards:\n\n1. CLARITY & DETAIL:\nApply intelligent upscaling. Sharpen edges and recover lost details in textures. Remove compression artifacts, noise, and grain.\n\n2. LIGHTING & COLOR:\nBalance the exposure. Recover details in highlights and shadows. Color grade the image for a 'Cinematic' look—rich contrast, saturated but natural colors, and accurate white balance.\n\n3. COMPOSITION:\nIf the original framing is crooked, straighten the horizon. If the subject is slightly off-center, subtly re-frame to follow the rule of thirds.\n\n4. STYLE:\nThe output should look like it was captured with a high-end full-frame camera and professional lens. Enhance the overall 'production value' of the image.", 
    isCustom: false 
  },
  { 
    id: 'food', 
    name: 'Food', 
    prompt: "Analyze the visual content of the uploaded image and automatically identify the dish/dishes, including its main ingredients, sauces, garnishes, and plating style.\n\nOnce identified, generate a new, hyper-realistic, professional commercial food photography image of this exact dish. You must maintain the culinary identity and ingredients of the original food (do not change the food itself), but you must completely ignore the original image's poor lighting, amateur camera angle, and background. You must align/place them better that looks professional and realistic.\n\nInstead, enforce the following strict \"Brand Consistency\" standards on the output:\n\n1. COMPOSITION & ANGLE (Standardized):\nIgnore the angle of the original photo. Re-shoot the dish from a standardized \"Diner's Eye\" perspective (approximately 30 degrees elevation). The dish must be perfectly centered. Fill 80% of the frame with the food (Macro focus). Ensure the depth of field is shallow (f/2.8), creating a creamy bokeh that blurs the background but keeps the front center of the food razor-sharp.\n\n2. LIGHTING (Standardized):\nApply consistent \"Golden Hour Studio\" lighting. Use a large, soft light source from the top-left to create glistening specular highlights on the food's moisture and sauces. Use a warm rim light (backlight) to separate the food from the background. The lighting must be high-contrast and punchy, making the food look hot and fresh.\n\n3. BACKGROUND (Standardized):\nRemove the original environment. Place the dish on a consistent, dark, matte charcoal slate surface. The background should be a neutral, dark gradient that matches across all generated images to ensure menu consistency.\n\n4. TEXTURE & QUALITY:\nUpscale the appetizing nature of the food. Make greens look crisp and dewy, meats succulent and juicy, and sauces glossy. Output in 8k resolution, photorealistic style, devoid of noise or artifacts. Exponentially enhance the texture of dishes.\n\nTake the identified food from the input, apply these four standards, and generate the final image.", 
    isCustom: false 
  },
  { 
    id: 'product', 
    name: 'Product', 
    prompt: "Analyze the visual content of the uploaded image and identify the main product, its material properties (glass, metal, fabric, plastic), and its key features.\n\nGenerate a new, high-end e-commerce product photography image of this exact item. Maintain the product's exact branding, logos, text, and physical shape, but replace the environment and lighting with a professional studio setup.\n\nEnforce the following strict standards:\n\n1. COMPOSITION & ANGLE:\nRe-shoot from a 'Hero' perspective (slightly below eye level) to make the product look imposing and premium. Center the product perfectly. Ensure the entire product is in sharp focus (f/16) to showcase all details.\n\n2. LIGHTING:\nUse 'Softbox Studio' lighting. A large, diffuse main light from the side to wrap around the form, and a fill light to lift shadows. Add a sharp rim light to define the edges against the background. Highlights should be clean and controlled, emphasizing the material texture without blowing out details.\n\n3. BACKGROUND:\nPlace the product on a seamless, infinite white or very light grey background (Hex #F5F5F5). Add a subtle, natural drop shadow to ground the product, avoiding floating effects.\n\n4. QUALITY:\nOutput in ultra-high resolution (8k). Remove dust, scratches, or fingerprints from the source product. Enhance material definition—make metal gleam, glass refract, and fabric show its weave. The result should look like a high-budget advertising asset.", 
    isCustom: false 
  },
  { 
    id: 'portrait', 
    name: 'Portrait', 
    prompt: "Analyze the subject in the uploaded image. Identify the person, and their clothing.\n\nGenerate a new, professional studio headshot of this person. Preserve their facial features, identity, expression, and ethnicity with absolute fidelity. Improve the technical quality of the photograph significantly.\n\nEnforce the following standards:\n\n1. COMPOSITION:\nCrop to a classic head-and-shoulders composition. The eyes should be located at the upper third line. Use a portrait focal length (85mm) to flatter facial features and avoid distortion. Shallow depth of field (f/2.0) to blur the background.\n\n2. LIGHTING:\nApply 'Butterfly' or 'Rembrandt' lighting. Soft, flattering light that sculpts the face gently. Ensure there are 'catchlights' in the eyes to bring them to life. Skin tones must be natural, luminous, and even, avoiding harsh shadows under the eyes or nose.\n\n3. BACKGROUND:\nReplace the background with a soft, out-of-focus textured canvas in a neutral tone (cool grey or muted blue). The background should not distract from the subject.\n\n4. RETOUCHING:\nApply high-end frequency separation retouching. Smooth out skin blemishes and uneven tones while retaining natural skin texture (pores). Whiten teeth naturally and brighten eyes. The result should look like a magazine cover portrait.", 
    isCustom: false 
  },
  { 
    id: 'real_estate', 
    name: 'Real Estate', 
    prompt: "Analyze the uploaded architectural image (interior or exterior). Identify the structure, furniture layout, and key architectural elements.\n\nGenerate a new, luxury architectural photograph of this space. Keep the structural layout and furniture arrangement identical, but dramatically improve the atmosphere, lighting, and clarity.\n\nEnforce the following standards:\n\n1. COMPOSITION:\nCorrect vertical lines (keystoning) so walls are perfectly straight up and down. Use a wide-angle lens (16mm) to show the breadth of the space without excessive fisheye distortion. Camera height should be at waist level for interiors.\n\n2. LIGHTING:\nUse 'Flambient' (Flash + Ambient) style lighting. Balance the interior light with the exterior window light. Windows must not be blown out; the view outside should be visible. Brighten dark corners. The room should feel airy, warm, and inviting.\n\n3. STAGING & CLEANUP:\nRemove clutter (cables, trash cans, personal items, piles of paper). 'Virtual Staging' cleanup: Make surfaces gleam. If the room is empty, keep it empty but make the floors and walls look pristine.\n\n4. QUALITY:\nHigh dynamic range (HDR) processing. Sharpness from corner to corner. Colors should be natural and vibrant, emphasizing wood grains and textile textures.", 
    isCustom: false 
  }
];