import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  getAll(@CurrentUser() user: { id: string }) {
    return this.notifications.getUserNotifications(user.id);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notifications.markAsRead(user.id, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notifications.markAllAsRead(user.id);
  }
}
