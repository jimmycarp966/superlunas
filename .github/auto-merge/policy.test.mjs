import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePolicy,
  isOwner,
  matchesFiles,
  matchesPath,
  ownerCommand,
  requiredWorkflows,
  sqlFiles,
} from "./policy.mjs";

const HEAD = "a".repeat(40);
const OLD_HEAD = "b".repeat(40);
const OWNER = { id: 224327343, login: "jimmycarp966" };
const MILY = { id: 7654321, login: "siriusdevs96" };
const CREATED = "2026-10-13T02:00:00Z";
const UPDATED = "2026-10-13T02:01:00Z";

function fixture() {
  return {
    config: {
      owner: OWNER.login,
      ownerId: OWNER.id,
      defaultBranch: "main",
      requiredWorkflows: [{ file: "controles-merge.yml", job: "Control del proyecto", paths: ["**"] }],
      requiredStatuses: [],
    },
    pr: {
      number: 42,
      state: "open",
      user: { ...OWNER },
      draft: false,
      mergeable: true,
      mergeable_state: "clean",
      changed_files: 1,
      head: { sha: HEAD, repo: { full_name: "jimmycarp966/turilo-erp" } },
      base: { ref: "main", sha: OLD_HEAD, repo: { full_name: "jimmycarp966/turilo-erp" } },
    },
    files: [{ filename: "src/app/page.tsx", status: "modified" }],
    reviews: [],
    comments: [],
    workflows: [{
      id: 100,
      run_attempt: 1,
      path: ".github/workflows/controles-merge.yml",
      head_sha: HEAD,
      event: "pull_request",
      status: "completed",
      conclusion: "success",
      jobs: [{ name: "Control del proyecto", status: "completed", conclusion: "success" }],
    }],
    statuses: [],
    checks: [],
  };
}
function review(state = "APPROVED", commit_id = HEAD, id = 100) {
  return { id, state, commit_id, user: { ...OWNER } };
}
function comment(body = `/aprobar-sql ${HEAD}`, id = 100, overrides = {}) {
  return { id, body, user: { ...OWNER }, created_at: CREATED, updated_at: CREATED, ...overrides };
}
function sqlFixture() {
  const input = fixture();
  input.files = [{ filename: "supabase/migrations/20261013010101_change.sql", status: "added", patch: "+update balances set amount = 0;" }];
  return input;
}
function denied(input, reason) {
  const result = evaluatePolicy(input);
  assert.equal(result.allowed, false, JSON.stringify(result));
  if (reason) assert.ok(result.reasons.some(text => text.includes(reason)), JSON.stringify(result.reasons));
  return result;
}
function allowed(input) {
  const result = evaluatePolicy(input);
  assert.equal(result.allowed, true, result.reasons.join("\n"));
  return result;
}

test("PR propio se integra al pasar el control obligatorio real", () => {
  allowed(fixture());
});
test("la identidad exige ID y login de Daniel, no solo el nombre visible", () => {
  const { config } = fixture();
  assert.equal(isOwner({ ...OWNER, login: OWNER.login.toUpperCase() }, config), true);
  assert.equal(isOwner({ ...OWNER, id: OWNER.id + 1 }, config), false);
  assert.equal(isOwner({ ...OWNER, login: "siriusdevs96" }, config), false);
  assert.equal(isOwner(undefined, config), false);
});
test("PR de Mily requiere revisión de Daniel sobre la cabeza exacta", () => {
  const input = fixture();
  input.pr.user = { ...MILY };
  denied(input, "Falta la revisión");
  input.reviews = [review("APPROVED", OLD_HEAD)];
  denied(input, "Falta la revisión");
  input.reviews = [review()];
  allowed(input);
});
test("aprobación de un impostor o de otra persona no habilita el PR ajeno", () => {
  const input = fixture();
  input.pr.user = { ...MILY };
  input.reviews = [{ ...review(), user: { ...OWNER, id: OWNER.id + 1 } }];
  denied(input, "Falta la revisión");
  input.reviews[0].user = { ...MILY };
  denied(input, "Falta la revisión");
});
test("la decisión más reciente de Daniel bloquea cambios pedidos incluso en PR propio", () => {
  const input = fixture();
  input.reviews = [review("CHANGES_REQUESTED", HEAD, 200), review("APPROVED", HEAD, 100)];
  denied(input, "Daniel pidió cambios");
  input.reviews.push(review("APPROVED", HEAD, 300));
  allowed(input);
});
test("una revisión dismissed invalida la aprobación anterior de Mily", () => {
  const input = fixture();
  input.pr.user = { ...MILY };
  input.reviews = [review(), review("DISMISSED", HEAD, 200)];
  denied(input, "Falta la revisión");
});
test("comentarios de revisión no sustituyen una aprobación ni borran la previa", () => {
  const input = fixture();
  input.pr.user = { ...MILY };
  input.reviews = [review("COMMENTED")];
  denied(input, "Falta la revisión");
  input.reviews = [review(), review("COMMENTED", HEAD, 200)];
  allowed(input);
});
test("una nueva cabeza invalida revisión y resultados de la cabeza anterior", () => {
  const input = fixture();
  input.pr.user = { ...MILY };
  input.reviews = [review()];
  input.pr.head.sha = OLD_HEAD;
  const result = denied(input);
  assert.ok(result.reasons.some(text => text.includes("Falta la revisión")));
  assert.ok(result.reasons.some(text => text.includes("Falta un resultado exitoso")));
});
test("CREATE, DO y archivos SQL sin patch requieren aprobación explícita", () => {
  for (const patch of ["+CREATE TABLE initial (id integer);", "+DO $$ BEGIN EXECUTE 'UPDATE balances SET amount=0'; END $$;", undefined]) {
    const input = sqlFixture();
    input.files[0].patch = patch;
    denied(input, "Falta la aprobación explícita de SQL");
    input.comments = [comment()];
    allowed(input);
  }
});
test("SQL eliminado o renombrado fuera de migrations sigue protegido", () => {
  const input = fixture();
  const variants = [
    { filename: "supabase/migrations/20261013010101_old.sql", status: "removed" },
    { filename: "docs/notes.txt", previous_filename: "supabase/migrations/20261013010101_old.sql", status: "renamed" },
    { filename: "db/repair.PSQL", status: "modified" },
    { filename: "db/migrations/repair.ts", status: "modified" },
    { filename: "seed/data.json", status: "added" },
  ];
  for (const file of variants) {
    input.files = [file];
    denied(input, "Falta la aprobación explícita de SQL");
    assert.equal(sqlFiles([file]).length, 1);
  }
  assert.deepEqual(sqlFiles([{ filename: "docs/migration-guide.md" }]), []);
});
test("aprobar SQL no sustituye revisión de Daniel sobre un PR de Mily", () => {
  const input = sqlFixture();
  input.pr.user = { ...MILY };
  input.comments = [comment()];
  denied(input, "Falta la revisión");
  input.reviews = [review()];
  allowed(input);
});
test("una revisión aprobada no sustituye el comando SQL explícito", () => {
  const input = sqlFixture();
  input.pr.user = { ...MILY };
  input.reviews = [review()];
  denied(input, "Falta la aprobación explícita de SQL");
});
test("comando SQL tiene que referirse al SHA actual completo", () => {
  const input = sqlFixture();
  for (const body of [`/aprobar-sql ${OLD_HEAD}`, `/aprobar-sql ${HEAD.slice(0, 7)}`, `/aprobar-sql ${HEAD}\nY además otra cosa`, `> /aprobar-sql ${HEAD}`, `\`\`\`\n/aprobar-sql ${HEAD}\n\`\`\``]) {
    input.comments = [comment(body)];
    denied(input, "Falta la aprobación explícita de SQL");
  }
});
test("comando de impostor no se acepta aunque copie login de Daniel", () => {
  const input = sqlFixture();
  input.comments = [comment(undefined, 100, { user: { ...OWNER, id: OWNER.id + 1 } })];
  denied(input, "Falta la aprobación explícita de SQL");
});
test("eliminar el comentario de aprobación elimina la autorización", () => {
  const input = sqlFixture();
  input.comments = [comment()];
  allowed(input);
  input.comments = [];
  denied(input, "Falta la aprobación explícita de SQL");
});
test("comentario editado no puede autorizar SQL atribuyéndolo al autor original", () => {
  // Un maintainer puede editar comentarios ajenos sin cambiar comment.user.
  // La autorización debe provenir de un comentario nuevo e inmutable en contenido.
  const input = sqlFixture();
  input.comments = [comment(undefined, 100, { updated_at: UPDATED })];
  denied(input, "Falta la aprobación explícita de SQL");
});
test("revocación más reciente prevalece; aprobación nueva permite reautorizar", () => {
  const input = sqlFixture();
  input.comments = [comment(`/revocar-sql ${HEAD}`, 200), comment()];
  denied(input, "Falta la aprobación explícita de SQL");
  input.comments.push(comment(undefined, 300));
  allowed(input);
});
test("comandos de otro SHA no revocan ni autorizan el actual", () => {
  const { config } = fixture();
  assert.equal(ownerCommand([comment(`/aprobar-sql ${OLD_HEAD}`)], "sql", HEAD, config), false);
  assert.equal(ownerCommand([comment(), comment(`/revocar-sql ${OLD_HEAD}`, 200)], "sql", HEAD, config), true);
});
test("sin resultado del CI requerido no se interpreta ausencia como aprobación", () => {
  const input = fixture();
  input.workflows = [];
  denied(input, "Falta un resultado exitoso");
});
test("workflow correcto con job omitido, skipped o fallido no sirve", () => {
  for (const conclusion of ["skipped", "neutral", "failure", null]) {
    const input = fixture();
    input.workflows[0].jobs[0].conclusion = conclusion;
    denied(input, "no se ejecutó correctamente");
  }
  const input = fixture();
  input.workflows[0].jobs = [];
  denied(input, "no se ejecutó correctamente");
});
test("workflow debe corresponder a ruta, evento PR y SHA exactos", () => {
  for (const override of [
    { path: ".github/workflows/otro.yml", name: "Controles para merge" },
    { head_sha: OLD_HEAD },
    { event: "push" },
    { event: "workflow_dispatch" },
    { event: "pull_request_target" },
  ]) {
    const input = fixture();
    Object.assign(input.workflows[0], override);
    denied(input, "Falta un resultado exitoso");
  }
  const input = fixture();
  input.workflows[0].path += "@refs/pull/42/merge";
  allowed(input);
});
test("un rerun en curso o fallido invalida el éxito anterior del mismo workflow", () => {
  const input = fixture();
  input.workflows.push({ ...input.workflows[0], id: 100, run_attempt: 2, status: "in_progress", conclusion: null });
  denied(input, "Falta un resultado exitoso");
  input.workflows[1] = { ...input.workflows[1], id: 200, status: "completed", conclusion: "failure" };
  denied(input, "Falta un resultado exitoso");
});
test("status externo requerido ausente bloquea aunque el workflow pase", () => {
  const input = fixture();
  input.config.requiredStatuses = ["Vercel"];
  denied(input, "Falta el control externo aprobado: Vercel");
  input.statuses = [{ id: 10, context: "Vercel", state: "success" }];
  allowed(input);
});
test("status opcional pendiente, error o failure también bloquea", () => {
  for (const state of ["pending", "error", "failure"]) {
    const input = fixture();
    input.statuses = [{ id: 10, context: "External QA", state }];
    denied(input, "External QA");
  }
});
test("solo el status más nuevo de un contexto representa su decisión", () => {
  const input = fixture();
  input.statuses = [{ id: 20, context: "Vercel", state: "success" }, { id: 10, context: "Vercel", state: "failure" }];
  allowed(input);
  input.statuses.push({ id: 30, context: "Vercel", state: "pending" });
  denied(input, "Vercel");
});
test("checks fallidos o pendientes de cualquier app bloquean", () => {
  for (const check of [
    { status: "completed", conclusion: "failure" },
    { status: "completed", conclusion: "cancelled" },
    { status: "completed", conclusion: "timed_out" },
    { status: "completed", conclusion: "action_required" },
    { status: "in_progress", conclusion: null },
  ]) {
    const input = fixture();
    input.checks = [{ id: 10, name: "External security", app: { id: 20 }, ...check }];
    denied(input, "External security");
  }
});
test("un check exitoso homónimo de otra app no esconde el fallo real", () => {
  const input = fixture();
  input.checks = [
    { id: 10, name: "External QA", app: { id: 1 }, status: "completed", conclusion: "failure" },
    { id: 20, name: "External QA", app: { id: 2 }, status: "completed", conclusion: "success" },
  ];
  denied(input, "External QA");
});
test("checks opcionales neutral/skipped no sustituyen el job requerido", () => {
  const input = fixture();
  input.checks = [{ id: 10, name: "Unrelated QA", app: { id: 2 }, status: "completed", conclusion: "skipped" }];
  allowed(input);
  input.workflows[0].jobs[0].conclusion = "skipped";
  denied(input, "no se ejecutó correctamente");
});
test("estado borrador, cerrado, conflictivo, atrasado o archivos incompletos bloquean", () => {
  for (const override of [{ draft: true }, { state: "closed" }, { mergeable: null }, { mergeable: false }, { mergeable_state: "behind" }, { changed_files: 2 }]) {
    const input = fixture();
    Object.assign(input.pr, override);
    denied(input);
  }
});
test("PR de fork o apuntando a otra rama queda fuera de auto-merge", () => {
  const input = fixture();
  input.pr.head.repo.full_name = "other/turilo-erp";
  denied(input, "forks");
  const wrongBranch = fixture();
  wrongBranch.pr.base.ref = "release";
  denied(wrongBranch, "rama principal");
});
test("patrones de paths respetan segmentos, cero subdirectorios y puntos literales", () => {
  assert.equal(matchesPath("scripts/test.mjs", "scripts/*.mjs"), true);
  assert.equal(matchesPath("scripts/nested/test.mjs", "scripts/*.mjs"), false);
  assert.equal(matchesPath("a.sql", "**/*.sql"), true);
  assert.equal(matchesPath("db/nested/a.sql", "**/*.sql"), true);
  assert.equal(matchesPath("src/a.ts", "src/**"), true);
  assert.equal(matchesPath("src/aXts", "src/*.ts"), false);
  assert.equal(matchesPath("src/a.ts", "src/?.ts"), true);
  assert.equal(matchesPath("src/ab.ts", "src/?.ts"), false);
});
test("filtros negativos son ordenados y consideran previous_filename", () => {
  assert.equal(matchesFiles([{ filename: "docs/notes.md" }], ["**", "!docs/**"]), false);
  assert.equal(matchesFiles([{ filename: "docs/critical.md" }], ["**", "!docs/**", "docs/critical.md"]), true);
  assert.equal(matchesFiles([{ filename: "archive/a.txt", previous_filename: "src/a.ts" }], ["src/**"]), true);
  assert.equal(matchesFiles([{ filename: "src/a.ts" }], ["!docs/**"]), false);
});
test("control específico se exige solo en sus paths, incluidas renombradas", () => {
  const { config } = fixture();
  config.requiredWorkflows.push({ file: "pos-offline-guardado.yml", paths: ["src/lib/pos-journal.ts", "scripts/pos-journal*.test.mjs"] });
  assert.deepEqual(requiredWorkflows(config, [{ filename: "src/app/page.tsx" }]).map(value => value.file), ["controles-merge.yml"]);
  assert.equal(requiredWorkflows(config, [{ filename: "src/lib/new.ts", previous_filename: "src/lib/pos-journal.ts" }]).length, 2);
  assert.equal(requiredWorkflows(config, [{ filename: "scripts/pos-journal-rollback.test.mjs" }]).length, 2);
});

test("configuración sin controles obligatorios bloquea, aunque no haya fallos visibles", () => {
  const input = fixture();
  input.config.requiredWorkflows = [];
  input.workflows = [];
  denied(input, "No se definió ningún control obligatorio");
});
test("configuración sin propiedad requiredWorkflows falla cerrada sin romper el evaluador", () => {
  const input = fixture();
  delete input.config.requiredWorkflows;
  input.workflows = [];
  denied(input, "No se definió ningún control obligatorio");
});
test("comentario sin timestamps verificables no autoriza SQL", () => {
  const input = sqlFixture();
  input.comments = [comment()];
  delete input.comments[0].created_at;
  delete input.comments[0].updated_at;
  denied(input, "Falta la aprobación explícita de SQL");
});
test("unstable causado por la propia política pendiente no bloquea los controles ya aprobados", () => {
  const input = fixture();
  input.pr.mergeable_state = "unstable";
  input.checks = [
    { id: 10, name: "Política de merge", app: { id: 15368, slug: "github-actions" }, status: "completed", conclusion: "action_required" },
    { id: 11, name: "Evaluar e integrar", app: { id: 15368, slug: "github-actions" }, status: "in_progress", conclusion: null },
  ];
  allowed(input);
});
test("unstable con un fallo externo sigue bloqueado aunque la política previa estuviera verde", () => {
  const input = fixture();
  input.pr.mergeable_state = "unstable";
  input.checks = [
    { id: 10, name: "Política de merge", app: { id: 15368, slug: "github-actions" }, status: "completed", conclusion: "success" },
    { id: 11, name: "Security QA", app: { id: 50 }, status: "completed", conclusion: "failure" },
  ];
  denied(input, "Security QA");
});
test("éxito de cabeza no debe tapar fallo homónimo sobre el merge sintético", () => {
  const input = fixture();
  input.checks = [
    { id: 10, head_sha: OLD_HEAD, name: "Integration QA", app: { id: 50 }, status: "completed", conclusion: "failure" },
    { id: 20, head_sha: HEAD, name: "Integration QA", app: { id: 50 }, status: "completed", conclusion: "success" },
  ];
  denied(input, "Integration QA");
});
test("otra app no puede ocultar su fallo usando el nombre de la política", () => {
  const input = fixture();
  input.checks = [{ id: 10, name: "Política de merge", app: { id: 50, slug: "external-qa" }, status: "completed", conclusion: "failure" }];
  denied(input, "Política de merge");
});
