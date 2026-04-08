import { parse, astMapper, toSql, type Statement } from "pgsql-ast-parser"

const MAX_ROWS = 1000

export class SqlGuardError extends Error {}

/**
 * Validates and rewrites an LLM-generated SQL query.
 *
 * - Must parse to a SINGLE statement
 * - Statement must be a SELECT (or WITH ... SELECT)
 * - No INSERT/UPDATE/DELETE/DROP/ALTER/GRANT/COPY/TRUNCATE etc.
 * - Enforces LIMIT ≤ MAX_ROWS (clamps if higher, injects if missing)
 *
 * Defense-in-depth — even if this is wrong, the `ai_readonly` Postgres
 * role and READ ONLY transaction would still block writes.
 */
export function guardSql(input: string): string {
  let statements: Statement[]
  try {
    statements = parse(input)
  } catch (err) {
    throw new SqlGuardError(`Could not parse SQL: ${(err as Error).message}`)
  }

  if (statements.length === 0) {
    throw new SqlGuardError("Empty query.")
  }
  if (statements.length > 1) {
    throw new SqlGuardError("Only one statement allowed.")
  }

  const stmt = statements[0]
  if (stmt.type !== "select" && stmt.type !== "with") {
    throw new SqlGuardError(
      `Only SELECT statements are allowed (got: ${stmt.type}).`,
    )
  }

  // Walk the AST and reject any nested DML even inside WITH/CTEs.
  const mapper = astMapper(() => ({
    insert: () => { throw new SqlGuardError("INSERT not allowed.") },
    update: () => { throw new SqlGuardError("UPDATE not allowed.") },
    delete: () => { throw new SqlGuardError("DELETE not allowed.") },
    createTable: () => { throw new SqlGuardError("CREATE not allowed.") },
    alterTable: () => { throw new SqlGuardError("ALTER not allowed.") },
    dropTable: () => { throw new SqlGuardError("DROP not allowed.") },
    truncateTable: () => { throw new SqlGuardError("TRUNCATE not allowed.") },
  }))
  mapper.statement(stmt)

  // Clamp LIMIT. pgsql-ast-parser puts limit on select / with-select.
  const target = stmt.type === "with" ? stmt.in : stmt
  if (target.type === "select") {
    const currentLimit = target.limit?.limit
    const limitValue =
      currentLimit && currentLimit.type === "integer" ? currentLimit.value : null
    if (limitValue == null || limitValue > MAX_ROWS) {
      target.limit = { limit: { type: "integer", value: MAX_ROWS } }
    }
  }

  return toSql.statement(stmt)
}
