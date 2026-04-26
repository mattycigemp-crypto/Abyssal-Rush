// UI overlay manager: HUD, dialogue, letterbox, fades, toasts, menus.
type El = HTMLElement;

const $ = <T extends El = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

export class UI {
  private healthFill = $('health-fill');
  private staminaFill = $('stamina-fill');
  private objective = $('objective-text');
  private timeOfDay = $('time-of-day');
  private tooltip = $('tooltip');
  private dialogue = $('dialogue');
  private dialogueSpeaker = $('dialogue-speaker');
  private dialogueText = $('dialogue-text');
  private letterbox = $('letterbox');
  private fade = $('fade');
  private hud = $('hud');
  private title = $('title-screen');
  private pause = $('pause-menu');
  private toast = $('toast');
  private chapterDescription = $('chapter-description');
  private chapterBtns = [
    $('chapter-1'),
    $('chapter-2'),
    $('chapter-3')
  ];
  private selectedChapter = 1;

  setHealth(pct: number) {
    this.healthFill.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
  }
  setStamina(pct: number) {
    this.staminaFill.style.width = `${Math.max(0, Math.min(100, pct * 100))}%`;
  }
  setObjective(text: string) { this.objective.textContent = text; }
  setTimeOfDay(label: string) { this.timeOfDay.textContent = label; }

  setTooltip(text: string | null) {
    if (text) {
      this.tooltip.textContent = text;
      this.tooltip.classList.add('visible');
    } else {
      this.tooltip.classList.remove('visible');
    }
  }

  showDialogue(speaker: string, text: string) {
    this.dialogueSpeaker.textContent = speaker;
    this.dialogueText.textContent = text;
    this.dialogue.classList.remove('hidden');
    // force reflow for transition
    void this.dialogue.offsetWidth;
    this.dialogue.classList.add('visible');
  }

  hideDialogue() {
    this.dialogue.classList.remove('visible');
    window.setTimeout(() => this.dialogue.classList.add('hidden'), 400);
  }

  setLetterbox(active: boolean) {
    this.letterbox.classList.remove('hidden');
    if (active) this.letterbox.classList.add('active');
    else this.letterbox.classList.remove('active');
  }

  fadeOut(ms = 1200): Promise<void> {
    this.fade.style.transitionDuration = `${ms}ms`;
    this.fade.style.opacity = '1';
    return new Promise((r) => window.setTimeout(r, ms));
  }

  fadeIn(ms = 1200): Promise<void> {
    this.fade.style.transitionDuration = `${ms}ms`;
    this.fade.style.opacity = '0';
    return new Promise((r) => window.setTimeout(r, ms));
  }

  showHUD(visible: boolean) { this.hud.classList.toggle('hidden', !visible); }
  showTitle(visible: boolean) { this.title.classList.toggle('hidden', !visible); }
  showPause(visible: boolean) { this.pause.classList.toggle('hidden', !visible); }

  flashToast(text: string, ms = 2400) {
    this.toast.textContent = text;
    this.toast.classList.remove('hidden');
    // Restart animation
    this.toast.style.animation = 'none';
    void this.toast.offsetWidth;
    this.toast.style.animation = '';
    window.setTimeout(() => this.toast.classList.add('hidden'), ms);
  }

  setChapterDescription(text: string) {
    this.chapterDescription.textContent = text;
  }

  selectChapter(chapter: 1 | 2 | 3) {
    this.selectedChapter = chapter;
    this.chapterBtns.forEach((btn, index) => {
      if (index + 1 === chapter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  getSelectedChapter(): 1 | 2 | 3 {
    return this.selectedChapter as 1 | 2 | 3;
  }
}
