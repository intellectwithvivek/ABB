import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameMode } from '../../models/game.models';
import { ControlsComponent } from './controls.component';

interface ControlsInputs {
  selectedMode: GameMode;
  activeMode: GameMode | null;
  canUndo: boolean;
  canReset: boolean;
  busy: boolean;
}

const DEFAULT_INPUTS: ControlsInputs = {
  selectedMode: 'TwoPlayer',
  activeMode: 'TwoPlayer',
  canUndo: true,
  canReset: true,
  busy: false,
};

const MODE_HINT = 'Mode applies when you start a new game.';

describe('ControlsComponent', () => {
  let fixture: ComponentFixture<ControlsComponent>;

  async function renderControls(inputs: Partial<ControlsInputs> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ControlsComponent);
    for (const [name, value] of Object.entries({ ...DEFAULT_INPUTS, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement {
    const match = Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!match) {
      throw new Error(`No button labelled "${label}"`);
    }
    return match;
  }

  it('emits undo, resetGame and newGame when their buttons are clicked', async () => {
    const element = await renderControls();
    const { undo, resetGame, newGame } = fixture.componentInstance;
    const undoSpy = vi.fn();
    const resetGameSpy = vi.fn();
    const newGameSpy = vi.fn();
    undo.subscribe(undoSpy);
    resetGame.subscribe(resetGameSpy);
    newGame.subscribe(newGameSpy);

    button(element, 'Undo Last Move').click();
    button(element, 'Reset Game').click();
    button(element, 'New Game').click();

    expect(undoSpy).toHaveBeenCalledOnce();
    expect(resetGameSpy).toHaveBeenCalledOnce();
    expect(newGameSpy).toHaveBeenCalledOnce();
  });

  it('disables Undo Last Move when there is nothing to undo', async () => {
    const element = await renderControls({ canUndo: false });
    const undoSpy = vi.fn();
    fixture.componentInstance.undo.subscribe(undoSpy);
    const undoButton = button(element, 'Undo Last Move');

    undoButton.click();

    expect(undoButton.getAttribute('aria-disabled')).toBe('true');
    // Not natively disabled, so the button keeps keyboard focus after the last undo.
    expect(undoButton.disabled).toBe(false);
    expect(undoSpy).not.toHaveBeenCalled();
    expect(button(element, 'Reset Game').disabled).toBe(false);
  });

  it('locks only the mode picker while a request is running, so New Game keeps focus', async () => {
    const element = await renderControls({ busy: true });

    expect(element.querySelector('fieldset')?.disabled).toBe(true);
    expect(button(element, 'New Game').disabled).toBe(false);
  });

  it('emits modeSelected when a mode is picked', async () => {
    const element = await renderControls();
    const modeSelected = vi.fn();
    fixture.componentInstance.modeSelected.subscribe(modeSelected);

    element.querySelector<HTMLInputElement>('input[value="VsComputer"]')?.click();

    expect(modeSelected).toHaveBeenCalledExactlyOnceWith('VsComputer');
  });

  it('explains that a newly picked mode applies only to the next game', async () => {
    const element = await renderControls({ selectedMode: 'VsComputer', activeMode: 'TwoPlayer' });

    expect(element.textContent).toContain(MODE_HINT);
  });

  it('shows no hint while the picked mode matches the game on screen', async () => {
    const element = await renderControls({ selectedMode: 'TwoPlayer', activeMode: 'TwoPlayer' });

    expect(element.textContent).not.toContain(MODE_HINT);
  });

  it('announces the hint through a live region that is already in the page', async () => {
    const element = await renderControls({ selectedMode: 'TwoPlayer', activeMode: 'TwoPlayer' });
    const liveRegion = element.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('selectedMode', 'VsComputer');
    await fixture.whenStable();

    expect(element.querySelector('[aria-live="polite"]')).toBe(liveRegion);
    expect(liveRegion?.textContent?.trim()).toBe(MODE_HINT);
  });
});
