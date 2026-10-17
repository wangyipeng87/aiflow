/**
 * AiFlow - 右键菜单（自研 DOM 实现，替代 jQuery 版）
 * 函数接收 designer 实例，访问 designer.ctxMenu（DOM 元素）
 */

export function showContextMenu(designer, x, y, items, target) {
  const menu = designer.ctxMenu;
  menu.innerHTML = '';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemEl = document.createElement('div');
    itemEl.className = 'aiflow-ctx-item';
    itemEl.textContent = item.name;
    itemEl.addEventListener('click', () => {
      hideContextMenu(designer);
      if (item.action === 'delete') {
        if (target && target.delete) {
          designer._pushUndo();
          target.delete();
          if (designer.selectedNode === target) designer.selectedNode = null;
          if (designer.selectedLink === target) designer.selectedLink = null;
        }
      }
      designer._fireEvent('onContextMenuClick', {
        targetType: target ? target.type || 'link' : '',
        targetId: target ? target.id : '',
        menuName: item.name
      });
      if (item.callback) item.callback(target);
    });
    menu.appendChild(itemEl);
  }
}

export function hideContextMenu(designer) {
  if (!designer.ctxMenu) return;
  designer.ctxMenu.style.display = 'none';
  designer.ctxMenu.innerHTML = '';
}
