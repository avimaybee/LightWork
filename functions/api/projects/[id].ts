
export async function onRequestPatch(context) {
  try {
    const id = context.params.id;
    const updates = await context.request.json();
    
    const fields = [];
    const values = [];

    // Map frontend keys to DB columns
    if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
    if (updates.modulePrompt !== undefined) { fields.push("module_prompt = ?"); values.push(updates.modulePrompt); }
    if (updates.selectedMode !== undefined) { fields.push("selected_mode = ?"); values.push(updates.selectedMode); }
    if (updates.selectedModulePreset !== undefined) { fields.push("selected_module_preset = ?"); values.push(updates.selectedModulePreset); }

    if (fields.length === 0) return new Response("No valid fields", { status: 400 });

    values.push(id); // For WHERE clause

    const query = `UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`;
    await context.env.DB.prepare(query).bind(...values).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const id = context.params.id;
  
  // 1. Get images to delete from R2
  const images = await context.env.DB.prepare("SELECT r2_key_original, r2_key_result FROM images WHERE job_id = ?").bind(id).all();
  
  // 2. Delete from R2 (Fire and forget or await)
  const keysToDelete = [];
  images.results.forEach(img => {
      if(img.r2_key_original) keysToDelete.push(img.r2_key_original);
      if(img.r2_key_result) keysToDelete.push(img.r2_key_result);
  });
  
  if (keysToDelete.length > 0) {
      // R2 delete allows array? No, standard is delete(key) or delete(keys[]) in AWS SDK but CF Worker R2 is delete(key). 
      // Actually R2 supports delete(key | key[]).
      // We will loop to be safe if bulk is not enabled in specific worker types context.
      await Promise.all(keysToDelete.map(key => context.env.STORAGE.delete(key)));
  }

  // 3. Delete from DB
  await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM images WHERE job_id = ?").bind(id),
      context.env.DB.prepare("DELETE FROM jobs WHERE id = ?").bind(id)
  ]);

  return new Response(JSON.stringify({ success: true }));
}
