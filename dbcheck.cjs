require('./scripts/_load-env');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRaw`SELECT 1`
  .then(() => console.log('DB OK'))
  .catch(e => console.log('still down:', e.message))
  .finally(() => p.$disconnect());