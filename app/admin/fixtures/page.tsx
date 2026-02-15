"use client";

import dynamic from 'next/dynamic';
import Loading from './loading';

const FixturesPageContent = dynamic(() => import('./FixturesPageContent'), {
  loading: () => <Loading />,
  ssr: false, // Admin pages don't need SSR
});

export default function FixturesPage() {
  return <FixturesPageContent />;
}
