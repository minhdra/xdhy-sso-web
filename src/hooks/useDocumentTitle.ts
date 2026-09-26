import { useEffect } from 'react';

import { useBrandingStore } from '../store/branding';

export function useDocumentTitle(title: string): void {
  const orgName = useBrandingStore((s) => s.branding.org_name);
  useEffect(() => {
    document.title = `${title} | ${orgName}`;
  }, [title, orgName]);
}
