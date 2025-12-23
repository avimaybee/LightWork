
export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM jobs ORDER BY created_at DESC"
    ).all();
    
    // Map DB to Frontend Project
    const projects = await Promise.all(results.map(async (job) => {
        const images = await context.env.DB.prepare("SELECT * FROM images WHERE job_id = ?").bind(job.id).all();
        
        return {
            id: job.id,
            name: job.name || 'Untitled Session',
            createdAt: job.created_at,
            jobs: images.results.map(img => ({
                id: img.id,
                fileName: img.filename,
                status: img.status,
                originalUrl: `/api/images/${img.r2_key_original}`,
                resultUrl: img.r2_key_result ? `/api/images/${img.r2_key_result}` : undefined,
                thumbnailUrl: `/api/images/${img.r2_key_original}`, 
                localPrompt: img.prompt || '',
                retryCount: 0,
                timestamp: img.created_at,
                // We add selected: false as it's UI state, not DB state
            })),
            // Map DB columns to frontend props. 
            // Note: Schema must support these. If not migrating schema, we default them.
            modulePrompt: job.module_prompt || '', 
            selectedMode: job.selected_mode || 'fast',
            selectedModulePreset: job.selected_module_preset || ''
        };
    }));

    return new Response(JSON.stringify(projects));
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const body = await context.request.json();
  const id = crypto.randomUUID();
  
  // Default values for new project
  await context.env.DB.prepare(
    "INSERT INTO jobs (id, name, status, created_at, module_prompt, selected_mode, selected_module_preset) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, body.name, 'active', Date.now(), '', 'fast', '').run();

  return new Response(JSON.stringify({ 
      id, 
      name: body.name, 
      jobs: [], 
      createdAt: Date.now(),
      modulePrompt: '',
      selectedMode: 'fast',
      selectedModulePreset: ''
  }));
}
