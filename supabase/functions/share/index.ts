// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: share
// Returns an HTML page with Open Graph meta tags for a given share slug
// Deploy with: supabase functions deploy share
// Invoke at: https://<project-ref>.functions.supabase.co/share/<slug>

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_SCHEME = Deno.env.get("APP_SCHEME") || "proactiveai";
const APP_WEB_FALLBACK = Deno.env.get("APP_WEB_FALLBACK") || "https://proactiveai.app"; // optional

// Use service role key to bypass RLS for public share links
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: { headers: { "x-application-name": "share-edge" } },
});

function htmlEscape(s: string | null | undefined) {
  return (s || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]!));
}

function pageTemplate({
  title,
  description,
  image,
  url,
  appUrl,
}: { title: string; description?: string; image?: string | null; url: string; appUrl: string }) {
  const safeTitle = htmlEscape(title);
  const safeDesc = htmlEscape(description || "Discuss on ProactiveAI");
  const safeImage = image || "data:image/svg+xml;base64," + btoa(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#160427;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#2B0B5E;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4C1D95;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <circle cx="600" cy="200" r="60" fill="#7C3AED" opacity="0.8"/>
      <text x="600" y="350" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="48" font-weight="bold">ProactiveAI</text>
      <text x="600" y="400" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui, sans-serif" font-size="24">AI-Powered Conversations</text>
      <text x="600" y="500" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="system-ui, sans-serif" font-size="32" font-weight="600">${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}</text>
    </svg>
  `);

  // Basic, clean preview. Social platforms read OG/Twitter meta tags from server response.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta http-equiv="refresh" content="0; url=${appUrl}">

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="ProactiveAI" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta name="twitter:image:alt" content="Preview image" />

  <link rel="canonical" href="${url}" />
  <link rel="alternate" href="${appUrl}" />

  <style>
    html,body{margin:0;padding:0;background:#0B0520;color:#fff;font-family:system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"}
    .wrap{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{max-width:720px;width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:16px;overflow:hidden}
    .hero{width:100%;height:280px;background:linear-gradient(135deg, #160427 0%, #2B0B5E 50%, #4C1D95 100%);display:flex;align-items:center;justify-content:center}
    .body{padding:20px}
    .title{font-weight:700;font-size:24px;margin:0 0 8px}
    .desc{opacity:.9;line-height:1.5;margin:0 0 16px}
    .btns{display:flex;gap:12px}
    .btn{background:#7C3AED;color:#fff;border:none;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:600}
    .ghost{background:transparent;border:1px solid rgba(255,255,255,.25)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hero">
        <div style="text-align:center;color:#fff">
          <div style="font-size:80px;margin-bottom:8px">🧠</div>
          <div style="font-size:24px;font-weight:700">ProactiveAI</div>
          <div style="font-size:16px;opacity:0.8">AI-Powered Conversations</div>
        </div>
      </div>
      <div class="body">
        <h1 class="title">${safeTitle}</h1>
        <p class="desc">${safeDesc}</p>
        <div class="btns">
          <a class="btn" href="${appUrl}">Open in App</a>
          <a class="btn ghost" href="${url}">Open Source</a>
        </div>
      </div>
    </div>
  </div>
  <script>
    // Auto-redirect to app scheme on capable devices, fallback remains
    setTimeout(function(){ window.location.href = '${appUrl}'; }, 100);
  </script>
</body>
</html>`;
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const urlObj = new URL(req.url);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    // Handle both /share/slug and /share/share/slug (in case of misconfiguration)
    const slug = parts.length === 2 ? parts[1] : (parts.length === 3 && parts[1] === "share" ? parts[2] : parts[parts.length - 1]);
    
    if (!slug || slug === "share") {
      return new Response("Missing or invalid slug", { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from("shared_links")
      .select("slug, title, description, image_url, source_url, news_context")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return new Response(JSON.stringify({ error: "Database error", details: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "content-type": "application/json" } 
      });
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "Share link not found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "content-type": "application/json" } 
      });
    }

    const publicUrl = `${urlObj.origin}/share/${slug}`;
    const appUrl = `${APP_SCHEME}://share/${slug}?auto=1`;

    const html = pageTemplate({
      title: data.title || data.news_context?.title || 'ProactiveAI',
      description: data.description || data.news_context?.description || 'Discuss on ProactiveAI',
      image: data.image_url || null,
      url: publicUrl,
      appUrl,
    });

    return new Response(html, { 
      status: 200, 
      headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" } 
    });
  } catch (e) {
    console.error("Server error:", e);
    return new Response(JSON.stringify({ error: "Server error", details: String(e) }), { 
      status: 500, 
      headers: { ...corsHeaders, "content-type": "application/json" } 
    });
  }
});
