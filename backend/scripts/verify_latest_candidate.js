const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
  const latestCandidate = await prisma.candidate.findFirst({
    orderBy: { created_at: 'desc' },
    include: { skills: { include: { skill: true } } }
  });
  console.log(JSON.stringify(latestCandidate, null, 2));
}

checkDb()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
