/**
 * AiFlow - 原生 DOM 辅助（替代 jQuery DOM 操作）
 */

/** 创建元素：createEl('div', 'aiflow-header', { flex: '1' }) */
export function createEl(tag, className, style) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (style) setStyle(el, style);
  return el;
}

/** 批量设置 style（替代 $(el).css({...})） */
export function setStyle(el, props) {
  if (!props) return;
  for (const k in props) {
    if (Object.prototype.hasOwnProperty.call(props, k)) {
      el.style[k] = props[k];
    }
  }
}

/** 读取单个 style 值（替代 $(el).css('left')） */
export function getStyle(el, prop) {
  return el.style[prop];
}

/** 元素视口坐标（替代 $(el).offset()，含滚动补偿） */
export function offset(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 设置 textContent（替代 $(el).text(str)） */
export function text(el, str) {
  el.textContent = str;
}

/** 读取 input value（替代 $(el).val()） */
export function val(el) {
  return el.value;
}

/** 绑定事件（替代 $(el).on(type, fn)） */
export function on(el, type, handler) {
  el.addEventListener(type, handler);
}

/** 解绑事件（替代 $(el).off(type, fn)） */
export function off(el, type, handler) {
  el.removeEventListener(type, handler);
}

/**
 * 从 HTML 字符串创建单个元素
 * 用于工具栏标题等含文本内容的元素
 */
export function elFromHtml(html, className) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const el = div.firstElementChild;
  if (className) el.className = className;
  return el;
}
