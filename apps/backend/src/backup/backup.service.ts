import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { newId } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = join(process.cwd(), 'prisma', 'backups');

  constructor(private readonly prisma: PrismaService) {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private getEncryptionKey(): Buffer {
    const rawKey = process.env.BACKUP_ENCRYPTION_KEY || 'default-backups-encryption-key-32';
    // Make sure it is exactly 32 bytes (256 bits)
    return createHash('sha256').update(rawKey).digest();
  }

  async createBackup(user: AuthUser, type: 'auto' | 'manual' | 'pre_update'): Promise<any> {
    const backupId = newId();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempFile = join(this.backupDir, `temp_${backupId}.db`);
    const finalFileName = `backup_${timestamp}.db.enc`;
    const finalPath = join(this.backupDir, finalFileName);

    this.logger.log(`Starting backup of database. Temp: ${tempFile}`);

    try {
      // 1. Run VACUUM INTO to create a consistent hot copy of the database
      // SQLite requires the destination file to not exist.
      await this.prisma.$executeRawUnsafe(`VACUUM INTO '${tempFile.replace(/'/g, "''")}'`);

      // 2. Read temp file and encrypt it
      const rawData = readFileSync(tempFile);

      const key = this.getEncryptionKey();
      const iv = randomBytes(12); // GCM requires 12 bytes IV
      const cipher = createCipheriv(ALGORITHM, key, iv);

      const encryptedData = Buffer.concat([cipher.update(rawData), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Write encrypted file: IV (12 bytes) + AuthTag (16 bytes) + EncryptedData
      const finalBuffer = Buffer.concat([iv, authTag, encryptedData]);
      writeFileSync(finalPath, finalBuffer);

      // Clean up temporary unencrypted copy
      unlinkSync(tempFile);

      // 3. Compute checksum of the final encrypted file
      const checksum = createHash('sha256').update(finalBuffer).digest('hex');
      const sizeBytes = statSync(finalPath).size;

      // 4. Create metadata entry in database
      const backup = await this.prisma.backup.create({
        data: {
          id: backupId,
          branchId: user.branchId,
          path: finalPath,
          sizeBytes,
          type,
          encrypted: true,
          checksum,
          createdBy: user.userId,
        },
      });

      this.logger.log(`Backup completed successfully: ${finalFileName} (${sizeBytes} bytes)`);
      return backup;
    } catch (err: any) {
      this.logger.error('Failed to create database backup', err);
      // Clean up temp file if it exists
      if (existsSync(tempFile)) {
        try {
          unlinkSync(tempFile);
        } catch {
          // ignore
        }
      }
      throw new Error(`Backup failed: ${err.message}`);
    }
  }

  async listBackups(user: AuthUser) {
    return this.prisma.backup.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteBackup(user: AuthUser, id: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!backup) throw new NotFoundException('Yedek bulunamadı.');

    // Delete the file on disk
    if (existsSync(backup.path)) {
      try {
        unlinkSync(backup.path);
        this.logger.log(`Deleted backup file from disk: ${backup.path}`);
      } catch (err) {
        this.logger.error(`Failed to delete backup file from disk: ${backup.path}`, err);
      }
    }

    await this.prisma.backup.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return { success: true };
  }
}
