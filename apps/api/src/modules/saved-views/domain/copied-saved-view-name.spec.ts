import {
  copiedSavedViewName,
  SAVED_VIEW_COPY_SUFFIX,
  SAVED_VIEW_NAME_MAX,
} from './copied-saved-view-name';

describe('copiedSavedViewName', () => {
  it('appends the copy suffix', () => {
    expect(copiedSavedViewName('Lisboa sem site')).toBe(`Lisboa sem site${SAVED_VIEW_COPY_SUFFIX}`);
  });

  it('truncates so the result stays within the name max', () => {
    const name = 'A'.repeat(SAVED_VIEW_NAME_MAX);
    const copied = copiedSavedViewName(name);
    expect(copied.length).toBe(SAVED_VIEW_NAME_MAX);
    expect(copied.endsWith(SAVED_VIEW_COPY_SUFFIX)).toBe(true);
  });
});
