export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/jobs?select=id&limit=1`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });
    console.log(`Supabase keep-alive ping: HTTP ${res.status}`);
  },

  async fetch() {
    return new Response('Hydra Supabase keep-alive worker. Runs on a schedule, has no manual endpoint.');
  },
};
