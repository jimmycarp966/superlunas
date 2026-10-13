import { readFile, appendFile } from "node:fs/promises";
import { evaluatePolicy, isOwner, matchesFiles, POLICY_CHECK, requiredWorkflows, SHA } from "./policy.mjs";

const config = JSON.parse(await readFile(new URL("./config.json", import.meta.url), "utf8"));
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;
if (!repo?.startsWith(`${config.owner}/`) || !token) throw new Error("Repositorio o autenticación no válidos.");
const root = `/repos/${repo}`;

async function api(path, method = "GET", body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub ${method} ${path.split("?")[0]}: HTTP ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}

async function pages(path, key) {
  const result = [];
  for (let page = 1; page <= 30; page++) {
    const response = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const items = key ? response[key] : response;
    if (!Array.isArray(items)) throw new Error("Respuesta incompleta de GitHub.");
    result.push(...items);
    if (items.length < 100) return result;
  }
  throw new Error("Se excedió el límite seguro de paginación; hace falta revisión manual.");
}

async function summarize(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
}

async function policyCheck(pr, result, title) {
  const summary = result.reasons.length ? result.reasons.map(reason => `- ${reason}`).join("\n") : "Autoría, revisión, SQL y controles verificados para este commit.";
  const existing = await pages(`${root}/commits/${pr.head.sha}/check-runs?check_name=${encodeURIComponent(POLICY_CHECK)}&filter=latest`, "check_runs");
  const own = existing.find(check => check.app?.slug === "github-actions" && check.external_id === `auto-merge:${pr.number}`);
  const body = { name: POLICY_CHECK, status: "completed", conclusion: result.allowed ? "success" : "action_required",
    completed_at: new Date().toISOString(), output: { title, summary },
    details_url: `https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` };
  if (own) await api(`${root}/check-runs/${own.id}`, "PATCH", body);
  else await api(`${root}/check-runs`, "POST", { ...body, head_sha: pr.head.sha, external_id: `auto-merge:${pr.number}` });
}

async function snapshot(number, releaseOnly = false) {
  const pr = await api(`${root}/pulls/${number}`);
  const [files, reviews, comments, workflows, statuses, headChecks] = await Promise.all([
    pages(`${root}/pulls/${number}/files`), pages(`${root}/pulls/${number}/reviews`), pages(`${root}/issues/${number}/comments`),
    pages(`${root}/actions/runs?head_sha=${pr.head.sha}`, "workflow_runs"),
    pages(`${root}/commits/${pr.head.sha}/statuses`), pages(`${root}/commits/${pr.head.sha}/check-runs?filter=latest`, "check_runs"),
  ]);
  // PR checks may be attached to GitHub's synthetic merge commit.
  let mergeChecks = [];
  if (pr.merge_commit_sha && pr.merge_commit_sha !== pr.head.sha && !pr.merged) {
    const [checks, mergeStatuses] = await Promise.all([
      pages(`${root}/commits/${pr.merge_commit_sha}/check-runs?filter=latest`, "check_runs"),
      pages(`${root}/commits/${pr.merge_commit_sha}/statuses`),
    ]);
    mergeChecks = checks;
    // A successful status on the synthetic merge must not stand in for a
    // required status missing on the PR head. Failures on either block merge.
    statuses.push(...mergeStatuses.map(status => ({ ...status, context: `merge: ${status.context}` })));
  }
  for (const required of requiredWorkflows(config, files)) {
    const run = workflows.filter(run => run.path?.split("@")[0] === `.github/workflows/${required.file}` && run.event === "pull_request")
      .sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];
    if (run && required.job) run.jobs = await pages(`${root}/actions/runs/${run.id}/jobs?filter=latest`, "jobs");
  }
  const input = { pr, files, reviews, comments, workflows, statuses, checks: [...headChecks, ...mergeChecks], config, releaseOnly };
  return { ...input, result: evaluatePolicy(input) };
}

async function release(pr, files, mergeSha) {
  if (!SHA.test(mergeSha)) throw new Error("No se obtuvo el commit de merge.");
  for (const workflow of config.postMergeWorkflows) {
    if (!matchesFiles(files, workflow.paths)) continue;
    const approved = files.filter(file => /^supabase\/migrations\/\d{14}_[^/]+\.sql$/.test(file.filename) && file.status !== "removed")
      .map(file => file.filename);
    await api(`${root}/actions/workflows/${workflow.file}/dispatches`, "POST", {
      ref: config.defaultBranch,
      inputs: { modo: "apply", merge_sha: mergeSha, auto_merge_pr: String(pr.number), approved_migrations: JSON.stringify(approved) },
    });
    await summarize(`PR #${pr.number}: ${workflow.file} despachado para ${mergeSha}. Su resultado se verifica en Actions.`);
  }
}

async function processPr(number, releaseOnly = false) {
  let state = await snapshot(number, releaseOnly);
  if (releaseOnly) {
    if (!state.pr.merged || !isOwner(event.sender, config)) throw new Error("La recuperación de publicación requiere un PR integrado y a Daniel como solicitante.");
    if (!state.result.allowed) throw new Error(`No se puede recuperar la publicación: ${state.result.reasons.join(" ")}`);
    await release(state.pr, state.files, state.pr.merge_commit_sha);
    return;
  }
  if (state.pr.state !== "open" || state.pr.draft) return;
  if (!state.result.allowed) {
    await policyCheck(state.pr, state.result, "Esperando controles o aprobación");
    await summarize(`PR #${number}: ${state.result.reasons.join(" ")}`);
    return;
  }
  const firstHead = state.pr.head.sha;
  const firstBase = state.pr.base.sha;
  // Re-read authorizations and checks immediately before the conditional merge.
  state = await snapshot(number);
  if (!state.result.allowed || state.pr.head.sha !== firstHead || state.pr.base.sha !== firstBase) {
    await summarize(`PR #${number}: cambió el estado durante la verificación; se evaluará de nuevo en el próximo evento.`);
    return;
  }
  await policyCheck(state.pr, state.result, "Controles y aprobaciones completos");
  const result = await api(`${root}/pulls/${number}/merge`, "PUT", { sha: firstHead, merge_method: "merge" });
  if (!result.merged) throw new Error(`GitHub no confirmó el merge del PR #${number}.`);
  await summarize(`PR #${number} integrado automáticamente en ${config.defaultBranch}: ${result.sha}.`);
  try {
    await release(state.pr, state.files, result.sha);
  } catch (error) {
    await summarize(`El PR #${number} ya está integrado, pero falta despachar su publicación. Ejecutar este workflow con pull_request_number=${number} y release_only=true. No volver a mergear.`);
    throw error;
  }
}

if (process.env.AUTO_MERGE_PAUSED === "true") {
  await summarize("Merge automático pausado mediante la variable AUTO_MERGE_PAUSED.");
} else {
  let numbers = [];
  const eventName = process.env.GITHUB_EVENT_NAME;
  const manual = eventName === "workflow_dispatch";
  if (manual) {
    if (!isOwner(event.sender, config)) throw new Error("Solo Daniel puede ejecutar manualmente esta automatización.");
    const number = Number(event.inputs?.pull_request_number);
    if (Number.isSafeInteger(number) && number > 0) numbers = [number];
    else if (event.inputs?.release_only === "true") throw new Error("La recuperación requiere el número de PR.");
  } else if (eventName === "issue_comment") {
    if (event.issue?.pull_request && isOwner(event.comment?.user, config) && /^\/(aprobar|revocar)-sql [a-f0-9]{40}$/.test(event.comment?.body?.trim() ?? "")) numbers = [event.issue.number];
    else process.exit(0);
  } else if (event.pull_request) numbers = [event.pull_request.number];
  if (!manual || !numbers.length) {
    const open = await pages(`${root}/pulls?state=open&base=${encodeURIComponent(config.defaultBranch)}`);
    // GitHub keeps only one pending job in a concurrency group. Evaluate every
    // open PR so that a newer event cannot strand a different ready PR.
    numbers = [...new Set([...numbers, ...open.filter(pr => !pr.draft).map(pr => pr.number)])];
  }
  if (numbers.length > 30) throw new Error("Hay demasiados PR para una evaluación automática; ejecutar por número.");
  for (const number of numbers) await processPr(number, manual && event.inputs?.release_only === "true");
  if (!numbers.length) await summarize("No hay PR correspondientes a este evento.");
}
