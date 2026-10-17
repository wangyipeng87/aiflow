/**
 * AiFlow - 小地图（原生 canvas，替代 jQuery 实现）
 * 函数接收 designer 实例，访问其原生 DOM 字段
 */

export function buildMinimap(designer) {
  const mc = designer.cfg.minimap;
  designer.minimapWrap = document.createElement('div');
  designer.minimapWrap.className = 'aiflow-minimap-wrap';
  designer.minimapWrap.style.cssText =
    `width:${mc.width}px;height:${mc.height}px;overflow:hidden;position:absolute;` +
    `right:16px;bottom:16px;z-index:50;`;

  designer._minimapCanvas = document.createElement('canvas');
  designer._minimapCanvas.className = 'aiflow-minimap-content';
  designer._minimapCanvas.style.pointerEvents = 'none';

  designer.minimapViewport = document.createElement('div');
  designer.minimapViewport.className = 'aiflow-minimap-viewport';
  designer.minimapViewport.style.cssText =
    `position:absolute;border:2px dashed ${mc.viewportBorderColor};` +
    `background:${mc.viewportBgColor};cursor:move;z-index:2;`;

  designer.minimapWrap.appendChild(designer._minimapCanvas);
  designer.minimapWrap.appendChild(designer.minimapViewport);
  designer.el.appendChild(designer.minimapWrap);

  // Viewport drag
  let dragging = false;
  let dragOx = 0, dragOy = 0;

  designer.minimapViewport.addEventListener('mousedown', (e) => {
    dragging = true;
    dragOx = e.clientX; dragOy = e.clientY;
    e.preventDefault();
  });

  designer._events.on(document, 'mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragOx, dy = e.clientY - dragOy;
    dragOx = e.clientX; dragOy = e.clientY;
    const vp = designer.minimapViewport;
    let newL = parseFloat(vp.style.left || '0') + dx;
    let newT = parseFloat(vp.style.top || '0') + dy;
    const maxL = designer.minimapWrap.clientWidth - vp.offsetWidth;
    const maxT = designer.minimapWrap.clientHeight - vp.offsetHeight;
    newL = Math.max(0, Math.min(newL, maxL));
    newT = Math.max(0, Math.min(newT, maxT));
    vp.style.left = newL + 'px';
    vp.style.top = newT + 'px';
    const cwS = designer.cfg.canvas.width * designer.scale;
    const chS = designer.cfg.canvas.height * designer.scale;
    // 使用小地图 canvas 实际尺寸（等比缩放后可能小于 wrap 尺寸）
    const mmCanvas = designer._minimapCanvas;
    const mmW = mmCanvas ? mmCanvas.width : designer.minimapWrap.clientWidth;
    const mmH = mmCanvas ? mmCanvas.height : designer.minimapWrap.clientHeight;
    designer.canvasWrap.scrollLeft = (newL / mmW) * cwS;
    designer.canvasWrap.scrollTop = (newT / mmH) * chS;
  }, 'minimap-move');

  designer._events.on(document, 'mouseup', () => { dragging = false; }, 'minimap-up');

  designer.canvasWrap.addEventListener('scroll', () => {
    if (!dragging) refreshMinimapViewport(designer);
  });

  refreshMinimap(designer);
}

export function refreshMinimap(designer) {
  if (!designer._minimapCanvas) return;
  const mc = designer.cfg.minimap;
  const cw = designer.cfg.canvas.width;
  const ch = designer.cfg.canvas.height;
  const scaleX = mc.width / cw;
  const scaleY = mc.height / ch;
  const s = Math.min(scaleX, scaleY);

  const canvas = designer._minimapCanvas;
  canvas.width = Math.round(cw * s);
  canvas.height = Math.round(ch * s);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < designer.links.length; i++) {
    const pts = designer.links[i]._points;
    if (pts.length < 2) continue;
    ctx.strokeStyle = designer.cfg.link.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * s, pts[0].y * s);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x * s, pts[j].y * s);
    ctx.stroke();
  }

  for (let n = 0; n < designer.nodes.length; n++) {
    const node = designer.nodes[n];
    const tc = node._typeCfg;
    ctx.fillStyle = tc.fill;
    ctx.strokeStyle = tc.stroke;
    ctx.lineWidth = 1;
    if (node.shape === 'circle') {
      ctx.beginPath();
      ctx.arc((node.x + node.width / 2) * s, (node.y + node.height / 2) * s,
        (tc.radius || node.width / 2) * s, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (node.shape === 'diamond') {
      const dx = node.x * s, dy = node.y * s, dw = node.width * s, dh = node.height * s;
      ctx.beginPath();
      ctx.moveTo(dx + dw / 2, dy);
      ctx.lineTo(dx + dw, dy + dh / 2);
      ctx.lineTo(dx + dw / 2, dy + dh);
      ctx.lineTo(dx, dy + dh / 2);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(node.x * s, node.y * s, node.width * s, node.height * s);
      ctx.strokeRect(node.x * s, node.y * s, node.width * s, node.height * s);
    }
  }

  refreshMinimapViewport(designer);
}

export function refreshMinimapViewport(designer) {
  if (!designer.minimapWrap) return;
  const mc = designer.cfg.minimap;
  const cw = designer.cfg.canvas.width * designer.scale;
  const ch = designer.cfg.canvas.height * designer.scale;
  const ww = designer.canvasWrap.clientWidth;
  const wh = designer.canvasWrap.clientHeight;
  const sl = designer.canvasWrap.scrollLeft;
  const st = designer.canvasWrap.scrollTop;
  const mw = mc.width, mh = mc.height;

  const vpW = Math.min(mw, (ww / cw) * mw);
  const vpH = Math.min(mh, (wh / ch) * mh);
  const vpL = (sl / cw) * mw;
  const vpT = (st / ch) * mh;

  designer.minimapViewport.style.cssText =
    `position:absolute;border:2px dashed ${mc.viewportBorderColor};` +
    `background:${mc.viewportBgColor};cursor:move;z-index:2;` +
    `width:${vpW}px;height:${vpH}px;left:${vpL}px;top:${vpT}px;`;
}

export function scheduleMinimap(designer) {
  if (designer._bulkLock) return; // 批量模式下跳过，importJSON 结束后统一调度一次
  if (designer._mmTimer) clearTimeout(designer._mmTimer);
  designer._mmTimer = setTimeout(() => { refreshMinimap(designer); }, 200);
}
