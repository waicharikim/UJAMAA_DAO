import { PrismaClient, GroupRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data to avoid unique constraint conflicts
  await prisma.groupMember.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.user.deleteMany();
  await prisma.constituency.deleteMany();
  await prisma.county.deleteMany();
  await prisma.group.deleteMany();

  const countyData = [
    {
      name: 'Nairobi',
      constituencies: [
        'Westlands',
        'Langata',
        'Kasarani',
        'Ruaraka',
        'Starehe',
        'Dagoretti North',
      ],
    },
    {
      name: 'Kiambu',
      constituencies: [
        'Gatundu South',
        'Githunguri',
        'Thika Town',
        'Limuru',
        'Ruiru',
      ],
    },
    {
      name: 'Mombasa',
      constituencies: [
        'Mvita',
        'Changamwe',
        'Jomvu',
      ],
    },
    {
      name: 'Kisumu',
      constituencies: [
        'Kisumu East',
        'Kisumu West',
        'Seme',
      ],
    },
    // Add other counties and constituencies as needed
  ];

  // Create counties and their constituencies
  for (const county of countyData) {
    await prisma.county.create({
      data: {
        name: county.name,
        constituencies: {
          create: county.constituencies.map((name) => ({ name })),
        },
      },
    });
  }

  console.log('Counties and constituencies seeded.');

  // Seed users
  const usersData = [
    {
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      email: 'user1@example.com',
      name: 'User One',
      constituency: 'Westlands',
      county: 'Nairobi',
      industry: 'Technology',
      goodsServices: ['Web Development', 'Consulting'],
    },
    {
      walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      email: 'user2@example.com',
      name: 'User Two',
      constituency: 'Gatundu South',
      county: 'Kiambu',
      industry: 'Agriculture',
      goodsServices: ['Farming', 'Seed Supply'],
    },
  ];

  for (const user of usersData) {
    await prisma.user.create({
      data: user,
    });
  }

  console.log('Users seeded.');

  // Seed groups
  const groupsData = [
    {
      name: 'Tech Innovators',
      walletAddress: '0xaaaaaa1111111111111111bbbbbbbbbbbbbbbbbbbb',
      constituency: 'Westlands',
      county: 'Nairobi',
      industryFocus: 'Technology',
      productsServices: ['Software Development', 'IT Training'],
    },
    {
      name: 'Farmers United',
      walletAddress: '0xbbbbbb2222222222222222cccccccccccccccccccc',
      constituency: 'Gatundu South',
      county: 'Kiambu',
      industryFocus: 'Agriculture',
      productsServices: ['Crop Support', 'Livestock'],
    },
  ];

  // Create groups and keep references for memberships
  const createdGroups = [];
  for (const group of groupsData) {
    const g = await prisma.group.create({
      data: group,
    });
    createdGroups.push(g);
  }

  console.log('Groups seeded.');

  // Create group memberships (associate first user with first group, etc.)
  const user1 = await prisma.user.findUnique({ where: { email: 'user1@example.com' } });
  const user2 = await prisma.user.findUnique({ where: { email: 'user2@example.com' } });

  if (user1 && user2 && createdGroups.length >= 2) {
    await prisma.groupMember.createMany({
      data: [
        {
          userId: user1.id,
          groupId: createdGroups[0].id,
          role: GroupRole.ADMIN,
          joinedAt: new Date(),
        },
        {
          userId: user2.id,
          groupId: createdGroups[1].id,
          role: GroupRole.MEMBER,
          joinedAt: new Date(),
        },
      ],
    });
  }

  console.log('Group memberships seeded.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });