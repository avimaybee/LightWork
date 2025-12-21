-- LightWork Database Schema
-- Cloudflare D1 (SQLite-compatible)

-- Modules: Preset AI workflows
CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT,
  category TEXT DEFAULT 'general',
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Jobs: Batch processing sessions
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  global_prompt TEXT,
  model TEXT DEFAULT 'nano_banana' CHECK(model IN ('nano_banana', 'nano_banana_pro')),
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  total_images INTEGER DEFAULT 0,
  completed_images INTEGER DEFAULT 0,
  failed_images INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (module_id) REFERENCES modules(id)
);

-- Images: Individual image processing records
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  original_key TEXT NOT NULL,
  original_filename TEXT,
  processed_key TEXT,
  thumbnail_key TEXT,
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY_LATER')),
  specific_prompt TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  file_size INTEGER,
  mime_type TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  processed_at INTEGER,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Indexes for efficient Cron Worker queries
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_images_job_id ON images(job_id);
CREATE INDEX IF NOT EXISTS idx_images_pending ON images(status, created_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_module ON jobs(module_id);

-- Prepopulate with default modules
INSERT OR REPLACE INTO modules (id, name, description, system_prompt, icon, category) VALUES
(
  'food-enhancer',
  'Food Plating Enhancer',
  'Transform amateur food photos into professional commercial-grade images with consistent lighting, composition, and appetizing appeal.',
  'Analyze the visual content of the uploaded image and automatically identify the dish/dishes, including its main ingredients, sauces, garnishes, and plating style.

Once identified, generate a new, hyper-realistic, professional commercial food photography image of this exact dish. You must maintain the culinary identity and ingredients of the original food (do not change the food itself), but you must completely ignore the original image''s poor lighting, amateur camera angle, and background. You must align/place them better that looks professional and realistic. 

Instead, enforce the following strict "Brand Consistency" standards on the output:

1. COMPOSITION & ANGLE (Standardized):
Ignore the angle of the original photo. Re-shoot the dish from a standardized "Diner''s Eye" perspective (approximately 30 degrees elevation). The dish must be perfectly centered. Fill 80% of the frame with the food (Macro focus). Ensure the depth of field is shallow (f/2.8), creating a creamy bokeh that blurs the background but keeps the front center of the food razor-sharp.

2. LIGHTING (Standardized):
Apply consistent "Golden Hour Studio" lighting. Use a large, soft light source from the top-left to create glistening specular highlights on the food''s moisture and sauces. Use a warm rim light (backlight) to separate the food from the background. The lighting must be high-contrast and punchy, making the food look hot and fresh.

3. BACKGROUND (Standardized):
Remove the original environment. Place the dish on a consistent, dark, matte charcoal slate surface. The background should be a neutral, dark gradient that matches across all generated images to ensure menu consistency.

4. TEXTURE & QUALITY:
Upscale the appetizing nature of the food. Make greens look crisp and dewy, meats succulent and juicy, and sauces glossy. Output in 8k resolution, photorealistic style, devoid of noise or artifacts. Exponentially enhance the texture of dishes. 

Take the identified food from the input, apply these four standards, and generate the final image.',
  'utensils',
  'food'
),
(
  'product-background',
  'Product Background Swapper',
  'Remove cluttered backgrounds and place products on clean, professional studio surfaces for e-commerce listings.',
  'Analyze the uploaded product image and identify the primary product, its material, color, shape, and distinctive features.

Generate a new, hyper-realistic, professional e-commerce product photography image of this exact product. Preserve every detail of the original product (brand marks, labels, textures, colors) with absolute fidelity, but completely replace the background.

Apply these strict "E-Commerce Standard" guidelines:

1. BACKGROUND:
Remove all original background elements. Place the product on a seamless, pure white (#FFFFFF) infinity curve studio background. The background must be perfectly clean with no shadows creeping in from edges. Alternatively, for premium products, use a subtle light grey gradient that adds depth without distraction.

2. COMPOSITION:
Center the product and fill 70-80% of the frame. Shoot from a slightly elevated 3/4 angle that shows the product''s depth and form. Ensure the product appears grounded and stable, not floating.

3. LIGHTING:
Use soft, diffused lighting from multiple angles to eliminate harsh shadows. Apply subtle rim lighting to separate the product from the background. Ensure specular highlights on glossy surfaces are controlled and appealing. The lighting should make the product look premium and desirable.

4. SHADOWS:
Add a soft, subtle contact shadow directly beneath the product to ground it. The shadow should be barely visible—just enough to prevent the product from appearing to float.

5. QUALITY:
Output at maximum resolution with crisp, sharp details. Remove any dust, scratches, or imperfections. Colors must be accurate and vibrant. The final image should be ready for Amazon, Shopify, or any e-commerce platform.

Preserve the product exactly as shown, apply these standards, and generate the final image.',
  'shopping-bag',
  'product'
),
(
  'portrait-retoucher',
  'Portrait Retoucher',
  'Enhance portrait photos with professional skin retouching, lighting correction, and subtle beautification while maintaining natural appearance.',
  'Analyze the uploaded portrait photograph and identify the subject(s), their facial features, skin characteristics, hair, clothing, and overall composition.

Generate a new, professionally retouched portrait that enhances the subject''s appearance while maintaining their authentic look and identity. Do NOT alter facial structure, body shape, or create unrealistic beauty standards.

Apply these "Professional Portrait" retouching standards:

1. SKIN RETOUCHING:
Smooth skin texture subtly while preserving natural pores and skin detail (avoid plastic/airbrushed look). Remove temporary blemishes (pimples, redness) but keep permanent features (moles, freckles, beauty marks). Even out skin tone and reduce under-eye circles naturally. Add subtle, healthy skin luminosity.

2. LIGHTING CORRECTION:
Balance exposure across the face. Reduce harsh shadows and blown-out highlights. Add flattering catchlights in the eyes. Create subtle dimensional lighting that sculpts facial features attractively. The lighting should feel natural, as if professionally lit during the shoot.

3. COLOR GRADING:
Apply subtle, flattering color grading that enhances skin tones. Ensure accurate white balance. Boost color vibrancy slightly without crossing into unnatural territory. The final color palette should be warm and inviting.

4. DETAIL ENHANCEMENT:
Sharpen eyes and bring out iris details subtly. Enhance eyebrow definition naturally. Ensure hair looks healthy and defined. Whiten teeth very subtly (avoid obvious whitening). Enhance lip color naturally.

5. BACKGROUND:
If the background is distracting, blur it further (bokeh effect) or darken it to draw focus to the subject. Do not completely replace the background unless it''s severely problematic.

6. QUALITY:
Output at maximum resolution with professional-grade sharpness. The result should look like it came from a high-end portrait studio—enhanced but unmistakably the same person.

Enhance the portrait naturally, apply these standards, and generate the final image.',
  'user',
  'portrait'
),
(
  'realestate-brightener',
  'Real Estate Brightener',
  'Transform dark, poorly lit property photos into bright, inviting spaces that attract potential buyers and renters.',
  'Analyze the uploaded real estate/interior photograph and identify the room type, architectural features, furniture, decor, and current lighting conditions.

Generate a new, professionally enhanced real estate photograph of this exact space. Preserve the actual room layout, furniture, and decor, but dramatically improve the lighting, colors, and overall appeal to maximize buyer interest.

Apply these "Real Estate Pro" enhancement standards:

1. LIGHTING TRANSFORMATION:
Brighten the entire space dramatically while maintaining natural appearance. Simulate natural daylight flooding through windows (even if originally dark). Balance interior and exterior exposure—windows should show pleasant outdoor views, not blown-out white. Add warm, inviting ambient lighting that makes the space feel cozy yet spacious.

2. COLOR ENHANCEMENT:
Correct white balance to neutral/slightly warm tones. Make white walls truly white and bright. Enhance wood tones to look rich and warm. Boost the vibrancy of accent colors and decor. Ensure colors are accurate and appealing to broad audiences.

3. SKY REPLACEMENT (if applicable):
If windows show overcast or dull skies, replace with pleasant blue sky and soft clouds. The outdoor view should be inviting and suggest good weather.

4. DETAIL & CLARITY:
Sharpen architectural details, textures, and furnishings. Remove clutter digitally if minor (chargers, random items) but keep major furniture and decor. Straighten any slightly tilted perspectives. Ensure clean, crisp lines throughout.

5. ATMOSPHERE:
Make the space feel aspirational yet achievable. It should look like a place someone would want to live. Add subtle warmth without making it look artificially staged. The final image should evoke the feeling of "home."

6. QUALITY:
Output at maximum resolution optimized for real estate listings. The image should look professionally photographed with proper equipment and lighting setup.

Enhance this property photo, apply these standards, and generate the final image.',
  'home',
  'realestate'
);
