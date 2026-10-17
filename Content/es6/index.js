/**
 * AiFlow - ES6 入口
 * 导出 AiFlow 对象，提供 init/create 方法。
 * 无任何 jQuery 依赖。
 */
import { Designer } from './Designer.js';

export const AiFlow = {
  /**
   * 初始化设计器
   * @param {HTMLElement} el 容器元素
   * @param {Object} [options] 配置（结构与旧版一致）
   * @returns {Designer|null}
   */
  init(el, options) {
    if (!el) return null;
    const designer = new Designer(el, options || {});
    el.__aiflow__ = designer;
    return designer;
  },

  /**
   * 便捷方法：自动创建容器并初始化
   * @param {Object} [options]
   * @returns {Designer}
   */
  create(options) {
    const div = document.createElement('div');
    document.body.appendChild(div);
    return AiFlow.init(div, options || {});
  }
};

export default AiFlow;
