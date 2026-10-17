/**
 * AiFlow - 设计器主类（ES6 class）
 * 原 aiflow.js Designer 迁移，jQuery/jQuery UI 全部替换为原生实现
 *
 * 本地改动（作者 wyp）：exportJSON/importJSON 增加连线折点（points）的导出与还原，
 * 使拖动连线线段后的走向能随图 JSON 一起保存；并新增 clearHistory() 用于加载后清空撤销栈；
 * _fireEvent() 在批量重建（importJSON 清空/重建画布）期间不派发节点/连线删除事件；
 * setNodeContextMenu() 记录显式配置标记，供只读模式 FlowNode 判断是否响应节点右键菜单；
 * 与原版（文档/aiflow/Content/es6/Designer.js）的差异为 exportJSON/importJSON/clearHistory/_fireEvent/setNodeContextMenu 五处
 */
import config from './config.js';
import { guid } from './utils.js';
import { createEl, setStyle, offset } from './dom.js';
import { EventManager } from './event.js';
import { makePaletteDraggable } from './drag.js';
import { buildMinimap, refreshMinimap, scheduleMinimap } from './minimap.js';
import { showContextMenu, hideContextMenu } from './context-menu.js';
import { FlowNode } from './FlowNode.js';
import { FlowLink } from './FlowLink.js';

export class Designer {
  constructor(el, userOptions) {
    this.el = el;
    this.cfg = config.merge(userOptions);
    this.nodes = [];
    this.links = [];
    this.scale = this.cfg.zoom.default;
    this.readonly = this.cfg.readonly;
    this.selectedNode = null;
    this.selectedLink = null;
    this.selectedNodes = [];
    this.clipboardNode = null;
    this.paper = null;
    this._undoStack = [];
    this._redoStack = [];
    this._undoLocked = false;
    this._bulkLock = false; // 批量操作锁（importJSON 清空/重建期间跳过桥刷新与最小图）
    this._events = new EventManager();
    this._init();
  }

  _init() {
    const self = this;
    this.el.innerHTML = '';
    this.el.classList.add('aiflow-root');

    // Header
    this.header = createEl('div', 'aiflow-header');
    this.titleEl = createEl('div', 'aiflow-title');
    this.titleEl.textContent = this.cfg.title;
    this.btnUndo = createEl('button', 'aiflow-btn');
    this.btnUndo.title = '撤销 (Ctrl+Z)';
    this.btnUndo.textContent = '\u21A9 撤销';
    this.btnRedo = createEl('button', 'aiflow-btn');
    this.btnRedo.title = '重做 (Ctrl+Y)';
    this.btnRedo.textContent = '\u21AA 重做';
    this.btnImport = createEl('button', 'aiflow-btn');
    this.btnImport.textContent = '\u2B73 导入';
    this.btnExport = createEl('button', 'aiflow-btn');
    this.btnExport.textContent = '\u2B71 导出';
    this.btnExportImg = createEl('button', 'aiflow-btn');
    this.btnExportImg.textContent = '\uD83D\uDDBC 导出图片';

    const spacer1 = createEl('div', null, { flex: '1' });
    const btnGroup = createEl('div', null, { flex: '1', display: 'flex', justifyContent: 'flex-end', gap: '8px' });
    btnGroup.appendChild(this.btnUndo);
    btnGroup.appendChild(this.btnRedo);
    btnGroup.appendChild(this.btnImport);
    btnGroup.appendChild(this.btnExport);
    btnGroup.appendChild(this.btnExportImg);
    this.header.appendChild(spacer1);
    this.header.appendChild(this.titleEl);
    this.header.appendChild(btnGroup);
    this.el.appendChild(this.header);

    // Main area
    this.main = createEl('div', 'aiflow-main');
    this.el.appendChild(this.main);

    // Toolbar
    this._buildToolbar();

    // Canvas wrap (scroll container)
    this.canvasWrap = createEl('div', 'aiflow-canvas-wrap');
    this.paperHost = createEl('div', 'aiflow-paper-host');
    this.canvasWrap.appendChild(this.paperHost);
    this.main.appendChild(this.canvasWrap);

    // Zoom
    this._buildZoomSlider();

    // Create Raphael
    const cw = this.cfg.canvas.width, ch = this.cfg.canvas.height;
    setStyle(this.paperHost, { width: cw + 'px', height: ch + 'px', position: 'relative' });
    this.paper = Raphael(this.paperHost, cw, ch);

    // Alignment guide lines (persistent, hidden)
    this._vGuide = this.paper.path('M0,0L0,0').attr({
      stroke: '#ff4d4f', 'stroke-width': 1, 'stroke-dasharray': '- ', opacity: 0.6
    }).hide();
    this._hGuide = this.paper.path('M0,0L0,0').attr({
      stroke: '#ff4d4f', 'stroke-width': 1, 'stroke-dasharray': '- ', opacity: 0.6
    }).hide();

    // Droppable (palette -> canvas)
    this._setupPaletteDrop();

    // Context menu
    this.ctxMenu = createEl('div', 'aiflow-ctx-menu');
    this.ctxMenu.style.display = 'none';
    document.body.appendChild(this.ctxMenu);

    // Click canvas to deselect（跳过节点/连线/锚点等交互元素，避免批量拖拽时清空选中）
    this.paperHost.addEventListener('mousedown', (e) => {
      if (e.target.closest('circle, rect, path, text, .aiflow-ctx-menu, .aiflow-select-rect')) return;
      self._deselectAll();
      hideContextMenu(self);
    });

    // Keyboard
    this._setupKeyboard();

    // Rubber band selection
    this._setupRubberBand();

    // Undo / Redo buttons
    this.btnUndo.addEventListener('click', () => { self.undo(); });
    this.btnRedo.addEventListener('click', () => { self.redo(); });

    // Import / Export buttons
    this.btnExport.addEventListener('click', () => {
      const json = self.exportJSON();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'flow.json'; a.click();
      URL.revokeObjectURL(url);
    });

    this.btnImport.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target.result);
            self.importJSON(json);
          } catch (err) { alert('JSON格式错误: ' + err.message); }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    this.btnExportImg.addEventListener('click', () => {
      self.exportPNG();
    });

    // Hide context menu on outside click
    this._events.on(document, 'mousedown', (e) => {
      if (!e.target.closest('.aiflow-ctx-menu')) {
        hideContextMenu(self);
      }
    }, 'doc-mousedown');

    // Minimap
    buildMinimap(this);

    // 初始 Header 可见性（默认 true；visible: false 时隐藏标题+按钮行）
    if (this.cfg.header && this.cfg.header.visible === false) {
      this.hideHeader();
    }

    // 初始工具栏可见性（默认 true；visible: false 时隐藏左侧节点面板）
    if (this.cfg.toolbar && this.cfg.toolbar.visible === false) {
      this.hideToolbar();
    }
  }

  // ── Toolbar ──

  _buildToolbar() {
    const self = this;
    this.toolbar = createEl('div', 'aiflow-toolbar');
    const title = createEl('div', 'aiflow-toolbar-title');
    title.textContent = '工具栏';
    this.toolbar.appendChild(title);
    const types = ['start', 'end', 'userTask', 'systemTask', 'gateway'];
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      const cfg = this.cfg.nodeTypes[t];
      const item = createEl('div', 'aiflow-palette-item');
      item.setAttribute('data-node-type', t);
      const preview = this._createPalettePreview(t, cfg);
      item.appendChild(preview);
      const label = createEl('div');
      setStyle(label, { marginTop: '4px' });
      label.textContent = cfg.label;
      item.appendChild(label);
      this.toolbar.appendChild(item);
    }
    this.main.appendChild(this.toolbar);

    // 替代 jQuery UI draggable + droppable
    const items = this.toolbar.querySelectorAll('.aiflow-palette-item');
    for (let i = 0; i < items.length; i++) {
      makePaletteDraggable(items[i], {
        getDropPosition: (clientX, clientY) => {
          const rect = self.paperHost.getBoundingClientRect();
          const px = clientX - rect.left, py = clientY - rect.top;
          if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;
          return { x: px / self.scale, y: py / self.scale };
        },
        onDrop: (type, x, y) => {
          self._pushUndo();
          self.addNode(type, x, y);
        }
      });
    }
  }

  _createPalettePreview(type, cfg) {
    if (cfg.shape === 'circle') {
      const s = 34;
      return createEl('div', null, {
        width: s + 'px', height: s + 'px', margin: '0 auto',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 38%, ' + cfg.fill + ' 60%, ' + cfg.stroke + ' 100%)',
        border: '2px solid ' + cfg.stroke,
        boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)'
      });
    }
    if (cfg.shape === 'diamond') {
      const ds = 26;
      return createEl('div', null, {
        width: ds + 'px', height: ds + 'px', margin: '4px auto',
        background: cfg.fill,
        border: '1.5px solid ' + cfg.stroke,
        transform: 'rotate(45deg)',
        borderRadius: '3px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      });
    }
    const rw = 58, rh = 24;
    return createEl('div', null, {
      width: rw + 'px', height: rh + 'px', margin: '0 auto',
      background: cfg.fill,
      border: '1.5px solid ' + cfg.stroke,
      borderRadius: (cfg.cornerRadius || 4) + 'px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    });
  }

  // ── Palette drop ──

  _setupPaletteDrop() {
    // 逻辑已在 _buildToolbar 的 makePaletteDraggable 中通过回调注入
  }

  // ── Zoom slider with arrows ──

  _buildZoomSlider() {
    const self = this;
    this.zoomWrap = createEl('div', 'aiflow-zoom-wrap');
    this.zoomFitBtn = createEl('button', 'aiflow-zoom-fit-btn');
    this.zoomFitBtn.textContent = '适应';
    this.zoomUpBtn = createEl('button', 'aiflow-zoom-arrow-btn');
    this.zoomUpBtn.title = '放大';
    this.zoomUpBtn.textContent = '\u25B2';
    this.zoomLabel = createEl('div', 'aiflow-zoom-label');
    this.zoomLabel.textContent = '放大';
    this.zoomSlider = document.createElement('input');
    this.zoomSlider.type = 'range';
    this.zoomSlider.className = 'aiflow-zoom';
    this.zoomSlider.min = String(this.cfg.zoom.min * 100);
    this.zoomSlider.max = String(this.cfg.zoom.max * 100);
    this.zoomSlider.value = String(this.cfg.zoom.default * 100);
    this.zoomSlider.step = String(this.cfg.zoom.step * 100);
    this.zoomLabelMin = createEl('div', 'aiflow-zoom-label');
    this.zoomLabelMin.textContent = '缩小';
    this.zoomDownBtn = createEl('button', 'aiflow-zoom-arrow-btn');
    this.zoomDownBtn.title = '缩小';
    this.zoomDownBtn.textContent = '\u25BC';
    this.zoomWrap.appendChild(this.zoomFitBtn);
    this.zoomWrap.appendChild(this.zoomUpBtn);
    this.zoomWrap.appendChild(this.zoomLabel);
    this.zoomWrap.appendChild(this.zoomSlider);
    this.zoomWrap.appendChild(this.zoomLabelMin);
    this.zoomWrap.appendChild(this.zoomDownBtn);
    this.main.appendChild(this.zoomWrap);

    this.zoomSlider.addEventListener('input', () => {
      const v = parseFloat(self.zoomSlider.value) / 100;
      self._setZoom(v);
    });
    this.zoomSlider.addEventListener('change', () => {
      const v = parseFloat(self.zoomSlider.value) / 100;
      self._setZoom(v);
    });

    this.zoomFitBtn.addEventListener('click', () => {
      self._setZoom(1);
      self.zoomSlider.value = '100';
    });

    this.zoomUpBtn.addEventListener('click', () => {
      const step = self.cfg.zoom.step * 100;
      const cur = parseFloat(self.zoomSlider.value);
      const nv = Math.min(cur + step, self.cfg.zoom.max * 100);
      self.zoomSlider.value = String(nv);
      self._setZoom(nv / 100);
    });

    this.zoomDownBtn.addEventListener('click', () => {
      const step = self.cfg.zoom.step * 100;
      const cur = parseFloat(self.zoomSlider.value);
      const nv = Math.max(cur - step, self.cfg.zoom.min * 100);
      self.zoomSlider.value = String(nv);
      self._setZoom(nv / 100);
    });
  }

  _setZoom(scale) {
    this.scale = scale;
    setStyle(this.paperHost, {
      transform: 'scale(' + scale + ')',
      transformOrigin: '0 0'
    });
    refreshMinimap(this);
  }

  // ── Auto-expand canvas ──

  _autoExpandCanvas(nodeRight, nodeBottom) {
    const margin = 100;
    let changed = false;
    let cw = this.cfg.canvas.width;
    let ch = this.cfg.canvas.height;

    if (nodeRight + margin > cw) {
      cw = nodeRight + margin + 200;
      changed = true;
    }
    if (nodeBottom + margin > ch) {
      ch = nodeBottom + margin + 200;
      changed = true;
    }

    if (changed) {
      this.cfg.canvas.width = cw;
      this.cfg.canvas.height = ch;
      this.paper.setSize(cw, ch);
      setStyle(this.paperHost, { width: cw + 'px', height: ch + 'px' });
      scheduleMinimap(this);
    }
  }

  // ── Minimap (Canvas-based) ──

  _refreshMinimap() { refreshMinimap(this); }

  _scheduleMinimap() { scheduleMinimap(this); }

  // ── Undo / Redo ──

  _pushUndo() {
    if (this._undoLocked) return;
    this._undoStack.push(this.exportJSON());
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack = [];
  }

  undo() {
    if (this._undoStack.length === 0) return;
    this._redoStack.push(this.exportJSON());
    const state = this._undoStack.pop();
    this._undoLocked = true;
    this.importJSON(state);
    this._undoLocked = false;
  }

  redo() {
    if (this._redoStack.length === 0) return;
    this._undoStack.push(this.exportJSON());
    const state = this._redoStack.pop();
    this._undoLocked = true;
    this.importJSON(state);
    this._undoLocked = false;
  }

  /**
   * 清空撤销/重做历史（作者 wyp）
   * 本副本相对插件原版的本地扩展：importJSON 会先把"导入前"的状态压入撤销栈，
   * 页面加载时还原已保存的流程图后按 Ctrl+Z 会直接退回空白画布；还原完成后调用本方法即可避免
   * （只清历史，不影响当前画布内容）
   */
  clearHistory() {
    this._undoStack = [];
    this._redoStack = [];
    this._undoLocked = false;
  }

  // ── Keyboard ──

  _setupKeyboard() {
    const self = this;
    this._events.on(document, 'keydown', (e) => {
      if (self.readonly) return;
      // Ctrl+Z undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        self.undo(); e.preventDefault(); return;
      }
      // Ctrl+Y / Ctrl+Shift+Z redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        self.redo(); e.preventDefault(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        self.redo(); e.preventDefault(); return;
      }
      // Delete
      if (e.key === 'Delete') {
        if (self.selectedNodes.length > 0) {
          self._pushUndo();
          const toDelete = self.selectedNodes.slice();
          self.selectedNodes = [];
          self.selectedNode = null;
          for (let i = 0; i < toDelete.length; i++) toDelete[i].delete();
        } else if (self.selectedNode) {
          self._pushUndo();
          self.selectedNode.delete(); self.selectedNode = null;
        } else if (self.selectedLink) {
          self._pushUndo();
          self.selectedLink.delete(); self.selectedLink = null;
        }
        e.preventDefault();
      }
      // Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (self.selectedNode) {
          self.clipboardNode = self.selectedNode;
        }
      }
      // Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (self.clipboardNode) {
          self._pasteNode(self.clipboardNode);
        }
      }
    }, 'keydown');
  }

  _pasteNode(srcNode) {
    this._pushUndo();
    const newX = srcNode.x + 50;
    const newY = srcNode.y + 50;
    if (srcNode.type === 'start' || srcNode.type === 'end') {
      const exists = this._findNodeByType(srcNode.type);
      if (exists) return;
    }
    const newNode = this.addNode(srcNode.type, newX, newY, { name: srcNode.name });
    if (newNode) {
      this.clipboardNode = newNode;
    }
  }

  // ── Rubber Band Selection ──

  _setupRubberBand() {
    const self = this;
    let rectEl = null, startX, startY, dragging = false;

    this.canvasWrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || self.readonly) return;
      const target = e.target;
      if (target.closest('circle, rect, path, text, .aiflow-ctx-menu, .aiflow-select-rect')) return;
      // only start if target is the canvas background / SVG root
      if (!target.classList.contains('aiflow-paper-host') && target.tagName.toLowerCase() !== 'svg' &&
          !target.closest('.aiflow-paper-host svg')) return;
      dragging = true;
      const off = offset(self.paperHost);
      startX = (e.pageX - off.left) / self.scale;
      startY = (e.pageY - off.top) / self.scale;
      rectEl = createEl('div', 'aiflow-select-rect', { left: startX + 'px', top: startY + 'px', width: 0, height: 0 });
      self.canvasWrap.appendChild(rectEl);
      e.preventDefault();
    });

    this._events.on(document, 'mousemove', (e) => {
      if (!dragging || !rectEl) return;
      const off = offset(self.paperHost);
      const curX = (e.pageX - off.left) / self.scale;
      const curY = (e.pageY - off.top) / self.scale;
      const x = Math.min(startX, curX), y = Math.min(startY, curY);
      const w = Math.abs(curX - startX), h = Math.abs(curY - startY);
      setStyle(rectEl, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    }, 'rubberband-move');

    this._events.on(document, 'mouseup', () => {
      if (!dragging) return;
      dragging = false;
      if (!rectEl) return;
      const rx = parseFloat(rectEl.style.left);
      const ry = parseFloat(rectEl.style.top);
      const rw = parseFloat(rectEl.style.width);
      const rh = parseFloat(rectEl.style.height);
      rectEl.remove();
      rectEl = null;
      if (rw < 5 && rh < 5) return;

      const selRect = { x: rx, y: ry, w: rw, h: rh };
      self._deselectAll();
      for (let i = 0; i < self.nodes.length; i++) {
        const n = self.nodes[i];
        const ncx = n.x + n.width / 2, ncy = n.y + n.height / 2;
        if (ncx >= selRect.x && ncx <= selRect.x + selRect.w &&
            ncy >= selRect.y && ncy <= selRect.y + selRect.h) {
          n._select();
          self.selectedNodes.push(n);
        }
      }
      if (self.selectedNodes.length === 1) {
        self.selectedNode = self.selectedNodes[0];
      }
    }, 'rubberband-up');
  }

  // ── Context Menu ──

  _showContextMenu(x, y, items, target) {
    showContextMenu(this, x, y, items, target);
  }

  _hideContextMenu() {
    hideContextMenu(this);
  }

  // ── Select / Deselect ──

  _deselectAll() {
    if (this.selectedNode) { this.selectedNode._deselect(); this.selectedNode = null; }
    if (this.selectedLink) { this.selectedLink._deselect(); this.selectedLink = null; }
    for (let i = 0; i < this.selectedNodes.length; i++) this.selectedNodes[i]._deselect();
    this.selectedNodes = [];
  }

  _selectNode(node, additive) {
    if (additive) {
      if (this.selectedLink) { this.selectedLink._deselect(); this.selectedLink = null; }
      const idx = this.selectedNodes.indexOf(node);
      if (idx >= 0) {
        node._deselect();
        this.selectedNodes.splice(idx, 1);
      } else {
        node._select();
        this.selectedNodes.push(node);
      }
      this.selectedNode = this.selectedNodes.length === 1 ? this.selectedNodes[0] : null;
      return;
    }
    this._deselectAll();
    this.selectedNode = node;
    node._select();
  }

  _selectLink(link) {
    this._deselectAll();
    this.selectedLink = link;
    link._select();
  }

  // ── Alignment Guides ──

  _showAlignGuides(dragNode, newX, newY) {
    this._vGuide.hide();
    this._hGuide.hide();
    const threshold = 5;
    const dw = dragNode.width, dh = dragNode.height;
    // 使用传入的新坐标（当前帧目标位置），而非 dragNode.x/y（上一次吸附后的位置）
    const dNodeX = newX, dNodeY = newY;
    const dCx = dNodeX + dw / 2, dCy = dNodeY + dh / 2;
    let bestV = null, bestVDist = threshold + 1;
    let bestH = null, bestHDist = threshold + 1;

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n === dragNode || this.selectedNodes.indexOf(n) >= 0) continue;
      const nx = n.x, ny = n.y, nw = n.width, nh = n.height;
      const nCx = nx + nw / 2, nCy = ny + nh / 2;

      const vChecks = [
        { dist: Math.abs(dNodeX - nx), gx: nx, val: nx },
        { dist: Math.abs(dNodeX + dw - (nx + nw)), gx: nx + nw, val: nx + nw - dw },
        { dist: Math.abs(dCx - nCx), gx: nCx, val: nCx - dw / 2 }
      ];
      for (let v = 0; v < vChecks.length; v++) {
        if (vChecks[v].dist < bestVDist) { bestVDist = vChecks[v].dist; bestV = vChecks[v]; }
      }

      const hChecks = [
        { dist: Math.abs(dNodeY - ny), gy: ny, val: ny },
        { dist: Math.abs(dNodeY + dh - (ny + nh)), gy: ny + nh, val: ny + nh - dh },
        { dist: Math.abs(dCy - nCy), gy: nCy, val: nCy - dh / 2 }
      ];
      for (let h = 0; h < hChecks.length; h++) {
        if (hChecks[h].dist < bestHDist) { bestHDist = hChecks[h].dist; bestH = hChecks[h]; }
      }
    }

    let snapX = null, snapY = null;
    if (bestV && bestVDist <= threshold) {
      this._vGuide.attr({ path: 'M' + bestV.gx + ',0L' + bestV.gx + ',' + this.cfg.canvas.height }).show();
      snapX = bestV.val;
    }
    if (bestH && bestHDist <= threshold) {
      this._hGuide.attr({ path: 'M0,' + bestH.gy + 'L' + this.cfg.canvas.width + ',' + bestH.gy }).show();
      snapY = bestH.val;
    }
    return { snapX, snapY };
  }

  _clearAlignGuides() {
    this._vGuide.hide();
    this._hGuide.hide();
  }

  // ── Bridge line helpers ──

  _collectSegments(excludeLinkId) {
    const segs = [];
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      if (link.id === excludeLinkId) continue;
      const pts = link._points;
      for (let j = 0; j < pts.length - 1; j++) {
        segs.push({ p1: { x: pts[j].x, y: pts[j].y }, p2: { x: pts[j + 1].x, y: pts[j + 1].y } });
      }
    }
    return segs;
  }

  // 收集所有连线的所有段（含 linkId），供 _refreshAllBridges 一次收集复用，避免 O(n²) 重复构建
  _collectAllSegments() {
    const segs = [];
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      const pts = link._points;
      for (let j = 0; j < pts.length - 1; j++) {
        segs.push({ linkId: link.id, p1: { x: pts[j].x, y: pts[j].y }, p2: { x: pts[j + 1].x, y: pts[j + 1].y } });
      }
    }
    return segs;
  }

  _refreshAllBridges() {
    if (this._bulkLock) return; // 批量模式（importJSON）跳过，结束后统一刷新一次
    const allSegs = this._collectAllSegments();
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i];
      for (let j = 0; j < link._segments.length; j++) {
        const bp = link._bridgeSegPath(j, allSegs);
        const segEl = link._segments[j];
        if (!segEl) continue;
        // 路径未变化时跳过 attr（避免大量无意义的 SVG DOM 更新）
        const cache = link._segPathCache;
        if (!cache || cache[j] !== bp) {
          segEl.attr({ path: bp });
          if (!cache) link._segPathCache = cache = [];
          cache[j] = bp;
        }
      }
    }
  }

  // ── Node CRUD ──

  addNode(type, x, y, extra) {
    if (type === 'start' && this._findNodeByType('start')) return null;
    if (type === 'end' && this._findNodeByType('end')) return null;
    const cfg = this.cfg.nodeTypes[type];
    if (!cfg) return null;
    // 正确保留 extra.id（修复：原 $.extend(opts, extra, {id: opts.id}) 会把 extra.id 覆盖回新 guid）
    const opts = {
      id: (extra && extra.id) || guid(),
      type,
      name: (extra && extra.name) || cfg.label,
      x,
      y
    };
    if (extra) Object.assign(opts, extra, { id: opts.id });
    const node = new FlowNode(this, opts);
    this.nodes.push(node);
    this._fireEvent('onNodeCreated', { id: node.id, name: node.name, type: node.type });
    this._scheduleMinimap();
    return node;
  }

  _removeNode(node) {
    const relLinks = this._getLinksByNodeId(node.id);
    for (let i = 0; i < relLinks.length; i++) relLinks[i].delete();
    this.nodes = this.nodes.filter((n) => n.id !== node.id);
    this._fireEvent('onNodeDeleted', { id: node.id, name: node.name, type: node.type });
    this._scheduleMinimap();
  }

  _findNodeByType(type) {
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].type === type) return this.nodes[i];
    }
    return null;
  }

  getNodeById(id) {
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].id === id) return this.nodes[i];
    }
    return null;
  }

  // ── Link CRUD ──

  _addLink(startNodeId, startAnchorPos, endNodeId, endAnchorPos) {
    if (startNodeId === endNodeId && startAnchorPos === endAnchorPos) return null;
    for (let i = 0; i < this.links.length; i++) {
      const l = this.links[i];
      if (l.startNodeId === startNodeId && l.startAnchorPos === startAnchorPos &&
          l.endNodeId === endNodeId && l.endAnchorPos === endAnchorPos) return null;
    }
    const sNode = this.getNodeById(startNodeId);
    const eNode = this.getNodeById(endNodeId);
    if (!sNode || !eNode) return null;
    if (eNode.type === 'start') return null;
    if (sNode.type === 'end') return null;

    const link = new FlowLink(this, {
      id: guid(),
      startNodeId,
      startAnchorPos,
      endNodeId,
      endAnchorPos,
      remark: ''
    });
    // 自动赋值 remark：规则+n，n 从已有最大编号+1 递增
    let maxN = 0;
    for (let ri = 0; ri < this.links.length; ri++) {
      const rm = this.links[ri].remark;
      if (rm && rm.indexOf('规则') === 0) {
        const rn = parseInt(rm.substring(2), 10);
        if (!isNaN(rn) && rn > maxN) maxN = rn;
      }
    }
    link.remark = '规则' + (maxN + 1);
    link._drawRemark(); // remark 在构造函数中为空时未绘制，赋值后补绘
    this.links.push(link);
    this._fireEvent('onLinkCreated', { id: link.id, startNodeId, endNodeId });
    this._refreshAllBridges();
    this._scheduleMinimap();
    return link;
  }

  _removeLink(link) {
    this.links = this.links.filter((l) => l.id !== link.id);
    this._fireEvent('onLinkDeleted', { id: link.id, startNodeId: link.startNodeId, endNodeId: link.endNodeId });
    this._refreshAllBridges();
    this._scheduleMinimap();
  }

  getLinkById(id) {
    for (let i = 0; i < this.links.length; i++) {
      if (this.links[i].id === id) return this.links[i];
    }
    return null;
  }

  _getLinksByNodeId(nodeId) {
    return this.links.filter((l) => {
      return l.startNodeId === nodeId || l.endNodeId === nodeId;
    });
  }

  // ── Anchor hit-test ──

  _findAnchorAtScreenPoint(clientX, clientY) {
    // 用 getBoundingClientRect（视口坐标，已含 canvasWrap 滚动影响）
    const svgRect = this.paperHost.getBoundingClientRect();
    const svgX = (clientX - svgRect.left) / this.scale;
    const svgY = (clientY - svgRect.top) / this.scale;
    const hitR = this.cfg.anchor.radius + 8;
    const hitR2 = hitR * hitR;

    for (let ni = 0; ni < this.nodes.length; ni++) {
      const nn = this.nodes[ni];
      for (const pos in nn.anchors) {
        const apt = nn._getAnchorXY(pos);
        const dx = svgX - apt.x, dy = svgY - apt.y;
        if (dx * dx + dy * dy <= hitR2) {
          return { node: nn, position: pos, anchor: nn.anchors[pos] };
        }
      }
    }
    return null;
  }

  // ── Events ──

  _fireEvent(name, data) {
    // 批量重建（importJSON 清空/重建画布）期间不派发删除事件：
    // 这不是用户删除而是重建过程，派发出去会让业务侧误删按 id 暂存的节点/规则配置（作者 wyp）
    if (this._bulkLock && (name === 'onNodeDeleted' || name === 'onLinkDeleted')) return;
    if (this.cfg.events && typeof this.cfg.events[name] === 'function') {
      this.cfg.events[name](data);
    }
  }

  // ── Public API ──

  exportJSON() {
    const json = { nodes: [], links: [] };
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      json.nodes.push({ id: n.id, type: n.type, name: n.name, x: n.x, y: n.y, style: n.customStyle || null });
    }
    for (let j = 0; j < this.links.length; j++) {
      const lk = this.links[j];
      json.links.push({
        id: lk.id, startNodeId: lk.startNodeId, startAnchorPos: lk.startAnchorPos,
        endNodeId: lk.endNodeId, endAnchorPos: lk.endAnchorPos, remark: lk.remark,
        remarkX: lk.remarkX, remarkY: lk.remarkY, remarkAuto: lk.remarkAuto,
        style: lk.customStyle || null,
        // 连线折点（线段被手动拖动后的走向），浅拷贝避免外部改动污染内部模型（作者 wyp）
        points: lk._points ? lk._points.map((p) => ({ x: p.x, y: p.y })) : null
      });
    }
    return json;
  }

  importJSON(json) {
    this._pushUndo();
    this._bulkLock = true; // 批量模式：清空/重建期间跳过每次 delete/_addLink 的全量桥刷新与最小图
    while (this.links.length) this.links[0].delete();
    while (this.nodes.length) this.nodes[0].delete();
    if (json.nodes) {
      for (let i = 0; i < json.nodes.length; i++) {
        const nd = json.nodes[i];
        // addNode 内部 Object.assign(opts, extra, {id: opts.id}) 已保留 extra.id
        this.addNode(nd.type, nd.x, nd.y, { name: nd.name, id: nd.id, style: nd.style });
      }
    }
    if (json.links) {
      for (let j = 0; j < json.links.length; j++) {
        const ld = json.links[j];
        const link = this._addLink(ld.startNodeId, ld.startAnchorPos, ld.endNodeId, ld.endAnchorPos);
        if (link) {
          if (ld.id) link.id = ld.id;
          // 先恢复标签定位模式与坐标,再渲染备注(setRemark 内部按 remarkAuto/remarkX/Y 一次画到位)
          if (ld.remarkAuto != null) link.remarkAuto = !!ld.remarkAuto;
          if (ld.remarkX != null) link.remarkX = ld.remarkX;
          if (ld.remarkY != null) link.remarkY = ld.remarkY;
          // 脏数据兜底:固定定位但缺坐标时回退自动定位,避免渲染出 NaN
          if (link.remarkAuto === false && (link.remarkX == null || link.remarkY == null)) link.remarkAuto = true;
          if (ld.remark) {
            link.setRemark(ld.remark);
          } else if (ld.remarkAuto != null || ld.remarkX != null || ld.remarkY != null) {
            link._updateRemarkPosition(); // 无备注文本时同步已绘标签的显示位置
          }
          if (ld.style) link.setStyle(ld.style);
          // 还原连线折点（必须放在 setStyle 之后：setStyle 内部 resetPath 会重算折点）；
          // 折点缺失/非法/与当前锚点不匹配时 setPoints 返回 false，保持自动布线（兼容存量数据）（作者 wyp）
          if (ld.points) link.setPoints(ld.points);
        }
      }
    }
    this._bulkLock = false;
    this._refreshAllBridges(); // 统一刷新一次过桥弧线
    this._scheduleMinimap();
  }

  setReadonly(val) {
    this.readonly = !!val;
    for (let i = 0; i < this.nodes.length; i++) this.nodes[i]._applyReadonly(this.readonly);
    for (let j = 0; j < this.links.length; j++) this.links[j]._applyReadonly(this.readonly);
  }

  setEditable() { this.setReadonly(false); }

  destroy() {
    // 清理全局事件监听
    this._events.offAll();
    // 清理上下文菜单 DOM
    if (this.ctxMenu) { this.ctxMenu.remove(); this.ctxMenu = null; }
    // 清理小地图
    if (this.minimapWrap) { this.minimapWrap.remove(); this.minimapWrap = null; }
    // 清理画布
    if (this.paper) { this.paper.remove(); this.paper = null; }
    // 清空引用
    this.nodes = [];
    this.links = [];
    delete this.el.__aiflow__;
    this.el.innerHTML = '';
    this.el.classList.remove('aiflow-root');
  }

  setTitle(text) {
    this.cfg.title = text;
    this.titleEl.textContent = text;
  }

  /** 显示头部（标题 + 按钮行） */
  showHeader() {
    this.cfg.header.visible = true;
    this.header.style.display = '';
  }

  /** 隐藏头部（标题 + 按钮行），主区域自动撑满 */
  hideHeader() {
    this.cfg.header.visible = false;
    this.header.style.display = 'none';
  }

  /** 头部当前是否可见 */
  isHeaderVisible() {
    return this.header.style.display !== 'none';
  }

  /**
   * 显示左侧工具栏（节点面板）
   * @author wyp
   */
  showToolbar() {
    this.cfg.toolbar.visible = true;
    this.toolbar.style.display = '';
  }

  /**
   * 隐藏左侧工具栏（节点面板），画布区域自动撑满；隐藏期间工具栏拖拽创建节点暂不可用，画布内已有元素不受影响
   * @author wyp
   */
  hideToolbar() {
    this.cfg.toolbar.visible = false;
    this.toolbar.style.display = 'none';
  }

  /**
   * 工具栏当前是否可见
   * @returns {boolean} true 表示可见
   * @author wyp
   */
  isToolbarVisible() {
    return this.toolbar.style.display !== 'none';
  }

  setNodeContextMenu(items) {
    this.cfg.contextMenu.nodeItems = items;
    // 标记为显式配置：只读模式 FlowNode 据此允许节点右键菜单（作者 wyp）
    this._nodeMenuCustomized = true;
  }

  setLinkContextMenu(items) {
    this.cfg.contextMenu.linkItems = items;
  }

  exportPNG(callback) {
    const svgEl = this.paperHost.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = this.cfg.canvas.width;
    canvas.height = this.cfg.canvas.height;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      if (callback) callback(dataURL);
      else {
        const a = document.createElement('a');
        a.href = dataURL; a.download = 'flow.png'; a.click();
      }
    };
    img.onerror = () => {
      if (callback) callback(null);
      else console.error('AiFlow: 导出 PNG 失败，SVG 图片加载出错');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }
}
