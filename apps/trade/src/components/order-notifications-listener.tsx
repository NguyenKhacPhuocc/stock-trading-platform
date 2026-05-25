'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks';
import { useTradeRealtimeSocket } from '@/components/trade-realtime-provider';
import { WS_SERVER_EVT } from '@/lib/ws-realtime.constants';
import {
  dispatchNotificationPush,
  dispatchNotificationsRefresh,
  dispatchOrdersFocusList,
  dispatchPortfolioRefresh,
  formatOrderMatchedToast,
  parseWsNotification,
  type OrderMatchedPayload,
} from '@/lib/order-fill-notify';

/** Toast + refresh chuông khi khớp lệnh (mọi trang có WS). */
export function OrderNotificationsListener() {
  const socket = useTradeRealtimeSocket();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const authUserId = useAppSelector((s) => s.auth.user?.id);

  useEffect(() => {
    if (!socket || !authUserId || !isAuthenticated) return;

    const subscribeMe = () => {
      socket.emit('subscribe:me', { userId: authUserId });
    };

    const onOrderMatched = (payload: unknown) => {
      if (payload && typeof payload === 'object') {
        const p = payload as OrderMatchedPayload;
        toast.success(formatOrderMatchedToast(p));
        const notif = parseWsNotification(p.notification);
        if (notif) {
          dispatchNotificationPush(notif);
        } else {
          dispatchNotificationsRefresh();
        }
      }
      dispatchOrdersFocusList();
      dispatchPortfolioRefresh();
    };

    socket.on('connect', subscribeMe);
    socket.on(WS_SERVER_EVT.ORDER_MATCHED, onOrderMatched);
    if (socket.connected) subscribeMe();

    return () => {
      socket.off('connect', subscribeMe);
      socket.off(WS_SERVER_EVT.ORDER_MATCHED, onOrderMatched);
      socket.emit('unsubscribe:me', { userId: authUserId });
    };
  }, [socket, authUserId, isAuthenticated]);

  return null;
}
