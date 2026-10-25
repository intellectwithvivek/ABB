import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Small non-blocking error message. It stays until the player closes it or the next request
 * clears it: a timer could hide it before a slow reader or a screen-magnifier user has read it.
 */
@Component({
  selector: 'app-error-toast',
  templateUrl: './error-toast.component.html',
  styleUrl: './error-toast.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorToastComponent {
  readonly message = input<string | null>(null);

  readonly dismissed = output<void>();
}
