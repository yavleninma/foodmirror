
const GUIDE_KEY = 'foodmirror.v1.guideSeen';

const I18N = {
  ru: {
    appName: 'FoodMirror',
    signInEyebrow: 'Telegram-first food log',
    signInTitle: '???????. ????????. ???????? ????.',
    signInCopy: '???? ??????? ???????? ? ????, Mini App ? ????. Telegram ????? ?????? ??? ???????? ? ??????????? ?????.',
    signInFlow: '???? ??? ???????????? ? ???????? ? ???? ? ???, ? ?? ?????? ????????????? ?????????.',
    signInTelegram: '????? ????? Telegram',
    signInWeb: '????????? dev-????',
    signInDevLabel: 'Dev only',
    profileName: '??? ????????????',
    continue: '??????????',
    logout: '?????',
    language: '????',
    navHome: '???????',
    navHistory: '???????',
    navProfile: '???????',
    homeEyebrow: '??????? ????????',
    homeTitle: '?????? ???? ??? ? ????? ?????? ???????? ????????.',
    homeCopy: '??? ??????? ???? ? ?????? ??????????. ????, ????????, ??????????.',
    homeBridge: '???? ???? ?????? ?? ????, ??????? ???????? ????????? ????? ?????????????.',
    shootPhoto: '????? ????',
    uploadPhoto: '????????? ????',
    targetDate: '???? ??????',
    today: '???????',
    summary: '?????? ???',
    recentTitle: '???????? ??????',
    recentCopy: '????????? ?????? ???? ? ??????? ???????? ? ???????.',
    recentEmpty: '???? ?????. ????? ? ??????? ????.',
    historyTitle: '???????',
    historyCopy: '?????? ???? ? ?????? ????????, ??? ??? ???? ?????????.',
    historyDayTitle: '?????? ?? ????????? ????',
    historyDayCopy: '????? ???? ?????? ? ??????? ? ???????? ??? ?????? ?????????.',
    profileTitle: '???????',
    profileCopy: '???, ?????????? ? ????????? ??? ???? ?? ??????? ??????.',
    accountTitle: '???????',
    accountCopy: '??????? ???? ???? ????? Telegram, ?? ?????? ??????? ???????? ???????????????.',
    preferencesTitle: '?????????',
    weightTitle: '??? ????',
    weightCopy: '???????????? ???????? ?? ??? ? ???????? ??? ????? ????.',
    stats: '??????????',
    cal: '????',
    protein: '?????',
    fat: '????',
    carbs: '????????',
    saveMeal: '????????? ??????',
    saveWeight: '????????? ???',
    date: '????',
    title: '????????',
    note: '???????',
    confidence: '???????????',
    confident: '????????',
    normal: '?????????',
    check: '?????????',
    unsure: '??????????',
    edit: '???????',
    repeat: '?????????',
    remove: '???????',
    quick: '??????? ??????',
    noMeals: '?? ???? ???? ???? ??? ???????.',
    noWeights: '??????? ???? ???? ???.',
    noHistory: '??????? ???????? ????? ?????? ??????????.',
    loading: '??????? ??????...',
    analyzing: '?????? ???? ? ??????? ????????...',
    saved: '?????????',
    deleted: '???????',
    fallback: 'AI ???? ?? ?????????, ??????? ??? ?????????? ??????? ??????.',
    avg7: '??????? ???? ?? 7 ????',
    avgProtein: '??????? ?????',
    loggedDays: '???? ? ????????',
    lastUpdate: '????????? ??????????',
    question: '????? ????????',
    close: '???????',
    sourceTelegram: '?? Telegram',
    sourceWeb: '?? ??????????',
    sourceRepeat: '?????? ?? ???????',
    draftReady: '???????? ?????',
    openTelegramHelp: '???? ?? ? ??????? ????????, ?????? ???? ? ????? /start. ?? ???? ?????????? ?????? ?????.',
    guideTitle: '??? ??? ????????',
    guideStep1: '????? ??? ??????? ????',
    guideStep2: '??????? ????????',
    guideStep3: '??????? ??????',
    guideDismiss: '???????',
    resumeDraft: '????????? ? ?????????',
    resumeDraftCopy: '???? ????????????? ????????. ??? ????? ?????? ??????? ? ?????????.',
    viewAllHistory: '??????? ???????',
    openProfile: '??? ? ?????????',
    accountViaTelegram: '???? ????? Telegram',
    accountViaWeb: '????????? web-????',
    draftEditTitle: '??????? ????????',
    draftEditSaved: '?????? ??????',
    saveAndClose: '?????????',
    timelineDate: '????????? ????',
    firstStepLabel: '???????? ??????? ???????'
  },
  en: {
    appName: 'FoodMirror',
    signInEyebrow: 'Telegram-first food log',
    signInTitle: 'Snap it. Review it. Save the day.',
    signInCopy: 'One account works across the bot, Mini App, and web. Telegram is only used for fast and secure sign-in.',
    signInFlow: 'A food photo becomes a draft with calories and macros, then you confirm the result quickly.',
    signInTelegram: 'Continue with Telegram',
    signInWeb: 'Local dev sign-in',
    signInDevLabel: 'Dev only',
    profileName: 'User name',
    continue: 'Continue',
    logout: 'Log out',
    language: 'Language',
    navHome: 'Home',
    navHistory: 'History',
    navProfile: 'Profile',
    homeEyebrow: 'Fast flow',
    homeTitle: 'Add a meal photo and get a clean draft right away.',
    homeCopy: 'No long forms and no extra explanation. Photo, review, save.',
    homeBridge: 'If a photo comes from the bot, the ready draft opens here automatically.',
    shootPhoto: 'Take photo',
    uploadPhoto: 'Upload photo',
    targetDate: 'Entry date',
    today: 'Today',
    summary: 'Day summary',
    recentTitle: 'Recent entries',
    recentCopy: 'Latest meals with quick repeat and edit actions.',
    recentEmpty: 'Nothing saved yet. Start with the first photo.',
    historyTitle: 'History',
    historyCopy: 'Pick a day and quickly review what was saved.',
    historyDayTitle: 'Entries for the selected day',
    historyDayCopy: 'Switch days above and work with the log without extra navigation.',
    profileTitle: 'Profile',
    profileCopy: 'Weight, stats, and settings without noise on the home screen.',
    accountTitle: 'Account',
    accountCopy: 'Telegram is the main sign-in layer, but the product stands on its own inside.',
    preferencesTitle: 'Preferences',
    weightTitle: 'Body weight',
    weightCopy: 'Tracked separately from meals and available for any date.',
    stats: 'Stats',
    cal: 'Calories',
    protein: 'Protein',
    fat: 'Fat',
    carbs: 'Carbs',
    saveMeal: 'Save entry',
    saveWeight: 'Save weight',
    date: 'Date',
    title: 'Title',
    note: 'Note',
    confidence: 'Confidence',
    confident: 'Confident',
    normal: 'Normal',
    check: 'Check',
    unsure: 'Uncertain',
    edit: 'Edit',
    repeat: 'Repeat',
    remove: 'Delete',
    quick: 'Quick edits',
    noMeals: 'No entries saved for this day yet.',
    noWeights: 'No weight entries yet.',
    noHistory: 'History appears after the first saves.',
    loading: 'Loading data...',
    analyzing: 'Reviewing the photo and building the draft...',
    saved: 'Saved',
    deleted: 'Deleted',
    fallback: 'AI is not configured yet, so this is a careful fallback estimate.',
    avg7: '7-day average calories',
    avgProtein: 'Average protein',
    loggedDays: 'Logged days',
    lastUpdate: 'Last update',
    question: 'Needs a quick check',
    close: 'Close',
    sourceTelegram: 'from Telegram',
    sourceWeb: 'from app',
    sourceRepeat: 'reused from history',
    draftReady: 'Draft is ready',
    openTelegramHelp: 'If you are in a normal browser, open the bot and tap /start. It will give you a secure sign-in link.',
    guideTitle: 'How it works',
    guideStep1: 'Take or upload a photo',
    guideStep2: 'Review the draft',
    guideStep3: 'Save the entry',
    guideDismiss: 'Got it',
    resumeDraft: 'Resume draft',
    resumeDraftCopy: 'There is an unsaved draft waiting for a quick review.',
    viewAllHistory: 'Open history',
    openProfile: 'Weight and settings',
    accountViaTelegram: 'Signed in with Telegram',
    accountViaWeb: 'Signed in on web',
    draftEditTitle: 'Review the draft',
    draftEditSaved: 'Edit entry',
    saveAndClose: 'Save',
    timelineDate: 'Selected day',
    firstStepLabel: 'First-use flow'
  }
};

const state = {
  lang: localStorage.getItem('foodmirror.lang') || 'ru',
  screen: 'home',
  session: null,
  botLoginUrl: null,
  allowWebSignin: false,
  selectedDate: isoDate(new Date()),
  data: null,
  loading: true,
  busy: false,
  toast: '',
  draft: null,
  editorOpen: false,
  pendingDraftId: null,
  guideDismissed: localStorage.getItem(GUIDE_KEY) === '1',
  authToken: new URLSearchParams(location.search).get('auth')
};

const root = document.querySelector('#app');

init();

async function init() {
  render();
  await bootstrapAuth();
}

async function bootstrapAuth() {
  try {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();

    if (state.authToken) {
      const exchanged = await post('/api/auth', { action: 'exchange_token', token: state.authToken });
      state.pendingDraftId = exchanged.draftId || null;
      removeSearchParam('auth');
      state.authToken = null;
    }

    if (!state.session && webApp?.initData) {
      try {
        await post('/api/auth', { action: 'telegram_webapp_signin', initData: webApp.initData });
      } catch (_error) {
      }
    }

    const sessionResponse = await get('/api/auth?action=session');
    state.session = sessionResponse.session || null;
    state.botLoginUrl = sessionResponse.botLoginUrl || null;
    state.allowWebSignin = Boolean(sessionResponse.allowWebSignin);

    if (state.session) {
      await refreshData();
      return;
    }
  } catch (error) {
    toast(error.message || 'Auth error');
  }

  state.loading = false;
  render();
}

async function refreshData() {
  state.loading = true;
  render();

  try {
    const query = new URLSearchParams({ action: 'bootstrap', date: state.selectedDate });
    if (state.pendingDraftId) query.set('draftId', state.pendingDraftId);
    state.data = await get(`/api/app?${query.toString()}`);

    if (state.data.draft) {
      state.draft = clone(state.data.draft);
      state.editorOpen = true;
      state.pendingDraftId = null;
      toast(text().draftReady);
    }
  } catch (error) {
    if (error.status === 401) {
      state.session = null;
      state.data = null;
      state.draft = null;
      state.editorOpen = false;
      state.screen = 'home';
    } else {
      toast(error.message || 'Data error');
    }
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const t = text();
  document.body.classList.toggle('overlay-open', Boolean(state.editorOpen));

  if (!state.session) {
    root.innerHTML = signInScreen(t);
    bindShared();
    bindSignIn();
    return;
  }

  const day = state.data?.day || { summary: { calories: 0, protein: 0, fat: 0, carbs: 0 }, entries: [] };
  const stats = state.data?.stats || {};
  const weights = state.data?.weights || [];
  const calendar = state.data?.calendar || [];
  const recent = state.data?.allEntries?.slice(0, 6) || [];

  root.innerHTML = `
    <div class="app-shell">
      <header class="utility-header">
        <div class="brand-block">
          <div class="brand-mark"></div>
          <div class="brand-copy">
            <span>${escapeHtml(t.appName)}</span>
            <strong>${escapeHtml(state.session.name || state.session.userId)}</strong>
          </div>
        </div>
        <nav class="nav-pills" aria-label="Primary">
          ${navButton('home', t.navHome)}
          ${navButton('history', t.navHistory)}
          ${navButton('profile', t.navProfile)}
        </nav>
      </header>

      <main class="main-shell">
        ${renderScreen(day, stats, weights, calendar, recent, t)}
      </main>

      <input class="hidden-input" type="file" id="meal-file-camera" accept="image/*" capture="environment" />
      <input class="hidden-input" type="file" id="meal-file-gallery" accept="image/*" />

      ${state.editorOpen ? draftEditor(t) : ''}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ''}
    </div>
  `;

  bindShared();
  bindApp();
}

function renderScreen(day, stats, weights, calendar, recent, t) {
  if (!state.data && state.loading) {
    return `
      <section class="section-panel empty-panel">
        <p class="eyebrow">${escapeHtml(t.appName)}</p>
        <h1>${escapeHtml(t.loading)}</h1>
        <div class="loading-line"></div>
      </section>
    `;
  }

  if (state.screen === 'history') return historyScreen(day, calendar, t);
  if (state.screen === 'profile') return profileScreen(stats, weights, t);
  return homeScreen(day, recent, t);
}
function signInScreen(t) {
  return `
    <div class="sign-shell">
      <section class="sign-card">
        <div class="sign-head">
          <div class="brand-block">
            <div class="brand-mark"></div>
            <div class="brand-copy">
              <span>${escapeHtml(t.appName)}</span>
              <strong>${escapeHtml(t.signInEyebrow)}</strong>
            </div>
          </div>
          <div class="lang-toggle">
            <button class="${state.lang === 'ru' ? 'active' : ''}" data-lang="ru">RU</button>
            <button class="${state.lang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          </div>
        </div>

        <div class="sign-grid">
          <div class="sign-copy">
            <p class="eyebrow">${escapeHtml(t.firstStepLabel)}</p>
            <h1>${escapeHtml(t.signInTitle)}</h1>
            <p class="lead-text">${escapeHtml(t.signInCopy)}</p>
            <p class="support-text">${escapeHtml(t.signInFlow)}</p>

            <div class="step-strip">
              ${stepPill(1, t.guideStep1)}
              ${stepPill(2, t.guideStep2)}
              ${stepPill(3, t.guideStep3)}
            </div>
          </div>

          <div class="sign-actions">
            ${state.botLoginUrl ? `<a class="solid-button wide-button" href="${escapeAttribute(state.botLoginUrl)}" target="_blank" rel="noreferrer">${escapeHtml(t.signInTelegram)}</a>` : ''}
            <p class="support-text">${escapeHtml(t.openTelegramHelp)}</p>

            ${state.allowWebSignin ? `
              <div class="dev-panel">
                <div class="dev-head">
                  <span class="small-label">${escapeHtml(t.signInDevLabel)}</span>
                </div>
                <form class="stack-form" id="web-signin-form">
                  <div class="field">
                    <label>${escapeHtml(t.profileName)}</label>
                    <input name="name" placeholder="Alex" />
                  </div>
                  <button class="ghost-button wide-button" type="submit">${escapeHtml(t.signInWeb)}</button>
                </form>
              </div>
            ` : ''}
          </div>
        </div>
      </section>
    </div>
  `;
}

function homeScreen(day, recent, t) {
  return `
    <section class="screen-stack">
      ${guideCard(t)}
      ${draftResumeCard(t)}

      <section class="capture-hero">
        <div class="hero-copy">
          <p class="eyebrow">${escapeHtml(t.homeEyebrow)}</p>
          <h1>${escapeHtml(t.homeTitle)}</h1>
          <p class="lead-text">${escapeHtml(t.homeCopy)}</p>
          <p class="support-text">${escapeHtml(t.homeBridge)}</p>
        </div>

        <div class="hero-controls">
          <div class="field">
            <label>${escapeHtml(t.targetDate)}</label>
            <div class="date-control">
              <input type="date" id="target-date" value="${escapeAttribute(state.selectedDate)}" />
              <button class="ghost-button" data-action="set-today">${escapeHtml(t.today)}</button>
            </div>
          </div>

          <div class="hero-actions">
            <button class="solid-button wide-button" data-action="capture-camera">${escapeHtml(t.shootPhoto)}</button>
            <button class="soft-button wide-button" data-action="capture-gallery">${escapeHtml(t.uploadPhoto)}</button>
          </div>
          ${(state.busy || state.loading) ? '<div class="loading-line"></div>' : ''}
        </div>
      </section>

      <section class="summary-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.summary)}</h2>
            <p class="support-text">${escapeHtml(readableDate(state.selectedDate, state.lang))}</p>
          </div>
        </div>
        <div class="metric-grid">
          ${metricCard(t.cal, day.summary.calories || 0)}
          ${metricCard(t.protein, `${day.summary.protein || 0} g`)}
          ${metricCard(t.fat, `${day.summary.fat || 0} g`)}
          ${metricCard(t.carbs, `${day.summary.carbs || 0} g`)}
        </div>
      </section>

      <section class="section-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.recentTitle)}</h2>
            <p class="support-text">${escapeHtml(t.recentCopy)}</p>
          </div>
          <button class="ghost-button" data-screen="history">${escapeHtml(t.viewAllHistory)}</button>
        </div>

        ${recent.length ? `<div class="meal-grid">${recent.map((entry) => mealCard(entry, t)).join('')}</div>` : emptyState(t.recentEmpty)}
      </section>

      <section class="jump-grid">
        <button class="jump-card" data-screen="history">
          <span class="small-label">${escapeHtml(t.navHistory)}</span>
          <strong>${escapeHtml(t.viewAllHistory)}</strong>
          <p>${escapeHtml(t.historyCopy)}</p>
        </button>
        <button class="jump-card" data-screen="profile">
          <span class="small-label">${escapeHtml(t.navProfile)}</span>
          <strong>${escapeHtml(t.openProfile)}</strong>
          <p>${escapeHtml(t.profileCopy)}</p>
        </button>
      </section>
    </section>
  `;
}

function historyScreen(day, calendar, t) {
  return `
    <section class="screen-stack">
      <section class="section-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(t.navHistory)}</p>
            <h1>${escapeHtml(t.historyTitle)}</h1>
            <p class="support-text">${escapeHtml(t.historyCopy)}</p>
          </div>
          <div class="date-control">
            <input type="date" id="selected-date" value="${escapeAttribute(state.selectedDate)}" />
            <button class="ghost-button" data-action="set-today">${escapeHtml(t.today)}</button>
          </div>
        </div>

        ${calendar.length ? `<div class="day-strip">${calendar.map((item) => dayCard(item, t)).join('')}</div>` : emptyState(t.noHistory)}
      </section>

      <section class="summary-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.summary)}</h2>
            <p class="support-text">${escapeHtml(readableDate(state.selectedDate, state.lang))}</p>
          </div>
        </div>
        <div class="metric-grid">
          ${metricCard(t.cal, day.summary.calories || 0)}
          ${metricCard(t.protein, `${day.summary.protein || 0} g`)}
          ${metricCard(t.fat, `${day.summary.fat || 0} g`)}
          ${metricCard(t.carbs, `${day.summary.carbs || 0} g`)}
        </div>
      </section>

      <section class="section-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.historyDayTitle)}</h2>
            <p class="support-text">${escapeHtml(t.historyDayCopy)}</p>
          </div>
        </div>
        ${day.entries.length ? `<div class="meal-grid">${day.entries.map((entry) => mealCard(entry, t)).join('')}</div>` : emptyState(t.noMeals)}
      </section>
    </section>
  `;
}

function profileScreen(stats, weights, t) {
  const accountSource = state.session?.source === 'telegram' ? t.accountViaTelegram : t.accountViaWeb;

  return `
    <section class="screen-stack">
      <section class="section-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(t.navProfile)}</p>
            <h1>${escapeHtml(t.profileTitle)}</h1>
            <p class="support-text">${escapeHtml(t.profileCopy)}</p>
          </div>
        </div>

        <div class="account-card">
          <div>
            <span class="small-label">${escapeHtml(t.accountTitle)}</span>
            <h2>${escapeHtml(state.session.name || state.session.userId)}</h2>
            <p class="support-text">${escapeHtml(accountSource)}</p>
          </div>
          <p class="support-text">${escapeHtml(t.accountCopy)}</p>
        </div>
      </section>

      <section class="section-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.stats)}</h2>
          </div>
        </div>
        <div class="metric-grid profile-metrics">
          ${metricCard(t.avg7, stats.averageCalories || 0)}
          ${metricCard(t.avgProtein, `${stats.averageProtein || 0} g`)}
          ${metricCard(t.loggedDays, stats.loggedDays || 0)}
        </div>
      </section>

      <section class="section-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.weightTitle)}</h2>
            <p class="support-text">${escapeHtml(t.weightCopy)}</p>
          </div>
        </div>

        <form class="stack-form" id="weight-form">
          <div class="field-grid">
            <div class="field">
              <label>${escapeHtml(t.date)}</label>
              <input type="date" name="date" value="${escapeAttribute(state.selectedDate)}" />
            </div>
            <div class="field">
              <label>${escapeHtml(t.weightTitle)}</label>
              <input id="weight-value" type="number" step="0.1" min="0" name="value" placeholder="62.4" />
            </div>
          </div>
          <div class="field">
            <label>${escapeHtml(t.note)}</label>
            <input type="text" name="note" placeholder="morning" />
          </div>
          <button class="solid-button wide-button" type="submit">${escapeHtml(t.saveWeight)}</button>
        </form>

        ${weights.length ? `<div class="weight-list">${weights.map((item) => weightCard(item, t)).join('')}</div>` : emptyState(t.noWeights)}
      </section>

      <section class="section-panel">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(t.preferencesTitle)}</h2>
          </div>
        </div>

        <div class="preferences-grid">
          <div class="preference-row">
            <div>
              <strong>${escapeHtml(t.language)}</strong>
            </div>
            <div class="lang-toggle">
              <button class="${state.lang === 'ru' ? 'active' : ''}" data-lang="ru">RU</button>
              <button class="${state.lang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
            </div>
          </div>
          <button class="ghost-button wide-button" data-action="logout">${escapeHtml(t.logout)}</button>
        </div>
      </section>
    </section>
  `;
}
function draftEditor(t) {
  if (!state.draft) return '';

  const draft = state.draft;
  const title = draft.entryId ? t.draftEditSaved : t.draftEditTitle;

  return `
    <div class="editor-shell">
      <div class="editor-backdrop" data-action="close-editor"></div>
      <section class="editor-panel">
        <header class="editor-header">
          <button class="ghost-button icon-button" data-action="close-editor" aria-label="${escapeAttribute(t.close)}">×</button>
          <div class="editor-title">
            <span class="small-label">${escapeHtml(sourceLabel(draft.source, t))}</span>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <button class="solid-button" data-action="save-draft">${escapeHtml(t.saveAndClose)}</button>
        </header>

        <div class="editor-body">
          <div class="editor-media">
            <img class="editor-photo" src="${escapeAttribute(draft.imageDataUrl || placeholder())}" alt="${escapeAttribute(draft.title || 'meal')}" />
          </div>

          <div class="editor-form">
            <div class="field">
              <label>${escapeHtml(t.title)}</label>
              <input id="draft-title" value="${escapeAttribute(draft.title || '')}" />
            </div>

            <div class="field-grid">
              <div class="field">
                <label>${escapeHtml(t.date)}</label>
                <input id="draft-date" type="date" value="${escapeAttribute(draft.date || state.selectedDate)}" />
              </div>
              <div class="field">
                <label>${escapeHtml(t.cal)}</label>
                <input id="draft-calories" type="number" min="0" value="${draft.calories || 0}" />
              </div>
            </div>

            <div class="field-grid">
              <div class="field">
                <label>${escapeHtml(t.protein)}</label>
                <input id="draft-protein" type="number" min="0" value="${draft.protein || 0}" />
              </div>
              <div class="field">
                <label>${escapeHtml(t.fat)}</label>
                <input id="draft-fat" type="number" min="0" value="${draft.fat || 0}" />
              </div>
            </div>

            <div class="field">
              <label>${escapeHtml(t.carbs)}</label>
              <input id="draft-carbs" type="number" min="0" value="${draft.carbs || 0}" />
            </div>

            <div class="field">
              <label>${escapeHtml(t.confidence)}</label>
              <div class="confidence-row">
                ${['confident', 'normal', 'check', 'unsure'].map((value) => `
                  <button class="confidence-button ${draft.confidence === value ? 'active' : ''}" data-confidence="${value}">
                    ${escapeHtml(t[value])}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="field">
              <label>${escapeHtml(t.quick)}</label>
              <div class="quick-actions">
                <button class="quick-button" data-adjust="calories:-50">-50</button>
                <button class="quick-button" data-adjust="calories:50">+50</button>
                <button class="quick-button" data-adjust="protein:5">+5P</button>
                <button class="quick-button" data-adjust="carbs:5">+5C</button>
              </div>
            </div>

            <div class="field">
              <label>${escapeHtml(t.note)}</label>
              <textarea id="draft-notes">${escapeHtml(draft.notes || '')}</textarea>
            </div>

            ${draft.clarificationQuestion ? `<div class="callout"><strong>${escapeHtml(t.question)}</strong><p>${escapeHtml(draft.clarificationQuestion)}</p></div>` : ''}
            ${draft.analysisSource === 'fallback' ? `<div class="callout"><p>${escapeHtml(t.fallback)}</p></div>` : ''}

            <button class="solid-button wide-button editor-save" data-action="save-draft">${escapeHtml(t.saveMeal)}</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function mealCard(entry, t) {
  return `
    <article class="meal-card">
      <img class="meal-photo" src="${escapeAttribute(entry.imageDataUrl || placeholder())}" alt="${escapeAttribute(entry.title || 'meal')}" />
      <div class="meal-body">
        <div class="meal-head">
          <div>
            <span class="small-label">${escapeHtml(sourceLabel(entry.source, t))}</span>
            <h3>${escapeHtml(entry.title || 'Meal')}</h3>
            <p class="support-text">${escapeHtml(readableDate(entry.date, state.lang))}</p>
          </div>
          <div class="kcal-badge">${entry.calories || 0} kcal</div>
        </div>

        <div class="macro-row">
          <span class="chip">${escapeHtml(t.protein)} ${entry.protein || 0} g</span>
          <span class="chip">${escapeHtml(t.fat)} ${entry.fat || 0} g</span>
          <span class="chip">${escapeHtml(t.carbs)} ${entry.carbs || 0} g</span>
          <span class="chip ${entry.confidence || 'normal'}">${escapeHtml(t[entry.confidence || 'normal'])}</span>
        </div>

        ${entry.notes ? `<p class="entry-note">${escapeHtml(entry.notes)}</p>` : ''}

        <div class="action-row">
          <button class="soft-button" data-repeat="${entry.id}">${escapeHtml(t.repeat)}</button>
          <button class="ghost-button" data-edit="${entry.id}">${escapeHtml(t.edit)}</button>
          <button class="text-button" data-delete="${entry.id}">${escapeHtml(t.remove)}</button>
        </div>
      </div>
    </article>
  `;
}

function dayCard(day, t) {
  return `
    <button class="day-card ${day.date === state.selectedDate ? 'active' : ''}" data-day="${day.date}">
      <span class="small-label">${escapeHtml(readableDate(day.date, state.lang, true))}</span>
      <strong>${day.summary.calories || 0} kcal</strong>
      <span>${escapeHtml(t.protein)} ${day.summary.protein || 0} g</span>
      ${day.weight ? `<span>${escapeHtml(t.weightTitle)} ${day.weight.value} kg</span>` : ''}
    </button>
  `;
}

function weightCard(entry, t) {
  return `
    <article class="weight-card">
      <div>
        <span class="small-label">${escapeHtml(readableDate(entry.date, state.lang))}</span>
        <h3>${entry.value} kg</h3>
        ${entry.note ? `<p class="support-text">${escapeHtml(entry.note)}</p>` : ''}
      </div>
      <button class="text-button" data-delete-weight="${entry.id}">${escapeHtml(t.remove)}</button>
    </article>
  `;
}

function guideCard(t) {
  if (state.screen !== 'home' || state.guideDismissed) return '';

  return `
    <section class="guide-card">
      <div class="section-head">
        <div>
          <span class="small-label">${escapeHtml(t.firstStepLabel)}</span>
          <h2>${escapeHtml(t.guideTitle)}</h2>
        </div>
        <button class="text-button" data-action="dismiss-guide">${escapeHtml(t.guideDismiss)}</button>
      </div>
      <div class="step-strip">
        ${stepPill(1, t.guideStep1)}
        ${stepPill(2, t.guideStep2)}
        ${stepPill(3, t.guideStep3)}
      </div>
    </section>
  `;
}

function draftResumeCard(t) {
  if (state.screen !== 'home' || !state.draft || state.editorOpen) return '';

  return `
    <section class="resume-card">
      <div>
        <span class="small-label">${escapeHtml(t.resumeDraft)}</span>
        <p>${escapeHtml(t.resumeDraftCopy)}</p>
      </div>
      <button class="ghost-button" data-action="open-draft">${escapeHtml(t.resumeDraft)}</button>
    </section>
  `;
}

function navButton(screen, label) {
  return `<button class="nav-button ${state.screen === screen ? 'active' : ''}" data-screen="${screen}">${escapeHtml(label)}</button>`;
}

function stepPill(index, label) {
  return `
    <div class="step-pill">
      <span>${index}</span>
      <strong>${escapeHtml(label)}</strong>
    </div>
  `;
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `;
}

function emptyState(message) {
  return `<div class="empty-panel"><p>${escapeHtml(message)}</p></div>`;
}
function bindShared() {
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.onclick = () => {
      state.lang = button.dataset.lang;
      localStorage.setItem('foodmirror.lang', state.lang);
      render();
    };
  });
}

function bindSignIn() {
  document.querySelector('#web-signin-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') || '').trim();
    if (!name) return;

    try {
      await post('/api/auth', { action: 'web_signin', name });
      const sessionResponse = await get('/api/auth?action=session');
      state.session = sessionResponse.session || null;
      state.botLoginUrl = sessionResponse.botLoginUrl || null;
      state.allowWebSignin = Boolean(sessionResponse.allowWebSignin);
      await refreshData();
    } catch (error) {
      toast(error.message || 'Sign-in failed');
    }
  });
}

function bindApp() {
  document.querySelectorAll('[data-screen]').forEach((button) => {
    button.onclick = () => {
      state.screen = button.dataset.screen;
      render();
    };
  });

  document.querySelector('[data-action="capture-camera"]')?.addEventListener('click', () => {
    document.querySelector('#meal-file-camera')?.click();
  });

  document.querySelector('[data-action="capture-gallery"]')?.addEventListener('click', () => {
    document.querySelector('#meal-file-gallery')?.click();
  });

  document.querySelector('#meal-file-camera')?.addEventListener('change', handleMealFileChange);
  document.querySelector('#meal-file-gallery')?.addEventListener('change', handleMealFileChange);

  document.querySelectorAll('[data-action="set-today"]').forEach((button) => {
    button.onclick = async () => {
      state.selectedDate = isoDate(new Date());
      await refreshData();
    };
  });

  document.querySelector('#target-date')?.addEventListener('change', async (event) => {
    state.selectedDate = event.target.value;
    await refreshData();
  });

  document.querySelector('#selected-date')?.addEventListener('change', async (event) => {
    state.selectedDate = event.target.value;
    await refreshData();
  });

  document.querySelector('[data-action="dismiss-guide"]')?.addEventListener('click', () => {
    dismissGuide();
    render();
  });

  document.querySelector('[data-action="open-draft"]')?.addEventListener('click', () => {
    state.editorOpen = true;
    render();
  });

  document.querySelectorAll('[data-action="close-editor"]').forEach((button) => {
    button.onclick = () => {
      state.editorOpen = false;
      render();
    };
  });

  document.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    await post('/api/auth', { action: 'logout' });
    state.session = null;
    state.data = null;
    state.draft = null;
    state.editorOpen = false;
    state.screen = 'home';
    render();
  });

  document.querySelector('#weight-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = Number(formData.get('value'));
    if (!value) return;

    await post('/api/app', {
      action: 'save_weight',
      date: formData.get('date'),
      value,
      note: String(formData.get('note') || '')
    });

    event.currentTarget.reset();
    toast(text().saved);
    await refreshData();
  });

  document.querySelectorAll('[data-day]').forEach((button) => {
    button.onclick = async () => {
      state.selectedDate = button.dataset.day;
      await refreshData();
    };
  });

  document.querySelectorAll('[data-edit]').forEach((button) => {
    button.onclick = () => {
      const entry = findEntry(button.dataset.edit);
      if (!entry) return;
      state.draft = clone({ ...entry, entryId: entry.id });
      state.editorOpen = true;
      render();
    };
  });

  document.querySelectorAll('[data-repeat]').forEach((button) => {
    button.onclick = async () => {
      await post('/api/app', { action: 'reuse_food', entryId: button.dataset.repeat, targetDate: state.selectedDate });
      dismissGuide();
      toast(text().saved);
      await refreshData();
    };
  });

  document.querySelectorAll('[data-delete]').forEach((button) => {
    button.onclick = async () => {
      await post('/api/app', { action: 'delete_food', entryId: button.dataset.delete });
      toast(text().deleted);
      await refreshData();
    };
  });

  document.querySelectorAll('[data-delete-weight]').forEach((button) => {
    button.onclick = async () => {
      await post('/api/app', { action: 'delete_weight', weightId: button.dataset.deleteWeight });
      toast(text().deleted);
      await refreshData();
    };
  });

  document.querySelectorAll('[data-confidence]').forEach((button) => {
    button.onclick = () => {
      syncDraftFromDom();
      state.draft.confidence = button.dataset.confidence;
      render();
    };
  });

  document.querySelectorAll('[data-adjust]').forEach((button) => {
    button.onclick = () => {
      syncDraftFromDom();
      const [field, delta] = button.dataset.adjust.split(':');
      state.draft[field] = Math.max(0, Number(state.draft[field] || 0) + Number(delta));
      render();
    };
  });

  document.querySelectorAll('[data-action="save-draft"]').forEach((button) => {
    button.onclick = async () => {
      syncDraftFromDom();
      await post('/api/app', { action: 'save_food', entry: state.draft });
      dismissGuide();
      state.editorOpen = false;
      state.draft = null;
      toast(text().saved);
      await refreshData();
    };
  });
}

async function handleMealFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    state.busy = true;
    render();
    toast(text().analyzing);
    const imageDataUrl = await compressImage(file);
    const result = await post('/api/app', {
      action: 'analyze_food',
      date: state.selectedDate,
      lang: state.lang,
      imageDataUrl
    });
    state.draft = clone(result.draft);
    state.editorOpen = true;
    dismissGuide();
    await refreshData();
  } catch (error) {
    toast(error.message || 'Upload failed');
  } finally {
    state.busy = false;
    event.target.value = '';
    render();
  }
}

function syncDraftFromDom() {
  if (!state.draft) return;
  state.draft.title = document.querySelector('#draft-title')?.value.trim() || '';
  state.draft.date = document.querySelector('#draft-date')?.value || state.selectedDate;
  state.draft.calories = Number(document.querySelector('#draft-calories')?.value || 0);
  state.draft.protein = Number(document.querySelector('#draft-protein')?.value || 0);
  state.draft.fat = Number(document.querySelector('#draft-fat')?.value || 0);
  state.draft.carbs = Number(document.querySelector('#draft-carbs')?.value || 0);
  state.draft.notes = document.querySelector('#draft-notes')?.value.trim() || '';
}

function dismissGuide() {
  state.guideDismissed = true;
  localStorage.setItem(GUIDE_KEY, '1');
}

function findEntry(id) {
  return state.data?.allEntries?.find((entry) => entry.id === id);
}

async function get(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}
async function compressImage(file) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function toast(message) {
  state.toast = message;
  render();
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    state.toast = '';
    render();
  }, 2200);
}

function sourceLabel(source, t) {
  if (source === 'telegram') return t.sourceTelegram;
  if (source === 'repeat') return t.sourceRepeat;
  return t.sourceWeb;
}

function text() {
  return I18N[state.lang];
}

function readableDate(value, lang, compact = false) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: compact ? 'short' : 'long',
    weekday: compact ? undefined : 'short'
  });
}

function isoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function removeSearchParam(name) {
  const url = new URL(location.href);
  url.searchParams.delete(name);
  history.replaceState({}, '', url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function placeholder() {
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23ece7e1"/%3E%3Ccircle cx="122" cy="110" r="34" fill="%232455e6"/%3E%3Crect x="92" y="170" width="220" height="28" rx="14" fill="%23111827"/%3E%3C/svg%3E';
}

