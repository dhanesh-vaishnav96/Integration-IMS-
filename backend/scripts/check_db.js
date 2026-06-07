const { prismaRead } = require('../src/config/prisma');

async function check() {
  const c = await prismaRead.candidate.findFirst({
    orderBy: { created_at: 'desc' },
    include: { skills: { include: { skill: true } } }
  });
  console.log(JSON.stringify(c, null, 2));
}

check()
  .catch(console.error)
  .finally(() => prismaRead.$disconnect());
