/** Hành động ghi audit_logs — UC 1 tra cứu */
export const AuditAction = {
  USER_LOGIN: 'USER_LOGIN',
  USER_PROFILE_UPDATE: 'USER_PROFILE_UPDATE',
  USER_PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
  USER_PIN_CHANGE: 'USER_PIN_CHANGE',
} as const;

export type AuditActionCode = (typeof AuditAction)[keyof typeof AuditAction];
