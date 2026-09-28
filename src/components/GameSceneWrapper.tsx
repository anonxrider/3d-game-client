"use client";

import dynamic from 'next/dynamic';

const GameScene = dynamic(() => import('./GameScene'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#0f172a', color: '#fff', fontSize: '2rem' }}>
      Loading World...
    </div>
  ),
});

export default function GameSceneWrapper() {
  return <GameScene />;
}
