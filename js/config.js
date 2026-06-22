/* ============================================================
   config.js — Supabase tenging fyrir Verkhönnun vefinn.
   Notar opinbera (publishable) lykilinn — óhætt að hafa í
   frontend því RLS-reglur verja gögnin.
   ============================================================ */
window.VH_SUPABASE = {
  url: "https://ixoenzikoklsfzekyqdz.supabase.co",
  anonKey: "sb_publishable_pTQEE27h8ocr0JmfzbaLHw_JkpvWT3d",
  bucket: "media",
};

// Sameiginlegur Supabase-client (krefst þess að supabase-js sé hlaðið á undan)
window.vhClient = window.supabase.createClient(
  window.VH_SUPABASE.url,
  window.VH_SUPABASE.anonKey
);

// Hjálparfall: opinber slóð á mynd í storage
window.vhMediaUrl = function (path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path; // þegar full slóð
  return `${window.VH_SUPABASE.url}/storage/v1/object/public/${window.VH_SUPABASE.bucket}/${path}`;
};
