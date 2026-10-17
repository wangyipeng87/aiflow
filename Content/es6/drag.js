/**
 * AiFlow - 拖拽/放置系统（替代 jQuery UI draggable + droppable）
 *
 * 仅用于"工具栏节点拖拽到画布创建节点"这一处交互。
 * 节点自身拖拽、连线端点重连、备注标签拖拽仍使用 Raphael 自带 .drag()。
 *
 * 语义对齐旧版：
 * - helper:'clone', appendTo:'body' → 克隆 DOM 元素挂到 body
 * - distance:3 → 移动超过 3px 才开始拖拽
 * - revert:'invalid' → 未落在画布时移除克隆
 * - drop 坐标换算：x = (pointerX - paperHostRect.left) / scale
 */

/**
 * 使工具栏项可拖拽到画布
 * @param {HTMLElement} itemEl .aiflow-palette-item 元素
 * @param {Object} callbacks
 * @param {(clientX:number, clientY:number) => {x:number,y:number}|null} callbacks.getDropPosition
 *        返回画布 SVG 坐标；返回 null 表示未落在画布上（revert）
 * @param {(type:string, x:number, y:number) => void} callbacks.onDrop 落点回调，创建节点
 */
export function makePaletteDraggable(itemEl, callbacks) {
  let dragging = false;
  let moved = false;
  let baseX = 0;
  let baseY = 0;
  let offX = 0;
  let offY = 0;
  let helper = null;

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    baseX = e.clientX;
    baseY = e.clientY;
    const r = itemEl.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    // distance:3 阈值
    if (!moved) {
      if (Math.abs(e.clientX - baseX) < 3 && Math.abs(e.clientY - baseY) < 3) return;
      moved = true;
      // helper:'clone', appendTo:'body'
      helper = itemEl.cloneNode(true);
      helper.style.position = 'fixed';
      helper.style.zIndex = '10000';
      helper.style.opacity = '0.8';
      helper.style.pointerEvents = 'none';
      document.body.appendChild(helper);
    }
    helper.style.left = (e.clientX - offX) + 'px';
    helper.style.top = (e.clientY - offY) + 'px';
    e.preventDefault();
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    if (!helper) return;
    const pos = callbacks.getDropPosition(e.clientX - offX, e.clientY - offY);
    if (pos) {
      const type = itemEl.getAttribute('data-node-type');
      callbacks.onDrop(type, pos.x, pos.y);
    }
    helper.remove();
    helper = null;
  };

  itemEl.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}
