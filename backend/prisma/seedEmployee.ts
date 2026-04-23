import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Rozpoczynam dodawanie kont pracowniczych...');

  // Sprawdzamy, czy szef już istnieje
  const existingOwner = await prisma.owner.findUnique({ where: { login: 'szef' } });
  
  if (existingOwner) {
    console.log('⚠️ Konta testowe już istnieją. Pomijam.');
    return;
  }

  // Szyfrujemy uniwersalne hasło dla testowych kont
  const hashedPassword = await bcrypt.hash('zaq1@WSX', 10);

  // 1. Tworzymy Szefa
  const owner = await prisma.owner.create({
    data: {
      firstName: 'Kamil',
      lastName: 'Kowal',
      login: 'szef',
      password: hashedPassword
    }
  });

  // 2. Tworzymy Pracownika przypisanego do Szefa
  await prisma.employee.create({
    data: {
      ownerId: owner.id,
      firstName: 'Witold',
      lastName: 'Tacikiewicz',
      role: 'Obsługa myjni',
      login: 'pracownik1',
      password: hashedPassword,
      email: 'WitoldTacikiewicz@gmail.com',
      phone: '111222333'
    }
  });

  console.log('✅ Szef i Pracownik zostali pomyślnie dodani do bazy!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd podczas seedowania pracownika:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });