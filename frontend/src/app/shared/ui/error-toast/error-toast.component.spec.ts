import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';
import { ErrorToastComponent } from './error-toast.component';

describe('ErrorToastComponent', () => {
  let fixture: ComponentFixture<ErrorToastComponent>;
  let dismissed: Mock<() => void>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ErrorToastComponent);
    dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);
  });

  afterEach(() => vi.useRealTimers());

  async function showMessage(message: string | null): Promise<HTMLElement> {
    fixture.componentRef.setInput('message', message);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  it('renders nothing when there is no message', async () => {
    const element = await showMessage(null);

    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the message as an alert', async () => {
    const element = await showMessage('Cell (row 0, col 0) is already taken by X.');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Cell (row 0, col 0) is already taken by X.',
    );
  });

  it('emits dismissed when the close button is clicked', async () => {
    const element = await showMessage('Rejected.');

    element.querySelector<HTMLButtonElement>('button[aria-label="Dismiss error"]')?.click();

    expect(dismissed).toHaveBeenCalledOnce();
  });

  it('stays on screen until it is dismissed, however long it takes to read', async () => {
    vi.useFakeTimers();
    const element = await showMessage('Rejected.');

    vi.advanceTimersByTime(60_000);

    expect(dismissed).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
