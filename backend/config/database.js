import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

// Choose DB client: 'mysql' | 'mariadb' | 'postgres'
const DB_CLIENT = (process.env.DB_CLIENT || 'mysql').toLowerCase();

// Shared config
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || (DB_CLIENT === 'postgres' ? '5432' : '3306')),
  user: process.env.DB_USER || (DB_CLIENT === 'postgres' ? 'postgres' : 'root'),
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || (DB_CLIENT === 'postgres' ? 'postgres' : 'assets'),
};

// MySQL/MariaDB pool (default)
let mysqlPool = null;
// Postgres pool
let pgPool = null;

if (DB_CLIENT === 'postgres') {
  pgPool = new Pool({
    host: baseConfig.host,
    port: baseConfig.port,
    user: baseConfig.user,
    password: baseConfig.password,
    database: baseConfig.database,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000,
    ssl: process.env.DB_SSL?.toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  const dbConfig = {
    host: baseConfig.host,
    port: baseConfig.port,
    user: baseConfig.user,
    password: baseConfig.password,
    database: baseConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    charset: 'utf8mb4',
    // Fix for Windows MariaDB authentication issues
    authPlugins: {
      mysql_clear_password: () => () => Buffer.from((baseConfig.password || '') + '\0')
    }
  };
  mysqlPool = mysql.createPool(dbConfig);
}

// Convert MySQL-style '?' placeholders to Postgres-style '$1, $2, ...'
function toPostgresParams(sql, params) {
  if (!params || params.length === 0) return { text: sql, values: [] };
  let index = 0;
  const text = sql.replace(/\?/g, () => `$$${++index}`) // temporary $$n to avoid escaping
                  .replace(/\$\$(\d+)/g, (_, n) => `$${n}`);
  return { text, values: params };
}

// Append RETURNING id for INSERTs when missing, to emulate insertId
function ensureReturningId(sql) {
  const isInsert = /^\s*insert\s+into\s+/i.test(sql);
  const hasReturning = /\breturning\b/i.test(sql);
  return isInsert && !hasReturning ? `${sql} RETURNING id` : sql;
}

// Test database connection
export const testConnection = async () => {
  try {
    if (DB_CLIENT === 'postgres') {
      const client = await pgPool.connect();
      await client.query('SELECT 1');
      client.release();
    } else {
      const connection = await mysqlPool.getConnection();
      await connection.query('SELECT 1');
      connection.release();
    }
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Execute query with error handling (compatible shape for both clients)
export const executeQuery = async (query, params = []) => {
  try {
    if (DB_CLIENT === 'postgres') {
      // Emulate mysql insertId by appending RETURNING id when needed
      const sqlWithReturning = ensureReturningId(query);
      const { text, values } = toPostgresParams(sqlWithReturning, params);
      const result = await pgPool.query(text, values);

      // SELECT/UPDATE/DELETE return rows in result.rows
      // INSERT with RETURNING id returns rows[0].id; emulate mysql's insertId
      if (/^\s*insert\s+/i.test(query)) {
        const insertId = result.rows?.[0]?.id;
        return { success: true, data: { insertId, rows: result.rows } };
      }
      return { success: true, data: result.rows };
    }

    const [results] = await mysqlPool.execute(query, params);
    return { success: true, data: results };
  } catch (error) {
    console.error('Database query error:', error);
    return { success: false, error: error.message };
  }
};

// Execute transaction
export const executeTransaction = async (queries) => {
  if (DB_CLIENT === 'postgres') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const { query, params } of queries) {
        const sqlWithReturning = ensureReturningId(query);
        const { text, values } = toPostgresParams(sqlWithReturning, params);
        const res = await client.query(text, values);
        if (/^\s*insert\s+/i.test(query)) {
          const insertId = res.rows?.[0]?.id;
          results.push({ insertId, rows: res.rows });
        } else {
          results.push(res.rows);
        }
      }
      await client.query('COMMIT');
      return { success: true, data: results };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    await connection.commit();
    return { success: true, data: results };
  } catch (error) {
    await connection.rollback();
    console.error('Transaction error:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

// Close all connections
export const closeConnections = async () => {
  try {
    if (DB_CLIENT === 'postgres') {
      await pgPool.end();
    } else {
      await mysqlPool.end();
    }
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
};

export default DB_CLIENT === 'postgres' ? pgPool : mysqlPool;

