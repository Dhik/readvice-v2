# Readvice V2 — Prisma Seeder Prompt

## Purpose
This is a self-contained prompt to build the complete `prisma/seed.js` file for the Readvice V2 Next.js project. The seeder populates the Supabase PostgreSQL database with all reference data, roles, permissions, users, and realistic sample data.

---

# BUILD PROMPT: Readvice V2 — Complete Prisma Seed File

## Instructions
Create the file `prisma/seed.js` for the Readvice V2 project (Next.js + Prisma + Supabase). It must be **plain JavaScript** (no TypeScript). Run it with:

```bash
node prisma/seed.js
# or
npx prisma db seed
```

Add to `package.json`:
```json
"prisma": {
  "seed": "node prisma/seed.js"
}
```

Install faker for sample data generation:
```bash
npm install @faker-js/faker --save-dev
```

---

## Seeding Order (must follow this order due to foreign keys)

1. Tenants
2. Roles
3. Permissions
4. Role-Permission assignments
5. Sales Channels (reference data)
6. Social Media platforms (reference data)
7. Marketing Categories + Subcategories
8. Shifts
9. Users (with role assignments)
10. Employees (linked to users)
11. Products (product catalog)
12. KPI definitions
13. KOL Profiles — standalone database (100 generated)
14. Campaigns + Campaign Contents
15. Orders (sample data for current month)
16. Marketing expenses (current month)
17. Ad Spent — Marketplace (current month)
18. Ad Spent — Social Media (current month)
19. Targets (current month per platform)
20. Visit data (full year)

---

## Complete `prisma/seed.js`

```js
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

// Permissions granted per role
const ROLE_PERMISSIONS = {
  superadmin: ALL_PERMISSIONS, // all
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

  // Role-permission assignments
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

  // Branding categories (no parent)
  const branding = ['Artis', 'Mega KOL', 'Mega Random', 'Creative Campaign', 'Brand Ambassador', 'Creative Production']
  for (const name of branding) {
    await prisma.marketingCategory.upsert({
      where: { name },
      update: {},
      create: { name, type: 'Branding', parentId: null },
    })
  }

  // Marketing parent + subcategories
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

  // Core users — match the real system
  const USERS = [
    { email: 'rocky@clerinagroup.com',     name: 'Mohammad Rocky Pramana',  role: 'superadmin',    tenantId: cleoraId },
    { email: 'riska.artika@clerinagroup.com', name: 'Riska Artika Dewi',    role: 'superadmin',    tenantId: cleoraId },
    { email: 'siti.aisyah@clerinagroup.com',  name: 'Siti Aisyah',          role: 'superadmin',    tenantId: cleoraId },
    { email: 'pipit.sulastri@clerinagroup.com', name: 'Pipit Sulastri',     role: 'finance',       tenantId: cleoraId },
    // Brand managers
    { email: 'manager@cleora.test',        name: 'Cleora Brand Manager',    role: 'brand_manager', tenantId: cleoraId },
    { email: 'manager@azrina.test',        name: 'Azrina Brand Manager',    role: 'brand_manager', tenantId: azrinaId },
    // Marketing team
    { email: 'marketing1@cleora.test',     name: 'Marketing Cleora 1',      role: 'marketing',     tenantId: cleoraId },
    { email: 'marketing2@cleora.test',     name: 'Marketing Cleora 2',      role: 'marketing',     tenantId: cleoraId },
    { email: 'marketing@azrina.test',      name: 'Marketing Azrina',        role: 'marketing',     tenantId: azrinaId },
    // HR
    { email: 'hr@cleora.test',             name: 'HR Cleora',               role: 'hr',            tenantId: cleoraId },
    // Finance
    { email: 'finance@cleora.test',        name: 'Finance Cleora',          role: 'finance',       tenantId: cleoraId },
    // Staff
    { email: 'staff1@cleora.test',         name: 'Staff Cleora 1',          role: 'staff',         tenantId: cleoraId },
    { email: 'staff2@cleora.test',         name: 'Staff Cleora 2',          role: 'staff',         tenantId: cleoraId },
    { email: 'staff@azrina.test',          name: 'Staff Azrina',            role: 'staff',         tenantId: azrinaId },
    // Demo superadmin for easy login
    { email: 'admin@readvice.test',        name: 'Demo Admin',              role: 'superadmin',    tenantId: cleoraId },
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
    { name: 'Revenue Total',  type: 'revenue_total',   calculationMethod: 'sum(turnover) from sales',                                    parameters: null },
    { name: 'Ads Spent Meta', type: 'ads_spent_meta',  calculationMethod: 'sum(amount) from ad_spent_social_media',                      parameters: JSON.stringify({ social_media_id: 1 }) },
    { name: 'Ads Spent Shopee', type: 'ads_spent_shopee', calculationMethod: 'sum(amount) from ad_spent_market_places',                  parameters: JSON.stringify({ sales_channel_id: 1 }) },
    { name: 'Ads Spent Tiktok', type: 'ads_spent_tiktok', calculationMethod: 'sum(amount) from ad_spent_market_places',                  parameters: JSON.stringify({ sales_channel_id: 4 }) },
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
// NOTE: Run after seedUsers() — employees are linked to users by email

async function seedEmployees(tenants, users) {
  console.log('Seeding employees...')

  const cleoraId  = tenants.find(t => t.slug === 'cleora-beauty').id
  const azrinaId  = tenants.find(t => t.slug === 'azrina-beauty').id
  const depts     = ['Creative', 'Marketing', 'Finance', 'HR', 'Operations', 'Warehouse', 'BOD']
  const positions = ['Social Media Planner', 'KOL Manager', 'Finance Staff', 'HR Staff', 'Warehouse Staff', 'Customer Service', 'CEO', 'Marketing Staff', 'Admin']
  const statuses  = ['Permanent', 'Contract', 'Internship', 'Probation']
  const banks     = ['BCA', 'BRI', 'BNI', 'Mandiri', 'CIMB Niaga', 'BSI']
  const religions = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha']
  const genders   = ['Male', 'Female']
  const blood     = ['A', 'B', 'AB', 'O']
  const ptkp      = ['TK/0', 'K/0', 'K/1', 'K/2', 'K/3']

  // Seed 30 employees for Cleora, 15 for Azrina
  const EMPLOYEE_DATA = [
    // Cleora core team (real usernames from user seeder)
    { employeeId: 'CLEOAZ001', name: 'Mohammad Rocky Pramana',  email: 'rocky@clerinagroup.com',       position: 'CEO',                   dept: 'BOD',       status: 'Permanent', tenantId: cleoraId },
    { employeeId: 'CLEO001',   name: 'Riska Artika Dewi',        email: 'riska.artika@clerinagroup.com', position: 'Social Media Planner',  dept: 'Creative',  status: 'Contract',  tenantId: cleoraId },
    { employeeId: 'CLEO003',   name: 'Siti Aisyah',              email: 'siti.aisyah@clerinagroup.com',  position: 'KOL Manager',           dept: 'Marketing', status: 'Contract',  tenantId: cleoraId },
    { employeeId: 'CLEO004',   name: 'Pipit Sulastri',           email: 'pipit.sulastri@clerinagroup.com', position: 'Finance Staff',       dept: 'Finance',   status: 'Permanent', tenantId: cleoraId },
  ]

  // Generate additional faker employees
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
    // Try to find a matching user by email
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

  // Realistic beauty product catalog matching the original system
  const PRODUCTS = [
    // Cleora Beauty line
    { name: 'Cleora Brightening Serum 30ml',       sku: 'CLR-SRM-001', category: 'Serum',      price: 159_000, cogs: 45_000 },
    { name: 'Cleora Acne Spot Treatment 15ml',     sku: 'CLR-ACN-001', category: 'Treatment',  price: 89_000,  cogs: 25_000 },
    { name: 'Cleora Moisturizer SPF30 50ml',       sku: 'CLR-MST-001', category: 'Moisturizer',price: 129_000, cogs: 38_000 },
    { name: 'Cleora Facial Wash 100ml',            sku: 'CLR-FW-001',  category: 'Cleanser',   price: 75_000,  cogs: 20_000 },
    { name: 'Cleora Toner Essence 150ml',          sku: 'CLR-TNR-001', category: 'Toner',      price: 99_000,  cogs: 28_000 },
    { name: 'Cleora Eye Cream 15ml',               sku: 'CLR-EYE-001', category: 'Treatment',  price: 189_000, cogs: 55_000 },
    { name: 'Cleora Sunscreen SPF50 50ml',         sku: 'CLR-SUN-001', category: 'Sunscreen',  price: 119_000, cogs: 32_000 },
    { name: 'Cleora Sheet Mask (5pcs)',            sku: 'CLR-MSK-001', category: 'Mask',       price: 65_000,  cogs: 18_000 },
    { name: 'Cleora Starter Kit (3 items)',        sku: 'CLR-KIT-001', category: 'Bundle',     price: 299_000, cogs: 85_000 },
    { name: 'Cleora Complete Skincare Set (5pcs)', sku: 'CLR-SET-001', category: 'Bundle',     price: 499_000, cogs: 140_000 },
    // Azrina Beauty line
    { name: 'Azrina Glow Serum 30ml',              sku: 'AZR-SRM-001', category: 'Serum',      price: 179_000, cogs: 52_000 },
    { name: 'Azrina Anti-Aging Cream 50ml',        sku: 'AZR-CRM-001', category: 'Moisturizer',price: 249_000, cogs: 72_000 },
    { name: 'Azrina Vitamin C Serum 30ml',         sku: 'AZR-VTC-001', category: 'Serum',      price: 199_000, cogs: 58_000 },
    { name: 'Azrina Hydrating Toner 200ml',        sku: 'AZR-TNR-001', category: 'Toner',      price: 119_000, cogs: 33_000 },
    { name: 'Azrina Gentle Cleanser 150ml',        sku: 'AZR-CLN-001', category: 'Cleanser',   price: 89_000,  cogs: 24_000 },
    { name: 'Azrina Sunblock SPF50 PA+++ 60ml',   sku: 'AZR-SUN-001', category: 'Sunscreen',  price: 149_000, cogs: 42_000 },
    { name: 'Azrina Night Repair Serum 30ml',      sku: 'AZR-NGT-001', category: 'Serum',      price: 219_000, cogs: 63_000 },
    { name: 'Azrina Starter Bundle',               sku: 'AZR-KIT-001', category: 'Bundle',     price: 349_000, cogs: 98_000 },
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
        name:         p.name,
        sku:          p.sku,
        category:     p.category,
        price:        p.price,
        hargaCogs:    p.cogs,
        hargaMarkup:  Math.floor(p.price * 1.1),
        hargaBatasBawah: Math.floor(p.cogs * 1.3),
        isActive:     true,
      },
    })
  }
  console.log(`  ✓ ${PRODUCTS.length} products (Cleora + Azrina lines)`)
}

// ─── 10. KEY OPINION LEADERS (standalone profile DB) ─────
// NOTE: This is the KOL contact database, NOT campaign-specific KOLs.
//       Uses the KolProfile model, which is separate from KeyOpinionLeader
//       (campaign-linked). See schema additions below.

async function seedKols(tenants) {
  console.log('Seeding 100 KOL profiles...')

  const channels   = ['Instagram', 'TikTok', 'YouTube', 'Twitter', 'Facebook']
  const skinTypes  = ['oily', 'dry', 'combination', 'normal', 'sensitive']
  const skinConc   = ['acne', 'anti-aging', 'brightening', 'moisturizing', 'pore']
  const contTypes  = ['video', 'photo', 'story', 'reel', 'live']
  const banks      = ['BCA', 'BRI', 'BNI', 'Mandiri', 'CIMB Niaga']
  const tenantIds  = tenants.map(t => t.id)

  const batch = []
  for (let i = 0; i < 100; i++) {
    const hasNpwp = Math.random() > 0.5
    batch.push({
      tenantId:        randFrom(tenantIds),
      name:            faker.person.fullName(),
      username:        faker.internet.userName(),
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

  // Uses KolProfile model (standalone), NOT KeyOpinionLeader (campaign-linked)
  await prisma.kolProfile.createMany({ data: batch, skipDuplicates: true })
  console.log('  ✓ 100 KOL profiles')
}

// ─── 11. CAMPAIGNS + CONTENT ──────────────────────────────

async function seedCampaigns(tenants, users) {
  console.log('Seeding campaigns...')

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const days       = daysInCurrentMonth()
  const cleoraId   = tenants.find(t => t.slug === 'cleora-beauty').id
  const adminUser  = users.find(u => u.email === 'rocky@clerinagroup.com')

  const TYPES = ['creative', 'kol', 'clipper', 'affiliate']
  const PLATFORMS = ['Shopee', 'TikTok', 'Instagram', 'Lazada']

  for (const type of TYPES) {
    const campaign = await prisma.campaign.create({
      data: {
        tenantId:    cleoraId,
        title:       `${type.charAt(0).toUpperCase() + type.slice(1)} Campaign — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
        type,
        platform:    randFrom(PLATFORMS),
        startDate:   monthStart,
        endDate:     monthEnd,
        budget:      randInt(10_000_000, 100_000_000),
        status:      'active',
        description: faker.lorem.sentence(),
        createdById: adminUser?.id ?? null,
      },
    })

    // Add 5 campaign contents per campaign
    for (let c = 0; c < 5; c++) {
      await prisma.campaignContent.create({
        data: {
          campaignId:  campaign.id,
          title:       faker.commerce.productName(),
          platform:    randFrom(PLATFORMS),
          contentUrl:  faker.internet.url(),
          views:       randInt(1_000, 500_000),
          likes:       randInt(100, 50_000),
          comments:    randInt(10, 5_000),
          shares:      randInt(10, 10_000),
          gmv:         randInt(1_000_000, 50_000_000),
        },
      })
    }
  }
  console.log(`  ✓ ${TYPES.length} campaigns with content`)
}

// ─── 10. ORDERS ──────────────────────────────────────────

async function seedOrders(tenants, salesChannels) {
  console.log('Seeding orders for current month...')

  const days     = daysInCurrentMonth()
  const platforms = ['Shopee', 'TikTok', 'Lazada', 'Tokopedia', 'Manual']
  let   total    = 0

  for (const tenant of tenants) {
    for (const platform of platforms) {
      for (const day of days) {
        // Create 5 orders per platform per day per tenant
        const batch = []
        for (let i = 0; i < 5; i++) {
          const qty  = randInt(1, 10)
          const price = randInt(50_000, 500_000)
          batch.push({
            tenantId:     tenant.id,
            platform,
            orderId:      faker.string.alphanumeric(12).toUpperCase(),
            orderDate:    day,
            status:       randFrom(['completed', 'completed', 'completed', 'cancelled', 'pending']),
            gmv:          qty * price,
            nett:         Math.floor(qty * price * 0.85),
            qty,
            skuCount:     randInt(1, 3),
          })
        }
        await prisma.order.createMany({ data: batch, skipDuplicates: true })
        total += batch.length
      }
    }
  }
  console.log(`  ✓ ~${total} orders`)
}

// ─── 11. MARKETING EXPENSES ──────────────────────────────

async function seedMarketing(tenants) {
  console.log('Seeding marketing expenses...')

  const days = daysInCurrentMonth()
  const categories = await prisma.marketingCategory.findMany()
  let   total = 0

  for (const tenant of tenants) {
    for (const cat of categories) {
      for (const day of days) {
        await prisma.marketing.create({
          data: {
            tenantId:           tenant.id,
            date:               day,
            type:               cat.type,
            marketingCategory:  cat.name,
            subCategory:        cat.parentId ? cat.name : null,
            amount:             randInt(1_000_000, 20_000_000),
          },
        })
        total++
      }
    }
  }
  console.log(`  ✓ ${total} marketing expense records`)
}

// ─── 12. AD SPENT MARKETPLACE ────────────────────────────

async function seedAdSpentMarketplace(tenants) {
  console.log('Seeding ad spent — marketplace...')

  const days = daysInCurrentMonth()
  const platforms = [
    { key: 'meta',    model: 'adSpentMeta'    },
    { key: 'shopee',  model: 'adSpentShopee'  },
    { key: 'tiktok',  model: 'adSpentTiktok'  },
    { key: 'lazada',  model: 'adSpentLazada'  },
  ]
  let total = 0

  for (const tenant of tenants) {
    for (const pf of platforms) {
      for (const day of days) {
        const spent      = randInt(1_000_000, 10_000_000)
        const revenue    = Math.floor(spent * (Math.random() * 4 + 2))  // 2x–6x ROAS
        const clicks     = randInt(100, 10_000)
        const impressions = randInt(10_000, 1_000_000)

        const base = {
          tenantId:    tenant.id,
          date:        day,
          spent,
          revenue,
          roas:        parseFloat((revenue / spent).toFixed(4)),
          clicks,
          cpc:         parseFloat((spent / clicks).toFixed(4)),
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

// ─── 13. AD SPENT SOCIAL MEDIA ───────────────────────────

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

// ─── 14. TARGETS ─────────────────────────────────────────

async function seedTargets(tenants) {
  console.log('Seeding targets...')

  const now      = new Date()
  const month    = String(now.getMonth() + 1).padStart(2, '0')
  const year     = now.getFullYear()
  const platforms = ['Shopee', 'TikTok', 'Lazada', 'Tokopedia', 'Manual', 'All']
  let   total    = 0

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

// ─── 15. VISIT DATA (full year) ───────────────────────────

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

  // Ordered seeding — dependencies must come first
  const tenants       = await seedTenants()
  const roles         = await seedRoles()
  await seedPermissions(roles)
  const salesChannels = await seedSalesChannels()
  await seedSocialMedia()
  await seedMarketingCategories()
  await seedShifts()
  const users         = await seedUsers(roles, tenants)
  await seedEmployees(tenants, users)        // after users (links by email)
  await seedProducts(tenants)               // product catalog
  await seedKpis()
  await seedKols(tenants)                   // standalone KOL profile DB
  await seedCampaigns(tenants, users)       // campaigns with content
  await seedOrders(tenants, salesChannels)
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
```

---

## Required Prisma Schema Additions

The seed file above uses several models that must exist in `prisma/schema.prisma`. Add these if not already present:

```prisma
model SalesChannel {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("sales_channels")
}

model SocialMedia {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("social_media")
}

model MarketingCategory {
  id       Int     @id @default(autoincrement())
  name     String  @unique
  type     String  // "Branding" | "Marketing"
  parentId Int?    @map("parent_id")

  parent   MarketingCategory?  @relation("CategoryChildren", fields: [parentId], references: [id])
  children MarketingCategory[] @relation("CategoryChildren")

  @@map("marketing_categories")
}

model Shift {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  startTime String   @map("start_time")
  endTime   String   @map("end_time")

  @@map("shifts")
}

model Marketing {
  id                 Int      @id @default(autoincrement())
  tenantId           Int      @map("tenant_id")
  date               DateTime
  type               String   // "Branding" | "Marketing"
  marketingCategory  String   @map("marketing_category")
  subCategory        String?  @map("sub_category")
  amount             Decimal  @db.Decimal(15, 2)
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  @@index([tenantId, date])
  @@map("marketing")
}

model AdSpentSocialMedia {
  id        Int      @id @default(autoincrement())
  tenantId  Int      @map("tenant_id")
  platform  String
  date      DateTime
  amount    Decimal  @db.Decimal(15, 2)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([tenantId, platform, date])
  @@map("ad_spent_social_media")
}

model Kpi {
  id                Int     @id @default(autoincrement())
  name              String
  type              String  @unique
  calculationMethod String  @map("calculation_method") @db.Text
  parameters        String? @db.Text  // JSON string

  @@map("kpis")
}

model Visit {
  id          Int      @id @default(autoincrement())
  tenantId    Int      @map("tenant_id")
  platform    String
  date        DateTime
  visitAmount Int      @default(0) @map("visit_amount")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([tenantId, platform, date])
  @@map("visits")
}
```

// ── KolProfile (standalone KOL contact database, separate from campaign KOLs)
model KolProfile {
  id               Int      @id @default(autoincrement())
  tenantId         Int      @map("tenant_id")
  name             String
  username         String
  channel          String   // Instagram | TikTok | YouTube | etc.
  niche            String?
  followers        Int?     @default(0)
  averageView      Int?     @default(0) @map("average_view")
  engRate          Decimal? @db.Decimal(5,2) @map("eng_rate")
  skinType         String?  @map("skin_type")
  skinConcern      String?  @map("skin_concern")
  contentType      String?  @map("content_type")
  rate             Decimal? @db.Decimal(15,2)
  cpm              Decimal? @db.Decimal(10,4)
  bankName         String?  @map("bank_name")
  bankAccount      String?  @map("bank_account")
  bankAccountName  String?  @map("bank_account_name")
  npwp             Boolean  @default(false)
  npwpNumber       String?  @map("npwp_number")
  nik              String?
  address          String?  @db.Text
  phoneNumber      String?  @map("phone_number")
  notes            String?  @db.Text
  product          String?
  productDelivery  Boolean  @default(false) @map("product_delivery")
  status           String?  @default("active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@index([tenantId, channel])
  @@map("kol_profiles")
}

// ── Employee (HR records, linked to users)
model Employee {
  id                 Int       @id @default(autoincrement())
  tenantId           Int       @map("tenant_id")
  userId             Int?      @map("user_id")
  employeeId         String    @unique @map("employee_id")
  name               String
  email              String?
  jobPosition        String?   @map("job_position")
  organization       String?   // department
  jobLevel           String?   @map("job_level")
  employmentStatus   String?   @map("employment_status") // Permanent | Contract | Internship | Probation
  birthDate          DateTime? @map("birth_date")
  birthPlace         String?   @map("birth_place")
  gender             String?
  religion           String?
  bloodType          String?   @map("blood_type")
  maritalStatus      String?   @map("marital_status")
  nik                String?
  npwp               String?
  ptkpStatus         String?   @map("ptkp_status")
  bankName           String?   @map("bank_name")
  bankAccount        String?   @map("bank_account")
  bankAccountHolder  String?   @map("bank_account_holder")
  phoneNumber        String?   @map("phone_number")
  address            String?   @db.Text
  joinDate           DateTime? @map("join_date")
  isActive           Boolean   @default(true) @map("is_active")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  user User? @relation(fields: [userId], references: [id])

  @@index([tenantId])
  @@map("employees")
}

// ── Product (updated — add pricing fields to the base schema)
// Replace the Product model in schema.prisma with this version:
model Product {
  id               Int      @id @default(autoincrement())
  tenantId         Int      @map("tenant_id")
  name             String
  sku              String   @unique
  platform         String?
  category         String?
  price            Decimal? @db.Decimal(15,2)          // selling price
  hargaCogs        Decimal? @db.Decimal(15,2) @map("harga_cogs")
  hargaMarkup      Decimal? @db.Decimal(15,2) @map("harga_markup")
  hargaBatasBawah  Decimal? @db.Decimal(15,2) @map("harga_batas_bawah") // floor price
  stock            Int?     @default(0)
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  orderItems OrderItem[]

  @@index([tenantId])
  @@map("products")
}
```

Also add these unique constraints to existing models:
```prisma
// In Target model — needed for upsert in seedTargets()
@@unique([tenantId, platform, year, month], name: "tenantId_platform_year_month")

// In Order model — needed for upsert in seedOrders()
@@unique([orderId, tenantId], name: "orderId_tenantId")

// In User model — add relation to Employee
employees Employee[]
```

---

## Running the Seeder

```bash
# 1. Generate Prisma client (after schema changes)
npx prisma generate

# 2. Apply schema to database
npx prisma migrate dev --name add-reference-tables

# 3. Run seeder
npx prisma db seed

# Or directly
node prisma/seed.js
```

**Expected output:**
```
🌱 Starting Readvice V2 database seeding...

Seeding tenants...
  ✓ 3 tenants
Seeding roles...
  ✓ 6 roles
Seeding permissions...
  ✓ 65 permissions
  ✓ Role-permission assignments done
Seeding sales channels...
  ✓ 6 sales channels
Seeding social media...
  ✓ 5 social media platforms
Seeding marketing categories...
  ✓ Marketing categories done
Seeding shifts...
  ✓ 5 shifts
Seeding users...
  ✓ 15 users (all password: "Password")
  ✓ Demo login → admin@readvice.test / Password
Seeding employees...
  ✓ 45 employees
Seeding products...
  ✓ 18 products (Cleora + Azrina lines)
Seeding KPI definitions...
  ✓ 4 KPIs
Seeding 100 KOL profiles...
  ✓ 100 KOL profiles
Seeding campaigns...
  ✓ 4 campaigns with content
Seeding orders for current month...
  ✓ ~2250 orders
Seeding marketing expenses...
  ✓ ~1260 marketing expense records
Seeding ad spent — marketplace...
  ✓ ~372 ad spend records
Seeding ad spent — social media...
  ✓ ~465 social media ad spend records
Seeding targets...
  ✓ 18 targets
Seeding visit data for full year...
  ✓ ~6570 visit records

✅ Seeding complete!

─────────────────────────────────────────
Demo login credentials:
  Email:    admin@readvice.test
  Password: Password
  Role:     superadmin (all permissions)
  Tenant:   Cleora Beauty
─────────────────────────────────────────
```

---

## All Test Accounts (Password: `Password`)

| Email | Role | Tenant |
|-------|------|--------|
| `admin@readvice.test` | superadmin | Cleora Beauty |
| `rocky@clerinagroup.com` | superadmin | Cleora Beauty |
| `manager@cleora.test` | brand_manager | Cleora Beauty |
| `manager@azrina.test` | brand_manager | Azrina Beauty |
| `marketing1@cleora.test` | marketing | Cleora Beauty |
| `marketing2@cleora.test` | marketing | Cleora Beauty |
| `marketing@azrina.test` | marketing | Azrina Beauty |
| `finance@cleora.test` | finance | Cleora Beauty |
| `hr@cleora.test` | hr | Cleora Beauty |
| `staff1@cleora.test` | staff | Cleora Beauty |
| `staff@azrina.test` | staff | Azrina Beauty |

---

## Seed Data Summary

| Table | Records | Notes |
|-------|---------|-------|
| Tenants | 3 | Cleora Beauty, Azrina Beauty, Delmoura |
| Roles | 6 | superadmin, brand_manager, marketing, finance, hr, staff |
| Permissions | 65 | Full CRUD per domain |
| Role-Permission links | ~160 | Pre-configured per role |
| Sales Channels | 6 | Shopee, Lazada, Tokopedia, TikTok Shop, Manual, Others |
| Social Media | 5 | Facebook, Instagram, TikTok, Google, Snack Video |
| Marketing Categories | 14 | 6 branding + 2 parent + 6 subcategory marketing |
| Shifts | 5 | GU, GU1, OS, HO, dayoff |
| Users | 15 | 4 real + 11 test accounts |
| Employees | 45 | 30 Cleora + 15 Azrina (4 real, rest faker) |
| Products | 18 | 10 Cleora line + 8 Azrina line (real SKUs) |
| KPI Definitions | 4 | Revenue Total + 3 Ad Spend types |
| KOL Profiles | 100 | Standalone contact database (faker) |
| Campaigns | 4 | One per type: creative, kol, clipper, affiliate |
| Campaign Contents | 20 | 5 per campaign |
| Orders | ~2,250 | 5/platform/day × 5 platforms × ~30 days × 3 tenants |
| Marketing Expenses | ~1,260 | 14 categories × ~30 days × 3 tenants |
| Ad Spent Marketplace | ~372 | Meta+Shopee+TikTok+Lazada × ~31 days × 3 tenants |
| Ad Spent Social Media | ~465 | 5 platforms × ~31 days × 3 tenants |
| Targets | 18 | 6 platforms × 3 tenants (current month) |
| Visit Records | ~6,570 | 6 platforms × 365 days × 3 tenants |
| **Total** | **~11,400+** | |
| Ad Spent Social Media | ~465 (5 platforms × ~31 days × 3 tenants) |
| Targets | 18 (6 platforms × 3 tenants) |
| Visit Records | ~6,570 (6 platforms × 365 days × 3 tenants) |
