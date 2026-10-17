/**
 * AiFlow - ES6 工具函数
 */

/** 生成 UUID v4 格式 id */
export function guid() {
  const s = [];
  const hex = '0123456789abcdef';
  for (let i = 0; i < 36; i++) s[i] = hex.charAt(Math.floor(Math.random() * 16));
  s[8] = s[13] = s[18] = s[23] = '-';
  s[14] = '4'; // 版本位
  s[19] = hex.charAt((parseInt(s[19], 16) & 0x3) | 0x8); // 变体位 (8/9/a/b)
  return s.join('');
}

/** 深克隆（JSON 序列化方式） */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 深合并（与旧版 config.js 语义一致）：
 * - 对象递归合并
 * - 源值为 null 表示删除该配置项
 */
export function deepMerge(target, source) {
  const result = {};
  let key;
  for (key in target) {
    if (Object.prototype.hasOwnProperty.call(target, key)) result[key] = target[key];
  }
  for (key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]) &&
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key]);
      } else if (source[key] === null) {
        // null 表示删除该配置项，不覆盖
        delete result[key];
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}
