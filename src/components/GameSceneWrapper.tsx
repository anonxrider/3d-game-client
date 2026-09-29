"use client";

import dynamic from 'next/dynamic';

const GameScene = dynamic(() => import('./GameScene'), {
  ssr: false,
  loading: () => (
    <div className="world-loading" role="status">
      Loading World...
    </div>
  ),
});

export default function GameSceneWrapper() {
  return <GameScene />;
}
