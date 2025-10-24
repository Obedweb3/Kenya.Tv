/**
 * Best-effort deobfuscated version of your script.
 * - Replaced obfuscated names with descriptive identifiers.
 * - Converted hex-escaped literal text to normal strings where obvious.
 * - Removed the anti-tamper loop and replaced with explanatory comments.
 *
 * NOTE: Some string lookups in the original used a separate mapping function.
 * Where the mapping couldn't be fully reconstructed, I've used descriptive placeholders.
 */

/* -------------------------
   Helper & init (was obfuscated)
   ------------------------- */

// A simple once-wrapping helper similar to the original's self-invoking factory.
function onceWrapper() {
  let called = true;
  return function (context, fn) {
    const runner = called
      ? function () {
          if (fn) {
            const res = fn.apply(context, arguments);
            fn = null;
            return res;
          }
        }
      : function () {};
    called = false;
    return runner;
  };
}
const once = onceWrapper();

/* Create useful refs and default strings that were hidden in obfuscation */
const SELECTORS = {
  themeToggleId: 'theme-toggle',           // used with getElementById
  playerId: 'player-element',              // the <video> or <audio> element id
  playerCardSelector: '.player-card',      // some container in DOM
  playlistContainerClass: 'player-list',   // class name for generated playlist <ul>
  channelCardSelector: '.channel-card',    // selector for channel card
  playerClassName: 'player-card',          // class name added to some elements
  playIconClass: 'player-card--play'       // class used for play icon elements
};

/* Example UI strings (decoded from hex in original) */
const ICON_LIGHT = '☀️';
const ICON_DARK = '🌙';
const DEFAULT_EMPTY_MESSAGE = 'No results';

/* -------------------------
   DOM references and player setup
   ------------------------- */

const themeToggleEl = document.getElementById(SELECTORS.themeToggleId);
const themeLabelEl = document.createElement('div'); // placeholder element used by original
const localThemeKey = 'player-theme'; // localStorage key used by original

// Get the player element and initialize Plyr wrapper
const playerElement = document.getElementById(SELECTORS.playerId);
const plyrOptions = {
  autoplay: true,
  muted: true,
  quality: {
    default: 'auto',
    options: []
  }
};
const plyrInstance = new Plyr(playerElement, plyrOptions);

// playlist state
let playlist = [];
let isPlaying = false;

/* -------------------------
   Utility functions
   ------------------------- */

/**
 * createListItem(labelText, lang, className)
 * Create a <li> element with given text, language attribute and class name.
 */
function createListItem(text, lang) {
  const li = document.createElement('li');
  li.textContent = text;
  li.dataset.lang = lang;
  return li;
}

/**
 * makeElement(tag, innerHTML, className)
 * Lightweight helper to create DOM nodes like <ul>, <img> etc.
 */
function makeElement(tagName, innerHTML = '', className = '') {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (innerHTML !== undefined) el.innerHTML = innerHTML;
  return el;
}

/* -------------------------
   Playlist rendering & searching
   ------------------------- */

/**
 * buildPlaylistUI(containerIdOrElement)
 * Either renders a playlist UI from a playlist array or shows a message.
 */
function buildPlaylistUI(containerId) {
  // container where playlist will be appended
  const container = document.getElementById(containerId) || document.querySelector('.playlist-root');

  if (!container) return;

  // If there is an alternative path where original code used a different data source:
  if (!Array.isArray(playlist) || playlist.length === 0) {
    const emptyMsg = makeElement('div', DEFAULT_EMPTY_MESSAGE);
    container.innerHTML = '';
    container.appendChild(emptyMsg);
    return;
  }

  // Build an unordered list of playable items
  const ul = makeElement('ul', '', 'player-list');
  ul.setAttribute('role', 'list');

  playlist.forEach((item, i) => {
    // item expected shape: { title, stream_url, logo, bitrate, lang }
    const title = item.title || 'Untitled';
    const imgUrl = item.logo || '';
    const lang = item.lang || 'en';

    // create a link/list-item element that will trigger playback
    const li = makeElement('li');
    li.className = 'player-list-item';
    li.dataset.index = i;

    // inner markup similar to: <img src="..."> <span>title</span>
    const img = makeElement('img');
    img.src = imgUrl;
    img.alt = title;
    img.width = 64;
    img.height = 36;

    const titleSpan = makeElement('span', title);
    titleSpan.className = 'player-item-title';

    li.appendChild(img);
    li.appendChild(titleSpan);

    // clicking a list item should play that item
    li.onclick = () => playListItem(i);

    ul.appendChild(li);
  });

  container.innerHTML = '';
  container.appendChild(ul);
}

/**
 * playListItem(index)
 * Load selected playlist item in the player and start playback.
 */
function playListItem(index) {
  const item = playlist[index];
  if (!item) return;

  // Update some UI: e.g. mark selected item
  const listItems = document.querySelectorAll('.player-list-item');
  listItems.forEach((el, idx) => {
    el.classList.toggle('active', idx === index);
  });

  // If Hls.js is available and the stream is an m3u8, use Hls to attach
  const url = item.stream_url || item.stream || '';
  if (window.Hls && Hls.isSupported() && url.includes('.m3u8')) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(playerElement);
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      // Build quality options from manifest levels & attach them to Plyr settings
      const qualityOptions = (hls.levels || []).map(l => `${l.height}p @ ${l.bitrate}`);
      plyrInstance.config.quality.options = qualityOptions;
      plyrInstance.on('qualitychange', (ev) => {
        // update Hls current level based on selected quality index
        hls.currentLevel = qualityOptions.indexOf(ev.detail.quality);
      });
    });
  } else {
    // Fallback: set the player's src attribute to the direct stream URL
    playerElement.src = url; // playerElement may be <video> or <audio>
  }

  // Set metadata/play button labels if present in the UI
  // Example: a "player-title" element updated with the chosen item's title
  const playerTitleEl = document.querySelector('.player-title');
  if (playerTitleEl) playerTitleEl.textContent = item.title || '';

  // Start playing via Plyr API
  plyrInstance.play();
  isPlaying = true;
}

/* -------------------------
   Simple search function (filter playlist by search term)
   ------------------------- */

function searchPlaylist(query = '') {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    // show all items
    buildPlaylistUI('playlist-root');
    return;
  }

  const filtered = playlist.filter(it => {
    if (!it || !it.title) return false;
    return it.title.toLowerCase().includes(normalized);
  });

  // Temporarily render only filtered items (we keep playlist intact)
  const root = document.getElementById('playlist-root');
  if (!root) return;

  root.innerHTML = '';
  if (filtered.length === 0) {
    root.appendChild(makeElement('div', DEFAULT_EMPTY_MESSAGE));
    return;
  }

  const ul = makeElement('ul', '', 'player-list');
  filtered.forEach((it, i) => {
    const li = makeElement('li', '', 'player-list-item');
    li.onclick = () => {
      // find the real index in the original playlist and play it
      const realIndex = playlist.indexOf(it);
      if (realIndex !== -1) playListItem(realIndex);
    };
    li.innerHTML = `<img src="${it.logo || ''}" alt="${it.title || ''}" width="64" height="36"> <span>${it.title}</span>`;
    ul.appendChild(li);
  });
  root.appendChild(ul);
}

/* -------------------------
   Theme toggle persisted in localStorage
   ------------------------- */

(function initializeTheme() {
  const saved = localStorage.getItem(localThemeKey);
  if (saved) {
    // saved is expected to be 'light' or 'dark'
    document.documentElement.setAttribute('data-theme', saved);
    if (themeToggleEl) themeToggleEl.textContent = saved === 'light' ? ICON_LIGHT : ICON_DARK;
  } else {
    // default: set dark (example from original)
    const defaultTheme = 'dark';
    document.documentElement.setAttribute('data-theme', defaultTheme);
    if (themeToggleEl) themeToggleEl.textContent = defaultTheme === 'light' ? ICON_LIGHT : ICON_DARK;
    localStorage.setItem(localThemeKey, defaultTheme);
  }

  // set toggle click handler
  if (themeToggleEl) {
    themeToggleEl.onclick = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      themeToggleEl.textContent = next === 'light' ? ICON_LIGHT : ICON_DARK;
      localStorage.setItem(localThemeKey, next);
    };
  }
})();

/* -------------------------
   Keyboard & global event handlers
   ------------------------- */

/**
 * handleKeydown(e)
 * - If certain keys are pressed, trigger actions like toggling play / open UI.
 * - The original checked for arrow keys, space, slash, and other keys.
 */
function handleKeydown(e) {
  const key = e.key;
  if (!isPlaying && (key === ' ' || key === 'Enter')) {
    // Prevent default space scroll behavior and toggle playback
    e.preventDefault();
    if (plyrInstance) plyrInstance.play();
    isPlaying = true;
    return;
  }

  // Example: pressing '/' focuses the search box
  if (key === '/') {
    e.preventDefault();
    const searchInput = document.querySelector('input.player-search');
    if (searchInput) searchInput.focus();
  }

  // If Escape or '/' etc.: close overlays
  if (key === 'Escape') {
    // assume there's a modal with class .player-modal
    const modal = document.querySelector('.player-modal');
    if (modal) modal.classList.remove('open');
  }
}

// Bind global keydown
window.addEventListener('keydown', handleKeydown);

/* -------------------------
   DOMContentLoaded / play first item behavior
   ------------------------- */

window.addEventListener('DOMContentLoaded', () => {
  // Example fill: if playlist is empty, attempt to load from a remote source or localStorage
  const savedPlaylistJson = localStorage.getItem('player-playlist');
  if (savedPlaylistJson) {
    try {
      playlist = JSON.parse(savedPlaylistJson);
    } catch (err) {
      playlist = [];
    }
  }

  // Fallback demo playlist (only if playlist still empty)
  if (!playlist || playlist.length === 0) {
    playlist = [
      { title: 'Demo Channel 1', stream_url: 'https://example.com/stream1.m3u8', logo: '', lang: 'en' },
      { title: 'Demo Channel 2', stream_url: 'https://example.com/stream2.mp4', logo: '', lang: 'en' }
    ];
  }

  buildPlaylistUI('playlist-root');

  // Optionally autoplay the first item after initial load (original used setTimeout)
  setTimeout(() => {
    playListItem(0);
  }, 50);
});

/* -------------------------
   Exposed small API for external actions
   ------------------------- */

// Add a programmatic API to add an item to the playlist and persist it
function addToPlaylist(item) {
  playlist.push(item);
  localStorage.setItem('player-playlist', JSON.stringify(playlist));
  buildPlaylistUI('playlist-root');
}

// Public exports (if used as module)
window.myPlayerApp = {
  playIndex: playListItem,
  search: searchPlaylist,
  add: addToPlaylist,
  getPlaylist: () => playlist
};

