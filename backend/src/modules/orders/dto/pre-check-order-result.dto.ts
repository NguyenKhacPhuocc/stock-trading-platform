/** Kết quả pre-check — chỉ trả ticket để gắn với create-order. */
export type PreCheckOrderResult = {
  requestId: string;
  transactionId: string;
  tokenId: string;
};
