import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Rozpoczynam dodawanie paliw i programu lojalnościowego...');

  // 1. Dodawanie paliw (zgodnie ze standardowym cennikiem stacji PB)
  const existingFuels = await prisma.fuel.count();
  
  if (existingFuels === 0) {
    await prisma.fuel.createMany({
      data: [
        { type: 'E95', pricePerLiter: 6.00, tankLevel: 5000, maxLevel: 10000 },
        { type: 'E98', pricePerLiter: 6.37, tankLevel: 5000, maxLevel: 10000 },
        { type: 'Diesel', pricePerLiter: 6.83, tankLevel: 5000, maxLevel: 10000 },
        { type: 'LPG', pricePerLiter: 3.93, tankLevel: 2000, maxLevel: 5000 }
      ]
    });
    console.log('✅ Cennik paliw (E95, E98, ON, LPG) został dodany!');
  } else {
    console.log('⚠️ Paliwa już istnieją w bazie. Pomijam.');
  }

  // 2. Dodawanie parametrów programu lojalnościowego
  const existingLoyalty = await prisma.loyaltyProgram.count();
  
  if (existingLoyalty === 0) {
    await prisma.loyaltyProgram.create({
      data: {
        pointsPerE95: 2,
        pointsPerE98: 2,
        pointsPerDiesel: 2,
        pointsPerLpg: 1,
        pointsPerStandardWash: 5,
        pointsPerWaxWash: 10
      }
    });
    console.log('✅ Parametry naliczania punktów lojalnościowych zostały ustawione!');
  } else {
     console.log('⚠️ Program lojalnościowy już istnieje w bazie. Pomijam.');
  }

  console.log('🎉 Baza jest w pełni gotowa na obsługę transakcji i punktów!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd podczas seedowania sprzedaży:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });