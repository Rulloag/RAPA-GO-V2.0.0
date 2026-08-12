import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const rows = await sql`SELECT email, name, role, status, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC`;
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await sql.end();
}
