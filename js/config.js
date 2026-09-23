// ===== Dash 接続設定 =====
// publishable キーは公開前提の値なので、静的アプリに埋め込んでOK（service_role は絶対に置かない）
export const SUPABASE_URL = 'https://opscwteqwmngkzfjixwb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_owRX-fySRlXttQGM_gpwYQ_xFd1fZTH';

// 先生用ページのパスコード
export const TEACHER_PASSCODE = 'Dish-dash-t';

// LINE LIFF（LINE内でDashを開く用）。LINE DevelopersでLIFFアプリを作ると発行されるID
export const LIFF_ID = '';   // 例: '2011704841-abcd1234'（もらったらここに入れる）

// オンライン教室（固定のGoogle Meetルーム）。ルームURLをここに入れる
export const MEET_URL = '';  // 例: 'https://meet.google.com/xxx-xxxx-xxx'
