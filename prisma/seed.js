const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { faker } = require('@faker-js/faker')

const prisma = new PrismaClient()

// ─── Helpers ────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function daysInCurrentMonth() {
  const now = new Date()
  const days = []
  const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= total; d++) {
    days.push(new Date(now.getFullYear(), now.getMonth(), d))
  }
  return days
}

function daysInYear() {
  const year = new Date().getFullYear()
  const days = []
  for (let m = 0; m < 12; m++) {
    const total = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= total; d++) {
      days.push(new Date(year, m, d))
    }
  }
  return days
}

// ─── 1. TENANTS ─────────────────────────────────────────

async function seedTenants() {
  console.log('Seeding tenants...')
  const tenants = await Promise.all([
    prisma.tenant.upsert({
      where: { slug: 'cleora-beauty' },
      update: {},
      create: { name: 'Cleora Beauty', slug: 'cleora-beauty', isActive: true },
    }),
    prisma.tenant.upsert({
      where: { slug: 'azrina-beauty' },
      update: {},
      create: { name: 'Azrina Beauty', slug: 'azrina-beauty', isActive: true },
    }),
    prisma.tenant.upsert({
      where: { slug: 'delmoura' },
      update: {},
      create: { name: 'Delmoura', slug: 'delmoura', isActive: true },
    }),
  ])
  console.log(`  ✓ ${tenants.length} tenants`)
  return tenants
}

// ─── 2. ROLES ────────────────────────────────────────────

async function seedRoles() {
  console.log('Seeding roles...')
  const roleNames = ['superadmin', 'brand_manager', 'marketing', 'finance', 'hr', 'staff']
  const roles = {}
  for (const name of roleNames) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, guardName: 'web' },
    })
  }
  console.log(`  ✓ ${roleNames.length} roles`)
  return roles
}

// ─── 3. PERMISSIONS ──────────────────────────────────────

const ALL_PERMISSIONS = [
  // User
  'create_user', 'update_user', 'view_user', 'delete_user',
  // Marketing category
  'create_marketing_category', 'update_marketing_category', 'view_marketing_category', 'delete_marketing_category',
  // Sales channel
  'create_sales_channel', 'update_sales_channel', 'view_sales_channel', 'delete_sales_channel',
  // Social media
  'create_social_media', 'update_social_media', 'view_social_media', 'delete_social_media',
  // Marketing
  'create_marketing', 'update_marketing', 'view_marketing', 'delete_marketing',
  // Sales
  'create_sales', 'update_sales', 'view_sales', 'delete_sales',
  // Order
  'create_order', 'update_order', 'view_order', 'delete_order',
  // Ad spent
  'view_ad_spent_market_place', 'create_ad_spent_market_place',
  'view_ad_spent_social_media', 'create_ad_spent_social_media',
  // Visit
  'view_visit', 'create_visit',
  // Profile
  'view_profile', 'change_own_password',
  // Tenant
  'view_tenant', 'create_tenant', 'update_tenant', 'delete_tenant', 'assign_tenant_user',
  // Funnel
  'view_funnel', 'create_funnel', 'delete_funnel',
  // Customer
  'view_customer', 'create_customer_note', 'update_customer_note', 'delete_customer_note',
  // Campaign
  'view_campaign', 'create_campaign', 'update_campaign', 'delete_campaign',
  // Campaign content
  'view_campaign_content', 'create_campaign_content', 'update_campaign_content', 'delete_campaign_content',
  // Offer
  'view_offer', 'create_offer', 'update_offer', 'delete_offer', 'review_offer',
  'approve_reject_offer', 'finance_offer',
  // KOL / Influencer
  'view_influencer_campaign', 'create_influencer_campaign', 'update_influencer_campaign', 'delete_influencer_campaign',
  'view_kol', 'create_kol', 'update_kol', 'delete_kol',
  // Contest
  'view_contest', 'create_contest', 'update_contest', 'delete_contest',
  // Employee
  'view_employee', 'update_employee',
  // Attendance
  'view_attendance', 'update_attendance', 'delete_attendance', 'access_attendance',
  // Keyword
  'access_keyword',
  // BCG
  'view_bcg_metrics',
  // Report
  'view_report',
  // Talent
  'view_talent', 'create_talent', 'update_talent', 'delete_talent',
]

const ROLE_PERMISSIONS = {
  superadmin: ALL_PERMISSIONS,
  brand_manager: [
    'create_user','update_user','view_user','delete_user',
    'view_marketing_category','view_sales_channel','view_social_media',
    'create_marketing','update_marketing','view_marketing','delete_marketing',
    'create_sales','update_sales','view_sales','delete_sales',
    'create_order','update_order','view_order','delete_order',
    'view_ad_spent_market_place','create_ad_spent_market_place',
    'view_ad_spent_social_media','create_ad_spent_social_media',
    'view_visit','create_visit',
    'view_profile','change_own_password',
    'view_funnel','create_funnel','delete_funnel',
    'view_customer','create_customer_note','update_customer_note','delete_customer_note',
    'view_campaign','create_campaign','update_campaign','delete_campaign',
    'view_campaign_content','create_campaign_content','update_campaign_content','delete_campaign_content',
    'view_offer','create_offer','update_offer','delete_offer','review_offer','approve_reject_offer',
    'view_influencer_campaign','create_influencer_campaign','update_influencer_campaign','delete_influencer_campaign',
    'view_kol','create_kol','update_kol','delete_kol',
    'view_contest','create_contest','update_contest','delete_contest',
    'access_attendance','view_bcg_metrics','view_report',
    'view_talent','create_talent','update_talent','delete_talent',
  ],
  marketing: [
    'view_marketing_category',
    'create_marketing','update_marketing','view_marketing','delete_marketing',
    'create_sales','update_sales','view_sales','delete_sales',
    'create_order','update_order','view_order','delete_order',
    'view_ad_spent_market_place','create_ad_spent_market_place',
    'view_ad_spent_social_media','create_ad_spent_social_media',
    'view_visit','create_visit',
    'view_profile','change_own_password',
    'view_funnel','create_funnel','delete_funnel',
    'view_customer','create_customer_note',
    'view_campaign','create_campaign','update_campaign','delete_campaign',
    'view_campaign_content','create_campaign_content','update_campaign_content','delete_campaign_content',
    'view_offer','create_offer','update_offer','review_offer',
    'view_influencer_campaign','create_influencer_campaign','update_influencer_campaign','delete_influencer_campaign',
    'view_kol','create_kol','update_kol','delete_kol',
    'view_contest','create_contest','update_contest','delete_contest',
    'access_attendance','access_keyword','view_bcg_metrics','view_report',
    'view_talent','create_talent','update_talent',
  ],
  finance: [
    'view_profile','change_own_password',
    'view_offer','finance_offer',
    'view_campaign','update_campaign',
    'view_campaign_content','update_campaign_content',
    'access_attendance',
  ],
  hr: [
    'create_user','update_user','view_user',
    'view_profile','change_own_password',
    'view_employee','update_employee',
    'view_attendance','update_attendance','delete_attendance','access_attendance',
  ],
  staff: [
    'view_profile','change_own_password',
    'access_attendance',
  ],
}

async function seedPermissions(roles) {
  console.log('Seeding permissions...')
  const perms = {}
  for (const name of ALL_PERMISSIONS) {
    perms[name] = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, guardName: 'web' },
    })
  }
  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions`)

  console.log('Assigning permissions to roles...')
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roles[roleName]
    if (!role) continue
    for (const permName of permNames) {
      const perm = perms[permName]
      if (!perm) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }
  console.log('  ✓ Role-permission assignments done')
  return perms
}

// ─── 4. REFERENCE DATA ───────────────────────────────────

async function seedSalesChannels() {
  console.log('Seeding sales channels...')
  const channels = ['Shopee', 'Lazada', 'Tokopedia', 'Tiktok Shop', 'Manual', 'Others']
  const result = []
  for (const name of channels) {
    result.push(await prisma.salesChannel.upsert({
      where: { name },
      update: {},
      create: { name },
    }))
  }
  console.log(`  ✓ ${result.length} sales channels`)
  return result
}

async function seedSocialMedia() {
  console.log('Seeding social media...')
  const platforms = ['Facebook', 'Snack Video', 'Instagram', 'Tiktok', 'Google']
  const result = []
  for (const name of platforms) {
    result.push(await prisma.socialMedia.upsert({
      where: { name },
      update: {},
      create: { name },
    }))
  }
  console.log(`  ✓ ${result.length} social media platforms`)
  return result
}

async function seedMarketingCategories() {
  console.log('Seeding marketing categories...')

  const branding = ['Artis', 'Mega KOL', 'Mega Random', 'Creative Campaign', 'Brand Ambassador', 'Creative Production']
  for (const name of branding) {
    await prisma.marketingCategory.upsert({
      where: { name },
      update: {},
      create: { name, type: 'Branding', parentId: null },
    })
  }

  const marketingParents = {
    'Media Online': ['Portal Media', 'Buzzer', 'Paid Promote'],
    'KOL':          ['KOL Beauty', 'Skin Expert', 'KOL Random'],
  }
  for (const [parentName, children] of Object.entries(marketingParents)) {
    const parent = await prisma.marketingCategory.upsert({
      where: { name: parentName },
      update: {},
      create: { name: parentName, type: 'Marketing', parentId: null },
    })
    for (const childName of children) {
      await prisma.marketingCategory.upsert({
        where: { name: childName },
        update: {},
        create: { name: childName, type: 'Marketing', parentId: parent.id },
      })
    }
  }
  console.log('  ✓ Marketing categories done')
}

// ─── 5. SHIFTS ────────────────────────────────────────────

async function seedShifts() {
  console.log('Seeding shifts...')
  const shifts = [
    { name: 'GU',     startTime: '08:00', endTime: '16:00' },
    { name: 'GU1',    startTime: '09:00', endTime: '17:00' },
    { name: 'OS',     startTime: '08:00', endTime: '12:00' },
    { name: 'HO',     startTime: '08:00', endTime: '16:30' },
    { name: 'dayoff', startTime: '00:00', endTime: '00:00' },
  ]
  const result = []
  for (const s of shifts) {
    result.push(await prisma.shift.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    }))
  }
  console.log(`  ✓ ${result.length} shifts`)
  return result
}

// ─── 6. USERS ────────────────────────────────────────────

async function seedUsers(roles, tenants) {
  console.log('Seeding users...')
  const password = await bcrypt.hash('Password', 10)
  const cleoraId = tenants.find(t => t.slug === 'cleora-beauty').id
  const azrinaId = tenants.find(t => t.slug === 'azrina-beauty').id

  const USERS = [
    { email: 'rocky@clerinagroup.com',       name: 'Mohammad Rocky Pramana',  role: 'superadmin',    tenantId: cleoraId },
    { email: 'riska.artika@clerinagroup.com', name: 'Riska Artika Dewi',       role: 'superadmin',    tenantId: cleoraId },
    { email: 'siti.aisyah@clerinagroup.com',  name: 'Siti Aisyah',             role: 'superadmin',    tenantId: cleoraId },
    { email: 'pipit.sulastri@clerinagroup.com', name: 'Pipit Sulastri',        role: 'finance',       tenantId: cleoraId },
    { email: 'manager@cleora.test',           name: 'Cleora Brand Manager',    role: 'brand_manager', tenantId: cleoraId },
    { email: 'manager@azrina.test',           name: 'Azrina Brand Manager',    role: 'brand_manager', tenantId: azrinaId },
    { email: 'marketing1@cleora.test',        name: 'Marketing Cleora 1',      role: 'marketing',     tenantId: cleoraId },
    { email: 'marketing2@cleora.test',        name: 'Marketing Cleora 2',      role: 'marketing',     tenantId: cleoraId },
    { email: 'marketing@azrina.test',         name: 'Marketing Azrina',        role: 'marketing',     tenantId: azrinaId },
    { email: 'hr@cleora.test',                name: 'HR Cleora',               role: 'hr',            tenantId: cleoraId },
    { email: 'finance@cleora.test',           name: 'Finance Cleora',          role: 'finance',       tenantId: cleoraId },
    { email: 'staff1@cleora.test',            name: 'Staff Cleora 1',          role: 'staff',         tenantId: cleoraId },
    { email: 'staff2@cleora.test',            name: 'Staff Cleora 2',          role: 'staff',         tenantId: cleoraId },
    { email: 'staff@azrina.test',             name: 'Staff Azrina',            role: 'staff',         tenantId: azrinaId },
    { email: 'admin@readvice.test',           name: 'Demo Admin',              role: 'superadmin',    tenantId: cleoraId },
  ]

  const created = []
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name:            u.name,
        email:           u.email,
        password,
        currentTenantId: u.tenantId,
        isActive:        true,
      },
    })
    const role = roles[u.role]
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      })
    }
    created.push(user)
  }

  console.log(`  ✓ ${created.length} users (all password: "Password")`)
  console.log('  ✓ Demo login → admin@readvice.test / Password')
  return created
}

// ─── 7. KPIs ─────────────────────────────────────────────

async function seedKpis() {
  console.log('Seeding KPI definitions...')
  const kpis = [
    { name: 'Revenue Total',    type: 'revenue_total',   calculationMethod: 'sum(turnover) from sales',                               parameters: null },
    { name: 'Ads Spent Meta',   type: 'ads_spent_meta',  calculationMethod: 'sum(amount) from ad_spent_social_media',                 parameters: JSON.stringify({ social_media_id: 1 }) },
    { name: 'Ads Spent Shopee', type: 'ads_spent_shopee', calculationMethod: 'sum(amount) from ad_spent_market_places',               parameters: JSON.stringify({ sales_channel_id: 1 }) },
    { name: 'Ads Spent Tiktok', type: 'ads_spent_tiktok', calculationMethod: 'sum(amount) from ad_spent_market_places',               parameters: JSON.stringify({ sales_channel_id: 4 }) },
  ]
  for (const kpi of kpis) {
    await prisma.kpi.upsert({
      where: { type: kpi.type },
      update: {},
      create: kpi,
    })
  }
  console.log(`  ✓ ${kpis.length} KPIs`)
}

// ─── 8. EMPLOYEES ────────────────────────────────────────

async function seedEmployees(tenants, users) {
  console.log('Seeding employees...')

  const cleoraId  = tenants.find(t => t.slug === 'cleora-beauty').id
  const azrinaId  = tenants.find(t => t.slug === 'azrina-beauty').id
  const positions = ['Social Media Planner', 'KOL Manager', 'Finance Staff', 'HR Staff', 'Warehouse Staff', 'Customer Service', 'CEO', 'Marketing Staff', 'Admin']
  const depts     = ['Creative', 'Marketing', 'Finance', 'HR', 'Operations', 'Warehouse', 'BOD']
  const statuses  = ['Permanent', 'Contract', 'Internship', 'Probation']
  const banks     = ['BCA', 'BRI', 'BNI', 'Mandiri', 'CIMB Niaga', 'BSI']
  const religions = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha']
  const genders   = ['Male', 'Female']
  const blood     = ['A', 'B', 'AB', 'O']
  const ptkp      = ['TK/0', 'K/0', 'K/1', 'K/2', 'K/3']

  const EMPLOYEE_DATA = [
    { employeeId: 'CLEOAZ001', name: 'Mohammad Rocky Pramana',  email: 'rocky@clerinagroup.com',        position: 'CEO',                  dept: 'BOD',       status: 'Permanent', tenantId: cleoraId },
    { employeeId: 'CLEO001',   name: 'Riska Artika Dewi',        email: 'riska.artika@clerinagroup.com', position: 'Social Media Planner', dept: 'Creative',  status: 'Contract',  tenantId: cleoraId },
    { employeeId: 'CLEO003',   name: 'Siti Aisyah',              email: 'siti.aisyah@clerinagroup.com',  position: 'KOL Manager',          dept: 'Marketing', status: 'Contract',  tenantId: cleoraId },
    { employeeId: 'CLEO004',   name: 'Pipit Sulastri',           email: 'pipit.sulastri@clerinagroup.com', position: 'Finance Staff',      dept: 'Finance',   status: 'Permanent', tenantId: cleoraId },
  ]

  for (let i = 5; i <= 30; i++) {
    EMPLOYEE_DATA.push({
      employeeId: `CLEO${String(i).padStart(3,'0')}`,
      name:       faker.person.fullName(),
      email:      faker.internet.email(),
      position:   randFrom(positions),
      dept:       randFrom(depts),
      status:     randFrom(statuses),
      tenantId:   cleoraId,
    })
  }
  for (let i = 1; i <= 15; i++) {
    EMPLOYEE_DATA.push({
      employeeId: `AZR${String(i).padStart(3,'0')}`,
      name:       faker.person.fullName(),
      email:      faker.internet.email(),
      position:   randFrom(positions),
      dept:       randFrom(depts),
      status:     randFrom(statuses),
      tenantId:   azrinaId,
    })
  }

  for (const emp of EMPLOYEE_DATA) {
    const matchUser = users.find(u => u.email === emp.email)
    await prisma.employee.upsert({
      where:  { employeeId: emp.employeeId },
      update: {},
      create: {
        tenantId:          emp.tenantId,
        userId:            matchUser?.id ?? null,
        employeeId:        emp.employeeId,
        name:              emp.name,
        email:             emp.email,
        jobPosition:       emp.position,
        organization:      emp.dept,
        jobLevel:          randFrom(['Staff', 'Senior Staff', 'Supervisor', 'Manager', 'Director']),
        employmentStatus:  emp.status,
        birthDate:         faker.date.birthdate({ min: 1985, max: 2002, mode: 'year' }),
        birthPlace:        faker.location.city(),
        gender:            randFrom(genders),
        religion:          randFrom(religions),
        bloodType:         randFrom(blood),
        maritalStatus:     randFrom(['Single', 'Married']),
        nik:               faker.string.numeric(16),
        npwp:              faker.string.numeric(15),
        ptkpStatus:        randFrom(ptkp),
        bankName:          randFrom(banks),
        bankAccount:       faker.finance.accountNumber(),
        bankAccountHolder: emp.name,
        phoneNumber:       faker.phone.number(),
        address:           faker.location.streetAddress(),
        joinDate:          faker.date.past({ years: 5 }),
      },
    })
  }
  console.log(`  ✓ ${EMPLOYEE_DATA.length} employees`)
}

// ─── 9. PRODUCTS ─────────────────────────────────────────

async function seedProducts(tenants) {
  console.log('Seeding products...')

  const PRODUCTS = [
    { name: 'Cleora Brightening Serum 30ml',       sku: 'CLR-SRM-001', category: 'Serum',       price: 159_000, cogs: 45_000 },
    { name: 'Cleora Acne Spot Treatment 15ml',     sku: 'CLR-ACN-001', category: 'Treatment',   price: 89_000,  cogs: 25_000 },
    { name: 'Cleora Moisturizer SPF30 50ml',       sku: 'CLR-MST-001', category: 'Moisturizer', price: 129_000, cogs: 38_000 },
    { name: 'Cleora Facial Wash 100ml',            sku: 'CLR-FW-001',  category: 'Cleanser',    price: 75_000,  cogs: 20_000 },
    { name: 'Cleora Toner Essence 150ml',          sku: 'CLR-TNR-001', category: 'Toner',       price: 99_000,  cogs: 28_000 },
    { name: 'Cleora Eye Cream 15ml',               sku: 'CLR-EYE-001', category: 'Treatment',   price: 189_000, cogs: 55_000 },
    { name: 'Cleora Sunscreen SPF50 50ml',         sku: 'CLR-SUN-001', category: 'Sunscreen',   price: 119_000, cogs: 32_000 },
    { name: 'Cleora Sheet Mask (5pcs)',            sku: 'CLR-MSK-001', category: 'Mask',        price: 65_000,  cogs: 18_000 },
    { name: 'Cleora Starter Kit (3 items)',        sku: 'CLR-KIT-001', category: 'Bundle',      price: 299_000, cogs: 85_000 },
    { name: 'Cleora Complete Skincare Set (5pcs)', sku: 'CLR-SET-001', category: 'Bundle',      price: 499_000, cogs: 140_000 },
    { name: 'Azrina Glow Serum 30ml',              sku: 'AZR-SRM-001', category: 'Serum',       price: 179_000, cogs: 52_000 },
    { name: 'Azrina Anti-Aging Cream 50ml',        sku: 'AZR-CRM-001', category: 'Moisturizer', price: 249_000, cogs: 72_000 },
    { name: 'Azrina Vitamin C Serum 30ml',         sku: 'AZR-VTC-001', category: 'Serum',       price: 199_000, cogs: 58_000 },
    { name: 'Azrina Hydrating Toner 200ml',        sku: 'AZR-TNR-001', category: 'Toner',       price: 119_000, cogs: 33_000 },
    { name: 'Azrina Gentle Cleanser 150ml',        sku: 'AZR-CLN-001', category: 'Cleanser',    price: 89_000,  cogs: 24_000 },
    { name: 'Azrina Sunblock SPF50 PA+++ 60ml',   sku: 'AZR-SUN-001', category: 'Sunscreen',   price: 149_000, cogs: 42_000 },
    { name: 'Azrina Night Repair Serum 30ml',      sku: 'AZR-NGT-001', category: 'Serum',       price: 219_000, cogs: 63_000 },
    { name: 'Azrina Starter Bundle',               sku: 'AZR-KIT-001', category: 'Bundle',      price: 349_000, cogs: 98_000 },
  ]

  const cleoraId = tenants.find(t => t.slug === 'cleora-beauty').id
  const azrinaId = tenants.find(t => t.slug === 'azrina-beauty').id

  for (const p of PRODUCTS) {
    const tenantId = p.sku.startsWith('AZR') ? azrinaId : cleoraId
    await prisma.product.upsert({
      where:  { sku: p.sku },
      update: {},
      create: {
        tenantId,
        name:            p.name,
        sku:             p.sku,
        category:        p.category,
        price:           p.price,
        hargaCogs:       p.cogs,
        hargaMarkup:     Math.floor(p.price * 1.1),
        hargaBatasBawah: Math.floor(p.cogs * 1.3),
        isActive:        true,
      },
    })
  }
  console.log(`  ✓ ${PRODUCTS.length} products (Cleora + Azrina lines)`)
}

// ─── 10. KOL PROFILES (standalone contact database) ──────

async function seedKols(tenants) {
  console.log('Seeding 100 KOL profiles...')

  const channels  = ['Instagram', 'TikTok', 'YouTube', 'Twitter', 'Facebook']
  const skinTypes = ['oily', 'dry', 'combination', 'normal', 'sensitive']
  const skinConc  = ['acne', 'anti-aging', 'brightening', 'moisturizing', 'pore']
  const contTypes = ['video', 'photo', 'story', 'reel', 'live']
  const banks     = ['BCA', 'BRI', 'BNI', 'Mandiri', 'CIMB Niaga']
  const tenantIds = tenants.map(t => t.id)

  const batch = []
  for (let i = 0; i < 100; i++) {
    const hasNpwp = Math.random() > 0.5
    batch.push({
      tenantId:        randFrom(tenantIds),
      name:            faker.person.fullName(),
      username:        faker.internet.username(),
      channel:         randFrom(channels),
      niche:           faker.commerce.department(),
      followers:       randInt(1_000, 2_000_000),
      averageView:     randInt(1_000, 1_000_000),
      engRate:         parseFloat((Math.random() * 10).toFixed(2)),
      skinType:        randFrom(skinTypes),
      skinConcern:     randFrom(skinConc),
      contentType:     randFrom(contTypes),
      rate:            randInt(500_000, 50_000_000),
      cpm:             parseFloat((Math.random() * 10).toFixed(4)),
      bankName:        randFrom(banks),
      bankAccount:     faker.finance.accountNumber(),
      bankAccountName: faker.person.fullName(),
      npwp:            hasNpwp,
      npwpNumber:      hasNpwp ? faker.string.numeric(15) : null,
      nik:             faker.string.numeric(16),
      address:         faker.location.streetAddress(),
      phoneNumber:     faker.phone.number(),
      notes:           faker.lorem.sentence(),
      product:         faker.commerce.productName(),
      productDelivery: Math.random() > 0.5,
      status:          randFrom(['active', 'inactive', 'pending']),
    })
  }

  await prisma.kolProfile.createMany({ data: batch, skipDuplicates: true })
  console.log('  ✓ 100 KOL profiles')
}

// ─── 11. CAMPAIGNS + CONTENT ──────────────────────────────

async function seedCampaigns(tenants, users) {
  console.log('Seeding campaigns...')

  const now       = new Date()
  const cleoraId  = tenants.find(t => t.slug === 'cleora-beauty').id
  const adminUser = users.find(u => u.email === 'rocky@clerinagroup.com')

  const fmtDate = (d) => {
    const day   = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleString('en-US', { month: 'short' })
    const year  = d.getFullYear()
    return `${day} ${month} ${year}`
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const TYPES    = ['creative', 'kol', 'clipper', 'affiliate']
  const CHANNELS = ['TikTok video', 'TikTok live', 'Instagram feed', 'Instagram story', 'shopee video']
  const PRODUCTS = ['Cleora Brightening Serum', 'Cleora Moisturizer SPF30', 'Cleora Facial Wash', 'Cleora Toner Essence', 'Azrina Glow Serum']
  const PICS     = ['Alni', 'Amel', 'Putri', 'Nova', 'Naufal']
  const TIERS    = ['Nano', 'Micro', 'Macro', 'Mega', 'Celebrity']

  for (const type of TYPES) {
    const views   = randInt(100_000, 5_000_000)
    const likes   = randInt(10_000, 500_000)
    const comments = randInt(1_000, 50_000)
    const expense  = randInt(5_000_000, 50_000_000)
    const gmv      = randInt(50_000_000, 500_000_000)
    const cpm      = views > 0 ? Math.round(expense / (views / 1000)) : 0

    const campaign = await prisma.campaign.create({
      data: {
        tenantId:     cleoraId,
        title:        `${type.charAt(0).toUpperCase() + type.slice(1)} Campaign — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
        type,
        startDate:    fmtDate(monthStart),
        endDate:      fmtDate(monthEnd),
        budget:       randInt(10_000_000, 100_000_000),
        totalExpense: expense,
        view:         views,
        like:         likes,
        comment:      comments,
        gmv:          gmv,
        cpm:          cpm,
        status:       'active',
        createdById:  adminUser?.id ?? null,
      },
    })

    for (let c = 0; c < 5; c++) {
      const cv  = randInt(1_000, 500_000)
      const cl  = randInt(100, 50_000)
      const cc  = randInt(10, 5_000)
      const rc  = randInt(1_000_000, 20_000_000)
      const ccpm = cv > 0 ? Math.round(rc / (cv / 1000)) : 0

      await prisma.campaignContent.create({
        data: {
          campaignId:  campaign.id,
          tenantId:    cleoraId,
          username:    '@' + faker.internet.username().toLowerCase().replace(/[^a-z0-9_.]/g, ''),
          creatorName: faker.person.fullName(),
          pic:         randFrom(PICS),
          taskName:    faker.lorem.words(3),
          rateCard:    rc,
          channel:     randFrom(CHANNELS),
          link:        faker.internet.url(),
          product:     randFrom(PRODUCTS),
          view:        cv,
          like:        cl,
          comment:     cc,
          gmv:         randInt(1_000_000, 50_000_000),
          cpm:         ccpm,
          kolFollowers: randInt(10_000, 2_000_000),
          tiering:     randFrom(TIERS),
          isFyp:       Math.random() > 0.5,
          isDelivered: Math.random() > 0.3,
          isPaid:      Math.random() > 0.4,
          uploadDate:  faker.date.recent({ days: 30 }),
        },
      })
    }
  }
  console.log(`  ✓ ${TYPES.length} campaigns with content`)
}

// ─── 12. ORDERS ──────────────────────────────────────────

async function seedOrders(tenants) {
  console.log('Seeding orders for current month...')

  const days      = daysInCurrentMonth()
  const platforms = ['Shopee', 'TikTok', 'Lazada', 'Tokopedia', 'Manual']
  let   total     = 0

  for (const tenant of tenants) {
    for (const platform of platforms) {
      for (const day of days) {
        const batch = []
        for (let i = 0; i < 5; i++) {
          const qty   = randInt(1, 10)
          const price = randInt(50_000, 500_000)
          batch.push({
            tenantId:  tenant.id,
            platform,
            orderId:   faker.string.alphanumeric(12).toUpperCase(),
            orderDate: day,
            status:    randFrom(['completed', 'completed', 'completed', 'cancelled', 'pending']),
            gmv:       qty * price,
            nett:      Math.floor(qty * price * 0.85),
            qty,
            skuCount:  randInt(1, 3),
          })
        }
        await prisma.order.createMany({ data: batch, skipDuplicates: true })
        total += batch.length
      }
    }
  }
  console.log(`  ✓ ~${total} orders`)
}

// ─── 13. MARKETING EXPENSES ──────────────────────────────

async function seedMarketing(tenants) {
  console.log('Seeding marketing expenses...')

  const days       = daysInCurrentMonth()
  const categories = await prisma.marketingCategory.findMany()
  let   total      = 0

  for (const tenant of tenants) {
    for (const cat of categories) {
      for (const day of days) {
        await prisma.marketing.create({
          data: {
            tenantId:          tenant.id,
            date:              day,
            type:              cat.type,
            marketingCategory: cat.name,
            subCategory:       cat.parentId ? cat.name : null,
            amount:            randInt(1_000_000, 20_000_000),
          },
        })
        total++
      }
    }
  }
  console.log(`  ✓ ${total} marketing expense records`)
}

// ─── 14. AD SPENT MARKETPLACE ────────────────────────────

async function seedAdSpentMarketplace(tenants) {
  console.log('Seeding ad spent — marketplace...')

  const days = daysInCurrentMonth()
  const platforms = [
    { key: 'meta',   model: 'adSpentMeta'   },
    { key: 'shopee', model: 'adSpentShopee' },
    { key: 'tiktok', model: 'adSpentTiktok' },
    { key: 'lazada', model: 'adSpentLazada' },
  ]
  let total = 0

  for (const tenant of tenants) {
    for (const pf of platforms) {
      for (const day of days) {
        const spent       = randInt(1_000_000, 10_000_000)
        const revenue     = Math.floor(spent * (Math.random() * 4 + 2))
        const clicks      = randInt(100, 10_000)
        const impressions = randInt(10_000, 1_000_000)

        const base = {
          tenantId: tenant.id,
          date:     day,
          spent,
          revenue,
          roas:     parseFloat((revenue / spent).toFixed(4)),
          clicks,
          cpc:      parseFloat((spent / clicks).toFixed(4)),
        }

        if (pf.key === 'meta' || pf.key === 'tiktok') {
          await prisma[pf.model].create({
            data: { ...base, impressions, conversions: randInt(10, 500), ctr: parseFloat((clicks / impressions).toFixed(6)) },
          })
        } else if (pf.key === 'shopee') {
          await prisma.adSpentShopee.create({
            data: { ...base, impressions, orders: randInt(10, 200), ctr: parseFloat((clicks / impressions).toFixed(6)), adType: randFrom(['keyword', 'discovery', 'shop']) },
          })
        } else {
          await prisma.adSpentLazada.create({
            data: { tenantId: base.tenantId, date: day, spent, clicks, orders: randInt(5, 100), revenue, roas: base.roas, cpc: base.cpc },
          })
        }
        total++
      }
    }
  }
  console.log(`  ✓ ${total} ad spend records`)
}

// ─── 15. AD SPENT SOCIAL MEDIA ───────────────────────────

async function seedAdSpentSocialMedia(tenants) {
  console.log('Seeding ad spent — social media...')

  const days      = daysInCurrentMonth()
  const platforms = ['Facebook', 'Instagram', 'Tiktok', 'Google', 'Snack Video']
  let   total     = 0

  for (const tenant of tenants) {
    for (const platform of platforms) {
      for (const day of days) {
        await prisma.adSpentSocialMedia.create({
          data: {
            tenantId: tenant.id,
            platform,
            date:     day,
            amount:   randInt(500_000, 5_000_000),
          },
        })
        total++
      }
    }
  }
  console.log(`  ✓ ${total} social media ad spend records`)
}

// ─── 16. TARGETS ─────────────────────────────────────────

async function seedTargets(tenants) {
  console.log('Seeding targets...')

  const now       = new Date()
  const month     = String(now.getMonth() + 1).padStart(2, '0')
  const year      = now.getFullYear()
  const platforms = ['Shopee', 'TikTok', 'Lazada', 'Tokopedia', 'Manual', 'All']
  let   total     = 0

  for (const tenant of tenants) {
    for (const platform of platforms) {
      await prisma.target.upsert({
        where: { tenantId_platform_year_month: { tenantId: tenant.id, platform, year, month } },
        update: {},
        create: {
          tenantId:   tenant.id,
          platform,
          month,
          year,
          targetGmv:  randInt(500_000_000, 2_000_000_000),
          targetNett: randInt(400_000_000, 1_600_000_000),
          targetQty:  randInt(5_000, 50_000),
          kpiType:    'gmv',
        },
      })
      total++
    }
  }
  console.log(`  ✓ ${total} targets`)
}

// ─── 17. VISIT DATA (full year) ───────────────────────────

async function seedVisits(tenants) {
  console.log('Seeding visit data for full year...')

  const days      = daysInYear()
  const platforms = ['Shopee', 'TikTok', 'Lazada', 'Tokopedia', 'Manual', 'Others']
  let   total     = 0

  for (const tenant of tenants) {
    for (const platform of platforms) {
      const batch = days.map(day => ({
        tenantId:    tenant.id,
        platform,
        date:        day,
        visitAmount: randInt(1_000, 50_000),
      }))
      await prisma.visit.createMany({ data: batch, skipDuplicates: true })
      total += batch.length
    }
  }
  console.log(`  ✓ ~${total} visit records`)
}

// ─── MAIN ────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Starting Readvice V2 database seeding...\n')

  const tenants       = await seedTenants()
  const roles         = await seedRoles()
  await seedPermissions(roles)
  const salesChannels = await seedSalesChannels()
  await seedSocialMedia()
  await seedMarketingCategories()
  await seedShifts()
  const users         = await seedUsers(roles, tenants)
  await seedEmployees(tenants, users)
  await seedProducts(tenants)
  await seedKpis()
  await seedKols(tenants)
  await seedCampaigns(tenants, users)
  await seedOrders(tenants)
  await seedMarketing(tenants)
  await seedAdSpentMarketplace(tenants)
  await seedAdSpentSocialMedia(tenants)
  await seedTargets(tenants)
  await seedVisits(tenants)

  console.log('\n✅ Seeding complete!\n')
  console.log('─────────────────────────────────────────')
  console.log('Demo login credentials:')
  console.log('  Email:    admin@readvice.test')
  console.log('  Password: Password')
  console.log('  Role:     superadmin (all permissions)')
  console.log('  Tenant:   Cleora Beauty')
  console.log('─────────────────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
