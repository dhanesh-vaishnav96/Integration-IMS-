require('dotenv').config();
const { prisma } = require('../src/config/prisma');

async function main() {
  const subs = await prisma.graphSubscription.findMany({});
  console.log('Subscriptions:', JSON.stringify(subs, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
