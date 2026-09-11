import { useEffect } from 'react';

const BRAND_NAME = 'An Trường Phát Hưng Yên';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | ${BRAND_NAME}`;
  }, [title]);
}
