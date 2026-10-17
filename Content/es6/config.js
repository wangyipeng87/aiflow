/**
 * AiFlow - 流程设计器默认配置（ES6 模块版）
 * 原 Content/js/config.js 迁移，语义完全一致
 */
import { deepMerge } from './utils.js';

export const defaults = {
  title: '流程设计器',

  header: {
    visible: true
  },

  // 左侧工具栏（节点面板）
  toolbar: {
    visible: true
  },

  canvas: {
    width: 4000,
    height: 3000,
    minWidth: 800,
    minHeight: 600,
    background: '#fff',
    gridSize: 10
  },

  zoom: {
    min: 0.25,
    max: 2,
    step: 0.05,
    default: 1
  },

  minimap: {
    width: 200,
    height: 150,
    viewportBorderColor: '#1890ff',
    viewportBgColor: 'rgba(24,144,255,0.08)',
    borderColor: '#ccc'
  },

  stubLength: 20,
  bridgeRadius: 6,

  nodeTypes: {
    start: {
      shape: 'circle',
      width: 60,
      height: 60,
      radius: 30,
      fill: '#73d13d',
      stroke: '#52c41a',
      strokeWidth: 2,
      fillOpacity: 1,
      textStyle: { 'font-size': '12px', fill: '#fff', 'font-weight': 'bold' },
      label: '开始'
    },
    end: {
      shape: 'circle',
      width: 60,
      height: 60,
      radius: 30,
      fill: '#ff85c0',
      stroke: '#eb2f96',
      strokeWidth: 2,
      fillOpacity: 1,
      textStyle: { 'font-size': '12px', fill: '#fff', 'font-weight': 'bold' },
      label: '结束'
    },
    userTask: {
      shape: 'rect',
      width: 120,
      height: 50,
      cornerRadius: 8,
      fill: '#e6f7ff',
      stroke: '#1890ff',
      strokeWidth: 1.5,
      fillOpacity: 1,
      textStyle: { 'font-size': '13px', fill: '#333' },
      label: '用户任务'
    },
    systemTask: {
      shape: 'rect',
      width: 120,
      height: 50,
      cornerRadius: 8,
      fill: '#f6ffed',
      stroke: '#52c41a',
      strokeWidth: 1.5,
      fillOpacity: 1,
      textStyle: { 'font-size': '13px', fill: '#333' },
      label: '系统任务'
    },
    gateway: {
      shape: 'diamond',
      width: 60,
      height: 60,
      fill: '#fff7e6',
      stroke: '#fa8c16',
      strokeWidth: 1.5,
      fillOpacity: 1,
      textStyle: { 'font-size': '12px', fill: '#333' },
      label: '判断'
    }
  },

  anchor: {
    radius: 5,
    fill: '#fff',
    stroke: '#ff4d4f',
    strokeWidth: 1.5,
    hoverFill: '#ff4d4f',
    hoverStroke: '#ff4d4f',
    cursor: 'crosshair'
  },

  link: {
    stroke: '#1890ff',
    strokeWidth: 2,
    selectedStroke: '#f5222d',
    selectedStrokeWidth: 2.5,
    hitAreaWidth: 12,
    arrowEnd: 'classic-wide-long',
    textStyle: { 'font-size': '12px', fill: '#666' },
    remarkStyle: {
      'font-size': '12px', fill: '#333',
      rectFill: '#fff7e6', rectStroke: '#ffd591', rectRadius: 3,
      rectPadding: 4,
      selectedFill: '#fff1f0', selectedStroke: '#ff4d4f', selectedTextFill: '#f5222d'
    },
    endpointRadius: 5,
    endpointFill: '#f5222d',
    endpointStroke: '#f5222d'
  },

  contextMenu: {
    // 默认节点右键菜单（开始/结束/普通节点均生效）
    nodeItems: [
      { name: '重命名', action: 'rename', callback: function (node) {
        if (node.designer.readonly) return;
        var txt = prompt('修改节点名称:', node.name);
        if (txt !== null) node.setName(txt);
      } },
      { name: '查看详情', action: 'detail', callback: function (node) {
        alert('节点ID: ' + node.id + '\n名称: ' + node.name + '\n类型: ' + node.type);
      } },
      { name: '删除', action: 'delete' }
    ],
    // 默认连线（规则连线）右键菜单
    linkItems: [
      { name: '设置规则', action: 'setRule', callback: function (link) {
        if (link.designer.readonly) return;
        var txt = prompt('请输入规则名称:', link.remark || '');
        if (txt !== null) link.setRemark(txt);
      } },
      { name: '查看信息', action: 'info', callback: function (link) {
        alert('连线ID: ' + link.id + '\n起始节点: ' + link.startNodeId.substr(0, 8) + '\n终止节点: ' + link.endNodeId.substr(0, 8) + '\n规则: ' + (link.remark || '(空)'));
      } },
      { name: '删除', action: 'delete' }
    ]
  },

  events: {
    onNodeCreated: null,
    onNodeDeleted: null,
    onLinkCreated: null,
    onLinkDeleted: null,
    onContextMenuClick: null
  },

  readonly: false
};

export function merge(userOptions) {
  return deepMerge(defaults, userOptions || {});
}

export default { defaults, merge };
