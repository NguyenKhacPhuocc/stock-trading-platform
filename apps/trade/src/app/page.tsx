import { redirect } from 'next/navigation';

export default function RootPage() {
  // basePath của app trade là /trade nên redirect nội bộ không cần gắn thêm /trade
  redirect('/priceboard');
}
