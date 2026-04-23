import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Rozpoczynam dodawanie danych testowych...');

  // 1. Sprawdzamy, czy mamy już jakąś myjnię, żeby nie dodawać w kółko tego samego
  const existingCarWash = await prisma.carWash.findFirst();

  if (existingCarWash) {
    console.log('⚠️ Dane testowe już istnieją w bazie. Pomijam.');
    return;
  }

  // 2. Tworzymy główną myjnię (z 2 stanowiskami)
  const carWash = await prisma.carWash.create({
    data: {
      slots: 2
    }
  });

  // 3. Dodajemy usługi do tej myjni (zgodnie ze specyfikacją PB)
  await prisma.washService.createMany({
    data: [
      { carWashId: carWash.id, type: 'Mycie Standardowe', price: 30.00, loyaltyPoints: 10 },
      { carWashId: carWash.id, type: 'Mycie z Woskowaniem', price: 50.00, loyaltyPoints: 20 },
      { carWashId: carWash.id, type: 'Mycie Premium + Wosk', price: 70.00, loyaltyPoints: 35 }
    ]
  });

  console.log('✅ Baza danych została pomyślnie zasilona usługami myjni!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd podczas seedowania:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });