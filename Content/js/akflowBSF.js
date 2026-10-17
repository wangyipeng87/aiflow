//插件编写
;(function ($) {
    $.fn.akflow = function (options) {
        this.settings = {};
        this.wf_view = null;
        var newOptions = $.deepClone(options);
        $.extend(this.settings, newOptions);
        if (this.wf_view == null || this.wf_view == undefined) {
            this.wf_view = Raphael("divdesign", $(this).width(), $(this).height());
            this.append(this.wf_view);

        }
        this.nodeList = [];
        this.gateWayList = [];
        this.ruleList = [];
        this.anchorList = [];

        var testPointList = [];
        var viewObj = this;
        var positionEnu = {
            TOP: "top",
            BOTTOM: "bottom",
            LEFT: "left",
            RIGHT: "right"
        };

        /**
         * 节点
         * @param _options
         */
        var wfnode = function (_options) {
            this.nodeSettings = {
                key: "",
                text: "",
                nodeType: 3,
                nodeWidth: 108,
                nodeHeight: 50,
                nodeRect: 7,
                nodeDescription: "",
                nodeStyle: {
                    'x': 0,
                    'y': 0,
                    'fill': "#efeff0",
                    'stroke': "#5DA95E",
                    'fill-opacity': 1,
                    'stroke-width': 1,
                    'cursor': "pointer"
                },
                textStyle: {
                    'font-size': "12px",
                }
            };

            this.anchorList = [];
            var nodeObj = this;

            var start = function (x, y) {
                this.attr({opacity: 1});
                this.lastX = x;
                this.lastY = y;
            }, move = function (dx, dy, x, y) {
                var delX = x - this.lastX;
                var delY = y - this.lastY;
                nodeObj.nodeSettings.nodeStyle.x = nodeObj.nodeSettings.nodeStyle.x + delX;
                nodeObj.nodeSettings.nodeStyle.y = nodeObj.nodeSettings.nodeStyle.y + delY;
                this.attr({
                    x: nodeObj.nodeSettings.nodeStyle.x,
                    y: nodeObj.nodeSettings.nodeStyle.y
                });
                this.lastX = x;
                this.lastY = y;
                if ($.listIsNotEmpty(nodeObj.anchorList)) {
                    $(nodeObj.anchorList).each(function (anchorIndex, anchorItem) {
                        anchorItem.resize();
                    });
                }
                var relRuleList = _getRuleByNodeKey(nodeObj.nodeSettings.key);
                if ($.listIsNotEmpty(relRuleList)) {
                    $(relRuleList).each(function (ruleIndex, ruleItem) {
                        ruleItem.resize();
                    });
                }
            }, up = function () {
                this.attr({opacity: 0.8});
            };

            this.node = null;
            $.extend(this.nodeSettings, _options);
            this.node = viewObj.wf_view.rect(this.nodeSettings.nodeStyle.x, this.nodeSettings.nodeStyle.y, this.nodeSettings.nodeWidth, this.nodeSettings.nodeHeight, this.nodeSettings.nodeRect);
            this.node.attr(this.nodeSettings.nodeStyle);
            this.node.drag(move, start, up);

            var topAnchor = new wfanchor({
                key: $.uuid(),
                nodeKey: this.nodeSettings.key,
                position: "top",
            }, nodeObj);
            this.anchorList.push(topAnchor);
            var bottomAnchor = new wfanchor({
                key: $.uuid(),
                nodeKey: this.nodeSettings.key,
                position: "bottom",
            }, nodeObj);
            this.anchorList.push(bottomAnchor);
            var leftAnchor = new wfanchor({
                key: $.uuid(),
                nodeKey: this.nodeSettings.key,
                position: "left",
            }, nodeObj);
            this.anchorList.push(leftAnchor);
            var rightAnchor = new wfanchor({
                key: $.uuid(),
                nodeKey: this.nodeSettings.key,
                position: "right",
            }, nodeObj);
            this.anchorList.push(rightAnchor);

            this.delete = function () {

            }

            this.isInNode = function (point) {
                var x = this.nodeSettings.nodeStyle.x;
                var y = this.nodeSettings.nodeStyle.y;
                var height = this.nodeSettings.nodeHeight;
                var width = this.nodeSettings.nodeWidth;
                var px = point.x;
                var py = point.y;
                if (px >= x && px <= x + width && py >= y && py <= y + height) {
                    return true;
                }
                return false;
            }

            this.getNodeArea = function (point) {
                if (this.getTopAndBottom(point) == positionEnu.TOP) {
                    if (this.getLeftAndRight(point) == positionEnu.LEFT) {
                        // 左侧锚点
                        return positionEnu.LEFT;
                    } else {
                        // 头部侧锚点
                        return positionEnu.TOP;
                    }
                } else {
                    if (this.getLeftAndRight(point) == positionEnu.LEFT) {
                        // 下侧锚点
                        return positionEnu.BOTTOM;
                    } else {
                        // 右侧部侧锚点
                        return positionEnu.RIGHT;
                    }
                }
            }
            this.getTopAndBottom = function (point) {
                var pointHeight = parseFloat(this.nodeSettings.nodeStyle.y) + parseFloat(this.nodeSettings.nodeHeight) - parseFloat(point.y);
                var pointWidth = parseFloat(point.x) - parseFloat(this.nodeSettings.nodeStyle.x);
                if (pointHeight / pointWidth >= parseFloat(this.nodeSettings.nodeHeight) / parseFloat(this.nodeSettings.nodeWidth)) {
                    return positionEnu.TOP;
                }
                return positionEnu.BOTTOM;
            }
            this.getLeftAndRight = function (point) {
                var pointHeight = parseFloat(point.y) - parseFloat(this.nodeSettings.nodeStyle.y);
                var pointWidth = parseFloat(point.x) - parseFloat(this.nodeSettings.nodeStyle.x);
                if (pointHeight / pointWidth >= parseFloat(this.nodeSettings.nodeHeight) / parseFloat(this.nodeSettings.nodeWidth)) {
                    return positionEnu.LEFT;
                }
                return positionEnu.RIGHT;
            }
        }

        /**
         * 规则
         * @param _options
         */
        var wfrule = function (_options) {
            this.ruleSettings = {
                "key": "",
                "text": "",
                "beginNodeKey": "",
                "beginAnchor": "",
                "endNodeKey": "",
                "endAnchor": "",
                "ruleStyle": {
                    "fill": "#efeff0", "stroke": "#5DA95E", "fill-opacity": 1, "stroke-width": 1, "cursor": "pointer"
                },
                "textStyle": {
                    "font-size": "12px"
                },
                "lineList": [],
                "beginPoint": null,
                "endPoint": null
            };
            this.lineList = [];
            this.beginPointObj = null;
            this.endPointObj = null;
            this.isSelected = null;
            $.extend(this.ruleSettings, _options);
            var ruleObj = this;
            if (this.ruleSettings.lineList == null || this.ruleSettings.lineList == undefined) {
                this.ruleSettings.lineList = [];
            }
            if (this.ruleSettings != null && this.ruleSettings != undefined && this.ruleSettings.lineList.length == 0) {
                initPath();
            }

            this.getLineObj = function (lineKey) {
                var lineObj = null;
                if ($.listIsNotEmpty(ruleObj.lineList)) {
                    $(ruleObj.lineList).each(function (linIndex, lineItem) {
                        if (lineItem.key == lineKey) {
                            lineObj = lineItem;
                        }
                    });
                }
                return lineObj;
            }

            this.getAllLine = function () {
                return ruleObj.lineList;
            }

            this.remove = function () {
                if ($.listIsNotEmpty(ruleObj.lineList)) {
                    $(ruleObj.lineList).each(function (linIndex, linObj) {
                        linObj.remove();
                    });
                }
                ruleObj.lineList = [];
                if (this.beginPointObj) {
                    this.beginPointObj.delete();
                }
                if (this.endPointObj) {
                    this.endPointObj.delete();
                }
                this.beginPointObj = null;
                this.endPointObj = null;
                viewObj.ruleList = viewObj.ruleList.filter(p => {
                    return p.ruleSettings.key != ruleObj.ruleSettings.key;
                });

                delete ruleObj;
            }
            this.removeLine = function () {
                if ($.listIsNotEmpty(ruleObj.lineList)) {
                    $(ruleObj.lineList).each(function (linIndex, linObj) {
                        linObj.remove();
                    });
                }
                ruleObj.lineList = [];

            }
            this.select = function () {
                if (!ruleObj.isSelected) {
                    var beginAnchorPoint = this.getBeginAnchorPoint();
                    var endAnchoPoint = this.getEndAnchoPoint();
                    var starPointSetting = {
                        key: $.uuid(),
                        ruleKey: ruleObj.ruleSettings.key,
                        index: 0,
                        beginNodeKey: ruleObj.ruleSettings.beginNodeKey,
                        beginAnchor: ruleObj.ruleSettings.beginAnchor,
                        endNodeKey: ruleObj.ruleSettings.endNodeKey,
                        endAnchor: ruleObj.ruleSettings.endAnchor,
                        style: {
                            'x': beginAnchorPoint.x,
                            'y': beginAnchorPoint.y,

                            'z-index': 99999,
                            "stroke-width": 2,
                            "stroke": '#00ffff',
                            "fill": "#00ffff",
                            "cursor": 'pointer'
                        }
                    };
                    var startPoint = new wfStartPoint(starPointSetting);
                    ruleObj.beginPointObj = startPoint;

                    var endPointSetting = {
                        key: $.uuid(),
                        ruleKey: ruleObj.ruleSettings.key,
                        index: 0,
                        beginNodeKey: ruleObj.ruleSettings.beginNodeKey,
                        beginAnchor: ruleObj.ruleSettings.beginAnchor,
                        endNodeKey: ruleObj.ruleSettings.endNodeKey,
                        endAnchor: ruleObj.ruleSettings.endAnchor,
                        style: {
                            'x': endAnchoPoint.x,
                            'y': endAnchoPoint.y,
                            "stroke-width": 2,
                            'z-index': 99999,
                            "stroke": '#00ffff',
                            "fill": "#00ffff",
                            "cursor": 'pointer'
                        }
                    };
                    var endPoint = new wfEndPoint(endPointSetting);
                    ruleObj.endPointObj = endPoint;
                } else {
                    ruleObj.unselect();
                }
                if ($.listIsNotEmpty(ruleObj.lineList)) {
                    $(ruleObj.lineList).each(function (linIndex, linObj) {
                        linObj.select();
                    });
                }
                ruleObj.isSelected = !ruleObj.isSelected;
            }
            this.unselect = function () {
                if (this.beginPointObj) {
                    this.beginPointObj.delete();
                }
                if (this.endPointObj) {
                    this.endPointObj.delete();
                }
                this.beginPointObj = null;
                this.endPointObj = null;
            }
            this.resize = function (_options) {
                if ($.listIsNotEmpty(ruleObj.lineList)) {
                    $(ruleObj.lineList).each(function (linIndex, linObj) {
                        linObj.remove();
                        linObj = null;
                    });
                }
                ruleObj.ruleSettings.lineList = [];
                ruleObj.lineList = [];

                if (this.beginPointObj) {
                    this.beginPointObj.delete();
                }
                if (this.endPointObj) {
                    this.endPointObj.delete();
                }
                this.beginPointObj = null;
                this.endPointObj = null;
                if (_options != null && _options != undefined) {
                    $.extend(ruleObj.ruleSettings, _options);
                }
                initPath();
            }

            function _getEndNode() {
                var nodeObj = null;
                if ($.isNotEmpty(ruleObj.ruleSettings.endNodeKey) && $.listIsNotEmpty(viewObj.nodeList)) {
                    $(viewObj.nodeList).each(function (nodeIndex, nodeItem) {
                        if (nodeItem.nodeSettings.key == ruleObj.ruleSettings.endNodeKey) {
                            nodeObj = nodeItem;
                        }
                    });
                }
                return nodeObj;
            }

            function _getBeginNode() {
                var nodeObj = null;
                if ($.isNotEmpty(ruleObj.ruleSettings.beginNodeKey) && $.listIsNotEmpty(viewObj.nodeList)) {
                    $(viewObj.nodeList).each(function (nodeIndex, nodeItem) {
                        if (nodeItem.nodeSettings.key == ruleObj.ruleSettings.beginNodeKey) {
                            nodeObj = nodeItem;
                        }
                    });
                }
                return nodeObj;
            }

            this.getEndNode = function () {
                return _getEndNode();
            }


            this.getBeginNode = function () {
                return _getBeginNode();
            }

            function _getBeginAnchorPoint() {
                return getNodeAnchorPoint(_getBeginNode(), ruleObj.ruleSettings.beginAnchor);
            }

            function _getEndAnchoPoint() {
                return getNodeAnchorPoint(_getEndNode(), ruleObj.ruleSettings.endAnchor);
            }

            this.getBeginAnchorPoint = function () {
                return _getBeginAnchorPoint();
            }


            this.getEndAnchoPoint = function () {
                return _getEndAnchoPoint();
            }

            function initPath() {
                var oldStyle = $.deepClone(ruleObj.ruleSettings.ruleStyle);
                let beginNode = _getBeginNode();
                let endNode = _getEndNode();
                if (beginNode != null && beginNode != undefined && endNode != null && endNode != undefined) {
                    var beginPoint = getNodePoint(beginNode, ruleObj.ruleSettings.beginAnchor);
                    var endPoint = getNodePoint(endNode, ruleObj.ruleSettings.endAnchor);
                    var beginAnchorPoint = _getBeginAnchorPoint();
                    var endAnchoPoint = _getEndAnchoPoint();
                    var PointList = [];
                    var linPathPointList = [];
                    if (ruleObj.ruleSettings.beginNodeKey === ruleObj.ruleSettings.endNodeKey) {
                        PointList = getTwoNodePointList(beginNode, endNode, null, null, "", "");
                        linPathPointList = generateSameNodePath(beginPoint, endPoint, PointList);
                    } else {
                        PointList = getTwoNodePointList(beginNode, endNode, beginPoint, endPoint, ruleObj.ruleSettings.beginAnchor, ruleObj.ruleSettings.endAnchor);
                        if ($.listIsNotEmpty(testPointList)) {
                            $(testPointList).each(function (xIndex, xItem) {
                                xItem.remove();
                            });
                        }

                        linPathPointList = generateBSFPath(beginAnchorPoint, endAnchoPoint, beginPoint, endPoint, PointList, beginNode, endNode, 1);

                        linPathPointList = $.dedupePointList(linPathPointList);
                        linPathPointList.push({
                            x: endPoint.x,
                            y: endPoint.y
                        });
                        linPathPointList = [{
                            x: beginPoint.x,
                            y: beginPoint.y
                        }].concat(linPathPointList); // 在头部插入元素1
                    }


                    linPathPointList = [{
                        x: beginAnchorPoint.x,
                        y: beginAnchorPoint.y
                    }].concat(linPathPointList); // 在头部插入元素1


                    linPathPointList.push({
                        x: endAnchoPoint.x,
                        y: endAnchoPoint.y
                    });

                    if ($.listIsNotEmpty(linPathPointList)) {

                        for (var i = 0; i < (linPathPointList.length - 1); i++) {
                            ruleObj.ruleSettings.lineList.push({
                                key: $.uuid(),
                                ruleKey: ruleObj.ruleSettings.key,
                                linestyle: {
                                    'beginx': linPathPointList[i].x,
                                    'beginy': linPathPointList[i].y,
                                    'endx': linPathPointList[i + 1].x,
                                    'endy': linPathPointList[i + 1].y,
                                    "stroke-width": 2,
                                    "stroke": '#5DA95E',
                                    "cursor": 'col-resize'
                                }, textStyle: {
                                    'font-size': "12px",
                                }
                            });
                        }
                    }
                }
                $(ruleObj.ruleSettings.lineList).each(function (indexLine, itemLine) {
                    var newLineStyle = $.deepClone(itemLine.linestyle);
                    $.extend(newLineStyle, oldStyle);
                    newLineStyle.cursor = "pointer";

                    if (indexLine === 0 || indexLine === (ruleObj.ruleSettings.lineList.length - 1) || (newLineStyle.beginx == newLineStyle.endx && newLineStyle.beginy == newLineStyle.endy)) {
                        itemLine.isEnable = false;
                    } else {
                        if (newLineStyle.beginx == newLineStyle.endx) {
                            newLineStyle.cursor = "col-resize";
                        }
                        if (newLineStyle.beginy == newLineStyle.endy) {
                            newLineStyle.cursor = "row-resize";
                        }
                    }
                    if (indexLine === (ruleObj.ruleSettings.lineList.length - 1)) {
                        itemLine.isEndLine = true;
                        itemLine.linestyle = newLineStyle;
                    }
                    itemLine.linestyle = newLineStyle;
                    var line = new wfline(itemLine);
                    ruleObj.lineList.push(line);
                });

            }

            function initPathByNode() {

            }

            function initPathByAnchor() {

            }

            function initPathBySetting() {

            }

            function getRule() {

            }
        }
        /**
         * 规则线段
         * @param _options
         */
        var wfline = function (_options) {
            this.lineSettings = {
                key: "",
                ruleKey: "",
                index: 0,
                isEnable: true,
                isEndLine: false,
                linestyle: {
                    'beginx': 0,
                    'beginy': 0,
                    'endx': 0,
                    'endy': 0,
                    "stroke-width": 2,
                    "stroke": '#5DA95E',
                    "cursor": 'col-resize'
                }, textStyle: {
                    'font-size': "12px",
                },
                hitAreastyle: {
                    "stroke": "transparent",
                    "stroke-width": 10,
                    "stroke-opacity": 0
                },
            };
            this.linkList = [];
            this.linePath = null;
            this.hitAreaPath = null;
            this.isSelected = null;
            $.extend(this.lineSettings, _options);

            var lineObj = this;
            var linePathStr = 'M' + this.lineSettings.linestyle.beginx + ' ' + this.lineSettings.linestyle.beginy + ' L' + this.lineSettings.linestyle.endx + ' ' + this.lineSettings.linestyle.endy;
            this.linePath = viewObj.wf_view.path(linePathStr);
            var hitAreaPathStr = 'M' + this.lineSettings.linestyle.beginx + ' ' + this.lineSettings.linestyle.beginy + ' L' + this.lineSettings.linestyle.endx + ' ' + this.lineSettings.linestyle.endy;
            this.hitAreaPath = viewObj.wf_view.path(hitAreaPathStr);
            this.hitAreaPath.attr(this.lineSettings.hitAreastyle);
            this.hitAreaPath.node.style.cursor = this.lineSettings.linestyle.cursor;

            this.linePath.attr(this.lineSettings.linestyle);
            if (this.lineSettings.isEndLine) {
                this.linePath.attr({
                    "arrow-end": "classic-wide-long"
                });
            }
            this.hitAreaPath.click(function () {
                var parentRule = _getRuleByKey(lineObj.lineSettings.ruleKey);
                parentRule.select();

            });

            this.select = function () {

                if (!this.isSelected) {
                    this.linePath.attr({
                        "stroke": "#00ffff",
                        "z-index": 99999
                    });
                } else {
                    this.linePath.attr({
                        "stroke": "#5DA95E",
                        "z-index": 1
                    });
                }
                this.isSelected = !this.isSelected;
            }
            this.unselect = function () {
                this.linePath.attr({
                    "stroke": "#5DA95E"
                });
            }
            var start = function (x, y) {
                this.attr({opacity: 1});
                this.towPoint = $.deepClone(lineObj.lineSettings.linestyle);
                this.lastX = x;
                this.lastY = y;
            }, move = function (dx, dy, x, y) {
                var deltaX = dx;
                var deltaY = dy;
                var afterLinePathStr = this.attr("path");
                var afterPoint = {
                    beginx: this.towPoint.beginx,
                    beginy: this.towPoint.beginy,
                    endx: this.towPoint.endx,
                    endy: this.towPoint.endy
                }
                if (afterPoint.beginx == afterPoint.endx) {
                    // 竖线
                    afterPoint = {
                        beginx: parseFloat(afterPoint.beginx) + deltaX,
                        beginy: afterPoint.beginy,
                        endx: parseFloat(afterPoint.endx) + deltaX,
                        endy: afterPoint.endy
                    };
                }
                if (afterPoint.beginy == afterPoint.endy) {
                    //横线
                    afterPoint = {
                        beginx: afterPoint.beginx,
                        beginy: (parseFloat(afterPoint.beginy) + deltaY),
                        endx: afterPoint.endx,
                        endy: parseFloat(afterPoint.endy) + deltaY
                    };
                }
                afterLinePathStr = 'M' + (afterPoint.beginx) + ' ' + (afterPoint.beginy) + ' L' + (afterPoint.endx) + ' ' + (afterPoint.endy);
                this.attr({
                    path: afterLinePathStr
                });

                lineObj.linePath.attr({
                    path: afterLinePathStr
                });
                lineObj.lineSettings.linestyle.beginx = afterPoint.beginx;
                lineObj.lineSettings.linestyle.beginy = afterPoint.beginy;
                lineObj.lineSettings.linestyle.endx = afterPoint.endx;
                lineObj.lineSettings.linestyle.endy = afterPoint.endy;
                this.attr(lineObj.lineSettings.linestyle);
                this.attr(lineObj.lineSettings.hitAreastyle);
                this.lastX = x;
                this.lastY = y;
                var linkId = $.uuid();
                lineObj.linkList.push(linkId);
                var nextLine = lineObj.getNextLine();
                var previousLine = lineObj.getPreviousLine();
                if (nextLine != null && nextLine != undefined) {
                    nextLine.linkage(linkId);
                }
                if (previousLine != null && previousLine != undefined) {
                    previousLine.linkage(linkId);
                }
            }, up = function () {
                this.attr({opacity: 0.8});
                var parentRule = _getRuleByKey(lineObj.lineSettings.ruleKey);
                parentRule.unselect();
            };
            if (this.lineSettings.isEnable) {
                this.hitAreaPath.drag(move, start, up);
            }

            function resize(linkId) {

            }

            this.remove = function () {
                this.linePath.remove();
                this.hitAreaPath.remove();
                delete this;
            }
            this.getNextLine = function () {
                var rule = _getRuleByKey(this.lineSettings.ruleKey);
                var lineObj = null;
                if (rule != null && rule != undefined) {
                    if ($.listIsNotEmpty(rule.lineList)) {
                        for (var i = 0; i < rule.lineList.length; i++) {
                            if (rule.lineList[i].lineSettings.key == this.lineSettings.key) {
                                if (i < rule.lineList.length - 1) {
                                    lineObj = rule.lineList[i + 1];
                                }
                            }
                        }
                    }
                }
                return lineObj;
            }
            this.getPreviousLine = function () {
                var rule = _getRuleByKey(this.lineSettings.ruleKey);
                var lineObj = null;
                if (rule != null && rule != undefined) {
                    if ($.listIsNotEmpty(rule.lineList)) {
                        for (var i = 0; i < rule.lineList.length; i++) {
                            if (rule.lineList[i].lineSettings.key == this.lineSettings.key) {
                                if (i > 0) {
                                    lineObj = rule.lineList[i - 1];
                                }
                            }
                        }
                    }
                }
                return lineObj;
            }
            /**
             * 联动
             * @param linkId
             */
            this.linkage = function (linkId) {
                if ($.inArray(linkId, this.linkList) == -1) {
                    var nextLine = this.getNextLine();
                    var previousLine = this.getPreviousLine();
                    var oldLineSettings = $.deepClone(this.lineSettings);
                    if (nextLine != null && nextLine != undefined) {
                        oldLineSettings.linestyle.endx = nextLine.lineSettings.linestyle.beginx;
                        oldLineSettings.linestyle.endy = nextLine.lineSettings.linestyle.beginy;
                    }
                    if (previousLine != null && previousLine != undefined) {
                        oldLineSettings.linestyle.beginx = previousLine.lineSettings.linestyle.endx;
                        oldLineSettings.linestyle.beginy = previousLine.lineSettings.linestyle.endy;
                    }
                    $.extend(this.lineSettings, oldLineSettings);
                    this.linkList.push(linkId);
                    var afterLinePathStr = 'M' + (oldLineSettings.linestyle.beginx) + ' ' + (oldLineSettings.linestyle.beginy) + ' L' + (oldLineSettings.linestyle.endx) + ' ' + (oldLineSettings.linestyle.endy);
                    this.linePath.attr({
                        path: afterLinePathStr
                    });
                    this.hitAreaPath.attr({
                        path: afterLinePathStr
                    });
                    if (nextLine != null && nextLine != undefined) {
                        nextLine.linkage(linkId);
                    }
                    if (previousLine != null && previousLine != undefined) {
                        previousLine.linkage(linkId);
                    }
                }
            }
        }

        /**
         * 锚点
         * @param _options
         */
        var wfanchor = function (_options, node) {
            this.anchorSettings = {
                key: "",
                nodeKey: "",
                position: "",
                index: 0,
                anchorStyle: {
                    'x': 0,
                    'y': 0,
                    "stroke-width": 2,
                    "stroke": '#00ffff',
                    "fill": '#ffffff',
                    "cursor": 'crosshair'
                }
            };
            this.anchorPath = null;
            this.actRule = null;
            this.pointCircle = null;
            this.parentNode = node;
            this.movePoint = null;
            $.extend(this.anchorSettings, _options);
            var anchorObj = this;
            initAnchor();
            this.delete = function () {

            }
            this.resize = function () {
                var node = this.parentNode;
                if (this.parentNode == null || this.parentNode == undefined) {
                    node = _getNodeByKey(anchorObj.anchorSettings.nodeKey);
                }
                var point = getNodeAnchorPoint(node, anchorObj.anchorSettings.position);
                anchorObj.anchorSettings.anchorStyle.y = point.y;
                anchorObj.anchorSettings.anchorStyle.x = point.x;
                if (this.pointCircle == null || this.pointCircle == undefined) {
                    anchorObj.pointCircle = viewObj.wf_view.circle(this.anchorSettings.anchorStyle.x, this.anchorSettings.anchorStyle.y, 6);
                    anchorObj.pointCircle.attr(anchorObj.anchorSettings.anchorStyle);

                } else {
                    anchorObj.pointCircle.attr({
                        x: this.anchorSettings.anchorStyle.x,
                        y: this.anchorSettings.anchorStyle.y,
                        cx: this.anchorSettings.anchorStyle.x,
                        cy: this.anchorSettings.anchorStyle.y
                    });
                }
            }

            function initAnchor() {
                var node = anchorObj.parentNode;
                if (anchorObj.parentNode == null || anchorObj.parentNode == undefined) {
                    node = _getNodeByKey(anchorObj.anchorSettings.nodeKey);
                }
                var point = getNodeAnchorPoint(node, anchorObj.anchorSettings.position);
                if (anchorObj.pointCircle == null || anchorObj.pointCircle == undefined) {
                    anchorObj.pointCircle = viewObj.wf_view.circle(point.x, point.y, 4);
                    anchorObj.pointCircle.attr(anchorObj.anchorSettings.anchorStyle);
                }
                anchorObj.anchorSettings.anchorStyle.y = point.y;
                anchorObj.anchorSettings.anchorStyle.x = point.x;

                var start = function (x, y) {
                    this.attr({opacity: 1});
                    this.lastX = x;
                    this.lastY = y;
                }, move = function (dx, dy, x, y) {
                    var delX = x - this.lastX;
                    var delY = y - this.lastY;
                    var point = {
                        x: anchorObj.anchorSettings.anchorStyle.x + delX,
                        y: anchorObj.anchorSettings.anchorStyle.y + delY,
                    };
                    var endpoint = null;
                    // var linePathStr = 'M' + anchorObj.anchorSettings.anchorStyle.x + ' ' + anchorObj.anchorSettings.anchorStyle.y + ' L' + (parseFloat(anchorObj.anchorSettings.anchorStyle.x) + dx).toString() + ' ' + (parseFloat(anchorObj.anchorSettings.anchorStyle.y) + dy).toString();
                    let nodeList = viewObj.nodeList;
                    if ($.listIsNotEmpty(nodeList)) {
                        $(nodeList).each(function (indexNode, itemNode) {
                            if (endpoint == null) {
                                if (itemNode.isInNode(point)) {
                                    var position = itemNode.getNodeArea(point);
                                    endpoint = getNodeAnchorPoint(itemNode, position);
                                }
                            }
                        });
                    }
                    if (endpoint == null) {
                        endpoint = point;
                    }

                    anchorObj.movePoint = point;

                    if (anchorObj.anchorSettings.anchorStyle.x == endpoint.x &&
                        anchorObj.anchorSettings.anchorStyle.y == endpoint.y) {
                        return;
                    }
                    var linePathStr = 'M' + anchorObj.anchorSettings.anchorStyle.x + ' ' + anchorObj.anchorSettings.anchorStyle.y + ' L' + (endpoint.x).toString() + ' ' + (endpoint.y).toString();

                    if (anchorObj.actRule == null && anchorObj.actRule == undefined) {
                        anchorObj.actRule = viewObj.wf_view.path(linePathStr);
                        anchorObj.actRule.attr({
                            "stroke-width": 2,
                            "stroke": "#5DA95E",
                            "arrow-end": "classic-wide-long",
                            "stroke-dasharray": "--",
                        });
                    } else {
                        anchorObj.actRule.attr({
                            path: linePathStr
                        });
                    }
                }, up = function () {
                    if (anchorObj.actRule != null && anchorObj.actRule != undefined) {
                        anchorObj.actRule.remove();
                        anchorObj.actRule = null;
                    }
                    let nodeList = viewObj.nodeList;
                    var endPosition = "";
                    var endNode = null;
                    if ($.listIsNotEmpty(nodeList)) {
                        $(nodeList).each(function (indexNode, itemNode) {
                            if (anchorObj.movePoint != null) {
                                if (itemNode.isInNode(anchorObj.movePoint)) {
                                    endPosition = itemNode.getNodeArea(anchorObj.movePoint);
                                    endNode = itemNode;
                                }
                            }
                        });
                    }
                    if (!$.isempty(endPosition)) {
                        let newRuleSettings = {
                            "key": $.uuid(),
                            "text": "",
                            "beginNodeKey": anchorObj.parentNode.nodeSettings.key,
                            "beginAnchor": anchorObj.anchorSettings.position,
                            "endNodeKey": endNode.nodeSettings.key,
                            "endAnchor": endPosition,
                            "ruleStyle": {
                                "fill": "#efeff0",
                                "stroke": "#5DA95E",
                                "fill-opacity": 1,
                                "stroke-width": 2,
                                "cursor": "pointer"
                            },
                            "textStyle": {
                                "font-size": "12px"
                            },
                            "lineList": [],
                            "beginPoint": null,
                            "endPoint": null
                        };
                        var rule = new wfrule(newRuleSettings);
                        viewObj.ruleList.push(rule);
                    }
                    anchorObj.movePoint = null;

                };
                anchorObj.pointCircle.drag(move, start, up);


            }
        }
        /**
         * 网关
         * @param _options
         */
        var wfgetway = function (_options) {
            this.anchorSettings = {
                key: "",
                index: 0,
                anchorStyle: {
                    'x': 0,
                    'y': 0,
                    "stroke-width": 2,
                    "stroke": '#5DA95E',
                    "cursor": 'col-resize'
                }
            };
            this.anchorPath = null;
            $.extend(this.anchorSettings, _options);
            this.delete = function () {

            }
        }
        /**
         * 规则开始点
         * @param _options
         */
        var wfStartPoint = function (_options) {
            this.startPointSettings = {
                key: "",
                ruleKey: "",
                index: 0,
                beginNodeKey: "",
                beginAnchor: "",
                endNodeKey: "",
                endAnchor: "",
                style: {
                    'x': 0,
                    'y': 0,

                    "stroke-width": 2,
                    "cursor": 'move',
                    "fill": "#00ffff",
                    "stroke": "#00ffff",
                    "opacity": 0,
                    "fill-opacity": 0
                }
            };
            this.startPointPath = null;
            this.actLine = null;

            $.extend(this.startPointSettings, _options);
            var wfStartPointObj = this;
            initObj();

            function initObj() {
                if (wfStartPointObj.startPointPath == null || wfStartPointObj.startPointPath == undefined) {
                    wfStartPointObj.startPointPath = viewObj.wf_view.circle(wfStartPointObj.startPointSettings.style.x, wfStartPointObj.startPointSettings.style.y, 4);
                    wfStartPointObj.startPointPath.attr(wfStartPointObj.startPointSettings.style);
                } else {
                    wfStartPointObj.startPointPath.attr({
                        x: wfStartPointObj.startPointSettings.style.x,
                        y: wfStartPointObj.startPointSettings.style.y,
                        cx: wfStartPointObj.startPointSettings.style.x,
                        cy: wfStartPointObj.startPointSettings.style.y
                    });
                }
                wfStartPointObj.startPointPath.attr({opacity: 1, cursor: "move"});
                var start = function (x, y) {
                    this.attr({opacity: 1});
                    this.lastX = x;
                    this.lastY = y;
                }, move = function (dx, dy, x, y) {
                    var parentRule = viewObj.getRuleByKey(wfStartPointObj.startPointSettings.ruleKey);
                    parentRule.removeLine();
                    var beginPoint = parentRule.getBeginAnchorPoint();
                    var endPoint = parentRule.getEndAnchoPoint();
                    var linePathStr = 'M' + (parseFloat(beginPoint.x) + dx).toString() + ' ' + (parseFloat(beginPoint.y) + dy).toString() + ' L' + endPoint.x + ' ' + endPoint.y;
                    // console.log("开始点拖动的位置" + linePathStr);
                    if (wfStartPointObj.actLine == null && wfStartPointObj.actLine == undefined) {
                        wfStartPointObj.actLine = viewObj.wf_view.path(linePathStr);
                        wfStartPointObj.actLine.attr({
                            "stroke-width": 2,
                            "stroke": "#00ffff",
                            "arrow-end": "classic-wide-long",
                            "stroke-dasharray": "--",
                        });
                    } else {
                        // console.log("开始点继续拖动的位置" + linePathStr);
                        wfStartPointObj.actLine.attr({
                            path: linePathStr
                        });
                    }
                    wfStartPointObj.startPointSettings.style.x = parseFloat(beginPoint.x) + dx;
                    wfStartPointObj.startPointSettings.style.y = parseFloat(beginPoint.y) + dy;
                    wfStartPointObj.startPointPath.attr({
                        x: wfStartPointObj.startPointSettings.style.x,
                        y: wfStartPointObj.startPointSettings.style.y,
                        cx: wfStartPointObj.startPointSettings.style.x,
                        cy: wfStartPointObj.startPointSettings.style.y
                    });

                }, up = function () {
                    if (wfStartPointObj.actLine != null && wfStartPointObj.actLine != undefined) {
                        wfStartPointObj.actLine.remove();
                        wfStartPointObj.actLine = null;
                    }
                    wfStartPointObj.delete();

                    let beginPoint = {
                        x: wfStartPointObj.startPointSettings.style.x,
                        y: wfStartPointObj.startPointSettings.style.y,
                    };


                    let nodeList = viewObj.nodeList;
                    var beginPosition = "";
                    var beginNode = null;
                    if ($.listIsNotEmpty(nodeList)) {
                        $(nodeList).each(function (indexNode, itemNode) {
                            if (beginPoint != null) {
                                if (itemNode.isInNode(beginPoint)) {
                                    beginPosition = itemNode.getNodeArea(beginPoint);
                                    beginNode = itemNode;
                                }
                            }
                        });
                    }
                    var parentRule = viewObj.getRuleByKey(wfStartPointObj.startPointSettings.ruleKey);
                    parentRule.remove();
                    if (!$.isempty(beginPosition)) {
                        let newRuleSettings = {
                            "key": $.uuid(),
                            "text": "",
                            "beginNodeKey": beginNode.nodeSettings.key,
                            "beginAnchor": beginPosition,
                            "endNodeKey": wfStartPointObj.startPointSettings.endNodeKey,
                            "endAnchor": wfStartPointObj.startPointSettings.endAnchor,
                            "ruleStyle": {
                                "fill": "#efeff0",
                                "stroke": "#5DA95E",
                                "fill-opacity": 1,
                                "stroke-width": 2,
                                "cursor": "pointer"
                            },
                            "textStyle": {
                                "font-size": "12px"
                            },
                            "lineList": [],
                            "beginPoint": null,
                            "endPoint": null
                        };
                        var rule = new wfrule(newRuleSettings);
                        viewObj.ruleList.push(rule);
                    }
                };
                wfStartPointObj.startPointPath.drag(move, start, up);
            }

            this.delete = function () {
                this.startPointPath.remove();
                delete wfStartPointObj;
            }
        }
        /**
         * 规则结束点
         * @param _options
         */
        var wfEndPoint = function (_options) {
            this.endPointSettings = {
                key: "",
                ruleKey: "",
                index: 0,
                beginNodeKey: "",
                beginAnchor: "",
                endNodeKey: "",
                endAnchor: "",
                style: {
                    'x': 0,
                    'y': 0,

                    "stroke-width": 2,
                    "cursor": 'pointer',
                    "fill": "#00ffff",
                    "stroke": "#00ffff"
                }
            };
            this.endPointPath = null;
            $.extend(this.endPointSettings, _options);
            var wfEndPointObj = this;
            this.actLine = null;
            initObj();

            function initObj() {
                if (wfEndPointObj.endPointPath == null || wfEndPointObj.endPointPath == undefined) {
                    wfEndPointObj.endPointPath = viewObj.wf_view.circle(wfEndPointObj.endPointSettings.style.x, wfEndPointObj.endPointSettings.style.y, 4);
                    wfEndPointObj.endPointPath.attr(wfEndPointObj.endPointSettings.style);
                } else {
                    wfEndPointObj.endPointPath.attr({
                        x: wfEndPointObj.endPointSettings.style.x,
                        y: wfEndPointObj.endPointSettings.style.y,
                        cx: wfEndPointObj.endPointSettings.style.x,
                        cy: wfEndPointObj.endPointSettings.style.y
                    });
                }

                var start = function (x, y) {
                    this.attr({opacity: 1});
                }, move = function (dx, dy, x, y) {
                    var parentRule = viewObj.getRuleByKey(wfEndPointObj.endPointSettings.ruleKey);
                    parentRule.removeLine();
                    var beginPoint = parentRule.getBeginAnchorPoint();
                    var endPoint = parentRule.getEndAnchoPoint();
                    // var linePathStr = 'M' + beginPoint.x + ' ' + beginPoint.y + ' L' + endPoint.x + ' ' + endPoint.y;
                    var linePathStr = 'M' + beginPoint.x + ' ' + beginPoint.y + ' L' + (parseFloat(endPoint.x) + dx).toString() + ' ' + (parseFloat(endPoint.y) + dy).toString();

                    if (wfEndPointObj.actLine == null && wfEndPointObj.actLine == undefined) {
                        wfEndPointObj.actLine = viewObj.wf_view.path(linePathStr);
                        wfEndPointObj.actLine.attr({
                            "stroke-width": 2,
                            "stroke": "#00ffff",
                            "arrow-end": "classic-wide-long",
                            "stroke-dasharray": "--",
                        });
                    } else {
                        wfEndPointObj.actLine.attr({
                            path: linePathStr
                        });
                    }
                    wfEndPointObj.endPointSettings.style.x = parseFloat(endPoint.x) + dx;
                    wfEndPointObj.endPointSettings.style.y = parseFloat(endPoint.y) + dy;
                    wfEndPointObj.endPointPath.attr({
                        x: wfEndPointObj.endPointSettings.style.x,
                        y: wfEndPointObj.endPointSettings.style.y,
                        cx: wfEndPointObj.endPointSettings.style.x,
                        cy: wfEndPointObj.endPointSettings.style.y
                    });
                }, up = function () {
                    if (wfEndPointObj.actLine != null && wfEndPointObj.actLine != undefined) {
                        wfEndPointObj.actLine.remove();
                        wfEndPointObj.actLine = null;
                    }
                    wfEndPointObj.delete();

                    let endPoint = {
                        x: wfEndPointObj.endPointSettings.style.x,
                        y: wfEndPointObj.endPointSettings.style.y,
                    };

                    let nodeList = viewObj.nodeList;
                    var endPosition = "";
                    var endNode = null;
                    if ($.listIsNotEmpty(nodeList)) {
                        $(nodeList).each(function (indexNode, itemNode) {
                            if (endPoint != null) {
                                if (itemNode.isInNode(endPoint)) {
                                    endPosition = itemNode.getNodeArea(endPoint);
                                    endNode = itemNode;
                                }
                            }
                        });
                    }
                    var parentRule = viewObj.getRuleByKey(wfEndPointObj.endPointSettings.ruleKey);
                    parentRule.remove();
                    if (!$.isempty(endPosition)) {
                        let newRuleSettings = {
                            "key": $.uuid(),
                            "text": "",
                            "beginNodeKey": wfEndPointObj.endPointSettings.beginNodeKey,
                            "beginAnchor": wfEndPointObj.endPointSettings.beginAnchor,
                            "endNodeKey": endNode.nodeSettings.key,
                            "endAnchor": endPosition,
                            "ruleStyle": {
                                "fill": "#efeff0",
                                "stroke": "#5DA95E",
                                "fill-opacity": 1,
                                "stroke-width": 2,
                                "cursor": "pointer"
                            },
                            "textStyle": {
                                "font-size": "12px"
                            },
                            "lineList": [],
                            "beginPoint": null,
                            "endPoint": null
                        };
                        var rule = new wfrule(newRuleSettings);
                        viewObj.ruleList.push(rule);
                    }
                };
                wfEndPointObj.endPointPath.drag(move, start, up);
            }

            this.delete = function () {
                this.endPointPath.remove();
                delete wfEndPointObj;
            }


        }

        function _getNodeByKey(key) {
            var node = null;
            if (viewObj != null && viewObj != undefined) {
                let nodeList = viewObj.nodeList;
                if ($.listIsNotEmpty(nodeList)) {
                    $(nodeList).each(function (indexNode, itemNode) {
                        if (itemNode.nodeSettings.key == key) {
                            node = itemNode;
                        }
                    });
                }
            }
            return node;
        }

        function _getRuleByKey(key) {
            var rule = null;
            if (viewObj != null && viewObj != undefined) {
                let ruleList = viewObj.ruleList;
                if ($.listIsNotEmpty(ruleList)) {
                    $(ruleList).each(function (indexRule, itemRule) {
                        if (itemRule.ruleSettings.key == key) {
                            rule = itemRule;
                        }
                    });
                }
            }
            return rule;
        }

        function _getRuleByNodeKey(nodeKey) {
            var rule = null;
            var returnRuleList = [];
            if (viewObj != null && viewObj != undefined) {
                let ruleList = viewObj.ruleList;
                if ($.listIsNotEmpty(ruleList)) {
                    $(ruleList).each(function (indexRule, itemRule) {
                        if (itemRule.ruleSettings.beginNodeKey == nodeKey || itemRule.ruleSettings.endNodeKey == nodeKey) {
                            returnRuleList.push(itemRule);
                        }
                    });
                }
            }
            return returnRuleList;
        }

        function _getLineByKey(key) {
            var rule = null;
            if (viewObj != null && viewObj != undefined) {
                let ruleList = viewObj.ruleList;
                if ($.listIsNotEmpty(ruleList)) {
                    $(ruleList).each(function (indexRule, itemRule) {
                        if (itemRule.ruleSettings.key == key) {
                            rule = itemRule;
                        }
                    });
                }
            }
            return rule;
        }

        function _getAnchoryKey(key) {
            var node = null;
            if (viewObj != null && viewObj != undefined) {
                let nodeList = viewObj.settings.nodeList;
                if (nodeList != null && nodeList != undefined && nodeList.length > 0) {
                    $(nodeList).each(function (indexNode, itemNode) {
                        if (itemNode.key == key) {
                            node = itemNode;
                        }
                    });
                }
            }
            return node;
        }


        function _getMenuView(_options) {

        }

        /**
         * 获取具有偏差的不同位置信息
         * @param node
         * @param position
         * @returns {null}
         */
        function getNodePoint(node, position) {
            var x = node.nodeSettings.nodeStyle.x;
            var y = node.nodeSettings.nodeStyle.y;
            var width = node.nodeSettings.nodeWidth;
            var height = node.nodeSettings.nodeHeight;
            var point = null;
            switch (position) {
                case "top":
                    point = {
                        x: x + (width / 2), y: y - 20
                    }
                    break;
                case "left":
                    point = {
                        x: x - 20, y: y + (height / 2)
                    }
                    break;
                case "right":
                    point = {
                        x: x + width + 20, y: y + (height / 2)
                    }
                    break;
                case "bottom":
                    point = {
                        x: x + (width / 2), y: y + height + 20
                    }
                    break;
                default:
                    break;
            }
            return point;
        }

        /**
         * 获取锚点信息，没有偏差
         * @param node
         * @param position
         * @returns {null}
         */
        function getNodeAnchorPoint(node, position) {
            var x = node.nodeSettings.nodeStyle.x;
            var y = node.nodeSettings.nodeStyle.y;
            var width = node.nodeSettings.nodeWidth;
            var height = node.nodeSettings.nodeHeight;
            var point = null;
            switch (position) {
                case "top":
                    point = {
                        x: x + (width / 2), y: y
                    }
                    break;
                case "left":
                    point = {
                        x: x, y: y + (height / 2)
                    }
                    break;
                case "right":
                    point = {
                        x: x + width, y: y + (height / 2)
                    }
                    break;
                case "bottom":
                    point = {
                        x: x + (width / 2), y: y + height
                    }
                    break;
                default:
                    break;
            }
            return point;
        }

        //
        function getTwoNodePointList(beginNode, endNode, beginPoint, endPoint, beginAnchor, endAnchor) {
            var pointList = [];
            var bx = beginNode.nodeSettings.nodeStyle.x;
            var by = beginNode.nodeSettings.nodeStyle.y;

            var ex = endNode.nodeSettings.nodeStyle.x;
            var ey = endNode.nodeSettings.nodeStyle.y;
            var xList = [bx - 20, bx + beginNode.nodeSettings.nodeWidth + 20, ex - 20, ex + endNode.nodeSettings.nodeWidth + 20];
            var yList = [by - 20, by + beginNode.nodeSettings.nodeHeight + 20, ey - 20, ey + endNode.nodeSettings.nodeHeight + 20];
            if (beginPoint != null && beginPoint != undefined && endPoint != null && endPoint != undefined) {
                xList = [bx - 20, bx + beginNode.nodeSettings.nodeWidth + 20, ex - 20, ex + endNode.nodeSettings.nodeWidth + 20, beginPoint.x, endPoint.x];
                yList = [by - 20, by + beginNode.nodeSettings.nodeHeight + 20, ey - 20, ey + endNode.nodeSettings.nodeHeight + 20, beginPoint.y, endPoint.y];
            }
            xList.sort();
            yList.sort();
            xList = $.unique(xList);
            yList = $.unique(yList);
            $(xList).each(function (xIndex, xItem) {
                $(yList).each(function (yIndex, yItem) {
                    // switch (beginAnchor) {
                    //     case "top":
                    //         if (xItem == beginPoint.x && yItem > beginPoint.y) {
                    //             return;
                    //         }
                    //         break;
                    //     case "left":
                    //         if (yItem == beginPoint.y && xItem > beginPoint.x) {
                    //             return;
                    //         }
                    //         break;
                    //     case "right":
                    //         if (yItem == beginPoint.y && xItem < beginPoint.x) {
                    //             return;
                    //         }
                    //         break;
                    //     case "bottom":
                    //         if (xItem == beginPoint.x && yItem < beginPoint.y) {
                    //             return;
                    //         }
                    //         break;
                    //     default:
                    //         break;
                    // }
                    // switch (endAnchor) {
                    //     case "top":
                    //         if (xItem == endPoint.x && yItem > endPoint.y) {
                    //             return;
                    //         }
                    //         break;
                    //     case "left":
                    //         if (yItem == endPoint.y && xItem > endPoint.x) {
                    //             return;
                    //         }
                    //         break;
                    //     case "right":
                    //         if (yItem == endPoint.y && xItem < endPoint.x) {
                    //             return;
                    //         }
                    //         break;
                    //     case "bottom":
                    //         if (xItem == endPoint.x && yItem < endPoint.y) {
                    //             return;
                    //         }
                    //         break;
                    //     default:
                    //         break;
                    // }

                    pointList.push({
                        x: xItem, y: yItem
                    });
                });
            });
            return pointList;
        }

        /**
         * 获取两个节点之间的各个顶点链接的无向图
         * @param beginNode
         * @param endNode
         * @param beginPoint
         * @param endPoint
         * @param beginAnchor
         * @param endAnchor
         * @returns {*[]}
         */
        function getTwoNodeUndirectedGraphsList(beginNode, endNode, beginPoint, endPoint, beginAnchor, endAnchor) {
            var pointList = [];
            var bx = beginNode.nodeSettings.nodeStyle.x;
            var by = beginNode.nodeSettings.nodeStyle.y;

            var ex = endNode.nodeSettings.nodeStyle.x;
            var ey = endNode.nodeSettings.nodeStyle.y;
            var xList = [bx - 20, bx + beginNode.nodeSettings.nodeWidth + 20, ex - 20, ex + endNode.nodeSettings.nodeWidth + 20];
            var yList = [by - 20, by + beginNode.nodeSettings.nodeHeight + 20, ey - 20, ey + endNode.nodeSettings.nodeHeight + 20];
            if (beginPoint != null && beginPoint != undefined && endPoint != null && endPoint != undefined) {
                xList = [bx - 20, bx + beginNode.nodeSettings.nodeWidth + 20, ex - 20, ex + endNode.nodeSettings.nodeWidth + 20, beginPoint.x, endPoint.x];
                yList = [by - 20, by + beginNode.nodeSettings.nodeHeight + 20, ey - 20, ey + endNode.nodeSettings.nodeHeight + 20, beginPoint.y, endPoint.y];
            }
            xList.sort();
            yList.sort();
            xList = $.unique(xList);
            yList = $.unique(yList);
            $(xList).each(function (xIndex, xItem) {
                $(yList).each(function (yIndex, yItem) {
                    pointList.push({
                        x: xItem, y: yItem
                    });
                });
            });
            var map = [];

            return pointList;
        }

        /**
         * 初始化两个节点之间直角图
         * @param beginNode
         * @param endNode
         * @param point
         * @param pointList
         * @param map
         * @constructor
         */
        function InitUndirectedGraphs(beginNode, endNode, point, pointList, map) {

        }

        /**
         * 判断线段是否穿过节点
         * @param node
         * @param beginPoint
         * @param endPoint
         */
        function checkLineCrossNode(node, beginPoint, endPoint) {
            if (node == null || node == undefined) {
                return false;
            }
            if (beginPoint.x === endPoint.x) {
                let topPoint = {};
                let bottomPoint = {};
                if (beginPoint.y <= endPoint.y) {
                    topPoint = beginPoint;
                    bottomPoint = endPoint;
                } else {
                    topPoint = endPoint;
                    bottomPoint = beginPoint;
                }
                //竖线
                if (node.nodeSettings.nodeStyle.x <= topPoint.x && topPoint.x <= (node.nodeSettings.nodeStyle.x + node.nodeSettings.nodeWidth)
                    && topPoint.y <= (node.nodeSettings.nodeStyle.y + node.nodeSettings.nodeHeight) && bottomPoint.y >= node.nodeSettings.nodeStyle.y) {
                    return true;
                }
            }
            if (beginPoint.y === endPoint.y) {
                //横线
                let leftPoint = {};
                let rightPoint = {};
                if (beginPoint.x <= endPoint.x) {
                    leftPoint = beginPoint;
                    rightPoint = endPoint;
                } else {
                    leftPoint = endPoint;
                    rightPoint = beginPoint;
                }
                //竖线
                if (node.nodeSettings.nodeStyle.y <= leftPoint.y && leftPoint.y <= (node.nodeSettings.nodeStyle.y + node.nodeSettings.nodeHeight)
                    && leftPoint.x <= (node.nodeSettings.nodeStyle.x + node.nodeSettings.nodeWidth) && rightPoint.x > node.nodeSettings.nodeStyle.x) {
                    return true;
                }
            }
            return false;
        }


        /**
         * 判断两个节点是否相交
         * @param node
         * @param beginPoint
         * @param endPoint
         */
        function checkNodeCrossNode(node1, node2) {
            let leftTopPoint = {
                x: node1.nodeSettings.nodeStyle.x,
                y: node1.nodeSettings.nodeStyle.y
            };
            let leftBottomPoint = {
                x: node1.nodeSettings.nodeStyle.x,
                y: node1.nodeSettings.nodeStyle.y + node1.nodeSettings.nodeHeight
            };
            let rightTopPoint = {
                x: node1.nodeSettings.nodeStyle.x + node1.nodeSettings.nodeWidth,
                y: node1.nodeSettings.nodeStyle.y
            };
            let rightBottomPoint = {
                x: node1.nodeSettings.nodeStyle.x + node1.nodeSettings.nodeWidth,
                y: node1.nodeSettings.nodeStyle.y + node1.nodeSettings.nodeHeight
            };
            let pointList = [leftTopPoint, leftBottomPoint, rightTopPoint, rightBottomPoint];
            for (let i = 0; i < pointList.length; i++) {
                let itemPoint = pointList[i];
                if (node2.nodeSettings.nodeStyle.x <= itemPoint.x && itemPoint.x <= (node2.nodeSettings.nodeStyle.x + node2.nodeSettings.nodeStyle.nodeWidth)
                    && node2.nodeSettings.nodeStyle.y <= itemPoint.y && itemPoint.y <= (node2.nodeSettings.nodeStyle.y + node2.nodeSettings.nodeStyle.nodeHeight)) {
                    return true;
                }
            }
            return false;
        }

        function getAnchoryLinkPointList(beginNode, point) {
            var pointList = [];
            var bx = beginNode.nodeSettings.nodeStyle.x;
            var by = beginNode.nodeSettings.nodeStyle.y;
            var ex = point.x;
            var ey = point.y;
            var xList = [];
            var yList = [];
            if (bx - 20 <= ex && ex <= bx + beginNode.nodeSettings.nodeWidth + 20) {
                xList = [bx - 20, bx + beginNode.nodeSettings.nodeWidth + 20];
                yList = [by - 20, by + beginNode.nodeSettings.nodeHeight + 20, ey];
            } else {
                xList = [bx - 20, bx + beginNode.nodeSettings.nodeWidth + 20, ex];
                yList = [by - 20, by + beginNode.nodeSettings.nodeHeight + 20];
            }
            xList = $.unique(xList);
            yList = $.unique(yList);
            $(xList).each(function (xIndex, xItem) {
                $(yList).each(function (yIndex, yItem) {
                    pointList.push({
                        x: xItem, y: yItem
                    });
                });
            });
            return pointList;
        }


        function generateSameNodePath(beginPoint, endPoint, pointList) {
            //曼彻斯特路由算法，求出路径
            var pathList = [];
            var currentPoint = $.deepClone(beginPoint);
            var endX = endPoint.x;
            var endY = endPoint.y;

            pathList.push($.deepClone(beginPoint));
            while (currentPoint.x != endPoint.x || currentPoint.y != endPoint.y) {
                if (currentPoint.x != endPoint.x || currentPoint.y != endPoint.y) {
                    if (currentPoint.x <= endX) {
                        //水平向右边
                        var returnPoint = getHorizontalPointList(endX, currentPoint.y, pointList, "desc");
                        if (returnPoint != null && returnPoint != undefined) {
                            if (pathList.findIndex(function (item, index) {
                                return item.x == returnPoint.x && item.y == returnPoint.y;
                            }) > -1) {
                                break;
                            }
                            currentPoint = returnPoint;
                            pathList.push($.deepClone(returnPoint));
                        }
                    } else if (currentPoint.x > endX) {
                        //水平向左边
                        var returnPoint = getHorizontalPointList(endX, currentPoint.y, pointList, "asc");
                        if (returnPoint != null && returnPoint != undefined) {
                            if (pathList.findIndex(function (item, index) {
                                return item.x == returnPoint.x && item.y == returnPoint.y;
                            }) > -1) {
                                break;
                            }
                            currentPoint = returnPoint;
                            pathList.push($.deepClone(returnPoint));
                        }
                    }
                }
                if (currentPoint.x != endPoint.x || currentPoint.y != endPoint.y) {
                    if (currentPoint.y <= endY) {
                        //向下
                        var returnPoint = getVerticalPointList(endY, currentPoint.x, pointList, "desc");
                        if (returnPoint != null && returnPoint != undefined) {
                            if (pathList.findIndex(function (item, index) {
                                return item.x == returnPoint.x && item.y == returnPoint.y;
                            }) > -1) {
                                break;
                            }
                            currentPoint = returnPoint;
                            pathList.push($.deepClone(returnPoint));
                        }
                    } else if (currentPoint.y > endY) {
                        //向上
                        var returnPoint = getVerticalPointList(endY, currentPoint.x, pointList, "asc");
                        if (returnPoint != null && returnPoint != undefined) {
                            if (pathList.findIndex(function (item, index) {
                                return item.x == returnPoint.x && item.y == returnPoint.y;
                            }) > -1) {
                                break;
                            }
                            currentPoint = returnPoint;
                            pathList.push($.deepClone(returnPoint));
                        }
                    }
                }
            }
            pathList.push($.deepClone(endPoint));
            return pathList;
        }


        function generateManhattanPath(beginPoint, endPoint, pointList) {
            //曼彻斯特路由算法，求出路径
            var pathList = [];
            var currentPoint = $.deepClone(beginPoint);
            var endX = endPoint.x;
            var endY = endPoint.y;

            pathList.push($.deepClone(beginPoint));

            while (currentPoint.x != endPoint.x && currentPoint.y != endPoint.y) {
                if (pathList.length > 10) {
                    break;
                }
                if (currentPoint.x != endPoint.x && currentPoint.y != endPoint.y) {
                    if (currentPoint.x < endX) {
                        //水平向右边
                        var returnPoint = getHorizontalPointList(endX, currentPoint.y, pointList, "desc");
                        if (returnPoint != null && returnPoint != undefined) {
                            currentPoint = returnPoint;
                            // var pointCircle = viewObj.wf_view.circle(currentPoint.x, currentPoint.y, (pathList.length + 1) * 2);
                            // pointCircle.attr({"fill": "#deab8a", "stroke": "#deab8a"});
                            // testPointList.push(pointCircle);
                            pathList.push($.deepClone(returnPoint));
                        }
                    } else if (currentPoint.x > endX) {
                        //水平向左边
                        var returnPoint = getHorizontalPointList(endX, currentPoint.y, pointList, "asc");
                        if (returnPoint != null && returnPoint != undefined) {
                            currentPoint = returnPoint;
                            // var pointCircle = viewObj.wf_view.circle(currentPoint.x, currentPoint.y, (pathList.length + 1) * 2);
                            // pointCircle.attr({"fill": "#deab8a", "stroke": "#deab8a"});
                            // testPointList.push(pointCircle);
                            pathList.push($.deepClone(returnPoint));
                        }
                    }
                }
                if (currentPoint.x != endPoint.x && currentPoint.y != endPoint.y) {
                    if (currentPoint.y < endY) {
                        //向下
                        var returnPoint = getVerticalPointList(endY, currentPoint.x, pointList, "desc");
                        if (returnPoint != null && returnPoint != undefined) {
                            currentPoint = returnPoint;
                            // var pointCircle = viewObj.wf_view.circle(currentPoint.x, currentPoint.y, (pathList.length + 1) * 2);
                            // pointCircle.attr({"fill": "#deab8a", "stroke": "#deab8a"});
                            // testPointList.push(pointCircle);
                            pathList.push($.deepClone(returnPoint));
                        }
                    } else if (currentPoint.y > endY) {
                        //向上
                        var returnPoint = getVerticalPointList(endY, currentPoint.x, pointList, "asc");
                        if (returnPoint != null && returnPoint != undefined) {
                            currentPoint = returnPoint;
                            // var pointCircle = viewObj.wf_view.circle(currentPoint.x, currentPoint.y, (pathList.length + 1) * 2);
                            // pointCircle.attr({"fill": "#deab8a", "stroke": "#deab8a"});
                            // testPointList.push(pointCircle);
                            pathList.push($.deepClone(returnPoint));
                        }
                    }
                }
            }
            pathList.push($.deepClone(endPoint));
            return pathList;
        }

        //#region begin 广度优先遍历寻路开始


        /**
         * 广度优先寻路方法
         * @param beginPoint 开始点
         * @param endPoint   结束点
         * @param pointList  所有的点集合
         * @param beginNode 开始节点
         * @param endNode  结束节点
         * @param isAvoid  是否避障，0：不避障，1表示避障，默认是0不避障
         */
// javascript
//         function generateBSFPath(beginAnchorPoint, endAnchorPoint, beginPoint, endPoint, pointList, beginNode, endNode, isAvoid) {
//             if ($.isempty(beginPoint) || $.isempty(endPoint) || $.listIsEmpty(pointList)) {
//                 throw "开始节点，结束节点，点集合不能为空";
//             }
//
//             // 1. 建立点索引和坐标映射
//             var pts = pointList; // 假定 pointList 中每项为 {x,y}
//             var n = pts.length;
//             var keyOf = function(p){ return p.x + '_' + p.y; };
//             var indexMap = Object.create(null);
//             var points = new Array(n);
//             for (var i = 0; i < n; i++) {
//                 var k = keyOf(pts[i]);
//                 indexMap[k] = i;
//                 points[i] = { x: pts[i].x, y: pts[i].y };
//             }
//
//             // 2. 为快速邻居查找构建列/行映射： xsMap: x -> sorted y[], ysMap: y -> sorted x[]
//             var xsMap = Object.create(null), ysMap = Object.create(null);
//             for (var i = 0; i < n; i++) {
//                 var p = points[i];
//                 (xsMap[p.x] || (xsMap[p.x] = [])).push(p.y);
//                 (ysMap[p.y] || (ysMap[p.y] = [])).push(p.x);
//             }
//             var sortNum = function(a,b){ return a-b; };
//             for (var k in xsMap) xsMap[k].sort(sortNum);
//             for (var k2 in ysMap) ysMap[k2].sort(sortNum);
//
//             // 辅助：二分查找上/下一个值
//             function findNeighborsOnSameX(x, y) {
//                 var arr = xsMap[x];
//                 if (!arr) return [];
//                 var lo = 0, hi = arr.length - 1;
//                 while (lo <= hi) {
//                     var mid = (lo + hi) >> 1;
//                     if (arr[mid] === y) { lo = mid; break; }
//                     if (arr[mid] < y) lo = mid + 1; else hi = mid - 1;
//                 }
//                 var idx = lo;
//                 // 调整若未精确命中
//                 if (arr[idx] !== y) {
//                     if (idx > 0 && arr[idx - 1] === y) idx = idx - 1;
//                     else {
//                         // find closest position index where arr[idx] >= y
//                         // ensure idx in [0, arr.length)
//                         if (idx >= arr.length) idx = arr.length - 1;
//                     }
//                 } else {
//                     // find actual index of y
//                     // move left to find exact index
//                     while (idx > 0 && arr[idx - 1] === y) idx--;
//                 }
//                 var res = [];
//                 // previous distinct
//                 for (var j = idx - 1; j >= 0; j--) {
//                     if (arr[j] !== y) { res.push({x: x, y: arr[j]}); break; }
//                 }
//                 // next distinct
//                 for (var j2 = idx + 1; j2 < arr.length; j2++) {
//                     if (arr[j2] !== y) { res.push({x: x, y: arr[j2]}); break; }
//                 }
//                 return res;
//             }
//             function findNeighborsOnSameY(y, x) {
//                 var arr = ysMap[y];
//                 if (!arr) return [];
//                 var lo = 0, hi = arr.length - 1;
//                 while (lo <= hi) {
//                     var mid = (lo + hi) >> 1;
//                     if (arr[mid] === x) { lo = mid; break; }
//                     if (arr[mid] < x) lo = mid + 1; else hi = mid - 1;
//                 }
//                 var idx = lo;
//                 if (arr[idx] !== x) {
//                     if (idx > 0 && arr[idx - 1] === x) idx = idx - 1;
//                     else {
//                         if (idx >= arr.length) idx = arr.length - 1;
//                     }
//                 } else {
//                     while (idx > 0 && arr[idx - 1] === x) idx--;
//                 }
//                 var res = [];
//                 for (var j = idx - 1; j >= 0; j--) {
//                     if (arr[j] !== x) { res.push({x: arr[j], y: y}); break; }
//                 }
//                 for (var j2 = idx + 1; j2 < arr.length; j2++) {
//                     if (arr[j2] !== x) { res.push({x: arr[j2], y: y}); break; }
//                 }
//                 return res;
//             }
//
//             // 3. 预构建邻接表（只连接同 x 或同 y 的最近点，保持直角路径）
//             var adj = new Array(n);
//             for (var i = 0; i < n; i++) adj[i] = [];
//
//             // 预取所有待检测的节点，避免在内部循环中访问全局结构多次
//             var nodeArr = (viewObj && viewObj.nodeList) ? viewObj.nodeList.slice() : [];
//             // 如果 isAvoid 为真，则开启障碍检测
//             var needAvoid = !!isAvoid;
//
//             // 检测两个点间线段是否与任一节点相交（快速退出）
//             function segmentBlocked(a, b) {
//                 if (!needAvoid) return false;
//                 // 边界情况：如果 a 或 b 在节点内部，也当作阻挡（保持严格避障）
//                 for (var ni = 0; ni < nodeArr.length; ni++) {
//                     var nd = nodeArr[ni];
//                     if (!nd) continue;
//                     if (checkLineCrossNode(nd, a, b)) return true;
//                 }
//                 return false;
//             }
//
//             for (var i = 0; i < n; i++) {
//                 var p = points[i];
//                 // same x neighbors
//                 var nlistX = findNeighborsOnSameX(p.x, p.y);
//                 for (var jj = 0; jj < nlistX.length; jj++) {
//                     var np = nlistX[jj];
//                     var k = indexMap[np.x + '_' + np.y];
//                     if (k === undefined) continue;
//                     if (!segmentBlocked(p, np)) adj[i].push(k);
//                 }
//                 // same y neighbors
//                 var nlistY = findNeighborsOnSameY(p.y, p.x);
//                 for (var kk = 0; kk < nlistY.length; kk++) {
//                     var np2 = nlistY[kk];
//                     var k2 = indexMap[np2.x + '_' + np2.y];
//                     if (k2 === undefined) continue;
//                     if (!segmentBlocked(p, np2)) adj[i].push(k2);
//                 }
//             }
//
//             // 4. 找到起点/终点对应的索引（精确匹配），或选取最近的格点
//             var startKey = keyOf(beginPoint), endKey = keyOf(endPoint);
//             var startIdx = indexMap[startKey];
//             var endIdx = indexMap[endKey];
//
//             // 如果起点或终点未在点集内，尝试找到最接近的 grid 点（同 x 或同 y）
//             function findClosestIndexFor(pnt) {
//                 var cand = null, bestDist = Infinity;
//                 // 尝试同 x 列的 y 列表
//                 var arrY = xsMap[pnt.x] || [];
//                 for (var i2 = 0; i2 < arrY.length; i2++) {
//                     var yy = arrY[i2];
//                     var k = indexMap[pnt.x + '_' + yy];
//                     if (k === undefined) continue;
//                     var d = Math.abs(yy - pnt.y);
//                     if (d < bestDist) { bestDist = d; cand = k; }
//                 }
//                 var arrX = ysMap[pnt.y] || [];
//                 for (var j2 = 0; j2 < arrX.length; j2++) {
//                     var xx = arrX[j2];
//                     var k2 = indexMap[xx + '_' + pnt.y];
//                     if (k2 === undefined) continue;
//                     var d2 = Math.abs(xx - pnt.x);
//                     if (d2 < bestDist) { bestDist = d2; cand = k2; }
//                 }
//                 // 若仍无候选，返回 -1
//                 return (cand === null) ? -1 : cand;
//             }
//
//             if (startIdx === undefined) startIdx = findClosestIndexFor(beginPoint);
//             if (endIdx === undefined) endIdx = findClosestIndexFor(endPoint);
//
//             if (startIdx < 0 || endIdx < 0) {
//                 // 无可用网格，回退 L 形
//                 return [{x: beginPoint.x, y: beginPoint.y}, {x: beginPoint.x, y: endPoint.y}, {x: endPoint.x, y: endPoint.y}];
//             }
//
//             // 5. BFS（整数队列，TypedArray 存储 visited/prev）
//             var visited = new Uint8Array(n);
//             var prev = new Int32Array(n);
//             for (var i3 = 0; i3 < n; i3++) prev[i3] = -1;
//
//             var queue = new Array(n);
//             var qHead = 0, qTail = 0;
//             queue[qTail++] = startIdx;
//             visited[startIdx] = 1;
//             var found = false;
//             while (qHead < qTail) {
//                 var cur = queue[qHead++];
//                 if (cur === endIdx) { found = true; break; }
//                 var neighbors = adj[cur];
//                 for (var ni = 0; ni < neighbors.length; ni++) {
//                     var nb = neighbors[ni];
//                     if (!visited[nb]) {
//                         visited[nb] = 1;
//                         prev[nb] = cur;
//                         queue[qTail++] = nb;
//                     }
//                 }
//             }
//
//             if (!found) {
//                 // 无路径：回退简单折线
//                 return [{x: beginPoint.x, y: beginPoint.y}, {x: beginPoint.x, y: endPoint.y}, {x: endPoint.x, y: endPoint.y}];
//             }
//
//             // 6. 重建路径并压缩共线点
//             var pathIdxs = [];
//             var curIdx = endIdx;
//             while (curIdx !== -1) {
//                 pathIdxs.push(curIdx);
//                 if (curIdx === startIdx) break;
//                 curIdx = prev[curIdx];
//             }
//             pathIdxs.reverse();
//
//             var rawPath = pathIdxs.map(function(i){ return {x: points[i].x, y: points[i].y}; });
//
//             // 压缩共线点
//             var compact = [];
//             for (var pi = 0; pi < rawPath.length; pi++) {
//                 if (compact.length < 2) compact.push(rawPath[pi]);
//                 else {
//                     var a = compact[compact.length - 2];
//                     var b = compact[compact.length - 1];
//                     var c = rawPath[pi];
//                     // 如果 a->b 与 b->c 共线则替换 b 为 c，否则追加 c
//                     if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
//                         compact[compact.length - 1] = c;
//                     } else {
//                         compact.push(c);
//                     }
//                 }
//             }
//
//             // 用精确起止锚点替换首尾，保证偏移精确
//             if (compact.length > 0) {
//                 compact[0] = { x: beginPoint.x, y: beginPoint.y };
//                 compact[compact.length - 1] = { x: endPoint.x, y: endPoint.y };
//             } else {
//                 compact = [{x: beginPoint.x, y: beginPoint.y}, {x: endPoint.x, y: endPoint.y}];
//             }
//
//             return compact;
//         }

        function generateBSFPath(beginAnchorPoint, endAnchorPoint, beginPoint, endPoint, pointList, beginNode, endNode, isAvoid) {
            if ($.isempty(beginPoint) || $.isempty(endPoint) || $.listIsEmpty(pointList)) {
                throw "开始节点，结束节点，点集合不能为空";
                return;
            }
            var xSet = new Set();
            var ySet = new Set();
            for (var i = 0; i < pointList.length; i++) {
                xSet.add(pointList[i].x);
                ySet.add(pointList[i].y);
            }
            var xList = Array.from(xSet);
            var yList = Array.from(ySet);

            xList = xList.sort(function (a, b) {
                return a - b;
            });


            yList = yList.sort(function (a, b) {
                return a - b;
            });
            //最终寻路完成的路线集合
            var endLineList = [];
            //临时的线集合
            var tempLineList = [];

            //所有已经遍历过的点的集合,且记录到这个点的最小转折次数
            var overPointList = {};

            var pointInfoVar = {
                x: beginPoint.x,
                y: beginPoint.y,
                minTurnNumber: 0
            }
            overPointList[getPointMapKey(pointInfoVar)] = 0;
            // var firstNearPointList = getNearestPoint(beginPoint, pointList, beginNode, endNode, isAvoid);
            var firstNearPointList = getNewNearestPoint(beginPoint, xList, yList, beginNode, endNode, isAvoid);
            for (var i = 0; i < firstNearPointList.length; i++) {
                var turnNumber = 0;
                var isEnd = 0;

                if (endPoint.x == firstNearPointList[i].x && endPoint.y == firstNearPointList[i].y) {
                    isEnd = 1;
                }


                var firstLineInfo = {
                    beginPoint: beginPoint,
                    endPoint: firstNearPointList[i],
                    pointList: [beginPoint, firstNearPointList[i]],
                    pintMap: {},
                    turnNumber: turnNumber,
                    isEnd: isEnd
                }
                firstLineInfo.pintMap[getPointMapKey(beginPoint)] = 1
                firstLineInfo.pintMap[getPointMapKey(firstNearPointList[i])] = 1
                if (isEnd == 1) {
                    //结束点可以直接链接的，直接返回，不需要再往下面走了
                    endLineList.push(firstLineInfo);
                    return endLineList;
                }
                var firstPointInfo = {
                    x: firstNearPointList[i].x,
                    y: firstNearPointList[i].y,
                    minTurnNumber: 1
                }
                // overPointList.push(firstPointInfo);

                overPointList[getPointMapKey(firstPointInfo)] = 1;
                tempLineList.push(firstLineInfo);
            }

            beginCIshu = 0;
            while (tempLineList.length > 0) {
                // if ($.listIsNotEmpty(endLineList)) {
                //     break;
                // }
                var tempLineListVar = [];
                //将临时路径集合按照转弯次数正序排列，以确保到达某一个点的时候，转弯次数最少的路径优先被选择
                tempLineList = tempLineList.sort(function (a, b) {
                    return a.turnNumber - b.turnNumber;
                });
                var overPointListVar = $.deepClone(overPointList);
                for (var i = 0; i < tempLineList.length; i++) {

                    var lineInfoBegin = $.deepClone(tempLineList[i]);

                    // var nearPointList = getNearestPoint(lineInfoBegin.endPoint, pointList, beginNode, endNode, isAvoid);

                    var nearPointList = getNewNearestPoint(lineInfoBegin.endPoint, xList, yList, beginNode, endNode, isAvoid);
                    if ($.isNotEmpty(nearPointList)) {
                        for (var j = 0; j < nearPointList.length; j++) {
                            beginCIshu = beginCIshu + 1;
                            var pointVar = lineInfoBegin.pintMap[getPointMapKey(nearPointList[j])];
                            if (pointVar != null && pointVar != undefined) {
                                //判断该节点在路径中是否已经有了，如果已经有了，则不再遍历这个节点，路径到此中断
                                continue;
                            }
                            var lineInfoVar = $.deepClone(tempLineList[i]);
                            var beforePoint = getBeforPoint(lineInfoVar.endPoint, lineInfoVar.pointList);
                            if (isTrun(beforePoint, nearPointList[j], lineInfoVar.endPoint)) {
                                //如果转弯了，则转弯的次数加1
                                lineInfoVar.turnNumber = lineInfoVar.turnNumber + 1;
                            }

                            var overPointMinTurnNumber = overPointListVar[getPointMapKey(nearPointList[j])];
                            if (overPointMinTurnNumber != null && overPointMinTurnNumber != undefined &&
                                overPointMinTurnNumber < lineInfoVar.turnNumber) {
                                continue;
                            }

                            overPointList[getPointMapKey(nearPointList[j])] = lineInfoVar.turnNumber;
                            var isEndVar = 0;
                            if (endPoint.x == nearPointList[j].x && endPoint.y == nearPointList[j].y) {
                                isEndVar = 1;
                            }
                            lineInfoVar.isEnd = isEndVar;
                            lineInfoVar.endPoint = nearPointList[j];
                            lineInfoVar.pointList.push(nearPointList[j]);
                            lineInfoVar.pintMap[getPointMapKey(nearPointList[j])] = 1
                            tempLineListVar.push(lineInfoVar);
                            if (isEndVar == 1) {
                                // return lineInfoVar.pointList;
                                endLineList.push(lineInfoVar);
                            }
                        }
                    }
                }

                tempLineList = tempLineListVar;

            }


            if ($.isNotEmpty(beginAnchorPoint)) {
                if (endLineList.length > 1) {
                    for (var i = 0; i < endLineList.length; i++) {
                        var lineInfo = endLineList[i];
                        if (isTrun(beginAnchorPoint, lineInfo.pointList[0], lineInfo.pointList[1])) {
                            endLineList[i].turnNumber = endLineList[i].turnNumber + 1;
                        }
                    }
                }
            }
            if ($.isNotEmpty(endAnchorPoint)) {
                if (endLineList.length > 1) {
                    for (var i = 0; i < endLineList.length; i++) {
                        var lineInfo = endLineList[i];
                        if (isTrun(endAnchorPoint, lineInfo.pointList[lineInfo.pointList.length - 2], lineInfo.pointList[lineInfo.pointList.length - 1])) {
                            endLineList[i].turnNumber = endLineList[i].turnNumber + 1;
                        }
                    }
                }
            }
            endLineList = endLineList.sort(function (a, b) {
                return a.turnNumber - b.turnNumber;
            });

            console.log(beginCIshu);
            if ($.listIsEmpty(endLineList)) {
                return [];
            }
            return endLineList[0].pointList;
        }

        /**
         * 根据点获取哈希键
         * @param point
         * @returns {string}
         */
        function getPointMapKey(point) {
            if ($.isNotEmpty(point)) {
                return "X" + point.x + "Y" + point.y;
            }
            return "";
        }

        /**
         * 判断点是否在集合中
         *
         * @param point 被寻找的点
         * @param pointList 已经被遍历过的点的集合
         */
        function isPointInPointList(point, pointList) {
            if ($.listIsNotEmpty(pointList)) {
                for (var i = 0; i < pointList.length; i++) {
                    if (point.x == pointList[i].x && point.y == pointList[i].y) {
                        return true;
                    }
                }
            }
            return false;
        }

        /**
         * 在已经被遍历过的点中寻找同一个点
         *
         * @param point 被寻找的点
         * @param overPointList 已经被遍历过的点的集合
         */
        function getPointInOverPointList(point, overPointList) {
            if ($.listIsNotEmpty(overPointList)) {
                for (var i = 0; i < overPointList.length; i++) {
                    if (point.x == overPointList[i].x && point.y == overPointList[i].y) {
                        return overPointList[i];
                    }
                }
            }
            return null;
        }

        /**
         * 设置在已经被遍历过的节点中，最小的转弯次数
         *
         * @param point 被寻找的点
         * @param overPointList 已经被遍历过的点的集合
         */
        function setPointInOverPointList(overPoint, overPointList) {
            if ($.listIsNotEmpty(overPointList)) {
                for (var i = 0; i < overPointList.length; i++) {
                    if (overPoint.x == overPointList[i].x && overPoint.y == overPointList[i].y) {
                        overPointList[i].minTurnNumber = overPoint.minTurnNumber;
                    }
                }
            }
        }

        /**
         * 获取相邻的点
         * @param point 当前点
         * @param pointList 所有的点集合
         * @param beginNode 开始节点
         * @param endNode   结束节点
         * @param isAvoid   是否避障，1表示避障，0表示不需要避障，默认是0 不避障
         * @returns {*[]} 返回相邻上下左右的节点集合
         */
        function getNearestPoint(point, pointList, beginNode, endNode, isAvoid) {
            var nearPointList = [];
            if ($.isNotEmpty(point) && $.listIsNotEmpty(pointList)) {
                var leftPointList = pointList.filter(function (pointItem) {
                    //水平向左边
                    return pointItem.y == point.y && pointItem.x < point.x;
                }).sort(function (a, b) {
                    return b.x - a.x;
                });

                var rightPointList = pointList.filter(function (pointItem) {
                    //水平向右边
                    return pointItem.y == point.y && pointItem.x > point.x;
                }).sort(function (a, b) {
                    return a.x - b.x;
                });
                var topPointList = pointList.filter(function (pointItem) {
                    //向上
                    return pointItem.x == point.x && pointItem.y < point.y;
                }).sort(function (a, b) {
                    return b.y - a.y;
                });

                var bottomPointList = pointList.filter(function (pointItem) {
                    //向下
                    return pointItem.x == point.x && pointItem.y > point.y;
                }).sort(function (a, b) {
                    return a.y - b.y;
                });
                if ($.listIsNotEmpty(leftPointList)) {
                    let leftPoint = leftPointList[0];
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, leftPoint) && !checkLineCrossNode(endNode, point, leftPoint)) {
                            nearPointList.push(leftPoint);
                        }
                    } else {
                        nearPointList.push(leftPoint);
                    }
                }
                if ($.listIsNotEmpty(rightPointList)) {
                    let rightPoint = rightPointList[0];
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, rightPoint) && !checkLineCrossNode(endNode, point, rightPoint)) {
                            nearPointList.push(rightPoint);
                        }
                    } else {
                        nearPointList.push(rightPoint);
                    }
                }

                if ($.listIsNotEmpty(topPointList)) {
                    let topPoint = topPointList[0];
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, topPoint) && !checkLineCrossNode(endNode, point, topPoint)) {
                            nearPointList.push(topPoint);
                        }
                    } else {
                        nearPointList.push(topPoint);
                    }
                }

                if ($.listIsNotEmpty(bottomPointList)) {
                    let bottomPoint = bottomPointList[0];
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, bottomPoint) && !checkLineCrossNode(endNode, point, bottomPoint)) {
                            nearPointList.push(bottomPoint);
                        }
                    } else {
                        nearPointList.push(bottomPoint);
                    }
                }
            }
            // if ($.listIsNotEmpty(nearPointList)) {
            //
            //     setTimeout(function () {
            //         if ($.listIsNotEmpty(testBeginPointList)) {
            //             $(testBeginPointList).each(function (xIndex, xItem) {
            //                 xItem.remove();
            //             });
            //         }
            //         if ($.listIsNotEmpty(testAfterPointList)) {
            //             $(testAfterPointList).each(function (xIndex, xItem) {
            //                 xItem.remove();
            //             });
            //         }
            //         var pointCircle = viewObj.wf_view.circle(point.x, point.y, 10);
            //         pointCircle.attr({"fill": "green", "stroke": "red"});
            //         testBeginPointList.push(pointCircle);
            //         for (var i = 0; i < nearPointList.length; i++) {
            //             var pointCircle = viewObj.wf_view.circle(nearPointList[i].x, nearPointList[i].y, 10);
            //             pointCircle.attr({"fill": "#efeff0", "stroke": "red"});
            //             testAfterPointList.push(pointCircle);
            //         }
            //     }, showTime * 1000);
            //
            // }
            // showPointList.push(point);
            // var time1 = (new Date()).getTime();
            // var i=true;
            // while (i){
            //     var time2 = (new Date()).getTime();
            //     if((time2-time1)>4000){
            //         i=false;
            //     }
            // }
            // showTime = showTime + 1;
            return nearPointList;
        }

        /**
         * 获取相邻的点
         * @param point 当前点
         * @param pointList 所有的点集合
         * @param beginNode 开始节点
         * @param endNode   结束节点
         * @param isAvoid   是否避障，1表示避障，0表示不需要避障，默认是0 不避障
         * @returns {*[]} 返回相邻上下左右的节点集合
         */
        function getNewNearestPoint(point, xList, yList, beginNode, endNode, isAvoid) {
            var nearPointList = [];
            if ($.isNotEmpty(point) && $.listIsNotEmpty(xList) && $.listIsNotEmpty(yList)) {
                var leftPointList = xList.filter(function (x) {
                    //水平向左边
                    return x < point.x;
                });

                var rightPointList = xList.filter(function (x) {
                    //水平向右边
                    return x > point.x;
                });
                var topPointList = yList.filter(function (y) {
                    //向上
                    return y < point.y;
                });

                var bottomPointList = yList.filter(function (y) {
                    //向下
                    return y > point.y;
                });

                if ($.listIsNotEmpty(leftPointList)) {
                    let leftPoint = {
                        x: leftPointList[leftPointList.length - 1],
                        y: point.y
                    }
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, leftPoint) && !checkLineCrossNode(endNode, point, leftPoint)) {
                            nearPointList.push(leftPoint);
                        }
                    } else {
                        nearPointList.push(leftPoint);
                    }
                }
                if ($.listIsNotEmpty(rightPointList)) {
                    let rightPoint = {
                        x: rightPointList[0],
                        y: point.y
                    }
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, rightPoint) && !checkLineCrossNode(endNode, point, rightPoint)) {
                            nearPointList.push(rightPoint);
                        }
                    } else {
                        nearPointList.push(rightPoint);
                    }
                }

                if ($.listIsNotEmpty(topPointList)) {
                    let topPoint = {
                        x: point.x,
                        y: topPointList[topPointList.length - 1]
                    }
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, topPoint) && !checkLineCrossNode(endNode, point, topPoint)) {
                            nearPointList.push(topPoint);
                        }
                    } else {
                        nearPointList.push(topPoint);
                    }
                }

                if ($.listIsNotEmpty(bottomPointList)) {
                    let bottomPoint = {
                        x: point.x,
                        y: bottomPointList[0]
                    }
                    if (isAvoid) {
                        if (!checkLineCrossNode(beginNode, point, bottomPoint) && !checkLineCrossNode(endNode, point, bottomPoint)) {
                            nearPointList.push(bottomPoint);
                        }
                    } else {
                        nearPointList.push(bottomPoint);
                    }
                }
            }

            return nearPointList;
        }

        /**
         * 获取在网格中这三个点是否转弯
         * @param point1
         * @param point2
         * @param point3
         * @returns {boolean}
         */
        function isTrun(point1, point2, point3) {
            if (point1.x == point2.x && point2.x == point3.x) {
                //都是在一个垂直线上
                return false;
            }
            if (point1.y == point2.y && point2.y == point3.y) {
                //都是在一个水平线上
                return false;
            }
            return true;
        }

        /**
         * 获取在当前点前面的一个点
         * @param point
         * @param pointList
         */

        function getBeforPoint(point, pointList) {
            if ($.listIsNotEmpty(pointList)) {
                var index = pointList.findIndex(function (pointItem) {
                    return pointItem.x == point.x && pointItem.y == point.y;
                });
                if (index == 0) {
                    return null;
                }
                return pointList[index - 1];
            }
            return null;
        }

        //#endregion 广度优先遍历寻路结束

        function getHorizontalPointList(endx, y, pointList, order) {
            var newPointList = pointList.filter(function (point) {
                if (order == "desc") {
                    //水平向右边
                    return point.y == y && point.x <= endx;
                } else {
                    //水平向左边
                    return point.y == y && point.x >= endx;
                }
            }).sort(function (a, b) {
                if (order == "desc") {
                    return b.x - a.x;
                } else {
                    return a.x - b.x;
                }
            });
            return newPointList[0];
        }

        function getVerticalPointList(endy, x, pointList, order) {
            var newPointList = pointList.filter(function (point) {
                if (order == "desc") {
                    //向下
                    return point.x == x && point.y <= endy;
                } else {
                    //向上
                    return point.x == x && point.y >= endy;
                }
            }).sort(function (a, b) {
                if (order == "desc") {
                    return b.y - a.y;
                } else {
                    return a.y - b.y;
                }
            });
            return newPointList[0];
        }

        this.getNodeByKey = function (key) {
            return _getNodeByKey(key);
        }
        this.getRuleByKey = function (key) {
            return _getRuleByKey(key);
        }
        this.getRuleByNodeKey = function (key) {
            return _getRuleByNodeKey(key);
        }

        this.getLineByKey = function (key) {
            return _getLineByKey(key);
        }
        this.getAnchoryKey = function (key) {
            return _getAnchoryKey(key);
        }
        this.getMenuView = function (_options) {
            return _getMenuView(_options);
        }
        if ($.listIsNotEmpty(this.settings.nodeList)) {
            let nodeList = this.settings.nodeList;
            $(nodeList).each(function (nodeIndex, nodeItem) {
                var node = new wfnode(nodeItem);
                viewObj.nodeList.push(node);
            });
        }
        if ($.listIsNotEmpty(this.settings.ruleList)) {
            let ruleList = this.settings.ruleList;
            $(ruleList).each(function (ruleIndex, ruleItem) {
                var rule = new wfrule(ruleItem);
                viewObj.ruleList.push(rule);
            });
        }
        this.addNode = function (_nodeSetting) {
            var nodeNumber = 0;
            if ($.listIsNotEmpty(viewObj.nodeList)) {
                nodeNumber = viewObj.nodeList.length;
            }
            _nodeSetting.text = "节点" + (nodeNumber + 1);
            var node = new wfnode(_nodeSetting);
            viewObj.nodeList.push(node);
        }
        this.toJson = function () {
            return $.deepClone(this.settings);
        }
        return this;
    };

    $.isempty = function (str) {
        if (str == null || str == undefined || str == "" || $.trim(str) == "") {
            return true;
        }
        return false;
    }
    $.isNotEmpty = function (str) {
        return !$.isempty(str);
    }
    $.listIsEmpty = function (list) {
        if (list == null || list == undefined || list.length == 0) {
            return true;
        }
        return false;
    }
    $.dedupePointList = function (list) {
        var newPointList = [];
        if ($.listIsNotEmpty(list)) {
            for (var i = 0; i < list.length; i++) {
                if (i == 0 || i == (list.length - 1)) {
                    newPointList.push(list[i]);
                } else {
                    if (list[i].x == list[i - 1].x && list[i].x == list[i + 1].x) {
                        continue;
                    }
                    if (list[i].y == list[i - 1].y && list[i].y == list[i + 1].y) {
                        continue;
                    }
                    newPointList.push(list[i]);
                }
            }
        }
        return newPointList;
    }
    $.listIsNotEmpty = function (list) {
        return !$.listIsEmpty(list);
    }

    $.deepClone = function (obj) {
        return JSON.parse(JSON.stringify(obj))
    }

    $.uuid = function () {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";

        var uuid = s.join("");
        return uuid;
    }
})(jQuery);