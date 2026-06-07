const { prismaRead } = require('../src/config/prisma');

async function verifyInterviews() {
  const c = await prismaRead.interview.findFirst({
    orderBy: { created_at: 'desc' },
    include: { candidate: true }
  });
  console.log('--- LATEST INTERVIEW (Soft Deleted check) ---');
  console.log(JSON.stringify(c, null, 2));
}

verifyInterviews()
  .catch(console.error)
  .finally(() => prismaRead.$disconnect());
