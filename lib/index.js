'use strict';

var _matterJs = require('matter-js');

var _matterJs2 = _interopRequireDefault(_matterJs);

var _render = require('./render');

var _render2 = _interopRequireDefault(_render);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// for webpack build
_matterJs2.default.CanvasRender = _matterJs2.default.Render;
_matterJs2.default.Render = _render2.default;

module.exports = _matterJs2.default;