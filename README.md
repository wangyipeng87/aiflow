# AiFlow 流程设计器

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6-f7df1e.svg)](#技术栈)
[![No Build](https://img.shields.io/badge/build-none-52c41a.svg)](#快速开始)

AiFlow 是一个基于原生 ES6 和 Raphael 的轻量级流程设计器，支持节点拖拽编排、锚点连线、正交路由、缩放、小地图、撤销重做、JSON 导入导出和 PNG 导出。

项目以静态资源形式提供，**不需要 npm 安装，也不需要打包构建**，可以直接嵌入现有 Web 项目，适合审批流、业务编排、规则流程等场景。

## 功能特性

- **流程编排**：内置开始、结束、用户任务、系统任务、判断 5 种节点。
- **拖拽交互**：从左侧工具栏拖拽节点到画布，在节点锚点之间拖拽创建连线。
- **正交路由**：连线自动计算正交路径，并支持拖动线段调整走向、双击恢复默认路径。
- **智能辅助**：节点拖动时显示水平/垂直对齐参考线，支持框选多个节点。
- **画布能力**：支持画布缩放、适应视图、小地图、画布自动扩展。
- **编辑能力**：支持节点/连线样式、备注、只读模式、右键菜单和节点复制粘贴。
- **历史记录**：支持撤销/重做，最多保存 50 个历史状态。
- **数据导入导出**：支持 JSON 导入导出和 PNG 图片导出。
- **事件回调**：提供节点、连线和右键菜单相关事件。
- **无需构建**：原生 ES Module + 静态 HTML，克隆后即可运行。

## 技术栈

- JavaScript ES6 / ES Modules
- Raphael + SVG
- 原生 DOM API
- CSS3
- 无 jQuery、无前端框架、无构建工具

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/wangyipeng87/aiflow.git
cd aiflow
```

### 2. 启动静态服务

ES Modules 需要通过 HTTP/HTTPS 访问，不建议直接双击打开 HTML 文件。

```bash
python -m http.server 8080
```

也可以使用其他静态服务器：

```bash
npx serve .
```

启动后访问：

- 项目主页：<http://localhost:8080/home.html>
- 设计器主页面：<http://localhost:8080/index.html>
- 接口文档：<http://localhost:8080/interface.html>
- 示例页面：<http://localhost:8080/demo/init.html>

## 基础用法

### 引入资源

```html
<link rel="stylesheet" href="Content/css/aiflow.css" />

<div id="aiflow-page"></div>

<script src="Content/es6/raphael.min.js"></script>
<script src="Content/es6/aiflow-router.js"></script>

<script type="module">
  import { AiFlow } from './Content/es6/index.js';

  const designer = AiFlow.init(document.getElementById('aiflow-page'), {
    title: '审批流程',
    readonly: false,
    events: {
      onNodeCreated(data) {
        console.log('节点创建:', data);
      },
      onLinkCreated(data) {
        console.log('连线创建:', data);
      }
    }
  });
</script>
```

### 创建节点

```js
const start = designer.addNode('start', 200, 100);
const task = designer.addNode('userTask', 180, 240, {
  name: '部门审批'
});

task.setName('财务审核');
task.setStyle({
  fill: '#fff7e6',
  stroke: '#fa8c16',
  textStyle: {
    fill: '#ad4e00',
    'font-weight': 'bold'
  }
});
```

### 导入与导出

```js
const data = designer.exportJSON();

console.log(JSON.stringify(data, null, 2));

designer.importJSON({
  nodes: [
    {
      id: 'node-1',
      type: 'userTask',
      name: '审批',
      x: 200,
      y: 150,
      style: null
    }
  ],
  links: []
});

designer.exportPNG((dataURL) => {
  console.log(dataURL);
});
```

## 初始化配置

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | `'流程设计器'` | 设计器标题 |
| `readonly` | `boolean` | `false` | 是否启用只读模式 |
| `header.visible` | `boolean` | `true` | 是否显示顶部标题和操作区 |
| `toolbar.visible` | `boolean` | `true` | 是否显示左侧节点工具栏 |
| `canvas` | `object` | - | 画布尺寸、网格等配置 |
| `zoom` | `object` | - | 缩放范围、步长和默认比例 |
| `minimap` | `object` | - | 小地图尺寸和样式 |
| `nodeTypes` | `object` | - | 覆盖节点类型和默认样式 |
| `anchor` | `object` | - | 锚点默认样式 |
| `link` | `object` | - | 连线默认样式 |
| `contextMenu` | `object` | - | 默认节点/连线右键菜单 |
| `events` | `object` | - | 事件回调 |

内置节点类型：

| 类型 | 说明 |
| --- | --- |
| `start` | 开始节点，全局最多一个 |
| `end` | 结束节点，全局最多一个 |
| `userTask` | 用户任务 |
| `systemTask` | 系统任务 |
| `gateway` | 判断/网关节点 |

## API 概览

### AiFlow

| 方法 | 说明 |
| --- | --- |
| `AiFlow.init(container, options)` | 在指定容器中初始化设计器，返回 `Designer` 实例 |
| `AiFlow.create(options)` | 自动创建容器并初始化设计器 |

### Designer

| 方法 | 说明 |
| --- | --- |
| `addNode(type, x, y, extra)` | 创建节点，`extra` 可设置 `id`、`name`、`style` 等 |
| `getNodeById(id)` | 根据 ID 获取节点 |
| `getLinkById(id)` | 根据 ID 获取连线 |
| `exportJSON()` | 导出流程数据 |
| `importJSON(json)` | 导入流程数据并重建画布 |
| `exportPNG(callback)` | 导出 PNG，传入回调时返回 data URL，否则自动下载 |
| `undo()` / `redo()` | 撤销 / 重做 |
| `clearHistory()` | 清空撤销和重做历史 |
| `setReadonly(value)` | 设置整体只读状态 |
| `setEditable()` | 设置画布为可编辑状态 |
| `setTitle(text)` | 修改标题 |
| `showHeader()` / `hideHeader()` / `isHeaderVisible()` | 控制顶部区域 |
| `showToolbar()` / `hideToolbar()` / `isToolbarVisible()` | 控制左侧工具栏 |
| `setNodeContextMenu(items)` | 设置全局节点右键菜单 |
| `setLinkContextMenu(items)` | 设置全局连线右键菜单 |
| `destroy()` | 销毁实例并清理事件和 DOM |

### FlowNode

| 属性 / 方法 | 说明 |
| --- | --- |
| `id` / `type` / `name` / `x` / `y` | 节点基础属性 |
| `setName(name)` | 修改节点名称 |
| `setStyle(style)` | 修改节点样式 |
| `setReadonly(value)` | 设置节点只读状态 |
| `setContextMenu(items)` | 设置节点独立右键菜单 |
| `delete()` | 删除节点及其关联连线 |

### FlowLink

| 属性 / 方法 | 说明 |
| --- | --- |
| `id` / `startNodeId` / `endNodeId` / `remark` | 连线基础属性 |
| `setRemark(text)` | 修改连线备注 |
| `setStyle(style)` | 修改连线样式 |
| `setReadonly(value)` | 设置连线只读状态 |
| `setContextMenu(items)` | 设置连线独立右键菜单 |
| `resetPath()` | 重新计算自动路径 |
| `setPoints(points)` | 恢复手动折点 |
| `delete()` | 删除连线 |

## 事件

```js
AiFlow.init(container, {
  events: {
    onNodeCreated(data) {},
    onNodeDeleted(data) {},
    onLinkCreated(data) {},
    onLinkDeleted(data) {},
    onContextMenuClick(data) {}
  }
});
```

| 事件 | 触发时机 | 回调数据 |
| --- | --- | --- |
| `onNodeCreated` | 节点创建完成 | `{ id, name, type }` |
| `onNodeDeleted` | 节点删除完成 | `{ id, name, type }` |
| `onLinkCreated` | 连线创建完成 | `{ id, startNodeId, endNodeId }` |
| `onLinkDeleted` | 连线删除完成 | `{ id, startNodeId, endNodeId }` |
| `onContextMenuClick` | 右键菜单项被点击 | `{ targetType, targetId, menuName }` |

## 数据格式

```json
{
  "nodes": [
    {
      "id": "guid",
      "type": "start | end | userTask | systemTask | gateway",
      "name": "节点名称",
      "x": 100,
      "y": 200,
      "style": null
    }
  ],
  "links": [
    {
      "id": "guid",
      "startNodeId": "guid",
      "startAnchorPos": "top | bottom | left | right",
      "endNodeId": "guid",
      "endAnchorPos": "top | bottom | left | right",
      "remark": "规则1",
      "style": null,
      "points": [
        { "x": 100, "y": 200 },
        { "x": 100, "y": 260 }
      ]
    }
  ]
}
```

`points` 用于保存手动调整后的连线折点，旧数据可以不包含该字段。`importJSON()` 会在折点无效或与当前锚点不匹配时自动回退为自动布线。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Cmd + Z` | 撤销 |
| `Ctrl/Cmd + Y` | 重做 |
| `Ctrl/Cmd + Shift + Z` | 重做 |
| `Ctrl/Cmd + C` | 复制当前节点 |
| `Ctrl/Cmd + V` | 粘贴节点 |
| `Delete` | 删除选中的节点或连线 |

只读模式下键盘编辑操作不可用。

## 项目结构

```text
.
├── Content/
│   ├── css/
│   │   └── aiflow.css              # 设计器样式
│   ├── es6/
│   │   ├── index.js                # AiFlow 入口
│   │   ├── Designer.js             # 设计器主类
│   │   ├── FlowNode.js             # 节点模型与交互
│   │   ├── FlowLink.js             # 连线模型与路由交互
│   │   ├── FlowAnchor.js           # 节点锚点
│   │   ├── aiflow-router.js        # 正交路由
│   │   ├── minimap.js              # 小地图
│   │   ├── config.js               # 默认配置
│   │   └── raphael.min.js          # Raphael 运行库
│   └── img/
├── demo/                            # 功能示例
├── home.html                        # 项目介绍主页
├── index.html                       # 设计器主页面
├── interface.html                   # 接口文档
├── LICENSE                          # Apache License 2.0
└── README.md
```

详细接口和参数说明请直接查看 [interface.html](interface.html)，各功能示例位于 [demo](demo) 目录。

## 浏览器支持

需要支持 ES Modules、SVG 和现代 DOM API 的浏览器，例如当前版本的 Chrome、Edge、Firefox 和 Safari。

由于项目使用 ES Modules，请通过本地或线上 HTTP 服务访问，不要直接使用 `file://` 协议打开页面。

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。