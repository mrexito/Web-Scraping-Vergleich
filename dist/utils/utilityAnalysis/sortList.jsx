"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortList = void 0;
var sortList = function (list, way) {
    if (way === void 0) { way = 'desc'; }
    if (way === 'asc') {
        list.sort(function (a, b) {
            return a.score - b.score;
        });
    }
    else if (way === 'desc') {
        list.sort(function (a, b) {
            return b.score - a.score;
        });
    }
    return list;
};
exports.sortList = sortList;
