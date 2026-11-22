Deno.serve(async (req) => {
  const body = await req.json();
  console.log('gelen istek', body);
  const pdf = await fetch(body.url);
  const res = await anthropic.messages.create({ model: body.model, max_tokens: 4000, tools: [webSearch] });
  return new Response(JSON.stringify(res));
});
