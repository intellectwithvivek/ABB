import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The request path through the system, drawn with HTML and CSS (no image to keep in sync). */
@Component({
  selector: 'app-architecture-diagram',
  templateUrl: './architecture-diagram.component.html',
  styleUrl: './architecture-diagram.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchitectureDiagramComponent {}
