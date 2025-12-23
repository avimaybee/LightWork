
export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM modules").all();
        // Map to frontend structure
        const modules = results.map(m => ({
            id: m.id,
            name: m.name,
            prompt: m.prompt,
            isCustom: true // DB modules are custom or stored system ones.
        }));
        return new Response(JSON.stringify(modules));
    } catch (e) {
        return new Response("[]"); // Fail gracefully to empty array
    }
}

export async function onRequestPost(context) {
    try {
        const { name, prompt } = await context.request.json();
        const id = crypto.randomUUID();
        
        await context.env.DB.prepare(
            "INSERT INTO modules (id, name, prompt, category) VALUES (?, ?, ?, ?)"
        ).bind(id, name, prompt, 'custom').run();

        return new Response(JSON.stringify({ id, name, prompt, isCustom: true }));
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
