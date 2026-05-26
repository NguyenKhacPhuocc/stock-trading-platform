import { redirect } from 'next/navigation';

export default function AccountPnlUnrealizedRedirectPage() {
  redirect('/account/holdings');
}
