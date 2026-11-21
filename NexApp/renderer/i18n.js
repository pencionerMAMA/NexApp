(function () {
  const L = ['ru', 'en', 'de', 'uk', 'zh', 'ja'];
  const D = [
    ['Главная', 'Home', 'Start', 'Головна', '主页', 'ホーム'],
    ['Погода', 'Weather', 'Wetter', 'Погода', '天气', '天気'],
    ['Задачи', 'Tasks', 'Aufgaben', 'Завдання', '任务', 'タスク'],
    ['Буфер обмена', 'Clipboard', 'Zwischenablage', 'Буфер обміну', '剪贴板', 'クリップボード'],
    ['Wi‑Fi и Bluetooth', 'Wi‑Fi & Bluetooth', 'WLAN & Bluetooth', 'Wi‑Fi і Bluetooth', 'Wi‑Fi 和蓝牙', 'Wi‑Fi と Bluetooth'],
    ['Система', 'System', 'System', 'Система', '系统', 'システム'],
    ['Таймер', 'Timer', 'Timer', 'Таймер', '计时器', 'タイマー'],
    ['Профиль и настройки', 'Profile & settings', 'Profil & Einstellungen', 'Профіль і налаштування', '个人资料与设置', 'プロフィールと設定'],
    ['Программы', 'Apps', 'Apps', 'Програми', '应用', 'アプリ'],
    ['Мои программы', 'My apps', 'Meine Apps', 'Мої програми', '我的应用', 'マイアプリ'],
    ['+ Добавить', '+ Add', '+ Hinzufügen', '+ Додати', '+ 添加', '+ 追加'],
    ['Изменить', 'Edit', 'Bearbeiten', 'Змінити', '编辑', '編集'],
    ['Готово', 'Done', 'Fertig', 'Готово', '完成', '完了'],
    ['Добавь любимые программы — и открывай их одним кликом.', 'Add your favorite apps and open them in one click.', 'Füge Lieblings-Apps hinzu und öffne sie mit einem Klick.', 'Додай улюблені програми й відкривай їх одним кліком.', '添加常用应用，一键打开。', 'お気に入りのアプリを追加して、ワンクリックで開こう。'],
    ['Не удалось открыть программу', 'Couldn\'t open the app', 'App konnte nicht geöffnet werden', 'Не вдалося відкрити програму', '无法打开应用', 'アプリを開けませんでした'],
    ['Тишина', 'Silence', 'Stille', 'Тиша', '安静', '静か'],
    ['Включи музыку в Spotify, YouTube или любом плеере', 'Play music in Spotify, YouTube or any player', 'Spiele Musik in Spotify, YouTube oder einem Player ab', 'Увімкни музику в Spotify, YouTube або будь-якому плеєрі', '在 Spotify、YouTube 或任意播放器中播放音乐', 'Spotify や YouTube で音楽を再生してね'],
    ['Назад', 'Previous', 'Zurück', 'Назад', '上一首', '前へ'],
    ['Пауза / играть', 'Play / pause', 'Wiedergabe / Pause', 'Пауза / грати', '播放 / 暂停', '再生 / 一時停止'],
    ['Дальше', 'Next', 'Weiter', 'Далі', '下一步', '次へ'],
    ['Не беспокоить', 'Do not disturb', 'Nicht stören', 'Не турбувати', '勿扰', '応答不可'],
    ['Ночной свет', 'Night light', 'Nachtmodus', 'Нічне світло', '夜间模式', '夜間モード'],
    ['Скриншот', 'Screenshot', 'Screenshot', 'Знімок екрана', '截图', 'スクショ'],
    ['Без звука', 'Mute', 'Stumm', 'Без звуку', '静音', 'ミュート'],
    ['Ищу твой город…', 'Finding your city…', 'Suche deine Stadt…', 'Шукаю твоє місто…', '正在定位你的城市…', '街を探しています…'],
    ['Привет!', 'Hi!', 'Hallo!', 'Привіт!', '你好！', 'こんにちは！'],
    ['Мне скучно', 'I\'m bored', 'Mir ist langweilig', 'Мені нудно', '我好无聊', '退屈だな'],
    ['Что посмотреть?', 'What to watch?', 'Was soll ich schauen?', 'Що подивитися?', '看点什么？', '何を見よう？'],
    ['Про мою музыку', 'About my music', 'Über meine Musik', 'Про мою музику', '聊聊我的音乐', '私の音楽について'],
    ['Напиши Nex…', 'Message Nex…', 'Schreib Nex…', 'Напиши Nex…', '给 Nex 发消息…', 'Nex にメッセージ…'],
    ['Новый разговор', 'New chat', 'Neuer Chat', 'Нова розмова', '新对话', '新しい会話'],
    ['Отправить', 'Send', 'Senden', 'Надіслати', '发送', '送信'],
    ['Заметка', 'Note', 'Notiz', 'Нотатка', '笔记', 'メモ'],
    ['сохраняется сама', 'saves automatically', 'speichert automatisch', 'зберігається сама', '自动保存', '自動保存'],
    ['Новая задача — Enter', 'New task — Enter', 'Neue Aufgabe — Enter', 'Нове завдання — Enter', '新任务 — 回车', '新しいタスク — Enter'],
    ['Мысли, ссылки, идеи…', 'Thoughts, links, ideas…', 'Gedanken, Links, Ideen…', 'Думки, посилання, ідеї…', '想法、链接、灵感…', '考え、リンク、アイデア…'],
    ['Очистить', 'Clear', 'Leeren', 'Очистити', '清空', 'クリア'],
    ['Обновить', 'Refresh', 'Aktualisieren', 'Оновити', '刷新', '更新'],
    ['Вкл / выкл', 'On / off', 'Ein / aus', 'Увімк / вимк', '开 / 关', 'オン / オフ'],
    ['Добавить устройство…', 'Add device…', 'Gerät hinzufügen…', 'Додати пристрій…', '添加设备…', 'デバイスを追加…'],
    ['Громкость ·', 'Volume ·', 'Lautstärke ·', 'Гучність ·', '音量 ·', '音量 ·'],
    ['Яркость ·', 'Brightness ·', 'Helligkeit ·', 'Яскравість ·', '亮度 ·', '明るさ ·'],
    ['Сброс', 'Reset', 'Zurücksetzen', 'Скинути', '重置', 'リセット'],
    ['Старт', 'Start', 'Start', 'Старт', '开始', 'スタート'],
    ['Пауза', 'Pause', 'Pause', 'Пауза', '暂停', '一時停止'],
    ['Заново', 'Restart', 'Neu starten', 'Знову', '重新开始', 'もう一度'],
    ['ПРОФИЛЬ', 'PROFILE', 'PROFIL', 'ПРОФІЛЬ', '个人资料', 'プロフィール'],
    ['Имя', 'Name', 'Name', 'Ім\'я', '名字', '名前'],
    ['Увлечения', 'Hobbies', 'Hobbys', 'Захоплення', '爱好', '趣味'],
    ['Привязать Google', 'Link Google', 'Google verknüpfen', 'Прив\'язати Google', '关联 Google', 'Google を連携'],
    ['ПОГОДА', 'WEATHER', 'WETTER', 'ПОГОДА', '天气', '天気'],
    ['Город (пусто — определить сам)', 'City (empty — detect automatically)', 'Stadt (leer — automatisch)', 'Місто (порожньо — визначити самому)', '城市（留空则自动定位）', '都市（空欄で自動検出）'],
    ['ЯЗЫК', 'LANGUAGE', 'SPRACHE', 'МОВА', '语言', '言語'],
    ['ДРУГОЕ', 'OTHER', 'SONSTIGES', 'ІНШЕ', '其他', 'その他'],
    ['Запускать вместе с Windows', 'Start with Windows', 'Mit Windows starten', 'Запускати разом із Windows', '开机启动', 'Windows と一緒に起動'],
    ['Только на рабочем столе', 'Only on desktop', 'Nur auf dem Desktop', 'Лише на робочому столі', '仅在桌面显示', 'デスクトップのみ'],
    ['Открыть островок: Ctrl + Alt + N', 'Open island: Ctrl + Alt + N', 'Insel öffnen: Strg + Alt + N', 'Відкрити острівець: Ctrl + Alt + N', '打开灵动岛：Ctrl + Alt + N', 'アイランドを開く：Ctrl + Alt + N'],
    ['Выйти из профиля', 'Sign out', 'Abmelden', 'Вийти з профілю', '退出账号', 'サインアウト'],
    ['ЦВЕТ', 'COLOR', 'FARBE', 'КОЛІР', '颜色', 'カラー'],
    ['ФОН ОСТРОВКА', 'ISLAND BACKGROUND', 'INSEL-HINTERGRUND', 'ФОН ОСТРІВЦЯ', '灵动岛背景', 'アイランドの背景'],
    ['Чёрный', 'Black', 'Schwarz', 'Чорний', '黑色', 'ブラック'],
    ['Мои обои', 'My wallpaper', 'Mein Hintergrund', 'Мої шпалери', '我的壁纸', '壁紙'],
    ['Своя', 'Custom', 'Eigenes', 'Своя', '自定义', 'カスタム'],
    ['Загрузить картинку…', 'Upload image…', 'Bild hochladen…', 'Завантажити картинку…', '上传图片…', '画像をアップロード…'],
    ['ВИД', 'STYLE', 'STIL', 'ВИГЛЯД', '样式', 'スタイル'],
    ['Капля сверху', 'Top drop', 'Tropfen oben', 'Крапля зверху', '顶部水滴', '上部ドロップ'],
    ['Плавающий', 'Floating', 'Schwebend', 'Плаваючий', '悬浮', 'フローティング'],
    ['МОЗГ NEX', 'NEX BRAIN', 'NEX-GEHIRN', 'МОЗОК NEX', 'NEX 大脑', 'NEX の頭脳'],
    ['Получить ключ →', 'Get a key →', 'Schlüssel holen →', 'Отримати ключ →', '获取密钥 →', 'キーを取得 →'],
    ['Ключ sk-or-…', 'Key sk-or-…', 'Schlüssel sk-or-…', 'Ключ sk-or-…', '密钥 sk-or-…', 'キー sk-or-…'],
    ['Ключ AIza…', 'Key AIza…', 'Schlüssel AIza…', 'Ключ AIza…', '密钥 AIza…', 'キー AIza…'],
    ['Модель', 'Model', 'Modell', 'Модель', '模型', 'モデル'],
    ['Привет! Я Nex', 'Hi! I\'m Nex', 'Hallo! Ich bin Nex', 'Привіт! Я Nex', '你好！我是 Nex', 'こんにちは！Nex だよ'],
    ['Я живу в островке сверху экрана: музыка, погода, Wi‑Fi, задачи — и я сам. Давай познакомимся.', 'I live in the island at the top of your screen: music, weather, Wi‑Fi, tasks — and me. Let\'s get to know each other.', 'Ich wohne in der Insel oben am Bildschirm: Musik, Wetter, WLAN, Aufgaben — und ich. Lass uns kennenlernen.', 'Я живу в острівці зверху екрана: музика, погода, Wi‑Fi, завдання — і я сам. Давай познайомимося.', '我住在屏幕顶部的灵动岛里：音乐、天气、Wi‑Fi、任务，还有我。我们认识一下吧。', '画面上部のアイランドに住んでいるよ：音楽、天気、Wi‑Fi、タスク、そして僕。よろしくね。'],
    ['Продолжить с Google', 'Continue with Google', 'Weiter mit Google', 'Продовжити з Google', '使用 Google 继续', 'Google で続行'],
    ['Создать профиль', 'Create profile', 'Profil erstellen', 'Створити профіль', '创建个人资料', 'プロフィールを作成'],
    ['Расскажи о себе', 'Tell me about yourself', 'Erzähl von dir', 'Розкажи про себе', '介绍一下你自己', '自己紹介してね'],
    ['Так Nex будет знать, как к тебе обращаться.', 'So Nex knows what to call you.', 'Damit Nex weiß, wie es dich nennen soll.', 'Так Nex знатиме, як до тебе звертатися.', '这样 Nex 就知道怎么称呼你。', 'Nex があなたを何と呼べばいいか分かるように。'],
    ['Нажми на круг, чтобы поставить свою аватарку.', 'Tap the circle to set your avatar.', 'Tippe auf den Kreis für dein Profilbild.', 'Натисни на коло, щоб поставити аватарку.', '点击圆圈设置头像。', '円をタップしてアバターを設定。'],
    ['Как тебя зовут?', 'What\'s your name?', 'Wie heißt du?', 'Як тебе звати?', '你叫什么名字？', '名前は？'],
    ['Дата рождения', 'Birthday', 'Geburtstag', 'Дата народження', '生日', '誕生日'],
    ['Чем увлекаешься?', 'What are your hobbies?', 'Was sind deine Hobbys?', 'Чим захоплюєшся?', '你的爱好是什么？', '趣味は？'],
    ['Игры, музыка, рисование…', 'Games, music, drawing…', 'Spiele, Musik, Zeichnen…', 'Ігри, музика, малювання…', '游戏、音乐、绘画…', 'ゲーム、音楽、絵…'],
    ['Сделай островок своим', 'Make the island yours', 'Mach die Insel zu deiner', 'Зроби острівець своїм', '打造你的灵动岛', 'アイランドを自分好みに'],
    ['Всё можно поменять потом в настройках.', 'You can change everything later in settings.', 'Alles lässt sich später ändern.', 'Усе можна змінити потім у налаштуваннях.', '之后可以在设置中更改。', 'あとで設定から変更できます。'],
    ['Сегодня ничего не запланировано', 'Nothing planned for today', 'Heute nichts geplant', 'Сьогодні нічого не заплановано', '今天没有安排', '今日は予定なし'],
    ['Свободный день — отдохни', 'Free day — take a rest', 'Freier Tag — ruh dich aus', 'Вільний день — відпочинь', '空闲的一天，休息一下吧', '自由な日 — ゆっくりしてね'],
    ['Wi‑Fi выключен', 'Wi‑Fi is off', 'WLAN ist aus', 'Wi‑Fi вимкнено', 'Wi‑Fi 已关闭', 'Wi‑Fi はオフ'],
    ['Wi‑Fi включён', 'Wi‑Fi is on', 'WLAN ist an', 'Wi‑Fi увімкнено', 'Wi‑Fi 已开启', 'Wi‑Fi はオン'],
    ['Bluetooth выключен', 'Bluetooth is off', 'Bluetooth ist aus', 'Bluetooth вимкнено', '蓝牙已关闭', 'Bluetooth はオフ'],
    ['Bluetooth включён', 'Bluetooth is on', 'Bluetooth ist an', 'Bluetooth увімкнено', '蓝牙已开启', 'Bluetooth はオン'],
    ['Wi‑Fi отключён', 'Wi‑Fi disconnected', 'WLAN getrennt', 'Wi‑Fi відключено', 'Wi‑Fi 已断开', 'Wi‑Fi を切断しました'],
    ['Нет сопряжённых устройств', 'No paired devices', 'Keine gekoppelten Geräte', 'Немає спарених пристроїв', '没有已配对设备', 'ペアリング済みデバイスなし'],
    ['подключено', 'connected', 'verbunden', 'підключено', '已连接', '接続済み'],
    ['сопряжено', 'paired', 'gekoppelt', 'спарено', '已配对', 'ペアリング済み'],
    ['Отключиться', 'Disconnect', 'Trennen', 'Відключитися', '断开', '切断'],
    ['Подключить', 'Connect', 'Verbinden', 'Підключити', '连接', '接続'],
    ['Пароль', 'Password', 'Passwort', 'Пароль', '密码', 'パスワード'],
    ['Неверный пароль', 'Wrong password', 'Falsches Passwort', 'Невірний пароль', '密码错误', 'パスワードが違います'],
    ['Пока пусто. Напиши задачу и нажми Enter.', 'Empty for now. Type a task and press Enter.', 'Noch leer. Aufgabe eingeben und Enter drücken.', 'Поки порожньо. Напиши завдання й натисни Enter.', '暂无任务。输入后按回车。', 'まだ空です。タスクを入力して Enter。'],
    ['Скопируй любой текст — он появится здесь.', 'Copy any text — it will appear here.', 'Kopiere Text — er erscheint hier.', 'Скопіюй будь-який текст — він з\'явиться тут.', '复制任何文字，都会显示在这里。', 'テキストをコピーするとここに表示されます。'],
    ['Закреплено', 'Pinned', 'Angeheftet', 'Закріплено', '已固定', '固定済み'],
    ['Закрепить', 'Pin', 'Anheften', 'Закріпити', '固定', '固定'],
    ['Копировать', 'Copy', 'Kopieren', 'Копіювати', '复制', 'コピー'],
    ['Скопировано', 'Copied', 'Kopiert', 'Скопійовано', '已复制', 'コピーしました'],
    ['всё сделано!', 'all done!', 'alles erledigt!', 'усе зроблено!', '全部完成！', '全部完了！'],
    ['Сегодня', 'Today', 'Heute', 'Сьогодні', '今天', '今日'],
    ['Ясно', 'Clear', 'Klar', 'Ясно', '晴', '晴れ'],
    ['Переменная облачность', 'Partly cloudy', 'Teilweise bewölkt', 'Мінлива хмарність', '多云', '晴れ時々曇り'],
    ['Пасмурно', 'Overcast', 'Bedeckt', 'Хмарно', '阴', '曇り'],
    ['Туман', 'Fog', 'Nebel', 'Туман', '雾', '霧'],
    ['Морось', 'Drizzle', 'Nieselregen', 'Мряка', '毛毛雨', '霧雨'],
    ['Дождь', 'Rain', 'Regen', 'Дощ', '雨', '雨'],
    ['Снег', 'Snow', 'Schnee', 'Сніг', '雪', '雪'],
    ['Ливень', 'Showers', 'Schauer', 'Злива', '阵雨', 'にわか雨'],
    ['Снегопад', 'Snowfall', 'Schneefall', 'Снігопад', '大雪', '降雪'],
    ['Гроза', 'Thunderstorm', 'Gewitter', 'Гроза', '雷雨', '雷雨'],
    ['Задача выполнена!', 'Task done!', 'Aufgabe erledigt!', 'Завдання виконано!', '任务完成！', 'タスク完了！'],
    ['Без имени', 'No name', 'Ohne Namen', 'Без імені', '未命名', '名前なし'],
    ['Локальный профиль', 'Local profile', 'Lokales Profil', 'Локальний профіль', '本地账户', 'ローカルプロフィール'],
    ['Таймер закончился!', 'Time\'s up!', 'Zeit ist um!', 'Таймер завершився!', '时间到！', '時間です！'],
    ['Не беспокоить: уведомления скрыты', 'Do not disturb: notifications hidden', 'Nicht stören: Benachrichtigungen aus', 'Не турбувати: сповіщення приховано', '勿扰：通知已隐藏', '応答不可：通知を非表示'],
    ['Уведомления снова включены', 'Notifications are back on', 'Benachrichtigungen wieder an', 'Сповіщення знову увімкнено', '通知已重新开启', '通知を再開しました'],
    ['Звук выключен', 'Sound off', 'Ton aus', 'Звук вимкнено', '声音已关闭', 'サウンドオフ'],
    ['Звук включён', 'Sound on', 'Ton an', 'Звук увімкнено', '声音已开启', 'サウンドオン'],
    ['Процессор', 'CPU', 'Prozessor', 'Процесор', '处理器', 'CPU'],
    ['Память', 'Memory', 'Arbeitsspeicher', 'Пам\'ять', '内存', 'メモリ'],
    ['Диск C:', 'Disk C:', 'Laufwerk C:', 'Диск C:', '磁盘 C:', 'ディスク C:'],
    ['Батарея', 'Battery', 'Akku', 'Батарея', '电池', 'バッテリー'],
    ['Скриншот сохранён и скопирован · открыть', 'Screenshot saved & copied · open', 'Screenshot gespeichert & kopiert · öffnen', 'Знімок збережено й скопійовано · відкрити', '截图已保存并复制 · 打开', 'スクショを保存・コピー · 開く'],
    ['Не спится', 'Can\'t sleep', 'Kannst du nicht schlafen', 'Не спиться', '睡不着吗', '眠れないの'],
    ['Доброе утро', 'Good morning', 'Guten Morgen', 'Доброго ранку', '早上好', 'おはよう'],
    ['Привет', 'Hi', 'Hallo', 'Привіт', '你好', 'こんにちは'],
    ['Добрый вечер', 'Good evening', 'Guten Abend', 'Доброго вечора', '晚上好', 'こんばんは'],
    ['Жду ответа в браузере…', 'Waiting for the browser…', 'Warte auf den Browser…', 'Чекаю відповіді в браузері…', '等待浏览器响应…', 'ブラウザを待っています…'],
    ['Открыть параметры', 'Open settings', 'Einstellungen öffnen', 'Відкрити параметри', '打开设置', '設定を開く']
  ];
  const P = [
    [/^осталось (\d+)$/, ['$1 left', 'noch $1', 'залишилось $1', '剩余 $1', '残り $1']],
    [/^(\d+) (задача|задачи|задач) на сегодня$/, ['$1 tasks today', '$1 Aufgaben heute', '$1 завдань на сьогодні', '今天 $1 项任务', '今日のタスク $1 件']],
    [/^До твоего дня рождения (\d+) \S+$/, ['$1 days until your birthday', 'Noch $1 Tage bis zu deinem Geburtstag', 'До твого дня народження $1 дн.', '距离你的生日还有 $1 天', '誕生日まであと $1 日']],
    [/^Ощущается как (-?\d+)° · влажность (\d+)% · ветер (\d+) м\/с$/, ['Feels like $1° · humidity $2% · wind $3 m/s', 'Gefühlt $1° · Feuchte $2% · Wind $3 m/s', 'Відчувається як $1° · вологість $2% · вітер $3 м/с', '体感 $1° · 湿度 $2% · 风速 $3 m/s', '体感 $1° · 湿度 $2% · 風 $3 m/s']],
    [/^свободно (.+) ГБ$/, ['$1 GB free', '$1 GB frei', 'вільно $1 ГБ', '可用 $1 GB', '空き $1 GB']],
    [/^Подключено к (.+)$/, ['Connected to $1', 'Verbunden mit $1', 'Підключено до $1', '已连接到 $1', '$1 に接続しました']],
    [/^Открываю (.+)$/, ['Opening $1', 'Öffne $1', 'Відкриваю $1', '正在打开 $1', '$1 を開いています']]
  ];
  const map = new Map(D.map(r => [r[0], r]));
  let lang = 'ru';
  const SKIP = el => el && el.closest && el.closest('#chat, .clip p, .task span, .mt, .ma, #wCity, .app span, #oLang, #sLang, .net b, .dev b');

  function tr(s) {
    if (lang === 'ru' || !s) return s;
    const i = L.indexOf(lang), r = map.get(s);
    if (r) return r[i] || s;
    for (const [re, t] of P) if (re.test(s)) return s.replace(re, t[i - 1]);
    return s;
  }
  function doText(n) {
    if (SKIP(n.parentElement)) return;
    const cur = n.nodeValue;
    if (n.__src == null || (cur !== n.__src && cur !== n.__out)) n.__src = cur;
    const src = n.__src, t = src.trim();
    if (!t) return;
    const out = src.replace(t, tr(t));
    n.__out = out;
    if (cur !== out) n.nodeValue = out;
  }
  function doEl(el) {
    if (SKIP(el)) return;
    for (const a of ['placeholder', 'title']) {
      if (!el.hasAttribute(a)) continue;
      const k = 'data-ru-' + a;
      if (!el.hasAttribute(k)) el.setAttribute(k, el.getAttribute(a));
      const v = tr(el.getAttribute(k));
      if (el.getAttribute(a) !== v) el.setAttribute(a, v);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doEl(root);
    root.querySelectorAll('[placeholder],[title]').forEach(doEl);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) doText(n);
  }
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') doText(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.I18N = {
    get lang() { return lang; },
    T: tr,
    set(l) { lang = L.includes(l) ? l : 'ru'; document.documentElement.lang = lang; walk(document.body); }
  };
})();
