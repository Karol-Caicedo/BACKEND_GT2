#!/usr/bin/env node
/* Diagnóstico de solo lectura. No imprime correos, hashes ni contraseñas. */
const path = require('path');
const { Client } = require('pg');

for (const archivo of ['../../.env', '../.env']) {
  require('dotenv').config({ path: path.resolve(__dirname, archivo) });
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();
  try {
    const columna = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'usuarios' AND column_name = 'password_plano'`,
    );
    const plano = columna.rowCount
      ? 'count(*) FILTER (WHERE password_plano IS NOT NULL)::int'
      : '0::int';

    const { rows } = await client.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE password_hash LIKE '$argon2id$%')::int AS argon2id,
        count(*) FILTER (WHERE password_hash LIKE '$2%')::int AS bcrypt_legado,
        count(*) FILTER (WHERE password_hash IS NULL)::int AS sin_password,
        ${plano} AS texto_plano
      FROM usuarios
    `);

    console.log('Estado de hashes de contraseña (solo lectura):');
    console.table(rows[0]);
    console.log('texto_plano debe ser 0. bcrypt_legado baja al habilitar PASSWORD_REHASH_ON_LOGIN=true.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`No se pudo consultar el estado: ${error.message}`);
  process.exitCode = 1;
});
