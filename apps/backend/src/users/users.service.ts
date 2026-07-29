import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { newId, SystemRole } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { CreateUserDto, UpdateUserDto } from './dto/users.schemas';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.user.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { role: true },
      orderBy: { username: 'asc' },
    });
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role.name,
      isActive: u.isActive,
    }));
  }

  // PIN girisi kullanici adi SORMAZ (loginPin ilk eslesen hash'i alir) -> ayni
  // PIN iki kiside olursa yanlis kisi adina giris olur. Atama aninda engelle.
  // ponytail: argon dogrulama O(kullanici sayisi); kucuk isletme kadrosunda sorun degil.
  private async assertPinUnique(pin: string, excludeUserId?: string): Promise<void> {
    const others = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        pinHash: { not: null },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { pinHash: true },
    });
    for (const o of others) {
      if (o.pinHash && (await argonVerify(o.pinHash, pin))) {
        throw new ConflictException({
          code: 'PIN_TAKEN',
          message: 'Bu PIN başka bir kullanıcıda kayıtlı; farklı bir PIN seçin.',
        });
      }
    }
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    const roleName = dto.role === 'owner' ? SystemRole.Owner : SystemRole.Waiter;
    const role = await this.prisma.role.findFirst({
      where: { name: roleName, isSystem: true, deletedAt: null },
    });
    if (!role) throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Rol bulunamadı.' });

    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) {
      throw new ConflictException({
        code: 'USERNAME_TAKEN',
        message: 'Bu kullanıcı adı zaten kullanılıyor.',
      });
    }

    if (dto.pin) await this.assertPinUnique(dto.pin);

    const created = await this.prisma.user.create({
      data: {
        id: newId(),
        branchId: user.branchId,
        username: dto.username,
        displayName: dto.displayName,
        roleId: role.id,
        passwordHash: dto.password ? await argonHash(dto.password) : null,
        pinHash: dto.pin ? await argonHash(dto.pin) : null,
      },
    });
    return { id: created.id };
  }

  async update(user: AuthUser, id: string, dto: UpdateUserDto) {
    const target = await this.findTarget(user, id);

    if (dto.isActive === false) {
      if (target.id === user.userId) {
        throw new ForbiddenException({
          code: 'SELF_DEACTIVATE',
          message: 'Kendi hesabınızı pasifleştiremezsiniz.',
        });
      }
      await this.assertNotLastActiveOwner(user.branchId, target.id, target.roleId);
    }

    if (dto.pin) await this.assertPinUnique(dto.pin, target.id);

    const passwordHash = dto.password ? await argonHash(dto.password) : undefined;
    const pinHash = dto.pin ? await argonHash(dto.pin) : undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
          ...(passwordHash ? { passwordHash } : {}),
          ...(pinHash ? { pinHash } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      if (passwordHash || pinHash || dto.isActive === false) {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
    return { ok: true };
  }

  async remove(user: AuthUser, id: string) {
    const target = await this.findTarget(user, id);
    if (target.id === user.userId) {
      throw new ForbiddenException({
        code: 'SELF_DELETE',
        message: 'Kendi hesabınızı silemezsiniz.',
      });
    }
    await this.assertNotLastActiveOwner(user.branchId, target.id, target.roleId);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }

  private async findTarget(user: AuthUser, id: string) {
    const target = await this.prisma.user.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' });
    }
    return target;
  }

  /** Hedef son aktif owner ise engelle (sistem kilitlenmesin). */
  private async assertNotLastActiveOwner(branchId: string, targetId: string, targetRoleId: string) {
    const ownerRole = await this.prisma.role.findFirst({
      where: { name: SystemRole.Owner, isSystem: true, deletedAt: null },
    });
    if (!ownerRole || targetRoleId !== ownerRole.id) return;
    const otherOwners = await this.prisma.user.count({
      where: {
        roleId: ownerRole.id,
        branchId,
        isActive: true,
        deletedAt: null,
        id: { not: targetId },
      },
    });
    if (otherOwners === 0) {
      throw new ForbiddenException({
        code: 'LAST_OWNER',
        message: 'Son aktif yönetici silinemez/pasifleştirilemez.',
      });
    }
  }
}
