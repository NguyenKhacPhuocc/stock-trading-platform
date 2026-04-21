import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { NotificationType } from '../../common/const';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  getUserNotifications(userId: string) {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  markAsRead(userId: string, id: string) {
    return this.notifRepo.update({ id, userId }, { isRead: true });
  }

  markAllAsRead(userId: string) {
    return this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  create(
    userId: string,
    type: NotificationType,
    title: string,
    content: string,
  ) {
    const notif = this.notifRepo.create({ userId, type, title, content });
    return this.notifRepo.save(notif);
  }
}
