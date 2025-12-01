const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Reading SQL migration file...')
    const sqlPath = path.join(__dirname, '..', 'migrations', 'manual_stripe_migration.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    console.log('Executing Stripe migration...')

    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement) {
        console.log(`Executing: ${statement.substring(0, 50)}...`)
        await prisma.$executeRawUnsafe(statement)
      }
    }

    console.log('✅ Stripe migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
