import './style.css';
import { Game } from './game/core/Game';

const container = document.querySelector<HTMLDivElement>('#app')!;

const game = new Game(container);
game.start();
