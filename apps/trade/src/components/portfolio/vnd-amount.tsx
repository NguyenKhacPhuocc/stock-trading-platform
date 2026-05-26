import {
  displayBalanceText,
  formatSignedVnd,
  formatSignedVndUnit,
  formatVnd,
  formatVndUnit,
} from '@/lib/portfolio-format';

export type VndAmountSize = 'hero' | 'md' | 'lg' | 'sm' | 'xs';

const SIZE_CLASS: Record<VndAmountSize, { amount: string; unit: string }> = {
  hero: { amount: 'text-[2.15rem] sm:text-[2.6rem]', unit: 'text-[0.6em]' },
  md: { amount: 'text-[22px] sm:text-2xl', unit: 'text-[0.55em]' },
  lg: { amount: 'text-lg sm:text-xl', unit: 'text-[0.7em]' },
  sm: { amount: 'text-sm', unit: 'text-[0.8em]' },
  xs: { amount: 'text-[11px]', unit: 'text-[0.8em]' },
};

type VndAmountProps = {
  amount: number;
  signed?: boolean;
  hidden?: boolean;
  size?: VndAmountSize;
  className?: string;
};

export function VndAmount({
  amount,
  signed = false,
  hidden = false,
  size = 'md',
  className = '',
}: VndAmountProps) {
  const { amount: amountCls, unit: unitCls } = SIZE_CLASS[size];
  const fullText = signed ? formatSignedVndUnit(amount) : formatVndUnit(amount);
  const numberText = signed ? formatSignedVnd(amount) : formatVnd(amount);

  if (hidden) {
    return (
      <span
        className={`inline-block font-semibold tabular-nums tracking-tight ${amountCls} text-muted/75 ${className}`}
      >
        {displayBalanceText(fullText, true)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-baseline gap-0.5 font-semibold tabular-nums tracking-tight ${amountCls}`}
    >
      <span className={className}>{numberText}</span>
      <span className={`font-normal leading-none text-muted/70 ${unitCls} ml-1 font-semibold`}>VNĐ</span>
    </span>
  );
}
