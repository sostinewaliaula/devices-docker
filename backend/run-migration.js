import { executeQuery, closeConnections } from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    const migrationFile = process.argv[2];
    if (!migrationFile) {
        console.error('Please specify a migration file, e.g., npm run migrate create_system_settings_table.sql');
        process.exit(1);
    }

    try {
        const migrationPath = path.join(__dirname, 'migrations', migrationFile);
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found: ${migrationPath}`);
        }
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Split by semicolon and filter out empty lines
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`Running ${statements.length} migration statements...`);

        for (const statement of statements) {
            const result = await executeQuery(statement);
            if (!result.success) {
                throw new Error(`Failed to execute statement: ${statement}\nError: ${result.error}`);
            }
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await closeConnections();
    }
}

runMigration();
