# CLAUDE.md

## 開発ルール（必須）

- **AI（Claude）がこのプロジェクトのファイルに修正を加えたら、その作業の最後に必ず `git commit` すること。**
  - 1つのまとまった変更（機能追加・修正・調整）ごとに1コミット。
  - コミットメッセージは日本語で、何をしたかが分かる概要を書く（例: `銅像の光背を追加`）。
  - コミット前に `git status` と `git diff --stat` で変更内容を確認する。
  - 動作確認（最低限 `node --check app.js`）を通してからコミットする。

## プロジェクト概要

「Seven Dreams World」— ブランドテーマ **夢と生きる。** の世界を、ブラウザ上の 3D 空間で
歩けるようにした「ペーパーワールド・メタバース」のプロトタイプ。

- ビジュアルは `SevenDreams/kv-pc.png`（白い紙の建物＋赤いサインの街並み）を参考に、
  **ペーパーマリオ調＝紙のように薄く・輪郭線つき・立体**で再現する。
- 街の各キャラクターは `SevenDreams/ph-music-01.png` の7体（smile / next / air / punch /
  move / hope / heart）を配置。
- **街の中心には竹田氏（`SevenDreams/takeda_main_0710re.jpg`）の銅像を、神様のように豪華に祀る**。
- 世界のブランドカラーは **SevenDreams レッド `#E60013`**。
- 将来的には cluster / VRChat 展開も視野（それらは Unity 等での別実装）。
  本リポジトリはブラウザ版 = Three.js 実装。

## 実行方法

```
start.bat をダブルクリック
```

- `start.bat` は **`serve.py`（Range 対応の HTTP/1.1 サーバー）** を起動し、ブラウザで
  `http://localhost:8000/index.html` を開く。
  - **`python -m http.server` は使わない**。標準サーバーは Range(206) 非対応で、
    mp4 動画が「再生できません」になる。`serve.py` は Range に対応し動画が正しく再生される。
- **`file://` で index.html を直接開くと動画・画像・音声（テクスチャ/BGM）がブロックされるため、
  必ずHTTPサーバー経由で開くこと。**
- **入場パスワード**: プレイ前に `#gate` のパスワード入力あり。合言葉は **`executive`**
  （index.html 内で `atob('ZXhlY3V0aXZl')` と比較。変更する場合はここ）。クライアント側の簡易ゲート。
- `.bat` ファイルには日本語（非ASCII文字）を書かない。cmd の文字コード（Shift-JIS）で
  化けて誤実行されるため、ASCIIのみで書く。

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | エントリ。パスワードゲート / UI（開始オーバーレイ / HUD / 操作ガイド / BGM・動画音ボタン）、Three.js 読み込み、`<audio id="bgm">` |
| `app.js` | 本体。シーン構築・地面・建物・キャラ・銅像・モニター・操作系すべて |
| `serve.py` | ローカルサーバー（Range 対応・キャッシュ無効）。start.bat から起動 |
| `start.bat` | サーバー起動用（ASCIIのみ）。`python serve.py 8000` |
| `tools/faststart-mp4.py` | mp4 の moov を先頭へ移す faststart 変換ツール |
| `vendor/` | Three.js r128 と PointerLockControls（ローカル同梱・オフライン動作） |
| `CLAUDE.md` | このファイル |

## アセット配置（差し替え場所）

素材は `asset/` 以下に置く。**ここが「どこに置くか」の答え**。

| ディレクトリ | 用途 | 現在のファイル |
|---|---|---|
| **`asset/bgm/`** | **BGM**。ファイル名は `index.html` の `<audio id="bgm">` の `<source src>` で直接指定する | `nanaironotaiyou_vo-2db.mp3` |
| **`asset/monitor/video/`** | **動画モニター**に映す動画。`video-1.mp4` | `video-1.mp4` |
| **`asset/monitor/image/`** | **静止画モニター**に映す画像。`image-1.png` | `image-1.png` |
| **`asset/plane/`** | **飛行機**の画像（横向き・**ノーズ左**の透明PNG）。`plane.png` | `plane.png`（TRAVEL の文字入り） |
| **`asset/people/`** | **人物（最大3人）**の画像（横向き・左向き推奨の透明PNG）。`person-1.png`〜`person-3.png` | 未配置（無ければ線画の人） |
| **`asset/tree/`** | **木**の画像（幹＋樹冠のフルツリー、透明PNG）。`tree.png`（全部の木に共通で使用） | 未配置（無ければ線画の木） |
| `asset/char/` | キャラの立ち絵（`ph-music-01.png` を透明背景で1体ずつ自動スライス済み） | `smile/next/air/punch/move/hope/heart.png` |
| `asset/statue/` | 銅像の肖像（`takeda_main_...jpg` をブロンズ2階調に加工） | `takeda_bronze.png`, `takeda_face.png` |
| `asset/kv/` | キービジュアル参考 | `kv-pc.png` |

- **BGMの置き場所**: `asset/bgm/` に置き、`index.html` の `<source src>` をそのファイル名に合わせる。
  スタート画面をクリック（＝ユーザー操作）した
  瞬間に再生開始（ブラウザの自動再生ポリシー対応）。画面右上の「♪ BGM」ボタン / `B` キーで ON/OFF。
- **動画の差し替え**: `asset/monitor/video/video-1.mp4` を置き換える。音声は既定ミュート、
  「🔇 動画」ボタン / `M` キーで ON/OFF（自動再生ポリシー上ミュート開始が必須）。
  - コーデックは **H.264(avc1) 推奨**。`serve.py`（Range 対応）で開けば moov が末尾の mp4 でも
    シークして再生できるが、**うまく再生されないときは faststart 化**すると確実：
    `python tools/faststart-mp4.py asset/monitor/video/video-1.mp4`（moov を先頭へ移動。
    元は `.original.mp4` にバックアップ）。※過去に「再生できません」が出たのは Range 非対応サーバーが原因で、
    `serve.py` 導入で解決済み。
  - モニター素材は `?cb=時刻` を付けて読み込むためキャッシュされない（差し替え後は再読込で最新が出る）。
- **静止画の差し替え**: `asset/monitor/image/image-1.png` を置き換える。
- 素材が読めない場合は「準備中」プレースホルダを表示し、読込成功時に本素材へ差し替える。
- ファイル名を増やす／変える場合は `app.js` の `addMonitor(...)` 呼び出し（末尾付近）を修正する。

## アーキテクチャ（app.js）

Three.js は r128（クラシックなグローバルビルド、CDN読み込み）。**ES5 構文**で書く。
テクスチャ（サイン・扉・地面ハッチ・樹冠・ネームプレート等）はすべて **Canvas 2D で手続き生成**、
キャラ立ち絵・銅像肖像・モニター素材だけ画像/動画ファイルを読み込む。

### ペーパーワールドの作り方（見た目の要）

- **建物** = 1つの `BoxGeometry`（6面マテリアル）。正面（+z＝マテリアル index 4）だけ
  `makeBuildingFront()` の Canvas テクスチャ（白い紙・黒い輪郭・**赤いサインプレート＋白文字**・扉・窓）。
  他面は白い紙マテリアル。全体に `EdgesGeometry` の黒線（`addEdges`）を重ねて輪郭を出す＝紙／
  ペーパーマリオ調。屋根に薄い赤い板（`#E60013`）でアクセント。
- 建物は `BUILDINGS` 配列で **極座標（`ang` 度・`rad` 半径）** に円形配置。`rotY` で正面を中心へ向ける。
  ラベルは kv-pc.png の街区（HOSPITAL / BOOKS / NURSERY / ONLINE COLLEGE / BEAUTY SALON /
  COSMETICS / NURSING / TRAVEL / MENTAL HEALTH / FOOD）。
- **地面** = 白い床＋**赤い斜線ハッチの楕円ステージ**（kv 準拠）＋中央の円形プラザ（赤リング）。
- **木** = 幹（シリンダー）＋十字2枚プレーンの雲形樹冠（`makeCanopyTex` の Canvas 輪郭）。
- **空** = `addSky` のグラデーションドーム（天頂の水色→白い紙→地平線の桜色）。**彩度は低めに**
  抑える（空だけ写実的だと街の紙っぽさが浮く）。
- **雲** = `makeCloudTex` の板ポリ。樹冠と同じスカラップ輪郭＝白い紙＋黒い輪郭線で、内側の下半分に
  薄い影を敷いて紙の重なりを出す。ライトを受けない `MeshBasicMaterial`（紙の白さを保つ）。
  `updateClouds` が街のまわりを**ゆっくり周回**させる＝端でワープしないので消えて湧かない。
  住人と同じく毎フレームこちらを向かせる（板なので向きを固定すると真横で消える）。
- **キャラ** = `asset/char/*.png` を貼った両面プレーンの「ペーパー・スタンディ」。足元に白い丸台。
  `characters[]` に登録し、毎フレーム上下ゆれ／`air` は浮遊回転。
- **立ち絵の向きを固定しないこと**。厚みゼロの板なので向きを固定すると**真横に回り込んだ瞬間に消える**。
  `faceCamera(rec, dir)` が毎フレーム Y軸だけこちらへ向ける（吹き出しと同じ考え方）。
  左右反転は「進行方向が画面のどちら向きに見えるか」で決める＝絵は左向きなので、
  画面右へ進んで見えるときだけ `setFlip(-1)` で鏡にする。**文字入りの飛行機だけは固定向きのまま**。
- **住人は街を歩き回る（World を散歩する）**。`roamPoint(rMin, rMax)` が銅像のまわりのリング
  （地上 `ROAM_MIN`〜`ROAM_MAX`、鳥は `BIRD_MIN`〜`BIRD_MAX`、モニター前は除外）から行き先を1点えらび、
  `stepToward` がそこへ向かって歩く。着いたら次の行き先を決める＝その場で向きが変わるだけ。
  **住人の位置を瞬間移動させないこと**（レーン端のワープは「消えて別の場所から湧く」＝
  同じキャラが増えたように見えるのでやめた。視界外で入れ替える仕組みも入れない）。
  **キャラ（マスコット7体）は最初に1体ずつだけつくってそのまま居続ける。人は同じ絵が重なってもよい**。
  鳥（`air`）も同じ理屈で街の上を飛び回る。**飛行機だけは遠景の演出なので今も WRAP でループ**。
- **空の板ポリ（飛行機）の向きに注意**。来場者は南(-z)から北を向くので、**画面の右＝ワールドの -x**。
  `rotation.y = 0` のままだと絵が左右反転して見え（文字入りの素材なら鏡文字になる）、
  `rotation.y = Math.PI` で正対する。正対させると絵の左端が +x 側に来るので、
  ノーズ左の素材は `dir = +1`（+x へ進行＝画面では右→左）にしてノーズを先頭にする。
  （住人の立ち絵は `faceCamera` が毎フレーム向きを決めるので、この固定向きの話は飛行機だけ。）

### 住人に話しかける（吹き出し）

- **住人をタップ（スマホ）／照準を合わせてクリック（PC）すると吹き出しが出る**。
  もう一度で次の台詞へ。`TALK_SEC` 秒で自動的に消え、話している間その住人は立ち止まる。
- 台詞は `addMascotWalker(file, width, name, lines)` / `addPersonWalker(file, name, lines)` /
  `addBird(width, h, name, lines)` の引数で渡す（**文言を変えるのは末尾の住人配置の配列**）。
  `lines` を渡さなければ話しかけ対象外。話しかけ対象は `makeTalker` が `talkers[]` に登録する。
- **7体のうち `air` だけ空を飛ぶ**（`floaters`）が、他と同じく話しかけられる。
  空の住人も止められるよう `updateFloaters` は `f.talk.talkUntil` を見る。鳥が速いと狙えないので
  速度は地上の住人（0.7〜1.4）より少し速い程度に留めてある。
- 吹き出しは `makeBubbleTex` の Canvas（白い紙・黒い輪郭・しっぽ・赤い名前）を貼った板ポリで、
  毎フレーム `quaternion.copy(camera.quaternion)` で常にこちらを向く。位置は `placeBubble` が
  **立ち絵の実際の高さ**（`position.y + scale.y/2`）から出す。地上前提の `baseY` で書くと鳥がズレる。
  出した瞬間に `placeBubble` を呼ぶこと（呼ばないと最初の1フレームだけ原点に出る）。
- **改行は句読点で切る**。`layoutText` が台詞を「、。！？の直後」（`segments`）で区切り、
  その単位で行に詰める。単位が1つも割れない大きさまで字を縮めるので、語の途中では改行されない。
  行頭に「。」が落ちないよう `NO_LINE_START` の禁則も入れてある。
  **台詞に読点を入れておくと改行位置を作れる**（読点が無い長文は字が小さくなる）。
- 当たり判定は `colliders` ではなく **`THREE.Raycaster`**（`talkMeshes()` の立ち絵だけが対象、
  `far = TALK_RANGE`）。立ち絵は透明部分も含む板なので、当たりはやや広め＝タップしやすい。
- **タップ判定に「速さ」を入れないこと**。ゆっくり触ってもタップのつもりなので、
  視点ドラッグと区別できればよく、それは移動量（`tapMove`）だけで足りる。

### 中央の銅像モニュメント（`addStatueMonument`）

- 多段の白い台座（`tier()`：赤トリム＋灰縁）＋四隅の**金の装飾柱**＋**金の光背リング**（回転）＋
  光の柱（半透明）＋赤カーペット。
- 竹田氏の**ブロンズ肖像**（`asset/statue/takeda_bronze.png`）を**金の額縁**に入れて立像として掲示（表裏両面）。
- **ネームプレート**（赤地・白/金文字・金枠）は2行「Seven Dreams Group（金・小） / Toshiya Takeda（白・大）」。
  名前が主役なので、金枠に収まる幅まで自動で縮める組み方にしてある。
  文言を変えるときは `addStatueMonument` 内のネームプレート Canvas 描画部分（`npx.fillText(...)`）。
- 台座の当たり判定は `addCollider(0,0,5.6,5.6)`。

### モニター（`addMonitor` / 動画1・静止画1）

- 脚2本＋黒フレーム＋スクリーン＋赤いラベル帯。`makeVideoMat` は `VideoTexture`、
  `makeImageMat` は `TextureLoader`。読込前は `makePlaceholderTex` の「準備中」。
- 参道の左右に1面ずつ配置（正面を来場者側へ向ける）。位置・向きは `addMonitor(...)` 呼び出しで調整。

### 当たり判定・操作

- 当たり判定は `colliders` の AABB リスト（`addCollider` で登録）。構造物を足したらここにも追加。
  移動は楕円ステージ内に `clampToGround` でクランプ。
- WASD移動 / Shift走る / Space ジャンプ / ホイール=FOVズーム / **F**=浮遊モード
  （重力なし・Space上昇/Shift下降/Ctrl加速）/ **B**=BGM / **M**=動画音 / ESC=ロック解除。
- スマホ：**スマホゲームの標準配置に合わせる＝左下スティックで移動・右下ボタンでアクション**。
  1本指ドラッグ＝視点、2本指ピンチ＝ズーム。`isTouch` で分岐し、キー操作前提の HUD と
  操作ガイドは非表示、浮遊バッジも短い文言に差し替える。
  - **視点ドラッグはストリートビュー式**（指でつかんだ景色が指についてくる＝マウス視点とは符号が逆）。
    向きを変えるなら `setupTouchLook` の `lookEuler.y += / .x +=` の符号。
  - **`setupTouchLook` では `e.touches` を使わない**。あれは画面上の全タッチを数えるので、
    移動スティックを握った指まで含まれ「歩きながら視点ドラッグ」がピンチと誤爆する。
    その層で始まった指だけを見る `e.targetTouches` を使うこと。
  - 浮遊中は Shift が下降に割り当たるため、「走る」ボタンは加速(Ctrl)へ振り分ける。
    ジャンプは上昇／下降の2ボタンに入れ替える。
  - 固定配置のUIは `env(safe-area-inset-*)` を `--sat/--sar/--sab/--sal` 経由で余白に加算する
    （`viewport-fit=cover` のためノッチ／ホームバーに潜り込む）。狭幅は `max-width:480px`、
    横画面は `max-height:430px` のメディアクエリで縮小。**UIを足したら重なりを実測すること**。

## 変更時の注意

- 動画・BGMの自動再生はブラウザポリシー上、**ユーザー操作（スタートのクリック/タップ）後**に開始。
  動画は必ずミュート開始、音は `M`／ボタンで。
- キャラを増やすときは `addMascotWalker(file, width, name, lines)`。`lines` を渡すと話しかけられる。
- キャラ立ち絵を作り直すときは `ph-music-01.png` を透明背景の連結成分でスライスする
  （左→右順に smile / next / air / punch / move / hope / heart）。
- Canvas テクスチャは 4096px を超えないよう注意。
