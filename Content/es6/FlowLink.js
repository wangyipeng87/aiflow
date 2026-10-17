/**
 * AiFlow - 流程连线（ES6 class）
 * 原 aiflow.js FlowLink 迁移
 * 路由算法仍使用全局 AiFlowRouter（Content/js/aiflow-router.js，IIFE + module.exports）
 *
 * 本地改动（作者 wyp）：1) 新增 setPoints()/_isPointsMatchAnchors()，支持连线手动折点的还原；
 * 2) 新增手工折点状态（_manual/_manualPts/_manualBase）与 markManualPoints()/_computeAutoPoints()/
 *    _applyManualPoints()/_clearManualPoints()：折点存“相对自动布线的位移”，节点移动后自动布线重算、
 *    位移照旧套用，手工走向跟着节点走，而不是被自动布线覆盖；
 * 3) _applyManualPoints() 增加正交守卫（_isOrthogonalPath()）：自动布线“点数相同但结构翻转”时
 *    按索引套位移会画出斜线，此时放弃手工折点、回退自动布线（节点移回原位后手工走向自动恢复）；
 * 与原版（文档/aiflow/Content/es6/FlowLink.js）的差异为上述折点相关改动
 */
import { deepClone } from './utils.js';

const Router = () => (typeof window !== 'undefined' ? window.AiFlowRouter : null);

export class FlowLink {
  constructor(designer, opts) {
    this.designer = designer;
    this.id = opts.id;
    this.startNodeId = opts.startNodeId;
    this.startAnchorPos = opts.startAnchorPos;
    this.endNodeId = opts.endNodeId;
    this.endAnchorPos = opts.endAnchorPos;
    this.remark = opts.remark || '';
    this.remarkX = opts.remarkX != null ? opts.remarkX : null; // null 表示自动跟随连线中点
    this.remarkY = opts.remarkY != null ? opts.remarkY : null;
    this.remarkAuto = true; // true 表示自动定位模式，拖拽后变为 false
    this.customStyle = opts.style || null;
    this._readonly = designer.readonly;
    this._selected = false;

    this._segments = [];
    this._hitAreas = [];
    this._points = [];
    this._remarkEl = null;
    this._remarkBg = null; // 标签背景圆角矩形
    this._startEndpoint = null;
    this._endEndpoint = null;
    this._arrowEl = null;
    this._contextMenuItems = null;
    this._manual = false;     // 是否存在手工折点（拖动线段产生的走向，作者 wyp）
    this._manualPts = null;   // 手工折点（绝对画布坐标）
    this._manualBase = null;  // 该次手工编辑时的自动布线折点，与 _manualPts 成对，用于计算位移

    this.resetPath();
  }

  resetPath() {
    this._clearGraphics();

    const autoPts = this._computeAutoPoints();
    if (!autoPts) return;

    // 有手工折点时按“相对自动布线的位移”套用，节点移动后手工走向跟着走（作者 wyp）
    this._points = this._applyManualPoints(autoPts);
    this._render();
  }

  /**
   * 计算当前节点位置下的自动布线折点（作者 wyp）
   * 从 resetPath() 中抽出，供 resetPath 与手工折点基准共用
   *
   * @return 折点数组；两端节点缺失时返回 null
   */
  _computeAutoPoints() {
    const d = this.designer;
    const router = Router();
    if (!d || !router) return null;
    const sNode = d.getNodeById(this.startNodeId);
    const eNode = d.getNodeById(this.endNodeId);
    if (!sNode || !eNode) return null;

    const sRect = sNode._getRect();
    const eRect = eNode._getRect();

    const sAnchor = {
      nodeX: sNode.x, nodeY: sNode.y, nodeW: sNode.width, nodeH: sNode.height,
      position: this.startAnchorPos, nodeShape: sNode.shape
    };
    const eAnchor = {
      nodeX: eNode.x, nodeY: eNode.y, nodeW: eNode.width, nodeH: eNode.height,
      position: this.endAnchorPos, nodeShape: eNode.shape
    };

    return router.computeLinkPoints(sAnchor, eAnchor, sRect, eRect, d.cfg.stubLength);
  }

  /**
   * 把手动折点套用到新的自动布线上（作者 wyp）
   * 折点存的是“相对自动布线的位移”：节点移动后自动布线重算、位移照旧套用，手工走向随节点平移；
   * 点数对不上（布线结构变了）说明位移已无意义，放弃手工折点回退自动布线，避免画出畸形连线
   *
   * 注意：点数相同也可能“结构翻转”（如先横后竖翻成先竖后横，HZHVZV → HZVHZV），
   * 此时按索引套位移会套到语义不同的折点上画出斜线，故末尾再加一道正交守卫（作者 wyp）
   *
   * @param autoPts 当前节点位置下的自动布线折点
   * @return 实际使用的折点数组
   */
  _applyManualPoints(autoPts) {
    if (!this._manual || !this._manualPts || !this._manualBase) return autoPts;
    const n = autoPts.length;
    if (this._manualPts.length !== n || this._manualBase.length !== n) {
      this._clearManualPoints();
      return autoPts;
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        x: autoPts[i].x + (this._manualPts[i].x - this._manualBase[i].x),
        y: autoPts[i].y + (this._manualPts[i].y - this._manualBase[i].y)
      });
    }
    // 首尾强制回到新锚点，避免线头脱离节点
    out[0] = { x: autoPts[0].x, y: autoPts[0].y };
    out[n - 1] = { x: autoPts[n - 1].x, y: autoPts[n - 1].y };
    // 正交守卫：结构翻转时套出来的走向会带斜段/折返，本次不采用（不清手工折点状态，
    // 节点移回原位后自动布线结构复原，手工走向会自动恢复）（作者 wyp）
    if (!this._isOrthogonalPath(out)) return autoPts;
    return out;
  }

  /**
   * 校验折点是否保持直角走向（作者 wyp）
   * 连线是正交直角线，出现斜段（相邻两点 x、y 都不相等）或折返（三点共线且方向反转）
   * 都说明位移套错了折点，应放弃手工折点让调用方回退自动布线
   *
   * @param pts 折点数组
   * @return true=全为直角且不折返，可安全采用
   */
  _isOrthogonalPath(pts) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a.x !== b.x && a.y !== b.y) return false;
    }
    for (let j = 1; j < pts.length - 1; j++) {
      const p0 = pts[j - 1], p1 = pts[j], p2 = pts[j + 1];
      if (p0.x === p1.x && p1.x === p2.x && (p1.y - p0.y) * (p2.y - p1.y) < 0) return false;
      if (p0.y === p1.y && p1.y === p2.y && (p1.x - p0.x) * (p2.x - p1.x) < 0) return false;
    }
    return true;
  }

  /**
   * 把当前走向记为手工折点（线段拖动结束时调用，作者 wyp）
   * 基准取“此刻节点位置下的自动布线”，与当前折点成对保存，保证位移口径一致
   */
  markManualPoints() {
    const auto = this._computeAutoPoints();
    if (!auto || auto.length !== this._points.length) return;
    this._manual = true;
    this._manualPts = deepClone(this._points);
    this._manualBase = auto;
  }

  /** 清空手工折点、回到自动布线（双击连线恢复默认路径时调用，作者 wyp） */
  _clearManualPoints() {
    this._manual = false;
    this._manualPts = null;
    this._manualBase = null;
  }

  _clearGraphics() {
    for (let i = 0; i < this._segments.length; i++) this._segments[i].remove();
    for (let j = 0; j < this._hitAreas.length; j++) this._hitAreas[j].remove();
    if (this._remarkBg) this._remarkBg.remove();
    if (this._remarkEl) this._remarkEl.remove();
    if (this._startEndpoint) this._startEndpoint.remove();
    if (this._endEndpoint) this._endEndpoint.remove();
    if (this._arrowEl) this._arrowEl.remove();
    this._segments = [];
    this._hitAreas = [];
    this._remarkBg = null;
    this._remarkEl = null;
    this._startEndpoint = null;
    this._endEndpoint = null;
    this._arrowEl = null;
    this._segPathCache = null;
  }

  _segPathStr(i) {
    const a = this._points[i], b = this._points[i + 1];
    return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;
  }

  _bridgeSegPath(segIdx, allSegs) {
    const a = this._points[segIdx], b = this._points[segIdx + 1];
    const r = this.designer.cfg.bridgeRadius || 6;
    const isVert = (a.x === b.x && a.y !== b.y);

    if (!isVert) return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;

    // 复用预收集的段（含 linkId）；未传入时自行收集（向后兼容）
    let otherSegs;
    if (allSegs) {
      otherSegs = allSegs;
    } else {
      otherSegs = this.designer._collectAllSegments();
    }
    const self = this;
    const x = a.x;
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const crossings = [];

    for (let i = 0; i < otherSegs.length; i++) {
      const s = otherSegs[i];
      if (s.linkId === self.id) continue; // 跳过自己的段
      if (s.p1.y !== s.p2.y) continue;
      const sy = s.p1.y;
      const sMinX = Math.min(s.p1.x, s.p2.x), sMaxX = Math.max(s.p1.x, s.p2.x);
      if (sy > minY + r && sy < maxY - r && x > sMinX && x < sMaxX) {
        crossings.push(sy);
      }
    }

    if (crossings.length === 0) return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;

    const goDown = (a.y < b.y);
    crossings.sort((c1, c2) => goDown ? c1 - c2 : c2 - c1);

    let path = 'M' + x + ',' + a.y;
    for (let j = 0; j < crossings.length; j++) {
      const cy = crossings[j];
      if (goDown) {
        path += 'L' + x + ',' + (cy - r) + 'A' + r + ',' + r + ' 0 0,1 ' + x + ',' + (cy + r);
      } else {
        path += 'L' + x + ',' + (cy + r) + 'A' + r + ',' + r + ' 0 0,0 ' + x + ',' + (cy - r);
      }
    }
    path += 'L' + x + ',' + b.y;
    return path;
  }

  // 平移连线折点（批量拖拽期间使用，不更新 DOM；随后统一 _refreshSegPaths）
  _translate(dx, dy) {
    if (!dx && !dy) return;
    for (let i = 0; i < this._points.length; i++) {
      this._points[i].x += dx;
      this._points[i].y += dy;
    }
    // 同步平移备注标签位置
    if (this.remarkX != null) this.remarkX += dx;
    if (this.remarkY != null) this.remarkY += dy;
  }

  // 用预收集的段数据刷新所有段路径（批量拖拽每帧一次收集、统一更新）
  _refreshSegPaths(allSegs) {
    for (let i = 0; i < this._segments.length; i++) {
      this._updateSegPath(i, allSegs);
    }
    if (this._remarkEl) {
      this._updateRemarkPosition();
    }
  }

  _isSegDraggable(segIdx) {
    const numSegs = this._points.length - 1;
    return segIdx >= 2 && segIdx <= numSegs - 3;
  }

  _updateSegPath(segIdx, allSegs) {
    const bp = this._bridgeSegPath(segIdx, allSegs);
    const ps = this._segPathStr(segIdx);
    if (this._segments[segIdx]) this._segments[segIdx].attr({ path: bp });
    if (this._hitAreas[segIdx]) this._hitAreas[segIdx].attr({ path: ps });
    if (!this._segPathCache) this._segPathCache = [];
    this._segPathCache[segIdx] = bp;
  }

  _render() {
    const d = this.designer;
    const p = d.paper;
    const pts = this._points;
    if (pts.length < 2) return;

    const strokeColor = (this.customStyle && this.customStyle.stroke) || d.cfg.link.stroke;
    const strokeW = (this.customStyle && this.customStyle.strokeWidth) || d.cfg.link.strokeWidth;
    const self = this;
    const numSegs = pts.length - 1;

    for (let i = 0; i < numSegs; i++) {
      const bridgePath = this._bridgeSegPath(i);
      const simplePath = this._segPathStr(i);

      const seg = p.path(bridgePath).attr({
        stroke: this._selected ? d.cfg.link.selectedStroke : strokeColor,
        'stroke-width': strokeW
      });
      if (i === numSegs - 1) {
        seg.attr({ 'arrow-end': d.cfg.link.arrowEnd });
      }
      this._segments.push(seg);
      if (!this._segPathCache) this._segPathCache = [];
      this._segPathCache[i] = bridgePath;

      let cursor = 'pointer';
      if (this._isSegDraggable(i)) {
        const pa = pts[i], pb = pts[i + 1];
        if (pa.x === pb.x) cursor = 'col-resize';
        else if (pa.y === pb.y) cursor = 'row-resize';
      }

      const hit = p.path(simplePath).attr({
        stroke: 'transparent', 'stroke-width': d.cfg.link.hitAreaWidth,
        'stroke-opacity': 0, cursor
      });

      ((hitEl, idx) => {
        hitEl.click((e) => {
          if (e.button === 2) return;
          d._selectLink(self);
        });
        hitEl.dblclick(() => {
          if (d.readonly) return;
          // 双击恢复默认路径：同时清掉手工折点（作者 wyp）
          self._clearManualPoints();
          self.resetPath();
        });
        hitEl.node.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          let items = self._contextMenuItems || d.cfg.contextMenu.linkItems;
          if (d.readonly) items = items.filter((it) => it.action !== 'delete');
          if (items.length === 0) return;
          d._selectLink(self);
          d._showContextMenu(e.pageX, e.pageY, items, self);
        });
      })(hit, i);

      if (this._isSegDraggable(i)) {
        this._makeSegDraggable(hit, i);
      }
      this._hitAreas.push(hit);
    }

    this._drawRemark();
    this._drawEndpoints();
    if (this._selected) this._showEndpoints(); else this._hideEndpoints();
  }

  _makeSegDraggable(hitEl, segIdx) {
    const self = this;
    const d = this.designer;
    let origPts, isVert;

    const start = () => {
      if (d.readonly || self._readonly) return;
      d._pushUndo();
      origPts = deepClone(self._points);
      isVert = (origPts[segIdx].x === origPts[segIdx + 1].x);
    };

    const move = (dx, dy) => {
      if (d.readonly || self._readonly || !origPts) return;
      const sdx = dx / d.scale, sdy = dy / d.scale;

      if (isVert) {
        const newX = origPts[segIdx].x + sdx;
        self._points[segIdx].x = newX;
        self._points[segIdx + 1].x = newX;
      } else {
        const newY = origPts[segIdx].y + sdy;
        self._points[segIdx].y = newY;
        self._points[segIdx + 1].y = newY;
      }

      const allSegs = d._collectAllSegments();
      self._updateSegPath(segIdx, allSegs);

      if (segIdx > 0) {
        self._points[segIdx - 1] = deepClone(origPts[segIdx - 1]);
        self._updateSegPath(segIdx - 1, allSegs);
      }

      if (segIdx + 1 < self._points.length - 1) {
        self._points[segIdx + 2] = deepClone(origPts[segIdx + 2]);
        self._updateSegPath(segIdx + 1, allSegs);
      }
      d._refreshAllBridges();
    };

    const up = () => {
      origPts = null;
      // 线段拖动结束：把当前走向记为手工折点，之后节点移动时按位移跟随（作者 wyp）
      self.markManualPoints();
      d._scheduleMinimap();
    };

    hitEl.drag(move, start, up);
  }

  _drawRemark() {
    if (!this.remark) return;
    const pts = this._points;
    const midIdx = Math.floor(pts.length / 2);
    const p1 = pts[midIdx - 1] || pts[0];
    const p2 = pts[midIdx] || pts[pts.length - 1];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    // 自动定位模式：跟随连线中点
    if (this.remarkAuto) {
      this.remarkX = mx;
      this.remarkY = my - 10;
    }

    const d = this.designer;
    const rs = Object.assign({}, d.cfg.link.remarkStyle);
    const pad = rs.rectPadding || 4;

    // 文字
    this._remarkEl = d.paper.text(this.remarkX, this.remarkY, this.remark).attr({
      'font-size': rs['font-size'], fill: rs.fill, 'text-anchor': 'middle', cursor: 'pointer'
    });
    // 计算文字边界框，画背景圆角矩形
    const bbox = this._remarkEl.getBBox();
    this._remarkBg = d.paper.rect(
      bbox.x - pad, bbox.y - pad,
      bbox.width + pad * 2, bbox.height + pad * 2,
      rs.rectRadius || 3
    ).attr({
      fill: rs.rectFill, stroke: rs.rectStroke, 'stroke-width': 1, cursor: 'pointer'
    });
    // 背景移到文字下方
    this._remarkBg.toBack();
    // 但要在连线段上方
    if (this._segments.length) this._remarkBg.insertAfter(this._segments[this._segments.length - 1]);

    // 设置标签拖拽
    this._setupRemarkDrag();
  }

  _setupRemarkDrag() {
    const self = this;
    const d = this.designer;
    let startRx, startRy;

    const dragStart = () => {
      if (d.readonly || self._readonly) return;
      // 拖拽起点取当前渲染位置,而非模型字段,避免模型与显示脱钩时出现拖拽偏差
      startRx = self._remarkEl ? parseFloat(self._remarkEl.attr('x')) : self.remarkX;
      startRy = self._remarkEl ? parseFloat(self._remarkEl.attr('y')) : self.remarkY;
    };

    const dragMove = (dx, dy) => {
      if (d.readonly || self._readonly) return;
      const sdx = dx / d.scale, sdy = dy / d.scale;
      const nx = startRx + sdx, ny = startRy + sdy;
      self.remarkX = nx;
      self.remarkY = ny;
      self.remarkAuto = false; // 用户手动拖拽后切换为固定定位模式
      // 移动文字和背景
      self._remarkEl.attr({ x: nx, y: ny });
      const bbox = self._remarkEl.getBBox();
      const pad = (d.cfg.link.remarkStyle && d.cfg.link.remarkStyle.rectPadding) || 4;
      self._remarkBg.attr({ x: bbox.x - pad, y: bbox.y - pad });
    };

    const dragUp = () => {
      d._scheduleMinimap();
    };

    if (this._remarkEl) this._remarkEl.drag(dragMove, dragStart, dragUp);
    if (this._remarkBg) this._remarkBg.drag(dragMove, dragStart, dragUp);

    // 点击标签选中对应连线
    const clickHandler = (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      d._selectLink(self);
    };
    if (this._remarkEl) this._remarkEl.mousedown(clickHandler);
    if (this._remarkBg) this._remarkBg.mousedown(clickHandler);
  }

  // 更新备注标签位置（重路由/平移后调用）
  _updateRemarkPosition() {
    if (!this._remarkEl || !this.remark) return;
    // 如果用户手动拖拽过（remarkX/Y 不为 null），跟随平移由 _translate 处理
    this._remarkEl.attr({ x: this.remarkX, y: this.remarkY });
    const bbox = this._remarkEl.getBBox();
    const pad = (this.designer.cfg.link.remarkStyle && this.designer.cfg.link.remarkStyle.rectPadding) || 4;
    if (this._remarkBg) this._remarkBg.attr({ x: bbox.x - pad, y: bbox.y - pad });
  }

  _drawEndpoints() {
    const d = this.designer;
    const lcfg = d.cfg.link;
    if (this._points.length < 2) return;
    const sp = this._points[0];
    const ep = this._points[this._points.length - 1];
    this._startEndpoint = d.paper.circle(sp.x, sp.y, lcfg.endpointRadius).attr({
      fill: lcfg.endpointFill, stroke: lcfg.endpointStroke, cursor: 'move'
    }).hide();
    this._endEndpoint = d.paper.circle(ep.x, ep.y, lcfg.endpointRadius).attr({
      fill: lcfg.endpointFill, stroke: lcfg.endpointStroke, cursor: 'move'
    }).hide();

    this._setupEndpointDrag(this._startEndpoint, 'start');
    this._setupEndpointDrag(this._endEndpoint, 'end');
  }

  _setupEndpointDrag(circle, which) {
    const self = this;
    const d = this.designer;
    let origCX, origCY, tempLine, fixedPt;

    const start = () => {
      if (d.readonly || self._readonly) return;
      d._pushUndo();
      origCX = parseFloat(circle.attr('cx'));
      origCY = parseFloat(circle.attr('cy'));
      if (which === 'start') {
        fixedPt = self._points[self._points.length - 1];
      } else {
        fixedPt = self._points[0];
      }
      // 创建一次 tempLine，move 中只更新 path（不 remove+create）
      tempLine = d.paper.path('M' + fixedPt.x + ',' + fixedPt.y + 'L' + origCX + ',' + origCY).attr({
        stroke: d.cfg.link.selectedStroke, 'stroke-width': 1.5, 'stroke-dasharray': '- '
      });
    };

    const move = (dx, dy) => {
      if (d.readonly || self._readonly || !tempLine) return;
      const sdx = dx / d.scale, sdy = dy / d.scale;
      const nx = origCX + sdx;
      const ny = origCY + sdy;
      circle.attr({ cx: nx, cy: ny });
      tempLine.attr({ path: 'M' + fixedPt.x + ',' + fixedPt.y + 'L' + nx + ',' + ny });
    };

    const up = (e) => {
      if (d.readonly || self._readonly) return;
      if (tempLine) { tempLine.remove(); tempLine = null; }

      const foundAnchor = d._findAnchorAtScreenPoint(e.clientX, e.clientY);
      if (foundAnchor) {
        const nn = foundAnchor.node;
        const pos = foundAnchor.position;
        if (which === 'start') {
          if (nn.type === 'end') { self.delete(); return; }
          self.startNodeId = nn.id;
          self.startAnchorPos = pos;
        } else {
          if (nn.type === 'start') { self.delete(); return; }
          self.endNodeId = nn.id;
          self.endAnchorPos = pos;
        }
        self.resetPath();
      } else {
        self.delete();
      }
    };

    circle.drag(move, start, up);
  }

  _showEndpoints() {
    if (this._startEndpoint) this._startEndpoint.show();
    if (this._endEndpoint) this._endEndpoint.show();
  }

  _hideEndpoints() {
    if (this._startEndpoint) this._startEndpoint.hide();
    if (this._endEndpoint) this._endEndpoint.hide();
  }

  _select() {
    this._selected = true;
    const sc = this.designer.cfg.link.selectedStroke;
    const sw = this.designer.cfg.link.selectedStrokeWidth;
    for (let i = 0; i < this._segments.length; i++) {
      this._segments[i].attr({ stroke: sc, 'stroke-width': sw });
    }
    this._showEndpoints();
    // 标签高亮
    if (this._remarkBg) {
      const rs = this.designer.cfg.link.remarkStyle;
      this._remarkBg.attr({ fill: rs.selectedFill, stroke: rs.selectedStroke });
    }
    if (this._remarkEl) {
      const rs2 = this.designer.cfg.link.remarkStyle;
      this._remarkEl.attr({ fill: rs2.selectedTextFill });
    }
  }

  _deselect() {
    this._selected = false;
    const nc = (this.customStyle && this.customStyle.stroke) || this.designer.cfg.link.stroke;
    const nw = (this.customStyle && this.customStyle['stroke-width']) || this.designer.cfg.link.strokeWidth;
    for (let i = 0; i < this._segments.length; i++) {
      this._segments[i].attr({ stroke: nc, 'stroke-width': nw });
    }
    this._hideEndpoints();
    // 标签恢复
    if (this._remarkBg) {
      const rs = this.designer.cfg.link.remarkStyle;
      this._remarkBg.attr({ fill: rs.rectFill, stroke: rs.rectStroke });
    }
    if (this._remarkEl) {
      const rs2 = this.designer.cfg.link.remarkStyle;
      this._remarkEl.attr({ fill: rs2.fill });
    }
  }

  delete() {
    this._clearGraphics();
    this.designer._removeLink(this);
  }

  setRemark(text) {
    this.remark = text;
    if (this._remarkBg) this._remarkBg.remove();
    if (this._remarkEl) this._remarkEl.remove();
    this._remarkBg = null;
    this._remarkEl = null;
    this._drawRemark();
    this.designer._scheduleMinimap();
  }

  setStyle(style) {
    this.customStyle = Object.assign(this.customStyle || {}, style);
    this.resetPath();
  }

  /**
   * 还原折点（连线线段被手动拖动后的走向）（作者 wyp）
   * 本副本相对插件原版（文档/aiflow）的本地扩展：原版 exportJSON/importJSON 不包含折点，
   * 拖动线段后保存再加载会被自动布线覆盖，故补上折点的导出与还原
   *
   * @param points 折点数组 [{x, y}, ...]，绝对画布坐标，至少 2 个点
   * @return true=已按传入折点重绘；false=数据非法或与当前锚点不匹配，由调用方保持自动布线
   */
  setPoints(points) {
    if (!Array.isArray(points) || points.length < 2) return false;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' ||
          !isFinite(p.x) || !isFinite(p.y)) {
        return false;
      }
    }
    if (!this._isPointsMatchAnchors(points)) return false;

    this._clearGraphics();
    this._points = deepClone(points);
    // 记为手工折点：加载后拖动节点时折点按位移跟随，而不是被自动布线覆盖（作者 wyp）
    const auto = this._computeAutoPoints();
    if (auto && auto.length === this._points.length) {
      this._manual = true;
      this._manualPts = deepClone(this._points);
      this._manualBase = auto;
    } else {
      this._clearManualPoints();
    }
    this._render();
    // 本线走向变化会影响其它连线与它交叉处的过桥弧线
    if (this.designer) this.designer._refreshAllBridges();
    return true;
  }

  /**
   * 校验折点首尾是否仍与两端锚点重合（容差 1px）（作者 wyp）
   * 折点是绝对坐标，锚点按节点当前位置实时计算；不重合说明折点相对节点已过期（数据被外部改过），
   * 此时应回退自动布线，避免还原出一条悬空的连线
   *
   * @param points 折点数组
   * @return true=匹配，可安全还原
   */
  _isPointsMatchAnchors(points) {
    const d = this.designer;
    const router = Router();
    if (!d || !router || typeof router.anchorXY !== 'function') return true;
    const sNode = d.getNodeById(this.startNodeId);
    const eNode = d.getNodeById(this.endNodeId);
    if (!sNode || !eNode) return false;
    const ap = router.anchorXY({
      nodeX: sNode.x, nodeY: sNode.y, nodeW: sNode.width, nodeH: sNode.height,
      position: this.startAnchorPos, nodeShape: sNode.shape
    });
    const bp = router.anchorXY({
      nodeX: eNode.x, nodeY: eNode.y, nodeW: eNode.width, nodeH: eNode.height,
      position: this.endAnchorPos, nodeShape: eNode.shape
    });
    const tol = 1;
    const first = points[0];
    const last = points[points.length - 1];
    return Math.abs(first.x - ap.x) <= tol && Math.abs(first.y - ap.y) <= tol &&
           Math.abs(last.x - bp.x) <= tol && Math.abs(last.y - bp.y) <= tol;
  }

  setReadonly(val) { this._readonly = !!val; }
  setContextMenu(items) { this._contextMenuItems = items; }
  _applyReadonly(val) { this._readonly = val; }
}
