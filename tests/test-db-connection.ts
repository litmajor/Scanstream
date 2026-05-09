#!/usr/bin/env node
/**
 * Quick database connection test
 * Run: npx tsx test-db-connection.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Query result:', result);
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
