
export async function onRequestDelete(context) {
    const id = context.params.id;
    await context.env.DB.prepare("DELETE FROM modules WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }));
}
