'use strict';
// ピタゴラ工房のしくみ（画面なしでも動く部分）：ステージ・部品・物理の世界・クリアの判定
// ブラウザでは window.Pita、テストでは module.exports で使う
(function (root) {
  const W = 900, H = 560;
  // 部品の種類（置ける数はステージごと）
  const PARTS = {
    board: { l: '板', w: 170, h: 14, color: '#b07a3a' },
    long: { l: '長い板', w: 300, h: 14, color: '#9a6a30' },
    domino: { l: 'ドミノ', w: 10, h: 72, color: '#3d6fd1' },
    spring: { l: 'バネ', w: 70, h: 18, color: '#d24b6a' },
    ball: { l: '重い玉', r: 18, color: '#5b5f6b' },
  };
  // 固定のもの：rect（x, y は中心）。cup はゴールのコップ、bell はさわると鳴るベル
  const STAGES = [
    { id: 's1', t: '坂をつくろう', d: '玉がコップに入るように、板をななめに置こう。板の角度は、選んで「回す」で変えられます。',
      ball: { x: 70, y: 118, r: 14, vx: 2.5 },
      fixed: [[140, 150, 240, 16, 0.12], [520, 525, 22, 70]],
      goal: { type: 'cup', x: 780, y: 520 },
      parts: { board: 2 },
      sol: [{ k: 'board', x: 554, y: 410, a: 0.18 }, { k: 'board', x: 334, y: 267, a: 0.57 }] },
    { id: 's2', t: 'ドミノたおし', d: '転がってきた玉でドミノをたおして、ベルを鳴らそう。ドミノとドミノは、高さより近くに置きます。',
      ball: { x: 60, y: 300, r: 14, vx: 3 },
      fixed: [[200, 340, 360, 16, 0.16]],
      goal: { type: 'bell', x: 700, y: 470 },
      parts: { domino: 10, board: 1 },
      sol: [{ k: 'domino', x: 440, y: 503, a: 0 }, { k: 'domino', x: 478, y: 503, a: 0 }, { k: 'domino', x: 516, y: 503, a: 0 }, { k: 'domino', x: 554, y: 503, a: 0 }, { k: 'domino', x: 592, y: 503, a: 0 }, { k: 'domino', x: 630, y: 503, a: 0 }, { k: 'domino', x: 668, y: 503, a: 0 }] },
    { id: 's3', t: 'バネでジャンプ', d: 'コップは高い棚の上。バネで玉を上へはね上げよう。',
      ball: { x: 70, y: 98, r: 14, vx: 2.5 },
      fixed: [[120, 130, 200, 16, 0.12], [720, 260, 260, 16], [600, 230, 16, 76]],
      goal: { type: 'cup', x: 780, y: 230 },
      parts: { spring: 1, board: 2 },
      sol: [{ k: 'spring', x: 218, y: 400, a: 0.64 }] },
    { id: 's4', t: '重い玉でおす', d: '玉では軽すぎて、ベルの前の箱が動きません。重い玉を坂から転がして、箱ごとおしこもう。',
      ball: { x: 60, y: 90, r: 12, vx: 2 },
      fixed: [[110, 120, 180, 16, 0.12], [610, 500, 520, 16]],
      boxes: [[560, 470, 44, 44]],
      goal: { type: 'bell', x: 840, y: 470 },
      parts: { ball: 1, board: 2 },
      sol: [{ k: 'board', x: 492, y: 297, a: 0.36 }, { k: 'board', x: 557, y: 390, a: 0.19 }, { k: 'ball', x: 446, y: 114, a: 0 }] },
    { id: 's5', t: 'かべをこえて', d: '大きなかべの向こうにコップがあります。坂とバネを組み合わせて、かべをこえよう。',
      ball: { x: 70, y: 98, r: 14, vx: 2.5 },
      fixed: [[120, 130, 200, 16, 0.12], [560, 440, 24, 240]],
      goal: { type: 'cup', x: 780, y: 520 },
      parts: { board: 2, spring: 1 },
      sol: [{ k: 'board', x: 433, y: 250, a: 0.23 }, { k: 'spring', x: 207, y: 271, a: -0.29 }] },
    { id: 's6', t: 'ジグザグ', d: '板を何枚もつないで、ジグザグに下りてこよう。ゴールは左下のコップです。',
      ball: { x: 820, y: 78, r: 14, vx: -2.5 },
      fixed: [[790, 110, 200, 16, -0.12]],
      goal: { type: 'cup', x: 110, y: 520 },
      parts: { board: 4 },
      sol: [{ k: 'board', x: 747, y: 193, a: 0.66 }, { k: 'board', x: 298, y: 450, a: -0.26 }, { k: 'board', x: 555, y: 336, a: -0.32 }] },
    { id: 'free', t: 'じゆうに作る', d: '部品を好きなだけ置いて、自分だけの装置を作ろう。ベルを鳴らせたらクリア。',
      ball: { x: 70, y: 98, r: 14, vx: 2.5 },
      fixed: [[120, 130, 200, 16, 0.12]],
      goal: { type: 'bell', x: 840, y: 360 },
      parts: { board: 99, long: 99, domino: 99, spring: 99, ball: 99 }, free: true },
  ];

  function build(M, stage, placed) {
    const { Engine, Bodies, Composite, Events, Body } = M;
    const engine = Engine.create({ gravity: { x: 0, y: 1 } });
    engine.positionIterations = 8; engine.velocityIterations = 6;
    const world = engine.world, items = [];
    const wall = { isStatic: true, friction: 0.15, render: { fill: 'wall' } };
    Composite.add(world, [Bodies.rectangle(W / 2, H + 20, W + 200, 40, wall), Bodies.rectangle(-20, H / 2, 40, H * 2, wall), Bodies.rectangle(W + 20, H / 2, 40, H * 2, wall)]);
    for (const [x, y, w, h, a] of stage.fixed) Composite.add(world, Bodies.rectangle(x, y, w, h, { ...wall, angle: a || 0 }));
    for (const [x, y, w, h] of stage.boxes || []) Composite.add(world, Bodies.rectangle(x, y, w, h, { density: 0.02, friction: 0.6, frictionStatic: 0.9, render: { fill: 'box' }, label: 'box' }));
    const g = stage.goal;
    let sensor;
    if (g.type === 'cup') {
      Composite.add(world, [Bodies.rectangle(g.x, g.y + 26, 96, 12, wall), Bodies.rectangle(g.x - 48, g.y, 10, 64, wall), Bodies.rectangle(g.x + 48, g.y, 10, 64, wall)]);
      sensor = Bodies.rectangle(g.x, g.y + 8, 76, 28, { isStatic: true, isSensor: true, label: 'goal' });
    } else {
      // ベルは天井からつり下げる（台を置くと、ころがる玉やドミノのじゃまになるため）
      sensor = Bodies.circle(g.x, g.y, 22, { isStatic: true, isSensor: true, label: 'goal' });
    }
    Composite.add(world, sensor);
    const ball = Bodies.circle(stage.ball.x, stage.ball.y, stage.ball.r, { restitution: 0.25, friction: 0.02, frictionAir: 0.0008, density: 0.002, label: 'ball' });
    Composite.add(world, ball);
    const springs = [];
    for (const p of placed) {
      const P = PARTS[p.k]; let b;
      if (p.k === 'board' || p.k === 'long') b = Bodies.rectangle(p.x, p.y, P.w, P.h, { isStatic: true, angle: p.a, friction: 0.05, label: 'board' });
      else if (p.k === 'domino') b = Bodies.rectangle(p.x, p.y, P.w, P.h, { angle: p.a, friction: 0.25, frictionStatic: 0.4, density: 0.001, label: 'domino' });
      else if (p.k === 'spring') { b = Bodies.rectangle(p.x, p.y, P.w, P.h, { isStatic: true, angle: p.a, restitution: 0.4, label: 'spring' }); springs.push(b); }
      else if (p.k === 'ball') b = Bodies.circle(p.x, p.y, P.r, { density: 0.03, friction: 0.03, restitution: 0.1, label: 'heavy' });
      b.part = p; items.push(b); Composite.add(world, b);
    }
    const st = { engine, world, ball, sensor, items, won: false, t: 0, hits: [] };
    Events.on(engine, 'collisionStart', ev => {
      for (const pr of ev.pairs) {
        const [a, b] = [pr.bodyA, pr.bodyB];
        const other = a === sensor ? b : b === sensor ? a : null;
        if (other && !other.isStatic) { if (g.type === 'bell' || other === ball) st.won = true; }
        // バネ：さわったものを、バネの向き（上向き）に強くはね返す
        for (const s of springs) {
          const o = a === s ? b : b === s ? a : null;
          if (o && !o.isStatic) { const nx = Math.sin(s.angle), ny = -Math.cos(s.angle), sp = 15; Body.setVelocity(o, { x: o.velocity.x * 0.3 + nx * sp, y: ny * sp }); st.hits.push('spring'); }
        }
      }
    });
    return st;
  }
  function begin(M, st, stage) { M.Body.setVelocity(st.ball, { x: stage.ball.vx, y: 0 }); }
  function step(M, st, dt = 1000 / 60) {
    M.Engine.update(st.engine, dt); st.t += dt / 1000;
    // コップ：玉の中心がコップの中で、ほぼ止まっていてもクリア
    return st.won;
  }
  // 置けるか：画面の中で、固定物・ほかの部品・ゴール・玉のスタート位置と重ならないか（回した四角の角で調べる）
  function corners(x, y, w, h, a) { const c = Math.cos(a || 0), s = Math.sin(a || 0); return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]); }
  function sepAxis(A, B) {
    for (const poly of [A, B]) for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], nx = y2 - y1, ny = x1 - x2;
      const pa = A.map(p => p[0] * nx + p[1] * ny), pb = B.map(p => p[0] * nx + p[1] * ny);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return true;
    }
    return false;
  }
  function shapeOf(p) { const P = PARTS[p.k]; return P.r ? corners(p.x, p.y, P.r * 2, P.r * 2, 0) : corners(p.x, p.y, P.w, P.h, p.a); }
  function canPlace(stage, placed, p) {
    const S = shapeOf(p);
    if (S.some(([x, y]) => x < 4 || x > W - 4 || y < 4 || y > H - 2)) return false;
    const others = stage.fixed.map(([x, y, w, h, a]) => corners(x, y, w + 4, h + 4, a));
    for (const [x, y, w, h] of stage.boxes || []) others.push(corners(x, y, w, h, 0));
    const g = stage.goal; others.push(g.type === 'cup' ? corners(g.x, g.y + 4, 110, 76, 0) : corners(g.x, g.y, 48, 48, 0));
    others.push(corners(stage.ball.x, stage.ball.y, stage.ball.r * 2 + 6, stage.ball.r * 2 + 6, 0));
    for (const q of placed) if (q !== p) others.push(shapeOf(q));
    return others.every(o => sepAxis(S, o));
  }
  const api = { W, H, PARTS, STAGES, build, begin, step, canPlace, shapeOf };
  if (typeof module !== 'undefined') module.exports = api; else root.Pita = api;
})(typeof window !== 'undefined' ? window : globalThis);
