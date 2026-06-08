const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const interviews = await prisma.interview.findMany({
    orderBy: { created_at: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(interviews, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
