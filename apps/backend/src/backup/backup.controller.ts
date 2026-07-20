import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { BackupService } from './backup.service';

@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @RequirePermissions(Permission.BackupManage)
  create(@CurrentUser() user: AuthUser) {
    return this.backupService.createBackup(user, 'manual');
  }

  @Get()
  @RequirePermissions(Permission.BackupManage)
  list(@CurrentUser() user: AuthUser) {
    return this.backupService.listBackups(user);
  }

  @Post(':id/restore')
  @RequirePermissions(Permission.BackupManage)
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backupService.restoreBackup(user, id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.BackupManage)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backupService.deleteBackup(user, id);
  }
}
