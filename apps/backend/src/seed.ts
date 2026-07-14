import './bootstrap-env';
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import { newId, Permission, DEFAULT_ROLE_PERMISSIONS, SystemRole } from '@ado/shared';
import { loadEnv } from './config/env.schema';

/**
 * Baslangic verisi (idempotent). Owner+Waiter rolleri, izinler, ilk Owner ve
 * ornek Waiter, varsayilan tenant/branch. Tekrar calistirmak guvenli.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const prisma = new PrismaClient();

  try {
    // --- Tenant + varsayilan Branch ---
    let branch = await prisma.branch.findFirst({ where: { isDefault: true, deletedAt: null } });
    if (!branch) {
      const tenant = await prisma.tenant.create({
        data: { id: newId(), name: 'Varsayilan Isletme' },
      });
      branch = await prisma.branch.create({
        data: { id: newId(), tenantId: tenant.id, name: 'Merkez', isDefault: true },
      });
      console.log(`Tenant + Branch olusturuldu (${branch.id}).`);
    }
    const branchId = branch.id;

    // --- Izinler (key'e gore upsert) ---
    const permKeyToId = new Map<string, string>();
    for (const key of Object.values(Permission)) {
      const perm = await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { id: newId(), key },
      });
      permKeyToId.set(key, perm.id);
    }
    console.log(`Izinler hazir (${permKeyToId.size}).`);

    // --- Sistem rolleri ---
    const ensureRole = async (name: string, description: string): Promise<string> => {
      const existing = await prisma.role.findFirst({
        where: { name, isSystem: true, deletedAt: null },
      });
      if (existing) return existing.id;
      const created = await prisma.role.create({
        data: { id: newId(), name, isSystem: true, description },
      });
      return created.id;
    };
    const ownerRoleId = await ensureRole(SystemRole.Owner, 'Isletme sahibi - tam yetki');
    const waiterRoleId = await ensureRole(SystemRole.Waiter, 'Garson - hizli siparis');

    // --- Rol -> izin atamalari ---
    const setRolePerms = async (roleId: string, keys: readonly string[]): Promise<void> => {
      for (const key of keys) {
        const permissionId = permKeyToId.get(key);
        if (!permissionId) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId } },
          update: {},
          create: { id: newId(), roleId, permissionId },
        });
      }
    };
    await setRolePerms(ownerRoleId, DEFAULT_ROLE_PERMISSIONS.owner);
    await setRolePerms(waiterRoleId, DEFAULT_ROLE_PERMISSIONS.waiter);
    console.log('Rol izinleri atandi.');

    // --- Ilk Owner kullanicisi ---
    if (env.SEED_OWNER_PASSWORD) {
      const exists = await prisma.user.findUnique({ where: { username: env.SEED_OWNER_USERNAME } });
      if (!exists) {
        await prisma.user.create({
          data: {
            id: newId(),
            branchId,
            username: env.SEED_OWNER_USERNAME,
            displayName: env.SEED_OWNER_DISPLAY_NAME,
            passwordHash: await argonHash(env.SEED_OWNER_PASSWORD),
            roleId: ownerRoleId,
          },
        });
        console.log(`Owner olusturuldu: ${env.SEED_OWNER_USERNAME}`);
      }
    } else {
      console.warn('SEED_OWNER_PASSWORD yok -> Owner olusturulmadi.');
    }

    // --- Ornek Waiter (PIN) ---
    if (env.SEED_WAITER_PIN) {
      const exists = await prisma.user.findUnique({
        where: { username: env.SEED_WAITER_USERNAME },
      });
      if (!exists) {
        await prisma.user.create({
          data: {
            id: newId(),
            branchId,
            username: env.SEED_WAITER_USERNAME,
            displayName: env.SEED_WAITER_DISPLAY_NAME,
            pinHash: await argonHash(env.SEED_WAITER_PIN),
            roleId: waiterRoleId,
          },
        });
        console.log(`Waiter olusturuldu: ${env.SEED_WAITER_USERNAME}`);
      }
    }

    console.log('Seed tamamlandi.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('Seed hatasi:', err);
  process.exit(1);
});
