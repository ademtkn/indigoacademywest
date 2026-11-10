// Interface texts for password sign-in, first-time setup, editors and the user's own account.
// Merged into window.ADMIN_I18N (see i18n.js).
(function () {
  var add = {
    en: {
      nav: { editors: 'Editors', account: 'My account' },
      pw: {
        username: 'Username', password: 'Password', rule: '4–6 characters, Latin letters and digits only (for example: ak47m2).',
        show: 'Show', hide: 'Hide', generate: 'Create a password', repeat: 'Repeat the password',
        bad: 'The password must be 4–6 characters: Latin letters and digits only.', mismatch: 'The two passwords are different.',
        badUser: 'Username: 3–30 small Latin letters, digits, dots, dashes or underscores (for example: aigul.asanova).',
      },
      login: {
        submitPw: 'Sign in',
        badLogin: function (n) { return 'Wrong username or password.' + (n != null ? ' Attempts left: ' + n + '.' : ''); },
        locked: 'Too many wrong attempts. Sign-in is locked for 15 minutes.',
        signedOut: 'Your session has ended. Please sign in again.',
        ownerLink: 'Site owner: sign in with a GitHub key', pwLink: 'Sign in with username and password',
      },
      setup: {
        heading: 'Create the first administrator', lead: 'This is done only once. Enter the setup code that was saved on the sign-in server, then choose your own username and password.',
        code: 'Setup code', name: 'Your name', submit: 'Create administrator', badCode: 'The setup code is wrong.', done: 'Administrator created. You can sign in now.',
      },
      editors: {
        lead: 'People who can sign in to this panel. Editors change texts, photos, menu and team. Administrators can also add and remove editors.',
        add: 'Add an editor', name: 'Full name', role: 'Role', roles: { admin: 'Administrator', editor: 'Editor' },
        create: 'Add', active: 'Active', inactive: 'Blocked', block: 'Block', unblock: 'Unblock', reset: 'New password', del: 'Delete',
        lastLogin: 'Last sign-in', never: 'never', you: 'you', makeAdmin: 'Make administrator', makeEditor: 'Make editor',
        delConfirm: function (n) { return 'Delete ' + n + '? This person will no longer be able to sign in.'; },
        resetTitle: function (n) { return 'New password for ' + n; }, resetDone: 'Password changed. Give the new password to the person in person.',
        created: function (n, p) { return n + ' can now sign in. Password: ' + p; },
        errors: { username_taken: 'This username is already taken.', last_admin: 'There must always be at least one active administrator.', cannot_delete_self: 'You cannot delete yourself.', bad_username: null, weak_password: null },
        tip: 'Short passwords are protected by the sign-in server: after 5 wrong attempts the account is locked for 15 minutes.',
      },
      account: {
        lead: 'Change your own password.', current: 'Current password', next: 'New password', save: 'Change password',
        done: 'Your password has been changed.', wrong: 'The current password is wrong.', signedInAs: 'Signed in as',
      },
    },
    ky: {
      nav: { editors: 'Редакторлор', account: 'Менин аккаунтум' },
      pw: {
        username: 'Колдонуучу аты', password: 'Сырсөз', rule: '4–6 белги, латын тамгалары жана сандар гана (мисалы: ak47m2).',
        show: 'Көрсөтүү', hide: 'Жашыруу', generate: 'Сырсөз түзүү', repeat: 'Сырсөздү кайталаңыз',
        bad: 'Сырсөз 4–6 белгиден турушу керек: латын тамгалары жана сандар гана.', mismatch: 'Эки сырсөз бирдей эмес.',
        badUser: 'Колдонуучу аты: 3–30 кичине латын тамгасы, сан, чекит, сызыкча же астынкы сызык (мисалы: aigul.asanova).',
      },
      login: {
        submitPw: 'Кирүү',
        badLogin: function (n) { return 'Колдонуучу аты же сырсөз туура эмес.' + (n != null ? ' Калган аракеттер: ' + n + '.' : ''); },
        locked: 'Өтө көп туура эмес аракет. Кирүү 15 мүнөткө бөгөттөлдү.',
        signedOut: 'Сеансыңыз бүттү. Кайра кириңиз.',
        ownerLink: 'Сайттын ээси: GitHub ачкычы менен кирүү', pwLink: 'Колдонуучу аты жана сырсөз менен кирүү',
      },
      setup: {
        heading: 'Биринчи администраторду түзүү', lead: 'Бул бир гана жолу жасалат. Кирүү серверинде сакталган орнотуу кодун жазып, өзүңүздүн колдонуучу атыңызды жана сырсөзүңүздү тандаңыз.',
        code: 'Орнотуу коду', name: 'Атыңыз', submit: 'Администратор түзүү', badCode: 'Орнотуу коду туура эмес.', done: 'Администратор түзүлдү. Эми кире аласыз.',
      },
      editors: {
        lead: 'Бул панелге кире алган адамдар. Редакторлор тексттерди, сүрөттөрдү, менюну жана жамаатты өзгөртөт. Администраторлор редакторлорду кошуп, өчүрө да алат.',
        add: 'Редактор кошуу', name: 'Аты-жөнү', role: 'Ролу', roles: { admin: 'Администратор', editor: 'Редактор' },
        create: 'Кошуу', active: 'Активдүү', inactive: 'Бөгөттөлгөн', block: 'Бөгөттөө', unblock: 'Бөгөттөн чыгаруу', reset: 'Жаңы сырсөз', del: 'Өчүрүү',
        lastLogin: 'Акыркы кирүү', never: 'кире элек', you: 'сиз', makeAdmin: 'Администратор кылуу', makeEditor: 'Редактор кылуу',
        delConfirm: function (n) { return n + ' өчүрүлсүнбү? Бул адам мындан ары кире албайт.'; },
        resetTitle: function (n) { return n + ' үчүн жаңы сырсөз'; }, resetDone: 'Сырсөз өзгөрдү. Жаңы сырсөздү адамга өзүнө жеке бериңиз.',
        created: function (n, p) { return n + ' эми кире алат. Сырсөз: ' + p; },
        errors: { username_taken: 'Бул колдонуучу аты бош эмес.', last_admin: 'Дайыма жок дегенде бир активдүү администратор болушу керек.', cannot_delete_self: 'Өзүңүздү өчүрө албайсыз.', bad_username: null, weak_password: null },
        tip: 'Кыска сырсөздөрдү кирүү сервери коргойт: 5 туура эмес аракеттен кийин аккаунт 15 мүнөткө бөгөттөлөт.',
      },
      account: {
        lead: 'Өз сырсөзүңүздү өзгөртүңүз.', current: 'Азыркы сырсөз', next: 'Жаңы сырсөз', save: 'Сырсөздү өзгөртүү',
        done: 'Сырсөзүңүз өзгөрдү.', wrong: 'Азыркы сырсөз туура эмес.', signedInAs: 'Сиз кирдиңиз:',
      },
    },
    ru: {
      nav: { editors: 'Редакторы', account: 'Мой аккаунт' },
      pw: {
        username: 'Имя пользователя', password: 'Пароль', rule: '4–6 символов, только латинские буквы и цифры (например: ak47m2).',
        show: 'Показать', hide: 'Скрыть', generate: 'Придумать пароль', repeat: 'Повторите пароль',
        bad: 'Пароль должен быть из 4–6 символов: только латинские буквы и цифры.', mismatch: 'Пароли не совпадают.',
        badUser: 'Имя пользователя: 3–30 строчных латинских букв, цифр, точек, дефисов или подчёркиваний (например: aigul.asanova).',
      },
      login: {
        submitPw: 'Войти',
        badLogin: function (n) { return 'Неверное имя пользователя или пароль.' + (n != null ? ' Осталось попыток: ' + n + '.' : ''); },
        locked: 'Слишком много неверных попыток. Вход заблокирован на 15 минут.',
        signedOut: 'Сеанс закончился. Войдите снова.',
        ownerLink: 'Владелец сайта: вход с ключом GitHub', pwLink: 'Вход по имени и паролю',
      },
      setup: {
        heading: 'Создание первого администратора', lead: 'Это делается один раз. Введите код настройки, сохранённый на сервере входа, и выберите своё имя пользователя и пароль.',
        code: 'Код настройки', name: 'Ваше имя', submit: 'Создать администратора', badCode: 'Неверный код настройки.', done: 'Администратор создан. Теперь можно войти.',
      },
      editors: {
        lead: 'Люди, которые могут входить в эту панель. Редакторы меняют тексты, фото, меню и коллектив. Администраторы также добавляют и удаляют редакторов.',
        add: 'Добавить редактора', name: 'Имя и фамилия', role: 'Роль', roles: { admin: 'Администратор', editor: 'Редактор' },
        create: 'Добавить', active: 'Активен', inactive: 'Заблокирован', block: 'Заблокировать', unblock: 'Разблокировать', reset: 'Новый пароль', del: 'Удалить',
        lastLogin: 'Последний вход', never: 'ещё не входил', you: 'вы', makeAdmin: 'Сделать администратором', makeEditor: 'Сделать редактором',
        delConfirm: function (n) { return 'Удалить пользователя ' + n + '? Он больше не сможет войти.'; },
        resetTitle: function (n) { return 'Новый пароль для ' + n; }, resetDone: 'Пароль изменён. Передайте новый пароль человеку лично.',
        created: function (n, p) { return n + ' теперь может войти. Пароль: ' + p; },
        errors: { username_taken: 'Это имя пользователя уже занято.', last_admin: 'Всегда должен оставаться хотя бы один активный администратор.', cannot_delete_self: 'Нельзя удалить самого себя.', bad_username: null, weak_password: null },
        tip: 'Короткие пароли защищает сервер входа: после 5 неверных попыток аккаунт блокируется на 15 минут.',
      },
      account: {
        lead: 'Смените свой пароль.', current: 'Текущий пароль', next: 'Новый пароль', save: 'Сменить пароль',
        done: 'Ваш пароль изменён.', wrong: 'Текущий пароль неверный.', signedInAs: 'Вы вошли как',
      },
    },
  };
  function merge(a, b) { Object.keys(b).forEach(function (k) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = b[k]; }); }
  Object.keys(add).forEach(function (l) { merge(window.ADMIN_I18N[l], add[l]); });
})();
