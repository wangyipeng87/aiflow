/**
 * AiFlow - 节点锚点（ES6 class）
 * 原 aiflow.js FlowAnchor 迁移
 */
import { guid } from './utils.js';

export class FlowAnchor {
  constructor(designer, node, position) {
    this.designer = designer;
    this.node = node;
    this.position = position;
    this.id = guid();

    const acfg = designer.cfg.anchor;
    const pt = node._getAnchorXY(position);
    this._circle = designer.paper.circle(pt.x, pt.y, acfg.radius).attr({
      fill: acfg.fill, stroke: acfg.stroke,
      'stroke-width': acfg.strokeWidth, cursor: acfg.cursor
    });

    this._setupInteraction();
  }

  _updatePosition() {
    const pt = this.node._getAnchorXY(this.position);
    this._circle.attr({ cx: pt.x, cy: pt.y });
  }

  _setupInteraction() {
    const self = this;
    const d = this.designer;
    const acfg = d.cfg.anchor;
    let tempPath = null;
    let dragging = false;
    let anchorPt;

    const start = () => {
      if (d.readonly) return;
      dragging = true;
      anchorPt = self.node._getAnchorXY(self.position);
      tempPath = d.paper.path('M' + anchorPt.x + ',' + anchorPt.y + 'L' + anchorPt.x + ',' + anchorPt.y).attr({
        stroke: '#1890ff', 'stroke-width': 2, 'stroke-dasharray': '- '
      });
    };
    const move = (dx, dy) => {
      if (!dragging || d.readonly || !tempPath) return;
      const sdx = dx / d.scale, sdy = dy / d.scale;
      const ex = anchorPt.x + sdx, ey = anchorPt.y + sdy;
      tempPath.attr({ path: 'M' + anchorPt.x + ',' + anchorPt.y + 'L' + ex + ',' + ey });
    };
    const up = (e) => {
      if (!dragging) return;
      dragging = false;
      if (tempPath) { tempPath.remove(); tempPath = null; }

      const found = d._findAnchorAtScreenPoint(e.clientX, e.clientY);
      if (found && found.anchor !== self) {
        d._pushUndo();
        d._addLink(self.node.id, self.position, found.node.id, found.position);
      }
    };

    this._circle.drag(move, start, up);

    this._circle.hover(
      () => { self._circle.attr({ fill: acfg.hoverFill, stroke: acfg.hoverStroke, r: acfg.radius + 1 }); },
      () => { self._circle.attr({ fill: acfg.fill, stroke: acfg.stroke, r: acfg.radius }); }
    );
  }

  _remove() {
    this._circle.remove();
  }
}
