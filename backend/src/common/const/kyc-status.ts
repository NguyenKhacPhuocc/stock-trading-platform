export enum KycStatus {
  PENDING = 'pending',
  SIMULATED_VERIFIED = 'simulated_verified',
  REJECTED = 'rejected',
}

export const KYC_STATUS_LABEL_VI: Record<KycStatus, string> = {
  [KycStatus.PENDING]: 'Chưa xác thực',
  [KycStatus.SIMULATED_VERIFIED]: 'Đã xác thực',
  [KycStatus.REJECTED]: 'Từ chối',
};

/** Sau KYC / có CCCD — khóa họ tên và thông tin trên giấy tờ (giống sàn thật). */
export function isIdentityLocked(
  kycStatus: KycStatus,
  nationalIdNumber: string | null | undefined,
): boolean {
  return (
    kycStatus === KycStatus.SIMULATED_VERIFIED ||
    Boolean(nationalIdNumber?.trim())
  );
}
