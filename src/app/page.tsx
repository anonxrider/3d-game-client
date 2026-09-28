import GameSceneWrapper from '@/components/GameSceneWrapper';

export const metadata = {
  title: 'Ethera — Multiplayer Neighborhood',
  description: 'Explore a shared 3D neighborhood with friends on foot, by car, or by bike.',
};

export default function Home() {
  return (
    <main className="game-container">
      <div className="ui-overlay">
        <div className="header">
          <h1 className="title">Ethera</h1>
        </div>
        <div className="controls-hint">
          Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys to move · <kbd>E</kbd> interact · <kbd>SPACE</kbd> brake
        </div>
      </div>
      <GameSceneWrapper />
    </main>
  );
}
