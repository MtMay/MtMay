import { z } from 'npm:zod';
const Input = z.object({ path: z.string().max(200) }).strict();
const MODEL = 'sabit-model';
Deno.serve(async (req) => {
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new Response('unauthorized', { status: 401 });
  const input = Input.parse(await req.json());
  if (!(await underQuota(claims.claims.sub))) return new Response('limit_exceeded', { status: 429 });
  const bytes = await download(input.path);
  if (!startsWith(bytes, '%PDF-') || hasMarker(bytes, ['/Encrypt', '/JavaScript'])) return new Response('bad_pdf', { status: 400 });
  const res = await extract(bytes, MODEL);
  await storage.from('tickets').remove([input.path]);
  return Response.json(res);
});
