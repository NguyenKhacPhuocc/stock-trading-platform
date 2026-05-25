const PREFIX = 'trade:';

export type TradeLocale = 'vi' | 'en';
export type TradeTheme = 'dark' | 'light';

export type TradeNotifyPrefs = {
  orderMatched: boolean;
  orderPlaced: boolean;
  cashBalance: boolean;
};

const DEFAULT_NOTIFY: TradeNotifyPrefs = {
  orderMatched: true,
  orderPlaced: true,
  cashBalance: false,
};

export function getTradeLocale(): TradeLocale {
  if (typeof window === 'undefined') return 'vi';
  const v = localStorage.getItem(`${PREFIX}locale`);
  return v === 'en' ? 'en' : 'vi';
}

export function setTradeLocale(locale: TradeLocale) {
  localStorage.setItem(`${PREFIX}locale`, locale);
}

export function getTradeTheme(): TradeTheme {
  if (typeof window === 'undefined') return 'dark';
  const v = localStorage.getItem(`${PREFIX}theme`);
  return v === 'light' ? 'light' : 'dark';
}

export function setTradeTheme(theme: TradeTheme) {
  localStorage.setItem(`${PREFIX}theme`, theme);
}

export function getConfirmOrderNextTime(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(`${PREFIX}confirm-order`);
  return v !== 'false';
}

export function setConfirmOrderNextTime(enabled: boolean) {
  localStorage.setItem(`${PREFIX}confirm-order`, enabled ? 'true' : 'false');
}

export function getNotifyPrefs(): TradeNotifyPrefs {
  if (typeof window === 'undefined') return DEFAULT_NOTIFY;
  try {
    const raw = localStorage.getItem(`${PREFIX}notify`);
    if (!raw) return DEFAULT_NOTIFY;
    return { ...DEFAULT_NOTIFY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFY;
  }
}

export function setNotifyPrefs(prefs: TradeNotifyPrefs) {
  localStorage.setItem(`${PREFIX}notify`, JSON.stringify(prefs));
}
