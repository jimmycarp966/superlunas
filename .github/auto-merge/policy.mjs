// Pure policy: never executes code or SQL supplied by a pull request.
export const POLICY_CHECK = "Política de merge";
export const SHA = /^[a-f0-9]{40}$/;

export function isOwner(user, config) {
  return user?.id === config.ownerId && user?.login?.toLowerCase() === config.owner.toLowerCase();
}

export function matchesPath(path, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**/", "\u0000").replaceAll("**", "\u0001")
    .replaceAll("*", "[^/]*").replaceAll("?", "[^/]")
    .replaceAll("\u0000", "(?:.*/)?").replaceAll("\u0001", ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

export function matchesFiles(files, patterns = ["**"]) {
  return files.some(file => [file.filename, file.previous_filename].filter(Boolean).some(path => {
    let matched = false;
    for (const pattern of patterns) {
      if (matchesPath(path, pattern.startsWith("!") ? pattern.slice(1) : pattern)) matched = !pattern.startsWith("!");
    }
    return matched;
  }));
}

export function sqlFiles(files) {
  // A SQL file can call a function or build SQL dynamically. Treat every SQL or
  // migration change as requiring explicit approval instead of guessing safety.
  return files.filter(file => [file.filename, file.previous_filename].filter(Boolean)
    .some(path => /\.(sql|psql)$/i.test(path) || /(^|\/)(migrations?|seeds?)\//i.test(path)));
}

export function ownerCommand(comments, command, sha, config) {
  const commands = comments.filter(comment => isOwner(comment.user, config) &&
    comment.created_at && comment.created_at === comment.updated_at &&
    new RegExp(`^/(?:aprobar|revocar)-${command} ${sha}$`).test(comment.body?.trim() ?? ""))
    .sort((a, b) => a.id - b.id);
  return commands.at(-1)?.body?.trim() === `/aprobar-${command} ${sha}`;
}

export function latestOwnerReview(reviews, config) {
  return reviews.filter(review => isOwner(review.user, config) &&
    ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state))
    .sort((a, b) => a.id - b.id).at(-1);
}

export function requiredWorkflows(config, files) {
  return (config.requiredWorkflows ?? []).filter(workflow => matchesFiles(files, workflow.paths));
}

export function evaluatePolicy({ pr, files, reviews, comments, workflows, statuses, checks, config, releaseOnly = false }) {
  const reasons = [];
  if (!config.requiredWorkflows?.length) reasons.push("No se definió ningún control obligatorio; el merge automático queda bloqueado.");
  const head = pr.head?.sha;
  if (!SHA.test(head ?? "")) reasons.push("El commit del PR no es válido.");
  if (pr.base?.ref !== config.defaultBranch) reasons.push("El PR no apunta a la rama principal configurada.");
  if (pr.head?.repo?.full_name !== pr.base?.repo?.full_name) reasons.push("Los PR desde forks requieren integración manual.");
  if (pr.draft) reasons.push("El PR está en borrador.");
  if (!releaseOnly && pr.state !== "open") reasons.push("El PR no está abierto.");
  if (!releaseOnly && pr.mergeable !== true) reasons.push("GitHub todavía no confirmó que se pueda integrar sin conflictos.");
  if (!releaseOnly && ["blocked", "behind", "dirty", "draft"].includes(pr.mergeable_state)) reasons.push("GitHub informa que el PR todavía no está listo para integrar.");
  if (files.length !== pr.changed_files) reasons.push("No se pudo verificar la lista completa de archivos del PR.");

  const review = latestOwnerReview(reviews, config);
  if (review?.state === "CHANGES_REQUESTED") reasons.push("Daniel pidió cambios en su revisión.");
  if (!isOwner(pr.user, config) && !(review?.state === "APPROVED" && review.commit_id === head)) {
    reasons.push("Falta la revisión aprobada de Daniel sobre el commit actual.");
  }
  const sql = sqlFiles(files);
  if (sql.length && !ownerCommand(comments, "sql", head, config)) {
    reasons.push(`Falta la aprobación explícita de SQL de Daniel: /aprobar-sql ${head}`);
  }

  for (const requirement of requiredWorkflows(config, files)) {
    const candidates = workflows.filter(run => run.path?.split("@")[0] === `.github/workflows/${requirement.file}` &&
      run.head_sha === head && run.event === "pull_request");
    const latest = candidates.sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];
    if (!latest || latest.status !== "completed" || latest.conclusion !== "success") {
      reasons.push(`Falta un resultado exitoso de ${requirement.file} para este commit.`);
    } else if (requirement.job && !latest.jobs?.some(job => job.name === requirement.job && job.conclusion === "success")) {
      reasons.push(`El control ${requirement.job} no se ejecutó correctamente.`);
    }
  }

  const latestStatuses = new Map();
  for (const status of [...statuses].sort((a, b) => b.id - a.id)) {
    if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status);
  }
  for (const required of config.requiredStatuses) {
    if (latestStatuses.get(required)?.state !== "success") reasons.push(`Falta el control externo aprobado: ${required}.`);
  }
  for (const [name, status] of latestStatuses) {
    if (status.state !== "success") reasons.push(`El control externo ${name} está ${status.state}.`);
  }

  const latestChecks = new Map();
  for (const check of [...checks].sort((a, b) => b.id - a.id)) {
    if (check.app?.slug === "github-actions" && [POLICY_CHECK, "Evaluar e integrar", "Avisar revisión"].includes(check.name)) continue;
    const key = `${check.head_sha ?? "unknown"}:${check.app?.id ?? "unknown"}:${check.name}`;
    if (!latestChecks.has(key)) latestChecks.set(key, check);
  }
  for (const check of latestChecks.values()) {
    if (check.status !== "completed" || !["success", "neutral", "skipped"].includes(check.conclusion)) {
      reasons.push(`El control ${check.name} todavía no pasó (${check.conclusion ?? check.status}).`);
    }
  }
  return { allowed: reasons.length === 0, reasons: [...new Set(reasons)], sqlFiles: sql.map(file => file.filename) };
}
