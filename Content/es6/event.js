/**
 * AiFlow - 事件管理器（替代 $(document).on('ns.event') 命名空间事件）
 * 统一注册/注销，destroy 时一次清理全部 document 级监听
 */
export class EventManager {
  constructor() {
    this._registry = new Map(); // key -> { target, type, handler }
    this._seq = 0;
  }

  /**
   * 注册事件监听
   * @param {EventTarget} target 目标元素（通常为 document）
   * @param {string} type 事件类型（如 'mousemove'）
   * @param {Function} handler 回调
   * @param {string} [key] 可选 key，用于 off(key) 定向移除；缺省自动生成
   * @returns {string} key
   */
  on(target, type, handler, key) {
    const k = key || `${type}-${this._seq++}`;
    target.addEventListener(type, handler);
    this._registry.set(k, { target, type, handler });
    return k;
  }

  /** 按 key 移除事件监听 */
  off(key) {
    const rec = this._registry.get(key);
    if (!rec) return;
    rec.target.removeEventListener(rec.type, rec.handler);
    this._registry.delete(key);
  }

  /** 移除所有监听（destroy 时调用） */
  offAll() {
    this._registry.forEach((rec) => {
      rec.target.removeEventListener(rec.type, rec.handler);
    });
    this._registry.clear();
  }
}
