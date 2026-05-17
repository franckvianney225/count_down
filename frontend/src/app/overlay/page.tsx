'use client';

import { useEffect } from 'react';
import CountdownDisplay from '@/components/CountdownDisplay';

export default function OverlayPage() {
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, []);

  return <CountdownDisplay mode="overlay" />;
}
