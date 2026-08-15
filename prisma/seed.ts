import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL || "admin@4dental.app";
  const password = process.env.ADMIN_SEED_PASSWORD || "ChangeMe!4Dental2026";
  const name = process.env.ADMIN_SEED_NAME || "4Dental Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log(`Seeded admin: ${admin.email} (must change password on first login)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
