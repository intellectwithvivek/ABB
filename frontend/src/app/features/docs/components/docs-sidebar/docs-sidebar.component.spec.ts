import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DOCS_CATALOG } from '../../docs.catalog';
import { DocsSidebarComponent } from './docs-sidebar.component';

@Component({ template: '' })
class DocPageStubComponent {}

describe('DocsSidebarComponent', () => {
  let fixture: ComponentFixture<DocsSidebarComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'docs/:slug', component: DocPageStubComponent }])],
    });
    fixture = TestBed.createComponent(DocsSidebarComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  function toggle(): HTMLButtonElement | null {
    return element.querySelector('button');
  }

  it('links every document, grouped under its category', () => {
    const links = Array.from(element.querySelectorAll('a'), (a) => a.getAttribute('href'));

    expect(links).toEqual(DOCS_CATALOG.map((doc) => `/docs/${doc.slug}`));
    expect(element.querySelector('.section-title')?.textContent).toBe('Start here');
  });

  it('folds the list open and closed with the toggle used on small screens', async () => {
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');

    toggle()?.click();
    await fixture.whenStable();
    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');

    toggle()?.click();
    await fixture.whenStable();
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
  });

  it('folds the list away once a document is chosen', async () => {
    toggle()?.click();
    await fixture.whenStable();

    element.querySelector('a')?.click();
    await fixture.whenStable();

    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
  });
});
