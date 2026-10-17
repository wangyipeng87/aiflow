/**
 * AiFlow Router - 正交直角连线路由算法
 * 纯函数模块，无 DOM 依赖，可在 Node.js 中测试
 */
var AiFlowRouter = (function () {
  'use strict';

  var DEFAULT_STUB = 20;
  var EXPAND = 20;

  function ptKey(p) { return p.x + ',' + p.y; }

  /**
   * 计算锚点的绝对坐标
   * anchor: { nodeX, nodeY, nodeW, nodeH, position, nodeShape }
   */
  function anchorXY(a) {
    if (a.nodeShape === 'circle') {
      var cx = a.nodeX + a.nodeW / 2;
      var cy = a.nodeY + a.nodeH / 2;
      var r = a.nodeW / 2;
      switch (a.position) {
        case 'top':    return { x: cx, y: cy - r };
        case 'bottom': return { x: cx, y: cy + r };
        case 'left':   return { x: cx - r, y: cy };
        case 'right':  return { x: cx + r, y: cy };
      }
    } else if (a.nodeShape === 'diamond') {
      var cx2 = a.nodeX + a.nodeW / 2;
      var cy2 = a.nodeY + a.nodeH / 2;
      switch (a.position) {
        case 'top':    return { x: cx2, y: a.nodeY };
        case 'bottom': return { x: cx2, y: a.nodeY + a.nodeH };
        case 'left':   return { x: a.nodeX, y: cy2 };
        case 'right':  return { x: a.nodeX + a.nodeW, y: cy2 };
      }
    }
    // rect (default)
    switch (a.position) {
      case 'top':    return { x: a.nodeX + a.nodeW / 2, y: a.nodeY };
      case 'bottom': return { x: a.nodeX + a.nodeW / 2, y: a.nodeY + a.nodeH };
      case 'left':   return { x: a.nodeX, y: a.nodeY + a.nodeH / 2 };
      case 'right':  return { x: a.nodeX + a.nodeW, y: a.nodeY + a.nodeH / 2 };
    }
    return { x: a.nodeX, y: a.nodeY };
  }

  /**
   * 从锚点沿法线方向延伸 stubLength 得到桩点
   */
  function stubPoint(anchorPt, position, stubLen) {
    switch (position) {
      case 'top':    return { x: anchorPt.x, y: anchorPt.y - stubLen };
      case 'bottom': return { x: anchorPt.x, y: anchorPt.y + stubLen };
      case 'left':   return { x: anchorPt.x - stubLen, y: anchorPt.y };
      case 'right':  return { x: anchorPt.x + stubLen, y: anchorPt.y };
    }
    return { x: anchorPt.x, y: anchorPt.y };
  }

  /**
   * 判断线段(p1->p2)是否穿过节点矩形内部（严格内部）
   * node: { x, y, w, h, shape }
   */
  function segCrossRect(p1, p2, node) {
    if (!node) return false;
    var nx = node.x, ny = node.y, nw = node.w, nh = node.h;

    if (node.shape === 'circle') {
      var cx = nx + nw / 2, cy = ny + nh / 2, r = nw / 2;
      return segCrossCircle(p1, p2, cx, cy, r);
    }

    if (p1.x === p2.x) {
      var x = p1.x;
      if (x <= nx || x >= nx + nw) return false;
      var minY = Math.min(p1.y, p2.y);
      var maxY = Math.max(p1.y, p2.y);
      return maxY > ny && minY < ny + nh;
    }
    if (p1.y === p2.y) {
      var y = p1.y;
      if (y <= ny || y >= ny + nh) return false;
      var minX = Math.min(p1.x, p2.x);
      var maxX = Math.max(p1.x, p2.x);
      return maxX > nx && minX < nx + nw;
    }
    return false;
  }

  function segCrossCircle(p1, p2, cx, cy, r) {
    var tolerance = 1;
    r = r - tolerance;
    if (r <= 0) return false;

    if (p1.x === p2.x) {
      var x = p1.x;
      var dx = Math.abs(x - cx);
      if (dx >= r) return false;
      var halfChord = Math.sqrt(r * r - dx * dx);
      var circMinY = cy - halfChord, circMaxY = cy + halfChord;
      var segMinY = Math.min(p1.y, p2.y), segMaxY = Math.max(p1.y, p2.y);
      return segMaxY > circMinY && segMinY < circMaxY;
    }
    if (p1.y === p2.y) {
      var y = p1.y;
      var dy = Math.abs(y - cy);
      if (dy >= r) return false;
      var halfChord2 = Math.sqrt(r * r - dy * dy);
      var circMinX = cx - halfChord2, circMaxX = cx + halfChord2;
      var segMinX = Math.min(p1.x, p2.x), segMaxX = Math.max(p1.x, p2.x);
      return segMaxX > circMinX && segMinX < circMaxX;
    }
    return false;
  }

  /**
   * 构建候选网格点集
   */
  function buildGrid(sNode, eNode, p1, q1) {
    var xs = [], ys = [];

    function addNodeLines(n) {
      xs.push(n.x - EXPAND);
      xs.push(n.x + n.w + EXPAND);
      ys.push(n.y - EXPAND);
      ys.push(n.y + n.h + EXPAND);
    }

    addNodeLines(sNode);
    if (sNode !== eNode) {
      addNodeLines(eNode);
    }

    xs.push(p1.x);
    xs.push(q1.x);
    ys.push(p1.y);
    ys.push(q1.y);

    xs = uniqueSorted(xs);
    ys = uniqueSorted(ys);

    return { xs: xs, ys: ys };
  }

  function uniqueSorted(arr) {
    arr.sort(function (a, b) { return a - b; });
    var out = [arr[0]];
    for (var i = 1; i < arr.length; i++) {
      if (arr[i] !== out[out.length - 1]) out.push(arr[i]);
    }
    return out;
  }

  /**
   * 找到最近的网格邻居（上下左右各一个）
   */
  function getNeighbors(pt, xs, ys, sNode, eNode) {
    var result = [];
    var xi = bsearch(xs, pt.x);
    var yi = bsearch(ys, pt.y);

    // left
    if (xi > 0) {
      var lp = { x: xs[xi - 1], y: pt.y };
      if (!segCrossRect(pt, lp, sNode) && !segCrossRect(pt, lp, eNode)) {
        result.push(lp);
      }
    }
    // right
    if (xi < xs.length - 1) {
      var rp = { x: xs[xi + 1], y: pt.y };
      if (!segCrossRect(pt, rp, sNode) && !segCrossRect(pt, rp, eNode)) {
        result.push(rp);
      }
    }
    // top
    if (yi > 0) {
      var tp = { x: pt.x, y: ys[yi - 1] };
      if (!segCrossRect(pt, tp, sNode) && !segCrossRect(pt, tp, eNode)) {
        result.push(tp);
      }
    }
    // bottom
    if (yi < ys.length - 1) {
      var bp = { x: pt.x, y: ys[yi + 1] };
      if (!segCrossRect(pt, bp, sNode) && !segCrossRect(pt, bp, eNode)) {
        result.push(bp);
      }
    }
    return result;
  }

  function bsearch(arr, val) {
    var lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] === val) return mid;
      if (arr[mid] < val) lo = mid + 1; else hi = mid - 1;
    }
    return lo < arr.length ? lo : arr.length - 1;
  }

  function dirOf(from, to) {
    if (to.x > from.x) return 'R';
    if (to.x < from.x) return 'L';
    if (to.y > from.y) return 'D';
    if (to.y < from.y) return 'U';
    return 'N';
  }

  /**
   * 0-1 BFS 最少拐弯寻路
   * 从 p1 到 q1，在 xs/ys 网格上，边权：直行=0，转向=1
   */
  function bfs01(p1, q1, xs, ys, sNode, eNode) {
    var startKey = ptKey(p1);
    var endKey = ptKey(q1);

    if (startKey === endKey) return [p1];

    // dist[key] = { cost, prevKey, dir }
    var dist = {};
    // 4 initial directions from p1
    var dirs = ['L', 'R', 'U', 'D'];
    var deque = []; // front/back queue: each item { pt, dir, cost }

    dist[startKey] = { cost: 0, prevKey: null, dir: null };

    var neighbors = getNeighbors(p1, xs, ys, sNode, eNode);
    for (var i = 0; i < neighbors.length; i++) {
      var nb = neighbors[i];
      var d = dirOf(p1, nb);
      var nk = ptKey(nb);
      var stateKey = nk + '|' + d;
      if (dist[stateKey] === undefined || dist[stateKey].cost > 0) {
        dist[stateKey] = { cost: 0, prevKey: startKey + '|S', dir: d };
        deque.push({ pt: nb, dir: d, cost: 0 });
      }
    }
    dist[startKey + '|S'] = { cost: 0, prevKey: null, dir: 'S' };

    var bestEnd = null;
    var bestCost = Infinity;

    while (deque.length > 0) {
      var cur = deque.shift();
      var ck = ptKey(cur.pt) + '|' + cur.dir;

      if (dist[ck] !== undefined && dist[ck].cost < cur.cost) continue;

      if (cur.pt.x === q1.x && cur.pt.y === q1.y) {
        if (cur.cost < bestCost) {
          bestCost = cur.cost;
          bestEnd = ck;
        }
        continue;
      }

      var nbs = getNeighbors(cur.pt, xs, ys, sNode, eNode);
      for (var j = 0; j < nbs.length; j++) {
        var next = nbs[j];
        var nd = dirOf(cur.pt, next);
        var turn = (nd !== cur.dir) ? 1 : 0;
        var nc = cur.cost + turn;

        if (nc >= bestCost) continue;

        var nkey = ptKey(next) + '|' + nd;
        if (dist[nkey] === undefined || nc < dist[nkey].cost) {
          dist[nkey] = { cost: nc, prevKey: ck, dir: nd };
          if (turn === 0) {
            deque.unshift({ pt: next, dir: nd, cost: nc });
          } else {
            deque.push({ pt: next, dir: nd, cost: nc });
          }
        }
      }
    }

    if (bestEnd === null) return null;

    // reconstruct
    var path = [];
    var key = bestEnd;
    while (key !== null) {
      var parts = key.split('|');
      var px = parseFloat(parts[0].split(',')[0]);
      var py = parseFloat(parts[0].split(',')[1]);
      if (parts[1] !== 'S') {
        path.unshift({ x: px, y: py });
      }
      key = dist[key] ? dist[key].prevKey : null;
    }
    // add start if missing
    if (path.length === 0 || path[0].x !== p1.x || path[0].y !== p1.y) {
      path.unshift(p1);
    }

    return path;
  }

  /**
   * 同节点回路路由
   */
  function sameNodeRoute(sAnchor, eAnchor, sNode, stubLen) {
    var ap = anchorXY(sAnchor);
    var bp = anchorXY(eAnchor);
    var sp = stubPoint(ap, sAnchor.position, stubLen);
    var ep = stubPoint(bp, eAnchor.position, stubLen);

    var nx = sNode.x, ny = sNode.y, nw = sNode.w, nh = sNode.h;
    var margin = EXPAND;
    var outerLeft = nx - margin;
    var outerRight = nx + nw + margin;
    var outerTop = ny - margin;
    var outerBottom = ny + nh + margin;

    // Build middle corners between the two stubs
    var midPts = [];

    if (sAnchor.position === 'top' && eAnchor.position === 'right') {
      midPts.push({ x: sp.x, y: outerTop }, { x: outerRight, y: outerTop }, { x: outerRight, y: ep.y });
    } else if (sAnchor.position === 'right' && eAnchor.position === 'top') {
      midPts.push({ x: outerRight, y: sp.y }, { x: outerRight, y: outerTop }, { x: ep.x, y: outerTop });
    } else if (sAnchor.position === 'top' && eAnchor.position === 'left') {
      midPts.push({ x: sp.x, y: outerTop }, { x: outerLeft, y: outerTop }, { x: outerLeft, y: ep.y });
    } else if (sAnchor.position === 'left' && eAnchor.position === 'top') {
      midPts.push({ x: outerLeft, y: sp.y }, { x: outerLeft, y: outerTop }, { x: ep.x, y: outerTop });
    } else if (sAnchor.position === 'bottom' && eAnchor.position === 'right') {
      midPts.push({ x: sp.x, y: outerBottom }, { x: outerRight, y: outerBottom }, { x: outerRight, y: ep.y });
    } else if (sAnchor.position === 'right' && eAnchor.position === 'bottom') {
      midPts.push({ x: outerRight, y: sp.y }, { x: outerRight, y: outerBottom }, { x: ep.x, y: outerBottom });
    } else if (sAnchor.position === 'bottom' && eAnchor.position === 'left') {
      midPts.push({ x: sp.x, y: outerBottom }, { x: outerLeft, y: outerBottom }, { x: outerLeft, y: ep.y });
    } else if (sAnchor.position === 'left' && eAnchor.position === 'bottom') {
      midPts.push({ x: outerLeft, y: sp.y }, { x: outerLeft, y: outerBottom }, { x: ep.x, y: outerBottom });
    } else if (sAnchor.position === 'top' && eAnchor.position === 'bottom') {
      midPts.push({ x: sp.x, y: outerTop }, { x: outerRight, y: outerTop }, { x: outerRight, y: outerBottom }, { x: ep.x, y: outerBottom });
    } else if (sAnchor.position === 'bottom' && eAnchor.position === 'top') {
      midPts.push({ x: sp.x, y: outerBottom }, { x: outerRight, y: outerBottom }, { x: outerRight, y: outerTop }, { x: ep.x, y: outerTop });
    } else if (sAnchor.position === 'left' && eAnchor.position === 'right') {
      midPts.push({ x: outerLeft, y: sp.y }, { x: outerLeft, y: outerTop }, { x: outerRight, y: outerTop }, { x: outerRight, y: ep.y });
    } else if (sAnchor.position === 'right' && eAnchor.position === 'left') {
      midPts.push({ x: outerRight, y: sp.y }, { x: outerRight, y: outerTop }, { x: outerLeft, y: outerTop }, { x: outerLeft, y: ep.y });
    }

    midPts = dedupeCollinear(midPts);

    // Structure: [anchor, stub, joint, ...middle..., joint, stub, anchor]
    return [ap,
      { x: sp.x, y: sp.y },
      { x: sp.x, y: sp.y }
    ].concat(midPts).concat([
      { x: ep.x, y: ep.y },
      { x: ep.x, y: ep.y },
      bp
    ]);
  }

  function expandDir(pos) {
    switch (pos) {
      case 'top': return { dx: 0, dy: -1 };
      case 'bottom': return { dx: 0, dy: 1 };
      case 'left': return { dx: -1, dy: 0 };
      case 'right': return { dx: 1, dy: 0 };
    }
    return { dx: 0, dy: 0 };
  }

  /**
   * 去除三点共线的中间点
   */
  function dedupeCollinear(pts) {
    if (pts.length <= 2) return pts;
    var result = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var prev = result[result.length - 1];
      var cur = pts[i];
      var next = pts[i + 1];
      var sameX = (prev.x === cur.x && cur.x === next.x);
      var sameY = (prev.y === cur.y && cur.y === next.y);
      if (!sameX && !sameY) {
        result.push(cur);
      }
    }
    result.push(pts[pts.length - 1]);
    return result;
  }

  /**
   * 主入口：计算连线折点
   * @param {Object} startAnchor  { nodeX, nodeY, nodeW, nodeH, position, nodeShape }
   * @param {Object} endAnchor    { nodeX, nodeY, nodeW, nodeH, position, nodeShape }
   * @param {Object} startNodeRect { x, y, w, h, shape }
   * @param {Object} endNodeRect   { x, y, w, h, shape }
   * @param {number} [stubLen]     桩线长度，默认 20
   * @returns {Array} 折点数组 [{x,y}, ...]
   */
  function computeLinkPoints(startAnchor, endAnchor, startNodeRect, endNodeRect, stubLen) {
    stubLen = stubLen || DEFAULT_STUB;

    var sameNode = (startNodeRect.x === endNodeRect.x &&
                    startNodeRect.y === endNodeRect.y &&
                    startNodeRect.w === endNodeRect.w &&
                    startNodeRect.h === endNodeRect.h);

    if (sameNode && startAnchor.position !== endAnchor.position) {
      return sameNodeRoute(startAnchor, endAnchor, startNodeRect, stubLen);
    }

    var ap = anchorXY(startAnchor);
    var bp = anchorXY(endAnchor);
    var p1 = stubPoint(ap, startAnchor.position, stubLen);
    var q1 = stubPoint(bp, endAnchor.position, stubLen);

    var grid = buildGrid(startNodeRect, endNodeRect, p1, q1);

    // ensure p1 and q1 are in the grid
    if (grid.xs.indexOf(p1.x) < 0) { grid.xs.push(p1.x); grid.xs = uniqueSorted(grid.xs); }
    if (grid.xs.indexOf(q1.x) < 0) { grid.xs.push(q1.x); grid.xs = uniqueSorted(grid.xs); }
    if (grid.ys.indexOf(p1.y) < 0) { grid.ys.push(p1.y); grid.ys = uniqueSorted(grid.ys); }
    if (grid.ys.indexOf(q1.y) < 0) { grid.ys.push(q1.y); grid.ys = uniqueSorted(grid.ys); }

    var bfsPath = bfs01(p1, q1, grid.xs, grid.ys, startNodeRect, endNodeRect);

    if (bfsPath && bfsPath.length > 0) {
      bfsPath = dedupeCollinear(bfsPath);
    } else {
      bfsPath = [p1, q1];
    }

    // Fix end fold-back: BFS routed through end anchor bp then doubled back to q1
    if (bfsPath.length >= 3) {
      var stl = bfsPath[bfsPath.length - 2];
      if (stl.x === bp.x && stl.y === bp.y) {
        var prev = bfsPath[bfsPath.length - 3];
        var fix = { x: prev.x, y: q1.y };
        if (fix.x === bp.x && fix.y === bp.y) fix = { x: q1.x, y: prev.y };
        bfsPath[bfsPath.length - 2] = fix;
        bfsPath = dedupeCollinear(bfsPath);
      }
    }

    // Fix start fold-back: BFS routed through start anchor ap from p1
    if (bfsPath.length >= 3) {
      var sec = bfsPath[1];
      if (sec.x === ap.x && sec.y === ap.y) {
        var nxt = bfsPath[2];
        var fix2 = { x: p1.x, y: nxt.y };
        if (fix2.x === ap.x && fix2.y === ap.y) fix2 = { x: nxt.x, y: p1.y };
        bfsPath[1] = fix2;
        bfsPath = dedupeCollinear(bfsPath);
      }
    }

    // Structure: [anchor, stub, joint, ...middle..., joint, stub, anchor]
    // Joint points isolate the fixed stubs from draggable middle segments
    var middle = bfsPath.slice(1, -1);
    return [ap,
      { x: p1.x, y: p1.y },
      { x: p1.x, y: p1.y }
    ].concat(middle).concat([
      { x: q1.x, y: q1.y },
      { x: q1.x, y: q1.y },
      bp
    ]);
  }

  // Public API
  var api = {
    computeLinkPoints: computeLinkPoints,
    anchorXY: anchorXY,
    dedupeCollinear: dedupeCollinear,
    segCrossRect: segCrossRect
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  return api;
})();
