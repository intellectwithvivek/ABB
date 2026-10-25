import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CellValue } from '../../models/game.models';
import { CellComponent } from './cell.component';

describe('CellComponent', () => {
  let fixture: ComponentFixture<CellComponent>;

  async function renderCell(value: CellValue, row = 0, col = 0): Promise<HTMLButtonElement> {
    fixture = TestBed.createComponent(CellComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('col', col);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('button');
  }

  async function setInput(name: 'disabled' | 'highlighted', value: boolean): Promise<void> {
    fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
  }

  it('describes an empty cell with its 1-based position for screen readers', async () => {
    const button = await renderCell(null, 0, 0);

    expect(button.getAttribute('aria-label')).toBe('Row 1, Column 1, empty');
  });

  it('describes an occupied cell with its mark', async () => {
    const button = await renderCell('O', 1, 2);

    expect(button.getAttribute('aria-label')).toBe('Row 2, Column 3, O');
  });

  it('tells screen readers that a highlighted cell is part of the winning line', async () => {
    const button = await renderCell('X', 2, 0);
    await setInput('highlighted', true);

    expect(button.getAttribute('aria-label')).toBe('Row 3, Column 1, X, winning line');
    expect(button.classList).toContain('cell--winning');
  });

  it.each<[CellValue, string]>([
    ['X', 'cell--x'],
    ['O', 'cell--o'],
    [null, 'cell--empty'],
  ])('styles a %s cell with the %s class', async (value, cssClass) => {
    const button = await renderCell(value);

    expect(button.classList).toContain(cssClass);
  });

  it('emits selected when an empty, enabled cell is clicked', async () => {
    const button = await renderCell(null);
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);

    button.click();

    expect(button.getAttribute('aria-disabled')).toBe('false');
    expect(selected).toHaveBeenCalledOnce();
  });

  it.each<[string, CellValue, boolean]>([
    ['an occupied cell', 'X', false],
    ['an empty cell on a disabled board', null, true],
  ])(
    'locks %s without the native disabled attribute, so it keeps focus',
    async (_, value, disabled) => {
      const button = await renderCell(value);
      await setInput('disabled', disabled);
      const selected = vi.fn();
      fixture.componentInstance.selected.subscribe(selected);
      button.focus();

      button.click();

      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.disabled).toBe(false);
      expect(document.activeElement).toBe(button);
      expect(selected).not.toHaveBeenCalled();
    },
  );
});
