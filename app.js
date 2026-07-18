/* =========================================================================
   Seven Dreams World — ペーパーワールド 3D メタバース（プロトタイプ）
   kv-pc.png の「白い紙の建物＋赤いサイン」の街並みを立体（ペーパーマリオ調）で再現。
   キャラ（ph-music-01.png をスライス）を配置し、街の中心に竹田氏の銅像を神様として祀る。
   ブランドカラー #E60013。Three.js r128（グローバルビルド）/ ES5。
   ========================================================================= */
(function () {
  "use strict";

  // ---- ブランド定数 -------------------------------------------------------
  var SD_RED = 0xE60013;
  var SD_RED_CSS = "#E60013";
  var PAPER = 0xffffff;
  var INK = 0x222222;
  var GOLD = 0xE2B060;

  // ---- ユーティリティ -----------------------------------------------------
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function makeCanvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function texFromCanvas(c) { var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; return t; }

  // ---- レンダラ / シーン --------------------------------------------------
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  var MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  // 空：てっぺんの水色 → 白い紙 → 地平線の桜色のグラデーションドーム。
  // 紙の世界なので、ベタ塗りの色画用紙を重ねたような素直なグラデーションにする
  // （空だけ写実的だと街の紙っぽさが浮くため、彩度は低めに抑える）。
  (function addSky() {
    var c = makeCanvas(8, 256), x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, "#6fbfe8");   // 天頂：水色の画用紙
    g.addColorStop(0.32, "#9ed6f2");
    g.addColorStop(0.60, "#cfeafa");
    g.addColorStop(0.82, "#f4fafd");  // 下のほうで白い紙に抜ける
    g.addColorStop(1.0, "#ffe6ea");   // 地平線：桜色（街となじませる）
    x.fillStyle = g; x.fillRect(0, 0, 8, 256);
    // **toneMapped: false** が要る。ACES トーンマッピングを通すと淡い色が
    // 白に飛んで「空に色が付いていない」ように見える（雲も同じ理由で外す）
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(420, 24, 16),
      new THREE.MeshBasicMaterial({ map: texFromCanvas(c), side: THREE.BackSide, fog: false, toneMapped: false })
    );
    dome.userData.shadow = "none";
    scene.add(dome);
    scene.background = new THREE.Color(0x9ed6f2);
  })();

  // ---- 雲（紙を切り抜いたもこもこ） ---------------------------------------
  // **輪郭を stroke で描かないこと**。ふくらみを円弧でつないで stroke すると、
  // 円と円の継ぎ目の線が内側に出て「ぐちゃぐちゃ」になる。
  // 代わりに「黒い円をひと回り大きく塗る → その上に本体の円を塗る」で、
  // 重なった輪郭（union）の外側だけが黒く残る＝きれいな1本の輪郭線になる。
  // 白い紙を少し上へずらして重ね、下に水色の紙をのぞかせて「紙2枚重ね」にする。
  var clouds = [];
  function makeCloudTex() {
    var W = 512, H = 256, LINE = 7, BASE = 200;   // 輪郭の太さ／雲の底辺
    // BASE は「雲がキャンバスの中央に来る」値。ずらすと板ポリの中で雲が偏る。
    // ふくらみは底辺に接する円（中心 y = BASE - r）にすると、底が平らな雲になる
    // **隣り合うふくらみは必ず重ねること**（半径の和 > 間隔）。離れていると
    // それぞれに輪郭が付いて、下の帯に団子を刺したような形になる
    var n = 4 + Math.floor(Math.random() * 3), span = 260, x0 = (W - span) / 2, parts = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var r = 44 + Math.sin(t * Math.PI) * rand(20, 36);   // 中央がいちばん高い
      parts.push({ x: x0 + span * t, y: BASE - r, r: r });
    }
    // ふくらみ＋底の帯をまとめて塗る（帯が円と円のすき間を埋めて1つの塊にする）
    function blob(ctx, grow, color) {
      ctx.fillStyle = color;
      for (var i = 0; i < parts.length; i++) {
        ctx.beginPath(); ctx.arc(parts[i].x, parts[i].y, parts[i].r + grow, 0, 6.28); ctx.fill();
      }
      var a = parts[0], b = parts[parts.length - 1];
      ctx.fillRect(a.x - grow, BASE - 34, (b.x - a.x) + grow * 2, 34 + grow);
    }
    // 本体：白い紙。影は "source-atop" で**シルエットの内側にだけ**乗せる。
    // （紙をずらして重ねると、ふくらみの継ぎ目に黒い線が残ってしまう）
    var s = makeCanvas(W, H), sx = s.getContext("2d");
    blob(sx, 0, "#ffffff");
    sx.globalCompositeOperation = "source-atop";
    var g = sx.createLinearGradient(0, BASE - 54, 0, BASE);
    g.addColorStop(0, "rgba(207,228,242,0)");
    g.addColorStop(1, "rgba(207,228,242,1)");        // 底ほど濃い水色＝紙の陰
    sx.fillStyle = g; sx.fillRect(0, BASE - 54, W, 60);
    sx.globalCompositeOperation = "source-over";
    // 輪郭：ひと回り大きい黒い塊を下に敷き、その上に本体を重ねる。
    // こうすると重なった外形の外側だけが黒く残る＝継ぎ目の出ない1本の輪郭線になる
    var c = makeCanvas(W, H), x = c.getContext("2d");
    blob(x, LINE, "#222222");
    x.drawImage(s, 0, 0);
    return texFromCanvas(c);
  }
  (function addClouds() {
    var tex = [makeCloudTex(), makeCloudTex(), makeCloudTex()];   // 3種を使い回す
    for (var i = 0; i < 14; i++) {
      var mat = new THREE.MeshBasicMaterial({
        map: tex[i % tex.length], transparent: true, alphaTest: 0.5,
        side: THREE.DoubleSide, fog: false, toneMapped: false
      });
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      var w = rand(34, 76);
      m.scale.set(w, w * 0.5, 1);
      m.userData.shadow = "none";
      m.renderOrder = -1;            // 空の一部として、街より先に描く
      scene.add(m);
      // 街のまわりをゆっくり周回する＝端でワープしないので消えて湧かない（住人と同じ考え方）
      clouds.push({
        mesh: m, r: rand(150, 330), ang: rand(0, Math.PI * 2),
        spd: rand(0.004, 0.012) * (Math.random() < 0.5 ? -1 : 1),
        y: rand(46, 118), phase: rand(0, 6.28)
      });
    }
  })();
  function updateClouds(dt, tsec) {
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i], m = c.mesh;
      c.ang += c.spd * dt;
      m.position.set(Math.cos(c.ang) * c.r, c.y + Math.sin(tsec * 0.12 + c.phase) * 1.5, Math.sin(c.ang) * c.r);
      // 板ポリなので常にこちらへ向ける（住人と同じ。向きを固定すると真横で消える）
      m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
    }
  }

  // ライト
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffe3e7, 0.95));
  var sun = new THREE.DirectionalLight(0xfff4ea, 0.85);
  sun.position.set(-40, 70, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // ---- マテリアル / アウトライン（ペーパー調） --------------------------
  function paperMat(color, rough) {
    return new THREE.MeshStandardMaterial({ color: color === undefined ? PAPER : color, roughness: rough === undefined ? 0.95 : rough, metalness: 0 });
  }
  function addEdges(mesh, color) {
    var e = new THREE.EdgesGeometry(mesh.geometry, 18);
    var l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: color === undefined ? INK : color }));
    l.userData.shadow = "none";
    mesh.add(l);
    return l;
  }

  // ---- 地面：白いベース＋赤ハッチの楕円ステージ（kv 準拠） --------------
  var GROUND_RX = 66, GROUND_RZ = 46;
  (function addGround() {
    // 一番下の白い床
    var base = new THREE.Mesh(new THREE.CircleGeometry(200, 48), paperMat(0xfffdfd, 1));
    base.rotation.x = -Math.PI / 2; base.position.y = -0.02;
    base.userData.shadow = "receive";
    scene.add(base);

    // 赤い斜線ハッチの楕円ステージ
    var hc = makeCanvas(1024, 1024), hx = hc.getContext("2d");
    hx.clearRect(0, 0, 1024, 1024);
    // 楕円クリップ
    hx.save();
    hx.beginPath(); hx.ellipse(512, 512, 500, 500, 0, 0, Math.PI * 2); hx.clip();
    hx.fillStyle = "#ffffff"; hx.fillRect(0, 0, 1024, 1024);
    // 斜線
    hx.strokeStyle = "rgba(230,0,19,0.16)"; hx.lineWidth = 7;
    for (var i = -1024; i < 1024; i += 22) {
      hx.beginPath(); hx.moveTo(i, 0); hx.lineTo(i + 1024, 1024); hx.stroke();
    }
    hx.restore();
    // 縁取り
    hx.strokeStyle = SD_RED_CSS; hx.lineWidth = 10;
    hx.beginPath(); hx.ellipse(512, 512, 496, 496, 0, 0, Math.PI * 2); hx.stroke();
    var stage = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshStandardMaterial({ map: texFromCanvas(hc), roughness: 1, transparent: true }));
    stage.scale.set(GROUND_RX, GROUND_RZ, 1);
    stage.rotation.x = -Math.PI / 2; stage.position.y = 0.01;
    stage.userData.shadow = "receive";
    scene.add(stage);

    // 中央の円形プラザ（白タイル＋赤リング）
    var pc = makeCanvas(512, 512), pxx = pc.getContext("2d");
    pxx.fillStyle = "#ffffff"; pxx.beginPath(); pxx.arc(256, 256, 250, 0, Math.PI * 2); pxx.fill();
    pxx.strokeStyle = SD_RED_CSS; pxx.lineWidth = 16; pxx.beginPath(); pxx.arc(256, 256, 240, 0, Math.PI * 2); pxx.stroke();
    pxx.lineWidth = 5; pxx.strokeStyle = "rgba(230,0,19,0.5)";
    for (var r = 60; r < 240; r += 40) { pxx.beginPath(); pxx.arc(256, 256, r, 0, Math.PI * 2); pxx.stroke(); }
    var plaza = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.MeshStandardMaterial({ map: texFromCanvas(pc), roughness: 1, transparent: true }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02;
    plaza.userData.shadow = "receive";
    scene.add(plaza);
  })();

  var colliders = [];
  function addCollider(cx, cz, hx, hz, pad) { pad = pad || 0.3; colliders.push({ minX: cx - hx - pad, maxX: cx + hx + pad, minZ: cz - hz - pad, maxZ: cz + hz + pad }); }

  // ---- 建物（白いペーパー＋赤いサイン、正面に扉） ------------------------
  function makeBuildingFront(w, h, label, opt) {
    opt = opt || {};
    var pw = 512, ph = Math.round(512 * h / w);
    var c = makeCanvas(pw, ph), x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, pw, ph);
    // 外枠（黒インク）
    x.strokeStyle = "#222"; x.lineWidth = Math.max(4, pw * 0.012);
    x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, pw - x.lineWidth, ph - x.lineWidth);
    // 扉
    var doorW = pw * 0.30, doorH = ph * 0.42, dx = pw / 2 - doorW / 2, dy = ph - doorH - ph * 0.02;
    x.fillStyle = "#f3f3f3"; x.strokeStyle = "#222"; x.lineWidth = pw * 0.010;
    x.beginPath();
    if (opt.arch) {
      x.moveTo(dx, ph); x.lineTo(dx, dy + doorW / 2);
      x.arc(pw / 2, dy + doorW / 2, doorW / 2, Math.PI, 0);
      x.lineTo(dx + doorW, ph);
    } else {
      x.rect(dx, dy, doorW, doorH);
    }
    x.fill(); x.stroke();
    // 丸窓（arch建物）or 角窓
    x.fillStyle = "#eef6ff"; x.strokeStyle = "#222"; x.lineWidth = pw * 0.009;
    if (opt.round) {
      x.beginPath(); x.arc(pw / 2, ph * 0.30, pw * 0.10, 0, Math.PI * 2); x.fill(); x.stroke();
    } else if (!opt.noWin) {
      var wy = ph * 0.30;
      [pw * 0.24, pw * 0.76].forEach(function (wx) {
        x.beginPath(); x.rect(wx - pw * 0.09, wy - ph * 0.06, pw * 0.18, ph * 0.12); x.fill(); x.stroke();
      });
    }
    // 赤いサインプレート＋白文字
    var plH = ph * (opt.big ? 0.15 : 0.13), plY = ph * 0.10;
    x.fillStyle = SD_RED_CSS; x.fillRect(pw * 0.08, plY, pw * 0.84, plH);
    x.fillStyle = "#ffffff"; x.textAlign = "center"; x.textBaseline = "middle";
    var fs = plH * 0.62;
    x.font = "bold " + fs + "px 'Arial','Helvetica',sans-serif";
    while (x.measureText(label).width > pw * 0.78 && fs > 8) { fs -= 1; x.font = "bold " + fs + "px 'Arial',sans-serif"; }
    x.fillText(label, pw / 2, plY + plH / 2 + fs * 0.04);
    return texFromCanvas(c);
  }

  function addBuilding(cfg) {
    // cfg: {label, ang(deg), rad, w, h, d, color, arch, round, big}
    var w = cfg.w, h = cfg.h, d = cfg.d;
    var a = cfg.ang * Math.PI / 180;
    var cx = Math.sin(a) * cfg.rad, cz = Math.cos(a) * cfg.rad;
    var rotY = Math.atan2(-cx, -cz); // 正面(+z)を中心へ向ける

    var side = paperMat(cfg.color || PAPER);
    var top = paperMat(cfg.color || PAPER);
    var front = new THREE.MeshStandardMaterial({ map: makeBuildingFront(w, h, cfg.label, cfg), roughness: 0.96, metalness: 0 });
    // Box material order: px, nx, py, ny, pz(front), nz
    var mats = [side, side, top, top, front, side];
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(cx, h / 2, cz);
    mesh.rotation.y = rotY;
    addEdges(mesh);
    scene.add(mesh);

    // 屋根の赤いフチ（薄い板）でアクセント
    var band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.4, d + 0.1), new THREE.MeshStandardMaterial({ color: SD_RED, roughness: 0.8 }));
    band.position.set(cx, h + 0.18, cz); band.rotation.y = rotY;
    scene.add(band);

    // コライダー（回転を考慮した外接ボックス近似）
    var ex = Math.abs(Math.sin(rotY)) * d / 2 + Math.abs(Math.cos(rotY)) * w / 2;
    var ez = Math.abs(Math.cos(rotY)) * d / 2 + Math.abs(Math.sin(rotY)) * w / 2;
    addCollider(cx, cz, ex, ez, 0.4);
    return { x: cx, z: cz, rotY: rotY };
  }

  // kv-pc.png の街区（白い建物＋赤サイン）を円形に配置
  var BUILDINGS = [
    { label: "HOSPITAL",       ang:   0, rad: 40, w: 20, h: 10, d: 13, big: true },
    { label: "BOOKS",          ang: -30, rad: 39, w: 11, h: 12, d: 7, noWin: true },
    { label: "NURSERY",        ang:  30, rad: 39, w: 12, h: 8,  d: 9, arch: true, round: true },
    { label: "ONLINE COLLEGE", ang: -58, rad: 38, w: 12, h: 7,  d: 8 },
    { label: "BEAUTY SALON",   ang:  60, rad: 39, w: 13, h: 8,  d: 9, arch: true },
    { label: "COSMETICS",      ang: -88, rad: 37, w: 10, h: 6,  d: 8 },
    { label: "NURSING",        ang:-118, rad: 36, w: 12, h: 6,  d: 9 },
    { label: "TRAVEL",         ang: 100, rad: 37, w: 9,  h: 6,  d: 7 },
    { label: "MENTAL HEALTH",  ang:-150, rad: 33, w: 12, h: 5,  d: 8 },
    { label: "FOOD",           ang: 148, rad: 33, w: 11, h: 5,  d: 8 }
  ];
  BUILDINGS.forEach(addBuilding);

  // ---- ペーパーツリー（十字プレーンの雲形樹冠＋幹） ----------------------
  function makeCanopyTex() {
    var c = makeCanvas(256, 256), x = c.getContext("2d");
    x.clearRect(0, 0, 256, 256);
    x.fillStyle = "#ffffff"; x.strokeStyle = "#222"; x.lineWidth = 7; x.lineJoin = "round";
    // スカラップ状の“もこもこ雲”アウトライン（kv の木に近い単一輪郭）
    var cx = 128, cy = 128, R = 62, br = 28, n = 10;
    x.beginPath();
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 - Math.PI / 2;
      var bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R * 0.92;
      x.arc(bx, by, br, a - 1.5, a + 1.5);
    }
    x.closePath(); x.fill(); x.stroke();
    // 内側の葉のラインを少し
    x.strokeStyle = "rgba(34,34,34,0.4)"; x.lineWidth = 3;
    for (var k = 0; k < 4; k++) {
      x.beginPath(); var ax = 86 + k * 20; x.moveTo(ax, 92); x.quadraticCurveTo(ax + 8, 128, ax - 5, 168); x.stroke();
    }
    var t2 = new THREE.CanvasTexture(c); t2.encoding = THREE.sRGBEncoding; return t2;
  }
  var CANOPY_TEX = makeCanopyTex();
  var TREE_TEX = null, TREE_AR = 1; // asset/tree/tree.png（フルツリー画像）があれば全部の木に使う

  function addTree(x, z, s) {
    s = s || 1;
    var g = new THREE.Group();
    if (TREE_TEX) {
      // フルツリーのペーパースタンディ（十字2枚・幹なし・接地）
      var w = 3.4 * s, h = w * TREE_AR;
      var mat = new THREE.MeshStandardMaterial({ map: TREE_TEX, transparent: true, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
      for (var j = 0; j < 2; j++) {
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        pl.position.y = h / 2; pl.rotation.y = j * Math.PI / 2;
        pl.castShadow = false; pl.receiveShadow = false;
        g.add(pl);
      }
    } else {
      // 手続き生成（幹＋もこもこ樹冠）
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.6 * s, 7), paperMat(0xffffff));
      trunk.position.y = 0.8 * s; trunk.castShadow = true; trunk.receiveShadow = true; addEdges(trunk); g.add(trunk);
      var cmat = new THREE.MeshStandardMaterial({ map: CANOPY_TEX, transparent: true, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
      for (var i = 0; i < 2; i++) {
        var p = new THREE.Mesh(new THREE.PlaneGeometry(3.4 * s, 3.4 * s), cmat);
        p.position.y = 2.7 * s; p.rotation.y = i * Math.PI / 2;
        p.castShadow = false; p.receiveShadow = false;
        g.add(p);
      }
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  // 建物の間や外周に木を散らす（銅像・モニターも避けるため読み込み後に実行）
  function scatterTrees() {
    var n = 26;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
      var r = rand(20, GROUND_RX * 0.82);
      var x = Math.sin(a) * r, z = Math.cos(a) * r * (GROUND_RZ / GROUND_RX);
      if (Math.hypot(x, z) < 17) continue;
      if (z < -16 && Math.abs(x) < 15) continue; // 南の参道・スポーン地点は空ける
      var bad = false;
      for (var c2 = 0; c2 < colliders.length; c2++) { var c = colliders[c2]; if (x > c.minX - 2 && x < c.maxX + 2 && z > c.minZ - 2 && z < c.maxZ + 2) { bad = true; break; } }
      if (bad) continue;
      addTree(x, z, rand(0.8, 1.3));
    }
  }
  // asset/tree/tree.png があれば全部の木に使う。読み込み成功/失敗どちらでも散らす
  new THREE.TextureLoader().load("asset/tree/tree.png?cb=" + Date.now(),
    function (t) { t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; TREE_TEX = t; TREE_AR = t.image.height / t.image.width; scatterTrees(); },
    undefined,
    function () { scatterTrees(); });

  // ---- 住人：マスコット & 人 & 飛行機（ペーパー・スタンディ） -----------
  // 絵はすべて「左向き」。向きは毎フレーム `faceCamera` でこちらへ向ける（板なので固定すると横から消える）。
  // **住人は街を自由に歩き回る**。行き先をランダムに決めて歩き、着いたら次の行き先を決める
  // ＝ずっと同じ広場の中にいて、消えることも別の場所に湧くこともない。
  var walkers = [], floaters = [];
  var talkers = [];                      // 話しかけられる住人（地上の walker も空の鳥も入る）
  var ROAM_MIN = 11, ROAM_MAX = 26;      // 歩き回る範囲（中心の銅像を避け、建物 r>=31 には届かない）
  var WRAP = 76;                         // 飛行機の折返し x
  var BIRD_MIN = 12, BIRD_MAX = 32;      // 鳥が飛び回る範囲（街の上だけ）
  var FACE = Math.PI;                    // 立ち絵の初期向き（南向き。以降は faceCamera が毎フレーム更新）
  var MONITORS = [{ x: -13, z: -13 }, { x: 13, z: -13 }];   // 行き先に選ばない場所

  // ---- キャラ（マスコット7体） --------------------------------------------
  // 7体は最初に1体ずつだけつくって、そのまま World に居続ける。
  // **途中で消したり、別の場所に出し直したりしない**（消えて違うところから
  // 現れるのは「同じキャラが2体いる」ように見えるため）。人（住人）は同じ絵が重なってもよい。
  var _fwd = new THREE.Vector3();

  // 立ち絵は厚みゼロの板なので、向きを固定すると真横に回り込んだとき
  // 板を真横から見ることになって消えてしまう。毎フレームこちらを向かせる（Y軸だけ）。
  //
  // 左右反転は「**進行方向が画面のどちら向きに見えるか**」で決める。絵は左向きなので、
  // 画面の左へ進んで見えるときが素のまま、右へ進んで見えるときだけ鏡にする。
  // これを **進行方向ベクトル(vx,vz) と「画面右」ベクトルの内積**で判定すること。
  // x 成分だけで判定すると、斜めや奥行き方向に歩くとき／カメラが東西を向いたときに
  // 判定が逆になり、後ろ歩きに見える。
  var _camRight = new THREE.Vector3();
  function faceCamera(rec, vx, vz) {
    var m = rec.mesh;
    m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
    camera.getWorldDirection(_fwd);
    _camRight.set(-_fwd.z, 0, _fwd.x).normalize();        // 画面右にあたるワールド方向
    var s = vx * _camRight.x + vz * _camRight.z;          // ＋なら画面右へ進んで見える
    // 手前／奥へ歩いているときは左右がほぼ決まらない。前の向きを保ってちらつかせない
    if (s > 0.12) { if (rec.flip !== -1) rec.setFlip(-1); }
    else if (s < -0.12) { if (rec.flip !== 1) rec.setFlip(1); }
  }

  // 街のどこか（銅像のまわりのリング内）を1点えらぶ。モニターの前は避ける
  function roamPoint(rMin, rMax) {
    for (var i = 0; i < 24; i++) {
      var a = rand(0, Math.PI * 2), r = rand(rMin, rMax);
      var p = { x: Math.cos(a) * r, z: Math.sin(a) * r }, ok = true;
      for (var j = 0; j < MONITORS.length; j++) {
        var dx = p.x - MONITORS[j].x, dz = p.z - MONITORS[j].z;
        if (dx * dx + dz * dz < 25) { ok = false; break; }
      }
      if (ok) return p;
    }
    return { x: 0, z: rMax };
  }

  // 立ち絵プレーン（幅 width、縦横比は後から適用）
  function makeWalkerMesh(width, tex, aspect) {
    var mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide, color: 0xffffff });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.set(width, width, 1); mesh.userData.shadow = "none";
    mesh.rotation.y = FACE;
    var rec = { mesh: mesh, mat: mat, width: width, baseY: width * 0.5 + 0.02, ar: 1, flip: 1 };
    // 折返しで左右を反転させる（絵は左向き固定なので、右へ歩くときは鏡にして進行方向を向かせる）
    rec.setFlip = function (f) { rec.flip = f; mesh.scale.x = width * f; };
    rec.applyAspect = function (ar) { rec.ar = ar; mesh.scale.set(width * rec.flip, width * ar, 1); rec.baseY = width * ar * 0.5 + 0.02; mesh.position.y = rec.baseY; };
    if (aspect) { rec.applyAspect(aspect); if (tex) { mat.map = tex; mat.needsUpdate = true; } }
    return rec;
  }

  // 話しかけられる住人の共通部分。lines が無ければ話しかけ対象にしない
  function makeTalker(rec, name, lines) {
    var t = { rec: rec, name: name, lines: lines || null, line: -1, talkUntil: 0, bubble: null };
    rec.mesh.userData.walker = t;   // レイキャストの当たりから住人を引くため
    if (t.lines) talkers.push(t);
    return t;
  }

  // 地上を歩く住人を1体登録する。街のどこかに立たせて、最初の行き先を決める
  function pushWalker(rec, speed, name, lines) {
    var wk = makeTalker(rec, name, lines);
    wk.speed = speed; wk.phase = rand(0, 6.28); wk.vx = 0; wk.vz = 0;
    var p = roamPoint(ROAM_MIN, ROAM_MAX);
    rec.mesh.position.set(p.x, rec.baseY, p.z);
    wk.target = roamPoint(ROAM_MIN, ROAM_MAX);
    walkers.push(wk);
    scene.add(rec.mesh);
    return wk;
  }

  function addMascotWalker(file, width, name, lines) {
    var rec = makeWalkerMesh(width, null, null);
    new THREE.TextureLoader().load("asset/char/" + file + ".png", function (t) {
      t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
      rec.applyAspect(t.image.height / t.image.width); rec.mat.map = t; rec.mat.needsUpdate = true;
    });
    pushWalker(rec, rand(0.7, 1.4), name, lines);
  }

  // 人は asset/people/ の画像だけを使う。読めなければ「出さない」
  //（線画の人＝赤いスカーフのシルエットは廃止。素材の人物以外を街に出さないため）
  function addPersonWalker(file, name, lines) {
    if (!file) return;
    var w = rand(1.5, 1.9);
    var rec = makeWalkerMesh(w, null, null);
    var wk = pushWalker(rec, rand(0.8, 1.3), name, lines);
    new THREE.TextureLoader().load(file,
      function (t) {
        t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
        rec.applyAspect(t.image.height / t.image.width); rec.mat.map = t; rec.mat.needsUpdate = true;
      },
      undefined,
      function () { dropWalker(wk); });
  }

  // 素材が無かった住人を街から消す（歩行・話しかけ対象からも外す）
  function dropWalker(wk) {
    scene.remove(wk.rec.mesh);
    var i = walkers.indexOf(wk); if (i >= 0) walkers.splice(i, 1);
    i = talkers.indexOf(wk); if (i >= 0) talkers.splice(i, 1);
    _talkMeshes = null;
  }

  // 空を横切る鳥（air）。地上の住人と同じく name/lines を渡せば話しかけられる
  function addBird(width, h, name, lines) {
    var rec = makeWalkerMesh(width, null, null);
    new THREE.TextureLoader().load("asset/char/air.png", function (t) {
      t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
      rec.applyAspect(t.image.height / t.image.width); rec.mat.map = t; rec.mat.needsUpdate = true;
    });
    var talk = makeTalker(rec, name, lines);
    // 速いと狙ってタップできない。地上の住人（0.7〜1.4）より少し速い程度に留める
    // 鳥も地上の住人と同じく街の上を飛び回る（遠くへ飛び去らせない）
    var p = roamPoint(BIRD_MIN, BIRD_MAX);
    rec.mesh.position.set(p.x, h, p.z);
    floaters.push({
      mesh: rec.mesh, rec: rec, y: h, speed: rand(1.0, 1.6), phase: rand(0, 6.28),
      talk: talk, dir: 1, vx: 0, vz: 0, roam: true, target: roamPoint(BIRD_MIN, BIRD_MAX)
    });
    scene.add(rec.mesh);
  }

  // 飛行機（kv 上部の旅客機イメージ：横向き＝ノーズ左のシルエット）
  function makePlaneTex() {
    var c = makeCanvas(300, 120), x = c.getContext("2d");
    x.clearRect(0, 0, 300, 120);
    x.fillStyle = "#fff"; x.strokeStyle = "#222"; x.lineWidth = 6; x.lineJoin = "round"; x.lineCap = "round";
    // 主翼（後退翼＝後方＝右下へ）
    x.beginPath(); x.moveTo(150, 66); x.lineTo(214, 108); x.lineTo(236, 106); x.lineTo(176, 62); x.closePath(); x.fill(); x.stroke();
    // 尾翼（右上）
    x.beginPath(); x.moveTo(246, 48); x.lineTo(268, 14); x.lineTo(282, 16); x.lineTo(276, 50); x.closePath(); x.fill(); x.stroke();
    // 胴体（ノーズ＝左）
    x.beginPath();
    x.moveTo(20, 60);
    x.quadraticCurveTo(80, 42, 180, 44);
    x.quadraticCurveTo(250, 46, 284, 34);
    x.quadraticCurveTo(262, 60, 284, 86);
    x.quadraticCurveTo(250, 78, 180, 78);
    x.quadraticCurveTo(80, 80, 20, 60);
    x.closePath(); x.fill(); x.stroke();
    // 窓
    x.fillStyle = "#222";
    for (var i = 0; i < 7; i++) { x.beginPath(); x.arc(96 + i * 20, 58, 2.6, 0, 6.28); x.fill(); }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; return t;
  }
  // asset/plane/plane.png があれば使い、無ければ線画にフォールバック
  function addAirplane(size, h) {
    var mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    // 来場者は南(-z)から北を向いて見る＝画面の右がワールドの -x。rotation.y=0 のままだと
    // 絵が左右反転して見え、plane.png の "TRAVEL" が鏡文字になる。PI 回して正対させる。
    // これで絵の左端（ノーズ）が +x 側に来るので、進行方向も +x（dir=+1）にしてノーズを先頭にする。
    mesh.userData.shadow = "none"; mesh.rotation.y = Math.PI;
    var z = rand(18, 40);
    mesh.position.set(rand(-WRAP, WRAP), h, z); scene.add(mesh);
    floaters.push({ mesh: mesh, y: h, speed: rand(5, 7), phase: rand(0, 6.28), plane: true, dir: 1 });
    function apply(tex) { mesh.scale.set(size, size * tex.image.height / tex.image.width, 1); mat.map = tex; mat.needsUpdate = true; }
    var fallback = makePlaneTex();
    new THREE.TextureLoader().load("asset/plane/plane.png?cb=" + Date.now(),
      function (t) { t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; apply(t); },
      undefined,
      function () { apply(fallback); });
  }

  // ---- 吹き出し（キャラをタップ／クリックで話しかける） -------------------
  var TALK_SEC = 5.0;          // 吹き出しを出しておく秒数
  var TALK_RANGE = 26;         // 話しかけられる距離
  var talking = [];            // 吹き出しを作った住人

  // 角丸＋しっぽを1本のパスで描く（塗りと輪郭の継ぎ目を出さないため）
  function bubblePath(x, X, Y, W, H, r, tx) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.lineTo(X + W - r, Y);
    x.quadraticCurveTo(X + W, Y, X + W, Y + r);
    x.lineTo(X + W, Y + H - r);
    x.quadraticCurveTo(X + W, Y + H, X + W - r, Y + H);
    x.lineTo(tx + 64, Y + H);          // 下辺を右→左へ。途中でしっぽへ降りる
    x.lineTo(tx + 28, Y + H + 62);
    x.lineTo(tx, Y + H);
    x.lineTo(X + r, Y + H);
    x.quadraticCurveTo(X, Y + H, X, Y + H - r);
    x.lineTo(X, Y + r);
    x.quadraticCurveTo(X, Y, X + r, Y);
    x.closePath();
  }

  // 行頭に置けない文字（句読点・閉じ括弧・小書き・長音など）
  var NO_LINE_START = "、。，．・：；？！ー〜…ヽヾゝゞ々）］｝」』】〉》〟’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ";
  // 行末に置けない文字（開き括弧）
  var NO_LINE_END = "（［｛「『【〈《〝‘“";

  // 台詞を「読点・句点の直後」で区切る。日本語はここが自然な改行位置なので、
  // まずこの単位で行に詰める。言葉の途中で改行されるのを防ぐのが狙い。
  function segments(text) {
    var segs = [], cur = "";
    for (var i = 0; i < text.length; i++) {
      cur += text.charAt(i);
      if ("、。！？".indexOf(text.charAt(i)) < 0) continue;
      // 句読点のあとに閉じ括弧などが続くなら、同じ単位に含める
      while (i + 1 < text.length && NO_LINE_START.indexOf(text.charAt(i + 1)) >= 0) cur += text.charAt(++i);
      segs.push(cur); cur = "";
    }
    if (cur) segs.push(cur);
    return segs;
  }

  // 最後の手段：区切りが無いほど長い一続きを1文字ずつ折る（禁則つき）
  function breakLong(x, text, maxW) {
    var out = [], line = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (line && x.measureText(line + ch).width > maxW) {
        if (NO_LINE_START.indexOf(ch) >= 0) { out.push(line + ch); line = ""; continue; }
        var last = line.charAt(line.length - 1);
        if (line.length > 1 && NO_LINE_END.indexOf(last) >= 0) { out.push(line.slice(0, -1)); line = last + ch; continue; }
        out.push(line); line = ch; continue;
      }
      line += ch;
    }
    if (line) out.push(line);
    return out;
  }

  function bubbleFont(size) {
    return "bold " + size + "px 'Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif";
  }

  // 読点・句点の単位を行に詰める。単位が1つも割れないで済む大きさまで字を縮める。
  function layoutText(x, text, maxW) {
    var segs = segs = segments(text), size = 38, i;
    for (; size > 24; size -= 2) {
      x.font = bubbleFont(size);
      var fits = true;
      for (i = 0; i < segs.length; i++) if (x.measureText(segs[i]).width > maxW) { fits = false; break; }
      if (fits) break;
    }
    x.font = bubbleFont(size);
    var lines = [], line = "";
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (x.measureText(s).width > maxW) {          // それでも入らない一続き
        if (line) { lines.push(line); line = ""; }
        lines = lines.concat(breakLong(x, s, maxW));
        continue;
      }
      if (line && x.measureText(line + s).width > maxW) { lines.push(line); line = s; }
      else line += s;
    }
    if (line) lines.push(line);
    return { lines: lines, size: size };
  }

  // 白い紙・黒い輪郭のペーパー調の吹き出し
  function makeBubbleTex(name, text) {
    var W = 640, H = 320, BH = H - 90;
    var c = makeCanvas(W, H), x = c.getContext("2d");
    x.clearRect(0, 0, W, H);
    x.lineJoin = "round";
    bubblePath(x, 14, 14, W - 28, BH, 46, 168);
    x.fillStyle = "#fff"; x.fill();
    x.strokeStyle = "#222"; x.lineWidth = 7; x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#222";
    // 金枠ぶんを引いた実際に使える幅。狭くしすぎると数十pxの超過で不要に2行になる
    var lay = layoutText(x, text, W - 90), lines = lay.lines, lh = lay.size * 1.28;
    var mid = 14 + BH / 2 - 16;
    for (var i = 0; i < lines.length; i++) {
      x.fillText(lines[i], W / 2, mid + (i - (lines.length - 1) / 2) * lh);
    }
    x.textAlign = "right"; x.fillStyle = SD_RED_CSS;
    x.font = "bold 26px 'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif";
    x.fillText(name, W - 46, 14 + BH - 26);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
    return t;
  }

  function speak(wk) {
    if (!wk || !wk.lines || !wk.lines.length) return;
    wk.line = (wk.line + 1) % wk.lines.length;
    wk.talkUntil = clock.elapsedTime + TALK_SEC;
    if (!wk.bubble) {
      var mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
      wk.bubble = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), mat);
      wk.bubble.userData.shadow = "none";
      wk.bubble.renderOrder = 5;
      scene.add(wk.bubble);
      talking.push(wk);
    }
    if (wk.bubble.material.map) wk.bubble.material.map.dispose();
    wk.bubble.material.map = makeBubbleTex(wk.name, wk.lines[wk.line]);
    wk.bubble.material.needsUpdate = true;
    wk.bubble.visible = true;
    placeBubble(wk);   // 置く前に1フレーム描くと原点に出てしまう
  }

  // 立ち絵の頭のすぐ上。鳥は空を飛ぶので、地上前提の baseY ではなく実際の高さから出す
  function placeBubble(wk) {
    var m = wk.rec.mesh;
    wk.bubble.position.set(m.position.x, m.position.y + m.scale.y * 0.5 + 1.05, m.position.z);
    wk.bubble.quaternion.copy(camera.quaternion);   // 常にこちらを向く
  }

  function updateBubbles(tsec) {
    for (var i = 0; i < talking.length; i++) {
      var wk = talking[i];
      if (!wk.bubble.visible) continue;
      if (tsec >= wk.talkUntil) { wk.bubble.visible = false; continue; }
      placeBubble(wk);
    }
  }

  // 行き先へ向かって歩き、着いたら次の行き先を決める。**位置を飛ばさない**ので
  // どこかで消えて別の場所から現れることがない＝ずっと街を歩き回って見える。
  // 進んだ向きは w.vx / w.vz に入れて返す（立ち絵を鏡にするかの判断に使う）
  function stepToward(w, m, speed, dt, rMin, rMax) {
    var t = w.target;
    var dx = t.x - m.position.x, dz = t.z - m.position.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.5) {                         // 着いたので次の行き先へ（その場で向きが変わるだけ）
      var p = roamPoint(rMin, rMax); t.x = p.x; t.z = p.z;
      w.vx = 0; w.vz = 0; return;
    }
    var step = Math.min(speed * dt, d);
    m.position.x += (dx / d) * step;
    m.position.z += (dz / d) * step;
    w.vx = dx / d; w.vz = dz / d;
  }

  function updateWalkers(dt, tsec) {
    for (var i = 0; i < walkers.length; i++) {
      var wk = walkers[i], m = wk.rec.mesh;
      if (tsec >= wk.talkUntil) {          // 話しかけられている間は立ち止まる
        stepToward(wk, m, wk.speed, dt, ROAM_MIN, ROAM_MAX);
      }
      m.position.y = wk.rec.baseY + Math.abs(Math.sin(tsec * 4 + wk.phase)) * 0.08;
      faceCamera(wk.rec, wk.vx, wk.vz);
    }
  }
  function updateFloaters(dt, tsec) {
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      if (!(f.talk && tsec < f.talk.talkUntil)) {   // 話しかけられている間はその場に留まる
        if (f.roam) {                               // 鳥：街の上を飛び回る（飛び去らない）
          stepToward(f, f.mesh, f.speed, dt, BIRD_MIN, BIRD_MAX);
        } else {                                    // 飛行機：遠くまで飛び去ってループ
          f.mesh.position.x += f.dir * f.speed * dt;
          if (f.dir > 0 && f.mesh.position.x > WRAP) f.mesh.position.x = -WRAP;
          if (f.dir < 0 && f.mesh.position.x < -WRAP) f.mesh.position.x = WRAP;
        }
      }
      f.mesh.position.y = f.y + Math.sin(tsec * 0.7 + f.phase) * (f.plane ? 0.6 : 0.4);
      // 鳥もこちらを向かせる（飛行機は向きを固定したまま＝TRAVEL の文字を鏡にしない）
      if (f.rec) faceCamera(f.rec, f.vx, f.vz);
    }
  }

  // ---- 中央の銅像モニュメント（神様） -----------------------------------
  (function addStatueMonument() {
    var g = new THREE.Group();

    // 多段の台座（白大理石＋赤トリム＋金縁）
    function tier(w, h, y, color) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), paperMat(color || 0xfff7f4, 0.7));
      m.position.y = y; addEdges(m, 0x888888); g.add(m);
      // 赤トリム：天面より少し下に巻く（天面と同一平面にせず z-fighting を防ぐ）
      var t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.14, w + 0.12), new THREE.MeshStandardMaterial({ color: SD_RED, roughness: 0.7 }));
      t.position.y = y + h / 2 - 0.16; g.add(t);
      return m;
    }
    // 各段は少し食い込ませて積む（接する面が同一平面にならないように）
    tier(11, 0.7, 0.35);            // 最下段 [0, 0.70]
    tier(8.5, 0.9, 1.08);           // 中段   [0.63, 1.53]（0.07 食い込み）
    tier(6.2, 2.6, 2.80, 0xfffdfb); // 本体台座 [1.50, 4.10]（0.03 食い込み）
    var pedestalTop = 4.10;

    // 金の装飾柱（四隅）
    var colMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.75 });
    [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]].forEach(function (p) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.4, 14), colMat);
      col.position.set(p[0], 2.2, p[1]); g.add(col);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), colMat);
      cap.position.set(p[0], 4.5, p[1]); g.add(cap);
    });

    // 光背（金のリング）＋光の柱
    var halo = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.22, 16, 48), new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.8, emissive: 0x5a3d00, emissiveIntensity: 0.4 }));
    halo.position.set(0, pedestalTop + 5.6, -0.5);
    g.add(halo);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.6, 18, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(0, pedestalTop + 10, -0.4); beam.userData.shadow = "none"; g.add(beam);

    // 竹田氏のブロンズ肖像（立像）— 金の額縁つき
    var bw = 4.4, bh = bw * (1069 / 720); // 画像アスペクト
    var frame = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.7, bh + 0.7, 0.4), new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.8 }));
    frame.position.set(0, pedestalTop + bh / 2 + 0.3, 0.0);
    addEdges(frame, 0x7a5a10); g.add(frame);
    var portMat = new THREE.MeshStandardMaterial({ color: 0x9a7a48, roughness: 0.55, metalness: 0.35 });
    var port = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), portMat);
    port.position.set(0, pedestalTop + bh / 2 + 0.3, 0.22);
    port.userData.shadow = "none";
    new THREE.TextureLoader().load("asset/statue/takeda_bronze.png", function (t) {
      t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
      portMat.map = t; portMat.color.set(0xffffff); portMat.needsUpdate = true;
    });
    g.add(port);
    // 背面にも同じ肖像（裏から見ても神々しく）
    var portB = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), portMat);
    portB.position.set(0, pedestalTop + bh / 2 + 0.3, -0.22); portB.rotation.y = Math.PI;
    portB.userData.shadow = "none"; g.add(portB);

    // ネームプレート（赤地・白文字＋金枠）
    var npc = makeCanvas(1024, 256), npx = npc.getContext("2d");
    npx.fillStyle = SD_RED_CSS; npx.fillRect(0, 0, 1024, 256);
    npx.strokeStyle = "#E2B060"; npx.lineWidth = 18; npx.strokeRect(9, 9, 1006, 238);
    npx.textAlign = "center"; npx.textBaseline = "middle";
    // 2行とも金枠に収まる幅まで自動で縮めて、できるだけ大きく組む
    function fitFont(text, max, limit) {
      var s = max;
      npx.font = "bold " + s + "px 'Arial','Helvetica',sans-serif";
      while (npx.measureText(text).width > limit && s > 24) {
        s -= 2;
        npx.font = "bold " + s + "px 'Arial','Helvetica',sans-serif";
      }
    }
    npx.fillStyle = "#ffe6b0";
    fitFont("Seven Dreams Group", 62, 900);
    npx.fillText("Seven Dreams Group", 512, 78);
    // 名前が主役なので、上の行より大きく
    npx.fillStyle = "#fff";
    fitFont("Toshiya Takeda", 112, 900);
    npx.fillText("Toshiya Takeda", 512, 170);
    var plate = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.6, 0.3), [
      colMat, colMat, colMat, colMat,
      new THREE.MeshBasicMaterial({ map: texFromCanvas(npc) }), colMat
    ]);
    // 来場者は南（-z）から参道を歩いてくる。銘板は南向きに。
    plate.position.set(0, pedestalTop - 0.7, -3.15); plate.rotation.y = Math.PI;
    g.add(plate);

    // 台座前（南）の赤カーペット＝参道
    var carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 12), new THREE.MeshStandardMaterial({ color: SD_RED, roughness: 0.85 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.03, -11); carpet.userData.shadow = "receive";
    g.add(carpet);

    scene.add(g);
    statueGroup = g;
    // 台座のコライダー
    addCollider(0, 0, 5.6, 5.6, 0.2);
  })();
  var statueGroup;

  // ---- モニター（動画1面 / 静止画1面） -----------------------------------
  var adVideos = [];
  function makePlaceholderTex(title, sub) {
    var c = makeCanvas(512, 288), x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 512, 288);
    x.strokeStyle = SD_RED_CSS; x.lineWidth = 6; x.setLineDash([14, 10]); x.strokeRect(14, 14, 484, 260); x.setLineDash([]);
    x.fillStyle = SD_RED_CSS; x.textAlign = "center"; x.font = "bold 40px 'Hiragino Kaku Gothic ProN',sans-serif";
    x.fillText(title, 256, 132);
    x.fillStyle = "#999"; x.font = "22px 'Hiragino Kaku Gothic ProN',sans-serif";
    x.fillText(sub, 256, 182);
    return texFromCanvas(c);
  }
  // 最新ファイルが必ず読まれるようキャッシュ無効化クエリを付ける（ローカル試作用）
  var CACHE_BUST = "?cb=" + Date.now();
  function makeVideoMat(src) {
    var mat = new THREE.MeshBasicMaterial({ map: makePlaceholderTex("動画モニター", "VIDEO 読み込み中…"), side: THREE.DoubleSide });
    var v = document.createElement("video");
    v.src = encodeURI(src) + CACHE_BUST;
    v.loop = true; v.muted = true; v.defaultMuted = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("autoplay", "");
    v.preload = "auto";
    var vt = new THREE.VideoTexture(v);
    vt.minFilter = THREE.LinearFilter; vt.magFilter = THREE.LinearFilter; vt.encoding = THREE.sRGBEncoding;
    var swapped = false, retries = 0;
    function useVideo() { if (swapped) return; swapped = true; mat.map = vt; mat.needsUpdate = true; }
    ["loadeddata", "canplay", "playing"].forEach(function (ev) { v.addEventListener(ev, useVideo); });
    // エラー時は数回リトライ（start.bat は Range 対応の serve.py を使う想定）
    v.addEventListener("error", function () {
      if (swapped) return;
      if (retries < 4) { retries++; setTimeout(function () { try { v.load(); v.play().catch(function () { }); } catch (e) { } }, 500 * retries); }
      else { mat.map = makePlaceholderTex("動画モニター", "再生できません"); mat.needsUpdate = true; }
    });
    adVideos.push(v);
    return mat;
  }
  function makeImageMat(src) {
    var mat = new THREE.MeshBasicMaterial({ map: makePlaceholderTex("静止画モニター", "IMAGE 読み込み中…"), side: THREE.DoubleSide });
    new THREE.TextureLoader().load(encodeURI(src) + CACHE_BUST, function (t) { t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; mat.map = t; mat.needsUpdate = true; });
    return mat;
  }
  function ensureVideosPlaying() {
    for (var i = 0; i < adVideos.length; i++) {
      var v = adVideos[i];
      if (v.paused && v.readyState >= 2) { var p = v.play(); if (p && p.catch) p.catch(function () { }); }
    }
  }
  function addMonitor(x, z, rotY, w, h, screenMat, label) {
    var group = new THREE.Group();
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.5, metalness: 0.4 });
    var legGeo = new THREE.CylinderGeometry(0.13, 0.16, 2.4, 10);
    var l1 = new THREE.Mesh(legGeo, poleMat); l1.position.set(-w * 0.3, 1.2, 0); group.add(l1);
    var l2 = new THREE.Mesh(legGeo, poleMat); l2.position.set(w * 0.3, 1.2, 0); group.add(l2);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.25), new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.5, metalness: 0.4 }));
    frame.position.set(0, 2.4 + h / 2, 0); addEdges(frame, 0x000000); group.add(frame);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.set(0, 2.4 + h / 2, 0.2); screen.userData.shadow = "none"; group.add(screen);
    // ラベル帯（赤）
    var lc = makeCanvas(512, 96), lx = lc.getContext("2d");
    lx.fillStyle = SD_RED_CSS; lx.fillRect(0, 0, 512, 96);
    lx.fillStyle = "#fff"; lx.font = "bold 44px 'Hiragino Kaku Gothic ProN',sans-serif"; lx.textAlign = "center"; lx.textBaseline = "middle";
    lx.fillText(label, 256, 50);
    var band = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, 0.7), new THREE.MeshBasicMaterial({ map: texFromCanvas(lc) }));
    band.position.set(0, 2.4 + h + 0.55, 0.17); band.userData.shadow = "none"; group.add(band);

    group.position.set(x, 0, z); group.rotation.y = rotY;
    scene.add(group);
    addCollider(x, z, Math.abs(Math.cos(rotY)) * (w / 2) + 0.3, Math.abs(Math.sin(rotY)) * (w / 2) + 0.3, 0.2);
  }
  // 南の参道の左右に1面ずつ。画面は来場者（南の入口 ≈ (0,-30)）の方へ向ける
  addMonitor(-13, -13, Math.atan2(0 - (-13), -30 - (-13)), 6, 3.4, makeVideoMat("asset/monitor/video/video-1.mp4"), "動画モニター");
  addMonitor(13, -13, Math.atan2(0 - 13, -30 - (-13)), 6, 3.4, makeImageMat("asset/monitor/image/image-1.png"), "静止画モニター");

  // ---- 住人を配置（左向きにゆっくり歩き回る＝パレード） ------------------
  // マスコット（ph-music-01.png の6体が地上を散策）
  // [ファイル名, 幅, 表示名, 台詞（タップのたび順に出る）]
  [
    ["smile", 1.7, "スマイル", [
      "ようこそ、Seven Dreams World へ！",
      "笑顔でいると、いい夢に出会えるよ。",
      "今日はどんな夢を見にきたの？"
    ]],
    ["next", 2.4, "ネクスト", [
      "次の一歩が、未来をつくる。",
      "まだ見ぬ場所へ、行ってみない？",
      "立ち止まるのも、次への準備さ。"
    ]],
    ["move", 2.0, "ムーヴ", [
      "動けば、景色は変わる。",
      "歩こう。まちはまだまだ広いよ。",
      "浮遊モードなら、空から見渡せるよ。"
    ]],
    ["punch", 2.1, "パンチ", [
      "壁は、殴れば道になる。",
      "今日もひと勝負、いってみようぜ！",
      "あきらめの悪さも、才能だ。"
    ]],
    ["heart", 1.3, "ハート", [
      "夢は、誰かを想う気持ちから。",
      "あなたの夢、聞かせて？",
      "まんなかの銅像、もう見た？"
    ]],
    ["hope", 1.5, "ホープ", [
      "希望は、いつでもここにある。",
      "大丈夫。夢はきっと形になる。",
      "空を見上げてごらん。飛行機が飛んでるよ。"
    ]]
  ].forEach(function (c) { addMascotWalker(c[0], c[1], c[2], c[3]); });
  // 人（最大3人）— asset/people/person-1.png 〜 person-3.png を使用（無ければ線画）
  var PEOPLE_LINES = [
    ["まちの人", ["この街、ぜんぶ紙でできてるんだって。", "赤いサインが目印。迷わないよ。"]],
    ["まちの人", ["モニターで映像が流れてるよ。", "音は右上のボタンで、出せるみたい。"]],
    ["まちの人", ["中央の銅像、立派だよね。", "夢と生きる、か。いい言葉だ。"]]
  ];
  for (var pi = 1; pi <= 3; pi++) {
    addPersonWalker("asset/people/person-" + pi + ".png?cb=" + Date.now(),
      PEOPLE_LINES[pi - 1][0], PEOPLE_LINES[pi - 1][1]);
  }
  // 空を横切る小鳥（air）は1羽だけ。飛行機よりずっと低く、建物・木の高さあたりを飛ぶ。
  // 7体のうち air だけ空にいるが、見上げてタップすれば同じように話しかけられる
  addBird(1.2, 5.5, "エア", [
    "空から見ると、まちがよく見える。",
    "上を向いてごらん。気持ちいいよ。",
    "浮遊モードなら、ここまで来られるよ。"
  ]);
  // 上空を横切る飛行機は1機だけ（asset/plane/plane.png を使用、無ければ線画）。鳥より高く飛ぶ
  addAirplane(7, 27);

  // ---- 影の一括設定 -------------------------------------------------------
  scene.traverse(function (o) {
    if (!o.isMesh) return;
    var m = o.userData.shadow;
    if (m === "none") { o.castShadow = false; o.receiveShadow = false; }
    else if (m === "receive") { o.castShadow = false; o.receiveShadow = true; }
    else { o.castShadow = true; o.receiveShadow = true; }
  });

  // =======================================================================
  // 操作系（デスクトップ PointerLock ＋ スマホ簡易操作）
  // =======================================================================
  camera.position.set(0, 1.7, -30);
  camera.rotation.order = "YXZ";
  camera.rotation.y = Math.PI; // +z（北）方向を向く＝中心の銅像を見る

  var controls = new THREE.PointerLockControls(camera, document.body);
  scene.add(controls.getObject());
  controls.getObject().position.copy(camera.position);

  var overlay = document.getElementById("overlay");
  var crosshair = document.getElementById("crosshair");
  var hud = document.getElementById("hud");
  var titleBadge = document.getElementById("title-badge");
  var guide = document.getElementById("controls-guide");
  var flyBadge = document.getElementById("fly-badge");
  var topbtns = document.getElementById("topbtns");

  var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  var mobileActive = false;
  var joy = { active: false, x: 0, y: 0 };
  var lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
  var LOOK_SENS = 0.0042, PITCH_MAX = Math.PI / 2 - 0.05;

  function active() { return controls.isLocked || mobileActive; }
  function updateFlyBadge() { flyBadge.style.display = (flyMode && active()) ? "block" : "none"; }
  function showUI(on) {
    crosshair.style.display = on && !isTouch ? "block" : "none";
    // HUD はキー操作の案内。タッチでは左下のボタンと重なるうえ内容も無意味なので出さない
    hud.style.display = on && !isTouch ? "block" : "none";
    titleBadge.style.display = on ? "block" : "none";
    guide.style.display = on && !isTouch ? "block" : "none";
    topbtns.style.display = on ? "flex" : "none";
  }

  if (isTouch) {
    document.getElementById("keys-desktop").style.display = "none";
    document.getElementById("keys-mobile").style.display = "block";
    document.getElementById("start-btn").textContent = "タップしてスタート";
    // 既定の文言はキー操作つきで横に長く、縦画面でタイトルバッジに突き当たる
    flyBadge.textContent = "✈ 浮遊モード ON";
  }

  function startMobile() {
    if (mobileActive) return;
    mobileActive = true;
    lookEuler.setFromQuaternion(camera.quaternion, "YXZ");
    overlay.style.display = "none";
    showUI(true);
    document.getElementById("touch-ui").style.display = "block";
    document.getElementById("look-layer").style.display = "block";
    startAudio();
    updateFlyBadge();
  }

  overlay.addEventListener("click", function () {
    if (isTouch) startMobile();
    else { controls.lock(); startAudio(); }
  });
  controls.addEventListener("lock", function () { overlay.style.display = "none"; showUI(true); startAudio(); updateFlyBadge(); });
  controls.addEventListener("unlock", function () { overlay.style.display = "flex"; showUI(false); flyBadge.style.display = "none"; });

  var keys = {};
  window.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyF" && !e.repeat) { flyMode = !flyMode; velY = 0; updateFlyBadge(); setFlyButtons(); }
    if (e.code === "KeyB" && !e.repeat) toggleBGM();
    if (e.code === "KeyM" && !e.repeat) toggleMovie();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("wheel", function (e) {
    camera.fov = clamp(camera.fov + e.deltaY * 0.02, 15, 78); camera.updateProjectionMatrix();
  }, { passive: true });

  // タッチ：視点ドラッグ（1本指）／ FOV ズーム（2本指ピンチ）
  (function setupTouchLook() {
    var layer = document.getElementById("look-layer");
    var lastX = 0, lastY = 0, id = null, pinchD = 0;
    var tapX = 0, tapY = 0, tapMove = 0, tapOK = false;
    // touches は画面上の全タッチを数えるため、移動スティックを握った指まで含まれてしまい、
    // 「歩きながら視点ドラッグ」が 2 本指＝ピンチと誤判定される。この層で始まった指だけを見る。
    function fingers(e) { return e.targetTouches; }
    function gap(e) {
      var a = e.targetTouches[0], b = e.targetTouches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    function grab(t) { id = t.identifier; lastX = t.clientX; lastY = t.clientY; }
    layer.addEventListener("touchstart", function (e) {
      if (fingers(e).length >= 2) { pinchD = gap(e); id = null; tapOK = false; return; }
      var t0 = e.changedTouches[0];
      grab(t0);
      tapX = t0.clientX; tapY = t0.clientY; tapMove = 0; tapOK = true;
    }, { passive: true });
    layer.addEventListener("touchmove", function (e) {
      if (fingers(e).length >= 2) {
        var d = gap(e);
        if (pinchD > 0 && d > 0) {
          camera.fov = clamp(camera.fov * (pinchD / d), 15, 78);
          camera.updateProjectionMatrix();
        }
        pinchD = d; tapOK = false;
        return;
      }
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i]; if (t.identifier !== id) continue;
        var dx = t.clientX - lastX, dy = t.clientY - lastY; lastX = t.clientX; lastY = t.clientY;
        tapMove += Math.abs(dx) + Math.abs(dy);
        // 指でつかんだ景色がそのまま指についてくる向き（ストリートビュー式）。
        // マウス視点と同じ符号にすると、タッチでは逆に感じられる。
        lookEuler.y += dx * LOOK_SENS; lookEuler.x += dy * LOOK_SENS;
        lookEuler.x = clamp(lookEuler.x, -PITCH_MAX, PITCH_MAX);
        camera.quaternion.setFromEuler(lookEuler);
      }
    }, { passive: true });
    layer.addEventListener("touchend", function (e) {
      if (fingers(e).length < 2) pinchD = 0;
      // 指をほとんど動かさずに離した＝タップ。その場所のキャラに話しかける。
      // 「速さ」は条件にしない。ゆっくり触っただけでもタップのつもりなので、
      // 視点ドラッグと区別できればよく、それは移動量だけで足りる。
      if (tapOK && !fingers(e).length && tapMove < 12) {
        talkAtClient(tapX, tapY);
      }
      if (!fingers(e).length) tapOK = false;
      // ピンチをやめて1本残ったら、その指を基準に取り直す（残像ぶんの飛びを防ぐ）
      if (fingers(e).length === 1) grab(fingers(e)[0]); else if (!fingers(e).length) id = null;
    }, { passive: true });
  })();

  // タッチ：ジョイスティック
  (function setupJoystick() {
    var stick = document.getElementById("joystick"), knob = document.getElementById("joy-knob");
    var cx = 0, cy = 0, R = 48, KH = 28, id = null;
    // 画面幅でスティックの寸法が変わるので、可動半径はその都度実寸から出す
    function set() {
      var r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      KH = knob.offsetWidth / 2; R = r.width / 2 - KH;
    }
    stick.addEventListener("touchstart", function (e) { set(); var t = e.changedTouches[0]; id = t.identifier; move(t); }, { passive: true });
    stick.addEventListener("touchmove", function (e) { for (var i = 0; i < e.changedTouches.length; i++) { if (e.changedTouches[i].identifier === id) move(e.changedTouches[i]); } }, { passive: true });
    stick.addEventListener("touchend", function () { id = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = "translate(-50%,-50%)"; }, { passive: true });
    function move(t) {
      var dx = clamp(t.clientX - cx, -R, R), dy = clamp(t.clientY - cy, -R, R);
      knob.style.transform = "translate(" + (dx - KH) + "px," + (dy - KH) + "px)";
      joy.active = true; joy.x = dx / R; joy.y = -dy / R;
    }
  })();

  function bindBtn(id2, on, off) {
    var el = document.getElementById(id2);
    el.addEventListener("touchstart", function (e) { e.preventDefault(); on(); }, { passive: false });
    if (off) el.addEventListener("touchend", function (e) { e.preventDefault(); off(); }, { passive: false });
  }
  bindBtn("tb-jump", function () { if (onGround) { velY = JUMP_V; onGround = false; } }, null);
  bindBtn("tb-up", function () { keys["Space"] = true; }, function () { keys["Space"] = false; });
  bindBtn("tb-down", function () { keys["ShiftLeft"] = true; }, function () { keys["ShiftLeft"] = false; });
  // 浮遊中の Shift は下降に使うので、「走る」は加速(Ctrl)へ振り分ける
  bindBtn("tb-run",
    function () { if (flyMode) keys["ControlLeft"] = true; else keys["ShiftLeft"] = true; },
    function () { keys["ControlLeft"] = false; keys["ShiftLeft"] = false; });

  // 浮遊中は「ジャンプ」を上昇／下降の2つに入れ替える（従来は下降しか出ず上昇できなかった）
  function setFlyButtons() {
    document.getElementById("tb-jump").style.display = flyMode ? "none" : "flex";
    document.getElementById("tb-up").style.display = flyMode ? "flex" : "none";
    document.getElementById("tb-down").style.display = flyMode ? "flex" : "none";
    document.getElementById("tb-fly").classList.toggle("on", flyMode);
  }
  document.getElementById("tb-fly").addEventListener("touchstart", function (e) {
    e.preventDefault();
    flyMode = !flyMode; velY = 0;
    keys["Space"] = false; keys["ShiftLeft"] = false; keys["ControlLeft"] = false;
    updateFlyBadge(); setFlyButtons();
  }, { passive: false });

  // ---- 話しかける（キャラをタップ／クリック） -----------------------------
  var talkRay = new THREE.Raycaster();
  talkRay.far = TALK_RANGE;
  var talkNdc = new THREE.Vector2();
  var _talkMeshes = null;
  function talkMeshes() {
    // 住人は初期化時に出そろうので一度だけ組む（毎フレームのレイキャストで使う）
    if (!_talkMeshes) {
      _talkMeshes = [];
      for (var i = 0; i < talkers.length; i++) _talkMeshes.push(talkers[i].rec.mesh);
    }
    return _talkMeshes;
  }
  function aimHit(nx, ny) {
    talkNdc.set(nx, ny);
    talkRay.setFromCamera(talkNdc, camera);
    return talkRay.intersectObjects(talkMeshes(), false)[0];
  }
  function talkAt(nx, ny) {
    var hit = aimHit(nx, ny);
    if (hit) speak(hit.object.userData.walker);
  }
  function talkAtClient(px, py) {
    talkAt((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  }
  // PC は視点ロック中でカーソルが無いので、画面中央（照準）で狙ってクリック
  document.addEventListener("click", function () { if (controls.isLocked) talkAt(0, 0); });
  // 照準がキャラに乗ったら印を出す（PCのみ。スマホは照準を出していない）
  function updateAim() {
    if (isTouch || !controls.isLocked) return;
    crosshair.classList.toggle("aim", !!aimHit(0, 0));
  }

  // ---- BGM / 動画音 -------------------------------------------------------
  var bgm = document.getElementById("bgm");
  var bgmOn = true, movieOn = false;
  var btnBgm = document.getElementById("btn-bgm"), btnMov = document.getElementById("btn-mov");
  function startAudio() {
    tryPlayVideo();
    if (bgmOn) { var p = bgm.play(); if (p && p.catch) p.catch(function () { }); }
  }
  function tryPlayVideo() { adVideos.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () { }); }); }
  function toggleBGM() {
    bgmOn = !bgmOn;
    if (bgmOn) { var p = bgm.play(); if (p && p.catch) p.catch(function () { }); } else { bgm.pause(); }
    btnBgm.classList.toggle("off", !bgmOn);
    btnBgm.textContent = bgmOn ? "♪ BGM" : "♪ BGM×";
  }
  function toggleMovie() {
    movieOn = !movieOn;
    adVideos.forEach(function (v) { v.muted = !movieOn; });
    tryPlayVideo();
    btnMov.classList.toggle("off", !movieOn);
    btnMov.textContent = movieOn ? "🔊 動画" : "🔇 動画";
  }
  btnBgm.addEventListener("click", toggleBGM);
  btnMov.addEventListener("click", toggleMovie);

  // ---- 移動・当たり判定・重力 --------------------------------------------
  function collides(x, z) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
    return false;
  }
  function clampToGround(obj) {
    // 楕円ステージ内に収める
    var nx = obj.position.x / (GROUND_RX - 2), nz = obj.position.z / (GROUND_RZ - 2);
    var d = nx * nx + nz * nz;
    if (d > 1) { var s = 1 / Math.sqrt(d); obj.position.x *= s; obj.position.z *= s; }
  }

  var EYE = 1.7, GRAVITY = -26, JUMP_V = 8.6;
  var velY = 0, onGround = true, flyMode = false, bobT = 0;
  var forwardV = new THREE.Vector3(), rightV = new THREE.Vector3();
  var clock = new THREE.Clock();

  function updateMovement(dt) {
    var obj = controls.getObject();
    var moveZ = 0, moveX = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) moveZ += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) moveZ -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) moveX += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) moveX -= 1;
    if (joy.active) { moveX += joy.x; moveZ += joy.y; }
    var mag = Math.hypot(moveX, moveZ);
    var moving = mag > 0.12;
    var analog = Math.min(mag, 1);

    if (flyMode) {
      var fspeed = (keys["ControlLeft"] || keys["KeyC"]) ? 22 : 11;
      if (moving) {
        moveX /= mag; moveZ /= mag;
        camera.getWorldDirection(forwardV); forwardV.y = 0; forwardV.normalize();
        rightV.set(-forwardV.z, 0, forwardV.x);
        obj.position.x += (forwardV.x * moveZ + rightV.x * moveX) * fspeed * analog * dt;
        obj.position.z += (forwardV.z * moveZ + rightV.z * moveX) * fspeed * analog * dt;
      }
      var up = 0;
      if (keys["Space"]) up += 1;
      if (keys["ShiftLeft"] || keys["ShiftRight"]) up -= 1;
      obj.position.y += up * fspeed * dt;
      obj.position.y = clamp(obj.position.y, 0.6, 60);
      clampToGround(obj);
      velY = 0; onGround = false;
      return;
    }

    var speed = (keys["ShiftLeft"] || keys["ShiftRight"]) ? 11 : 5.8;
    if (moving) {
      moveX /= mag; moveZ /= mag;
      camera.getWorldDirection(forwardV); forwardV.y = 0; forwardV.normalize();
      rightV.set(-forwardV.z, 0, forwardV.x);
      var dx = (forwardV.x * moveZ + rightV.x * moveX) * speed * analog * dt;
      var dz = (forwardV.z * moveZ + rightV.z * moveX) * speed * analog * dt;
      var candX = obj.position.x + dx, candZ = obj.position.z + dz;
      if (!collides(candX, obj.position.z)) obj.position.x = candX;
      if (!collides(obj.position.x, candZ)) obj.position.z = candZ;
      clampToGround(obj);
    }

    if (keys["Space"] && onGround) { velY = JUMP_V; onGround = false; }
    velY += GRAVITY * dt;
    obj.position.y += velY * dt;
    if (obj.position.y <= EYE) { obj.position.y = EYE; velY = 0; onGround = true; }

    // 歩行の上下ゆれ
    if (moving && onGround) { bobT += dt * (speed > 8 ? 14 : 9); } else { bobT = 0; }
  }

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (active()) updateMovement(dt);

    var tsec = clock.elapsedTime;
    // 住人の歩行・飛行
    updateClouds(dt, tsec);
    updateWalkers(dt, tsec);
    updateFloaters(dt, tsec);
    updateBubbles(tsec);
    updateAim();
    if (active()) ensureVideosPlaying();
    // 光背の回転
    if (statueGroup) { statueGroup.children.forEach(function (o) { if (o.geometry && o.geometry.type === "TorusGeometry") o.rotation.z += dt * 0.4; }); }

    renderer.render(scene, camera);
  }
  animate();
})();
