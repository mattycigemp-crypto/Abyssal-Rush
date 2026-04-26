import './style.css';
import { Game } from './game/Game';
import { CHAPTER_CONFIGS } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);

// Set up chapter selection UI
const chapterBtns = [
  document.getElementById('chapter-1'),
  document.getElementById('chapter-2'),
  document.getElementById('chapter-3')
];
const chapterDescription = document.getElementById('chapter-description')!;

// Initialize chapter selection
function selectChapter(chapter: 1 | 2 | 3) {
  const config = CHAPTER_CONFIGS.find(c => c.id === chapter)!;
  chapterDescription.textContent = config.description;
  
  chapterBtns.forEach((btn, index) => {
    if (index + 1 === chapter) {
      btn?.classList.add('active');
    } else {
      btn?.classList.remove('active');
    }
  });
  
  // Update game's selected chapter
  (game as any).setSelectedChapter(chapter);
}

// Add click handlers
chapterBtns[0]?.addEventListener('click', () => selectChapter(1));
chapterBtns[1]?.addEventListener('click', () => selectChapter(2));
chapterBtns[2]?.addEventListener('click', () => selectChapter(3));

// Cinematic mode button
document.getElementById('cinematic-btn')?.addEventListener('click', () => {
  (game as any).startCinematicMode();
});

// Initialize with Chapter 1
selectChapter(1);

game.start();
