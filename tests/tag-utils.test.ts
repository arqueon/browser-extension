import { describe, expect, it } from 'vitest';
import {
  dedupeTags,
  filterAndSortTags,
  getCreatableTagName,
  normalizeTagName,
  toggleTagSelection,
} from '../src/@/lib/tag-utils.ts';

const tags = [
  { id: 1, name: 'Inteligencia artificial' },
  { id: 2, name: 'Arte artificial' },
  { id: 3, name: 'Artificial' },
  { id: 4, name: 'IA académica' },
];

describe('tag search', () => {
  it('keeps every partial match and ranks the exact match first', () => {
    expect(
      filterAndSortTags(tags, 'artificial').map((tag) => tag.name)
    ).toEqual(['Artificial', 'Arte artificial', 'Inteligencia artificial']);
  });

  it('allows a new tag even when other tags partially match', () => {
    expect(getCreatableTagName('inteligencia', tags, [])).toBe('inteligencia');
  });

  it('does not offer a duplicate when the exact tag already exists', () => {
    expect(getCreatableTagName('  INTELIGENCIA   ARTIFICIAL ', tags, [])).toBe(
      null
    );
  });
});

describe('tag selection', () => {
  it('keeps distinct tags whose names overlap', () => {
    const firstSelection = toggleTagSelection([], tags[0]);
    const secondSelection = toggleTagSelection(firstSelection, tags[2]);

    expect(secondSelection.map((tag) => tag.name)).toEqual([
      'Inteligencia artificial',
      'Artificial',
    ]);
  });

  it('toggles only the exact normalized tag', () => {
    const selected = [tags[0], tags[2]];
    const remaining = toggleTagSelection(selected, {
      id: 99,
      name: ' inteligencia   ARTIFICIAL ',
    });

    expect(remaining).toEqual([tags[2]]);
  });
});

describe('tag normalization', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTagName('  IA    académica  ')).toBe('IA académica');
  });

  it('deduplicates only exact normalized names, not partial matches', () => {
    expect(
      dedupeTags([
        ...tags,
        { id: 5, name: '  inteligencia artificial ' },
      ]).map((tag) => tag.name)
    ).toEqual([
      'Inteligencia artificial',
      'Arte artificial',
      'Artificial',
      'IA académica',
    ]);
  });
});
