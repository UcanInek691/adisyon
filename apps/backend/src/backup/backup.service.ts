import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
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

  /**
   * Yedegi coz + butunluk dogrula + staging dosyasina yaz. Canli SQLite'i surec
   * calisirken yerinde takas etmek kilit/bozulma riski tasidigindan ATOMIK TAKAS
   * yapilmaz; denetci (Electron) yeniden baslatmada staging dosyasini devreye alir.
   */
  async restoreBackup(user: AuthUser, id: string) {
    const backup = await this.prisma.backup.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!backup) throw new NotFoundException('Yedek bulunamadı.');
    if (!existsSync(backup.path)) {
      throw new NotFoundException('Yedek dosyası diskte bulunamadı.');
    }

    const raw = readFileSync(backup.path);
    // Butunluk: kayitli checksum ile karsilastir.
    const checksum = createHash('sha256').update(raw).digest('hex');
    if (backup.checksum && checksum !== backup.checksum) {
      throw new BadRequestException({
        code: 'BACKUP_CORRUPT',
        message: 'Yedek bütünlük doğrulaması başarısız (checksum uyuşmuyor).',
      });
    }

    // Format: IV(12) + AuthTag(16) + sifreli veri
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = createDecipheriv(ALGORITHM, this.getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted: Buffer;
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch {
      throw new BadRequestException({
        code: 'BACKUP_DECRYPT_FAILED',
        message: 'Yedek çözülemedi (şifre anahtarı veya dosya hatalı).',
      });
    }

    const stagePath = join(this.backupDir, `restore_staging_${backup.id}.db`);
    writeFileSync(stagePath, decrypted);
    this.logger.warn(
      `Backup ${backup.id} restore icin hazirlandi: ${stagePath}. Atomik takas yeniden baslatmada yapilir.`,
    );
    return {
      staged: true,
      stagePath,
      message:
        'Yedek çözüldü ve doğrulandı. Uygulanması için yeniden başlatma gerekir (atomik takas denetleyici tarafından yapılır).',
    };
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
