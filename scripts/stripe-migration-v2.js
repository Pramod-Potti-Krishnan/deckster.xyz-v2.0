const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('🚀 Starting Stripe migration...\n')

    // Step 1: Add Stripe fields to auth_users
    console.log('Step 1: Adding Stripe fields to auth_users table...')
    await prisma.$executeRaw`
      ALTER TABLE auth_users
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMP(3)
    `
    console.log('✅ Stripe fields added to auth_users\n')

    // Step 2: Add unique constraints
    console.log('Step 2: Adding unique constraints...')
    try {
      await prisma.$executeRaw`
        ALTER TABLE auth_users
        ADD CONSTRAINT auth_users_stripe_customer_id_key UNIQUE (stripe_customer_id)
      `
    } catch (e) {
      if (!e.message.includes('already exists')) throw e
      console.log('  (stripe_customer_id constraint already exists)')
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE auth_users
        ADD CONSTRAINT auth_users_stripe_subscription_id_key UNIQUE (stripe_subscription_id)
      `
    } catch (e) {
      if (!e.message.includes('already exists')) throw e
      console.log('  (stripe_subscription_id constraint already exists)')
    }
    console.log('✅ Unique constraints added\n')

    // Step 3: Create subscriptions table
    console.log('Step 3: Creating subscriptions table...')
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        stripe_subscription_id TEXT UNIQUE NOT NULL,
        stripe_customer_id TEXT NOT NULL,
        stripe_price_id TEXT NOT NULL,
        stripe_product_id TEXT NOT NULL,
        status TEXT NOT NULL,
        tier TEXT NOT NULL,
        billing_cycle TEXT NOT NULL,
        current_period_start TIMESTAMP(3) NOT NULL,
        current_period_end TIMESTAMP(3) NOT NULL,
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
        canceled_at TIMESTAMP(3),
        trial_start TIMESTAMP(3),
        trial_end TIMESTAMP(3),
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log('✅ Subscriptions table created\n')

    // Step 4: Create subscription indexes
    console.log('Step 4: Creating subscription indexes...')
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id)`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON subscriptions(stripe_customer_id)`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status)`
    console.log('✅ Subscription indexes created\n')

    // Step 5: Create payments table
    console.log('Step 5: Creating payments table...')
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_invoice_id TEXT UNIQUE NOT NULL,
        stripe_payment_intent_id TEXT UNIQUE,
        stripe_subscription_id TEXT,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'usd',
        status TEXT NOT NULL,
        invoice_url TEXT,
        invoice_pdf TEXT,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    console.log('✅ Payments table created\n')

    // Step 6: Create payment indexes
    console.log('Step 6: Creating payment indexes...')
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id)`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status)`
    console.log('✅ Payment indexes created\n')

    console.log('🎉 Stripe migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
