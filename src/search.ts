import { TinyEmitter as Emitter } from 'tiny-emitter';

import * as icons from './icons';

import { EmojiContainer } from './emojiContainer';
import {
  HIDE_PREVIEW,
  HIDE_VARIANT_POPUP,
  SHOW_SEARCH_RESULTS,
  HIDE_SEARCH_RESULTS
} from './events';
import { createElement, empty } from './util';
import { I18NStrings, EmojiButtonOptions, EmojiRecord, EmojiKeyword } from './types';

import {
  CLASS_SEARCH_CONTAINER,
  CLASS_SEARCH_FIELD,
  CLASS_SEARCH_ICON,
  CLASS_NOT_FOUND,
  CLASS_NOT_FOUND_ICON,
  CLASS_EMOJI
} from './classes';

import fuzzysort from 'fuzzysort';

import defaultData from './data/emoji';
const defaultEmojiData: EmojiRecord[] = defaultData.emoji;

function doSearch(search: string, emojiData: EmojiKeyword[]) {
  const result = fuzzysort.go(search, emojiData, {
    allowTypo: false,
    limit: 100,
    threshold: -50,
    key: 'keyword',
  })
    .filter(result =>
      search.length < 2 || // if just starting a search
      result.indexes[result.indexes.length - 1] - result.indexes[0] < search.length + 2 // otherwise keep all the search letters not far appart 
    )
    .map(result => {
      console.log(result.score, result.obj.emoji.emoji, fuzzysort.highlight(result, '-|', '|-'));
      return result.obj.emoji
    });
  return [...new Set(result)];
}

class NotFoundMessage {
  constructor(private message: string, private iconUrl?: string) { }

  render(): HTMLElement {
    const container = createElement('div', CLASS_NOT_FOUND);

    const iconContainer = createElement('div', CLASS_NOT_FOUND_ICON);

    if (this.iconUrl) {
      iconContainer.appendChild(icons.createIcon(this.iconUrl));
    } else {
      iconContainer.innerHTML = icons.frown;
    }

    container.appendChild(iconContainer);

    const messageContainer = createElement('h2');
    messageContainer.innerHTML = this.message;
    container.appendChild(messageContainer);

    return container;
  }
}

export class Search {
  private emojiSearchData: EmojiKeyword[];
  private emojisPerRow: number;
  private focusedEmojiIndex = 0;

  private searchContainer: HTMLElement;
  private searchField: HTMLInputElement;
  private searchIcon: HTMLElement;
  private resultsContainer: HTMLElement | null;

  constructor(
    private events: Emitter,
    private i18n: I18NStrings,
    private options: EmojiButtonOptions,
    emojiData: EmojiRecord[],
    categories: number[]
  ) {
    this.emojisPerRow = this.options.emojisPerRow || 8;

    this.emojiSearchData = [];
    emojiData.filter(
      e =>
        e.version &&
        parseFloat(e.version) <= parseFloat(options.emojiVersion as string) &&
        e.category !== undefined &&
        categories.indexOf(e.category) >= 0
    ).forEach(emoji => {
      this.processEmojiKeywords(emoji);

      if (emojiData !== defaultEmojiData) {
        const defaultEmoji = defaultEmojiData.find(e => e.emoji === emoji.emoji);
        if (defaultEmoji && defaultEmoji.name !== emoji.name) {
          this.processEmojiKeywords(defaultEmoji, emoji);
        }
      }
    });

    if (this.options.custom) {
      const customEmojis = this.options.custom.map(custom => ({
        keyword: custom.name,
        emoji: {
          ...custom,
          custom: true
        }
      }));

      this.emojiSearchData = [...this.emojiSearchData, ...customEmojis];
    }

    this.events.on(HIDE_VARIANT_POPUP, () => {
      setTimeout(() => this.setFocusedEmoji(this.focusedEmojiIndex));
    });
  }

  render(): HTMLElement {
    this.searchContainer = createElement('div', CLASS_SEARCH_CONTAINER);

    this.searchField = createElement(
      'input',
      CLASS_SEARCH_FIELD
    ) as HTMLInputElement;
    this.searchField.placeholder = this.i18n.search;
    this.searchContainer.appendChild(this.searchField);

    this.searchIcon = createElement('span', CLASS_SEARCH_ICON);

    if (this.options.icons && this.options.icons.search) {
      this.searchIcon.appendChild(icons.createIcon(this.options.icons.search));
    } else {
      this.searchIcon.innerHTML = icons.search;
    }

    this.searchIcon.addEventListener('click', (event: MouseEvent) =>
      this.onClearSearch(event)
    );

    this.searchContainer.appendChild(this.searchIcon);

    this.searchField.addEventListener('keydown', (event: KeyboardEvent) =>
      this.onKeyDown(event)
    );
    this.searchField.addEventListener('keyup', event => this.onKeyUp(event));

    return this.searchContainer;
  }

  clear(): void {
    this.searchField.value = '';
  }

  focus(): void {
    this.searchField.focus();
  }

  onClearSearch(event: Event): void {
    event.stopPropagation();

    if (this.searchField.value) {
      this.searchField.value = '';
      this.resultsContainer = null;

      if (this.options.icons && this.options.icons.search) {
        empty(this.searchIcon);
        this.searchIcon.appendChild(
          icons.createIcon(this.options.icons.search)
        );
      } else {
        this.searchIcon.innerHTML = icons.search;
      }

      this.searchIcon.style.cursor = 'default';

      this.events.emit(HIDE_SEARCH_RESULTS);

      setTimeout(() => this.searchField.focus());
    }
  }

  setFocusedEmoji(index: number): void {
    if (this.resultsContainer) {
      const emojis = this.resultsContainer.querySelectorAll(`.${CLASS_EMOJI}`);
      const currentFocusedEmoji = emojis[this.focusedEmojiIndex] as HTMLElement;
      currentFocusedEmoji.tabIndex = -1;

      this.focusedEmojiIndex = index;
      const newFocusedEmoji = emojis[this.focusedEmojiIndex] as HTMLElement;
      newFocusedEmoji.tabIndex = 0;
      newFocusedEmoji.focus();
    }
  }

  handleResultsKeydown(event: KeyboardEvent): void {
    if (this.resultsContainer) {
      const emojis = this.resultsContainer.querySelectorAll(`.${CLASS_EMOJI}`);
      if (event.key === 'ArrowRight') {
        this.setFocusedEmoji(
          Math.min(this.focusedEmojiIndex + 1, emojis.length - 1)
        );
      } else if (event.key === 'ArrowLeft') {
        this.setFocusedEmoji(Math.max(0, this.focusedEmojiIndex - 1));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (this.focusedEmojiIndex < emojis.length - this.emojisPerRow) {
          this.setFocusedEmoji(this.focusedEmojiIndex + this.emojisPerRow);
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (this.focusedEmojiIndex >= this.emojisPerRow) {
          this.setFocusedEmoji(this.focusedEmojiIndex - this.emojisPerRow);
        }
      } else if (event.key === 'Escape') {
        this.onClearSearch(event);
      }
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.searchField.value) {
      this.onClearSearch(event);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Tab' || event.key === 'Shift') {
      return;
    } else if (!this.searchField.value) {
      if (this.options.icons && this.options.icons.search) {
        empty(this.searchIcon);
        this.searchIcon.appendChild(
          icons.createIcon(this.options.icons.search)
        );
      } else {
        this.searchIcon.innerHTML = icons.search;
      }

      this.searchIcon.style.cursor = 'default';
      this.events.emit(HIDE_SEARCH_RESULTS);
    } else {
      if (this.options.icons && this.options.icons.clearSearch) {
        empty(this.searchIcon);
        this.searchIcon.appendChild(
          icons.createIcon(this.options.icons.clearSearch)
        );
      } else {
        this.searchIcon.innerHTML = icons.times;
      }
      this.searchIcon.style.cursor = 'pointer';

      let searchResults = doSearch(this.searchField.value, this.emojiSearchData);

      this.events.emit(HIDE_PREVIEW);

      if (searchResults.length) {
        this.resultsContainer = new EmojiContainer(
          searchResults,
          true,
          this.events,
          this.options,
          false
        ).render();

        if (this.resultsContainer) {
          (this.resultsContainer.querySelector(
            `.${CLASS_EMOJI}`
          ) as HTMLElement).tabIndex = 0;
          this.focusedEmojiIndex = 0;

          this.resultsContainer.addEventListener('keydown', event =>
            this.handleResultsKeydown(event)
          );

          this.events.emit(SHOW_SEARCH_RESULTS, this.resultsContainer);
        }
      } else {
        this.events.emit(
          SHOW_SEARCH_RESULTS,
          new NotFoundMessage(
            this.i18n.notFound,
            this.options.icons && this.options.icons.notFound
          ).render()
        );
      }
    }
  }

  processEmojiKeywords(emojiWithKeywords: EmojiRecord, emojiObj: EmojiRecord | null = null) {
    if (!this.emojiSearchData) {
      this.emojiSearchData = [];
    }

    const keywords = emojiWithKeywords.keywords && emojiWithKeywords.keywords.split(' | ') || [emojiWithKeywords.name];
    keywords.forEach(keyword => {
      this.emojiSearchData.push({
        keyword,
        emoji: emojiObj || emojiWithKeywords
      })
    });

  }
}
