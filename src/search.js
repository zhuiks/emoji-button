import { library, icon } from '@fortawesome/fontawesome-svg-core';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

import emojiData from './data/emoji.js';

import { renderEmojiContainer } from './emojiContainer';
import { createElement, empty } from './util';

library.add(faSearch);

const search = icon({ prefix: 'fas', iconName: 'search' }).html;

const CLASS_SEARCH_CONTAINER = 'emoji-picker__search-container';
const CLASS_SEARCH_FIELD = 'emoji-picker__search';
const CLASS_SEARCH_ICON = 'emoji-picker__search-icon';

export function renderSearch(pickerContent, emojiCallback, hidePicker, renderCallback) {
  const searchContainer = createElement('div', CLASS_SEARCH_CONTAINER);

  const searchField = createElement('input', CLASS_SEARCH_FIELD);
  searchField.placeholder = 'Search';
  searchContainer.appendChild(searchField);

  searchField.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (searchField.value !== '') {
        event.stopPropagation();
        searchField.value = '';
        empty(pickerContent);
        renderCallback();
      }
    }
  });

  searchField.addEventListener('keyup', () => {
    empty(pickerContent);

    if (!searchField.value) {
      renderCallback();
    } else {
      const searchResults = emojiData.filter(emoji => emoji.names.filter(name => name.indexOf(searchField.value) >= 0).length);
      pickerContent.appendChild(renderEmojiContainer(searchResults, emojiCallback, hidePicker));
    }
  });
  
  const searchIcon = createElement('span', CLASS_SEARCH_ICON);
  searchIcon.innerHTML = search;
  searchContainer.appendChild(searchIcon);

  setTimeout(() => searchField.focus());

  return searchContainer;
}