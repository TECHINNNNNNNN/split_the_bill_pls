import { Pool } from "@neondatabase/serverless"

// Dedicated pool for the AI text-to-SQL tool. Each query runs inside a
// transaction that:
//   1. SET LOCAL ROLE ai_readonly  → strips write privileges
//   2. SET LOCAL statement_timeout → caps runaway queries at 3 seconds
//   3. SET LOCAL app.user_id       → drives the WHERE clause inside views
//
// The LLM never sees a connection that can write or escape its user scope.

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

export interface ReadOnlyResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

export async function runReadOnlyQuery(
  userId: string,
  sql: string,
): Promise<ReadOnlyResult> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN READ ONLY")
    await client.query("SET LOCAL ROLE ai_readonly")
    await client.query("SET LOCAL statement_timeout = '3s'")
    // set_config is parameterizable; SET LOCAL is not.
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId])

    const result = await client.query(sql)
    await client.query("COMMIT")

    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? result.rows.length,
    }
  } catch (err) {
    try { await client.query("ROLLBACK") } catch { /* ignore */ }
    throw err
  } finally {
    client.release()
  }
}
