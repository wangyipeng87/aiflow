/**
 * AiFlow - 流程节点（ES6 class）
 * 原 aiflow.js FlowNode 迁移
 *
 * 本地改动（作者 wyp）：拖拽区分“点击”与“拖拽”（位移阈值 3px，与工具栏拖拽 distance:3 一致），
 * 纯点击不写撤销栈、不重路由关联连线，避免把连线的手工折点冲掉；
 * 只读模式下允许展示 designer.setNodeContextMenu() 显式配置的节点右键菜单；
 * 与原版（文档/aiflow/Content/es6/FlowNode.js）的差异为上述两处
 */
import { FlowAnchor } from './FlowAnchor.js';

export class FlowNode {
  constructor(designer, opts) {
    this.designer = designer;
    this.id = opts.id;
    this.type = opts.type;
    this.name = opts.name || '';
    this.x = opts.x;
    this.y = opts.y;
    this.customStyle = opts.style || null;
    this._readonly = designer.readonly;
    this._selected = false;

    const typeCfg = designer.cfg.nodeTypes[this.type];
    this.width = typeCfg.width;
    this.height = typeCfg.height;
    this.shape = typeCfg.shape;
    this._typeCfg = typeCfg;

    this.raphaelSet = designer.paper.set();
    this.anchors = {};
    this._contextMenuItems = null;

    this._draw();
  }

  _draw() {
    const d = this.designer;
    const p = d.paper;
    const tc = this._typeCfg;
    const self = this;

    if (this.shape === 'circle') {
      const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
      this._shapeEl = p.circle(cx, cy, tc.radius);
    } else if (this.shape === 'diamond') {
      const dmx = this.x + this.width / 2, dmy = this.y;
      const pathStr = 'M' + dmx + ',' + dmy +
        'L' + (this.x + this.width) + ',' + (this.y + this.height / 2) +
        'L' + dmx + ',' + (this.y + this.height) +
        'L' + this.x + ',' + (this.y + this.height / 2) + 'Z';
      this._shapeEl = p.path(pathStr);
    } else {
      this._shapeEl = p.rect(this.x, this.y, this.width, this.height, tc.cornerRadius || 0);
    }

    const fill = (this.customStyle && this.customStyle.fill) || tc.fill;
    const stroke = (this.customStyle && this.customStyle.stroke) || tc.stroke;

    this._shapeEl.attr({
      fill, stroke,
      'stroke-width': tc.strokeWidth,
      'fill-opacity': tc.fillOpacity,
      cursor: 'move'
    });
    this.raphaelSet.push(this._shapeEl);

    const txStyle = Object.assign({}, tc.textStyle, (this.customStyle && this.customStyle.textStyle) || {});
    const tcx = this.x + this.width / 2;
    const tcy = this.y + this.height / 2;
    this._textEl = p.text(tcx, tcy, this.name).attr(txStyle).attr({ cursor: 'move' });
    this.raphaelSet.push(this._textEl);

    if (this.shape === 'circle') {
      this._selBorder = p.circle(this.x + this.width / 2, this.y + this.height / 2, tc.radius + 3);
    } else if (this.shape === 'diamond') {
      const dmx = this.x + this.width / 2, dTop = this.y;
      const selPath = 'M' + dmx + ',' + (dTop - 3) +
        'L' + (this.x + this.width + 3) + ',' + (this.y + this.height / 2) +
        'L' + dmx + ',' + (this.y + this.height + 3) +
        'L' + (this.x - 3) + ',' + (this.y + this.height / 2) + 'Z';
      this._selBorder = p.path(selPath);
    } else {
      this._selBorder = p.rect(this.x - 3, this.y - 3, this.width + 6, this.height + 6, (tc.cornerRadius || 0) + 2);
    }
    this._selBorder.attr({ stroke: '#1890ff', 'stroke-width': 2, 'stroke-dasharray': '- ', fill: 'none' }).hide();

    this._drawAnchors();
    this._setupDrag();

    const clickHandler = (e) => {
      if (e.button === 2) return;
      d._selectNode(self, e.ctrlKey || e.metaKey);
    };
    this._shapeEl.click(clickHandler);
    this._textEl.click(clickHandler);

    const ctxHandler = (e) => {
      e.preventDefault();
      // 只读模式仅响应显式配置的右键菜单：节点级覆盖或 designer.setNodeContextMenu() 设置的菜单（作者 wyp）
      const hasCustomMenu = (self._contextMenuItems && self._contextMenuItems.length) ||
        (d._nodeMenuCustomized && d.cfg.contextMenu.nodeItems && d.cfg.contextMenu.nodeItems.length);
      if (d.readonly && !hasCustomMenu) return;
      let items = self._contextMenuItems || d.cfg.contextMenu.nodeItems;
      if (d.readonly) {
        items = items.filter((it) => it.action !== 'delete');
      }
      if (items.length === 0) return;
      d._selectNode(self);
      d._showContextMenu(e.pageX, e.pageY, items, self);
    };
    this._shapeEl.node.addEventListener('contextmenu', ctxHandler);
    this._textEl.node.addEventListener('contextmenu', ctxHandler);
  }

  _drawAnchors() {
    const positions = ['top', 'bottom', 'left', 'right'];
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const anchor = new FlowAnchor(this.designer, this, pos);
      this.anchors[pos] = anchor;
    }
  }

  _getAnchorXY(pos) {
    if (this.shape === 'circle') {
      const cx = this.x + this.width / 2, cy = this.y + this.height / 2, r = this._typeCfg.radius;
      switch (pos) {
        case 'top': return { x: cx, y: cy - r };
        case 'bottom': return { x: cx, y: cy + r };
        case 'left': return { x: cx - r, y: cy };
        case 'right': return { x: cx + r, y: cy };
      }
    } else if (this.shape === 'diamond') {
      const dxc = this.x + this.width / 2, dyc = this.y + this.height / 2;
      switch (pos) {
        case 'top': return { x: dxc, y: this.y };
        case 'bottom': return { x: dxc, y: this.y + this.height };
        case 'left': return { x: this.x, y: dyc };
        case 'right': return { x: this.x + this.width, y: dyc };
      }
    }
    switch (pos) {
      case 'top': return { x: this.x + this.width / 2, y: this.y };
      case 'bottom': return { x: this.x + this.width / 2, y: this.y + this.height };
      case 'left': return { x: this.x, y: this.y + this.height / 2 };
      case 'right': return { x: this.x + this.width, y: this.y + this.height / 2 };
    }
    return { x: this.x, y: this.y };
  }

  _getRect() {
    return { x: this.x, y: this.y, w: this.width, h: this.height, shape: this.shape };
  }

  _setupDrag() {
    const self = this;
    const d = this.designer;
    let ox, oy, otherOrigins;
    // Raphael 的 move 回调传入的 dx/dy 是“自拖拽起点起的累计位移”，
    // 而 _translate 是增量叠加，故这里记录上一帧已套用的位移，只传本帧增量（作者 wyp）
    let prevOffX, prevOffY;
    let moved = false; // 本次按下是否真正拖动过（未越过阈值视为点击，作者 wyp）
    const DRAG_THRESHOLD = 3; // 屏幕像素阈值，与工具栏拖拽 distance:3 保持一致

    const start = () => {
      if (d.readonly || self._readonly) return;
      // 此处不写撤销栈：真正开始拖动（越过阈值）时再写，纯点击不应产生撤销点（作者 wyp）
      moved = false;
      ox = self.x; oy = self.y;
      prevOffX = 0; prevOffY = 0;
      otherOrigins = [];
      if (d.selectedNodes.length > 1 && d.selectedNodes.indexOf(self) >= 0) {
        for (let i = 0; i < d.selectedNodes.length; i++) {
          const sn = d.selectedNodes[i];
          if (sn !== self) otherOrigins.push({ node: sn, ox: sn.x, oy: sn.y });
        }
      }
      // 预计算批量拖拽涉及的所有连线（去重）
      self._batchLinks = [];
      const seen = {};
      const all = [self];
      for (let k = 0; k < otherOrigins.length; k++) all.push(otherOrigins[k].node);
      for (let m = 0; m < all.length; m++) {
        const rel = d._getLinksByNodeId(all[m].id);
        for (let n2 = 0; n2 < rel.length; n2++) {
          if (!seen[rel[n2].id]) { seen[rel[n2].id] = true; self._batchLinks.push(rel[n2]); }
        }
      }
    };
    const move = (dx, dy) => {
      if (d.readonly || self._readonly) return;
      // 位移未越过阈值先按点击处理：不移动节点、不写撤销栈（作者 wyp）
      if (!moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        moved = true;
        d._pushUndo();
      }
      const sdx = dx / d.scale, sdy = dy / d.scale;
      let nx = ox + sdx, ny = oy + sdy;
      const snap = d._showAlignGuides(self, nx, ny);
      if (snap.snapX !== null) nx = snap.snapX;
      if (snap.snapY !== null) ny = snap.snapY;

      if (otherOrigins.length > 0) {
        // 批量拖拽：移动图形 + 平移连线（不重路由，结束时统一结算）
        const offX = nx - ox, offY = ny - oy;
        // 连线折点是增量平移，需传本帧相对上一帧的位移增量，否则会累计叠加导致连线飞走
        const dOffX = offX - prevOffX, dOffY = offY - prevOffY;
        prevOffX = offX; prevOffY = offY;
        self._moveShapeOnly(nx, ny);
        for (let i = 0; i < otherOrigins.length; i++) {
          const o = otherOrigins[i];
          o.node._moveShapeOnly(o.ox + offX, o.oy + offY);
        }
        for (let q = 0; q < self._batchLinks.length; q++) {
          self._batchLinks[q]._translate(dOffX, dOffY);
        }
        // 一次收集所有段，统一刷新（避免每条连线重复构建段数组）
        const allSegs = d._collectAllSegments();
        for (let q2 = 0; q2 < self._batchLinks.length; q2++) {
          self._batchLinks[q2]._refreshSegPaths(allSegs);
        }
      } else {
        self._moveTo(nx, ny);
      }
      d._autoExpandCanvas(self.x + self.width, self.y + self.height);
      d._refreshAllBridges();
    };
    const up = () => {
      d._clearAlignGuides();
      // 只有真正拖动过才重路由关联连线：纯点击（如点一下网关节点）不重算，
      // 否则 resetPath() 会用自动布线覆盖掉连线的手工折点（作者 wyp）
      if (moved && self._batchLinks && self._batchLinks.length) {
        // 批量拖拽结束：统一重路由所有相关连线
        d._bulkLock = true;
        for (let q = 0; q < self._batchLinks.length; q++) {
          self._batchLinks[q].resetPath();
        }
        d._bulkLock = false;
        d._refreshAllBridges();
      }
      self._batchLinks = null;
      moved = false;
      d._scheduleMinimap();
    };

    this._shapeEl.drag(move, start, up);
    this._textEl.drag(move, start, up);
  }

  // 只移动节点图形（不重路由连线），批量拖拽时每帧调用
  _moveShapeOnly(nx, ny) {
    this.x = nx; this.y = ny;
    if (this.shape === 'circle') {
      this._shapeEl.attr({ cx: nx + this.width / 2, cy: ny + this.height / 2 });
      this._selBorder.attr({ cx: nx + this.width / 2, cy: ny + this.height / 2 });
    } else if (this.shape === 'diamond') {
      const dmx = nx + this.width / 2, dTop = ny;
      const pathStr = 'M' + dmx + ',' + dTop +
        'L' + (nx + this.width) + ',' + (ny + this.height / 2) +
        'L' + dmx + ',' + (ny + this.height) +
        'L' + nx + ',' + (ny + this.height / 2) + 'Z';
      this._shapeEl.attr({ path: pathStr });
      const selPath = 'M' + dmx + ',' + (dTop - 3) +
        'L' + (nx + this.width + 3) + ',' + (ny + this.height / 2) +
        'L' + dmx + ',' + (ny + this.height + 3) +
        'L' + (nx - 3) + ',' + (ny + this.height / 2) + 'Z';
      this._selBorder.attr({ path: selPath });
    } else {
      this._shapeEl.attr({ x: nx, y: ny });
      this._selBorder.attr({ x: nx - 3, y: ny - 3 });
    }
    this._textEl.attr({ x: nx + this.width / 2, y: ny + this.height / 2 });

    for (const pos in this.anchors) {
      this.anchors[pos]._updatePosition();
    }
  }

  _moveTo(nx, ny) {
    this._moveShapeOnly(nx, ny);
    const relLinks = this.designer._getLinksByNodeId(this.id);
    for (let i = 0; i < relLinks.length; i++) {
      relLinks[i].resetPath();
    }
  }

  _select() {
    this._selected = true;
    this._selBorder.show();
  }

  _deselect() {
    this._selected = false;
    this._selBorder.hide();
  }

  delete() {
    this._shapeEl.remove();
    this._textEl.remove();
    this._selBorder.remove();
    for (const pos in this.anchors) {
      this.anchors[pos]._remove();
    }
    this.designer._removeNode(this);
  }

  setName(name) {
    this.name = name;
    this._textEl.attr({ text: name });
    this.designer._scheduleMinimap();
  }

  setStyle(style) {
    this.customStyle = Object.assign(this.customStyle || {}, style);
    if (style.fill) this._shapeEl.attr({ fill: style.fill });
    if (style.stroke) this._shapeEl.attr({ stroke: style.stroke });
    if (style.textStyle) this._textEl.attr(style.textStyle);
    this.designer._scheduleMinimap();
  }

  setReadonly(val) { this._readonly = !!val; }
  setContextMenu(items) { this._contextMenuItems = items; }
  _applyReadonly(val) { this._readonly = val; }
}
