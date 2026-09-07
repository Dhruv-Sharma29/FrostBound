import './style.css';
import { Game } from './game/core/Game';

const container = document.querySelector<HTMLDivElement>('#app')!;

Game.create(container)
  .then((game) => game.start())
  .catch((error: unknown) => console.error('FrostBound failed to start:', error));
