import { redirect } from 'next/navigation';

export default function CommitteeLegacyRedirect() {
  redirect('/discover/committee');
}
