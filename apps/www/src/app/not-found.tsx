import { redirect } from 'next/navigation';

export default function NotFound() {
  // www.domain.com + sai path -> quay về trang chủ www.domain.com
  redirect('/');
}

