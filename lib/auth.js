import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        const isSuperAdmin = user.userRoles.some(ur => ur.role.name === 'superadmin')

        // Default tenant: if currentTenantId is not set, assign the first accessible one
        let tenantId = user.currentTenantId
        if (!tenantId) {
          if (isSuperAdmin) {
            const first = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } })
            tenantId = first?.id ?? null
          } else {
            const firstPivot = await prisma.tenantUser.findFirst({
              where:   { userId: user.id, tenant: { isActive: true } },
              orderBy: { tenantId: 'asc' },
            })
            tenantId = firstPivot?.tenantId ?? null
          }
          if (tenantId) {
            await prisma.user.update({ where: { id: user.id }, data: { currentTenantId: tenantId } })
          }
        }

        const permissions = user.userRoles.flatMap(ur =>
          ur.role.rolePermissions.map(rp => rp.permission.name)
        )
        return {
          id:       user.id,
          name:     user.name,
          email:    user.email,
          tenantId,
          permissions,
          isSuperAdmin,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id           = user.id
        token.tenantId     = user.tenantId
        token.permissions  = user.permissions
        token.isSuperAdmin = user.isSuperAdmin
      }
      // Re-read currentTenantId from DB after a tenant switch (client calls update())
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where:  { id: token.id },
          select: { currentTenantId: true },
        })
        if (fresh) token.tenantId = fresh.currentTenantId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id           = token.id
      session.user.tenantId     = token.tenantId
      session.user.permissions  = token.permissions
      session.user.isSuperAdmin = token.isSuperAdmin
      return session
    },
  },
  pages: { signIn: '/login' },
}
