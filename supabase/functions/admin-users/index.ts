import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (u: string) => u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
const emailFor = (u: string) => `${normalize(u)}@app.local`;

const ALL_SCHOOL_YEARS = ["1fund", "2fund", "3fund", "4fund", "5fund", "6fund", "7fund", "8fund", "9fund"];

/** Filtra pra só os anos válidos; se vier vazio/ausente/tudo inválido, libera todos (mesmo
 * comportamento de hoje, sem restrição) em vez de travar o aluno sem nenhum bloco por engano. */
const sanitizeYears = (input: unknown): string[] => {
  if (!Array.isArray(input)) return ALL_SCHOOL_YEARS;
  const valid = input.filter((y): y is string => typeof y === "string" && ALL_SCHOOL_YEARS.includes(y));
  return valid.length > 0 ? valid : ALL_SCHOOL_YEARS;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    // ---- bootstrap: cria o admin inicial apenas se ainda não existir nenhum admin
    if (action === "bootstrap") {
      const { count } = await admin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) > 0) return json({ ok: true, message: "admin já existe" });

      const { data, error } = await admin.auth.admin.createUser({
        email: emailFor("admin"),
        password: "2l2tr4n",
        email_confirm: true,
        user_metadata: { username: "admin", role: "admin" },
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("user_roles").upsert(
        { user_id: data.user!.id, role: "admin" },
        { onConflict: "user_id,role" },
      );
      return json({ ok: true, message: "admin criado" });
    }

    // ---- demais ações exigem um admin autenticado
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);

    const { data: isAdmin } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

    if (action === "list") {
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("id, username, turma, allowed_school_years, created_at")
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const users = (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? "aluno",
      }));
      return json({ users });
    }

    if (action === "create") {
      const body = await req.json().catch(() => ({}));
      const username = normalize(String(body?.username ?? ""));
      const password = String(body?.password ?? "");
      const role = body?.role === "admin" ? "admin" : "aluno";
      const turma = String(body?.turma ?? "").trim().slice(0, 60) || null;
      // Admin sempre tem acesso a tudo; pra aluno, usa os blocos escolhidos (ou todos, se nada vier).
      const allowedSchoolYears = role === "admin" ? ALL_SCHOOL_YEARS : sanitizeYears(body?.allowedSchoolYears);

      if (username.length < 3) return json({ error: "Usuário inválido (mínimo 3 caracteres)" }, 400);
      if (password.length < 6) return json({ error: "Senha deve ter ao menos 6 caracteres" }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email: emailFor(username),
        password,
        email_confirm: true,
        user_metadata: { username, role, turma },
      });
      if (error) return json({ error: error.message }, 400);

      await admin.from("profiles").upsert({
        id: data.user!.id,
        username,
        turma,
        allowed_school_years: allowedSchoolYears,
      });
      await admin
        .from("user_roles")
        .upsert({ user_id: data.user!.id, role }, { onConflict: "user_id,role" });

      return json({ ok: true, user: { id: data.user!.id, username, role, turma, allowedSchoolYears } });
    }

    if (action === "update") {
      const body = await req.json().catch(() => ({}));
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id obrigatório" }, 400);
      const allowedSchoolYears = sanitizeYears(body?.allowedSchoolYears);

      const { error } = await admin
        .from("profiles")
        .update({ allowed_school_years: allowedSchoolYears })
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);

      return json({ ok: true, allowedSchoolYears });
    }

    if (action === "delete") {
      const body = await req.json().catch(() => ({}));
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id obrigatório" }, 400);
      if (id === userData.user.id) return json({ error: "Não é possível excluir a própria conta" }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
